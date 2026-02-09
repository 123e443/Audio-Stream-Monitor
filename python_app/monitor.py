from __future__ import annotations

import asyncio
import random
from datetime import datetime

from . import storage
from .schemas import TranscriptionCreate
from .websockets import WebSocketManager


class MonitorManager:
    def __init__(self, websocket_manager: WebSocketManager) -> None:
        self._websocket_manager = websocket_manager
        self._active_tasks: dict[int, asyncio.Task] = {}

    def is_active(self, stream_id: int) -> bool:
        return stream_id in self._active_tasks

    def start(self, stream_id: int) -> None:
        if stream_id in self._active_tasks:
            return
        storage.update_stream_status(stream_id, "active")
        task = asyncio.create_task(self._run_monitor(stream_id))
        self._active_tasks[stream_id] = task

    def stop(self, stream_id: int) -> None:
        task = self._active_tasks.pop(stream_id, None)
        if task:
            task.cancel()
        storage.update_stream_status(stream_id, "inactive")

    async def _run_monitor(self, stream_id: int) -> None:
        try:
            while True:
                await asyncio.sleep(random.uniform(4.0, 12.0))
                await self._generate_transcription(stream_id)
        except asyncio.CancelledError:
            return

    async def _generate_transcription(self, stream_id: int) -> None:
        stream = await asyncio.to_thread(storage.get_stream, stream_id)
        if not stream:
            return

        phrases = self._phrases_for_category(stream.category)
        content = random.choice(phrases)

        unit = random.randint(1, 50)
        if random.random() > 0.3:
            content = f"Unit {unit}: {content}"

        call_type = self._random_call_type(stream.category)
        location = self._maybe_location(stream)

        transcription = await asyncio.to_thread(
            storage.create_transcription,
            TranscriptionCreate(
                stream_id=stream_id,
                content=content,
                confidence=random.randint(85, 99),
                call_type=call_type,
                latitude=location.get("latitude"),
                longitude=location.get("longitude"),
                address=location.get("address"),
            ),
        )

        await self._websocket_manager.broadcast(
            {
                "type": "transcription",
                "payload": {
                    "streamId": transcription.stream_id,
                    "content": transcription.content,
                    "timestamp": transcription.timestamp.isoformat(),
                    "latitude": transcription.latitude,
                    "longitude": transcription.longitude,
                    "address": transcription.address,
                    "callType": transcription.call_type,
                },
            }
        )

    @staticmethod
    def _phrases_for_category(category: str) -> list[str]:
        common = [
            "10-4, copy that.",
            "Roger, unit 5.",
            "Confirming location, over.",
            "Standing by for further instructions.",
        ]
        specific: dict[str, list[str]] = {
            "Police": [
                "Dispatch, initiating traffic stop on silver sedan, license plate ALPHA-2-NINER.",
                "Requesting backup at 12th and Broadway, suspect fleeing on foot.",
                "Code 4, scene is secure.",
                "Warrant check on individual, last name SMITH, first name DAVID.",
            ],
            "Fire": [
                "Engine 5 on scene, heavy smoke showing from second floor.",
                "Requesting second alarm for structure fire at Industrial Park.",
                "Primary search complete, all clear.",
                "Ventilation team in position on the roof.",
            ],
            "Medical": [
                "Medic 2, transporting one patient, stable condition, ETA 10 minutes to General Hospital.",
                "Patient presenting with chest pain and shortness of breath.",
                "Starting IV and administering oxygen.",
                "Requesting additional manpower for lift assist.",
            ],
            "EMS": [
                "EMS unit responding to 44th and Pine, elderly fall reported.",
                "Patient stabilized, en route to Mercy Hospital.",
            ],
            "Weather": [
                "Severe thunderstorm warning issued for the county.",
                "Wind gusts increasing, expect visibility reduction.",
            ],
        }
        return [*common, *specific.get(category, specific["Police"])]

    @staticmethod
    def _random_call_type(category: str) -> str:
        mapping = {
            "Police": ["Crime", "Traffic", "Emergency", "Dispatch"],
            "Fire": ["Fire", "Emergency", "Dispatch"],
            "Medical": ["Medical", "Emergency", "Dispatch"],
            "EMS": ["Medical", "Emergency", "Dispatch"],
            "Weather": ["Weather", "Emergency"],
        }
        options = mapping.get(category, ["Emergency", "Dispatch"])
        return random.choice(options)

    @staticmethod
    def _maybe_location(stream) -> dict[str, float | str | None]:
        if stream.latitude is None or stream.longitude is None:
            if random.random() > 0.25:
                return {"latitude": None, "longitude": None, "address": None}

            latitude = random.uniform(29.0, 47.0)
            longitude = random.uniform(-122.0, -73.0)
            return {
                "latitude": round(latitude, 4),
                "longitude": round(longitude, 4),
                "address": "Location unknown",
            }

        jitter_lat = random.uniform(-0.02, 0.02)
        jitter_lon = random.uniform(-0.02, 0.02)
        return {
            "latitude": round(stream.latitude + jitter_lat, 4),
            "longitude": round(stream.longitude + jitter_lon, 4),
            "address": stream.city or "Nearby location",
        }
