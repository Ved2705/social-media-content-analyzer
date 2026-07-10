# Social Media Content Analyzer

Upload a social media post as a PDF or scanned image → get the text extracted (with automatic OCR
fallback) → get instant engagement suggestions, combining fast rule-based checks with AI-generated
advice.

## Tech Stack

- **Backend**: FastAPI (Python) — `pdfplumber` for PDF text extraction, `pytesseract` + `pdf2image`
  for OCR fallback on scanned PDFs/images, Groq's free-tier LLM API for AI suggestions.
- **Frontend**: React (Vite) — drag-and-drop upload (`react-dropzone`), live loading states, results
  dashboard.
  

## How It Works

1. **Upload**: drag a PDF or image (PNG/JPG/WEBP) onto the dropzone.
2. **Extraction** (`POST /api/extract`): PDFs are parsed directly with `pdfplumber` first. If a page
   yields almost no text (a strong signal it's a scanned image rather than real text), the pipeline
   automatically falls back to rasterizing the page and running Tesseract OCR on it. Plain images
   always go through OCR.
3. **Analysis** (`POST /api/analyze`): the extracted text is scored with deterministic rule-based
   checks (word/char count, hashtag count, emoji usage, CTA detection, a lightweight Flesch
   readability approximation, per-platform length fit) *and* sent to Groq's `llama-3.1-8b-instant`
   model for natural-language suggestions (tone, suggested hashtags, a rewritten hook, and specific
   improvement tips). If no API key is configured, the app still works — it just skips the AI layer
   and shows the rule-based results.

## Live Demo

- **App**: https://social-media-content-analyzer-1-3rss.onrender.com
- **API**: https://social-media-content-analyzer-8fbk.onrender.com
- **GitHub**: https://github.com/Ved2705/social-media-content-analyzer

> Note: hosted on Render's free tier — the backend may take 30-50 seconds to
> wake up on the first request after a period of inactivity.

## Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # then add your free Groq API key from console.groq.com
uvicorn main:app --reload --port 8000
```

You'll also need Tesseract and Poppler installed on your system (for OCR and PDF-to-image conversion):

```bash
# macOS
brew install tesseract poppler

# Ubuntu/Debian
sudo apt-get install tesseract-ocr poppler-utils

# Windows: install both via their official installers and add them to PATH
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies `/api` calls to the backend on port 8000
(see `vite.config.js`).

## Deployment Notes

- **Backend**: deploy to Render/Railway/Fly.io as a standard Python web service. Make sure the
  build step installs `tesseract-ocr` and `poppler-utils` (on Render, add an `apt.txt` with those
  two package names, or use a Docker deployment with them installed).
- **Frontend**: deploy to Vercel/Netlify, or as a static build served by the same host as the
  backend. Set `VITE_API_BASE` to your deployed backend's `/api` URL.

## Project Write-Up (~200 words)

The core challenge here is that "text extraction" actually means two different problems depending
on the input: real PDFs have embedded text you can parse directly, while scanned documents and
images only have pixels. I handled this by trying direct extraction first with `pdfplumber`, since
it's fast and preserves the text faithfully, and only falling back to OCR when a page yields
suspiciously little text — that keeps the common case fast while still supporting scanned content
transparently, without asking the user to specify which type of file they have.

For the analysis half, I split the work into two layers: deterministic rule-based checks (length,
hashtags, emojis, CTA presence, readability) that are instant and always available, and an optional
AI layer using Groq's free-tier LLM for more nuanced, natural-language suggestions (tone, hashtag
ideas, a rewritten hook). The app degrades gracefully if no AI key is configured — it just skips
that panel rather than breaking.

On the frontend, I focused on clear loading states across the two-stage pipeline (extraction, then
analysis) so the user always knows what's happening, plus basic error handling for unsupported
files, oversized uploads, and failed extractions.
