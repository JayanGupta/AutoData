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


class TestAdvancedChartsJsonSafe(unittest.TestCase):
    """Advanced chart specs must be fully JSON-serializable (no NaN/Inf)."""

    def test_specs_contain_no_non_finite_floats(self):
        import json
        import math

        from app.data_engine.advanced_charts import build_advanced_charts

        engine = load_sample()
        specs = build_advanced_charts(engine)
        self.assertTrue(specs, "expected at least one advanced chart spec")
        dumped = json.dumps(specs)  # would raise if a non-finite float leaked
        parsed = json.loads(dumped)
        self.assertEqual(parsed, specs)

        def _walk(node):
            if isinstance(node, float):
                self.assertTrue(math.isfinite(node), f"non-finite float in spec: {node!r}")
            elif isinstance(node, dict):
                for v in node.values():
                    _walk(v)
            elif isinstance(node, list):
                for v in node:
                    _walk(v)

        for spec in specs:
            _walk(spec)


class TestNewPowerFeatures(unittest.TestCase):
    def test_extract_google_sheet_details(self):
        from app.data_engine.loader import extract_google_sheet_details, DataLoadError

        url1 = "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=12345"
        sheet_id, gid = extract_google_sheet_details(url1)
        self.assertEqual(sheet_id, "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms")
        self.assertEqual(gid, "12345")

        raw_id = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
        sheet_id2, gid2 = extract_google_sheet_details(raw_id)
        self.assertEqual(sheet_id2, raw_id)
        self.assertIsNone(gid2)

        with self.assertRaises(DataLoadError):
            extract_google_sheet_details("xyz")

    def test_merge_dataframes(self):
        import pandas as pd
        from app.data_engine.loader import merge_dataframes

        left = pd.DataFrame({"id": [1, 2, 3], "val_a": ["A", "B", "C"]})
        right = pd.DataFrame({"id": [2, 3, 4], "val_b": [20, 30, 40]})

        inner = merge_dataframes(left, right, how="inner", left_on="id", right_on="id")
        self.assertEqual(len(inner), 2)
        self.assertIn("val_a", inner.columns)
        self.assertIn("val_b", inner.columns)

        concat_res = merge_dataframes(left, right, how="concat")
        self.assertEqual(len(concat_res), 6)

    def test_batch_cleaning_operations(self):
        import pandas as pd
        from app.data_engine.cleaning import (
            trim_all_whitespace,
            drop_constant_columns,
            fill_all_numeric_median,
            filter_rows,
        )

        df = pd.DataFrame({
            "name": ["  Alice ", "Bob  ", " Charlie"],
            "score": [10.0, None, 30.0],
            "constant": [1, 1, 1],
        })

        trimmed, _ = trim_all_whitespace(df)
        self.assertEqual(trimmed["name"].tolist(), ["Alice", "Bob", "Charlie"])

        dropped, _ = drop_constant_columns(df)
        self.assertNotIn("constant", dropped.columns)

        filled, _ = fill_all_numeric_median(df)
        self.assertEqual(filled["score"].tolist(), [10.0, 20.0, 30.0])

        filtered, _ = filter_rows(df, "score", ">15")
        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered.iloc[0]["score"], 30.0)

    def test_dashboard_layout_storage(self):
        from app.data_store.storage import save_dashboard_layout, load_dashboard_layout

        test_id = "test_session_123"
        layout = {"widgets": [{"id": "w1", "type": "kpi", "column": "revenue"}]}
        save_dashboard_layout(test_id, layout)
        loaded = load_dashboard_layout(test_id)
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded["widgets"][0]["column"], "revenue")


if __name__ == "__main__":
    unittest.main(verbosity=2)

