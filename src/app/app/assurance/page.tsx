"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  readinessMarkdown,
  soaMarkdown,
  soc2ReadinessChecklist,
  readinessSummary,
} from "@/modules/assurance/soc2-readiness";
import { answerGroundedAssist } from "@/modules/assurance/grounded-assist";
import { runSapLivePilotGolden } from "@/modules/assurance/sap-live-pilot";
import {
  ASSURANCE_PLATFORM_MATURITY,
  assuranceHealth,
  section28Phase17Report,
} from "@/modules/assurance/platform";
import { listApprovedOfficialSnippets } from "@/modules/assurance/official-snippets";
import type { ObligationId } from "@/modules/obligations/core/registry/ids";

export default function AssurancePage() {
  const [readinessMd, setReadinessMd] = useState("");
  const [soaMd, setSoaMd] = useState("");
  const [section28, setSection28] = useState("");
  const [healthTxt, setHealthTxt] = useState("");
  const [question, setQuestion] = useState("Como homologar EFD ICMS/IPI no PVA?");
  const [assistTxt, setAssistTxt] = useState("");
  const [sapTxt, setSapTxt] = useState("");

  useEffect(() => {
    void (async () => {
      const items = soc2ReadinessChecklist();
      const s = readinessSummary(items);
      const h = assuranceHealth({});
      setHealthTxt(
        `maturity=${h.maturity} readinessOrWaived=${h.readinessCompleteOrWaived} open=${h.readinessOpen} sap=${h.sapGoldenOk} snippets=${h.officialSnippetCount}`,
      );
      setReadinessMd(readinessMarkdown(items));
      setSoaMd(soaMarkdown());
      setSection28(await section28Phase17Report());
      setSapTxt(JSON.stringify(runSapLivePilotGolden({}), null, 2));
      toast.message(`SOC2 prep · done/waived=${s.done + s.waived}/${s.total}`);
    })();
  }, []);

  function runAssist() {
    const ans = answerGroundedAssist({
      question,
      obligationId: "efd-icms-ipi" as ObligationId,
      env: { FEATURE_GUIDED_ASSIST: "1" },
    });
    setAssistTxt(
      [
        `ok=${ans.ok} blocked=${ans.blocked}`,
        ans.reason || "",
        `sourceIds: ${(ans.sourceIds || []).join(", ")}`,
        ...ans.citations.map((c) => `- ${c.title}: ${c.url}`),
        "",
        ...ans.nextSteps.map((s) => `• ${s}`),
        "",
        ans.disclaimer,
      ].join("\n"),
    );
  }

  const snippets = listApprovedOfficialSnippets("efd-icms-ipi").slice(0, 5);

  return (
    <div className="space-y-6 p-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">Assurance</h1>
          <p className="text-sm text-slate-400 mt-1">
            Fase 17 — SOC2 Type I prep · grounding · SAP live #3
          </p>
        </div>
        <Badge tone="info">{ASSURANCE_PLATFORM_MATURITY}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Health</CardTitle>
          <CardDescription>Sem relatório SOC2 · sem production global</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-300">
          <pre className="whitespace-pre-wrap text-xs text-slate-400">{healthTxt}</pre>
          <p className="text-xs text-amber-200/90">
            Marketing: <code className="text-sky-300">soc2Certified=false</code> enforced.
          </p>
          <Link href="/app/compliance" className="text-sky-400 text-xs underline-offset-2 hover:underline">
            Compliance pack →
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>SOC2 readiness</CardTitle>
            <CardDescription>Checklist interno + waivers</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-xs text-slate-400">
              {readinessMd || "…"}
            </pre>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Statement of Applicability</CardTitle>
            <CardDescription>Draft — não é Type I</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-xs text-slate-400">
              {soaMd || "…"}
            </pre>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assist grounded</CardTitle>
          <CardDescription>sourceIds do OFFICIAL_SOURCE_CATALOG · ban tributário</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="q">Pergunta</Label>
            <Input id="q" value={question} onChange={(e) => setQuestion(e.target.value)} />
          </div>
          <Button type="button" onClick={runAssist}>
            Responder (grounded, flag on local)
          </Button>
          <ul className="text-xs text-slate-500 space-y-1">
            {snippets.map((s) => (
              <li key={s.sourceId}>
                <span className="text-sky-400">{s.sourceId}</span> — {s.title}
              </li>
            ))}
          </ul>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-xs text-slate-400">
            {assistTxt || "Clique em responder"}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SAP live piloto</CardTitle>
          <CardDescription>XFI_ALLOW_LIVE_ERP + XFI_SAP_OAUTH_TOKEN · HTTP via XFI_ERP_HTTP</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="text-xs text-slate-400 whitespace-pre-wrap">{sapTxt}</pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>§28 Fase 17</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs text-slate-400">
            {section28}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
