from dotenv import load_dotenv
import os

load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY")
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta

# This sets up bcrypt as the hashing algorithm we'll use for passwords
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Secret key used to sign JWTs — this must stay private, never share it or push it to GitHub
# For now we're hardcoding it, but this should move to a .env file soon (we'll do that later)
SECRET_KEY = "temporary-dev-secret-change-this-later"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60


def hash_password(plain_password: str) -> str:
    """Takes a plain-text password and returns a scrambled, one-way hashed version."""
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Checks if a plain-text password matches a previously hashed one."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: int, role: str) -> str:
    """Creates a signed JWT containing the user's id and role, valid for 60 minutes."""
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": expire
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str):
    """Verifies a JWT and returns its contents (user_id, role) — or None if invalid/expired."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None