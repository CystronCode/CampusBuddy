from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field

class OTPRequest(BaseModel):
    email: EmailStr

class OTPVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)

class OTPVerifyResponse(BaseModel):
    csrf_token: str
    user: Dict[str, Any]
    profile_complete: bool

class MessageResponse(BaseModel):
    message: str

class CSRFResponse(BaseModel):
    csrf_token: str
