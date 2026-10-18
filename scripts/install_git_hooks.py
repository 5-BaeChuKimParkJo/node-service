"""Install repository-local hooks without replacing unrelated hook setups."""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def install(root=ROOT):
    if sys.version_info < (3, 10):
        raise ValueError('Python 3.10+ required')
    git = lambda *args: subprocess.run(['git', '-C', str(root), *args], capture_output=True, text=True)
    current = git('config', '--local', '--get', 'core.hooksPath').stdout.strip()
    if current and current not in ('.githooks', '.husky', '.husky/_'):
        raise ValueError(f'Existing hooksPath {current!r}; integrate .githooks/commit-msg manually')
    if current.startswith('.husky'):
        hook = Path(root) / '.husky/commit-msg'
        if not hook.is_file() or '.githooks/commit-msg' not in hook.read_text():
            raise ValueError('Keep Husky; call sh .githooks/commit-msg "$1" from its commit-msg hook first')
    else:
        legacy = git('rev-parse', '--git-path', 'hooks/commit-msg').stdout.strip()
        legacy = Path(legacy) if Path(legacy).is_absolute() else Path(root) / legacy
        if not current and legacy.is_file():
            raise ValueError('Existing .git/hooks/commit-msg; integrate manually before installation')
        result = git('config', '--local', 'core.hooksPath', '.githooks')
        if result.returncode:
            raise ValueError(result.stderr.strip())
    result = git('config', '--local', 'chalnak.python', sys.executable)
    if result.returncode:
        raise ValueError(result.stderr.strip())
    (Path(root) / '.githooks/commit-msg').chmod(0o755)
    print(f'Commit hook installed with {sys.executable}; existing pre-commit hooks preserved')


if __name__ == '__main__':
    try:
        install()
    except (ValueError, OSError) as error:
        print(error, file=sys.stderr)
        sys.exit(1)
