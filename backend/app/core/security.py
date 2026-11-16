
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import (
    InvalidHashError,
    VerificationError,
    VerifyMismatchError,
)
from jose import JWTError, jwt

from app.core.config import (
    JWT_SECRET_KEY,
    JWT_ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)


# Argon2 password hashing
password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    """Hash a user's password using Argon2."""
    return password_hasher.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:
    """Verify a password against its stored hash."""
    try:
        return password_hasher.verify(
            hashed_password,
            plain_password
        )
    except (
        VerifyMismatchError,
        VerificationError,
        InvalidHashError,
    ):
        return False


# JWT access token generation
def create_access_token(
    data: dict,
    expires_delta: timedelta | None = None
) -> str:
    """Generate a signed JWT access token."""

    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + (
        expires_delta
        or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(
        to_encode,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM
    )

    return encoded_jwt


# JWT access token verification
def decode_access_token(token: str) -> dict | None:
    """Decode and validate a JWT access token."""

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM]
        )

        return payload

    except JWTError:
        return None
