"""
OCR service for extracting text from image files using Tesseract.
"""

import io
import os
from PIL import Image, ImageOps
import pytesseract

# Point pytesseract to the Tesseract executable on Windows
if os.name == "nt":
    _tess_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    if os.path.exists(_tess_path):
        pytesseract.pytesseract.tesseract_cmd = _tess_path


def _preprocess(image: Image.Image) -> Image.Image:
    """Light preprocessing to improve OCR accuracy on photos of documents:
    convert to grayscale and auto-contrast."""
    gray = ImageOps.grayscale(image)
    return ImageOps.autocontrast(gray)


def extract_text_from_image_bytes(file_bytes: bytes) -> str:
    image = Image.open(io.BytesIO(file_bytes))
    processed = _preprocess(image)
    text = pytesseract.image_to_string(processed)
    return text.strip()
