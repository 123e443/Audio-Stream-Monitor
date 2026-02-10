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

## Whisper.cpp + ffmpeg setup

The Python monitor uses `ffmpeg` to capture audio segments and `whisper-cli.exe`
to transcribe them. Ensure both are available and set these environment variables
if your paths differ:

```
setx FFMPEG_BIN "C:\path\to\ffmpeg.exe"
setx WHISPER_BIN "F:\whisper.cpp\build\bin\Release\whisper-cli.exe"
setx WHISPER_MODEL "F:\whisper.cpp\models\ggml-base.en.bin"
setx SEGMENT_SECONDS "15"
setx GEOCODE_ENABLED "true"
```

On first run you must download a Whisper model (for example `ggml-base.en.bin`)
into `.\whisper.cpp\models` or point `WHISPER_MODEL` to the correct file.
Geocoding uses the public Nominatim service; disable with `GEOCODE_ENABLED=false`
if you do not want external lookup.

## Notes

- Uses SQLite by default (`python_app/app.db`). Set `DATABASE_URL` to use Postgres.
- WebSocket endpoint is at `/ws` for live transcription updates.
- API routes mirror the original `/api/*` endpoints.
