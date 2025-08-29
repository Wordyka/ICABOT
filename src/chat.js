import 'dotenv/config';
import readline from 'node:readline';
import { qdrant, embedText, chatWithOllama } from './clients.js';

const COLLECTION = process.env.COLLECTION || 'kb_local';
const TOP_K = Number(process.env.TOP_K || 3);
let chatHistory = [
  {
    role: 'system',
    content: `Kamu adalah asisten yang menjawab berbasis konteks.
- Jawab ringkas, akurat, dan kutip sumber dengan format [#] sesuai indeks dokumen.
- Jika jawaban tidak ditemukan di konteks, katakan tidak ada di basis pengetahuan.`
  }
];

const queryCache = new Map();

async function warmUp() {
  console.log("Startup loading");
  await embedText("Startup", 'query');
  await chatWithOllama([{ role: 'system', content: 'Starting up' }]);
  console.log("Startup loading complete\n");
}

async function retrieve(query) {
  let qVec;
  if (queryCache.has(query)) {
    qVec = queryCache.get(query);
  } else {
    qVec = await embedText(query, 'query');
    queryCache.set(query, qVec);
  }

  const res = await qdrant.search(COLLECTION, {
    vector: qVec,
    limit: TOP_K,
    with_payload: true
  });

  return res;
}

/* function buildContext(points) {
  return points.map((p) => {
    const meta = p.payload || {};
    return `Tanggal: ${meta.tanggal}
    Aplikasi: ${meta.app}
    Issue: ${meta.issue}
    Penyebab: ${meta.cause}
    Solusi: ${meta.solution}`;
  }).join('\n\n---\n\n');
} */

function buildContext(points) {
  return points.map((p) => {
    const meta = p.payload || {};
    const fields = Object.entries(meta)
      .filter(([k]) => k !== 'text')
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    return fields;
  }).join('\n\n---\n\n');
}


async function answer(query) {
  const hits = await retrieve(query);
  const context = buildContext(hits);

  const userMsg = `
  Pertanyaan pengguna: "${query}"

  Jawablah hanya berdasarkan konteks berikut:
  ${context}

  Penting:
  - Jika jawaban tidak ada di konteks, katakan persis: "Tidak ada di basis pengetahuan".
  - Jangan menambahkan nomor, indeks, atau informasi lain di luar konteks.
  `;


  // chatHistory -> untuk chatbot tetap tahu konteks percakapan sebelum sebelumnya
  chatHistory.push({ role: 'user', content: userMsg });

  // Jika hanya mau disimpan 3 chat terakhir tiap chat
  // const messages = [chatHistory[0], ...chatHistory.slice(-3)];
  const messages = chatHistory;

  process.stdout.write('\nJawaban: ');
  let answerText = '';
  for await (const chunk of chatWithOllama(messages)) {
    process.stdout.write(chunk);
    answerText += chunk;
  }

  chatHistory.push({ role: 'assistant', content: answerText });
  process.stdout.write('\n');
}

function prompt() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  async function ask() {
    rl.question('Tanya apa? ', async (q) => {
      if (q.trim().toLowerCase() === 'thankyou') {
        console.log("Chat Ended");
        rl.close();
        return;
      }
      await answer(q.trim());
      ask();
    });
  }

  ask();
}

(async () => {
  await warmUp();

  const argQ = process.argv.slice(2).join(' ').trim();
  if (argQ) {
    await answer(argQ);
    process.exit(0);
  } else {
    prompt();
  }
})();
