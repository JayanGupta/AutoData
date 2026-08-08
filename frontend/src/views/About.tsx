"use client";

import {
  ArrowRight,
  Award,
  Bot,
  Brain,
  Code2,
  Database,
  Github,
  GraduationCap,
  Heart,
  LineChart,
  Linkedin,
  Mail,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDataset } from "../store/DatasetContext";
import { useToast } from "../store/ToastContext";
import { Navbar } from "./landing/Navbar";
import { Footer } from "./landing/Footer";
import { AnimatedCounter, AuroraBackground, Particles, Reveal, SectionLabel, Stagger, StaggerItem } from "./landing/primitives";

const STATS = [
  { icon: Users, value: 15000, suffix: "+", label: "students & developers mentored" },
  { icon: Trophy, value: 15, suffix: "+", label: "hackathon finalist projects" },
  { icon: GraduationCap, value: 4, suffix: "", label: "years building ML systems" },
  { icon: Award, value: 2, suffix: "", label: "research labs & product teams" },
];

const TIMELINE = [
  {
    year: "Now",
    role: "Data Scientist · AI/ML Engineer",
    org: "GeeksforGeeks",
    desc: "Building AI products and teaching the next wave of ML engineers — from ML fundamentals to applied LLM engineering.",
    tags: ["LLM", "RAG", "Agentic AI"],
  },
  {
    year: "Earlier",
    role: "Machine Learning Engineer",
    org: "DRDO (Defence Research & Development Organisation)",
    desc: "Built applied ML and data pipelines for defence research — where correctness, performance and reliability come first.",
    tags: ["SARIMAX", "FinBERT", "Transformers"],
  },
  {
    year: "Always",
    role: "Builder & Mentor",
    org: "The community",
    desc: "Shipping end-to-end data products and mentoring 15k+ aspiring data scientists through talks, content and hands-on guidance.",
    tags: ["Python", "Data Science", "AI-ML"],
  },
];

const TECH = [
  "Python",
  "Pandas",
  "NumPy",
  "scikit-learn",
  "SARIMAX",
  "FinBERT",
  "Transformers",
  "LLMs",
  "RAG",
  "Agentic AI",
  "FastAPI",
  "SQL",
  "MLOps",
  "Data Visualisation",
];

const ACHIEVEMENTS = [
  {
    icon: Brain,
    title: "LLM & Agentic AI",
    desc: "Retrieval-augmented generation, agent workflows and production LLM systems applied to real data problems.",
  },
  {
    icon: LineChart,
    title: "Forecasting that ships",
    desc: "SARIMAX and time-series pipelines used to forecast, explain and act — not just fit a curve.",
  },
  {
    icon: Database,
    title: "Data engineering, done clean",
    desc: "ETL, quality scoring and analytical modelling with a first-principles, honest approach to data.",
  },
  {
    icon: Bot,
    title: "Teaching at scale",
    desc: "15k+ mentored across classrooms and communities — clear explanations, real projects, no gatekeeping.",
  },
];

export function AboutPage() {
  const { resumeRecent, uploadSample } = useDataset();
  const { error: toastError, success: toastSuccess } = useToast();
  const router = useRouter();
  const [loadingSample, setLoadingSample] = useState(false);

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
      <Ambient />
      <Navbar onSample={() => void handleSample()} onResume={() => void handleResume()} loadingSample={loadingSample} />
      <main className="relative z-10">
        <Hero />
        <StatsSection />
        <JourneySection />
        <SkillsSection />
        <AchievementsSection />
        <ContactCta />
      </main>
      <Footer />
    </div>
  );
}

