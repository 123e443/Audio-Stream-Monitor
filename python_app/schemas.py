from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl


class StreamBase(BaseModel):
    name: str = Field(..., min_length=1)
    url: HttpUrl
    description: str | None = None
    category: str = "Police"
    thumbnail_url: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    city: str | None = None


class StreamCreate(StreamBase):
    pass


class StreamOut(StreamBase):
    id: int
    status: str = "inactive"
    created_at: datetime

    class Config:
        from_attributes = True


class StreamStatusUpdate(BaseModel):
    status: Literal["active", "inactive", "error"]


class TranscriptionCreate(BaseModel):
    stream_id: int
    content: str
    confidence: int | None = None
    latitude: float | None = None
    longitude: float | None = None
    address: str | None = None
    call_type: str | None = None


class TranscriptionOut(TranscriptionCreate):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True
