
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)


# Test 1: Password hashing
password = "AURA_Test_Password_123"

hashed = hash_password(password)

print("Original password:", password)
print("Hashed password:", hashed)
print("Password verification:", verify_password(password, hashed))


# Test 2: Incorrect password
print(
    "Incorrect password verification:",
    verify_password("wrong_password", hashed)
)


# Test 3: JWT generation
token = create_access_token({
    "sub": "1"
})

print("JWT generated:", bool(token))


# Test 4: JWT verification
payload = decode_access_token(token)

print("JWT payload:", payload)
