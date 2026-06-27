import * as pdfjsLib from "./src/node_modules/pdfjs-dist/legacy/build/pdf.mjs";
import * as fs from "fs";
import * as path from "path";

async function extractPdfText(filePath) {
  console.log(`\n========== 提取 ${filePath} ==========`);
  
  try {
    const fileData = fs.readFileSync(filePath);
    const data = new Uint8Array(fileData);
    
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    console.log(`总页数: ${pdf.numPages}`);
    
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join("");
      fullText += pageText + "\n";
      console.log(`\n--- 第 ${i} 页 ---`);
      console.log(pageText);
    }
    
    const trimmedLength = fullText.replace(/\s/g, "").length;
    console.log(`\n总文本字符数（去除空格）: ${trimmedLength}`);
    return fullText;
  } catch (err) {
    console.error("提取失败:", err.message);
  }
}

const notesDir = "notes";
const files = fs.readdirSync(notesDir)
  .filter(f => f.endsWith(".pdf"))
  .map(f => path.join(notesDir, f));

for (const file of files) {
  await extractPdfText(file);
}
