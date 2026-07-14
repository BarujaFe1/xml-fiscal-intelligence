"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { listListings } from "@/lib/store/enterprise";
import { saveScenario } from "@/lib/store/homologation";
import {
  getMarketplaceRate,
  listPublicListings,
  saveMarketplaceRate,
  savePublicListing,
} from "@/lib/store/growth";
import {
  defaultMarketplaceRateLimit,
  flagAbuse,
  importPublicListingWithRelab,
  listApprovedPublic,
  moderatePublicListing,
  submitPublicListing,
} from "@/modules/growth/public-marketplace";
import {
  answerGuidedAssist,
  isGuidedAssistEnabled,
  listGuidedPlaybookTitles,
} from "@/modules/growth/guided-assist";
import {
  GROWTH_PLATFORM_MATURITY,
  growthHealth,
  section28Phase16Report,
} from "@/modules/growth/platform";
import type { PublicMarketplaceListing } from "@/modules/growth/types";
import type { ObligationId } from "@/modules/obligations/core/registry/ids";

export default function GrowthPage() {
  const [tenantId, setTenantId] = useState("tenant_local");
  const [workspaceId, setWorkspaceId] = useState("ws_local");
  const [pubs, setPubs] = useState<PublicMarketplaceListing[]>([]);
  const [question, setQuestion] = useState("Como homologar EFD ICMS/IPI no PVA?");
  const [assistTxt, setAssistTxt] = useState("");
  const [section28, setSection28] = useState("");

  const refresh = useCallback(async () => {
    setPubs(await listPublicListings());
  }, []);

  useEffect(() => {
    void (async () => {
      const ws =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("xfi:workspace-id") || crypto.randomUUID()
          : crypto.randomUUID();
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("xfi:workspace-id", ws);
        setTenantId(localStorage.getItem("xfi:tenant-id") || "tenant_local");
      }
      setWorkspaceId(ws);
      await refresh();
    })();
  }, [refresh]);

  const health = growthHealth();

  async function submitToPublic() {
    const listings = await listListings(tenantId);
    const published = listings.find((l) => l.status === "published");
    if (!published) {
      toast.error("Publique um cenário no Enterprise/marketplace tenant antes");
      return;
    }
    const rate = (await getMarketplaceRate(tenantId)) || defaultMarketplaceRateLimit(tenantId);
    try {
      const { publicListing, rateLimit } = submitPublicListing({
        listing: published,
        compliancePackHashRef: "pack:phase15",
        rateLimit: rate,
      });
      await savePublicListing(publicListing);
      await saveMarketplaceRate(rateLimit);
      toast.success(`Fila pública ${publicListing.id} (pending_review)`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "erro");
    }
  }

  async function approveFirst() {
    const pending = pubs.find((p) => p.moderation === "pending_review");
    if (!pending) {
      toast.message("Nenhum pending");
      return;
    }
    const next = moderatePublicListing(pending, "approved", "mod_local");
    await savePublicListing(next);
    toast.success("approved");
    await refresh();
  }

  async function importApproved() {
    const approved = listApprovedPublic(pubs)[0];
    if (!approved) {
      toast.message("Nenhum approved");
      return;
    }
    const rate = (await getMarketplaceRate(tenantId)) || defaultMarketplaceRateLimit(tenantId);
    try {
      const { scenario, rateLimit } = importPublicListingWithRelab({
        publicListing: approved,
        targetWorkspaceId: workspaceId,
        targetTenantId: tenantId,
        rateLimit: rate,
      });
      await saveScenario(scenario);
      await saveMarketplaceRate(rateLimit);
      toast.success(`Import ${scenario.id} → ${scenario.status}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "erro");
    }
  }

  function askAssist() {
    const ans = answerGuidedAssist({
      question,
      obligationId: /icms/i.test(question) ? ("efd-icms-ipi" as ObligationId) : undefined,
    });
    setAssistTxt(
      [
        `ok=${ans.ok} blocked=${ans.blocked}`,
        ans.reason || "",
        ans.playbookId ? `playbook=${ans.playbookId}` : "",
        ...ans.nextSteps.map((s) => `- ${s}`),
        ans.disclaimer,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    if (ans.blocked) toast.message(ans.reason || "bloqueado");
    else toast.success("orientação");
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Growth · Fase 16</h1>
          <p className="text-muted-foreground text-sm">
            maturidade <Badge tone="info">{GROWTH_PLATFORM_MATURITY}</Badge> · marketplace
            público · assist · mobile
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/app/m"
            className="border-input bg-background hover:bg-accent inline-flex h-9 items-center rounded-md border px-3 text-sm"
          >
            Mobile
          </Link>
          <Link
            href="/app/compliance"
            className="border-input bg-background hover:bg-accent inline-flex h-9 items-center rounded-md border px-3 text-sm"
          >
            Compliance
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Health</CardTitle>
          <CardDescription>
            guidedAssist={String(health.guidedAssistEnabled)} · mobileRO=
            {String(health.mobileReadOnly)} · prod={String(health.anyObligationProduction)}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Flag runtime: {String(isGuidedAssistEnabled())} · cenários locais: use Homologação /
          Enterprise
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Marketplace público</CardTitle>
          <CardDescription>Moderação · rate limit · import força re-lab</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void submitToPublic()}>Enviar tenant → público</Button>
            <Button variant="secondary" onClick={() => void approveFirst()}>
              Aprovar 1º pending
            </Button>
            <Button variant="outline" onClick={() => void importApproved()}>
              Import approved + re-lab
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                const a = pubs.find((p) => p.moderation === "approved");
                if (!a) return;
                await savePublicListing(flagAbuse(a, "spam_test"));
                await refresh();
              }}
            >
              Flag abuse
            </Button>
          </div>
          <ul className="text-sm space-y-1">
            {pubs.map((p) => (
              <li key={p.id}>
                <Badge>{p.moderation}</Badge> {p.title} · flags={p.abuseFlags.length}
              </li>
            ))}
            {pubs.length === 0 ? (
              <li className="text-muted-foreground">Catálogo vazio</li>
            ) : null}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Guided assist</CardTitle>
          <CardDescription>FEATURE_GUIDED_ASSIST · ban alíquota/vencimento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>pergunta</Label>
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={askAssist}>Perguntar</Button>
            <Button
              variant="outline"
              onClick={() => {
                const q = "Qual a alíquota de PIS?";
                setQuestion(q);
                const ans = answerGuidedAssist({ question: q });
                setAssistTxt(
                  [`ok=${ans.ok} blocked=${ans.blocked}`, ans.reason || "", ans.disclaimer].join(
                    "\n",
                  ),
                );
                toast.message(ans.reason || "bloqueado");
              }}
            >
              Teste ban tributário
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setSection28(section28Phase16Report());
                toast.success("§28");
              }}
            >
              §28
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Playbooks: {listGuidedPlaybookTitles().slice(0, 2).join(" · ")}
          </p>
          {assistTxt ? (
            <pre className="bg-muted max-h-40 overflow-auto rounded-md p-3 text-xs">{assistTxt}</pre>
          ) : null}
          {section28 ? (
            <pre className="bg-muted max-h-36 overflow-auto rounded-md p-3 text-xs">{section28}</pre>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
