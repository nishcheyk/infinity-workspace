import io

import edge_tts


class TTSService:
    def __init__(self):
        # Default voice
        self.default_voice = "en-US-AvaNeural"

    async def generate_speech(self, text: str, voice: str = None) -> io.BytesIO:
        # Map common names or fallback to a high-quality free voice
        # edge-tts voices look like "en-US-AvaNeural" or "en-GB-SoniaNeural"
        valid_voices = ["en-US-AvaNeural", "en-US-AndrewNeural", "en-GB-SoniaNeural"]

        target_voice = voice if voice in valid_voices else self.default_voice

        try:
            communicate = edge_tts.Communicate(text, target_voice)
            audio_data = io.BytesIO()

            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_data.write(chunk["data"])

            audio_data.seek(0)
            return audio_data
        except Exception as e:
            print(f"Edge-TTS error: {e}")
            # Absolute fallback
            communicate = edge_tts.Communicate(text, self.default_voice)
            audio_data = io.BytesIO()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_data.write(chunk["data"])
            audio_data.seek(0)
            return audio_data


tts_service = TTSService()
