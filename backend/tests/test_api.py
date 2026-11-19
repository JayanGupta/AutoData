"""API-level integration tests for the FastAPI app (stdlib unittest + TestClient)."""

import io
import unittest
from unittest.mock import patch

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
    def test_review_key_duplicates_and_restore_order(self):
        rows = b"id,region,amount\n001,A,1\n001,A,9\n1,A,3\n001,B,4\n,B,2\n,B,8\n"
        snap = client.post("/api/datasets", files={"file": ("ids.csv", rows, "text/csv")}).json()
        path = "/api/datasets/" + snap["dataset"]["id"]
        original = client.get(path + "/rows").json()["rows"]
        self.assertEqual(original[0]["id"], "001")
        for keys, expected in [(["id"], 2), (["id", "region"], 1)]:
            body = {"action": "drop_duplicates", "columns": keys, "keep": "last"}
            preview = client.post(path + "/clean/preview", json=body).json()
            self.assertEqual(preview["rows_removed"], expected)
            self.assertEqual(preview["examples"][0]["kept"]["amount"], 4 if len(keys) == 1 else 9)
        self.assertEqual(client.get(path + "/cleaning").json()["length"], 0)
        body["expected_revision"] = preview["revision"]
        cleaned = client.post(path + "/clean", json=body).json()
        self.assertEqual(cleaned["summary"]["row_count"], 5)
        self.assertEqual(client.post(path + "/clean", json=body).status_code, 409)
        self.assertEqual(client.post(path + "/clean/undo", params={"expected_revision": preview["revision"]}).status_code, 409)
        self.assertEqual(client.post(path + "/clean/undo").status_code, 200)
        self.assertEqual(client.get(path + "/rows").json()["rows"], original)

    def test_view_filter_and_keep_matching_rows(self):
        snap = client.post("/api/datasets", files={"file": ("items.csv", b"name,n\nA.B,1\nAxB,2\na.b,3\n,4\n", "text/csv")}).json()
        path = "/api/datasets/" + snap["dataset"]["id"]
        condition = {"column": "name", "operator": "contains", "value": "."}
        page = client.get(path + "/rows", params={**condition, "limit": 1, "offset": 1}).json()
        self.assertEqual(page["total"], 2)
        self.assertEqual(page["rows"][0]["n"], 3)
        body = {**condition, "action": "keep_matching_rows"}
        self.assertEqual(client.post(path + "/clean/preview", json=body).json()["rows_removed"], 2)
        self.assertEqual(client.get(path + "/rows").json()["total"], 4)
        self.assertEqual(client.get(path + "/rows", params={"column": "name", "operator": "blank"}).json()["total"], 1)
        self.assertEqual(client.post(path + "/clean", json=body).json()["dataset"]["rows"], 2)

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

    def test_custom_report_outline_and_invalid_sections(self):
        dataset = "/api/datasets/" + upload_sample()["dataset"]["id"] + "/report"
        result = client.get(dataset, params={"fmt": "html", "sections": "charts,quality"}).json()
        for fmt in ("content", "markdown"):
            self.assertLess(result[fmt].index("1. Charts"), result[fmt].index("2. Data Quality"))
            self.assertNotIn("Executive Summary", result[fmt])
            self.assertNotIn("Key Insights", result[fmt])
        for sections in ("", "quality,quality", "invalid"):
            self.assertEqual(client.get(dataset, params={"sections": sections}).status_code, 400)

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


class TestReportRevision(unittest.TestCase):
    def test_pdf_must_match_the_preview_revision(self):
        snapshot = upload_sample()
        dataset = f"/api/datasets/{snapshot['dataset']['id']}"
        preview = client.get(f"{dataset}/report", params={"fmt": "html"}).json()
        self.assertEqual(preview["revision"], snapshot["revision"])
        self.assertIn("Executive Summary", preview["content"])
        self.assertIn("Cleaning steps applied: 0.", preview["markdown"])

        cleaned = client.post(f"{dataset}/clean", json={"action": "drop_column", "column": "product"})
        self.assertEqual(cleaned.status_code, 200, cleaned.text)
        stale = client.get(f"{dataset}/report", params={"fmt": "pdf", "revision": preview["revision"]})
        self.assertEqual(stale.status_code, 409)
        updated = client.get(f"{dataset}/report", params={"fmt": "html"}).json()
        self.assertIn("Cleaning steps applied: 1.", updated["markdown"])
        pdf = client.get(f"{dataset}/report", params={"fmt": "pdf", "revision": updated["revision"]})
        self.assertEqual(pdf.status_code, 200, pdf.text if pdf.status_code != 200 else None)


