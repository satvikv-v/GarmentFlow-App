"""
JWT helpers for GarmentFlow.

Uses python-jose (already in requirements.txt) with settings pulled from
app.core.config — SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES.

Functions
---------
create_access_token  — sign a new JWT with an expiry claim
decode_access_token  — verify and decode a JWT, returning the TokenPayload
                       (or raising HTTPException 401 on failure)
"""

from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from fastapi import HTTPException, status

from app.core.config import settings
from app.schemas.auth import TokenPayload


def create_access_token(data: dict) -> str:
    """
    Create a signed JWT.

    ``data`` must contain at least the keys that TokenPayload expects
    (sub, role, user_id).  An ``exp`` claim is added automatically.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> TokenPayload:
    """
    Verify the token signature/expiry and return a parsed TokenPayload.

    Raises ``HTTPException(401)`` on any validation failure so callers
    (deps.py) don't need to handle raw JWTErrors.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        # Validate required claims are present
        sub: str | None = payload.get("sub")
        role: str | None = payload.get("role")
        user_id: int | None = payload.get("user_id")
        if sub is None or role is None or user_id is None:
            raise credentials_exception
        return TokenPayload(sub=sub, role=role, user_id=user_id)
    except JWTError:
        raise credentials_exception
