import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import * as api from "../api/client";
import type {
  AnalysisJob,
  AnalysisSnapshot,
  ChartSpec,
  CleaningResponse,
  DatasetInfo,
  Insight,
} from "../types";

const STORAGE_KEY = "autodata_last_dataset";

interface UploadProgress {
  progress: number;
  stage: string;
  message: string;
}

interface DatasetContextValue {
  snapshot: AnalysisSnapshot | null;
  sessionId: string | null;
  loading: boolean;
  error: string | null;
  insights: Insight[];
  insightsLoading: boolean;
  sessions: DatasetInfo[];
  charts: ChartSpec[];
  cleaningSteps: CleaningStepLike[];
  upload: (file: File) => Promise<AnalysisSnapshot>;
  uploadViaJob: (file: File, onProgress?: (p: UploadProgress) => void) => Promise<AnalysisSnapshot>;
  uploadSample: (name?: string) => Promise<AnalysisSnapshot>;
  load: (id: string) => Promise<void>;
  listSessions: () => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  refreshInsights: () => Promise<void>;
  applyClean: (action: string, params?: { column?: string; value?: string | number | null }) => Promise<CleaningResponse | undefined>;
  undoClean: () => Promise<CleaningResponse | undefined>;
  resumeRecent: () => Promise<boolean>;
  clear: () => void;
  clearError: () => void;
}

interface CleaningStepLike {
  step: number;
  description: string;
}

const DatasetContext = createContext<DatasetContextValue | null>(null);

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AnalysisSnapshot | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [sessions, setSessions] = useState<DatasetInfo[]>([]);
  const [cleaningSteps, setCleaningSteps] = useState<CleaningStepLike[]>([]);
  const [loading, setLoading] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setErrorSafe = useCallback((message: string | null) => setError(message), []);

  const remember = useCallback((id: string | null) => {
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage may be unavailable; persistence is best-effort */
    }
  }, []);

  const listSessions = useCallback(async () => {
    try {
      const result = await api.listDatasets();
      setSessions(result.datasets);
    } catch {
      /* ignore session list failures */
    }
  }, []);

  const refreshCleaning = useCallback(async (id: string) => {
    try {
      const history = await api.getCleaningHistory(id);
      setCleaningSteps(history.steps);
    } catch {
      setCleaningSteps([]);
    }
  }, []);

  const adoptSnapshot = useCallback(
    async (snap: AnalysisSnapshot) => {
      setSnapshot(snap);
      setInsights([]);
      remember(snap.dataset.id);
      await listSessions();
      await refreshCleaning(snap.dataset.id);
    },
    [listSessions, refreshCleaning, remember],
  );

  const upload = useCallback(
    async (file: File) => {
      setLoading(true);
      setErrorSafe(null);
      try {
        const snap = await api.uploadDataset(file);
        await adoptSnapshot(snap);
        return snap;
      } catch (e) {
        setErrorSafe(e instanceof Error ? e.message : "Upload failed");
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [adoptSnapshot, setErrorSafe],
  );

  const uploadViaJob = useCallback(
    async (file: File, onProgress?: (p: UploadProgress) => void) => {
      setLoading(true);
      setErrorSafe(null);
      try {
        const { job_id } = await api.createUploadJob(file);
        // eslint-disable-next-line no-constant-condition
        while (true) {
          await new Promise((r) => setTimeout(r, 700));
          const job: AnalysisJob = await api.getJob(job_id);
          onProgress?.({ progress: job.progress, stage: job.stage, message: job.message });
          if (job.status === "done" && job.session_id) {
            const snap = await api.getDataset(job.session_id);
            await adoptSnapshot(snap);
            return snap;
          }
          if (job.status === "error") {
            throw new Error(job.error ?? "Analysis failed");
          }
        }
      } catch (e) {
        setErrorSafe(e instanceof Error ? e.message : "Upload failed");
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [adoptSnapshot, setErrorSafe],
  );

  const uploadSample = useCallback(async (name?: string) => {
    setLoading(true);
    setErrorSafe(null);
    try {
      const snap = await api.uploadSampleDataset(name);
      await adoptSnapshot(snap);
      return snap;
    } catch (e) {
      setErrorSafe(e instanceof Error ? e.message : "Sample dataset failed to load");
      throw e;
    } finally {
      setLoading(false);
    }
  }, [adoptSnapshot, setErrorSafe]);

  const load = useCallback(
    async (id: string) => {
      setLoading(true);
      setErrorSafe(null);
      try {
        const snap = await api.getDataset(id);
        await adoptSnapshot(snap);
      } catch (e) {
        setErrorSafe(e instanceof Error ? e.message : "Failed to load dataset");
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [adoptSnapshot, setErrorSafe],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      try {
        await api.deleteDataset(id);
        setSessions((prev) => prev.filter((item) => item.id !== id));
        if (snapshot?.dataset.id === id) {
          clear();
        }
      } catch {
        /* ignore delete failures */
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshot?.dataset.id],
  );

  const refreshInsights = useCallback(async () => {
    if (!snapshot) return;
    setInsightsLoading(true);
    try {
      const result = await api.getInsights(snapshot.dataset.id);
      setInsights(result.insights);
    } finally {
      setInsightsLoading(false);
    }
  }, [snapshot]);

  const applyClean = useCallback(
    async (action: string, params: { column?: string; value?: string | number | null } = {}) => {
      if (!snapshot) return undefined;
      const next = await api.cleanDataset(snapshot.dataset.id, action, params);
      setSnapshot(next);
      setInsights([]);
      await refreshCleaning(snapshot.dataset.id);
      return next;
    },
    [snapshot, refreshCleaning],
  );

  const undoClean = useCallback(async () => {
    if (!snapshot) return undefined;
    const next = await api.undoClean(snapshot.dataset.id);
    setSnapshot(next);
    setInsights([]);
    await refreshCleaning(snapshot.dataset.id);
    return next;
  }, [snapshot, refreshCleaning]);

  const resumeRecent = useCallback(async () => {
    let id: string | null = null;
    try {
      id = localStorage.getItem(STORAGE_KEY);
    } catch {
      id = null;
    }
    if (!id) return false;
    try {
      await load(id);
      return true;
    } catch {
      remember(null);
      return false;
    }
  }, [load, remember]);

  const clear = useCallback(() => {
    setSnapshot(null);
    setInsights([]);
    setCleaningSteps([]);
    setErrorSafe(null);
    remember(null);
  }, [setErrorSafe, remember]);

  const clearError = useCallback(() => setErrorSafe(null), [setErrorSafe]);

  const value = useMemo<DatasetContextValue>(
    () => ({
      snapshot,
      sessionId: snapshot?.dataset.id ?? null,
      loading,
      error,
      insights,
      insightsLoading,
      sessions,
      charts: snapshot?.charts ?? [],
      cleaningSteps,
      upload,
      uploadViaJob,
      uploadSample,
      load,
      listSessions,
      deleteSession,
      refreshInsights,
      applyClean,
      undoClean,
      resumeRecent,
      clear,
      clearError,
    }),
    [
      snapshot, loading, error, insights, insightsLoading, sessions, cleaningSteps,
      upload, uploadViaJob, uploadSample, load, listSessions, deleteSession,
      refreshInsights, applyClean, undoClean, resumeRecent, clear, clearError,
    ],
  );

  return <DatasetContext.Provider value={value}>{children}</DatasetContext.Provider>;
}

export function useDataset(): DatasetContextValue {
  const ctx = useContext(DatasetContext);
  if (!ctx) throw new Error("useDataset must be used within DatasetProvider");
  return ctx;
}
