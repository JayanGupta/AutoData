import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  FileSpreadsheet,
  Globe,
  Lightbulb,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  Table2,
  Trash,
  ChevronRight,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useDataset } from "@/store/DatasetContext";
import { useToast } from "@/store/ToastContext";

const FEATURES = [
  {
    icon: Table2,
    title: "Instant profiling",
    desc: "Upload a file and get automatic typing, summaries and data profiling in seconds.",
  },
  {
    icon: ShieldCheck,
    title: "Quality scoring",
    desc: "Catch missing values, duplicates and anomalies before they undermine your insights.",
  },
  {
    icon: BarChart3,
    title: "Smart visualizations",
    desc: "Generate the right charts from your data and explore trends without manual setup.",
  },
  {
    icon: MessagesSquare,
    title: "Ask in plain English",
    desc: "Ask business questions naturally and get answers linked to the actual dataset.",
  },
  {
    icon: Lightbulb,
    title: "AI insights",
    desc: "Automatically surfaced patterns, anomalies and growth signals for your data.",
  },
  {
    icon: FileSpreadsheet,
    title: "Export ready reports",
    desc: "Create polished PDF analysis reports with one click and share them with stakeholders.",
  },
];

const STEPS = [
  { n: "01", title: "Upload your data", desc: "CSV or Excel, seamless ingestion with smart previews." },
  { n: "02", title: "Review the dashboard", desc: "Quality, charts and insights appear instantly." },
  { n: "03", title: "Ask business questions", desc: "Get answers from your data with natural language." },
  { n: "04", title: "Export or share", desc: "Download reports or hand-off findings to your team." },
];

