# ICABOT RAG-JS (Retrieval Augmented Generation dengan Ollama + Qdrant)

Proyek sederhana untuk membangun **RAG (Retrieval Augmented Generation)** menggunakan **JavaScript**, dengan integrasi:

- [Ollama](https://ollama.com/) → LLM & Embeddings (model: `llama3.2` + `nomic-embed-text`)  
- [Qdrant](https://qdrant.tech/) → Vector Database untuk menyimpan dan mencari dokumen  

---

## 📂 Struktur Proyek
```

rag-js/
├─ docker-compose.yml   # setup Ollama & Qdrant
├─ package.json
├─ .env
├─ seed/
│  └─ documents.json    # sumber data (contoh)
└─ src/
├─ clients.js        # klien untuk Qdrant & Ollama
├─ ingest.js         # script indexing (data → vector → Qdrant)
└─ chat.js           # CLI untuk bertanya (query → RAG → jawaban)

````

---

## 🚀 Persiapan

### 1. Start server Qdrant dan Ollama
```bash

# pull dan jalankan model Ollama
ollama pull llama3.2:1b

ollama serve

# extract dan run qdrant file 

run qdrant.exe
````

### 2. Install dependencies

```bash
npm install
```

### 3. Konfigurasi `.env`

```env
QDRANT_URL=http://127.0.0.1:6333
OLLAMA_HOST=http://localhost:11434
COLLECTION=kb_local
EMBED_MODEL=nomic-embed-text
GENERATE_MODEL=llama3.2:3b
TOP_K=5
MAX_TOKENS=512
TEMPERATURE=0.7
```

---

## 📥 Ingest Data (Indexing)

File contoh: `seed/documents.json`

Jalankan:

```bash
npm run ingest
```

Akan membuat koleksi di Qdrant (`kb_local`) dan menyimpan chunk dokumen dalam bentuk vektor 768-dimensi.

---

## 💬 Chat (RAG)

### Cara 1: Interactive CLI

```bash
npm run chat
```

Lalu ketik pertanyaan, misalnya:

```
Tanya apa? Apa itu RAG?
```

### Cara 2: Langsung lewat argumen

```bash
node src/chat.js "Jelaskan cara kerja Qdrant"
```

Output akan berupa jawaban LLM (`llama3.2`) dengan konteks dari dokumen yang sudah di-index.

---

## 📝 Catatan

* **Embedding model**: `nomic-embed-text` → menghasilkan vektor berukuran 768.
* **Distance metric**: gunakan `Cosine` saat membuat koleksi di Qdrant.
* Proyek ini menggunakan **JavaScript murni (ESM)** tanpa TypeScript.
* Data dokumen dapat diperluas sesuai kebutuhan (`title`, `url`, `tags`, dll).

---

