
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.tts.sarvam_tts_service import generate_speech

router = APIRouter(prefix="/api/tts", tags=["Text to Speech"])


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    language_code: str = Field(default="hi-IN")
    speaker: str | None = None


@router.post("/speak")
async def speak(request: TTSRequest):
    try:
        audio = await generate_speech(
            text=request.text,
            language_code=request.language_code,
            speaker=request.speaker
        )

        return {
            "audio": audio,
            "format": "wav",
            "message": "Speech generated successfully",
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        )
