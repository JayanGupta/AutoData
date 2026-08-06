import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import * as api from "../api/client";
import type {
  AnalysisSnapshot,
  ChartSpec,
  CleaningResponse,
  DatasetInfo,
  Insight,
} from "../types";

const STORAGE_KEY = "autodata_last_dataset";

interface DatasetContextValue {
  snapshot: AnalysisSnapshot | null;
  sessionId: string | null;
  loading: boolean;
  error: string | null;
  insights: Insight[];
  insightsLoading: boolean;
  sessions: DatasetInfo[];
  charts: ChartSpec[];
  upload: (file: File) => Promise<AnalysisSnapshot>;
  uploadSample: () => Promise<AnalysisSnapshot>;
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

const DatasetContext = createContext<DatasetContextValue | null>(null);

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AnalysisSnapshot | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [sessions, setSessions] = useState<DatasetInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setErrorSafe = useCallback((message: string | null) => setError(message), []);

  const listSessions = useCallback(async () => {
    try {
      const result = await api.listDatasets();
      setSessions(result.datasets);
    } catch {
      /* ignore session list failures */
    }
  }, []);

  const upload = useCallback(async (file: File) => {
    setLoading(true);
    setErrorSafe(null);
    try {
      const snap = await api.uploadDataset(file);
      setSnapshot(snap);
      setInsights([]);
      try {
        localStorage.setItem(STORAGE_KEY, snap.dataset.id);
      } catch {
        /* storage may be unavailable; persistence is best-effort */
      }
      await listSessions();
      return snap;
    } catch (e) {
      setErrorSafe(e instanceof Error ? e.message : "Upload failed");
      throw e;
    } finally {
      setLoading(false);
    }
  }, [listSessions, setErrorSafe]);

  const uploadSample = useCallback(async () => {
    setLoading(true);
    setErrorSafe(null);
    try {
      const snap = await api.uploadSampleDataset();
      setSnapshot(snap);
      setInsights([]);
      try {
        localStorage.setItem(STORAGE_KEY, snap.dataset.id);
      } catch {
        /* storage may be unavailable; persistence is best-effort */
      }
      await listSessions();
      return snap;
    } catch (e) {
      setErrorSafe(e instanceof Error ? e.message : "Sample dataset failed to load");
      throw e;
    } finally {
      setLoading(false);
    }
  }, [listSessions, setErrorSafe]);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setErrorSafe(null);
    try {
      const snap = await api.getDataset(id);
      setSnapshot(snap);
      return;
    } catch (e) {
      setErrorSafe(e instanceof Error ? e.message : "Failed to load dataset");
      throw e;
    } finally {
      setLoading(false);
    }
  }, [setErrorSafe]);

  const deleteSession = useCallback(async (id: string) => {
    try {
      await api.deleteDataset(id);
      setSessions((prev) => prev.filter((item) => item.id !== id));
      if (snapshot?.dataset.id === id) {
        clear();
      }
    } catch {
      /* ignore delete failures */
    }
  }, [snapshot?.dataset.id]);

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
      return next;
    },
    [snapshot],
  );

  const undoClean = useCallback(async () => {
    if (!snapshot) return undefined;
    const next = await api.undoClean(snapshot.dataset.id);
    setSnapshot(next);
    setInsights([]);
    return next;
  }, [snapshot]);

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
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return false;
    }
  }, [load]);

  const clear = useCallback(() => {
    setSnapshot(null);
    setInsights([]);
    setErrorSafe(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [setErrorSafe]);

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
      upload,
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
    [snapshot, loading, error, insights, insightsLoading, sessions, upload, uploadSample, load, listSessions, deleteSession, refreshInsights, applyClean, undoClean, resumeRecent, clear, clearError],
  );

  return <DatasetContext.Provider value={value}>{children}</DatasetContext.Provider>;
}

export function useDataset(): DatasetContextValue {
  const ctx = useContext(DatasetContext);
  if (!ctx) throw new Error("useDataset must be used within DatasetProvider");
  return ctx;
}
