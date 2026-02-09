from __future__ import annotations

from contextlib import contextmanager

from sqlalchemy import delete, desc, select, update

from .db import SessionLocal
from .models import Stream, Transcription
from .schemas import StreamCreate, StreamStatusUpdate, TranscriptionCreate


@contextmanager
def session_scope():
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_streams() -> list[Stream]:
    with session_scope() as session:
        result = session.execute(select(Stream).order_by(desc(Stream.created_at)))
        streams = list(result.scalars())
        for stream in streams:
            session.expunge(stream)
        return streams


def get_stream(stream_id: int) -> Stream | None:
    with session_scope() as session:
        stream = session.get(Stream, stream_id)
        if stream:
            session.expunge(stream)
        return stream


def create_stream(payload: StreamCreate) -> Stream:
    with session_scope() as session:
        stream = Stream(**payload.model_dump(mode="json"))
        session.add(stream)
        session.flush()
        session.refresh(stream)
        session.expunge(stream)
        return stream


def update_stream_status(stream_id: int, status: str) -> Stream | None:
    with session_scope() as session:
        session.execute(
            update(Stream).where(Stream.id == stream_id).values(status=status)
        )
        session.flush()
        stream = session.get(Stream, stream_id)
        if stream:
            session.expunge(stream)
        return stream


def delete_stream(stream_id: int) -> None:
    with session_scope() as session:
        session.execute(
            delete(Transcription).where(Transcription.stream_id == stream_id)
        )
        stream = session.get(Stream, stream_id)
        if stream:
            session.delete(stream)


def get_transcriptions(stream_id: int, limit: int = 50) -> list[Transcription]:
    with session_scope() as session:
        result = session.execute(
            select(Transcription)
            .where(Transcription.stream_id == stream_id)
            .order_by(desc(Transcription.timestamp))
            .limit(limit)
        )
        items = list(result.scalars())
        for item in items:
            session.expunge(item)
        return items


def get_all_transcriptions(limit: int = 100, with_location: bool = False) -> list[Transcription]:
    with session_scope() as session:
        query = select(Transcription).order_by(desc(Transcription.timestamp)).limit(limit)
        if with_location:
            query = query.where(
                Transcription.latitude.is_not(None),
                Transcription.longitude.is_not(None),
            )
        result = session.execute(query)
        items = list(result.scalars())
        for item in items:
            session.expunge(item)
        return items


def create_transcription(payload: TranscriptionCreate) -> Transcription:
    with session_scope() as session:
        transcription = Transcription(**payload.model_dump())
        session.add(transcription)
        session.flush()
        session.refresh(transcription)
        session.expunge(transcription)
        return transcription
