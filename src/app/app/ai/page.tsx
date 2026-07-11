"use client";

import { useState } from "react";
import { Bot, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { assertSafeSelectSql } from "@/modules/ai";
import {
  containsSensitiveAiInput,
  getAiProvider,
  type SafeAiResponse,
} from "@/modules/ai/provider";
import type { AiChatMessage } from "@/modules/ai";

const AI_ENABLED = process.env.NEXT_PUBLIC_ENABLE_AI === "true";

export default function AiPage() {
  const [question, setQuestion] = useState("Quais notas sem protocolo neste lote?");
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);
  const [lastMeta, setLastMeta] = useState<SafeAiResponse | null>(null);
  const [sqlDraft, setSqlDraft] = useState(
    "SELECT access_key, total_value FROM fiscal_documents WHERE protocol IS NULL LIMIT 50",
  );
  const demoMode = !AI_ENABLED;

  async function ask() {
    if (!question.trim()) return;
    if (demoMode && containsSensitiveAiInput(question)) {
      setMessages((m) => [
        ...m,
        { role: "user", content: question },
        {
          role: "assistant",
          content:
            "Modo demonstração: não envie dados sensíveis. Nenhum conteúdo é transmitido a provedores de IA.",
        },
      ]);
      setQuestion("");
      return;
    }
    setLoading(true);
    const userMsg: AiChatMessage = { role: "user", content: question };
    setMessages((m) => [...m, userMsg]);
    try {
      const provider = getAiProvider();
      const result = await provider.chat({
        question,
        contextSummary: demoMode
          ? "Modo demonstração · nenhum dado enviado a provedores"
          : "IA experimental com mascaramento",
        consent,
        enableAi: AI_ENABLED,
      });
      setLastMeta(result);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: [
            result.answer,
            "",
            result.citations.length ? `Fontes: ${result.citations.join(", ")}` : "",
            `Confiança: ${result.confidence} · Revisão humana: ${result.needsHumanReview ? "obrigatória" : "recomendada"}`,
            result.dataSentDescription,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ]);
      setQuestion("");
    } finally {
      setLoading(false);
    }
  }

  const sqlCheck = assertSafeSelectSql(sqlDraft);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge tone={demoMode ? "warning" : "success"}>
            {demoMode ? "Modo demonstração" : "IA experimental"}
          </Badge>
        </div>
        <h1
          className="text-2xl font-bold flex items-center gap-2"
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          <Bot className="h-6 w-6 text-sky-300" /> Assistente fiscal
        </h1>
        <p className="text-slate-400 mt-1">
          Explica e sugere revisão. Não inventa CST/CFOP, não altera apuração e não declara
          conformidade.
        </p>
      </div>

      {demoMode && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 text-sm text-amber-100/90">
            Respostas simuladas localmente. Nenhum dado é enviado a provedores externos.
          </CardContent>
        </Card>
      )}

      <label className="flex items-start gap-3 text-sm text-slate-300">
        <input
          type="checkbox"
          className="mt-1"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>
          Consinto o processamento consultivo desta pergunta (com mascaramento). Sem consentimento a
          consulta é recusada.
        </span>
      </label>

      <Card>
        <CardHeader>
          <CardTitle>Consulta</CardTitle>
          <CardDescription>
            {lastMeta?.dataSentDescription ||
              "Dados enviados nesta consulta: resumo do achado, código da regra e campos mascarados (quando IA real)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "user" ? "bg-sky-500/10 text-sky-50" : "bg-white/5 text-slate-200"
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
              onKeyDown={(e) => e.key === "Enter" && void ask()}
              aria-label="Pergunta ao assistente"
            />
            <Button type="button" onClick={() => void ask()} disabled={loading || !consent}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SQL seguro (somente SELECT)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <textarea
            className="w-full min-h-24 rounded-xl border border-white/10 bg-slate-950 p-3 text-xs font-mono"
            value={sqlDraft}
            onChange={(e) => setSqlDraft(e.target.value)}
          />
          <p className={`text-xs ${sqlCheck.ok ? "text-emerald-300" : "text-rose-300"}`}>
            {sqlCheck.ok ? "SELECT permitido" : sqlCheck.reason}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
