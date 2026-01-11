import json
import sys

model_name = sys.argv[1] if len(sys.argv) > 1 else "qwen2:1.5b"

payload = {"name": model_name}
print(json.dumps(payload))
