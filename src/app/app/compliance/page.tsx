"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getCompliancePrefs,
  listPrivacyRequests,
  saveCompliancePrefs,
  savePrivacyRequest,
} from "@/lib/store/compliance";
import {
  buildCompliancePack,
  packManifestJson,
  packToMarkdown,
  checklistMarkdown,
} from "@/modules/compliance/pack";
import {
  createPrivacyRequest,
  dataMapMarkdown,
  fulfillEraseHonest,
  fulfillExport,
  partnerDsaTemplateMarkdown,
} from "@/modules/compliance/lgpd";
import { t, normalizeLocale, listLocales } from "@/modules/compliance/i18n";
import type { LocaleCode } from "@/modules/compliance/types";
import { periodKeyMonthly, timezoneHelpersMarkdown } from "@/modules/compliance/timezone";
import {
  assertNoForeignTaxEngine,
  jurisdictionMarkdown,
} from "@/modules/compliance/jurisdiction";
import {
  COMPLIANCE_PLATFORM_MATURITY,
  complianceHealth,
  section28Phase15Report,
} from "@/modules/compliance/platform";
import type { PrivacyRequest } from "@/modules/compliance/types";

export default function CompliancePage() {
  const [workspaceId, setWorkspaceId] = useState("ws_local");
  const [locale, setLocale] = useState<LocaleCode>("pt-BR");
  const [packMd, setPackMd] = useState("");
  const [manifest, setManifest] = useState("");
  const [extraMd, setExtraMd] = useState("");
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [healthTxt, setHealthTxt] = useState("");

  const refresh = useCallback(async () => {
    setRequests(await listPrivacyRequests(workspaceId));
    const h = await complianceHealth();
    setHealthTxt(
      `pack=${h.packVersion} hashOk=${h.packHashOk} dataMap=${h.dataMapEntries} locales=${h.i18nLocales}`,
    );
  }, [workspaceId]);

  useEffect(() => {
    void (async () => {
      const ws =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("xfi:workspace-id") || crypto.randomUUID()
          : crypto.randomUUID();
      if (typeof localStorage !== "undefined") localStorage.setItem("xfi:workspace-id", ws);
      setWorkspaceId(ws);
      const prefs = await getCompliancePrefs(ws);
      if (prefs) setLocale(prefs.locale);
      await refresh();
    })();
  }, [refresh]);

  async function generatePack() {
    const pack = await buildCompliancePack({
      section28Extra: await section28Phase15Report(),
    });
    setPackMd(packToMarkdown(pack));
    setManifest(packManifestJson(pack));
    toast.success(`Pack ${pack.version.label} · hash ${pack.contentHash.slice(0, 12)}…`);
  }

  async function setLocalePref(next: LocaleCode) {
    setLocale(next);
    await saveCompliancePrefs({
      workspaceId,
      locale: next,
      updatedAt: new Date().toISOString(),
    });
  }

  async function requestExport() {
    let r = createPrivacyRequest({
      workspaceId,
      type: "export",
      requesterId: "user_local",
    });
    r = fulfillExport(r);
    await savePrivacyRequest(r);
    toast.success(`Export ${r.status}`);
    await refresh();
  }

  async function requestErase() {
    let r = createPrivacyRequest({
      workspaceId,
      type: "erase",
      requesterId: "user_local",
    });
    r = fulfillEraseHonest(r);
    await savePrivacyRequest(r);
    toast.message(`Erase ${r.status} · cloudBackupOutOfScope=${r.cloudBackupOutOfScope}`);
    await refresh();
  }

  function showDocs(kind: "map" | "dsa" | "tz" | "jur" | "check") {
    if (kind === "map") setExtraMd(dataMapMarkdown());
    if (kind === "dsa") setExtraMd(partnerDsaTemplateMarkdown());
    if (kind === "tz") setExtraMd(timezoneHelpersMarkdown() + `\n\nperiodKey now: ${periodKeyMonthly()}`);
    if (kind === "jur") {
      try {
        assertNoForeignTaxEngine("BR");
        setExtraMd(jurisdictionMarkdown());
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "erro");
      }
    }
    if (kind === "check") setExtraMd(checklistMarkdown());
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("app.compliance.title", locale)}</h1>
          <p className="text-muted-foreground text-sm">
            {t("app.compliance.subtitle", locale)} ·{" "}
            <Badge tone="info">{COMPLIANCE_PLATFORM_MATURITY}</Badge>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            value={locale}
            onChange={(e) => void setLocalePref(normalizeLocale(e.target.value))}
          >
            {listLocales().map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <Link
            href="/app/ecosystem"
            className="border-input bg-background hover:bg-accent inline-flex h-9 items-center rounded-md border px-3 text-sm"
          >
            Ecosystem
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Health</CardTitle>
          <CardDescription>{healthTxt || "—"}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t("app.compliance.noForeignTax", locale)} · {t("app.compliance.jurisdictionBr", locale)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compliance pack</CardTitle>
          <CardDescription>Bundle versionado + contentHash (sem selo SOC2)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void generatePack()}>{t("app.compliance.generatePack", locale)}</Button>
            <Button variant="secondary" onClick={() => showDocs("check")}>
              Checklist
            </Button>
          </div>
          {manifest ? (
            <pre className="bg-muted max-h-32 overflow-auto rounded-md p-3 text-xs">{manifest}</pre>
          ) : null}
          {packMd ? (
            <pre className="bg-muted max-h-56 overflow-auto rounded-md p-3 text-xs">{packMd}</pre>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>LGPD / privacidade</CardTitle>
          <CardDescription>Data map · export/erase · partner DSA template</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => showDocs("map")}>
              {t("app.compliance.dataMap", locale)}
            </Button>
            <Button onClick={() => void requestExport()}>
              {t("app.compliance.privacyExport", locale)}
            </Button>
            <Button variant="secondary" onClick={() => void requestErase()}>
              {t("app.compliance.privacyErase", locale)}
            </Button>
            <Button variant="ghost" onClick={() => showDocs("dsa")}>
              Partner DSA
            </Button>
          </div>
          <ul className="text-sm space-y-1">
            {requests.map((r) => (
              <li key={r.id}>
                <Badge>{r.status}</Badge> {r.type} · cloudBackupOutOfScope=
                {String(r.cloudBackupOutOfScope)}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>i18n · timezone · jurisdição</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => showDocs("tz")}>
              Timezone helpers
            </Button>
            <Button variant="outline" onClick={() => showDocs("jur")}>
              Jurisdição BR
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                try {
                  assertNoForeignTaxEngine("US");
                } catch (e) {
                  toast.message(e instanceof Error ? e.message : "bloqueado");
                }
              }}
            >
              Testar jurisdição US (deve falhar)
            </Button>
          </div>
          {extraMd ? (
            <pre className="bg-muted max-h-48 overflow-auto rounded-md p-3 text-xs">{extraMd}</pre>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