export function LandingPage() {
  const { resumeRecent, uploadSample, listSessions, sessions, load, deleteSession } = useDataset();
  const { error: toastError, success: toastSuccess } = useToast();
  const router = useRouter();
  const [loadingSample, setLoadingSample] = useState(false);
  const [loadingResume, setLoadingResume] = useState(false);

  useEffect(() => {
    void listSessions();
  }, [listSessions]);

  const recentSession = sessions[0];

  const handleResume = async () => {
    setLoadingResume(true);
    try {
      const ok = await resumeRecent();
      if (ok) {
        router.push("/dashboard");
      } else {
        toastError("Your previous analysis has expired. Upload the file again to continue.");
      }
    } catch {
      toastError("Your previous analysis has expired. Upload the file again to continue.");
    } finally {
      setLoadingResume(false);
    }
  };

  const handleSample = async () => {
    setLoadingSample(true);
    try {
      await uploadSample();
      toastSuccess("Sample dataset loaded successfully.");
      router.push("/dashboard");
    } catch {
      /* error surfaced via toast */
    } finally {
      setLoadingSample(false);
    }
  };

  const handleResumeSession = async (id: string) => {
    setLoadingResume(true);
    try {
      await load(id);
      router.push("/dashboard");
    } catch {
      toastError("Could not load that dataset. It may have expired.");
    } finally {
      setLoadingResume(false);
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await deleteSession(id);
      toastSuccess("Saved dataset removed.");
    } catch {
      toastError("Failed to delete the saved dataset.");
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.08),_transparent_28%)]">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur supports-backdrop-blur:bg-white/80 dark:border-slate-800/70 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3 text-slate-900 dark:text-slate-100">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-500/20">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">AutoData</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">AI analytics workspace</p>
            </div>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-300 md:flex">
            <a href="#features" className="transition hover:text-slate-900 dark:hover:text-white">Features</a>
            <a href="#workflow" className="transition hover:text-slate-900 dark:hover:text-white">Workflow</a>
            <a href="#workspaces" className="transition hover:text-slate-900 dark:hover:text-white">Workspace</a>
          </nav>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSample}
              className="hidden rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 md:inline-flex"
            >
              Start sample
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 pb-24 pt-10 sm:px-6 lg:px-8">
        <section className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-brand-700 shadow-sm shadow-brand-100/60">
              <Sparkles className="h-4 w-4" />
              Launch your data workflow faster
            </div>
            <div className="space-y-6">
              <h1 className="max-w-3xl text-5xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-6xl">
                AI data analysis built for growing teams and modern businesses.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                AutoData transforms raw CSV and Excel datasets into actionable insights, intelligent dashboards, and shareable reports — all without manual formulas or stale models.
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleSample}
                className="inline-flex items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition hover:bg-brand-700"
                disabled={loadingSample}
              >
                {loadingSample ? "Loading sample…" : "Try sample dataset"}
              </button>
              <button
                type="button"
                onClick={handleResume}
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-500"
              >
                Resume last dataset
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                <p className="text-3xl font-semibold text-slate-900 dark:text-white">Local-first</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Your data is processed on your own machine — never uploaded to a cloud.</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                <p className="text-3xl font-semibold text-slate-900 dark:text-white">100%</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Free and open-source. No account, no credit card, no trial walls.</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                <p className="text-3xl font-semibold text-slate-900 dark:text-white">50 MB</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Uploads supported, with async background analysis for large files.</p>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-400/10 ring-1 ring-slate-200/50 dark:border-slate-700 dark:bg-slate-950/90 dark:ring-slate-700/50">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-brand-500/20 to-transparent" />
            <div className="relative space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-900/80">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-600">AI insights</p>
                  <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">Explore automatically generated findings, trends, and outliers in your dataset.</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-900/80">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-600">Quality checks</p>
                  <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">See quality score, missing values and anomalies without any manual configuration.</p>
                </div>
              </div>
              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-950">
                <div className="mb-4 flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-brand-600" />
                    Data overview
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Live preview</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 rounded-3xl bg-slate-50 p-4 dark:bg-slate-900">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Dataset</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">{recentSession?.name ?? "No upload yet"}</p>
                  </div>
                  <div className="space-y-2 rounded-3xl bg-slate-50 p-4 dark:bg-slate-900">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Quality score</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">{recentSession ? `${recentSession.quality_score ?? "—"}/100` : "—"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mt-20 rounded-[2rem] border border-slate-200 bg-white/90 px-6 py-12 shadow-xl shadow-slate-400/10 dark:border-slate-700 dark:bg-slate-950/90">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-600">Features</p>
            <h2 className="mt-4 text-3xl font-semibold text-slate-900 dark:text-white sm:text-4xl">Everything your analytics team needs in one place.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
              AutoData combines intelligent data profiling, guided cleaning, visual exploration, and AI-powered insights into a single polished workflow.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="group rounded-3xl border border-slate-200 bg-slate-50 p-6 transition hover:-translate-y-1 hover:border-brand-200 hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 group-hover:bg-brand-100 dark:bg-slate-800 dark:text-brand-400">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-slate-900 dark:text-white">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="workflow" className="mt-20 grid gap-8 lg:grid-cols-[0.65fr_0.35fr] lg:items-start">
          <div className="rounded-[2rem] border border-slate-200 bg-slate-50/90 p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-600">Workflow</p>
              <h2 className="mt-4 text-3xl font-semibold text-slate-900 dark:text-white sm:text-4xl">From dataset to decision in minutes.</h2>
              <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
                A professional analytics workspace that adapts to your data and helps you deliver results fast.
              </p>
            </div>
            <div className="mt-10 grid gap-5">
              {STEPS.map((step) => (
                <div key={step.n} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-950">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-white">{step.n}</span>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{step.title}</h3>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-950">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-600">Workspace snapshot</p>
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Open datasets stay ready in your workspace for fast review and handoff.</p>
              <div className="mt-6 space-y-3">
                <div className="rounded-3xl bg-slate-50 p-4 dark:bg-slate-900">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Last dataset</p>
                  <p className="mt-2 font-semibold text-slate-900 dark:text-white">{recentSession?.name ?? "movies.csv"}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {recentSession
                      ? `${recentSession.rows.toLocaleString()} rows · ${recentSession.columns} columns · quality score ${recentSession.quality_score ?? "—"}`
                      : "Try the sample dataset to see a live analysis."}
                  </p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4 dark:bg-slate-900">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Coming soon</p>
                  <p className="mt-2 font-semibold text-slate-900 dark:text-white">Team collaboration</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Share analyses, comments, and report drafts with your team.</p>
                </div>
              </div>
            </div>

            {sessions.length > 0 && (
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-950">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-600">Saved datasets</p>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Quickly resume an analysis or remove stale sessions.</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {sessions.length} saved
                  </span>
                </div>
                <div className="mt-6 space-y-3">
                  {sessions.map((session) => (
                    <div key={session.id} className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{session.name}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {session.rows.toLocaleString()} rows · {session.columns} columns • quality {session.quality_score ?? "—"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{new Date(session.created_at * 1000).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleResumeSession(session.id)}
                          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-700"
                          disabled={loadingResume}
                        >
                          Resume
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteSession(session.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                        >
                          <Trash className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-[2rem] border border-slate-200 bg-slate-950/95 p-6 shadow-xl shadow-brand-500/10 dark:border-slate-700">
              <div className="flex items-center gap-3 text-white">
                <span className="flex h-12 w-12 items-center justify-center rounded-3xl bg-brand-600/90">
                  <Globe className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-brand-300">Professional MVP</p>
                  <p className="mt-2 text-lg font-semibold">Built for your first SaaS launch</p>
                </div>
              </div>
              <div className="mt-6 space-y-4 text-sm text-slate-300">
                <p>Clean, modern UI designed for customer demos and investor-ready walkthroughs.</p>
                <p>Fast onboarding with sample data, resume state, and polished analytics flows.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="workspaces" className="mt-20 rounded-[2rem] border border-slate-200 bg-white/90 p-8 shadow-xl shadow-slate-400/10 dark:border-slate-700 dark:bg-slate-950/90">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-600">Workspace</p>
            <h2 className="mt-4 text-3xl font-semibold text-slate-900 dark:text-white sm:text-4xl">Your datasets. Your control.</h2>
            <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
              Upload custom files, review recent analyses, and maintain a professional workflow that matches your growing business needs.
            </p>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Saved sessions</p>
              <p className="mt-4 text-3xl font-bold text-brand-600">{sessions.length}</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Datasets you can resume right from this workspace.</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Cleaning steps</p>
              <p className="mt-4 text-3xl font-bold text-brand-600">11</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Guided operations, all reversible with one-click undo.</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">PII detection</p>
              <p className="mt-4 text-3xl font-bold text-brand-600">Auto</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Sensitive columns are flagged and excluded from reports.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
