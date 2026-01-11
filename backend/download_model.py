import requests
import json
import sys

model_name = sys.argv[1] if len(sys.argv) > 1 else "phi3:mini"
url = "http://localhost:11434/api/pull"

print(f"Downloading {model_name}...")

response = requests.post(url, json={"name": model_name}, stream=True)

for line in response.iter_lines():
    if line:
        try:
            data = json.loads(line)
            status = data.get("status", "")
            
            if "total" in data and "completed" in data:
                percent = (data["completed"] / data["total"]) * 100
                print(f"\r{status}: {percent:.1f}%", end="", flush=True)
            else:
                print(f"\r{status}", end="", flush=True)
                
            if status == "success":
                print("\n✅ Model downloaded successfully!")
                break
        except:
            pass
