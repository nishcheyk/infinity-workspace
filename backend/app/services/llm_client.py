from typing import AsyncGenerator
from groq import AsyncGroq
from app.core.config import settings


class GroqClient:
    def __init__(self):
        self.client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        self.model = settings.GROQ_MODEL

    async def generate_completion(self, model: str, prompt: str) -> str:
        """Non-streaming completion (not used in current implementation)"""
        response = await self.client.chat.completions.create(
            model=model or self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=2048,
        )
        return response.choices[0].message.content

    async def generate_stream(
        self, model: str, prompt: str
    ) -> AsyncGenerator[str, None]:
        """Streaming completion - yields tokens as they arrive"""
        try:
            stream = await self.client.chat.completions.create(
                model=model or self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=2048,
                stream=True,
            )

            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        except Exception as e:
            raise Exception(f"Groq API error: {str(e)}")


# Create singleton instance
groq_client = GroqClient()

# Backward compatibility alias (so chat_service doesn't need changes)
ollama_client = groq_client
