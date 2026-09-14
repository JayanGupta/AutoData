import { useEffect, useRef, useState } from "react";
import { Bot, Check, ClipboardCopy, Database, Play, Send, Sparkles, Terminal, User } from "lucide-react";
import { useDataset } from "../store/DatasetContext";
import { askQuestion, getConversation, getSuggestedQuestions, runSqlQuery } from "../api/client";
import { Button, Spinner } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ChartRenderer } from "../components/charts/ChartRenderer";
import { cn } from "./landing/primitives";
import type { AnalystResponse, SqlQueryResult } from "../types";

interface Message {
  id: string;
  role: "user" | "assistant";
  question?: string;
  response?: AnalystResponse;
  content?: string;
  error?: string;
}

const DEFAULT_QUESTIONS = [
  "Give me a summary of this dataset",
  "Which category is performing best?",
  "What is the average value of the numeric columns?",
  "Are there any unusual patterns?",
  "Which column has the most missing data?",
];

export function AnalystPage({
  pendingQuestion,
  onConsumed,
}: {
  pendingQuestion?: string | null;
  onConsumed?: () => void;
}) {
  const { snapshot, insights } = useDataset();
  const [analystTab, setAnalystTab] = useState<"chat" | "sql">("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggested, setSuggested] = useState<string[]>(DEFAULT_QUESTIONS);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM data LIMIT 20");
  const [sqlResult, setSqlResult] = useState<SqlQueryResult | null>(null);
  const [sqlBusy, setSqlBusy] = useState(false);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [sqlCopied, setSqlCopied] = useState(false);
  const sqlTextareaRef = useRef<HTMLTextAreaElement>(null);

  const sessionId = snapshot?.dataset.id ?? null;

  useEffect(() => {
    if (pendingQuestion) {
      void submit(pendingQuestion);
      onConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQuestion]);

  useEffect(() => {
    const load = async () => {
      if (!sessionId) return;
      try {
        const { questions } = await getSuggestedQuestions(sessionId);
        if (questions.length) setSuggested([...questions, ...DEFAULT_QUESTIONS].slice(0, 6));
      } catch {
        /* keep defaults */
      }
    };
    void load();
  }, [sessionId, insights]);

  useEffect(() => {
    const loadConversation = async () => {
      if (!sessionId) return;
      try {
        const { conversation } = await getConversation(sessionId);
        if (!conversation.length) return;
        const restored: Message[] = conversation.map((c, i) =>
          c.role === "user"
            ? { id: `restored-${i}`, role: "user", question: c.content }
            : { id: `restored-${i}`, role: "assistant", content: c.content },
        );
        setMessages(restored);
      } catch {
        /* keep an empty chat on failure */
      }
    };
    void loadConversation();
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const submit = async (question: string) => {
    const q = question.trim();
    if (!q || busy || !sessionId) return;
    setInput("");
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", question: q };
    setMessages((m) => [...m, userMsg]);
    setBusy(true);
    try {
      const response = await askQuestion(sessionId, q);
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", response }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", error: e instanceof Error ? e.message : "Request failed" },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const handleRunSql = async () => {
    if (!sessionId || !sqlQuery.trim()) return;
    setSqlBusy(true);
    setSqlError(null);
    setSqlResult(null);
    try {
      const result = await runSqlQuery(sessionId, sqlQuery.trim());
      setSqlResult(result);
    } catch (err: any) {
      setSqlError(err?.message || "SQL query failed");
    } finally {
      setSqlBusy(false);
    }
  };

  const handleInsertColumn = (colName: string) => {
    const textarea = sqlTextareaRef.current;
    if (!textarea) {
      setSqlQuery((prev) => `${prev} \`${colName}\``);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const insert = `\`${colName}\``;
    setSqlQuery((prev) => prev.slice(0, start) + insert + prev.slice(end));
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + insert.length, start + insert.length);
    }, 0);
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(sqlQuery);
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const SQL_TEMPLATES = [
    { label: "Select all", sql: "SELECT * FROM data LIMIT 20" },
    { label: "Row count", sql: "SELECT COUNT(*) as total_rows FROM data" },
    { label: "Distinct", sql: snapshot?.columns[0] ? `SELECT DISTINCT \`${snapshot.columns[0].name}\`, COUNT(*) as count FROM data GROUP BY \`${snapshot.columns[0].name}\` ORDER BY count DESC LIMIT 20` : "SELECT DISTINCT * FROM data LIMIT 20" },
    { label: "Top 10", sql: snapshot?.columns.find(c => c.inferred_type === 'integer' || c.inferred_type === 'float') ? `SELECT * FROM data ORDER BY \`${snapshot.columns.find(c => c.inferred_type === 'integer' || c.inferred_type === 'float')!.name}\` DESC LIMIT 10` : "SELECT * FROM data LIMIT 10" },
  ];

  return (
    <div className="flex h-[calc(100vh-190px)] min-h-[520px] flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-display text-lg font-semibold text-white">AI Analyst &amp; Query Console</h2>
            <div className="flex rounded-xl border border-white/10 bg-white/[0.04] p-0.5">
              <button
                onClick={() => setAnalystTab("chat")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
                  analystTab === "chat" ? "bg-violet-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                )}
              >
                <Bot className="h-3.5 w-3.5" /> AI Chat
              </button>
              <button
                onClick={() => setAnalystTab("sql")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
                  analystTab === "sql" ? "bg-cyan-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                )}
              >
                <Terminal className="h-3.5 w-3.5" /> SQL Console
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {analystTab === "chat"
              ? "Ask questions about your data. Every answer is grounded in the actual dataset."
              : "Execute standard SQL queries directly on this dataset in-memory."}
          </p>
        </div>
        <ModeBadge />
      </div>

      {analystTab === "chat" ? (
        <div className="panel flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center py-8 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/10 text-violet-200 ring-1 ring-white/10 shadow-glow-violet">
                  <Bot className="h-6 w-6" />
                </span>
                <h3 className="mt-3 text-sm font-semibold text-white">Ask anything about your dataset</h3>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  Try one of the suggested questions below, or type your own.
                </p>
                <div className="mt-5 flex max-w-md flex-wrap justify-center gap-2">
                  {suggested.map((q) => (
                    <button
                      key={q}
                      onClick={() => void submit(q)}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 transition-all hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} onAsk={submit} />
            ))}

            {busy && (
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <Spinner className="h-4 w-4 text-violet-400" />
                <span>Analyzing your data…</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-white/[0.06] p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit(input);
              }}
              className="flex items-end gap-2"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submit(input);
                  }
                }}
                rows={1}
                placeholder='Ask e.g. "Which product has the highest revenue?"'
                className="field max-h-32 min-h-[44px] flex-1 resize-y"
              />
              <Button type="submit" disabled={!input.trim()} loading={busy} className="h-11 px-5">
                {!busy && <Send className="h-4 w-4" />}
                Ask
              </Button>
            </form>
          </div>
        </div>
      ) : (
        <div className="panel flex min-h-0 flex-1 flex-col overflow-hidden p-4 space-y-4">
          <div className="space-y-2">
            {/* Table reference and column inserters */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500">
                <Database className="h-3.5 w-3.5 text-cyan-400" />
                <span>Table: <strong className="text-cyan-300">data</strong></span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[10px] text-slate-600 mr-1">Insert column:</span>
                {snapshot?.columns.slice(0, 12).map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => handleInsertColumn(c.name)}
                    className="rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-mono text-slate-300 hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-200 transition-colors"
                    title={`Insert column '${c.name}' at cursor`}
                  >
                    {c.name}
                  </button>
                ))}
                {(snapshot?.columns.length ?? 0) > 12 && (
                  <span className="text-[10px] text-slate-600">+{(snapshot?.columns.length ?? 0) - 12} more</span>
                )}
              </div>
            </div>

            {/* SQL Template shortcuts */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-slate-600 mr-0.5">Templates:</span>
              {SQL_TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => setSqlQuery(t.sql)}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[10px] text-slate-400 hover:border-cyan-500/30 hover:text-cyan-300 transition-colors"
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* SQL Editor */}
            <div className="relative">
              <textarea
                ref={sqlTextareaRef}
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    void handleRunSql();
                  }
                }}
                rows={4}
                spellCheck={false}
                placeholder="SELECT * FROM data LIMIT 20"
                className="w-full rounded-2xl border border-white/10 bg-night-950 p-3.5 pr-24 font-mono text-xs text-cyan-300 placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none resize-none"
              />
              <div className="absolute right-3 top-3 flex items-center gap-1.5">
                <button
                  onClick={handleCopySql}
                  title="Copy SQL to clipboard"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-400 transition-colors hover:border-white/20 hover:text-white"
                >
                  {sqlCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <ClipboardCopy className="h-3 w-3" />}
                </button>
                <button
                  onClick={handleRunSql}
                  disabled={sqlBusy || !sqlQuery.trim()}
                  title="Run query (Ctrl+Enter)"
                  className="inline-flex h-7 items-center gap-1 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-2.5 text-[10px] font-semibold text-white shadow-md hover:brightness-110 disabled:opacity-50"
                >
                  {sqlBusy ? <Spinner className="h-3 w-3" /> : <Play className="h-3 w-3 fill-current" />}
                  Run
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-600">Tip: Ctrl+Enter to run · Click column names above to insert at cursor</p>
          </div>

          {sqlError && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
              {sqlError}
            </div>
          )}

          <div className="flex-1 overflow-auto rounded-2xl border border-white/10 bg-night-950/60 p-1">
            {sqlResult ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-slate-400 border-b border-white/5">
                  <span>Returned {sqlResult.row_count} rows</span>
                  <span>Executed in {sqlResult.elapsed_ms} ms</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="border-b border-white/5 bg-white/[0.02] text-[11px] font-semibold uppercase text-slate-400">
                      <tr>
                        {sqlResult.columns.map((col, idx) => (
                          <th key={idx} className="px-3 py-2">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {sqlResult.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-white/[0.02]">
                          {row.map((val, cIdx) => (
                            <td key={cIdx} className="px-3 py-1.5 whitespace-nowrap text-slate-200">
                              {val === null || val === undefined ? (
                                <span className="text-slate-600 italic">null</span>
                              ) : (
                                String(val)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex h-40 flex-col items-center justify-center text-xs text-slate-500">
                <Terminal className="h-6 w-6 text-slate-600 mb-2" />
                <span>Type a SQL query and click &quot;Run Query&quot;</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  onAsk,
}: {
  message: Message;
  onAsk: (q: string) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="flex max-w-[80%] items-start gap-2">
          <div className="rounded-2xl rounded-br-sm bg-gradient-to-br from-violet-600 to-indigo-600 px-4 py-2.5 text-sm text-white shadow-lg shadow-violet-900/40">
            {message.question}
          </div>
          <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/40 to-indigo-500/20 text-violet-200 ring-1 ring-white/10">
            <User className="h-4 w-4" />
          </span>
        </div>
      </div>
    );
  }

  if (message.error) {
    return (
      <div className="flex max-w-[85%] items-start gap-2">
        <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/30">
          <Bot className="h-4 w-4" />
        </span>
        <div className="rounded-2xl rounded-bl-sm border border-rose-500/25 bg-rose-500/[0.08] px-4 py-2.5 text-sm text-rose-200">
          {message.error}
        </div>
      </div>
    );
  }

  if (message.content) {
    return (
      <div className="flex max-w-[92%] items-start gap-2">
        <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/40 to-indigo-500/20 text-violet-200 ring-1 ring-white/10">
          <Bot className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-3 rounded-2xl rounded-bl-sm border border-white/[0.07] bg-white/[0.04] px-4 py-3 backdrop-blur-xl">
          <Badge className="border-white/10 bg-white/[0.04] text-slate-400">analyst</Badge>
          <p className="text-sm leading-relaxed text-slate-200">{message.content}</p>
        </div>
      </div>
    );
  }

  const r = message.response!;
  return (
    <div className="flex max-w-[92%] items-start gap-2">
      <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/40 to-indigo-500/20 text-violet-200 ring-1 ring-white/10">
        <Bot className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-3 rounded-2xl rounded-bl-sm border border-white/[0.07] bg-white/[0.04] px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Badge className={cn(r.mode === "llm" ? "border-violet-500/30 bg-violet-500/15 text-violet-200" : r.mode === "error" ? "border-rose-500/30 bg-rose-500/15 text-rose-200" : "border-cyan-500/30 bg-cyan-500/15 text-cyan-200")}>
            {r.mode === "llm" ? <Sparkles className="h-3 w-3" /> : null}
            {r.mode === "llm" ? "AI analyst" : r.mode === "error" ? "error" : "local analyst"}
          </Badge>
        </div>

        <p className="text-sm leading-relaxed text-slate-200">{r.answer}</p>

        {r.numbers && r.numbers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {r.numbers.map((n, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-xs"
              >
                <span className="text-slate-500">{n.label}:</span>
                <strong className="text-cyan-200">{n.value}</strong>
              </span>
            ))}
          </div>
        )}

        {r.explanation && <p className="text-xs text-slate-500">{r.explanation}</p>}

        {r.chart && (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <p className="mb-2 text-xs font-semibold text-slate-300">{r.chart.title}</p>
            <ChartRenderer chart={r.chart} height={220} />
          </div>
        )}

        {r.sql && (
          <div className="overflow-x-auto rounded-xl border border-white/[0.07] bg-night-950/80 px-3 py-2">
            <pre className="font-mono text-[11px] leading-relaxed text-emerald-200/90">{r.sql}</pre>
          </div>
        )}

        {r.query_result && r.query_result.rows.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-white/[0.07]">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.04]">
                <tr>
                  {r.query_result.columns.map((c) => (
                    <th key={c} className="px-2.5 py-1.5 font-semibold text-slate-400">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.query_result.rows.slice(0, 8).map((row, i) => (
                  <tr key={i} className="odd:bg-white/[0.02] even:bg-white/[0.04]">
                    {row.map((v, j) => (
                      <td key={j} className="px-2.5 py-1.5 text-slate-300">
                        {v === null ? "∅" : String(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {r.related_insights && r.related_insights.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {r.related_insights.map((ri) => (
              <button
                key={ri.id}
                onClick={() => ri.query_hint && onAsk(ri.query_hint)}
                className="rounded-full border border-dashed border-violet-400/40 bg-violet-500/10 px-3 py-1 text-xs text-violet-200 transition-colors hover:bg-violet-500/20"
              >
                {ri.query_hint ?? ri.title}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ModeBadge() {
  const { snapshot } = useDataset();
  const q = snapshot?.quality.summary.quality_score;
  return (
    <Badge className="hidden border-white/10 bg-white/[0.04] font-mono text-slate-400 sm:inline-flex">
      {q !== undefined ? `${q}/100 data quality` : "no dataset"}
    </Badge>
  );
}
