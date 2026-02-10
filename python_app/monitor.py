from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from . import storage
from .schemas import TranscriptionCreate
from .websockets import WebSocketManager


@dataclass(frozen=True)
class TranscriberConfig:
    whisper_bin: Path
    whisper_model: Path
    ffmpeg_bin: str
    segment_seconds: int
    language: str
    min_text_chars: int
    geocode_enabled: bool

    @staticmethod
    def from_env() -> "TranscriberConfig":
        whisper_bin = Path(
            os.getenv(
                "WHISPER_BIN",
                r"F:\whisper.cpp\build\bin\Release\whisper-cli.exe",
            )
        )
        whisper_model = Path(
            os.getenv(
                "WHISPER_MODEL",
                r"F:\whisper.cpp\models\ggml-base.en.bin",
            )
        )
        return TranscriberConfig(
            whisper_bin=whisper_bin,
            whisper_model=whisper_model,
            ffmpeg_bin=os.getenv("FFMPEG_BIN", "ffmpeg"),
            segment_seconds=int(os.getenv("SEGMENT_SECONDS", "15")),
            language=os.getenv("WHISPER_LANGUAGE", "en"),
            min_text_chars=int(os.getenv("MIN_TRANSCRIPT_CHARS", "6")),
            geocode_enabled=os.getenv("GEOCODE_ENABLED", "true").lower() == "true",
        )


class NominatimGeocoder:
    def __init__(self) -> None:
        self._cache: dict[str, dict[str, Any] | None] = {}
        self._last_request_at = 0.0

    def geocode(self, query: str) -> dict[str, Any] | None:
        key = query.strip().lower()
        if not key:
            return None
        cached = self._cache.get(key)
        if cached is not None:
            return cached

        self._rate_limit()
        params = urlencode({"q": query, "format": "json", "limit": 1})
        url = f"https://nominatim.openstreetmap.org/search?{params}"
        request = Request(
            url,
            headers={"User-Agent": "Audio-Stream-Monitor/1.0 (local)"},
        )
        try:
            with urlopen(request, timeout=10) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except Exception:
            return None

        if not payload:
            self._cache[key] = None
            return None

        item = payload[0]
        result = {
            "latitude": float(item.get("lat")),
            "longitude": float(item.get("lon")),
            "address": item.get("display_name"),
        }
        self._cache[key] = result
        return result

    def _rate_limit(self) -> None:
        now = time.monotonic()
        delta = now - self._last_request_at
        if delta < 1.0:
            time.sleep(1.0 - delta)
        self._last_request_at = time.monotonic()


