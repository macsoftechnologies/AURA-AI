
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# Registration request
class UserCreate(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=50
    )

    email: EmailStr

    password: str = Field(
        min_length=8,
        max_length=128
    )


# Login request
class UserLogin(BaseModel):
    email: EmailStr

    password: str = Field(
        min_length=1,
        max_length=128
    )


# User information returned by the API
class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# JWT token response
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# Information extracted from JWT
class TokenData(BaseModel):
    user_id: int
