import 'dotenv/config';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { qdrant, embedText } from './clients.js';
import * as XLSX from 'xlsx';
//npm install xlsx

const COLLECTION = process.env.COLLECTION || 'kb_local';
const VECTOR_SIZE = 768; 
const DISTANCE = 'Cosine';

function chunkText(text, maxChars = 800) {
  const paragraphs = text.split(/\n{2,}/g);
  const chunks = [];
  let buf = '';
  for (const p of paragraphs) {
    if ((buf + '\n\n' + p).length > maxChars) {
      if (buf.trim()) chunks.push(buf.trim());
      buf = p;
    } else {
      buf = buf ? buf + '\n\n' + p : p;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

async function ensureCollection() {
  try {
    await qdrant.getCollection(COLLECTION);
    console.log(`Collection "${COLLECTION}" sudah ada.`);
  } catch {
    console.log(`Membuat collection "${COLLECTION}" ...`);
    await qdrant.createCollection(COLLECTION, {
      vectors: { size: VECTOR_SIZE, distance: DISTANCE }
    });
    console.log(`Collection "${COLLECTION}" dibuat.`);
  }
}

async function main() {
  await ensureCollection();
  const buffer = await fs.readFile(new URL('../seed/POTENSI-INCIDENT-2025_POTENSI-INCIDENT-2025_.xlsx', import.meta.url));
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const docs = XLSX.utils.sheet_to_json(sheet); 
  const points = [];

  for (const doc of docs) {
    const text = Object.entries(doc)
      .map(([key, val]) => `${key}: ${val}`)
      .join('\n');

    const chunks = chunkText(text, 900);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const vector = await embedText(chunk, 'document');
      points.push({
        vector,
        payload: {
          ...doc,  
          text: chunk
        }
      });
    }
  }

  console.log(`Mengirim ${points.length} chunk ke Qdrant ...`);
  await qdrant.upsert(COLLECTION, { points });
  console.log('Selesai ingest Excel');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
