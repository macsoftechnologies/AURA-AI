import logging
import httpx
from app.core.config import (
    SARVAM_API_KEY,
    SARVAM_BASE_URL,
    SARVAM_TTS_MODEL,
    SARVAM_DEFAULT_SPEAKER,
)

logger = logging.getLogger(__name__)

async def generate_speech(
    text: str,
    language_code: str = "hi-IN",
    speaker: str | None = None
) -> str:
    if not text.strip():
        raise ValueError("Text cannot be empty.")

    # 1. Resolve Speaker:
    # Only use a speaker if it matches the target language.
    # If the speaker is Hindi-specific (e.g., 'aarti_hi_customer') and the user is speaking Telugu/Tamil/etc.,
    # omit the speaker so Sarvam automatically picks the natural native speaker for that language.
    chosen_speaker = speaker or SARVAM_DEFAULT_SPEAKER
    if chosen_speaker:
        # Check if speaker has a language tag (e.g. '_hi_' or '_en_') that doesn't match current language
        lang_prefix = language_code.split("-")[0] # e.g. "te", "hi", "en"
        if f"_{lang_prefix}_" not in chosen_speaker and lang_prefix != "hi":
            chosen_speaker = None  # Let Sarvam auto-select native speaker

    # 2. Build payload with both language keys & 24000 Hz sample rate
    payload = {
        "text": text,
        "language_code": language_code,          # Required by bulbul:v4-flash
        "target_language_code": language_code,   # Supported for v3/v1 compatibility
        "model": SARVAM_TTS_MODEL or "bulbul:v4-flash",
        "pace": 1.0,
        "speech_sample_rate": 24000,             # 24000 is supported by bulbul:v4-flash
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

    async with httpx.AsyncClient(timeout=30.0) as client:
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