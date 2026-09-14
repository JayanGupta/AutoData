import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, FolderKanban, X } from "lucide-react";
import { useDataset } from "@/store/DatasetContext";
import { useToast } from "@/store/ToastContext";
import { Navbar } from "@/views/landing/Navbar";
import { Hero } from "@/views/landing/Hero";
import { UploadSection } from "@/views/landing/UploadSection";
import { LogoMarquee } from "@/views/landing/LogoMarquee";
import { Features } from "@/views/landing/Features";
import { Workflow } from "@/views/landing/Workflow";
import { Analyst } from "@/views/landing/Analyst";
import { Report } from "@/views/landing/Report";
import { CTA } from "@/views/landing/CTA";
import { Footer } from "@/views/landing/Footer";

export function LandingPage() {
  const { resumeRecent, uploadSample, listSessions, sessions } = useDataset();
  const { error: toastError, success: toastSuccess } = useToast();
  const router = useRouter();
  const [loadingSample, setLoadingSample] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    void listSessions();
  }, [listSessions]);

  const handleSample = async () => {
    setLoadingSample(true);
    try {
      await uploadSample();
      toastSuccess("Sample dataset added to your library.");
      router.push("/dashboard");
    } catch {
      /* error surfaced via toast */
    } finally {
      setLoadingSample(false);
    }
  };

  const handleResume = async () => {
    const ok = await resumeRecent();
    if (ok) {
      router.push("/dashboard");
    } else {
      toastError("Your previous analysis has expired. Upload the file again to continue.");
    }
  };

  return (
    <div className="min-h-screen bg-night-950 text-slate-100 antialiased">
      <div className="fixed inset-0 z-0">
        <div aria-hidden className="absolute inset-0 bg-grid bg-grid-fade opacity-60" />
        <div aria-hidden className="absolute inset-0 bg-noise opacity-[0.025]" />
      </div>

      <Navbar
        onSample={() => void handleSample()}
        onResume={() => void handleResume()}
        loadingSample={loadingSample}
        hasSessions={sessions.length > 0}
        sessionCount={sessions.length}
      />

      <main className="relative z-10 overflow-x-clip pt-20">
        {!bannerDismissed && sessions.length > 0 && (
          <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6">
            <div className="relative flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-violet-500/30 bg-violet-950/40 px-4 py-3 backdrop-blur-md shadow-lg shadow-violet-950/30">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300">
                  <FolderKanban className="h-4 w-4" />
                </div>
                <div className="text-sm">
                  <span className="font-semibold text-white">Welcome back!</span>{" "}
                  <span className="text-slate-300">
                    You have <strong className="text-violet-300">{sessions.length}</strong> active dataset{sessions.length > 1 ? "s" : ""} saved in your workspace.
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href="/datasets"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500 shadow-glow-violet"
                >
                  Open Workspace
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => setBannerDismissed(true)}
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
                  aria-label="Dismiss banner"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
        <Hero onSample={() => void handleSample()} onResume={() => void handleResume()} loadingSample={loadingSample} />
        <UploadSection />
        <LogoMarquee />
        <Features />
        <Workflow />
        <Analyst />
        <Report />
        <CTA onSample={() => void handleSample()} loadingSample={loadingSample} />
      </main>

      <Footer />
    </div>
  );
}

