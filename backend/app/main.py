from app.api.auth import router as auth_router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.voice import router as voice_router
from app.api.chat import router as chat_router
from app.api.tts import router as tts_router

app = FastAPI(
    title="AURA AI",
    description="Intelligent Voice and Text AI Assistant",
    version="1.0.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(voice_router)
app.include_router(tts_router)


@app.get("/")
async def root():
    return {
        "message": "Welcome to AURA AI",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "application": "AURA AI"
    }
