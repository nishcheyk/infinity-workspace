from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.ai.tts_service import tts_service

router = APIRouter()


class TTSRequest(BaseModel):
    text: str
    voice: str = "alloy"


@router.post("/speak")
async def speak(request: TTSRequest):
    try:
        if not request.text:
            raise HTTPException(status_code=400, detail="Text is required")

        audio_stream = await tts_service.generate_speech(request.text, request.voice)
        audio_stream.seek(0)

        return StreamingResponse(
            audio_stream, media_type="audio/mpeg", headers={"Content-Disposition": "attachment; filename=speech.mp3"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
