import { useRef, useState } from "react";
import { ApiError } from "@/api/client";
import { useRouter } from "next/navigation";
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
import { Footer } from "@/views/landing/Footer";

export function LandingPage() {
  const { uploadSample, load, loading } = useDataset();
  const { error: toastError, success: toastSuccess } = useToast();
  const router = useRouter();
  const sampleInFlight = useRef(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const handleSample = async () => {
    if (loading || sampleInFlight.current) return;
    sampleInFlight.current = true;
    setLoadingSample(true);
    try {
      let recentSample: string | null = null;
      try {
        recentSample = localStorage.getItem("autodata_landing_sample");
      } catch {
        // Use a fresh sample if browser storage is unavailable.
      }
      if (recentSample) {
        try {
          await load(recentSample);
          router.push("/dashboard");
          return;
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 404) throw error;
        }
      }
      const sample = await uploadSample();
      try {
        localStorage.setItem("autodata_landing_sample", sample.dataset.id);
      } catch {
        // The sample remains usable without browser storage.
      }
      toastSuccess("Sample dataset added to your library.");
      router.push("/dashboard");
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Sample dataset failed to load.");
    } finally {
      sampleInFlight.current = false;
      setLoadingSample(false);
    }
  };

  return (
    <div className="min-h-screen bg-night-950 text-slate-100 antialiased">
      <div className="fixed inset-0 z-0">
        <div aria-hidden className="absolute inset-0 bg-grid bg-grid-fade opacity-60" />
        <div aria-hidden className="absolute inset-0 bg-noise opacity-[0.025]" />
      </div>

      <Navbar />

      <main className="relative z-10 overflow-x-clip pt-20">
        <Hero onSample={() => void handleSample()} loadingSample={loadingSample} disabled={loading} />
        <UploadSection />
        <LogoMarquee />
        <Features />
        <Workflow />
        <Analyst />
        <Report />
      </main>

      <Footer />
    </div>
  );
}

