import type {
  AnalysisJob,
  AnalysisSnapshot,
  AnalystResponse,
  ChartSpec,
  CleaningHistory,
  CleaningResponse,
  DatasetInfo,
  Insight,
  ReportResult,
  RowPage,
} from "../types";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";
const REQUEST_TIMEOUT_MS = 120_000;

function timeoutSignal(): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return controller.signal;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init, signal: init?.signal ?? timeoutSignal() });
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      /* ignore parse errors */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export function getHealth() {
  return request<{ status: string; llm_enabled: boolean }>("/health");
}

export function getLlmStatus() {
  return request<{ enabled: boolean; model: string | null; base_url: string | null; mode: string }>(
    "/llm/status",
  );
}

export function uploadDataset(file: File): Promise<AnalysisSnapshot> {
  const form = new FormData();
  form.append("file", file);
  return request<AnalysisSnapshot>("/datasets", { method: "POST", body: form });
}

export function createUploadJob(file: File): Promise<{ job_id: string; name: string }> {
  const form = new FormData();
  form.append("file", file);
  return request<{ job_id: string; name: string }>("/jobs/upload", { method: "POST", body: form });
}

export function getJob(jobId: string): Promise<AnalysisJob> {
  return request<AnalysisJob>(`/jobs/${jobId}`);
}

export function getDataset(id: string): Promise<AnalysisSnapshot> {
  return request<AnalysisSnapshot>(`/datasets/${id}`);
}

export function getCharts(id: string): Promise<{ charts: ChartSpec[] }> {
  return request<{ charts: ChartSpec[] }>(`/datasets/${id}/charts`);
}

export function getInsights(id: string): Promise<{ insights: Insight[] }> {
  return request<{ insights: Insight[] }>(`/datasets/${id}/insights`);
}

export function generateInsights(id: string): Promise<{ insights: Insight[] }> {
  return request<{ insights: Insight[] }>(`/datasets/${id}/insights/generate`, { method: "POST" });
}

export function getSuggestedQuestions(id: string): Promise<{ questions: string[] }> {
  return request<{ questions: string[] }>(`/datasets/${id}/suggested-questions`);
}

export function askQuestion(id: string, question: string): Promise<AnalystResponse> {
  return request<AnalystResponse>(`/datasets/${id}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
}

export function getReport(id: string, fmt: "markdown" | "html" = "markdown"): Promise<ReportResult> {
  return request<ReportResult>(`/datasets/${id}/report?fmt=${fmt}`);
}

export function getReportPdfUrl(id: string): string {
  return `${BASE}/datasets/${id}/report?fmt=pdf`;
}

export function getExportUrl(id: string, fmt: "csv" | "xlsx"): string {
  return `${BASE}/datasets/${id}/export?fmt=${fmt}`;
}

export function uploadSampleDataset(): Promise<AnalysisSnapshot> {
  return request<AnalysisSnapshot>("/datasets/sample", { method: "POST" });
}

export function listDatasets(): Promise<{ datasets: DatasetInfo[] }> {
  return request<{ datasets: DatasetInfo[] }>("/datasets");
}

export function deleteDataset(id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/datasets/${id}`, { method: "DELETE" });
}

export function getRows(id: string, offset: number, limit: number): Promise<RowPage> {
  return request<RowPage>(`/datasets/${id}/rows?offset=${offset}&limit=${limit}`);
}

export function cleanDataset(
  id: string,
  action: string,
  params: { column?: string; value?: string | number | null } = {},
): Promise<CleaningResponse> {
  return request<CleaningResponse>(`/datasets/${id}/clean`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, column: params.column ?? null, value: params.value ?? null }),
  });
}

export function undoClean(id: string): Promise<CleaningResponse> {
  return request<CleaningResponse>(`/datasets/${id}/clean/undo`, { method: "POST" });
}

export function getCleaningHistory(id: string): Promise<CleaningHistory> {
  return request<CleaningHistory>(`/datasets/${id}/cleaning`);
}
