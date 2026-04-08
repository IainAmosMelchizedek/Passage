import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const MIN_USEFUL_TEXT = 200;

export async function processPDF(file) {
  const arrayBuffer = await file.arrayBuffer();

  // Try pdf.js text extraction first
  try {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pageTexts = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pageTexts.push(content.items.map(item => item.str).join(" "));
    }
    const extracted = pageTexts.join("\n").trim();
    if (extracted.length >= MIN_USEFUL_TEXT) {
      return { mode: "text", content: extracted };
    }
  } catch (e) {
    console.warn("pdf.js extraction failed, falling back to base64:", e);
  }

  // Fall back to base64 — use FileReader on the original file directly
  const b64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  return { mode: "base64", content: b64 };
}
