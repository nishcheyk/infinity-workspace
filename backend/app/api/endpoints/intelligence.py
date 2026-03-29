from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api import deps
from app.models.user import UserResponse
from app.services.knowledge.graph_service import get_entity_mentions, get_graph_data
from app.services.knowledge.synthesis_service import synthesis_service

router = APIRouter()


@router.get("/mentions", response_model=Any)
async def get_mentions(
    entity: str = Query(..., description="The entity name to search for"),
    current_user: UserResponse = Depends(deps.get_current_user),
) -> Any:
    """
    Get all mentions of a specific entity across documents.
    """
    return await get_entity_mentions(str(current_user.id), entity)


@router.post("/synthesize", response_model=Any)
async def synthesize_documents(payload: dict, current_user: UserResponse = Depends(deps.get_current_user)) -> Any:
    """
    Synthesize multiple documents into a single report using multi-agent logic.
    """
    doc_ids = payload.get("doc_ids", [])
    topic = payload.get("topic", "general synthesis")

    if not doc_ids:
        raise HTTPException(status_code=400, detail="doc_ids list is required")

    report = await synthesis_service.synthesize_documents(doc_ids, str(current_user.id), topic)
    return {"report": report}


@router.get("/graph", response_model=Any)
async def get_knowledge_graph(current_user: UserResponse = Depends(deps.get_current_user)) -> Any:
    """
    Get the nodes and links for the user's Knowledge Graph.
    """
    return await get_graph_data(str(current_user.id))
