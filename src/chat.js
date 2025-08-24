import 'dotenv/config';
import readline from 'node:readline';
import { qdrant, embedText, chatWithOllama } from './clients.js';

const COLLECTION = process.env.COLLECTION || 'kb_local';
const TOP_K = Number(process.env.TOP_K || 5);

async function retrieve(query) {
  const qVec = await embedText(query, 'query');
  const res = await qdrant.search(COLLECTION, {
    vector: qVec,
    limit: TOP_K,
    with_payload: true
  });
  return res; // array of points
}

function buildContext(points) {
  return points.map((p, idx) => {
    const meta = p.payload || {};
    const header = `[${idx + 1}] ${meta.title || meta.doc_id || 'untitled'} (${meta.url || 'no-url'})`;
    const body = meta.text ? meta.text.slice(0, 1000) : '';
    return `${header}\n${body}`;
  }).join('\n\n---\n\n');
}

async function answer(query) {
  const hits = await retrieve(query);
  const context = buildContext(hits);

  const sys = `Kamu adalah asisten yang menjawab berbasis konteks.
- Jawab ringkas, akurat, dan kutip sumber dengan format [#] sesuai indeks dokumen.
- Jika jawaban tidak ditemukan di konteks, katakan tidak ada di basis pengetahuan.`;

  const userMsg = `Pertanyaan: ${query}

Konteks:
${context}`;

  const messages = [
    { role: 'system', content: sys },
    { role: 'user', content: userMsg }
  ];

  process.stdout.write('\nJawaban: ');
  for await (const chunk of chatWithOllama(messages)) {
    process.stdout.write(chunk);
  }
  process.stdout.write('\n');
}

function prompt() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('Tanya apa? ', async (q) => {
    rl.close();
    await answer(q.trim());
  });
}

const argQ = process.argv.slice(2).join(' ').trim();
if (argQ) {
  await answer(argQ);
} else {
  prompt();
}
