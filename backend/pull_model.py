import asyncio
import httpx
import json

async def pull_model():
    url = "http://localhost:11434/api/pull"
    payload = {"name": "llama3.2"}
    print(f"Starting pull for {payload['name']}...")
    
    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream("POST", url, json=payload) as response:
            async for line in response.aiter_lines():
                if line:
                    try:
                        data = json.loads(line)
                        status = data.get("status", "")
                        completed = data.get("completed")
                        total = data.get("total")
                        if completed and total:
                            percent = (completed / total) * 100
                            print(f"{status}: {percent:.1f}%", end="\r")
                        else:
                            print(f"{status}")
                            
                        if status == "success":
                            print("\nModel pulled successfully!")
                    except:
                        pass

if __name__ == "__main__":
    asyncio.run(pull_model())
