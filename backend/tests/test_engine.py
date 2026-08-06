"""Backend test suite for the data engine and AI layer (stdlib unittest)."""

import io
import json
import unittest

from app.data_engine import analyze
from app.data_engine.loader import DataLoadError, load_dataframe
from app.ai import generate_insights, nlu

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


def load_sample() -> "object":
    df = load_dataframe(SAMPLE.encode(), "sample.csv")
    return analyze(df)


class TestLoader(unittest.TestCase):
    def test_rejects_bad_extension(self):
        with self.assertRaises(DataLoadError):
            load_dataframe(b"a,b\n1,2\n", "notes.txt")

    def test_rejects_empty(self):
        with self.assertRaises(DataLoadError):
            load_dataframe(b"", "empty.csv")

    def test_sniffs_delimiters(self):
        df = load_dataframe(b"a;b\n1;2\n3;4\n", "semi.csv")
        self.assertEqual(list(df.columns), ["a", "b"])
        self.assertEqual(len(df), 2)


class TestProfiler(unittest.TestCase):
    def setUp(self):
        self.engine = load_sample()

    def test_type_detection(self):
        types = {c["name"]: c["inferred_type"] for c in self.engine.columns}
        self.assertEqual(types["order_date"], "datetime")
        self.assertEqual(types["product"], "categorical")
        self.assertEqual(types["units"], "integer")
        self.assertEqual(types["revenue"], "float")

    def test_summary_counts(self):
        s = self.engine.summary
        self.assertEqual(s["row_count"], 10)
        self.assertEqual(s["column_count"], 6)
        self.assertEqual(s["numeric_columns"], 2)
        self.assertEqual(s["datetime_columns"], 1)


class TestQuality(unittest.TestCase):
    def test_missing_detection(self):
        df = load_dataframe(
            b"a,b\n1,2\n2,\n3,4\n4,\n", "miss.csv"
        )
        engine = analyze(df)
        issues = engine.quality["issues"]
        missing = [i for i in issues if i["category"] == "missing_values"]
        self.assertTrue(missing)
        self.assertGreaterEqual(engine.quality["summary"]["quality_score"], 0)
        self.assertLessEqual(engine.quality["summary"]["quality_score"], 100)


class TestAI(unittest.TestCase):
    def setUp(self):
        self.engine = load_sample()

    def test_insights_use_real_numbers(self):
        insights = generate_insights(self.engine)
        self.assertIsInstance(insights, list)
        for ins in insights:
            self.assertTrue(ins["title"])
            self.assertTrue(ins["detail"])

    def test_local_analyst_answers(self):
        cases = [
            ("Which product has the highest revenue?", "Phone"),
            ("How many rows are there?", "10"),
            ("What is the average revenue?", "2,078"),
        ]
        for question, expected in cases:
            res = nlu.answer(question, self.engine)
            self.assertEqual(res["mode"], "local")
            self.assertIn(expected, res["answer"])
            self.assertTrue(res["answer"])

    def test_sql_runner_safe(self):
        from app.ai.sql_runner import QueryError, run_query, validate_select

        with self.assertRaises(QueryError):
            validate_select("DELETE FROM data")
        with self.assertRaises(QueryError):
            validate_select("SELECT * FROM data; DROP TABLE data")
        result = run_query(self.engine.df, 'SELECT COUNT(*) AS n FROM data')
        self.assertEqual(result["rows"][0][0], 10)


if __name__ == "__main__":
    unittest.main(verbosity=2)
