import 'dotenv/config';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { qdrant, embedText } from './clients.js';

const COLLECTION = process.env.COLLECTION || 'kb_local';
const VECTOR_SIZE = 768; // nomic-embed-text = 768 dimensi
const DISTANCE = 'Cosine'; // ideal untuk text embeddings

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
    const chunks = chunkText(doc.text, 900);
    for (let i = 0; i < chunks.length; i++) {
      const text = chunks[i];
      const vector = await embedText(text, 'document');
      points.push({
        id: randomUUID(),
        vector,
        payload: {
          doc_id: doc.id,
          title: doc.title,
          url: doc.url,
          tags: doc.tags,
          chunk_index: i,
          text
        }
      });
    }
  }

  // Upsert batch
  console.log(`Mengirim ${points.length} chunk ke Qdrant ...`);
  await qdrant.upsert(COLLECTION, { points });
  console.log('Selesai ingest.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
