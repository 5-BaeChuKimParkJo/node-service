import ts from 'typescript';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const normalize = (file) => path.resolve(file).replaceAll('\\', '/');
const innerLayer = (file) => file.includes('/domain/') ? 'domain' : file.includes('/application/') ? 'application'
  : /\/libs\/common\/src\/(common|types|schema)\//.test(file) ? 'contract' : null;
const generated = (file) => /\/(node_modules|generated|dist|build)\//.test(file);
const testFile = (file) => /\.(spec|test)\.[cm]?tsx?$/.test(file) || file.includes('/test/');
const implementation = (file) => /\/(adapter|infrastructure|prisma|persistence|presentation)\//.test(file)
  || /\/libs\/common\/src\/(kafka|redis|s3|middleware|filter|decorator|interceptor)\//.test(file);
const externalImplementation = (name) => /^(?:@prisma\/|@aws-sdk\/|@confluentinc\/|mongodb(?:\/|$)|mongoose(?:\/|$)|kafkajs(?:\/|$)|ioredis(?:\/|$)|redis(?:\/|$)|axios(?:\/|$)|fastify(?:\/|$)|@nestjs\/(?:platform|microservices))/.test(name);

export function checkArchitecture(tsconfigPath) {
  const configPath = normalize(tsconfigPath);
  const root = path.dirname(configPath);
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  if (parsed.errors.length) throw new Error(parsed.errors.map(e => ts.flattenDiagnosticMessageText(e.messageText, '\n')).join('\n'));
  const graph = new Map();
  const violations = [];
  const known = new Set();
  const add = (file, line, rule, dependency) => {
    const key = `${file}:${line}:${rule}:${dependency}`;
    if (!known.has(key)) { known.add(key); violations.push({ file: path.relative(root, file), line, rule, dependency }); }
  };

  function imports(file) {
    file = normalize(file);
    if (graph.has(file)) return graph.get(file);
    const text = ts.sys.readFile(file);
    if (text === undefined) return [];
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const edges = [];
    graph.set(file, edges);
    const edge = (node, expression) => {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      const name = expression && ts.isStringLiteralLike(expression) ? expression.text : null;
      const resolved = name ? ts.resolveModuleName(name, file, parsed.options, ts.sys).resolvedModule : null;
      const target = resolved ? normalize(resolved.resolvedFileName) : null;
      const isOwned = name === null || name.startsWith('.') || name.startsWith('apps/') || name.startsWith('libs/')
        || Object.keys(parsed.options.paths || {}).some(alias => name.startsWith(alias.split('*')[0]));
      edges.push({ name, target, line, isOwned });
    };
    const visit = (node) => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        if (node.moduleSpecifier) edge(node, node.moduleSpecifier);
      } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
        edge(node, node.moduleReference.expression);
      } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
        edge(node, node.argument.literal);
      } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
        edge(node, node.arguments[0]);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return edges;
  }

  for (const candidate of parsed.fileNames) {
    const origin = normalize(candidate);
    const layer = innerLayer(origin);
    if (!layer || generated(origin) || testFile(origin)) continue;
    const visited = new Set();
    const walk = (file, originLine) => {
      if (visited.has(file)) return;
      visited.add(file);
      for (const item of imports(file)) {
        const line = originLine || item.line;
        if (!item.target && item.isOwned) add(origin, line, 'unresolved-owned-import', item.name || '<dynamic>');
        if (externalImplementation(item.name || '') || (layer === 'domain' && item.name?.startsWith('@nestjs/'))) {
          add(origin, line, 'inner-to-implementation', item.name);
        }
        if (!item.target) continue;
        if (layer === 'contract' && item.target.includes('/apps/')) {
          add(origin, line, 'shared-to-application', path.relative(root, item.target));
          continue;
        }
        if (implementation(item.target) || item.target.includes('/generated/')) {
          add(origin, line, 'inner-to-implementation', path.relative(root, item.target));
        } else if (layer === 'domain' && innerLayer(item.target) === 'application') {
          add(origin, line, 'domain-to-application', path.relative(root, item.target));
        } else if (!generated(item.target) && !testFile(item.target)) {
          walk(item.target, line);
        }
      }
    };
    walk(origin, null);
  }
  return violations;
}

if (process.argv[1] && normalize(process.argv[1]) === normalize(fileURLToPath(import.meta.url))) {
  try {
    const errors = checkArchitecture(process.argv[2] || 'tsconfig.json');
    for (const error of errors) console.error(`${error.file}:${error.line} ${error.rule}: ${error.dependency}`);
    if (!errors.length) console.log('Architecture: PASS');
    process.exitCode = errors.length ? 1 : 0;
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
