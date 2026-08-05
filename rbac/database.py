from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# This is the connection string — it tells Python how to reach your Postgres database
# Format: postgresql://username:password@host:port/database_name
DATABASE_URL = "postgresql://postgres:neocloud123@localhost:5433/neocloud"

# The "engine" is the actual connection to the database
engine = create_engine(DATABASE_URL)

# A "session" is like a temporary workspace for talking to the database —
# you open one, do some work (read/write data), then close it
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base is what your table models (in models.py) will inherit from,
# so SQLAlchemy knows they represent database tables
Base = declarative_base()

# This function gives you a fresh session whenever an API endpoint needs one,
# and automatically closes it when the endpoint is done — even if something errors
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()