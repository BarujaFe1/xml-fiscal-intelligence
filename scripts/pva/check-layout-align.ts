import { readFileSync, readdirSync } from "fs";
import path from "path";
import { RECORDS } from "@/modules/obligations/efd-icms-ipi/layouts/020";

const dir = path.join(process.cwd(), "docs", "pva", "2026-06", "generation-2");
const files = readdirSync(dir).filter((f) => f.startsWith("efd-") && f.endsWith(".txt"));

const isDigits = (s: string) => /^\d+$/.test(s);
const isNum = (s: string) => s === "" || /^[\d.,-]+$/.test(s);

function checkName(name: string, value: string): string | null {
  const v = value.trim();
  if (name === "COD_VER") return v === "020" ? null : `COD_VER='${v}'`;
  if (name === "COD_FIN") return v === "0" || v === "1" ? null : `COD_FIN='${v}'`;
  if (/CNPJ/.test(name)) return v === "" || (isDigits(v) && v.length === 14) ? null : `CNPJ='${v}'`;
  if (name === "UF") return /^[A-Z]{2}$/.test(v) ? null : `UF='${v}'`;
  if (name === "IE") return v === "" || isDigits(v) ? null : `IE='${v}'`;
  if (/COD_MUN/.test(name)) return v === "" || (isDigits(v) && v.length === 7) ? null : `COD_MUN='${v}'`;
  if (/^DT/.test(name) || name === "DT_VCTO") return v === "" || (isDigits(v) && v.length === 8) ? null : `DATE('${v}')`;
  if (/^IND_/.test(name)) {
    if (name === "IND_PGTO" || name === "IND_FRT")
      return ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].includes(v) ? null : `IND('${v}')`;
    if (name === "IND_PERFIL") return v === "" || ["A", "B", "C", "0", "1"].includes(v) ? null : `IND('${v}')`;
    if (/^IND_APUR/.test(name)) return v === "" || ["S", "N", "0", "1"].includes(v) ? null : `IND('${v}')`;
    if (name === "IND_PROC") return v === "" || /^[0-9]$/.test(v) ? null : `IND('${v}')`;
    return v === "" || v === "0" || v === "1" ? null : `IND('${v}')`;
  }
  if (name === "CFOP") return v === "" || (isDigits(v) && v.length === 4) ? null : `CFOP='${v}'`;
  if (/^CST/.test(name)) {
    // PIS/COFINS/IPI CST são de 2 dígitos; ICMS é de 3. Aceita 2 ou 3.
    return v === "" || (isDigits(v) && (v.length === 2 || v.length === 3)) ? null : `CST='${v}'`;
  }
  if (/VL_|ALIQ|VL_ABAT|VL_MERC/.test(name)) return isNum(v) ? null : `NUM('${v}')`;
  if (/COD_MOD/.test(name)) return v === "" || (isDigits(v) && v.length === 2) ? null : `COD_MOD='${v}'`;
  if (/COD_SIT/.test(name)) return v === "" || (isDigits(v) && v.length === 2) ? null : `COD_SIT='${v}'`;
  if (name === "COD_PAIS") return v === "" || (isDigits(v) && v.length === 4) ? null : `COD_PAIS='${v}'`;
  if (name === "CHV_NFE") return v === "" || (isDigits(v) && v.length === 44) ? null : `CHV='${v}'`;
  if (/EMAIL/.test(name)) return v === "" || v.includes("@") ? null : `EMAIL('${v}')`;
  if (/COD_VER|COD_FIN|IND_PERFIL|IND_ATIV/.test(name)) return null;
  return null;
}

const issues: Record<string, number> = {};
let checked = 0;

for (const f of files) {
  const lines = readFileSync(path.join(dir, f), "utf8").split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    const parts = line.split("|"); // ["", REG, f1, ..., ""]
    const code = parts[1];
    const def = RECORDS[code];
    if (!def) continue;
    const vals = parts.slice(2, parts.length - 1); // drop leading "" and trailing ""; vals[0] = posição 2
    for (let i = 0; i < def.fields.length; i++) {
      const fdef = def.fields[i];
      const val = vals[i - 1] ?? ""; // def.fields[i].position = i+1 → valor em vals[i-1]
      checked++;
      const bad = checkName(fdef.name, val);
      if (bad) {
        const key = `${code}.${fdef.name}(pos${fdef.position}): ${bad}`;
        issues[key] = (issues[key] ?? 0) + 1;
      }
    }
  }
}

console.log("FIELDS CHECKED:", checked);
const keys = Object.keys(issues);
console.log("MISMATCHES:", keys.length);
for (const k of keys.sort()) console.log(`  ${issues[k]}x  ${k}`);
