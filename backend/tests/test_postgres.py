"""Run against a disposable pgvector database; never use an institutional database."""

import os
from datetime import date, datetime
from zoneinfo import ZoneInfo
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import DBAPIError
from backend.app.seed import seed, DEMO_TENANT
from backend.app.auth import resolve_actor
from backend.app.services import CampusService
from backend.app.retrieval import Retrieval
from backend.tests.conftest import MemoryStore, USER, OTHER, TENANT_B

pytestmark = pytest.mark.postgres


@pytest.fixture(scope="module")
def postgres():
    url = os.getenv("TEST_POSTGRES_URL")
    if not url:
        pytest.skip(
            "TEST_POSTGRES_URL is not configured; PostgreSQL/RLS needs a disposable pgvector database."
        )
    engine = create_engine(url)
    with sessionmaker(engine)() as db:
        store = MemoryStore()
        seed(db, USER, anchor=date(2026, 10, 28), store=store)
        seed(db, OTHER, TENANT_B, anchor=date(2026, 10, 28), store=store)
        db.commit()
    yield engine
    engine.dispose()


def scoped(connection):
    connection.execute(text("SET LOCAL ROLE campus_api"))
    connection.execute(
        text("SELECT set_config('app.user_id',:u,true),set_config('app.tenant_id',:t,true)"),
        dict(u=USER, t=DEMO_TENANT),
    )


def test_rls_denies_cross_tenant(postgres):
    with postgres.begin() as conn:
        scoped(conn)
        assert (
            conn.scalar(text("SELECT count(*) FROM campus_records WHERE tenant_id=:t"), dict(t=DEMO_TENANT))
            > 0
        )
        assert (
            conn.scalar(text("SELECT count(*) FROM campus_records WHERE tenant_id=:t"), dict(t=TENANT_B)) == 0
        )


def test_rls_rejects_tenant_forgery(postgres):
    with postgres.connect() as conn:
        transaction = conn.begin()
        scoped(conn)
        with pytest.raises(DBAPIError):
            conn.execute(
                text(
                    "INSERT INTO sources(id,tenant_id,filename,kind,checksum,storage_key,uploaded_by,department,demo,created_at) VALUES(gen_random_uuid()::text,:t,'evil.txt','document','x','x',:u,'All',false,now())"
                ),
                dict(t=TENANT_B, u=USER),
            )
        transaction.rollback()


def test_cannot_self_promote_database_role(postgres):
    with postgres.connect() as conn:
        transaction = conn.begin()
        scoped(conn)
        with pytest.raises(DBAPIError):
            conn.execute(text("UPDATE memberships SET role='platform_admin' WHERE user_id=:u"), dict(u=USER))
        transaction.rollback()


def test_postgres_vector_keyword_retrieval(postgres):
    with postgres.connect() as conn:
        with conn.begin():
            scoped(conn)
            with sessionmaker(bind=conn)() as db:
                service = CampusService(
                    db,
                    resolve_actor(db, USER, DEMO_TENANT),
                    clock=lambda: datetime(2026, 10, 28, tzinfo=ZoneInfo("Asia/Kolkata")),
                )
                result = Retrieval(service).search("internal assessment circular")
                assert result["hits"]
                assert result["conflicts"]
                assert service.menu(100, True)
