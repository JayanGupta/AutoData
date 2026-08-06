"""API-level integration tests for the FastAPI app (stdlib unittest + TestClient)."""

import io
import unittest

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

SAMPLE_CSV = """order_id,order_date,product,category,units,revenue
O1,2025-01-01,Laptop,Electronics,5,4995.50
O2,2025-01-02,Phone,Electronics,10,7990.25
O3,2025-01-03,Laptop,Electronics,2,1998.00
O4,2025-01-04,Tablet,Electronics,3,1287.00
O5,2025-01-05,Mouse,Accessories,20,780.00
O6,2025-01-06,Mouse,Accessories,30,1170.00
"""


def upload_sample(name: str = "orders.csv") -> dict:
    res = client.post(
        "/api/datasets",
        files={"file": (name, io.BytesIO(SAMPLE_CSV.encode()), "text/csv")},
    )
    assert res.status_code == 200, res.text
    return res.json()


class TestHealth(unittest.TestCase):
    def test_health(self):
        res = client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "ok")

    def test_unknown_route_returns_json_404(self):
        res = client.get("/api/does-not-exist")
        self.assertEqual(res.status_code, 404)
        self.assertIn("detail", res.json())


class TestUpload(unittest.TestCase):
    def test_sync_upload(self):
        snap = upload_sample()
        self.assertEqual(snap["dataset"]["name"], "orders.csv")
        self.assertEqual(snap["summary"]["row_count"], 6)
        self.assertEqual(snap["summary"]["column_count"], 6)
        self.assertEqual(len(snap["columns"]), 6)
        self.assertGreaterEqual(len(snap["charts"]), 1)

    def test_rejects_bad_extension(self):
        res = client.post(
            "/api/datasets",
            files={"file": ("notes.txt", io.BytesIO(b"hello"), "text/plain")},
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("Unsupported file type", res.json()["detail"])


class TestJobs(unittest.TestCase):
    def test_job_lifecycle(self):
        res = client.post(
            "/api/jobs/upload",
            files={"file": ("orders.csv", io.BytesIO(SAMPLE_CSV.encode()), "text/csv")},
        )
        self.assertEqual(res.status_code, 200)
        job_id = res.json()["job_id"]
        self.assertTrue(job_id)

        done = False
        for _ in range(50):
            job = client.get(f"/api/jobs/{job_id}").json()
            if job["status"] in ("done", "error"):
                done = True
                break
        self.assertTrue(done, "job did not reach a terminal state")
        self.assertIsNotNone(job["session_id"])

    def test_job_unknown_id(self):
        res = client.get("/api/jobs/does-not-exist")
        self.assertEqual(res.status_code, 404)


class TestCleaning(unittest.TestCase):
    def test_apply_undo_flow(self):
        snap = upload_sample()
        sid = snap["dataset"]["id"]

        res = client.post(f"/api/datasets/{sid}/clean", json={"action": "drop_duplicates"})
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertIn("cleaning", body)
        self.assertEqual(body["cleaning"]["history_length"], 1)

        history = client.get(f"/api/datasets/{sid}/cleaning").json()
        self.assertEqual(history["length"], 1)
        self.assertEqual(history["steps"][0]["step"], 0)

        res = client.post(f"/api/datasets/{sid}/clean/undo")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["cleaning"]["undone"])

    def test_fill_missing_numeric(self):
        csv = "a,b\n1,5\n2,\n3,7\n"
        res = client.post(
            "/api/datasets",
            files={"file": ("data.csv", io.BytesIO(csv.encode()), "text/csv")},
        )
        sid = res.json()["dataset"]["id"]
        res = client.post(f"/api/datasets/{sid}/clean", json={"action": "fill_missing_numeric", "column": "b", "value": "mean"})
        self.assertEqual(res.status_code, 200)
        # b should now be numeric without missing values
        rows = client.get(f"/api/datasets/{sid}/rows?offset=0&limit=10").json()
        self.assertTrue(all(rows["rows"][i]["b"] is not None for i in range(3)))

    def test_unknown_action(self):
        snap = upload_sample()
        sid = snap["dataset"]["id"]
        res = client.post(f"/api/datasets/{sid}/clean", json={"action": "nope"})
        self.assertEqual(res.status_code, 400)


