import fitz  # PyMuPDF
from docx import Document as DocxDocument
import trafilatura
from io import BytesIO


def extract_text_from_pdf(file_bytes: bytes) -> list[dict]:
    """Extracts text page-by-page preserving document provenance."""
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages = []
    for page_num in range(len(doc)):
        text = doc[page_num].get_text("text").strip()
        if text:
            pages.append({"page": page_num + 1, "text": text})
    return pages


def extract_text_from_docx(file_bytes: bytes) -> list[dict]:
    """Extracts text from Word documents."""
    doc = DocxDocument(BytesIO(file_bytes))
    full_text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
    return [{"page": 1, "text": full_text}]


def extract_text_from_url(url: str) -> list[dict]:
    """Extracts clean readable text from web URLs without boilerplate."""
    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        raise ValueError(f"Failed to fetch content from URL: {url}")
    text = trafilatura.extract(downloaded)
    if not text:
        raise ValueError("Could not extract readable article text from the URL.")
    return [{"page": 1, "text": text}]