function Ambient() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-grid bg-grid-fade opacity-40" />
      <Particles count={20} />
    </div>
  );
}
function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <AuroraBackground variant="hero" />
      <div className="relative mx-auto max-w-6xl px-5 pb-24 pt-36 sm:px-8 sm:pt-44">
        <Reveal>
          <div className="flex flex-col items-center text-center">
            <SectionLabel>About the creator</SectionLabel>

            <div className="relative mt-10">
              <div className="absolute -inset-4 rounded-full bg-gradient-to-br from-violet-500/40 to-cyan-400/30 blur-2xl" />
              <div className="relative flex h-32 w-32 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-violet-500/30 via-indigo-500/20 to-cyan-500/15 shadow-glow-violet">
                <span className="font-display text-4xl font-bold text-white">J</span>
              </div>
            </div>

            <h1 className="mt-8 max-w-3xl font-display text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl">
              Hi, I&apos;m <span className="text-gradient-animated">Jayan Gupta</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-400">
              Data Scientist & AI/ML Engineer at GeeksforGeeks, ex-DRDO. I build data products that turn raw
              information into decisions — and I built{" "}
              <span className="font-semibold text-white">AutoData</span> because I believe great analytics should
              feel effortless and stay private.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://github.com/JayanGuptaa"
                target="_blank"
                rel="noreferrer noopener"
                className="btn-gradient px-5 py-2.5 text-sm font-semibold"
              >
                <Github className="h-4 w-4" /> GitHub
              </a>
              <a
                href="https://www.linkedin.com/in/jayan-gupta/"
                target="_blank"
                rel="noreferrer noopener"
                className="btn-ghost px-5 py-2.5 text-sm font-medium"
              >
                <Linkedin className="h-4 w-4" /> LinkedIn
              </a>
              <Link href="/datasets" className="btn-ghost px-5 py-2.5 text-sm font-medium">
                Explore AutoData <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function StatsSection() {
  return (
    <section className="relative mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <Reveal>
        <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {STATS.map((stat) => (
            <StaggerItem key={stat.label}>
              <div className="glass glass-hover group flex h-full flex-col items-center rounded-3xl px-6 py-8 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/25 to-cyan-500/10 text-violet-300 ring-1 ring-white/10 transition-transform duration-300 group-hover:scale-105">
                  <stat.icon className="h-5 w-5" />
                </span>
                <p className="mt-4 font-display text-3xl font-bold text-white">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                </p>
                <p className="mt-1 text-xs text-slate-500">{stat.label}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </Reveal>
    </section>
  );
}

function JourneySection() {
  return (
    <section className="relative mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <Reveal>
        <div className="flex flex-col items-center text-center">
          <SectionLabel>Journey</SectionLabel>
          <h2 className="mt-6 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            The path to AutoData
          </h2>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="mx-auto mt-12 max-w-3xl">
          <ol className="relative space-y-10 border-l border-white/10 pl-8 sm:pl-12">
            {TIMELINE.map((item, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[2.35rem] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 shadow-glow-violet sm:-left-[3.35rem]">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                <div className="glass glass-hover rounded-3xl p-6 sm:p-7">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-300">{item.year}</p>
                  <h3 className="mt-2 font-display text-lg font-semibold text-white">{item.role}</h3>
                  <p className="text-sm font-medium text-cyan-200">{item.org}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.desc}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.tags.map((t) => (
                      <span key={t} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] text-slate-300">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Reveal>
    </section>
  );
}

function SkillsSection() {
  return (
    <section className="relative mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <Reveal>
        <div className="flex flex-col items-center text-center">
          <SectionLabel>Toolkit</SectionLabel>
          <h2 className="mt-6 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            What I work with
          </h2>
        </div>
      </Reveal>
      <Reveal delay={0.1}>
        <div className="mt-10 flex flex-wrap justify-center gap-2.5">
          {TECH.map((t) => (
            <span
              key={t}
              className="group flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300 transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white"
            >
              <Code2 className="h-3.5 w-3.5 text-violet-300 opacity-70 transition-opacity group-hover:opacity-100" />
              {t}
            </span>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function AchievementsSection() {
  return (
    <section className="relative mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <Reveal>
        <div className="flex flex-col items-center text-center">
          <SectionLabel>What I focus on</SectionLabel>
          <h2 className="mt-6 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Craft, not just code
          </h2>
        </div>
      </Reveal>
      <Stagger className="mt-12 grid gap-5 sm:grid-cols-2">
        {ACHIEVEMENTS.map((a) => (
          <StaggerItem key={a.title}>
            <div className="card-glow group relative h-full overflow-hidden rounded-3xl bg-night-900/70 p-7 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1">
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-violet-500/[0.08] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/25 to-cyan-500/10 text-violet-300 ring-1 ring-white/10">
                <a.icon className="h-5 w-5" />
              </span>
              <h3 className="relative mt-4 font-display text-lg font-semibold text-white">{a.title}</h3>
              <p className="relative mt-2 text-sm leading-relaxed text-slate-400">{a.desc}</p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

function ContactCta() {
  return (
    <section className="relative mx-auto max-w-6xl px-5 pb-28 pt-10 sm:px-8">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-600/20 via-indigo-600/10 to-cyan-500/10 p-10 text-center backdrop-blur-xl sm:p-14">
          <AuroraBackground variant="cta" className="rounded-[2rem]" />
          <div className="relative">
            <span className="flex items-center justify-center gap-2 text-sm font-medium text-slate-300">
              <Heart className="h-4 w-4 fill-rose-500/80 text-rose-500" />
              Built with intent, shipped with care
            </span>
            <h2 className="mx-auto mt-4 max-w-2xl font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Let&apos;s build something that turns data into decisions.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-400">
              For collaborations, questions or just to talk data — I read everything.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://github.com/JayanGuptaa"
                target="_blank"
                rel="noreferrer noopener"
                className="btn-gradient px-5 py-2.5 text-sm font-semibold"
              >
                <Github className="h-4 w-4" /> GitHub
              </a>
              <a
                href="https://www.linkedin.com/in/jayan-gupta/"
                target="_blank"
                rel="noreferrer noopener"
                className="btn-ghost px-5 py-2.5 text-sm font-medium"
              >
                <Linkedin className="h-4 w-4" /> LinkedIn
              </a>
              <a
                href="mailto:jayan.gupta@example.com"
                className="btn-ghost px-5 py-2.5 text-sm font-medium"
              >
                <Mail className="h-4 w-4" /> Say hello
              </a>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
