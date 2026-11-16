
from app.schemas.auth import (
    UserCreate,
    UserLogin,
    UserResponse,
    Token,
)

# Test registration schema
user = UserCreate(
    username="aura_user",
    email="aura@example.com",
    password="AURA_Test_123"
)

print("Registration schema:", user)

# Test login schema
login = UserLogin(
    email="aura@example.com",
    password="AURA_Test_123"
)

print("Login schema:", login)

# Test token schema
token = Token(
    access_token="sample_jwt_token"
)

print("Token type:", token.token_type)

print("All authentication schema tests passed!")
