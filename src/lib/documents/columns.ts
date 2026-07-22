export type DocumentColumnId =
  | "select"
  | "type"
  | "number"
  | "series"
  | "model"
  | "issueDate"
  | "emitter"
  | "receiver"
  | "ufOrigin"
  | "ufDest"
  | "nature"
  | "cfop"
  | "value"
  | "status"
  | "protocol"
  | "duplicate"
  | "parse"
  | "quality"
  | "cbs"
  | "ibs"
  | "actions";

export type DocumentColumnDef = {
  id: DocumentColumnId;
  label: string;
  defaultVisible: boolean;
  /** Cannot hide when this is the last identity column with select. */
  identity?: boolean;
  align?: "left" | "right";
  minWidth?: number;
};

export const DOCUMENT_COLUMNS: DocumentColumnDef[] = [
  { id: "select", label: "Seleção", defaultVisible: true, minWidth: 44 },
  { id: "type", label: "Tipo", defaultVisible: true, identity: true, minWidth: 72 },
  { id: "number", label: "Número", defaultVisible: true, identity: true, minWidth: 88 },
  { id: "series", label: "Série", defaultVisible: true, minWidth: 56 },
  { id: "model", label: "Modelo", defaultVisible: false, minWidth: 64 },
  { id: "issueDate", label: "Emissão", defaultVisible: true, minWidth: 120 },
  { id: "emitter", label: "Emitente", defaultVisible: true, minWidth: 160 },
  { id: "receiver", label: "Destinatário", defaultVisible: true, minWidth: 160 },
  { id: "ufOrigin", label: "UF origem", defaultVisible: true, minWidth: 72 },
  { id: "ufDest", label: "UF destino", defaultVisible: true, minWidth: 72 },
  { id: "nature", label: "Natureza", defaultVisible: false, minWidth: 140 },
  { id: "cfop", label: "CFOP", defaultVisible: true, minWidth: 64 },
  { id: "value", label: "Valor", defaultVisible: true, align: "right", minWidth: 110 },
  { id: "status", label: "Situação", defaultVisible: true, minWidth: 88 },
  { id: "protocol", label: "Protocolo", defaultVisible: false, minWidth: 100 },
  { id: "duplicate", label: "Duplicidade", defaultVisible: true, minWidth: 88 },
  { id: "parse", label: "Parse", defaultVisible: true, minWidth: 72 },
  { id: "quality", label: "Qualidade", defaultVisible: true, minWidth: 88 },
  { id: "cbs", label: "CBS", defaultVisible: true, minWidth: 100 },
  { id: "ibs", label: "IBS", defaultVisible: false, minWidth: 100 },
  { id: "actions", label: "Ações", defaultVisible: true, minWidth: 72 },
];

const STORAGE_KEY = "xfi:document-columns:v1";

export function defaultVisibleColumns(): Set<DocumentColumnId> {
  return new Set(DOCUMENT_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.id));
}

export function loadVisibleColumns(): Set<DocumentColumnId> {
  if (typeof window === "undefined") return defaultVisibleColumns();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultVisibleColumns();
    const parsed = JSON.parse(raw) as string[];
    const allowed = new Set(DOCUMENT_COLUMNS.map((c) => c.id));
    const next = new Set<DocumentColumnId>();
    for (const id of parsed) {
      if (allowed.has(id as DocumentColumnId)) next.add(id as DocumentColumnId);
    }
    // Always keep select
    next.add("select");
    if (!ensureIdentityVisible(next)) {
      next.add("number");
      next.add("type");
    }
    return next;
  } catch {
    return defaultVisibleColumns();
  }
}

export function saveVisibleColumns(visible: Set<DocumentColumnId>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...visible]));
}

/** Select + at least one identity column must remain visible. */
export function ensureIdentityVisible(visible: Set<DocumentColumnId>): boolean {
  if (!visible.has("select")) return false;
  return DOCUMENT_COLUMNS.some((c) => c.identity && visible.has(c.id));
}

export function toggleColumnVisibility(
  visible: Set<DocumentColumnId>,
  id: DocumentColumnId,
): Set<DocumentColumnId> {
  const next = new Set(visible);
  if (id === "select") return next; // never hide select
  if (next.has(id)) {
    next.delete(id);
    if (!ensureIdentityVisible(next)) {
      // revert
      next.add(id);
    }
  } else {
    next.add(id);
  }
  return next;
}
