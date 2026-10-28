# MCP integration

The official Python MCP SDK exposes fourteen read-only tools. Tool inputs are Pydantic schemas; dispatcher validation remains authoritative. The same dispatcher backs REST tool calls and the conversational router.

```text
get_my_timetable          get_next_class
get_faculty_profile       find_classroom
search_canteen_items      optimize_meal_budget
search_documents         get_latest_notices
get_examination_schedule list_campus_events
detect_schedule_conflicts find_free_time_slots
search_authorized_emails get_calendar_events
```

## Stdio

Configure a compatible MCP client with your Python executable, repository working directory and module arguments:

```json
{
  "mcpServers": {
    "campusos": {
      "command": "ABSOLUTE_PATH_TO_VENV_PYTHON",
      "args": ["-m", "backend.app.mcp_server"],
      "cwd": "ABSOLUTE_REPOSITORY_PATH",
      "env": {
        "CAMPUS_ACCESS_TOKEN": "CURRENT_SUPABASE_ACCESS_TOKEN",
        "CAMPUS_TENANT_ID": "AUTHORIZED_INSTITUTION_UUID"
      }
    }
  }
}
```

Store tokens through the client's secret mechanism, not a committed configuration. The adapter verifies the token and active membership on every tool execution. Tools cannot supply a different user ID. Token expiry produces an authentication error; refresh through Supabase and update the client secret.

Run `python -m backend.app.mcp_client` to initialize, discover tools and perform three actual protocol calls (next class, food filtering and document search). `backend/tests/test_mcp.py` independently verifies three stdio round trips using RSA-signed test credentials and a local JWKS provider. `artifacts/mcp-verification.json` records that executed evidence.

## Streamable HTTP

The FastAPI server mounts the SDK at `/mcp/`. Every request must include a current bearer token and `X-Tenant-ID`. Authentication is checked before discovery and again before tool execution. There is no public campus-data endpoint. This is a resource server with pre-provisioned bearer credentials; dynamic OAuth client registration/discovery for third-party MCP clients is not implemented.

Clients supporting custom headers can connect to `https://YOUR_API/mcp/`. Configure the backend's trusted host/origin settings and HTTPS proxy for the actual deployment. Apply reverse-proxy rate limits in addition to database tool limits. Never place long-lived credentials in URLs.

HTTP authentication denial, authorized initialization, discovery of all fourteen tools and a real authorized tool call are tested locally. Complete external-client acceptance testing against the staging deployment before publishing the endpoint. Both stdio and local authenticated HTTP have executed verification.
