"""
Authentication router — two endpoints:

POST /auth/login
    Accepts JSON { username, password }.
    Returns a Bearer JWT on success, 401 on bad credentials.

    NOTE: We intentionally accept JSON (LoginRequest schema) rather than the
    OAuth2 form-encoded body that OAuth2PasswordRequestForm expects.  The
    Swagger UI "Authorize" button sends form data to the tokenUrl, but all
    real API calls from the frontend will use JSON.  The oauth2_scheme in
    deps.py still extracts the Bearer token from the Authorization header
    correctly regardless of how the token was obtained.

GET /auth/me
    Returns the current user's profile (no hashed_password) derived from
    the Bearer token in the Authorization header.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Annotated

from app.core.jwt import create_access_token
from app.core.security import verify_password
from app.database.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserOut
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(
    body: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    """
    Verify credentials and return a signed JWT.

    Errors
    ------
    401  — username not found or password mismatch.
    401  — account is inactive.
    """
    user: User | None = (
        db.query(User).filter(User.username == body.username).first()
    )

    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive",
        )

    token = create_access_token(
        data={"sub": user.username, "role": user.role.value, "user_id": user.id}
    )
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserOut)
def me(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    """Return the authenticated user's profile."""
    return current_user
