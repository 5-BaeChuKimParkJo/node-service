import importlib.util
import json
import subprocess
import shutil
import tempfile
import unittest
import sys
from pathlib import Path

MODULE = Path(__file__).with_name('check_conventions.py')
spec = importlib.util.spec_from_file_location('conventions', MODULE)
conventions = importlib.util.module_from_spec(spec)
spec.loader.exec_module(conventions)


class CommitPolicyTest(unittest.TestCase):
    def test_shared_subject_fixtures(self):
        fixtures = json.loads((MODULE.parent.parent / '.conventions/commit-fixtures.json').read_text())
        for subject in fixtures['valid']:
            with self.subTest(subject=subject):
                self.assertEqual([], conventions.validate_subject(subject))
        for subject in fixtures['invalid']:
            with self.subTest(subject=subject):
                self.assertTrue(conventions.validate_subject(subject))

    def test_header_length_and_empty_subject(self):
        self.assertEqual([], conventions.validate_subject('fix(a): ' + 'x' * 92))
        self.assertTrue(conventions.validate_subject('fix(a): ' + 'x' * 93))
        self.assertTrue(conventions.validate_subject('fix(a):    '))

    def test_merge_requires_real_merge_context(self):
        self.assertTrue(conventions.validate_message("Merge branch 'main'"))
        self.assertEqual([], conventions.validate_message("Merge branch 'main'", is_merge=True))

    def test_standard_revert_requires_original_commit_trailer(self):
        self.assertTrue(conventions.validate_message('Revert "something"'))
        message = 'Revert "something"\n\nThis reverts commit ' + 'a' * 40 + '.'
        self.assertEqual([], conventions.validate_message(message))


class GitRangeTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.git('init', '-q')
        self.git('config', 'user.name', 'Policy Test')
        self.git('config', 'user.email', 'policy@example.invalid')
        self.base = self.commit('legacy message')
        (self.root / '.conventions').mkdir()
        (self.root / '.conventions/baseline').write_text(self.base)

    def tearDown(self):
        self.temp.cleanup()

    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.root), *args], text=True).strip()

    def commit(self, subject):
        self.git('-c', 'core.hooksPath=/dev/null', 'commit', '--allow-empty', '-qm', subject)
        return self.git('rev-parse', 'HEAD')

    def check_range(self, base, head='HEAD'):
        return conventions.commits_to_check(base, head, self.root)

    def test_push_and_initial_branch_skip_old_history(self):
        first = self.commit('fix(auction): preserve bids')
        second = self.commit('test(auction): cover duplicate bids')
        self.assertEqual([first, second], self.check_range(self.base))
        self.assertEqual([first, second], self.check_range('0' * 40))
        self.assertEqual([second], self.check_range(first))

    def test_missing_base_is_an_error_not_a_silent_skip(self):
        with self.assertRaises(ValueError):
            self.check_range('f' * 40)

    def test_force_update_excludes_only_reachable_history(self):
        old = self.commit('fix(a): old branch')
        self.git('checkout', '-q', '--detach', self.base)
        replacement = self.commit('fix(a): replacement branch')
        self.assertEqual([replacement], self.check_range(old))

    def test_merge_includes_invalid_constituent_commit(self):
        self.git('checkout', '-qb', 'topic')
        invalid = self.commit('invalid new commit')
        self.git('checkout', '-q', '--detach', self.base)
        other = self.commit('fix(a): another branch')
        self.git('merge', '--no-ff', 'topic', '-qm', "Merge branch 'topic'")
        commits = self.check_range(other)
        self.assertIn(invalid, commits)
        self.assertTrue(conventions.validate_message(self.git('show', '-s', '--format=%B', invalid)))

    def test_unrelated_baseline_is_an_error(self):
        self.git('checkout', '--orphan', 'unrelated', '-q')
        self.commit('fix(a): unrelated root')
        with self.assertRaises(ValueError):
            self.check_range(None)

    def test_installed_hook_accepts_valid_and_rejects_invalid_commit(self):
        for relative in ('.conventions/commit-policy.json', 'scripts/check_conventions.py',
                         'scripts/install_git_hooks.py', '.githooks/commit-msg'):
            destination = self.root / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(MODULE.parent.parent / relative, destination)
        subprocess.run([sys.executable, str(self.root / 'scripts/install_git_hooks.py')], check=True,
                       capture_output=True)
        failed = subprocess.run(['git', '-C', str(self.root), 'commit', '--allow-empty', '-m', 'invalid'],
                                capture_output=True)
        self.assertNotEqual(0, failed.returncode)
        good = subprocess.run(['git', '-C', str(self.root), 'commit', '--allow-empty', '-m', 'test(tooling): verify hook'],
                              capture_output=True)
        self.assertEqual(0, good.returncode, good.stderr.decode(errors='replace'))

    def test_installer_refuses_unrelated_hooks(self):
        self.git('config', 'core.hooksPath', 'custom-hooks')
        destination = self.root / 'scripts/install_git_hooks.py'
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(MODULE.parent / 'install_git_hooks.py', destination)
        result = subprocess.run([sys.executable, str(destination)], capture_output=True)
        self.assertNotEqual(0, result.returncode)
        self.assertEqual('custom-hooks', self.git('config', 'core.hooksPath'))


if __name__ == '__main__':
    unittest.main()
