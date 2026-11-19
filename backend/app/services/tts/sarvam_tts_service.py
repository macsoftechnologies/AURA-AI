import logging
import httpx
from app.core.config import (
    SARVAM_API_KEY,
    SARVAM_BASE_URL,
    SARVAM_TTS_MODEL,
    SARVAM_DEFAULT_SPEAKER,
)

logger = logging.getLogger(__name__)

# Shared HTTP connection pool for TTS concurrency
_tts_client: httpx.AsyncClient | None = None

def get_tts_client() -> httpx.AsyncClient:
    global _tts_client
    if _tts_client is None or _tts_client.is_closed:
        _tts_client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=10.0),
            limits=httpx.Limits(max_connections=40, max_keepalive_connections=20)
        )
    return _tts_client

async def generate_speech(
    text: str,
    language_code: str = "hi-IN",
    speaker: str | None = None
) -> str:
    if not text.strip():
        raise ValueError("Text cannot be empty.")

    chosen_speaker = speaker or SARVAM_DEFAULT_SPEAKER
    if chosen_speaker:
        lang_prefix = language_code.split("-")[0]
        if f"_{lang_prefix}_" not in chosen_speaker and lang_prefix != "hi":
            chosen_speaker = None

    payload = {
        "text": text,
        "language_code": language_code,
        "target_language_code": language_code,
        "model": SARVAM_TTS_MODEL or "bulbul:v4-flash",
        "pace": 1.0,
        "speech_sample_rate": 24000,
        "output_audio_codec": "wav",
        "enable_preprocessing": True,
    }

    if chosen_speaker:
        payload["speaker"] = chosen_speaker

    headers = {
        "api-subscription-key": SARVAM_API_KEY,
        "Authorization": f"Bearer {SARVAM_API_KEY}",
        "Content-Type": "application/json"
    }

    client = get_tts_client()
    response = await client.post(
        f"{SARVAM_BASE_URL}/text-to-speech",
        json=payload,
        headers=headers
    )

    if response.status_code != 200:
        logger.error(f"Sarvam TTS Error {response.status_code}: {response.text}")
        response.raise_for_status()

    data = response.json()
    audios = data.get("audios", [])
    if not audios:
        raise RuntimeError("No audio returned from Sarvam TTS.")

    return audios[0]