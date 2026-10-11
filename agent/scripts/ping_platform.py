import time
from agent.data.platform_db import platform

for i in range(3):
    t = time.time()
    try:
        r = platform().table("brands").select("id").limit(1).execute()
        print(f"try {i+1}: OK in {time.time()-t:.1f}s, rows={len(r.data)}")
    except Exception as e:
        print(f"try {i+1}: FAILED after {time.time()-t:.1f}s -> {type(e).__name__}")