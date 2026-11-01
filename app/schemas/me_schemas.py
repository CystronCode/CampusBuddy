from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

class ProfileUpdateRequest(BaseModel):
    branch: Optional[str] = None
    year: Optional[int] = Field(None, ge=1, le=6)
    section: Optional[str] = None
    veg_pref: Optional[bool] = None
    budget_default: Optional[int] = Field(None, gt=0)

class ProfileResponse(BaseModel):
    user: Dict[str, Any]
    profile_complete: bool
