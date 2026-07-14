/**
 * OpenTelemetry-like hooks — buffer local, export Prometheus text.
 * Sem SDK OTel pesado; interface estável para instrumentação.
 */

import type { OtelSpanHook } from "@/modules/ecosystem/types";
import type { SloSample, SloSnapshot } from "@/modules/ecosystem/types";

const MAX_SPANS = 200;
const spans: OtelSpanHook[] = [];

export function startSpan(
  name: string,
  kind: OtelSpanHook["kind"] = "internal",
  attributes: OtelSpanHook["attributes"] = {},
): OtelSpanHook {
  const span: OtelSpanHook = {
    name,
    kind,
    attributes: { ...attributes },
    startMs: Date.now(),
  };
  spans.unshift(span);
  if (spans.length > MAX_SPANS) spans.pop();
  return span;
}

export function endSpan(span: OtelSpanHook, attrs?: OtelSpanHook["attributes"]): OtelSpanHook {
  span.endMs = Date.now();
  if (attrs) Object.assign(span.attributes, attrs);
  return span;
}

export function listSpans(limit = 50): OtelSpanHook[] {
  return spans.slice(0, limit);
}

export function clearSpansForTests(): void {
  spans.length = 0;
}

/** Prometheus text exposition (subset). */
export function exportPrometheusText(input: {
  snapshots: SloSnapshot[];
  samples?: SloSample[];
}): string {
  const lines = [
    "# HELP xfi_slo_availability_pct SLO availability percent",
    "# TYPE xfi_slo_availability_pct gauge",
  ];
  for (const s of input.snapshots) {
    if (s.availabilityPct === null) continue;
    lines.push(
      `xfi_slo_availability_pct{slo="${s.sloId}"} ${s.availabilityPct.toFixed(3)}`,
    );
  }
  lines.push("# HELP xfi_slo_latency_p95_ms SLO latency p95");
  lines.push("# TYPE xfi_slo_latency_p95_ms gauge");
  for (const s of input.snapshots) {
    if (s.latencyP95Ms === null) continue;
    lines.push(`xfi_slo_latency_p95_ms{slo="${s.sloId}"} ${s.latencyP95Ms}`);
  }
  lines.push("# HELP xfi_otel_spans_buffered Active span buffer size");
  lines.push("# TYPE xfi_otel_spans_buffered gauge");
  lines.push(`xfi_otel_spans_buffered ${spans.length}`);
  if (input.samples?.length) {
    lines.push(`# samples_window ${input.samples.length}`);
  }
  return lines.join("\n") + "\n";
}
