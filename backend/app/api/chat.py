
import logging

from fastapi import APIRouter, HTTPException

from app.schemas.chat import ChatRequest, ChatResponse
from app.services.llm.sarvam_service import generate_response
from app.core.config import SARVAM_LLM_MODEL


router = APIRouter(prefix="/api", tags=["Chat"])

logger = logging.getLogger(__name__)


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):

    try:
        answer = await generate_response(
            request.message,
            request.history
        )

        return ChatResponse(
            response=answer,
            model=SARVAM_LLM_MODEL
        )

    except Exception as exc:
        logger.exception("Sarvam chat request failed")

        raise HTTPException(
            status_code=502,
            detail=f"AURA could not generate a response. ({str(exc)})"
        )
