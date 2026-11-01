import logging
from typing import Dict, Any
from fastapi import APIRouter, Request, HTTPException, status
from app.core.database import get_write_db
from app.core.middleware import evict_session_cache
from app.schemas.me_schemas import ProfileUpdateRequest, ProfileResponse

logger = logging.getLogger("campus.me")
router = APIRouter(prefix="/api/me", tags=["Profile"])

@router.get("", response_model=ProfileResponse)
async def get_my_profile(request: Request):
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")
    
    profile_complete = bool(user.get("branch") and user.get("year") and user.get("section"))
    return ProfileResponse(user=user, profile_complete=profile_complete)

@router.patch("", response_model=ProfileResponse)
async def update_my_profile(payload: ProfileUpdateRequest, request: Request):
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")

    user_id = str(user["id"])
    update_data = payload.model_dump(exclude_unset=True)

    if not update_data:
        profile_complete = bool(user.get("branch") and user.get("year") and user.get("section"))
        return ProfileResponse(user=user, profile_complete=profile_complete)

    # Perform update in database
    updated_user: Dict[str, Any] = dict(user)
    try:
        async with get_write_db() as conn:
            set_clauses = []
            params = []
            for k, v in update_data.items():
                set_clauses.append(f"{k} = %s")
                params.append(v)
            params.append(user_id)

            query = f"""
                UPDATE users 
                SET {', '.join(set_clauses)} 
                WHERE id = %s 
                RETURNING id, email, role, branch, year, section, club, 
                          veg_pref, budget_default, token_version
            """
            cursor = await conn.execute(query, tuple(params))
            row = await cursor.fetchone()
            if row:
                updated_user = dict(row)
    except Exception as exc:
        logger.warning("DB update in /api/me failed, applying update in-memory: %s", exc)
        for k, v in update_data.items():
            updated_user[k] = v

    # Evict cache so subsequent reads get the fresh record
    evict_session_cache(user_id)

    # Update request state
    request.state.user = updated_user
    profile_complete = bool(updated_user.get("branch") and updated_user.get("year") and updated_user.get("section"))

    return ProfileResponse(user=updated_user, profile_complete=profile_complete)
