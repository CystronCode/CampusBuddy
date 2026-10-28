"""Defense in depth: RLS, restricted role, private storage policies, hybrid search indexes."""

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute("""
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='campus_api') THEN CREATE ROLE campus_api NOLOGIN NOBYPASSRLS; END IF;
    END $$;
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
    GRANT USAGE ON SCHEMA public TO campus_api;
    CREATE OR REPLACE FUNCTION public.campus_permitted(t text,o text DEFAULT NULL,d text DEFAULT 'All')
    RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public SET row_security=off AS $$
      SELECT t=current_setting('app.tenant_id',true) AND
        (o IS NULL OR o=current_setting('app.user_id',true)) AND EXISTS (
          SELECT 1 FROM memberships m WHERE m.tenant_id=t AND m.user_id=current_setting('app.user_id',true)
          AND m.active AND (d='All' OR m.department=d OR m.role IN ('institution_admin','platform_admin'))
        )
    $$;
    CREATE OR REPLACE FUNCTION public.campus_admin(t text,d text DEFAULT 'All')
    RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public SET row_security=off AS $$
      SELECT t=current_setting('app.tenant_id',true) AND EXISTS (
        SELECT 1 FROM memberships m WHERE m.tenant_id=t AND m.user_id=current_setting('app.user_id',true)
        AND m.active AND (m.role IN ('institution_admin','platform_admin') OR (m.role='department_admin' AND m.department=d))
      )
    $$;
    REVOKE ALL ON FUNCTION public.campus_permitted(text,text,text) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.campus_admin(text,text) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.campus_permitted(text,text,text),public.campus_admin(text,text) TO campus_api;
    CREATE INDEX IF NOT EXISTS ix_chunks_fts ON document_chunks USING gin(to_tsvector('english',text));
    CREATE INDEX IF NOT EXISTS ix_chunks_vector ON document_chunks USING hnsw(embedding vector_cosine_ops);
    CREATE INDEX IF NOT EXISTS ix_records_payload ON campus_records USING gin((payload::jsonb));
    """)
    tables = [
        "institutions",
        "memberships",
        "sources",
        "campus_records",
        "documents",
        "document_chunks",
        "conversations",
        "messages",
        "ingestion_jobs",
        "audit_logs",
        "query_traces",
        "integration_connections",
    ]
    for table in tables:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute("""
    CREATE POLICY institution_member ON institutions FOR SELECT TO campus_api USING (
      EXISTS(SELECT 1 FROM memberships WHERE tenant_id=institutions.id AND user_id=current_setting('app.user_id',true) AND active)
    );
    CREATE POLICY membership_read ON memberships FOR SELECT TO campus_api USING (
      user_id=current_setting('app.user_id',true) OR campus_admin(tenant_id)
    );
    CREATE POLICY membership_preferences ON memberships FOR UPDATE TO campus_api
      USING(user_id=current_setting('app.user_id',true) AND tenant_id=current_setting('app.tenant_id',true) AND active)
      WITH CHECK(user_id=current_setting('app.user_id',true) AND tenant_id=current_setting('app.tenant_id',true) AND active);
    GRANT SELECT ON institutions,memberships TO campus_api;
    GRANT UPDATE(name,interests,diet) ON memberships TO campus_api;
    CREATE POLICY source_read ON sources FOR SELECT TO campus_api USING(campus_permitted(tenant_id,owner_id,department));
    CREATE POLICY source_insert ON sources FOR INSERT TO campus_api WITH CHECK(
      campus_permitted(tenant_id,owner_id,department) AND uploaded_by=current_setting('app.user_id',true)
      AND (owner_id=current_setting('app.user_id',true) OR campus_admin(tenant_id,department))
    );
    GRANT SELECT,INSERT ON sources TO campus_api;
    """)
    for table in ["campus_records", "documents"]:
        op.execute(
            f"CREATE POLICY {table}_read ON {table} FOR SELECT TO campus_api USING(campus_permitted(tenant_id,owner_id,department))"
        )
        op.execute(
            f"CREATE POLICY {table}_write ON {table} FOR ALL TO campus_api USING(campus_permitted(tenant_id,owner_id,department) AND (owner_id=current_setting('app.user_id',true) OR campus_admin(tenant_id,department))) WITH CHECK(campus_permitted(tenant_id,owner_id,department) AND (owner_id=current_setting('app.user_id',true) OR campus_admin(tenant_id,department)))"
        )
        op.execute(f"GRANT SELECT,INSERT,UPDATE,DELETE ON {table} TO campus_api")
    op.execute("""
    CREATE POLICY chunks_read ON document_chunks FOR SELECT TO campus_api USING(
      tenant_id=current_setting('app.tenant_id',true) AND EXISTS(SELECT 1 FROM documents d WHERE d.id=document_id AND d.tenant_id=document_chunks.tenant_id)
    );
    CREATE POLICY chunks_write ON document_chunks FOR ALL TO campus_api USING(
      EXISTS(SELECT 1 FROM documents d WHERE d.id=document_id AND d.tenant_id=document_chunks.tenant_id AND campus_admin(d.tenant_id,d.department))
    ) WITH CHECK(EXISTS(SELECT 1 FROM documents d WHERE d.id=document_id AND d.tenant_id=document_chunks.tenant_id AND campus_admin(d.tenant_id,d.department)));
    GRANT SELECT,INSERT,UPDATE,DELETE ON document_chunks TO campus_api;
    """)
    for table, owner in [
        ("conversations", "owner_id"),
        ("messages", "owner_id"),
        ("ingestion_jobs", "requested_by"),
        ("audit_logs", "user_id"),
        ("query_traces", "user_id"),
        ("integration_connections", "user_id"),
    ]:
        op.execute(
            f"CREATE POLICY {table}_owner ON {table} FOR ALL TO campus_api USING(campus_permitted(tenant_id,{owner})) WITH CHECK(campus_permitted(tenant_id,{owner}))"
        )
        op.execute(f"GRANT SELECT,INSERT,UPDATE,DELETE ON {table} TO campus_api")
    op.execute("GRANT SELECT,INSERT,UPDATE ON rate_buckets TO campus_api")
    op.execute("""
    CREATE OR REPLACE FUNCTION public.campus_upsert_membership(t text,u text,r text,d text,s integer,sec text,n text)
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public SET row_security=off AS $$
    BEGIN
      IF NOT campus_admin(t) OR u=current_setting('app.user_id',true) OR r NOT IN ('student','faculty','department_admin','institution_admin') THEN
        RAISE EXCEPTION 'Institution administrator permission required';
      END IF;
      IF EXISTS(SELECT 1 FROM memberships WHERE tenant_id=t AND user_id=u AND role='platform_admin') THEN RAISE EXCEPTION 'Operator-managed role'; END IF;
      INSERT INTO memberships(id,tenant_id,user_id,role,department,semester,section,name,active,interests,diet)
      VALUES(gen_random_uuid()::text,t,u,r,d,s,sec,n,true,'','any')
      ON CONFLICT(tenant_id,user_id) DO UPDATE SET role=r,department=d,semester=s,section=sec,name=n;
    END $$;
    REVOKE ALL ON FUNCTION public.campus_upsert_membership(text,text,text,text,integer,text,text) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.campus_upsert_membership(text,text,text,text,integer,text,text) TO campus_api;
    """)


def downgrade():
    # Downgrading this security migration is intentionally not automatic.
    raise RuntimeError("Restore a reviewed database backup to remove security policies.")