class TestDashboardMetrics(unittest.TestCase):
    def test_individual_rows_preserve_repeated_labels(self):
        path = "/api/datasets/" + upload_sample()["dataset"]["id"] + "/dashboard-metrics"
        widget = {"id": "raw", "type": "chart", "chart_type": "line", "x": "product", "y": "units", "aggregation": "none"}
        condition = {"column": "product", "operator": "equals", "value": "Mouse"}
        result = client.post(path, json={"widgets": [widget], "row_filter": condition})
        self.assertEqual(result.json()["charts"]["raw"], [{"name": "Mouse", "value": 20}, {"name": "Mouse", "value": 30}])

    def test_chart_builder_respects_filters_and_aggregation(self):
        snap = upload_sample()
        self.assertLessEqual(len(snap["charts"]), 2)
        base = "/api/datasets/" + snap["dataset"]["id"]
        widgets = [
            {"id": "averages", "type": "chart", "chart_type": "bar", "x": "product", "y": "units", "aggregation": "avg"},
            {"id": "hist", "type": "chart", "chart_type": "histogram", "x": "units"},
            {"id": "pairs", "type": "chart", "chart_type": "scatter", "x": "units", "y": "revenue"},
        ]
        condition = {"column": "product", "operator": "equals", "value": "Mouse"}
        result = client.post(base + "/dashboard-metrics", json={"widgets": widgets, "row_filter": condition}).json()
        self.assertEqual(result["matched_rows"], 2)
        self.assertEqual(result["charts"]["averages"], [{"name": "Mouse", "value": 25}])
        self.assertEqual(sum(b["value"] for b in result["charts"]["hist"]), 2)
        self.assertEqual(len(result["charts"]["pairs"]), 2)
        widgets[0]["row_filter"] = condition
        pinned = client.post(base + "/dashboard-metrics", json={"widgets": widgets}).json()
        self.assertEqual(pinned["matched_rows"], 6)
        self.assertEqual(pinned["charts"]["averages"], result["charts"]["averages"])

    def test_aggregates_include_rows_outside_preview(self):
        data = "region,value\n" + "".join(f"First,{i}\n" for i in range(50)) + "Later,50000\n"
        uploaded = client.post("/api/datasets", files={"file": ("full.csv", data)})
        self.assertEqual(uploaded.status_code, 200, uploaded.text)
        dataset_id = uploaded.json()["dataset"]["id"]
        result = client.post(f"/api/datasets/{dataset_id}/dashboard-metrics", json={
            "widgets": [
                {"id": "sum", "type": "kpi", "column": "value", "aggregation": "sum"},
                {"id": "by_region", "type": "chart", "x": "region", "y": "value"},
            ],
            "category_column": "region",
            "category_value": "Later",
        })
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json(), {
            "matched_rows": 1, "kpis": {"sum": 50000},
            "charts": {"by_region": [{"name": "Later", "value": 50000}]},
        })


class TestHostedWorkspace(unittest.TestCase):
    @patch("app.config.WORKSPACE_ISOLATION", True)
    @patch("app.config.RATE_LIMIT_REQUESTS", 1)
    def test_isolates_dataset_access_and_write_budgets(self):
        with TestClient(app, base_url="https://testserver") as first, TestClient(app, base_url="https://testserver") as second:
            self.assertEqual(first.get("/api/datasets").status_code, 401)
            for user in (first, second):
                self.assertEqual(user.get("/api/workspace").status_code, 200)

            created = first.post("/api/datasets/sample")
            self.assertEqual(created.status_code, 200, created.text)
            dataset_id = created.json()["dataset"]["id"]
            path = f"/api/datasets/{dataset_id}"
            limited = first.post("/api/datasets/sample")
            self.assertEqual(limited.status_code, 429)
            self.assertGreater(int(limited.headers["Retry-After"]), 0)
            self.assertEqual(first.patch(path, json={"favorite": True}).status_code, 200)
            self.assertEqual(first.get(path).status_code, 200)
            self.assertEqual(second.get("/api/datasets").json()["datasets"], [])
            self.assertEqual(second.get(path).status_code, 404)
            self.assertEqual(second.delete(path).status_code, 404)
            self.assertEqual(second.post("/api/datasets/sample").status_code, 200)


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
