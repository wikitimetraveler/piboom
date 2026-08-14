"""LiveKit Agents worker — Reed (StarBand) and Wolfman Dave.

Run separately from FastAPI:

    pip install -r python-service/requirements-livekit.txt
    python python-service/livekit_agent/worker.py start

LIVEKIT_AGENT_NAME defaults to StarBand (must match RoomAgentDispatch).
Set LIVEKIT_AGENT_NAME=WolfmanDave for the Wolfman booth.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from livekit_agent.prompts import STARBAND_AGENT_NAME, instructions_for  # noqa: E402


def _agent_name() -> str:
    return (os.environ.get("LIVEKIT_AGENT_NAME") or STARBAND_AGENT_NAME).strip()


def main() -> None:
    try:
        from livekit.agents import Agent, AgentSession, AutoSubscribe, JobContext, WorkerOptions, cli
        from livekit.plugins import openai, silero
    except ImportError:
        print(
            "livekit-agents is not installed. From python-service run:\n"
            "  pip install -r requirements-livekit.txt\n"
            "  python livekit_agent/worker.py start",
            file=sys.stderr,
        )
        raise SystemExit(2)

    class DevConnectAgent(Agent):
        def __init__(self, instructions: str):
            super().__init__(instructions=instructions)

    async def entrypoint(ctx: JobContext) -> None:
        name = getattr(getattr(ctx, "job", None), "agent_name", None) or _agent_name()
        await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
        session = AgentSession(
            vad=silero.VAD.load(),
            llm=openai.realtime.RealtimeModel(),
        )
        await session.start(agent=DevConnectAgent(instructions_for(name)), room=ctx.room)

    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name=_agent_name(),
        )
    )


if __name__ == "__main__":
    main()
