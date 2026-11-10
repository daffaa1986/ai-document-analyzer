import fitz
from google import genai
from fastapi import HTTPException
from .config import settings


def extract_text(filename: str, content: bytes) -> str:
    lower = filename.lower()
    try:
        if lower.endswith(".pdf"):
            with fitz.open(stream=content, filetype="pdf") as pdf:
                text = "\\n".join(page.get_text("text") for page in pdf)
        elif lower.endswith(".txt"):
            text = content.decode("utf-8-sig")
        else:
            raise HTTPException(status_code=415, detail="Only PDF and TXT files are supported.")
    except (fitz.FileDataError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=400, detail="The file is invalid or cannot be decoded.") from exc

    text = text.strip()
    if not text:
        raise HTTPException(
            status_code=422,
            detail="No readable text found. Scanned/image-only PDFs are not supported in this MVP.",
        )
    return text


def summarize_text(text: str) -> str:
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY is not configured. Add your Gemini API key to .env and restart the API service.",
        )

    # Bound input size to control request size and API usage.
    clipped_text = text[:30000]
    try:
        client = genai.Client(api_key=settings.gemini_api_key)
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=(
                "Anda adalah asisten yang merangkum dokumen. Tulis dalam Bahasa Indonesia "
                "dengan bagian Ringkasan, Poin Penting, dan Kesimpulan. Setia pada isi sumber, "
                "jangan mengarang fakta, dan nyatakan jika ada ketidakpastian.\\n\\n"
                "ISI DOKUMEN:\\n" + clipped_text
            ),
        )
        result = (response.text or "").strip()
        if not result:
            raise RuntimeError("The model returned an empty summary.")
        return result
    except Exception as exc:
        # Do not expose API key or raw provider error details to the browser.
        raise HTTPException(
            status_code=502,
            detail="Gemini summarization failed. Check API key, model availability, quota, and backend logs.",
        ) from exc
