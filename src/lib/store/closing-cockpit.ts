/**
 * Closing cockpit — IndexedDB persistence (local-first).
 */

import type { ClosingPeriodCard, ClosingCell } from "@/modules/obligations/core/workflows/closing";
import { emptyCell } from "@/modules/obligations/core/workflows/closing";
import type { ObligationId } from "@/modules/obligations/core/registry/ids";
import { OBLIGATION_IDS } from "@/modules/obligations/core/registry/ids";
import type { ClosingCellStatus } from "@/modules/obligations/core/maturity";

const DB = "xfi_closing_v1";
const STORE = "period_cards";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" });
        os.createIndex("by_workspace", "workspaceId", { unique: false });
        os.createIndex("by_period", "periodKey", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function listClosingCards(workspaceId?: string): Promise<ClosingPeriodCard[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      let rows = (req.result || []) as ClosingPeriodCard[];
      if (workspaceId) rows = rows.filter((r) => r.workspaceId === workspaceId);
      rows.sort((a, b) => b.periodKey.localeCompare(a.periodKey));
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getClosingCard(id: string): Promise<ClosingPeriodCard | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as ClosingPeriodCard) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveClosingCard(card: ClosingPeriodCard): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put({ ...card, updatedAt: new Date().toISOString() });
  await txDone(tx);
}

export async function ensureClosingCard(input: {
  workspaceId: string;
  companyId: string;
  companyLabel: string;
  establishmentId: string;
  establishmentLabel: string;
  periodKey: string;
  periodKind: "monthly" | "annual";
  obligations?: ObligationId[];
}): Promise<ClosingPeriodCard> {
  const id = `${input.workspaceId}:${input.establishmentId}:${input.periodKey}`;
  const existing = await getClosingCard(id);
  if (existing) return existing;
  const ids = input.obligations || OBLIGATION_IDS;
  const cells: ClosingPeriodCard["cells"] = {};
  for (const oid of ids) cells[oid] = emptyCell(oid);
  const now = new Date().toISOString();
  const card: ClosingPeriodCard = {
    id,
    workspaceId: input.workspaceId,
    companyId: input.companyId,
    companyLabel: input.companyLabel,
    establishmentId: input.establishmentId,
    establishmentLabel: input.establishmentLabel,
    periodKey: input.periodKey,
    periodKind: input.periodKind,
    cells,
    createdAt: now,
    updatedAt: now,
  };
  await saveClosingCard(card);
  return card;
}

export async function patchClosingCell(
  cardId: string,
  obligationId: ObligationId,
  patch: Partial<ClosingCell> & { status?: ClosingCellStatus },
): Promise<ClosingPeriodCard | null> {
  const card = await getClosingCard(cardId);
  if (!card) return null;
  const prev = card.cells[obligationId] || emptyCell(obligationId);
  card.cells[obligationId] = {
    ...prev,
    ...patch,
    obligationId,
    comments: patch.comments ?? prev.comments,
    checklist: patch.checklist ?? prev.checklist,
    updatedAt: new Date().toISOString(),
  };
  await saveClosingCard(card);
  return card;
}
