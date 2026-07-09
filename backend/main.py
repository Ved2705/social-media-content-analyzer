"""
Social Media Content Analyzer - FastAPI backend.

Endpoints:
  POST /api/extract    - upload a PDF or image, get extracted text back
  POST /api/extract-url - download a file from a URL, get extracted text back
  POST /api/analyze     - submit text, get rule-based + AI engagement suggestions
  POST /api/process     - convenience: upload a file, get extraction + analysis in one call
  GET  /api/health      - health check
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.pdf_service import extract_text_from_pdf
from services.ocr_service import extract_text_from_image_bytes
from services.analyzer_service import analyze_post, analyze_image_failure
from services.url_service import download_file_from_url

app = FastAPI(title="Social Media Content Analyzer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this to your frontend's domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp", "image/bmp", "image/tiff"}
ALLOWED_PDF_TYPE = "application/pdf"
MAX_FILE_SIZE_MB = 15


class AnalyzeRequest(BaseModel):
    text: str

class ExtractUrlRequest(BaseModel):
    url: str


@app.get("/api/health")
async def health():
    return {"status": "ok"}


async def _read_and_validate(file: UploadFile) -> bytes:
    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(status_code=413, detail=f"File too large ({size_mb:.1f}MB). Max is {MAX_FILE_SIZE_MB}MB.")
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    return contents


def _extract_and_validate(contents: bytes, content_type: str) -> dict:
    result = {"text": "", "method": "", "page_count": 0}

    if content_type == ALLOWED_PDF_TYPE:
        try:
            result = extract_text_from_pdf(contents)
        except Exception as e:
            raise HTTPException(
                status_code=422, 
                detail=f"Failed to process PDF. The PDF may be corrupted or encrypted. Technical detail: {str(e)}"
            )
    elif content_type in ALLOWED_IMAGE_TYPES:
        try:
            text = extract_text_from_image_bytes(contents)
            result = {"text": text, "method": "ocr", "page_count": 1}
        except Exception as e:
            # Tesseract failed completely (e.g. invalid image format)
            exact_reason = analyze_image_failure(contents)
            raise HTTPException(
                status_code=422, 
                detail=f"Extraction failed. Exact reason based on visual analysis: {exact_reason} (Technical detail: {str(e)})"
            )
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type}. Upload a PDF or an image (PNG/JPG/WEBP).",
        )

    if not result.get("text"):
        if content_type in ALLOWED_IMAGE_TYPES:
            exact_reason = analyze_image_failure(contents)
            detail = f"No text could be extracted. Exact reason based on visual analysis: {exact_reason}"
        else:
            detail = "No text could be extracted. The PDF likely contains flat images with no selectable text layer."
        raise HTTPException(status_code=422, detail=detail)

    return result


@app.post("/api/extract")
async def extract(file: UploadFile = File(...)):
    contents = await _read_and_validate(file)
    return _extract_and_validate(contents, file.content_type)


@app.post("/api/extract-url")
async def extract_url(payload: ExtractUrlRequest):
    if not payload.url:
        raise HTTPException(status_code=400, detail="No URL provided.")
    
    try:
        contents, content_type = download_file_from_url(payload.url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(status_code=413, detail=f"File too large ({size_mb:.1f}MB). Max is {MAX_FILE_SIZE_MB}MB.")
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Downloaded file is empty.")

    return _extract_and_validate(contents, content_type)


@app.post("/api/analyze")
async def analyze(payload: AnalyzeRequest):
    if not payload.text or not payload.text.strip():
        raise HTTPException(status_code=400, detail="No text provided to analyze.")
    return analyze_post(payload.text)


@app.post("/api/process")
async def process(file: UploadFile = File(...)):
    """Convenience endpoint: extraction + analysis in a single request."""
    contents = await _read_and_validate(file)
    extraction = _extract_and_validate(contents, file.content_type)
    analysis = analyze_post(extraction["text"])
    return {"extraction": extraction, "analysis": analysis}
