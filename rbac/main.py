from fastapi import FastAPI, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from database import get_db, engine, Base
from models import User
from auth import hash_password, verify_password, create_access_token, decode_access_token
from pydantic import BaseModel
from auth import require_role


# This creates the actual table in Postgres if it doesn't already exist
# (safe to run every time — it does nothing if the table's already there)
Base.metadata.create_all(bind=engine)

app = FastAPI()

@app.get("/admin/users")
def list_all_users(current_user: dict = Depends(require_role(["admin"])), db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [{"id": u.id, "email": u.email, "role": u.role} for u in users]

# Pydantic models define the "shape" of data we expect in requests —
# FastAPI uses these to validate incoming JSON automatically
class SignupRequest(BaseModel):
    email: str
    password: str
    role: str = "user"  # defaults to "user" unless explicitly set to "admin"


class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/signup")
def signup(request: SignupRequest, db: Session = Depends(get_db)):
    # Check if this email is already registered
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Hash the password before storing anything
    new_user = User(
        email=request.email,
        hashed_password=hash_password(request.password),
        role=request.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "User created successfully", "user_id": new_user.id, "role": new_user.role}


@app.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()

    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user_id=user.id, role=user.role)
    return {"access_token": token, "token_type": "bearer"}


@app.get("/me")
def read_current_user(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="No token provided")

    # Expecting header format: "Bearer <token>"
    token = authorization.replace("Bearer ", "")
    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return {"user_id": payload["user_id"], "role": payload["role"]}