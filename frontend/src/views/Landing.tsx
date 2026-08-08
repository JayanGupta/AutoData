"use client";

import { useState } from "react";
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
import { CTA } from "@/views/landing/CTA";
import { Footer } from "@/views/landing/Footer";

export function LandingPage() {
  const { resumeRecent, uploadSample } = useDataset();
  const { error: toastError, success: toastSuccess } = useToast();
  const router = useRouter();
  const [loadingSample, setLoadingSample] = useState(false);

  const handleSample = async () => {
    setLoadingSample(true);
    try {
      await uploadSample();
      toastSuccess("Sample dataset added to your library.");
      router.push("/datasets");
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

      <Navbar onSample={() => void handleSample()} onResume={() => void handleResume()} loadingSample={loadingSample} />

      <main className="relative z-10 overflow-x-clip">
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
