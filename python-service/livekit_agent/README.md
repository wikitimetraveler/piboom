# LiveKit Agents worker (Reed / Wolfman Dave)
#
# This is a separate process from FastAPI (`python main.py`).
# Tokens already dispatch agent_name=StarBand from Node (`services/studio.service.js`).
#
#   cd python-service
#   pip install -r requirements-livekit.txt
#   python livekit_agent/worker.py start
#
# Wolfman booth:
#   set LIVEKIT_AGENT_NAME=WolfmanDave
#   python livekit_agent/worker.py start
#
# Needs the same LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and OPENAI_API_KEY
# as the Node app (loaded from the repo-root .env if you export them).
