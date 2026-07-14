/**
 * Client-side PDF text extraction (pdf.js). Worker loaded from /public.
 */
export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  const pdf = await task.promise;
  const parts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageParts: string[] = [];
    let lastY: number | null = null;
    for (const item of content.items) {
      if (!("str" in item) || !item.str) continue;
      const y =
        "transform" in item && Array.isArray(item.transform)
          ? Number(item.transform[5])
          : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
        pageParts.push("\n");
      } else if (pageParts.length && !pageParts[pageParts.length - 1].endsWith("\n")) {
        pageParts.push(" ");
      }
      pageParts.push(String(item.str));
      if (y !== null) lastY = y;
    }
    parts.push(pageParts.join(""));
  }

  return parts.join("\n");
}
