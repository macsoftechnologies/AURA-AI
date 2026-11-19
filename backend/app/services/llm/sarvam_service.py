import logging
import httpx
from app.core.config import SARVAM_API_KEY, SARVAM_BASE_URL, SARVAM_LLM_MODEL

logger = logging.getLogger(__name__)

# Shared HTTP connection pool for high concurrency (10+ users)
_client: httpx.AsyncClient | None = None

def get_sarvam_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=10.0),
            limits=httpx.Limits(max_connections=40, max_keepalive_connections=20)
        )
    return _client

SYSTEM_PROMPT = """
You are AURA, an intelligent, warm, and natural conversational voice AI assistant.

COMMUNICATION GUIDELINES:
1. Keep responses concise, clear, and direct (3-6 short sentences).
2. MULTILINGUAL SUPPORT: Respond naturally in the user's language (Hindi, English, Telugu, Tamil, Bengali, Marathi, Gujarati, Kannada, Malayalam, Odia, Punjabi, or conversational code-mixed languages like Hinglish and Teluglish).
3. If the user speaks or writes in Telugu (e.g. "rey mowa endi sangathi..."), reply back naturally in casual, friendly Telugu or Teluglish.
4. Sound conversational and comfortable when read aloud by Text-to-Speech.
5. Avoid markdown bullet lists or technical symbols unless explicitly requested.
6. After addressing the user's query, conclude with ONE short, contextually helpful follow-up question.
"""

async def generate_response(message: str, history: list = None, language: str = "auto") -> str:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    if history:
        for item in history:
            messages.append({"role": item.role, "content": item.content})

    messages.append({"role": "user", "content": message})

    headers = {
        "api-subscription-key": SARVAM_API_KEY,
        "Authorization": f"Bearer {SARVAM_API_KEY}",
        "Content-Type": "application/json",
    }

    model = SARVAM_LLM_MODEL
    if model in ("sarvam-30b", "sarvam-2b", "openai/gpt-oss-120b"):
        model = "sarvam-105b-conversations"

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.5,
        "max_tokens": 450,
    }

    client = get_sarvam_client()
    try:
        response = await client.post(
            f"{SARVAM_BASE_URL}/v1/chat/completions",
            json=payload,
            headers=headers
        )
    except Exception as e:
        logger.error(f"Failed to connect to Sarvam API: {e}")
        raise

    if response.status_code != 200:
        logger.error(f"Sarvam LLM Error {response.status_code}: {response.text}")
        if response.status_code in (400, 404) and payload["model"] != "sarvam-105b":
            logger.info("Retrying with fallback model sarvam-105b...")
            payload["model"] = "sarvam-105b"
            response = await client.post(
                f"{SARVAM_BASE_URL}/v1/chat/completions",
                json=payload,
                headers=headers
            )
            if response.status_code != 200:
                logger.error(f"Fallback Sarvam LLM Error {response.status_code}: {response.text}")
                response.raise_for_status()
        else:
            response.raise_for_status()

    data = response.json()
    return data["choices"][0]["message"]["content"]