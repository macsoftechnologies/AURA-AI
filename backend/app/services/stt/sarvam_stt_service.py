import httpx
from app.core.config import SARVAM_API_KEY, SARVAM_BASE_URL, SARVAM_STT_MODEL

async def transcribe_audio(
    audio_bytes: bytes,
    filename: str = "audio.webm",
    language_code: str = "unknown"
) -> dict:
    headers = {
        "api-subscription-key": SARVAM_API_KEY
    }

    files = {
        "file": (filename, audio_bytes, "audio/webm")
    }
    data = {
        "model": SARVAM_STT_MODEL,
        "language_code": language_code  # 'unknown' triggers automatic language detection
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{SARVAM_BASE_URL}/speech-to-text",
            files=files,
            data=data,
            headers=headers
        )
        response.raise_for_status()
        result = response.json()
        return {
            "transcript": result.get("transcript", ""),
            "language_code": result.get("language_code", language_code)
        }