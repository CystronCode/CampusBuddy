"""002_observability_views

Revision ID: 002_observability_views
Revises: 001_initial_schema
Create Date: 2026-11-01 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '002_observability_views'
down_revision: Union[str, None] = '001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UPGRADE_SQL = """
-- 1. Traffic Share by Execution Tier (Target: >70% in Tier 0)
CREATE OR REPLACE VIEW v_traffic_share_by_tier AS
SELECT 
  tier,
  count(*) AS total_queries,
  round((count(*)::numeric / sum(count(*)) OVER ()) * 100, 2) AS percentage_share,
  round(avg(latency_ms), 1) AS avg_latency_ms,
  sum(prompt_tokens) AS total_prompt_tokens,
  sum(completion_tokens) AS total_completion_tokens
FROM query_logs
WHERE ts >= now() - interval '7 days'
GROUP BY tier
ORDER BY tier;

-- 2. Slowest and Failing Intent Diagnostic View
CREATE OR REPLACE VIEW v_intent_performance AS
SELECT 
  coalesce(intent, 'unrouted') AS intent_name,
  count(*) AS total_requests,
  round(avg(latency_ms), 1) AS avg_latency_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms,
  count(*) FILTER (WHERE error IS NOT NULL) AS error_count,
  count(*) FILTER (WHERE thumbs = 1) AS thumbs_up,
  count(*) FILTER (WHERE thumbs = -1) AS thumbs_down
FROM query_logs
WHERE ts >= now() - interval '7 days'
GROUP BY intent
ORDER BY total_requests DESC;

-- 3. Administrative Governance & Version Audit Timeline
CREATE OR REPLACE VIEW v_recent_audit_timeline AS
SELECT 
  a.id,
  a.ts AT TIME ZONE 'Asia/Kolkata' AS ist_timestamp,
  u.email AS actor_email,
  u.role AS actor_role,
  a.action,
  a.target,
  a.detail
FROM audit_log a
LEFT JOIN users u ON u.id = a.actor
ORDER BY a.ts DESC
LIMIT 100;

GRANT SELECT ON v_traffic_share_by_tier, v_intent_performance, v_recent_audit_timeline TO app_read;
"""

DOWNGRADE_SQL = """
DROP VIEW IF EXISTS v_recent_audit_timeline;
DROP VIEW IF EXISTS v_intent_performance;
DROP VIEW IF EXISTS v_traffic_share_by_tier;
"""

def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text(UPGRADE_SQL))

def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text(DOWNGRADE_SQL))
