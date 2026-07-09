"use client";

import { useState } from "react";
import { Bot, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { assertSafeSelectSql, chatFiscalAi, type AiChatMessage } from "@/modules/ai";

export default function AiPage() {
  const [question, setQuestion] = useState("Quais notas sem protocolo neste lote?");
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sqlDraft, setSqlDraft] = useState("SELECT access_key, total_value FROM fiscal_documents WHERE protocol IS NULL LIMIT 50");

  async function ask() {
    if (!question.trim()) return;
    setLoading(true);
    const userMsg: AiChatMessage = { role: "user", content: question };
    setMessages((m) => [...m, userMsg]);
    try {
      const result = await chatFiscalAi({
        question,
        contextSummary: "Workspace local IndexedDB · ENABLE_AI=false (mock)",
        enableAi: false,
        provider: "mock",
      });
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: [
            result.answer,
            "",
            result.citations.length ? `Fontes: ${result.citations.join(", ")}` : "",
            result.limitations.length ? `Limitações: ${result.limitations.join(" · ")}` : "",
            result.suggestedFilters
              ? `Filtros sugeridos: ${JSON.stringify(result.suggestedFilters)}`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const sqlCheck = assertSafeSelectSql(sqlDraft);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-display), sans-serif" }}>
          <Bot className="h-6 w-6 text-sky-300" /> IA fiscal
        </h1>
        <p className="text-slate-400 mt-1">
          Chat mock com mascaramento e SQL SELECT seguro. Não emite parecer fiscal definitivo.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Consulta em linguagem natural</CardTitle>
          <CardDescription>Provider padrão: mock (sem API externa).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-h-80 space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/50 p-4">
            {!messages.length && (
              <p className="text-sm text-slate-500">Faça uma pergunta sobre CFOP, NCM, duplicidades ou filtros.</p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "user" ? "bg-sky-500/10 text-sky-100" : "bg-white/5 text-slate-300"
                }`}
              >
                {m.content}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
              placeholder="Ex.: listar CFOP 5102 sem NCM"
            />
            <Button type="button" onClick={ask} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SQL SELECT seguro (preview)</CardTitle>
          <CardDescription>Apenas SELECT — destrutivo é bloqueado antes da execução.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            className="w-full min-h-24 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 font-mono text-xs"
            value={sqlDraft}
            onChange={(e) => setSqlDraft(e.target.value)}
          />
          <p className={`text-sm ${sqlCheck.ok ? "text-emerald-300" : "text-rose-300"}`}>
            {sqlCheck.ok ? "SQL permitido (SELECT)." : sqlCheck.reason}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
