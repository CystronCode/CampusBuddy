import os
import logging
from fastapi import APIRouter, Request, Response, HTTPException, status
from app.core.config import settings
from app.schemas.auth_schemas import (
    OTPRequest, 
    OTPVerifyRequest, 
    OTPVerifyResponse, 
    MessageResponse, 
    CSRFResponse
)
from app.services.auth_service import (
    request_otp, 
    verify_otp, 
    generate_csrf_token
)

logger = logging.getLogger("campus.auth")
router = APIRouter(prefix="/api/auth", tags=["Authentication"])

COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() == "true"
COOKIE_DOMAIN = settings.COOKIE_DOMAIN

@router.post("/otp/request", response_model=MessageResponse)
async def handle_request_otp(payload: OTPRequest, request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    result = await request_otp(payload.email, client_ip=client_ip)
    return MessageResponse(message=result["message"])

@router.post("/otp/verify", response_model=OTPVerifyResponse)
async def handle_verify_otp(payload: OTPVerifyRequest, response: Response):
    result = await verify_otp(payload.email, payload.code)
    
    # Issue 7-day session cookie
    response.set_cookie(
        key="campus_session",
        value=result["jwt_token"],
        max_age=7 * 24 * 3600,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        domain=COOKIE_DOMAIN,
        path="/api"
    )
    
    return OTPVerifyResponse(
        csrf_token=result["csrf_token"],
        user=result["user"],
        profile_complete=result["profile_complete"]
    )

@router.post("/logout", response_model=MessageResponse)
async def handle_logout(response: Response):
    response.delete_cookie(
        key="campus_session",
        domain=COOKIE_DOMAIN,
        path="/api"
    )
    return MessageResponse(message="Logged out successfully.")

@router.get("/csrf", response_model=CSRFResponse)
async def handle_get_csrf(request: Request):
    # If the user is logged in via request.state or cookie, bind to user_id:token_version
    user = getattr(request.state, "user", None)
    user_id = str(user["id"]) if user else None
    token_version = user.get("token_version", 0) if user else 0

    if not user_id:
        cookie_token = request.cookies.get("campus_session")
        if cookie_token:
            try:
                import jwt
                payload = jwt.decode(cookie_token, settings.JWT_SECRET, algorithms=["HS256"])
                user_id = payload.get("sub")
                token_version = payload.get("token_version", 0)
            except Exception:
                pass

    if user_id:
        token = generate_csrf_token(str(user_id), token_version)
    else:
        token = generate_csrf_token("anonymous", 0)
    return CSRFResponse(csrf_token=token)
