"use client";

import { useState } from "react";
import { Bot, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { assertSafeSelectSql, chatFiscalAi, type AiChatMessage } from "@/modules/ai";

const AI_ENABLED = process.env.NEXT_PUBLIC_ENABLE_AI === "true";

export default function AiPage() {
  const [question, setQuestion] = useState("Quais notas sem protocolo neste lote?");
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sqlDraft, setSqlDraft] = useState(
    "SELECT access_key, total_value FROM fiscal_documents WHERE protocol IS NULL LIMIT 50",
  );
  const demoMode = !AI_ENABLED;

  async function ask() {
    if (!question.trim()) return;
    if (demoMode && /chave|xml|senha|certificado|cpf\s*\d/i.test(question)) {
      setMessages((m) => [
        ...m,
        { role: "user", content: question },
        {
          role: "assistant",
          content:
            "Modo demonstração: não envie dados sensíveis. Nenhum conteúdo é transmitido a provedores de IA. Reformule sem chaves, XML ou documentos.",
        },
      ]);
      setQuestion("");
      return;
    }
    setLoading(true);
    const userMsg: AiChatMessage = { role: "user", content: question };
    setMessages((m) => [...m, userMsg]);
    try {
      const result = await chatFiscalAi({
        question,
        contextSummary: demoMode
          ? "Modo demonstração · nenhum dado enviado a provedores"
          : "IA habilitada com mascaramento",
        enableAi: AI_ENABLED,
        provider: demoMode ? "mock" : "mock",
      });
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: [
            demoMode ? "[Demonstração — resposta simulada]" : "",
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
          {demoMode
            ? "Respostas simuladas localmente. Nenhum dado é enviado a provedores externos. Não use como parecer fiscal."
            : "Explicações consultivas com mascaramento. Não altera apuração nem declara conformidade."}
        </p>
      </div>

      {demoMode && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 text-sm text-amber-100/90 space-y-1">
            <p>
              <strong>Demonstração:</strong> histórico abaixo não foi processado por modelo de IA.
            </p>
            <p>Evite colar XML, chaves de acesso, senhas ou certificados neste campo.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Consulta em linguagem natural</CardTitle>
          <CardDescription>
            {demoMode ? "Provider: mock (sem API externa)." : "Provider configurado via ENABLE_AI."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-h-80 space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/50 p-4">
            {!messages.length && (
              <p className="text-sm text-slate-500">
                Pergunte sobre CFOP, NCM, duplicidades ou filtros — sem dados sensíveis.
              </p>
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
              placeholder="Pergunta (sem XML/chaves)…"
              aria-label="Pergunta para o assistente"
            />
            <Button onClick={ask} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SQL SELECT seguro (rascunho)</CardTitle>
          <CardDescription>Apenas SELECT; bloqueia mutações.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <textarea
            className="w-full min-h-24 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm font-mono"
            value={sqlDraft}
            onChange={(e) => setSqlDraft(e.target.value)}
          />
          <p className={`text-xs ${sqlCheck.ok ? "text-emerald-300" : "text-rose-300"}`}>
            {sqlCheck.ok ? "Consulta aceita (validação sintática)." : sqlCheck.reason}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
