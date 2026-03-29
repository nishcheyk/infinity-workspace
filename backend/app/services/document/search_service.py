import asyncio

try:
    from duckduckgo_search import DDGS

    HAS_DDG = True
except ImportError:
    HAS_DDG = False


async def web_search(query: str, limit: int = 5) -> list[dict]:
    """
    Perform a free web search using DuckDuckGo.
    """
    if not HAS_DDG:
        print("DuckDuckGo search is not available (dependency missing).")
        return []

    try:

        def _sync_search():
            with DDGS() as ddgs:
                return list(ddgs.text(query, max_results=limit))

        results = await asyncio.to_thread(_sync_search)

        formatted = []
        for r in results:
            formatted.append(
                {
                    "title": r.get("title", ""),
                    "link": r.get("href", r.get("link", "")),
                    "snippet": r.get("body", r.get("snippet", "")),
                }
            )
        return formatted
    except Exception as e:
        print(f"Web search failed: {e}")
        return []
