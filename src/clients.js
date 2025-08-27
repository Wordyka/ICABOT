import 'dotenv/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import ollama from 'ollama';

// Qdrant connection
export const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
});

export async function embedText(input, mode = 'document') {
  const prefixed =
    mode === 'query' ? `search_query: ${input}` : `search_document: ${input}`;

  const res = await ollama.embed({
    model: process.env.EMBED_MODEL,
    input: prefixed,
  });

  const vector = Array.isArray(res.embeddings)
    ? res.embeddings[0]
    : res.embedding;

  return vector;
}

export async function* chatWithOllama(messages) {
  const stream = await ollama.chat({
    model: process.env.GENERATE_MODEL,
    messages,
    stream: true,
    options: {
      temperature: Number(process.env.TEMPERATURE) || 0.7,
      num_predict: Number(process.env.MAX_TOKENS) || 256,
    },
  });

  for await (const part of stream) {
    yield part.message?.content ?? '';
  }
}