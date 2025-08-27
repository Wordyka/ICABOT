import 'dotenv/config';
import readline from 'node:readline';
import { qdrant, embedText, chatWithOllama } from './clients.js';

const COLLECTION = process.env.COLLECTION || 'kb_local';
const TOP_K = Number(process.env.TOP_K || 3);
let chatHistory = [
  {
    role: 'system',
    content: `Kamu adalah asisten yang hanya boleh menjawab berdasarkan konteks. Jawab dengan detail (maks 8-10 baris), gunakan bullet bila perlu
- Jika tidak ada jawaban di konteks, katakan: "Tidak ada di basis pengetahuan".
- Jangan menambahkan informasi lain di luar konteks.`
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

function buildContext(points) {
  return points.map((p, idx) => {
    const meta = p.payload || {};
    const header = `[${idx + 1}] ${meta.title || meta.doc_id || 'untitled'} (${meta.url || 'no-url'})`;
    const body = meta.text ? meta.text.slice(0, 500) : '';
    return `${header}\n${body}`;
  }).join('\n\n---\n\n');
}

async function answer(query) {
  const hits = await retrieve(query);
  const context = buildContext(hits);

  const userMsg = `Pertanyaan: ${query}

Konteks:
${context}`;

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
