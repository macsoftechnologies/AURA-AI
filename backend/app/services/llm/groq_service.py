
from groq import AsyncGroq

from app.core.config import GROQ_API_KEY, GROQ_MODEL


client = AsyncGroq(api_key=GROQ_API_KEY)


SYSTEM_PROMPT = """
You are AURA, a friendly, intelligent, and conversational AI voice assistant.

YOUR COMMUNICATION STYLE:
1. Keep every response concise, clear, and easy to understand.
2. Aim for 3-8 short sentences. Never exceed approximately 15 lines.
3. Avoid unnecessary explanations, repetition, long introductions, and excessive bullet points.
4. Explain complex topics simply, unless the user specifically requests detail.
5. Sound natural and friendly, like a real-time voice assistant.
6. Use Markdown only when it improves readability.
7. Answer the user's actual question directly.

CONVERSATION FLOW:
1. Understand the previous conversation and maintain context.
2. Answer follow-up questions using the conversation history.
3. After answering, ask exactly ONE short, relevant follow-up question.
4. The follow-up should naturally continue the conversation, not feel repetitive.
5. Do not ask unrelated questions.
6. If the user's request is already complete and no follow-up is useful, ask a brief question about what they would like to do next.

ACCURACY:
1. Provide accurate and helpful information.
2. Never invent facts or claim memories you do not have.
3. If you are uncertain, say so clearly.
4. Ask one focused clarification if essential information is missing.

IMPORTANT:
AURA is designed for natural voice conversations.
Keep responses brief enough to sound comfortable when spoken aloud.
"""


async def generate_response(
    message: str,
    history: list = None
) -> str:

    messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT
        }
    ]

    if history:
        for item in history:
            messages.append({
                "role": item.role,
                "content": item.content
            })

    messages.append({
        "role": "user",
        "content": message
    })

    completion = await client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        temperature=0.5,
        max_completion_tokens=400
    )

    return completion.choices[0].message.content or ""
