"""Contract checks for the generated dataset and the baked site files.

Run: python -m unittest discover -s tests -v
"""
import json
import sys
import unittest
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import build_site  # noqa: E402
from fetch_stars import CATEGORIES  # noqa: E402

REQUIRED_REPO_FIELDS = {
    "full_name", "stars", "language", "description", "category",
    "url", "last_updated", "pushed_at", "archived", "license", "forks", "topics",
}


class DatasetContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / "repos_output.json").read_text(encoding="utf-8"))
        cls.repos = cls.data["repos"]

    def test_top_level_shape(self):
        for key in ("username", "total_repos", "generated_at", "profile", "repos"):
            self.assertIn(key, self.data)

    def test_total_matches_list(self):
        self.assertEqual(self.data["total_repos"], len(self.repos))
        self.assertGreater(len(self.repos), 0)

    def test_generated_at_parses(self):
        datetime.fromisoformat(self.data["generated_at"])

    def test_repo_names_unique(self):
        names = [r["full_name"] for r in self.repos]
        self.assertEqual(len(names), len(set(names)))

    def test_repo_fields_present(self):
        for repo in self.repos:
            missing = REQUIRED_REPO_FIELDS - set(repo)
            self.assertFalse(missing, f"{repo.get('full_name')} missing {missing}")

    def test_repo_values_sane(self):
        allowed = set(CATEGORIES) | {"Other"}
        for repo in self.repos:
            self.assertIsInstance(repo["stars"], int)
            self.assertGreaterEqual(repo["stars"], 0)
            self.assertTrue(repo["url"].startswith("https://github.com/"), repo["full_name"])
            self.assertIn(repo["category"], allowed, repo["full_name"])


class BakedOutputs(unittest.TestCase):
    def test_outputs_match_generator(self):
        outputs, stale, _, _ = build_site.build_outputs()
        self.assertEqual(stale, [], "retired llms-*.txt files still on disk")
        drift = [
            path.name
            for path, text in outputs.items()
            if not path.exists() or path.read_text(encoding="utf-8") != text
        ]
        self.assertEqual(drift, [], "run python build_site.py")

    def test_llms_header_is_honest(self):
        text = (ROOT / "llms.txt").read_text(encoding="utf-8")
        self.assertIn("## Dataset", text)
        self.assertIn("generated_at:", text)
        self.assertIn("no schedule", text)
        self.assertNotIn("auto-updated weekly", text)

    def test_index_has_no_dead_asset_refs(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertNotIn("Instrument+Serif", html)
        self.assertNotIn("countapi", html)
        self.assertNotIn("GitHub Actions", html)


if __name__ == "__main__":
    unittest.main()
