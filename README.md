# Infinity Intelligence: Advanced Document RAG Platform

## Overview
Infinity Intelligence is a production-grade, high-performance Retrieval-Augmented Generation (RAG) system. It transforms private documents into a fluid, conversational knowledge base powered by the **'Infinity' AI Persona**. The platform leverages Groq Cloud for ultra-fast inference and Unstructured.io for lightning-quick ingestion.

## Key Capabilities

### 1. The 'Infinity' Persona
*   **Natural Intelligence**: Moves beyond robotic RAG responses. Infinity speaks like a human expert, integrating document facts seamlessly into sophisticated dialogue.
*   **Contextual Mastery**: Advanced history handling ensures the "flow" of deep conversations is never lost.
*   **Citation Etiquette**: Intelligently balances natural language with source references, citing document names only when they add essential weight to the insight.

### 2. High-Performance Architecture
*   **Ultra-Fast Ingestion**: Implements the "Fast" parsing strategy, reducing document processing time from minutes to seconds.
*   **Local-Cloud Hybrid**: Combines local `SentenceTransformers` for embedding privacy with `Groq Cloud` for state-of-the-art LLM inference.
*   **Vector Excellence**: Qdrant-powered similarity search with strict per-user data isolation.

### 3. Premium User Experience
*   **Holographic Design**: A stunning Next.js 14+ interface featuring animated mesh gradients, glassmorphism, and a responsive mobile-first layout.
*   **Neural Audio Bridge**: Optimized Text-to-Speech (TTS) for Chrome with "Priming" mechanisms to bypass strict autoplay policies.
*   **Real-time Stability**: WebSocket connection management with exponential backoff and localized token synchronization.

## Technical Architecture

### Backend Stack
*   **Core**: FastAPI (Python 3.10+)
*   **AI Inference**: Groq API (Llama-3 models)
*   **Embeddings**: Sentence-Transformers (all-MiniLM-L6-v2)
*   **Databases**: MongoDB (Metadata), Qdrant (Vector Store)

### Frontend Stack
*   **Framework**: Next.js 14 (App Router)
*   **Styling**: Vanilla CSS with Glassmorphism & Ant Design
*   **Communication**: WebSockets (Real-time Streaming)

---

## Quick Start (Docker)

### 1. Environment Setup
Create a `.env` file in the `backend/` directory:
```env
MONGODB_URL=mongodb://localhost:27017
QDRANT_URL=http://localhost:6333
GROQ_API_KEY=your_key_here
GROQ_MODEL=llama-3.1-8b-instant
SECRET_KEY=your_secret_key
```

### 2. Launch Services
Launch the backend infrastructure and services:
```bash
cd backend
docker-compose up -d --build
```

Launch the frontend application:
```bash
cd frontend
docker-compose up -d --build
```

---

## Deployment Configuration

For production, ensure `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` in the frontend are pointed to your hosted backend instance.

### Chrome TTS Support
To enable AI voice on Chrome, click the **"Test"** button in the **Settings > Voice** modal. This "primes" the audio context, allowing subsequent AI responses to speak automatically.

## Support & Git Workflow
To commit and push all recent improvements, use the following commands:

```bash
git add .
git commit -m "feat: Upgrade to Infinity Persona, stabilize WebSockets, and optimize Ingestion speed"
git push origin main
```

---
**Powered by the Infinity Intelligence Engine**
