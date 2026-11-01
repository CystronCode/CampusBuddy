import os
import logging
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import jwt
from cachetools import TTLCache
from app.core.config import settings
from app.core.database import get_read_db
from app.services.auth_service import verify_csrf_token

logger = logging.getLogger("campus.security")
JWT_SECRET = settings.JWT_SECRET
ALLOWED_ORIGINS = settings.ALLOWED_ORIGINS

# 60-second LRU session cache for high-throughput student read routes
session_cache: TTLCache[str, Dict[str, Any]] = TTLCache(maxsize=1000, ttl=60)

def evict_session_cache(user_id: str):
    """Evicted synchronously whenever user profile or role changes."""
    session_cache.pop(str(user_id), None)

def set_mock_user_in_cache(user_id: str, user_data: Dict[str, Any]):
    """Helper to populate session cache in test environments."""
    session_cache[str(user_id)] = user_data

class SessionSecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        method = request.method

        # 1. Exempt public endpoints, OpenAPI documentation, MCP protocol, and Next.js /v1 Bearer routes
        if (
            path in ("/", "/health", "/api/healthz", "/api/auth/csrf", "/api/auth/logout", "/docs", "/openapi.json", "/redoc")
            or path.startswith("/api/auth/otp/")
            or (path.startswith("/api/files/") and path.endswith("/raw"))
            or path.startswith("/mcp")
            or path.startswith("/v1/")
        ):
            return await call_next(request)

        try:
            # 2. Origin Header Verification for state-changing calls
            if method in ("POST", "PATCH", "DELETE", "PUT"):
                origin = request.headers.get("Origin")
                if origin and origin not in ALLOWED_ORIGINS:
                    return JSONResponse(
                        status_code=status.HTTP_403_FORBIDDEN,
                        content={"detail": "Cross-origin request rejected."}
                    )

            # 3. Extract Session Cookie
            cookie_token = request.cookies.get("campus_session")
            if not cookie_token:
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": "Session cookie required."}
                )

            try:
                payload = jwt.decode(cookie_token, JWT_SECRET, algorithms=["HS256"])
                user_id = payload["sub"]
                jwt_token_ver = payload.get("token_version", 0)
            except (jwt.PyJWTError, KeyError):
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": "Invalid session token."}
                )

            # 4. Determine if Immediate DB Re-Read is mandatory
            is_state_changing = method in ("POST", "PATCH", "DELETE", "PUT")
            is_privileged_route = any(path.startswith(prefix) for prefix in (
                "/api/uploads", "/api/submissions", "/api/files", "/api/doc-keys", "/api/admin"
            ))

            user_data = None
            if not is_state_changing and not is_privileged_route:
                user_data = session_cache.get(user_id)

            if user_data is None:
                # Direct DB read
                try:
                    async with get_read_db() as conn:
                        cursor = await conn.execute(
                            """SELECT id, email, role, branch, year, section, club, 
                                      veg_pref, budget_default, token_version 
                               FROM users WHERE id = %s""",
                            (user_id,)
                        )
                        user_data = await cursor.fetchone()
                except Exception as db_err:
                    logger.warning("DB read in middleware failed, checking memory cache: %s", db_err)
                    user_data = session_cache.get(user_id)

                if not user_data:
                    return JSONResponse(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        content={"detail": "Account not found."}
                    )
                
                # Store in short-lived read cache
                session_cache[user_id] = user_data

            # 5. Immediate Privilege Revocation Check
            if user_data.get("token_version") != jwt_token_ver:
                session_cache.pop(user_id, None)
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": "Session invalidated. Please log in again."}
                )

            # 6. CSRF Token Verification for state-changing routes
            if is_state_changing:
                csrf_header = request.headers.get("X-CSRF-Token")
                if not csrf_header or not verify_csrf_token(csrf_header, user_id, user_data.get("token_version", 0)):
                    return JSONResponse(
                        status_code=status.HTTP_403_FORBIDDEN,
                        content={"detail": "CSRF token validation failed."}
                    )

            # Inject user identity into request state
            request.state.user = user_data
            request.state.user_id = str(user_data["id"])
            request.state.role = user_data["role"]

            return await call_next(request)

        except HTTPException as http_exc:
            return JSONResponse(
                status_code=http_exc.status_code,
                content={"detail": http_exc.detail}
            )
        except Exception as exc:
            logger.exception("Unexpected error in SessionSecurityMiddleware: %s", exc)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"detail": "Internal server error."}
            )
