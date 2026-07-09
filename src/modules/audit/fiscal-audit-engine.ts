import { v4 as uuidv4 } from "uuid";
import { isValidCnpjOrCpfFormat } from "@/lib/security/hash";
import type {
  AuditFinding,
  Batch,
  DocumentItem,
  DocumentSummary,
  FindingSeverity,
} from "@/types";

function finding(
  partial: Omit<AuditFinding, "id" | "createdAt" | "status"> & { status?: AuditFinding["status"] },
): AuditFinding {
  return {
    id: uuidv4(),
    status: partial.status || "open",
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

/**
 * Motor de auditoria fiscal — gera findings por documento/lote.
 * Não substitui parecer contábil/fiscal profissional.
 */
export function runFiscalAudit(input: {
  batch: Batch;
  documents: DocumentSummary[];
  items: DocumentItem[];
}): AuditFinding[] {
  const { batch, documents, items } = input;
  const out: AuditFinding[] = [];
  const ws = batch.workspaceId;
  const batchId = batch.id;

  // Duplicates by access key
  const keyMap = new Map<string, DocumentSummary[]>();
  for (const d of documents) {
    if (!d.accessKey) continue;
    const list = keyMap.get(d.accessKey) || [];
    list.push(d);
    keyMap.set(d.accessKey, list);
  }
  for (const [key, list] of keyMap) {
    if (list.length < 2) continue;
    for (const d of list) {
      out.push(
        finding({
          workspaceId: ws,
          batchId,
          documentId: d.id,
          severity: "warning",
          category: "duplicidade",
          code: "DUP_ACCESS_KEY",
          title: "Chave de acesso duplicada no lote",
          description: `A chave ${key} aparece ${list.length} vezes.`,
          evidence: { accessKey: key, count: list.length },
          recommendation: "Confirme se são reprocessamentos ou XMLs repetidos no ZIP.",
        }),
      );
    }
  }

  // Hash duplicates
  const hashMap = new Map<string, DocumentSummary[]>();
  for (const d of documents) {
    if (!d.xmlHash) continue;
    const list = hashMap.get(d.xmlHash) || [];
    list.push(d);
    hashMap.set(d.xmlHash, list);
  }
  for (const [hash, list] of hashMap) {
    if (list.length < 2) continue;
    for (const d of list) {
      out.push(
        finding({
          workspaceId: ws,
          batchId,
          documentId: d.id,
          severity: "error",
          category: "duplicidade",
          code: "DUP_XML_HASH",
          title: "Conteúdo XML idêntico (SHA-256)",
          description: `Hash ${hash.slice(0, 12)}… repetido ${list.length}x.`,
          evidence: { xmlHash: hash, files: list.map((x) => x.fileName) },
          recommendation: "Remova cópias byte-a-byte do lote.",
        }),
      );
    }
  }

  for (const d of documents) {
    if (d.documentType !== "NFSE" && !d.accessKey) {
      out.push(
        finding({
          workspaceId: ws,
          batchId,
          documentId: d.id,
          severity: "warning",
          category: "identificacao",
          code: "NO_ACCESS_KEY",
          title: "Documento sem chave de acesso",
          description: `${d.fileName} não possui chave identificada.`,
          recommendation: "Verifique se o XML está completo (nfeProc/cteProc).",
        }),
      );
    }

    if ((d.documentType === "NFE" || d.documentType === "CTE") && !d.protocol) {
      out.push(
        finding({
          workspaceId: ws,
          batchId,
          documentId: d.id,
          severity: "info",
          category: "protocolo",
          code: "NO_PROTOCOL",
          title: "Sem protocolo de autorização",
          description: `Documento ${d.number || d.fileName} sem nProt.`,
          recommendation: "Confirme se o XML inclui protNFe/protCTe.",
        }),
      );
    }

    if (!isValidCnpjOrCpfFormat(d.emitterDoc)) {
      out.push(
        finding({
          workspaceId: ws,
          batchId,
          documentId: d.id,
          severity: "warning",
          category: "cadastro",
          code: "INVALID_EMITTER_DOC",
          title: "CNPJ/CPF do emitente com formato inválido",
          description: `Valor: ${d.emitterDoc}`,
          recommendation: "Revise o cadastro do emitente no XML.",
        }),
      );
    }

    if (d.receiverDoc && !isValidCnpjOrCpfFormat(d.receiverDoc)) {
      out.push(
        finding({
          workspaceId: ws,
          batchId,
          documentId: d.id,
          severity: "warning",
          category: "cadastro",
          code: "INVALID_RECEIVER_DOC",
          title: "CNPJ/CPF do destinatário com formato inválido",
          description: `Valor: ${d.receiverDoc}`,
        }),
      );
    }

    if (d.totalValue === 0) {
      out.push(
        finding({
          workspaceId: ws,
          batchId,
          documentId: d.id,
          severity: "info",
          category: "valores",
          code: "ZERO_TOTAL",
          title: "Valor total zerado",
          description: "Documento com total_value = 0.",
        }),
      );
    }

    if (d.totalValue !== undefined && d.totalValue < 0) {
      out.push(
        finding({
          workspaceId: ws,
          batchId,
          documentId: d.id,
          severity: "error",
          category: "valores",
          code: "NEGATIVE_TOTAL",
          title: "Valor total negativo",
          description: `total_value=${d.totalValue}`,
          recommendation: "Investigar XML ou parse incorreto.",
        }),
      );
    }

    if (batch.month && batch.year && d.issueDate) {
      const dt = new Date(d.issueDate);
      if (
        !Number.isNaN(dt.getTime()) &&
        (dt.getUTCMonth() + 1 !== batch.month || dt.getUTCFullYear() !== batch.year)
      ) {
        out.push(
          finding({
            workspaceId: ws,
            batchId,
            documentId: d.id,
            severity: "warning",
            category: "periodo",
            code: "OUTSIDE_PERIOD",
            title: "Emissão fora do mês/ano do lote",
            description: `issue_date=${d.issueDate}; lote=${batch.month}/${batch.year}`,
          }),
        );
      }
    }

    // Item sum divergence (NFE)
    if (d.documentType === "NFE") {
      const docItems = items.filter((i) => i.documentId === d.id);
      if (docItems.length && d.totalValue !== undefined) {
        const sum = docItems.reduce((a, i) => a + (i.totalValue || 0), 0);
        const ref = d.productsValue ?? d.totalValue;
        if (Math.abs(sum - ref) > 0.5) {
          out.push(
            finding({
              workspaceId: ws,
              batchId,
              documentId: d.id,
              severity: "warning",
              category: "valores",
              code: "ITEM_SUM_DIVERGENCE",
              title: "Soma dos itens diverge do total",
              description: `soma_itens=${sum.toFixed(2)} vs ref=${ref.toFixed(2)}`,
              evidence: { sum, ref, itemCount: docItems.length },
              recommendation: "Pode ser frete/desconto/IPI — revisar totais.",
            }),
          );
        }
      }
    }

    if (d.parseStatus === "error") {
      out.push(
        finding({
          workspaceId: ws,
          batchId,
          documentId: d.id,
          severity: "error",
          category: "parse",
          code: "PARSE_ERROR",
          title: "Falha no parse do XML",
          description: d.parseErrors.join("; ") || "erro desconhecido",
        }),
      );
    }
  }

  for (const item of items) {
    if (item.documentType !== "NFE") continue;
    if (!item.ncm) {
      out.push(
        finding({
          workspaceId: ws,
          batchId,
          documentId: item.documentId,
          itemId: item.id,
          severity: "info",
          category: "itens",
          code: "ITEM_NO_NCM",
          title: "Item sem NCM",
          description: `Item #${item.itemNumber}: ${item.description || item.code || "—"}`,
        }),
      );
    }
    if (!item.cfop) {
      out.push(
        finding({
          workspaceId: ws,
          batchId,
          documentId: item.documentId,
          itemId: item.id,
          severity: "info",
          category: "itens",
          code: "ITEM_NO_CFOP",
          title: "Item sem CFOP",
          description: `Item #${item.itemNumber}`,
        }),
      );
    }
    if (!item.description) {
      out.push(
        finding({
          workspaceId: ws,
          batchId,
          documentId: item.documentId,
          itemId: item.id,
          severity: "info",
          category: "itens",
          code: "ITEM_NO_DESCRIPTION",
          title: "Item sem descrição",
          description: `Item #${item.itemNumber}`,
        }),
      );
    }
    if (!item.unit) {
      out.push(
        finding({
          workspaceId: ws,
          batchId,
          documentId: item.documentId,
          itemId: item.id,
          severity: "info",
          category: "itens",
          code: "ITEM_NO_UNIT",
          title: "Item sem unidade",
          description: `Item #${item.itemNumber}`,
        }),
      );
    }
  }

  // CT-e without linked NF key in items
  for (const d of documents.filter((x) => x.documentType === "CTE")) {
    const linked = items.filter((i) => i.documentId === d.id);
    const hasNfeKey = linked.some((i) => (i.code || "").length >= 44 || (i.description || "").includes("NF-e"));
    if (!hasNfeKey) {
      out.push(
        finding({
          workspaceId: ws,
          batchId,
          documentId: d.id,
          severity: "warning",
          category: "relacionamento",
          code: "CTE_NO_NFE_LINK",
          title: "CT-e sem NF-e vinculada evidente",
          description: "Não foi encontrada chave/documento vinculado em infDoc.",
          recommendation: "Verificar infNFe/infNF no XML do CT-e.",
        }),
      );
    }
  }

  return out;
}

export function severityRank(s: FindingSeverity): number {
  return { info: 1, warning: 2, error: 3, critical: 4 }[s];
}
