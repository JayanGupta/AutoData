import {
  BarChart3,
  Bot,
  FileSpreadsheet,
  Lock,
  MessagesSquare,
  ScanSearch,
  ShieldCheck,
  Table2,
  Wand2,
  Zap,
} from "lucide-react";

export const BRAND = {
  name: "AutoData",
  tagline: "AI analytics workspace",
};

export const NAV_LINKS = [
  { label: "Upload", href: "#upload" },
  { label: "Features", href: "#features" },
  { label: "Workflow", href: "#workflow" },
  { label: "Analyst", href: "#analyst" },
  { label: "Report", href: "#report" },
];

export const FEATURE_CELLS = [
  {
    id: "analyst",
    span: "lg:col-span-7",
    icon: MessagesSquare,
    title: "Talk to your data like a teammate",
    desc: "Ask business questions in plain English. AutoData grounds every answer in the real dataset — computed statistics, never invented numbers.",
    accent: "from-violet-500/20 to-fuchsia-500/5",
    iconColor: "text-violet-300",
  },
  {
    id: "quality",
    span: "lg:col-span-5",
    icon: ShieldCheck,
    title: "Data quality, scored honestly",
    desc: "Missing values, duplicates, outliers and type anomalies — a 0–100 score that tells the truth about your data.",
    accent: "from-emerald-500/20 to-cyan-500/5",
    iconColor: "text-emerald-300",
  },
  {
    id: "profiling",
    span: "lg:col-span-4",
    icon: ScanSearch,
    title: "Instant profiling",
    desc: "Column types, distributions, semantic hints and PII detection the second your file lands.",
    accent: "from-sky-500/20 to-blue-500/5",
    iconColor: "text-sky-300",
  },
  {
    id: "viz",
    span: "lg:col-span-4",
    icon: BarChart3,
    title: "Charts that pick themselves",
    desc: "Histograms, time series, breakdowns and heatmaps auto-generated from your schema.",
    accent: "from-cyan-500/20 to-teal-500/5",
    iconColor: "text-cyan-300",
  },
  {
    id: "privacy",
    span: "lg:col-span-4",
    icon: Lock,
    title: "Local-first. Private by design.",
    desc: "Everything runs on your machine. No cloud, no account, no data leaving your laptop.",
    accent: "from-fuchsia-500/20 to-violet-500/5",
    iconColor: "text-fuchsia-300",
  },
  {
    id: "report",
    span: "lg:col-span-12",
    icon: FileSpreadsheet,
    title: "From raw file to a polished report",
    desc: "A guided cleaning studio plus one-click PDF, HTML and Markdown reports — with charts embedded and PII redacted.",
    accent: "from-indigo-500/15 via-violet-500/10 to-cyan-500/10",
    iconColor: "text-indigo-300",
  },
];

export const WORKFLOW_STEPS = [
  {
    n: "01",
    title: "Upload your data",
    desc: "Drop in CSV or Excel — up to 50 MB. Encoding and delimiter sniffing handle messy files automatically.",
    icon: Zap,
    color: "from-violet-500 to-fuchsia-500",
  },
  {
    n: "02",
    title: "Let it profile itself",
    desc: "AutoData types every column, flags sensitive fields and scores quality before you lift a finger.",
    icon: Table2,
    color: "from-sky-500 to-cyan-500",
  },
  {
    n: "03",
    title: "Clean with confidence",
    desc: "Guided, reversible operations. Fill missing values, parse dates, normalize text — undo anything in one click.",
    icon: Wand2,
    color: "from-emerald-500 to-teal-500",
  },
  {
    n: "04",
    title: "Ask, then share",
    desc: "Chat with your data, explore auto-generated insights, then export the cleaned file or a report your team will love.",
    icon: Bot,
    color: "from-amber-500 to-rose-500",
  },
];

export const CAPABILITY_WORDS = [
  "CSV",
  "Excel",
  "TSV",
  "Delimiter sniffing",
  "PII detection",
  "Outlier detection",
  "Missing values",
  "Duplicate rows",
  "Correlations",
  "Quality scoring",
  "Local-first",
  "Private by design",
];

export const STATS = [
  { value: 50, suffix: " MB", label: "Max upload, with async background jobs" },
  { value: 11, suffix: "", label: "Guided cleaning operations, all reversible" },
  { value: 100, suffix: "%", label: "Local — your data never leaves the machine" },
  { value: 0, suffix: "", label: "Accounts, credit cards or trial walls" },
];

export const FOOTER_LINKS = [
  {
    title: "Product",
    links: ["Features", "Workflow", "AI Analyst", "Reports", "Roadmap"],
  },
  {
    title: "Resources",
    links: ["Documentation", "Sample datasets", "Changelog", "Privacy", "Security"],
  },
  {
    title: "Company",
    links: ["About", "Blog", "Careers", "Contact", "Open source"],
  },
];

export const ANALYST_SUGGESTIONS = [
  "Which region drove the most revenue?",
  "Spot any seasonal trend in orders?",
  "Are there outliers in unit price?",
];
