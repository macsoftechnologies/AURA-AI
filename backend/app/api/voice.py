
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.stt.deepgram_service import (
    stream_audio_to_deepgram
)

router = APIRouter(tags=["Voice"])

logger = logging.getLogger(__name__)


@router.websocket("/ws/stt")
async def speech_to_text(websocket: WebSocket):

    await websocket.accept()

    try:
        await stream_audio_to_deepgram(websocket)

    except WebSocketDisconnect:
        logger.info("Browser disconnected from STT")

    except Exception:
        logger.exception("Deepgram STT failed")

        try:
            await websocket.close(code=1011)
        except Exception:
            pass
