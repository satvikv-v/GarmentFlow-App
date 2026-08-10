"""
Pydantic schemas for authentication endpoints.

LoginRequest  — body of POST /auth/login
TokenResponse — response of POST /auth/login (the JWT + metadata)
TokenPayload  — what we embed in and decode from the JWT
UserOut        — safe user representation returned by GET /auth/me
"""

from pydantic import BaseModel, EmailStr

from app.models.enums import UserRole


# ---------------------------------------------------------------------------
# Request / response shapes for the auth endpoints
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------------------------------------------------------------------------
# Internal JWT payload (encoded into / decoded from the token)
# ---------------------------------------------------------------------------

class TokenPayload(BaseModel):
    sub: str          # username
    role: UserRole
    user_id: int


# ---------------------------------------------------------------------------
# Public user representation (never exposes hashed_password)
# ---------------------------------------------------------------------------

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}
