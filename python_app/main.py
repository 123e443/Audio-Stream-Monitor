from __future__ import annotations

import asyncio
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from .db import Base, engine
from .monitor import MonitorManager
from .schemas import StreamCreate, StreamOut, StreamStatusUpdate, TranscriptionOut
from .storage import (
    create_stream,
    delete_stream,
    get_all_transcriptions,
    get_stream,
    get_streams,
    get_transcriptions,
    update_stream_status,
)
from .websockets import WebSocketManager


BASE_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

app = FastAPI(title="Audio Stream Monitor (Python)")
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

websocket_manager = WebSocketManager()
monitor_manager = MonitorManager(websocket_manager)


@app.on_event("startup")
async def startup() -> None:
    Base.metadata.create_all(engine)
    seeded_ids = await asyncio.to_thread(_seed_streams)
    if seeded_ids:
        for stream_id in seeded_ids:
            monitor_manager.start(stream_id)
    await _resume_monitors()


def _seed_streams() -> list[int]:
    streams = get_streams()
    if streams:
        return []

    seed_streams = [
        {
            "name": "Broadcastify Stream 41811",
            "url": "https://broadcastify.cdnstream1.com/41811",
            "category": "Police",
            "description": "Requested live audio stream",
            "latitude": None,
            "longitude": None,
            "city": None,
        },
        {
            "name": "Chicago Police Zone 10",
            "url": "https://broadcastify.cdnstream1.com/31652",
            "category": "Police",
            "description": "Districts 10 and 11",
            "latitude": 41.8781,
            "longitude": -87.6298,
            "city": "Chicago, IL",
        },
        {
            "name": "FDNY Brooklyn",
            "url": "https://broadcastify.cdnstream1.com/9358",
            "category": "Fire",
            "description": "Brooklyn Fire Dispatch",
            "latitude": 40.6782,
            "longitude": -73.9442,
            "city": "Brooklyn, NY",
        },
        {
            "name": "LA Fire Department",
            "url": "https://broadcastify.cdnstream1.com/2846",
            "category": "Fire",
            "description": "Metro Fire",
            "latitude": 34.0522,
            "longitude": -118.2437,
            "city": "Los Angeles, CA",
        },
        {
            "name": "Calgary Municipal Radio Network",
            "url": "https://broadcastify.cdnstream1.com/38040",
            "category": "Fire",
            "description": "Calgary Fire Department dispatch and scene communications",
            "latitude": 51.0447,
            "longitude": -114.0719,
            "city": "Calgary, AB",
        },
    ]

    started_ids: list[int] = []
    for seed in seed_streams:
        stream = create_stream(StreamCreate(**seed))
        if seed["name"] not in {"LA Fire Department"}:
            started_ids.append(stream.id)

    return started_ids


async def _resume_monitors() -> None:
    streams = await asyncio.to_thread(get_streams)
    for stream in streams:
        if stream.status == "active":
            monitor_manager.start(stream.id)


@app.get("/", response_class=HTMLResponse)
def dashboard(request: Request) -> HTMLResponse:
    streams = get_streams()
    return templates.TemplateResponse(
        "dashboard.html",
        {"request": request, "streams": streams, "page": "dashboard"},
    )


@app.get("/streams/{stream_id}", response_class=HTMLResponse)
def stream_detail(request: Request, stream_id: int) -> HTMLResponse:
    stream = get_stream(stream_id)
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    return templates.TemplateResponse(
        "stream_detail.html",
        {"request": request, "stream": stream, "page": "stream"},
    )


@app.get("/map", response_class=HTMLResponse)
def map_view(request: Request) -> HTMLResponse:
    return templates.TemplateResponse(
        "map.html",
        {"request": request, "page": "map"},
    )


@app.get("/api/streams", response_model=list[StreamOut])
def api_list_streams() -> list[StreamOut]:
    return [StreamOut.model_validate(stream) for stream in get_streams()]


@app.get("/api/streams/{stream_id}", response_model=StreamOut)
def api_get_stream(stream_id: int) -> StreamOut:
    stream = get_stream(stream_id)
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    return StreamOut.model_validate(stream)


@app.post("/api/streams", response_model=StreamOut, status_code=201)
async def api_create_stream(payload: StreamCreate) -> StreamOut:
    stream = await asyncio.to_thread(create_stream, payload)
    monitor_manager.start(stream.id)
    return StreamOut.model_validate(stream)


@app.patch("/api/streams/{stream_id}/status", response_model=StreamOut)
async def api_update_stream_status(stream_id: int, payload: StreamStatusUpdate) -> StreamOut:
    stream = await asyncio.to_thread(get_stream, stream_id)
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    updated = await asyncio.to_thread(update_stream_status, stream_id, payload.status)
    if payload.status == "active":
        monitor_manager.start(stream_id)
    else:
        monitor_manager.stop(stream_id)

    return StreamOut.model_validate(updated)


@app.delete("/api/streams/{stream_id}", status_code=204)
async def api_delete_stream(stream_id: int) -> Response:
    stream = await asyncio.to_thread(get_stream, stream_id)
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    monitor_manager.stop(stream_id)
    await asyncio.to_thread(delete_stream, stream_id)
    return Response(status_code=204)


@app.get("/api/streams/{stream_id}/transcriptions", response_model=list[TranscriptionOut])
def api_stream_transcriptions(
    stream_id: int,
    limit: int = Query(50, ge=1, le=500),
) -> list[TranscriptionOut]:
    return [
        TranscriptionOut.model_validate(item)
        for item in get_transcriptions(stream_id, limit)
    ]


@app.get("/api/transcriptions", response_model=list[TranscriptionOut])
def api_all_transcriptions(
    limit: int = Query(100, ge=1, le=500),
    withLocation: bool = Query(False),
) -> list[TranscriptionOut]:
    return [
        TranscriptionOut.model_validate(item)
        for item in get_all_transcriptions(limit=limit, with_location=withLocation)
    ]


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)
