import json
import os
import time
from redis import Redis

redis_client = Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"), decode_responses=True)
print("HR background worker started", flush=True)
while True:
    try:
        item = redis_client.blpop("hr:events", timeout=5)
        if item:
            _, payload = item
            event = json.loads(payload)
            print(f"Processed event: {event}", flush=True)
    except Exception as exc:
        print(f"Worker connection issue: {exc}", flush=True)
        time.sleep(3)