class MonitorManager:
    def __init__(self, websocket_manager: WebSocketManager) -> None:
        self._websocket_manager = websocket_manager
        self._active_tasks: dict[int, asyncio.Task] = {}
        self._config = TranscriberConfig.from_env()
        self._geocoder = NominatimGeocoder()

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
            await self._validate_runtime(stream_id)
            with tempfile.TemporaryDirectory(prefix=f"stream_{stream_id}_") as tempdir:
                temp_path = Path(tempdir)
                while True:
                    stream = await asyncio.to_thread(storage.get_stream, stream_id)
                    if not stream:
                        await asyncio.sleep(1.0)
                        continue
                    await self._process_segment(stream, temp_path)
        except asyncio.CancelledError:
            return

    async def _validate_runtime(self, stream_id: int) -> None:
        if not self._config.whisper_bin.exists():
            await asyncio.to_thread(storage.update_stream_status, stream_id, "error")
            raise RuntimeError(f"Missing whisper-cli at {self._config.whisper_bin}")
        if not self._config.whisper_model.exists():
            await asyncio.to_thread(storage.update_stream_status, stream_id, "error")
            raise RuntimeError(f"Missing Whisper model at {self._config.whisper_model}")
        if not shutil.which(self._config.ffmpeg_bin):
            await asyncio.to_thread(storage.update_stream_status, stream_id, "error")
            raise RuntimeError(f"Missing ffmpeg at {self._config.ffmpeg_bin}")

    async def _process_segment(self, stream, temp_path: Path) -> None:
        segment_path = temp_path / f"segment_{int(time.time())}.wav"
        ok = await asyncio.to_thread(self._capture_segment, stream.url, segment_path)
        if not ok:
            await asyncio.to_thread(storage.update_stream_status, stream.id, "error")
            await asyncio.sleep(2.0)
            return

        text = await asyncio.to_thread(self._transcribe_segment, segment_path)
        if not text or len(text.strip()) < self._config.min_text_chars:
            return

        location = await asyncio.to_thread(self._resolve_location, text, stream.city)
        transcription = await asyncio.to_thread(
            storage.create_transcription,
            TranscriptionCreate(
                stream_id=stream.id,
                content=text.strip(),
                confidence=None,
                call_type=self._call_type_for_stream(stream.category),
                latitude=location.get("latitude") if location else None,
                longitude=location.get("longitude") if location else None,
                address=location.get("address") if location else None,
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

    def _capture_segment(self, stream_url: str, output_path: Path) -> bool:
        cmd = [
            self._config.ffmpeg_bin,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            stream_url,
            "-t",
            str(self._config.segment_seconds),
            "-ac",
            "1",
            "-ar",
            "16000",
            "-vn",
            "-f",
            "wav",
            str(output_path),
        ]
        try:
            subprocess.run(cmd, check=True, capture_output=True)
            return output_path.exists()
        except Exception:
            return False

    def _transcribe_segment(self, segment_path: Path) -> str | None:
        output_base = segment_path.with_suffix("")
        cmd = [
            str(self._config.whisper_bin),
            "-m",
            str(self._config.whisper_model),
            "-f",
            str(segment_path),
            "-l",
            self._config.language,
            "-oj",
            "-of",
            str(output_base),
            "-nt",
            "-np",
        ]
        try:
            subprocess.run(cmd, check=True, capture_output=True)
        except Exception:
            return None

        json_path = output_base.with_suffix(".json")
        if not json_path.exists():
            return None

        try:
            payload = json.loads(json_path.read_text(encoding="utf-8"))
        except Exception:
            return None

        if isinstance(payload, dict):
            if payload.get("transcription"):
                return str(payload["transcription"]).strip()
            segments = payload.get("segments") or []
            if segments:
                return " ".join(str(seg.get("text", "")).strip() for seg in segments).strip()
        return None

    def _resolve_location(self, text: str, stream_city: str | None) -> dict[str, Any] | None:
        if not self._config.geocode_enabled:
            return None

        candidate = self._extract_location(text)
        if not candidate:
            return None

        query = candidate
        if stream_city and stream_city.lower() not in candidate.lower():
            query = f"{candidate}, {stream_city}"

        return self._geocoder.geocode(query)

    @staticmethod
    def _extract_location(text: str) -> str | None:
        cleaned = " ".join(text.split())
        address_pattern = re.compile(
            r"\b\d{1,5}\s+(?:[A-Za-z0-9]+\s){0,4}"
            r"(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|"
            r"Place|Pl|Parkway|Pkwy|Circle|Cir|Way|Terrace|Ter)\b",
            re.IGNORECASE,
        )
        intersection_pattern = re.compile(
            r"\b([A-Za-z0-9 ]{2,30}\s+"
            r"(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|"
            r"Place|Pl|Parkway|Pkwy|Circle|Cir|Way|Terrace|Ter))\s*"
            r"(?:and|&|at|/)\s*"
            r"([A-Za-z0-9 ]{2,30}\s+"
            r"(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|"
            r"Place|Pl|Parkway|Pkwy|Circle|Cir|Way|Terrace|Ter))\b",
            re.IGNORECASE,
        )
        intersection_simple_pattern = re.compile(
            r"\b([A-Za-z0-9]{1,5}(?:st|nd|rd|th)?\s+[A-Za-z0-9]+)"
            r"\s*(?:and|&|at|/)\s*([A-Za-z0-9]+(?:\s+[A-Za-z0-9]+){0,2})\b",
            re.IGNORECASE,
        )
        match = intersection_pattern.search(cleaned)
        if match:
            return match.group(0)
        match = intersection_simple_pattern.search(cleaned)
        if match:
            return match.group(0)
        match = address_pattern.search(cleaned)
        if match:
            return match.group(0)
        return None

    @staticmethod
    def _call_type_for_stream(category: str) -> str:
        mapping = {
            "Police": "Dispatch",
            "Fire": "Fire",
            "Medical": "Medical",
            "EMS": "Medical",
            "Weather": "Weather",
        }
        return mapping.get(category, "Dispatch")
