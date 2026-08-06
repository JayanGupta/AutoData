"""Tests for cleaning, profile enrichment, rows endpoint and analyst intents."""

import unittest

from app.data_engine import analyze, rows_slice
from app.data_engine.cleaning import drop_column, drop_duplicates, drop_missing_rows, fill_missing
from app.data_engine.loader import load_dataframe
from app.ai import nlu
from app.sessions.store import DatasetSession, SessionStore

SAMPLE = """order_id,order_date,product,category,units,revenue
O1,2025-01-01,Laptop,Electronics,5,4995.50
O2,2025-01-02,Phone,Electronics,10,7990.25
O3,2025-01-03,Laptop,Electronics,2,1998.00
O4,2025-01-04,Tablet,Electronics,3,1287.00
O5,2025-01-05,Mouse,Accessories,20,780.00
O6,2025-01-06,Mouse,Accessories,30,1170.00
O7,2025-01-07,Keyboard,Accessories,4,316.00
O8,2025-01-08,Monitor,Electronics,1,249.00
O9,2025-01-09,Headset,Accessories,7,903.00
O10,2025-01-10,Camera,Electronics,2,1098.00
"""

MISSING = """a,b
1,2
2,
3,4
4,
1,2
"""


def load_sample():
    return analyze(load_dataframe(SAMPLE.encode(), "sample.csv"))


class TestCleaning(unittest.TestCase):
    def setUp(self):
        self.engine = load_sample()

    def test_drop_column(self):
        cleaned, desc = drop_column(self.engine.df, "category")
        self.assertNotIn("category", cleaned.columns)
        self.assertEqual(len(cleaned.columns), 5)
        self.assertIn("category", desc)

    def test_drop_duplicates(self):
        df = load_dataframe(MISSING.encode(), "dup.csv")
        cleaned, desc = drop_duplicates(df)
        self.assertLess(len(cleaned), len(df))
        self.assertIn("duplicate", desc)

    def test_drop_missing_rows(self):
        df = load_dataframe(MISSING.encode(), "miss.csv")
        cleaned, desc = drop_missing_rows(df)
        self.assertEqual(len(cleaned), 3)
        self.assertEqual(cleaned.isna().sum().sum(), 0)

    def test_fill_missing(self):
        df = load_dataframe(MISSING.encode(), "fill.csv")
        cleaned, desc = fill_missing(df, "b", 0)
        self.assertEqual(cleaned["b"].isna().sum(), 0)

    def test_invalid_column(self):
        with self.assertRaises(ValueError):
            drop_column(self.engine.df, "nope")

    def test_session_apply_and_undo(self):
        session = DatasetSession("s1", "sample", self.engine, 0.0)
        engine2, desc = session.apply_clean("drop_column", {"column": "category"})
        self.assertNotIn("category", engine2.df.columns)
        self.assertEqual(len(session.history), 1)
        restored, desc2 = session.undo_clean()
        self.assertIn("category", restored.df.columns)
        self.assertEqual(len(session.history), 0)
        self.assertIsNone(session.undo_clean())

    def test_session_rejects_bad_action(self):
        session = DatasetSession("s2", "sample", self.engine, 0.0)
        with self.assertRaises(ValueError):
            session.apply_clean("nuke", {})


class TestRowsSlice(unittest.TestCase):
    def test_windows(self):
        engine = load_sample()
        first = rows_slice(engine.df, offset=0, limit=3)
        self.assertEqual(len(first), 3)
        self.assertEqual(first[0]["order_id"], "O1")
        later = rows_slice(engine.df, offset=8, limit=5)
        self.assertEqual(len(later), 2)


class TestProfileEnrichment(unittest.TestCase):
    def test_numeric_stats_extra(self):
        engine = load_sample()
        revenue = next(c for c in engine.columns if c["name"] == "revenue")
        self.assertIn("p05", revenue["stats"])
        self.assertIn("p95", revenue["stats"])
        self.assertIsNotNone(revenue["stats"]["skewness"])
        self.assertIsNotNone(revenue["stats"]["kurtosis"])


class TestAnalystIntents(unittest.TestCase):
    def setUp(self):
        self.engine = load_sample()

    def test_median(self):
        res = nlu.answer("What is the median revenue?", self.engine)
        self.assertEqual(res["mode"], "local")
        self.assertIn("median", res["answer"].lower())

    def test_percentage(self):
        res = nlu.answer("What percentage of rows are Electronics?", self.engine)
        self.assertEqual(res["mode"], "local")
        self.assertIn("%", res["answer"])

    def test_compare(self):
        res = nlu.answer("Compare Laptop and Mouse by units?", self.engine)
        self.assertEqual(res["mode"], "local")
        self.assertIn("Laptop", res["answer"])
        self.assertIn("Mouse", res["answer"])

    def test_memory_followup(self):
        memory = [
            {"role": "user", "content": "What is the average revenue?"},
            {"role": "assistant", "content": "The average of revenue is 2,078.68.", "intent": "average"},
        ]
        res = nlu.answer("What is its median?", self.engine, memory=memory)
        self.assertIn("median", res["answer"].lower())
        self.assertEqual(res["intent"], "median")


if __name__ == "__main__":
    unittest.main(verbosity=2)
