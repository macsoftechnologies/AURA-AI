
import logging

from fastapi import APIRouter, File, UploadFile, WebSocket, WebSocketDisconnect

from app.services.stt.sarvam_stt_service import transcribe_audio

router = APIRouter(tags=["Voice"])

logger = logging.getLogger(__name__)


@router.websocket("/ws/stt")
async def speech_to_text(websocket: WebSocket):
    await websocket.accept()

    query_params = dict(websocket.query_params)
    language_code = query_params.get("lang", "unknown")

    audio_buffer = bytearray()

    try:
        while True:
            message = await websocket.receive()

            if message["type"] == "websocket.disconnect":
                break

            if message.get("bytes"):
                audio_buffer.extend(message["bytes"])

            elif message.get("text") == "STOP":
                break

        if audio_buffer:
            logger.info("Transcribing audio with Sarvam STT...")
            result = await transcribe_audio(
                bytes(audio_buffer),
                filename="audio.webm",
                language_code=language_code
            )

            # Send response matching the frontend DeepgramResult format
            await websocket.send_json({
                "channel": {
                    "alternatives": [
                        {
                            "transcript": result.get("transcript", "")
                        }
                    ]
                },
                "is_final": True,
                "speech_final": True
            })

    except WebSocketDisconnect:
        logger.info("Browser disconnected from STT")

    except Exception:
        logger.exception("Sarvam STT failed")
        try:
            await websocket.close(code=1011)
        except Exception:
            pass


@router.post("/api/voice/transcribe")
async def transcribe_endpoint(
    file: UploadFile = File(...),
    language_code: str = "unknown"
):
    audio_bytes = await file.read()
    result = await transcribe_audio(
        audio_bytes,
        filename=file.filename or "audio.webm",
        language_code=language_code
    )
    return result
