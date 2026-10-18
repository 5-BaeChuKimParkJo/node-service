import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function checkNaming(file, text) {
  const normalized = file.replaceAll('\\', '/');
  const basename = path.posix.basename(normalized);
  const violations = [];
  const add = (line, rule, name) => violations.push({ file, line, rule, name });
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.ts$/.test(basename)) add(1, 'portable-kebab-filename', basename);
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const visit = (node) => {
    if ((ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && node.name) {
      const name = node.name.text;
      const line = source.getLineAndCharacterOfPosition(node.name.getStart(source)).line + 1;
      if (/(?:Dto|DTO|Domain|Impl)(?:Mapper)?$/.test(name)) add(line, 'explicit-role-name', name);
      if (normalized.includes('/application/') && name.endsWith('Response')) add(line, 'application-result-name', name);
      if (ts.isClassDeclaration(node) && name.endsWith('Adapter') && !basename.endsWith('.adapter.ts')) {
        add(line, 'adapter-filename', name);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return violations;
}

export function checkWorkspace(root = '.') {
  const violations = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!['generated', 'node_modules', 'dist'].includes(entry.name)) walk(file);
      } else if (entry.name.endsWith('.ts') && !/\.(spec|test)\.ts$/.test(entry.name)) {
        violations.push(...checkNaming(file, fs.readFileSync(file, 'utf8')));
      }
    }
  };
  for (const directory of ['apps', 'libs']) walk(path.join(root, directory));
  return violations;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = checkWorkspace();
  for (const error of errors) console.error(`${error.file}:${error.line} ${error.rule}: ${error.name}`);
  if (!errors.length) console.log('Naming: PASS');
  process.exitCode = errors.length ? 1 : 0;
}
