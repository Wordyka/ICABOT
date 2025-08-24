import 'dotenv/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import ollama from 'ollama';

export const qdrant = new QdrantClient({ url: process.env.QDRANT_URL });

// Helper: panggil embedding via Ollama
export async function embedText(input, mode = 'document') {
  // Rekomendasi prefix dari Nomic: gunakan "search_document:" saat indexing dan "search_query:" saat querying
  // untuk penyelarasan embedding. 
  const prefixed = mode === 'query' ? `search_query: ${input}` : `search_document: ${input}`;
  const res = await ollama.embed({
    model: process.env.EMBED_MODEL,
    input: prefixed
  });
  // API mengembalikan { embeddings: number[][] } atau { embedding: number[] } tergantung jumlah input.
  const vector = Array.isArray(res.embeddings) ? res.embeddings[0] : res.embedding;
  return vector;
}

// Helper: panggil chat via Ollama (stream)
export async function* chatWithOllama(messages) {
  const stream = await ollama.chat({
    model: process.env.GENERATE_MODEL,
    messages,
    stream: true
  });
  for await (const part of stream) {
    yield part.message?.content ?? '';
  }
}
