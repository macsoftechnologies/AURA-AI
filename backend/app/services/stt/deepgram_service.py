
import asyncio
import json
import logging
from urllib.parse import urlencode

import websockets

from app.core.config import DEEPGRAM_API_KEY, DEEPGRAM_MODEL

logger = logging.getLogger(__name__)


def get_deepgram_url() -> str:
    params = {
        "model": DEEPGRAM_MODEL,
        "language": "en-US",
        "smart_format": "true",
        "interim_results": "true",
        "punctuate": "true",
        "endpointing": "500",
    }

    return (
        "wss://api.deepgram.com/v1/listen?"
        + urlencode(params)
    )


async def stream_audio_to_deepgram(client_websocket):

    if not DEEPGRAM_API_KEY:
        raise RuntimeError("DEEPGRAM_API_KEY is missing.")

    url = get_deepgram_url()

    async with websockets.connect(
        url,
        additional_headers={
            "Authorization": f"Token {DEEPGRAM_API_KEY}"
        },
        ping_interval=20,
        ping_timeout=20,
        max_size=None,
    ) as deepgram_ws:

        logger.info("Connected to Deepgram")

        async def send_audio():

            while True:
                message = await client_websocket.receive()

                if message["type"] == "websocket.disconnect":
                    break

                if message.get("bytes"):
                    await deepgram_ws.send(message["bytes"])

                elif message.get("text") == "STOP":
                    break

            # Ask Deepgram to finalize the audio stream
            await deepgram_ws.send(
                json.dumps({"type": "CloseStream"})
            )

        async def receive_transcripts():

            async for response in deepgram_ws:
                await client_websocket.send_text(response)

        sender = asyncio.create_task(send_audio())
        receiver = asyncio.create_task(receive_transcripts())

        try:
            await sender

            # Allow Deepgram to send final transcription results
            try:
                await asyncio.wait_for(
                    receiver,
                    timeout=3
                )
            except asyncio.TimeoutError:
                logger.warning("Deepgram finalization timed out")

        finally:
            for task in (sender, receiver):
                if not task.done():
                    task.cancel()

            await asyncio.gather(
                sender,
                receiver,
                return_exceptions=True
            )

            logger.info("Deepgram stream finished")
