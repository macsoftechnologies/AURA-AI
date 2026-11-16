
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.user import User
from app.schemas.auth import (
    UserCreate,
    UserLogin,
    UserResponse,
    Token,
)
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
)
from app.core.dependencies import get_current_user


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)


# -----------------------------
# USER REGISTRATION
# -----------------------------
@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED
)
def register_user(
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    # Normalize email
    email = str(user_data.email).strip().lower()

    # Check whether email already exists
    existing_user = db.scalar(
        select(User).where(User.email == email)
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists"
        )

    # Hash password
    hashed_password = hash_password(user_data.password)

    # Create user
    new_user = User(
        username=user_data.username.strip(),
        email=email,
        hashed_password=hashed_password
    )

    db.add(new_user)

    try:
        db.commit()
        db.refresh(new_user)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists"
        )

    return new_user


# -----------------------------
# USER LOGIN
# -----------------------------
@router.post(
    "/login",
    response_model=Token
)
def login_user(
    user_data: UserLogin,
    db: Session = Depends(get_db)
):
    email = str(user_data.email).strip().lower()

    # Find user
    user = db.scalar(
        select(User).where(User.email == email)
    )

    # Verify credentials
    if (
        user is None
        or not verify_password(
            user_data.password,
            user.hashed_password
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is inactive"
        )

    # Generate JWT
    access_token = create_access_token(
        data={"sub": str(user.id)}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


# -----------------------------
# GET CURRENT USER
# -----------------------------
@router.get(
    "/me",
    response_model=UserResponse
)
def get_my_profile(
    current_user: User = Depends(get_current_user)
):
    return current_user
