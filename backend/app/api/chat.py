
import logging

from fastapi import APIRouter, HTTPException

from app.schemas.chat import ChatRequest, ChatResponse
from app.services.llm.groq_service import generate_response
from app.core.config import GROQ_MODEL


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
            model=GROQ_MODEL
        )

    except Exception:
        logger.exception("Groq chat request failed")

        raise HTTPException(
            status_code=502,
            detail="AURA could not generate a response. Please try again."
        )
