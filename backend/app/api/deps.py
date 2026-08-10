"""
FastAPI dependency functions for GarmentFlow.

get_current_user
    Extracts the Bearer token from the Authorization header, decodes it,
    and loads the matching User row from the database.  Raises 401 if
    anything fails (bad token, expired, user not found / inactive).

require_role(*roles)
    Factory that returns a dependency which calls get_current_user and then
    asserts the user's role is one of the permitted values.  Raises 403 if not.

Usage in route functions
------------------------
    from app.api.deps import get_current_user, require_role
    from app.models.enums import UserRole

    @router.get("/protected")
    def protected(user = Depends(get_current_user)):
        ...

    @router.post("/owner-only")
    def owner_only(user = Depends(require_role(UserRole.OWNER))):
        ...
"""

from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.jwt import decode_access_token
from app.database.session import get_db
from app.models.enums import UserRole
from app.models.user import User

# auto_error=False stops FastAPI returning its default 403 for a completely
# missing Authorization header.  We raise 401 manually instead, keeping 403
# strictly for require_role() failures (valid token, wrong role).
bearer_scheme = HTTPBearer(auto_error=False)

_no_credentials = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    credentials: Annotated[
        Optional[HTTPAuthorizationCredentials], Depends(bearer_scheme)
    ],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """Decode the JWT and return the active User from the database."""
    if credentials is None:
        raise _no_credentials
    payload = decode_access_token(credentials.credentials)

    user = db.query(User).filter(User.id == payload.user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user account",
        )
    return user


def require_role(*roles: UserRole):
    """
    Return a FastAPI dependency that only passes through users whose role
    is in the provided set.

    Example
    -------
        Depends(require_role(UserRole.OWNER, UserRole.PRODUCTION_MANAGER))
    """
    def _check(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access denied. Required role(s): "
                    f"{', '.join(r.value for r in roles)}."
                ),
            )
        return user

    return _check
