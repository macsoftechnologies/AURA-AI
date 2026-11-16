
import os
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv(
    "GROQ_MODEL",
    "openai/gpt-oss-120b"
)

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
DEEPGRAM_MODEL = os.getenv(
    "DEEPGRAM_MODEL",
    "nova-2"
)

if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY is missing.")

CARTESIA_API_KEY = os.getenv("CARTESIA_API_KEY")

CARTESIA_MODEL = os.getenv(
    "CARTESIA_MODEL",
    "sonic-3"
)

CARTESIA_VOICE_ID = os.getenv("CARTESIA_VOICE_ID")

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is missing.")

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

JWT_ALGORITHM = os.getenv(
    "JWT_ALGORITHM",
    "HS256"
)

ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
)

if not JWT_SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY is missing.")