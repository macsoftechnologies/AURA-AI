
import base64

from cartesia import AsyncCartesia

from app.core.config import (
    CARTESIA_API_KEY,
    CARTESIA_MODEL,
    CARTESIA_VOICE_ID,
)


async def generate_speech(text: str) -> str:
    """
    Convert text into speech using Cartesia.
    Returns audio as a base64-encoded WAV string.
    """

    if not CARTESIA_API_KEY:
        raise RuntimeError("CARTESIA_API_KEY is missing.")

    if not CARTESIA_VOICE_ID:
        raise RuntimeError("CARTESIA_VOICE_ID is missing.")

    if not text.strip():
        raise ValueError("Text cannot be empty.")

    async with AsyncCartesia(api_key=CARTESIA_API_KEY) as client:
        response = await client.tts.generate(
            model_id=CARTESIA_MODEL,
            transcript=text,
            voice=CARTESIA_VOICE_ID,
            output_format={
                "container": "wav",
                "encoding": "pcm_s16le",
                "sample_rate": 44100,
            },
            language="en",
        )

        audio_bytes = await response.read()

    return base64.b64encode(audio_bytes).decode("utf-8")
