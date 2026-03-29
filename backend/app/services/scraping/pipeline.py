"""LangGraph pipeline for web scraping"""
import logging
from langgraph.graph import StateGraph, END
from .state import ScrapingState
from .nodes import (
    fetch_node,
    parse_node,
    chunk_node,
    embed_node,
    store_node,
    analyze_node,
)

logger = logging.getLogger(__name__)


def should_continue(state: ScrapingState) -> str:
    """Determine if pipeline should continue or end"""
    if state.get('error'):
        logger.error(f"Pipeline stopped due to error: {state['error']}")
        return END
    return "continue"


def build_scraping_pipeline():
    """Build the scraping pipeline graph"""
    workflow = StateGraph(ScrapingState)
    
    # Add nodes
    workflow.add_node("fetch", fetch_node)
    workflow.add_node("parse", parse_node)
    workflow.add_node("chunk", chunk_node)
    workflow.add_node("embed", embed_node)
    workflow.add_node("store", store_node)
    workflow.add_node("analyze", analyze_node)
    
    # Define edges
    workflow.set_entry_point("fetch")
    workflow.add_edge("fetch", "parse")
    workflow.add_edge("parse", "chunk")
    workflow.add_edge("chunk", "embed")
    workflow.add_edge("embed", "store")
    workflow.add_edge("store", "analyze")
    workflow.add_edge("analyze", END)
    
    return workflow.compile()


# Create the pipeline instance
scraping_pipeline = build_scraping_pipeline()
