"""Shared commit policy; source of truth: cncn_private/.conventions."""

import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POLICY = json.loads((ROOT / '.conventions/commit-policy.json').read_text(encoding='utf-8'))
SHARED_FILES = (
    '.conventions/commit-policy.json', '.conventions/commit-fixtures.json',
    'scripts/check_conventions.py', 'scripts/test_check_conventions.py',
    'scripts/install_git_hooks.py', '.githooks/commit-msg',
    '.github/workflows/conventions.yml',
)


def validate_subject(subject):
    errors = []
    if len(subject) > POLICY['header_max_length']:
        errors.append('header exceeds 100 characters')
    types = '|'.join(re.escape(value) for value in POLICY['types'])
    pattern = rf"(?:{types})\({POLICY['scope_pattern']}\)!?: [^\s].*"
    if not re.fullmatch(pattern, subject) or any(ord(char) < 32 for char in subject):
        errors.append('expected type(lowercase-scope): imperative subject; no gitmoji')
    return errors


def validate_message(message, is_merge=False):
    header = message.splitlines()[0] if message.splitlines() else ''
    if is_merge and re.fullmatch(r'Merge (?:branch|remote-tracking branch|pull request) .+', header):
        return []
    if (re.fullmatch(r'Revert ".+"', header)
            and re.search(r'^This reverts commit [0-9a-f]{40}\.$', message, re.MULTILINE)):
        return []
    return validate_subject(header)


def git(root, *args):
    result = subprocess.run(['git', '-C', str(root), *args], capture_output=True, text=True, encoding='utf-8')
    if result.returncode:
        raise ValueError(f"git {' '.join(args[:2])} failed: {result.stderr.strip()}")
    return result.stdout.strip()


def resolve_commit(root, revision):
    if not re.fullmatch(r'[a-zA-Z0-9_./@{}^~+-]+', revision) or revision.startswith('-'):
        raise ValueError('invalid commit revision')
    return git(root, 'rev-parse', '--verify', revision + '^{commit}')


def commits_to_check(base, head, root=ROOT):
    root = Path(root)
    baseline = resolve_commit(root, (root / '.conventions/baseline').read_text().strip())
    head = resolve_commit(root, head)
    ancestor = subprocess.run(['git', '-C', str(root), 'merge-base', '--is-ancestor', baseline, head],
                              capture_output=True)
    if ancestor.returncode:
        raise ValueError('migration baseline must be an ancestor of head; fetch full history')
    args = ['rev-list', '--reverse', '--topo-order', head, '^' + baseline]
    if base and set(base) != {'0'}:
        args.append('^' + resolve_commit(root, base))
    return git(root, *args).splitlines()


def check_parity(workspace):
    errors = []
    for repository in POLICY['repositories']:
        for relative in SHARED_FILES:
            path = Path(workspace) / repository / relative
            canonical = ROOT / relative
            # Git autocrlf is not policy drift.
            digest = lambda p: hashlib.sha256(p.read_bytes().replace(b'\r\n', b'\n')).digest()
            if not path.is_file() or digest(path) != digest(canonical):
                errors.append(f'{repository}/{relative}: differs from canonical policy')
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    commit = commands.add_parser('commit')
    commit.add_argument('--message-file', type=Path)
    commit.add_argument('--base')
    commit.add_argument('--head', default='HEAD')
    parity = commands.add_parser('parity')
    parity.add_argument('--workspace', required=True, type=Path)
    args = parser.parse_args()
    try:
        if args.command == 'parity':
            errors = check_parity(args.workspace)
        elif args.message_file:
            merge_head = git(ROOT, 'rev-parse', '--git-path', 'MERGE_HEAD')
            path = Path(merge_head)
            if not path.is_absolute():
                path = ROOT / path
            errors = validate_message(args.message_file.read_text(encoding='utf-8'), is_merge=path.exists())
        else:
            errors = []
            for sha in commits_to_check(args.base, args.head):
                message = git(ROOT, 'show', '-s', '--format=%B', sha)
                is_merge = len(git(ROOT, 'show', '-s', '--format=%P', sha).split()) > 1
                errors.extend(f'{sha[:8]}: {error}' for error in validate_message(message, is_merge))
        for error in errors:
            print(error, file=sys.stderr)
        if not errors:
            print('Conventions: PASS')
        return 1 if errors else 0
    except (ValueError, OSError) as error:
        print(f'Conventions cannot run: {error}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
