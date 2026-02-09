# Audio Stream Monitor (Python)

This is a full Python rewrite of the Audio Stream Monitor app using FastAPI,
SQLAlchemy, and server-rendered Jinja templates.

## Quick start

1. Create a virtual environment and install dependencies:

```
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

2. Run the server:

```
uvicorn python_app.main:app --reload --port 5000
```

3. Open the app:

```
http://localhost:5000
```

## Notes

- Uses SQLite by default (`python_app/app.db`). Set `DATABASE_URL` to use Postgres.
- WebSocket endpoint is at `/ws` for live transcription updates.
- API routes mirror the original `/api/*` endpoints.
