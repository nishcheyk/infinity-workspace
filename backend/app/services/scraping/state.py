"""State definition for scraping pipeline"""
from typing import List, Optional, Dict, Any, TypedDict


class ScrapingState(TypedDict):
    """State for the scraping pipeline"""
    
    # Input
    url: str
    doc_id: str
    user_id: str
    
    # Pipeline data
    html_content: Optional[str]
    text_content: Optional[str]
    chunks: Optional[List[str]]
    vectors: Optional[List[List[float]]]
    analysis: Optional[Dict[str, Any]]
    
    # Status tracking
    status: str
    error: Optional[str]
    retry_count: int
