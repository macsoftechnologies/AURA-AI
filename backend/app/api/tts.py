
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.tts.cartesia_service import generate_speech

router = APIRouter(prefix="/api/tts", tags=["Text to Speech"])


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)


@router.post("/speak")
async def speak(request: TTSRequest):
    try:
        audio = await generate_speech(request.text)

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
