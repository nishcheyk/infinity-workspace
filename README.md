# Infinity Intelligence: The Ultimate Knowledge OS

Infinity is a state-of-the-art, high-performance **Knowledge Intelligence Platform**. It transforms static documents, recorded meetings, and website URLs into a fluid, conversational intelligence powered by a specialized **Multi-Agent RAG Architecture**.

---

## 🚀 Advanced Capabilities

### 1. Unified Intelligence (Interactive Fallback)
*   **Private Mastery**: Semantic and lexical search across documents and URLs.
*   **Interactive Web-Link**: If info isn't private, Infinity **asks for permission** to search the live web. Once confirmed, it triggers real-time data extraction.
*   **Comparison Engine**: Specialized logic for comparing multiple vendors, versions, or complex reports side-by-side.

### 2. Multi-Modal Intake
*   **Neural Audio Transcription**: Upload `.mp3` or `.wav` files. Powered by **Local Faster-Whisper**, Infinity transcribes and embeds audio for instant Q&A.
*   **OCR Intelligence**: Images (`.png`, `.jpg`) are automatically parsed using computer vision to extract hidden text from diagrams or screenshots.
*   **Smart Parsing**: PDF, DOCX, and TXT are processed in seconds using specialized "Fast" ingestion strategies.

### 3. Smart Document Insights
*   **Auto-Summarization**: Instant 3-point AI summaries for every document.
*   **Semantic Tagging**: Automatic topic classification for organized workspaces.
*   **Prompt Optimization**: Click AI-generated suggested questions to jumpstart your research.

### 4. Specialized Worker Stack
*   **worker_default**: High-speed embedding and analysis.
*   **worker_scraping**: Dedicated browser-based extraction via Playwright.
*   **worker_audio**: Specialized processing for neural transcription.

---

## 🛠 Tech Stack

- **Inference**: Groq Cloud (Llama-3.1 8B/70B)
- **Vector Core**: Qdrant (Hybrid Semantic + Full-Text Indexing)
- **Metadata**: MongoDB
- **Parsing**: Unstructured.io (Fast Strategy)
- **Transcription**: Faster-Whisper (Local)
- **Frontend**: Next.js 14, Ant Design, Glassmorphism CSS

---

## 📦 Deployment (Docker)

Launch the entire specialized intelligence stack:

```bash
# Set GROQ_API_KEY in backend/.env
docker-compose up -d --build
```

---

## 🎯 Final Workflow guide
1. **Upload**: Drop any file (Doc, Image, Audio) into the dock.
2. **Observe**: Watch real-time status: `Processing` -> `Analyzing` -> `Completed`.
3. **Insights**: Hover over a document for a 10-second summary.
4. **Chat**: Mention specific files to compare them, or let Infinity decide.

**Developed with Advanced Agentic Coding for the future of Intelligence.**