class TestExport(unittest.TestCase):
    def test_export_csv(self):
        snap = upload_sample()
        sid = snap["dataset"]["id"]
        res = client.get(f"/api/datasets/{sid}/export?fmt=csv")
        self.assertEqual(res.status_code, 200)
        self.assertIn("text/csv", res.headers["content-type"])
        self.assertIn("order_id", res.text)

    def test_export_xlsx(self):
        snap = upload_sample()
        sid = snap["dataset"]["id"]
        res = client.get(f"/api/datasets/{sid}/export?fmt=xlsx")
        self.assertEqual(res.status_code, 200)
        self.assertIn("spreadsheet", res.headers["content-type"])

    def test_export_bad_fmt(self):
        snap = upload_sample()
        sid = snap["dataset"]["id"]
        res = client.get(f"/api/datasets/{sid}/export?fmt=pdf")
        self.assertEqual(res.status_code, 400)


class TestReport(unittest.TestCase):
    def test_report_markdown(self):
        snap = upload_sample()
        sid = snap["dataset"]["id"]
        res = client.get(f"/api/datasets/{sid}/report?fmt=markdown")
        self.assertEqual(res.status_code, 200)
        self.assertIn("orders.csv", res.json()["content"])

    def test_report_pdf(self):
        snap = upload_sample()
        sid = snap["dataset"]["id"]
        res = client.get(f"/api/datasets/{sid}/report?fmt=pdf")
        self.assertEqual(res.status_code, 200)
        self.assertIn("application/pdf", res.headers["content-type"])
        self.assertGreater(len(res.content), 500)

    def test_report_html_embeds_charts(self):
        snap = upload_sample()
        sid = snap["dataset"]["id"]
        res = client.get(f"/api/datasets/{sid}/report?fmt=html")
        self.assertEqual(res.status_code, 200)
        content = res.json()["content"]
        # Real visualisations embedded: at least one chart figure and SVG,
        # plus a proper table header and the charts section heading.
        self.assertGreaterEqual(content.count("<svg"), 2)
        self.assertGreaterEqual(content.count("<figure>"), 1)
        self.assertIn("<thead>", content)
        self.assertIn("6. Charts", content)

    def test_report_markdown_notes_charts(self):
        snap = upload_sample()
        sid = snap["dataset"]["id"]
        res = client.get(f"/api/datasets/{sid}/report?fmt=markdown")
        self.assertIn("6. Charts", res.json()["content"])


class TestConversation(unittest.TestCase):
    def test_conversation_lifecycle(self):
        snap = upload_sample()
        sid = snap["dataset"]["id"]
        res = client.get(f"/api/datasets/{sid}/conversation")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["conversation"], [])

        res = client.post(
            f"/api/datasets/{sid}/ask",
            json={"question": "How many rows are in this dataset?"},
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn("6", res.json()["answer"])

        res = client.get(f"/api/datasets/{sid}/conversation")
        conv = res.json()["conversation"]
        self.assertEqual(len(conv), 2)
        self.assertEqual(conv[0]["role"], "user")
        self.assertEqual(conv[1]["role"], "assistant")

    def test_ask_empty_question(self):
        snap = upload_sample()
        sid = snap["dataset"]["id"]
        res = client.post(f"/api/datasets/{sid}/ask", json={"question": "   "})
        self.assertEqual(res.status_code, 400)


class TestSuggestedQuestions(unittest.TestCase):
    def test_suggested_questions(self):
        snap = upload_sample()
        sid = snap["dataset"]["id"]
        res = client.get(f"/api/datasets/{sid}/suggested-questions")
        self.assertEqual(res.status_code, 200)
        questions = res.json()["questions"]
        self.assertGreaterEqual(len(questions), 1)


class TestRows(unittest.TestCase):
    def test_rows_pagination(self):
        snap = upload_sample()
        sid = snap["dataset"]["id"]
        res = client.get(f"/api/datasets/{sid}/rows?offset=0&limit=2")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["total"], 6)
        self.assertEqual(len(body["rows"]), 2)

    def test_rows_invalid_params(self):
        snap = upload_sample()
        sid = snap["dataset"]["id"]
        res = client.get(f"/api/datasets/{sid}/rows?offset=-1&limit=100000")
        self.assertEqual(res.status_code, 400)


