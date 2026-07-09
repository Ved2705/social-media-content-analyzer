"""
PDF text extraction service.

Strategy:
1. Try direct text extraction with pdfplumber (fast, preserves layout for
   normal, digitally-created PDFs).
2. If the extracted text is empty or suspiciously short (a strong signal
   that the PDF is a scanned image rather than real text), fall back to
   rasterizing each page and running OCR on it.
"""

import io
import pdfplumber
from pdf2image import convert_from_bytes
from services.ocr_service import extract_text_from_image_bytes

MIN_CHARS_PER_PAGE_THRESHOLD = 20  # below this, assume the page is scanned


def _extract_with_pdfplumber(file_bytes: bytes) -> tuple[str, int]:
    """Returns (extracted_text, page_count)."""
    text_chunks = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        page_count = len(pdf.pages)
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            text_chunks.append(page_text)
    return "\n\n".join(text_chunks), page_count


def _extract_with_ocr(file_bytes: bytes) -> str:
    """Rasterizes PDF pages to images and OCRs each one."""
    images = convert_from_bytes(file_bytes, dpi=200)
    ocr_chunks = []
    for img in images:
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        ocr_chunks.append(extract_text_from_image_bytes(buf.getvalue()))
    return "\n\n".join(ocr_chunks)


def extract_text_from_pdf(file_bytes: bytes) -> dict:
    """
    Extracts text from a PDF, automatically falling back to OCR for
    scanned/image-based PDFs.

    Returns a dict: {text, method, page_count}
    """
    text, page_count = _extract_with_pdfplumber(file_bytes)

    avg_chars_per_page = len(text.strip()) / max(page_count, 1)

    if avg_chars_per_page < MIN_CHARS_PER_PAGE_THRESHOLD:
        ocr_text = _extract_with_ocr(file_bytes)
        # Prefer OCR result if it actually found more content
        if len(ocr_text.strip()) > len(text.strip()):
            return {"text": ocr_text.strip(), "method": "ocr", "page_count": page_count}

    return {"text": text.strip(), "method": "direct_text", "page_count": page_count}
