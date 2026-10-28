"""Docker-local setup only; never run with a production database URL."""

import os
from sqlalchemy import text
from backend.app.db import engine

if os.getenv("LOCAL_COMPOSE") != "1":
    raise SystemExit("This helper is restricted to the local Docker Compose database.")
with engine.begin() as db:
    db.execute(
        text(
            "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='campus_local') THEN CREATE ROLE campus_local LOGIN PASSWORD 'campus-local-only' NOBYPASSRLS; END IF; END $$"
        )
    )
    db.execute(text("GRANT campus_api TO campus_local"))
