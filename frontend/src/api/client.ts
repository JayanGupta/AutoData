import type {
  AdvancedChartsPayload,
  AnalysisJob,
  AnalysisSnapshot,
  AnalystResponse,
  ChartSpec,
  CleaningHistory,
  CleaningResponse,
  CleanParams,
  CleanReview,
  RowFilter,
  DashboardLayout,
  DashboardMetrics,
  DashboardWidget,
  DatasetInfo,
  ExecutiveSummary,
  GoogleSheetsImportPayload,
  GoogleSheetsImportResponse,
  Insight,
  MergeDatasetsPayload,
  MergeDatasetsResponse,
  ReportResult,
  RowPage,
  SampleInfo,
  SqlQueryResult,
} from "../types";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";
const REQUEST_TIMEOUT_MS = 120_000;

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly retryAfterMs?: number) {
    super(message);
    this.name = "ApiError";
  }
}

let workspaceReady: Promise<void> | undefined;

function ensureWorkspace(): Promise<void> {
  workspaceReady ??= fetch(`${BASE}/workspace`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }).then((res) => {
    if (!res.ok) throw new ApiError("Could not open the workspace. Try again.", res.status);
  }).catch((error: unknown) => {
    workspaceReady = undefined;
    throw error;
  });
  return workspaceReady;
}

async function fetchApi(path: string, init?: RequestInit): Promise<Response> {
  await ensureWorkspace();
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  const res = await fetch(`${BASE}${path}`, { ...init, signal });
  if (res.ok) return res;
  if (res.status === 401) workspaceReady = undefined;

  let message = `Request failed with status ${res.status}`;
  const retryHeader = res.headers.get("Retry-After");
  let retryAfterMs: number | undefined;
  if (res.status === 429) {
    const delay = retryHeader === null ? NaN : /^\d+$/.test(retryHeader)
      ? Number(retryHeader) * 1000
      : Date.parse(retryHeader) - Date.now();
    retryAfterMs = Number.isFinite(delay) ? Math.max(1000, delay) : undefined;
    message = retryAfterMs === undefined
      ? "Too many requests. Wait a moment and try again."
      : `Too many requests. Try again in ${Math.ceil(retryAfterMs / 1000)} seconds.`;
  } else {
    try {
      const body = await res.json();
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      // Proxies can return HTML or an empty body.
    }
  }
  throw new ApiError(message, res.status, retryAfterMs);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return (await (await fetchApi(path, init)).json()) as T;
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

export function getJob(jobId: string, signal?: AbortSignal): Promise<AnalysisJob> {
  return request<AnalysisJob>(`/jobs/${jobId}`, { signal });
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

export function getReport(id: string, fmt: "markdown" | "html" = "markdown", signal?: AbortSignal, sections?: string[], revision?: string): Promise<ReportResult> {
  const query = new URLSearchParams({ fmt });
  if (sections) query.set("sections", sections.join(","));
  if (revision) query.set("revision", revision);
  return request<ReportResult>(`/datasets/${id}/report?${query}`, { signal });
}

export async function downloadReportPdf(id: string, revision: string, sections?: string[]): Promise<Blob> {
  const query = new URLSearchParams({ fmt: "pdf", revision });
  if (sections) query.set("sections", sections.join(","));
  const response = await fetchApi(`/datasets/${id}/report?${query}`);
  return response.blob();
}

export function getReportPdfUrl(id: string): string {
  return `${BASE}/datasets/${id}/report?fmt=pdf`;
}

export function getExportUrl(id: string, fmt: "csv" | "xlsx"): string {
  return `${BASE}/datasets/${id}/export?fmt=${fmt}`;
}

export function uploadSampleDataset(name?: string): Promise<AnalysisSnapshot> {
  const query = name ? `?name=${encodeURIComponent(name)}` : "";
  return request<AnalysisSnapshot>(`/datasets/sample${query}`, { method: "POST" });
}

export function listSamples(): Promise<{ samples: SampleInfo[] }> {
  return request<{ samples: SampleInfo[] }>("/samples");
}

export function listDatasets(): Promise<{ datasets: DatasetInfo[] }> {
  return request<{ datasets: DatasetInfo[] }>("/datasets");
}

export function deleteDataset(id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/datasets/${id}`, { method: "DELETE" });
}

export function getRows(id: string, offset: number, limit: number, filter?: RowFilter): Promise<RowPage> {
  const query = new URLSearchParams({ offset: String(offset), limit: String(limit), ...filter });
  return request<RowPage>(`/datasets/${id}/rows?${query}`);
}

export function previewClean(id: string, action: string, params: CleanParams): Promise<CleanReview> {
  return request<CleanReview>(`/datasets/${id}/clean/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...params }),
  });
}

export function cleanDataset(
  id: string,
  action: string,
  params: CleanParams = {},
): Promise<CleaningResponse> {
  return request<CleaningResponse>(`/datasets/${id}/clean`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...params }),
  });
}

export function undoClean(id: string, revision: string): Promise<CleaningResponse | { ok: true; undone: false }> {
  return request<CleaningResponse | { ok: true; undone: false }>(`/datasets/${id}/clean/undo?expected_revision=${encodeURIComponent(revision)}`, { method: "POST" });
}

export function getCleaningHistory(id: string): Promise<CleaningHistory> {
  return request<CleaningHistory>(`/datasets/${id}/cleaning`);
}

export function getConversation(
  id: string,
): Promise<{ conversation: Array<{ role: "user" | "assistant"; content: string; intent?: string }> }> {
  return request(`/datasets/${id}/conversation`);
}

export function updateDataset(
  id: string,
  changes: { name?: string; favorite?: boolean },
): Promise<{ session: DatasetInfo }> {
  return request<{ session: DatasetInfo }>(`/datasets/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
}

export function duplicateDataset(id: string): Promise<AnalysisSnapshot> {
  return request<AnalysisSnapshot>(`/datasets/${id}/duplicate`, { method: "POST" });
}

export function getExecutiveSummary(id: string): Promise<ExecutiveSummary> {
  return request<ExecutiveSummary>(`/datasets/${id}/executive-summary`);
}

export function getAdvancedCharts(id: string): Promise<AdvancedChartsPayload> {
  return request<AdvancedChartsPayload>(`/datasets/${id}/advanced-charts`);
}

export function importGoogleSheets(payload: GoogleSheetsImportPayload): Promise<GoogleSheetsImportResponse> {
  return request<GoogleSheetsImportResponse>("/datasets/google-sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function mergeDatasets(payload: MergeDatasetsPayload): Promise<MergeDatasetsResponse> {
  return request<MergeDatasetsResponse>("/datasets/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function getDashboardMetrics(
  id: string,
  payload: { widgets: DashboardWidget[]; search: string; category_column: string; category_value: string; row_filter?: RowFilter },
  signal: AbortSignal,
): Promise<DashboardMetrics> {
  return request(`/datasets/${id}/dashboard-metrics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
}

export function getDashboardLayout(id: string): Promise<{ layout: DashboardLayout | null }> {
  return request<{ layout: DashboardLayout | null }>(`/datasets/${id}/dashboard-layout`);
}

export function saveDashboardLayout(id: string, layout: DashboardLayout): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/datasets/${id}/dashboard-layout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ layout }),
  });
}

export function runSqlQuery(id: string, query: string): Promise<SqlQueryResult> {
  return request<SqlQueryResult>(`/datasets/${id}/sql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
}

