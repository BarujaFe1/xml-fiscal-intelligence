import JSZip from "jszip";
import type { ExportDatasetV2, ExportCsvProfile, ExportJsonProfile } from "@/lib/export/v2/types";
import { buildDocumentsCsvFromDataset, buildItemsCsvFromDataset } from "@/lib/export/v2/csv";
import { buildWorkbookFromDataset } from "@/lib/export/v2/excel";
import { buildHtmlFromDataset } from "@/lib/export/v2/html";
import { buildJsonFromDataset } from "@/lib/export/v2/json";
import { buildKeysTxtFromDataset } from "@/lib/export/v2/keys";
import { formatSha256Sums, sha256Hex } from "@/lib/export/v2/hash";

export type PackageArtifact =
  | "xlsx"
  | "csv"
  | "json"
  | "html"
  | "keys"
  | "xml";

export type BuildCompletePackageInput = {
  dataset: ExportDatasetV2;
  artifacts: PackageArtifact[];
  csvProfile?: ExportCsvProfile;
  jsonProfile?: ExportJsonProfile;
  /** Optional map of zip path → XML bytes (already sanitized names) */
  xmlEntries?: Array<{ path: string; content: string | Uint8Array; hash?: string }>;
  signal?: AbortSignal;
  onProgress?: (detail: string) => void;
};

export type CompletePackageResult = {
  blob: Blob;
  files: Array<{ path: string; byteLength: number; sha256: string }>;
  generationId: string;
};

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Exportação cancelada", "AbortError");
}

/**
 * Atomic complete package: build all bytes in memory, then produce one ZIP with DEFLATE.
 * Never starts download of a partial archive — caller downloads only after this resolves.
 */
export async function buildCompletePackage(
  input: BuildCompletePackageInput,
): Promise<CompletePackageResult> {
  const {
    dataset,
    artifacts,
    csvProfile = "excel_pt_br",
    jsonProfile = "compact",
    xmlEntries = [],
    signal,
    onProgress,
  } = input;

  const zip = new JSZip();
  const fileMeta: Array<{ path: string; bytes: Uint8Array }> = [];

  const addText = async (path: string, text: string) => {
    throwIfAborted(signal);
    const bytes = new TextEncoder().encode(text);
    fileMeta.push({ path, bytes });
    zip.file(path, text, { compression: "DEFLATE", compressionOptions: { level: 6 } });
  };

  const addBinary = async (path: string, data: ArrayBuffer | Uint8Array) => {
    throwIfAborted(signal);
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    fileMeta.push({ path, bytes });
    zip.file(path, bytes, { compression: "DEFLATE", compressionOptions: { level: 6 } });
  };

  onProgress?.("README");
  const readme = [
    "Pacote completo — XML Fiscal Intelligence",
    `Lote: ${dataset.summary.batchName}`,
    `Geração: ${dataset.manifest.generationId}`,
    `Gerado em: ${dataset.manifest.generatedAt}`,
    `Privacidade: ${dataset.privacy.profile}`,
    "",
    "Conteúdo:",
    ...artifacts.map((a) => `- ${a}`),
    "",
    "Validação: confira SHA256SUMS.txt (sha256sum -c SHA256SUMS.txt).",
    "",
    dataset.privacy.note,
    "",
    dataset.manifest.disclaimer,
    "",
  ].join("\n");
  await addText("README.txt", readme);

  if (artifacts.includes("xlsx")) {
    onProgress?.("planilhas");
    const buf = await buildWorkbookFromDataset(dataset);
    await addBinary("planilhas/notas-selecionadas.xlsx", buf);
  }

  if (artifacts.includes("csv")) {
    onProgress?.("csv");
    await addText("csv/documentos.csv", buildDocumentsCsvFromDataset(dataset, csvProfile));
    await addText("csv/itens.csv", buildItemsCsvFromDataset(dataset, csvProfile));
  }

  if (artifacts.includes("json")) {
    onProgress?.("json");
    await addText("json/dados-compactos.json", buildJsonFromDataset(dataset, jsonProfile));
  }

  if (artifacts.includes("html")) {
    onProgress?.("html");
    await addText("relatorio/relatorio.html", buildHtmlFromDataset(dataset));
  }

  if (artifacts.includes("keys")) {
    onProgress?.("chaves");
    const keys = buildKeysTxtFromDataset(dataset);
    await addText("chaves/chaves.txt", keys.text);
  }

  if (artifacts.includes("xml")) {
    onProgress?.("xml");
    for (const entry of xmlEntries) {
      await addBinary(
        entry.path.startsWith("xml/") ? entry.path : `xml/${entry.path}`,
        typeof entry.content === "string"
          ? new TextEncoder().encode(entry.content)
          : entry.content,
      );
    }
  }

  onProgress?.("manifest");
  const hashed: Array<{ path: string; sha256: string; byteLength: number }> = [];
  for (const f of fileMeta) {
    hashed.push({
      path: f.path,
      sha256: await sha256Hex(f.bytes),
      byteLength: f.bytes.byteLength,
    });
  }

  const manifestPayload = {
    ...dataset.manifest,
    packageFiles: hashed,
  };
  // Manifest + sums added after hashing other files (no self-hash of the zip)
  const manifestText = JSON.stringify(manifestPayload, null, 2);
  zip.file("manifest.json", manifestText, {
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  const manifestBytes = new TextEncoder().encode(manifestText);
  hashed.push({
    path: "manifest.json",
    sha256: await sha256Hex(manifestBytes),
    byteLength: manifestBytes.byteLength,
  });

  const sums = formatSha256Sums(hashed.map((h) => ({ path: h.path, hash: h.sha256 })));
  zip.file("SHA256SUMS.txt", sums, {
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  onProgress?.("compactando");
  throwIfAborted(signal);
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return {
    blob,
    files: hashed,
    generationId: dataset.manifest.generationId,
  };
}

export async function buildCsvPackageZip(
  dataset: ExportDatasetV2,
  profile: ExportCsvProfile = "excel_pt_br",
): Promise<Blob> {
  const zip = new JSZip();
  const docs = buildDocumentsCsvFromDataset(dataset, profile);
  const items = buildItemsCsvFromDataset(dataset, profile);
  const manifest = JSON.stringify(dataset.manifest, null, 2);
  const readme = [
    "Pacote CSV — XML Fiscal Intelligence",
    `Geração: ${dataset.manifest.generationId}`,
    `Perfil CSV: ${profile}`,
    "",
    "Arquivos: documentos.csv, itens.csv, manifest.json, SHA256SUMS.txt",
    "Cabeçalho CSV é sempre a primeira linha (sem comentários técnicos).",
    "",
  ].join("\n");

  zip.file("documentos.csv", docs, { compression: "DEFLATE", compressionOptions: { level: 6 } });
  zip.file("itens.csv", items, { compression: "DEFLATE", compressionOptions: { level: 6 } });
  zip.file("manifest.json", manifest, {
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  zip.file("README.txt", readme, { compression: "DEFLATE", compressionOptions: { level: 6 } });

  const hashes = [
    { path: "documentos.csv", hash: await sha256Hex(docs) },
    { path: "itens.csv", hash: await sha256Hex(items) },
    { path: "manifest.json", hash: await sha256Hex(manifest) },
    { path: "README.txt", hash: await sha256Hex(readme) },
  ];
  zip.file("SHA256SUMS.txt", formatSha256Sums(hashes), {
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
