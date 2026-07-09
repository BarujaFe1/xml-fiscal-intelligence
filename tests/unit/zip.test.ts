import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { extractXmlFromZip } from "@/lib/zip/extract";

describe("extractXmlFromZip", () => {
  it("extracts xml and blocks dangerous / non-xml files", async () => {
    const zip = new JSZip();
    zip.file("ok/nfe.xml", "<NFe><infNFe/></NFe>");
    zip.file("malware.exe", "MZ");
    zip.file("readme.txt", "ignore");
    // Absolute-like / traversal-ish names that survive packaging
    zip.file("nested/../../escape.xml", "<bad/>");
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const result = await extractXmlFromZip(buffer);
    expect(result.xmlFiles.some((f) => f.fileName === "nfe.xml")).toBe(true);
    expect(result.skipped.some((s) => s.reason === "dangerous_extension")).toBe(true);
    expect(result.skipped.some((s) => s.reason === "not_xml")).toBe(true);
    // Either blocked as zip slip or normalized away from nested traversal
    const escaped = result.xmlFiles.find((f) => f.fileName === "escape.xml");
    if (escaped) {
      // If JSZip flattened the path, ensure we still only accepted safe relative xmls
      expect(escaped.path.includes("..")).toBe(false);
    } else {
      expect(result.skipped.some((s) => s.reason === "zip_slip_blocked")).toBe(true);
    }
  });
});
