from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Extracts and verifies the token from the Authorization header automatically."""
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload  # contains user_id and role

def require_role(allowed_roles: list[str]):
    """Returns a dependency that only allows users with one of the given roles through."""
    def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="You don't have permission to do this")
        return current_user
    return role_checker
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