import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, User } from "lucide-react";
import { useDataset } from "../store/DatasetContext";
import { askQuestion, getInsights } from "../api/client";
import { Button, Spinner } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ChartRenderer } from "../components/charts/ChartRenderer";
import type { AnalystResponse } from "../types";

interface Message {
  id: string;
  role: "user" | "assistant";
  question?: string;
  response?: AnalystResponse;
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggested, setSuggested] = useState<string[]>(DEFAULT_QUESTIONS);
  const bottomRef = useRef<HTMLDivElement>(null);

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
        const { insights: found } = await getInsights(sessionId);
        const hints = found.map((i) => i.query_hint).filter((h): h is string => !!h);
        if (hints.length) setSuggested([...hints.slice(0, 4), ...DEFAULT_QUESTIONS].slice(0, 6));
      } catch {
        /* keep defaults */
      }
    };
    void load();
  }, [sessionId, insights]);

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

  return (
    <div className="flex h-[calc(100vh-190px)] min-h-[520px] flex-col">
      <div className="flex items-center justify-between gap-3 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">AI Analyst</h2>
          <p className="text-sm text-slate-500">
            Ask questions about your data. Every answer is grounded in the actual dataset.
          </p>
        </div>
        <ModeBadge />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
                <Bot className="h-6 w-6" />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-slate-800">Ask anything about your dataset</h3>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Try one of the suggested questions below, or type your own.
              </p>
              <div className="mt-5 flex max-w-md flex-wrap justify-center gap-2">
                {suggested.map((q) => (
                  <button
                    key={q}
                    onClick={() => void submit(q)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
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
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <Spinner className="h-4 w-4 text-brand-600" />
              <span>Analyzing your data…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-slate-200 p-3">
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
              className="max-h-32 min-h-[44px] flex-1 resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <Button type="submit" disabled={!input.trim()} loading={busy} className="h-11">
              {!busy && <Send className="h-4 w-4" />}
              Ask
            </Button>
          </form>
        </div>
      </div>
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
          <div className="rounded-2xl rounded-br-sm bg-brand-600 px-4 py-2.5 text-sm text-white shadow-sm">
            {message.question}
          </div>
          <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
            <User className="h-4 w-4" />
          </span>
        </div>
      </div>
    );
  }

  if (message.error) {
    return (
      <div className="flex max-w-[85%] items-start gap-2">
        <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
          <Bot className="h-4 w-4" />
        </span>
        <div className="rounded-2xl rounded-bl-sm border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {message.error}
        </div>
      </div>
    );
  }

  const r = message.response!;
  return (
    <div className="flex max-w-[92%] items-start gap-2">
      <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
        <Bot className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-3 rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-50/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <Badge className="bg-brand-50 text-brand-700 border-brand-200">
            {r.mode === "llm" ? <Sparkles className="h-3 w-3" /> : null}
            {r.mode === "llm" ? "AI analyst" : r.mode === "error" ? "error" : "local analyst"}
          </Badge>
        </div>

        <p className="text-sm leading-relaxed text-slate-800">{r.answer}</p>

        {r.numbers && r.numbers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {r.numbers.map((n, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs"
              >
                <span className="text-slate-500">{n.label}:</span>
                <strong className="text-slate-900">{n.value}</strong>
              </span>
            ))}
          </div>
        )}

        {r.explanation && <p className="text-xs text-slate-500">{r.explanation}</p>}

        {r.chart && (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="mb-2 text-xs font-semibold text-slate-700">{r.chart.title}</p>
            <ChartRenderer chart={r.chart} height={220} />
          </div>
        )}

        {r.sql && (
          <div className="overflow-x-auto rounded-lg bg-slate-900 px-3 py-2">
            <pre className="text-[11px] leading-relaxed text-slate-200">{r.sql}</pre>
          </div>
        )}

        {r.query_result && r.query_result.rows.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100">
                <tr>
                  {r.query_result.columns.map((c) => (
                    <th key={c} className="px-2.5 py-1.5 font-semibold text-slate-600">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.query_result.rows.slice(0, 8).map((row, i) => (
                  <tr key={i} className="odd:bg-white even:bg-slate-50">
                    {row.map((v, j) => (
                      <td key={j} className="px-2.5 py-1.5 text-slate-700">
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
                className="rounded-full border border-dashed border-brand-300 bg-brand-50/60 px-3 py-1 text-xs text-brand-700 transition-colors hover:bg-brand-100"
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
    <Badge className="hidden bg-slate-100 text-slate-500 border-slate-200 sm:inline-flex">
      {q !== undefined ? `${q}/100 data quality` : "no dataset"}
    </Badge>
  );
}
