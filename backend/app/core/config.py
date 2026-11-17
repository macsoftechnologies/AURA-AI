import os
from dotenv import load_dotenv

load_dotenv()

# SARVAM AI UNIFIED CONFIGURATION
SARVAM_API_KEY = (
    os.getenv("SARVAM_API_KEY") 
    or os.getenv("GROQ_API_KEY") 
    or os.getenv("DEEPGRAM_API_KEY") 
    or os.getenv("CARTESIA_API_KEY")
)

if not SARVAM_API_KEY:
    raise RuntimeError("SARVAM_API_KEY is missing in .env.")

SARVAM_BASE_URL = os.getenv("SARVAM_BASE_URL", "https://api.sarvam.ai")

# LLM
SARVAM_LLM_MODEL = os.getenv("GROQ_MODEL", "sarvam-30b")

# STT
SARVAM_STT_MODEL = os.getenv("DEEPGRAM_MODEL", "saaras:v4")

# TTS
SARVAM_TTS_MODEL = os.getenv("CARTESIA_MODEL", "bulbul:v4-flash")
SARVAM_DEFAULT_SPEAKER = os.getenv("SPEAKER", "aarti_hi_customer").strip(' "')

# Database & Security
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is missing.")

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

if not JWT_SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY is missing.")

# Backward compatibility aliases
GROQ_API_KEY = SARVAM_API_KEY
GROQ_MODEL = SARVAM_LLM_MODEL
DEEPGRAM_API_KEY = SARVAM_API_KEY
DEEPGRAM_MODEL = SARVAM_STT_MODEL
CARTESIA_API_KEY = SARVAM_API_KEY
CARTESIA_MODEL = SARVAM_TTS_MODEL
CARTESIA_VOICE_ID = SARVAM_DEFAULT_SPEAKER
