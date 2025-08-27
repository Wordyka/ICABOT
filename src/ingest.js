import 'dotenv/config';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { qdrant, embedText } from './clients.js';

const COLLECTION = process.env.COLLECTION || 'kb_local';
const VECTOR_SIZE = 768; // nomic-embed-text = 768 dimensi
//const VECTOR_SIZE = 1024; // snowflake-arctic-embed = 1024 dimensi
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
    // cek koleksi; jika tidak ada, create
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

  const raw = await fs.readFile(new URL('../seed/documents.json', import.meta.url), 'utf-8');
  const docs = JSON.parse(raw);

  const points = [];
for (const doc of docs) {
  const text = `
  Tanggal: ${doc.tanggal}
  Aplikasi: ${doc.app_name}
  Issue: ${doc.text}
  Status: ${doc.status}
  Endpoint: ${doc.endpoint}
  `;

  const chunks = chunkText(text, 900);
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const vector = await embedText(chunk, 'document');
    points.push({
      id: randomUUID(),
      vector,
      payload: {
        tanggal: doc.tanggal,
        app: doc.app,
        issue: doc.issue,
        cause: doc.cause,
        solution: doc.solution,
        chunk_index: i,
        text: chunk
      }
    });
  }
}

  console.log(`Mengirim ${points.length} chunk ke Qdrant ...`);
  await qdrant.upsert(COLLECTION, { points });
  console.log('Selesai ingest.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