class TestDatasetManagement(unittest.TestCase):
    def test_list_has_metadata(self):
        upload_sample(name="orders.csv")
        res = client.get("/api/datasets")
        self.assertEqual(res.status_code, 200)
        datasets = res.json()["datasets"]
        self.assertTrue(any(d["file_type"] == ".csv" for d in datasets))
        self.assertTrue(all("favorite" in d and "last_access" in d for d in datasets))
        self.assertTrue(all(d["file_size"] >= 0 for d in datasets))

    def test_rename(self):
        snap = upload_sample()
        sid = snap["dataset"]["id"]
        res = client.patch(f"/api/datasets/{sid}", json={"name": "Q2 Sales"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["session"]["name"], "Q2 Sales")

    def test_rename_empty_rejected(self):
        snap = upload_sample()
        sid = snap["dataset"]["id"]
        res = client.patch(f"/api/datasets/{sid}", json={"name": "   "})
        self.assertEqual(res.status_code, 400)

    def test_favorite_toggle(self):
        snap = upload_sample()
        sid = snap["dataset"]["id"]
        res = client.patch(f"/api/datasets/{sid}", json={"favorite": True})
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["session"]["favorite"])
        res = client.patch(f"/api/datasets/{sid}", json={"favorite": False})
        self.assertFalse(res.json()["session"]["favorite"])

    def test_duplicate(self):
        snap = upload_sample()
        sid = snap["dataset"]["id"]
        res = client.post(f"/api/datasets/{sid}/duplicate")
        self.assertEqual(res.status_code, 200)
        dup = res.json()
        self.assertNotEqual(dup["dataset"]["id"], sid)
        self.assertEqual(dup["dataset"]["rows"], snap["dataset"]["rows"])
        self.assertEqual(dup["dataset"]["columns"], snap["dataset"]["columns"])

    def test_duplicate_unknown_404(self):
        res = client.post("/api/datasets/nope/duplicate")
        self.assertEqual(res.status_code, 404)

    def test_snapshot_has_metadata(self):
        snap = upload_sample()
        dataset = snap["dataset"]
        for key in ("file_size", "file_type", "favorite", "last_access"):
            self.assertIn(key, dataset)


class TestExecutiveSummary(unittest.TestCase):
    def test_executive_summary_shape(self):
        snap = upload_sample()
        sid = snap["dataset"]["id"]
        res = client.get(f"/api/datasets/{sid}/executive-summary")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertIn("overview", body)
        self.assertIn("kpis", body)
        self.assertIn("key_takeaways", body)
        self.assertIn("recommendations", body)
        self.assertIn("suggested_next", body)
        self.assertGreaterEqual(len(body["kpis"]), 3)

    def test_executive_summary_unknown_404(self):
        res = client.get("/api/datasets/nope/executive-summary")
        self.assertEqual(res.status_code, 404)


class TestAdvancedCharts(unittest.TestCase):
    def test_advanced_charts_shape(self):
        snap = upload_sample()
        sid = snap["dataset"]["id"]
        res = client.get(f"/api/datasets/{sid}/advanced-charts")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        types = {c["chart_type"] for c in body["charts"]}
        self.assertIn("box", types)
        self.assertIn("distribution", types)
        self.assertIn("correlation", types)
        self.assertGreaterEqual(len(body["recommendations"]), 3)
        for rec in body["recommendations"]:
            self.assertIn("reason", rec)
            self.assertIn("title", rec)

    def test_advanced_charts_unknown_404(self):
        res = client.get("/api/datasets/nope/advanced-charts")
        self.assertEqual(res.status_code, 404)


if __name__ == "__main__":
    unittest.main()
