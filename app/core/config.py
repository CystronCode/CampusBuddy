import os
from pathlib import Path
from pydantic import BaseModel

# Load .env if present
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
except ImportError:
    pass

class Settings(BaseModel):
    DATABASE_URL: str = os.environ.get(
        "DATABASE_URL", 
        "postgresql://app_write:CHANGE_ME_WRITE_SECRET@localhost:5432/postgres"
    )
    DATABASE_URL_READONLY: str = os.environ.get(
        "DATABASE_URL_READONLY", 
        "postgresql://app_read:CHANGE_ME_READ_SECRET@localhost:5432/postgres"
    )
    JWT_SECRET: str = os.environ.get("JWT_SECRET", "super-secret-campus-jwt-key-change-in-prod-32chars")
    COLLEGE_EMAIL_DOMAIN: str = os.environ.get("COLLEGE_EMAIL_DOMAIN", "college.edu").lower()
    EMAIL_API_KEY: str = os.environ.get("EMAIL_API_KEY", "re_mock_test_key")
    EMAIL_FROM: str = os.environ.get("EMAIL_FROM", "auth@campus.edu")
    COOKIE_DOMAIN: str | None = os.environ.get("COOKIE_DOMAIN", None) or None
    COOKIE_SECURE: bool = os.environ.get("COOKIE_SECURE", "false").lower() in ("true", "1", "yes")
    ALLOWED_ORIGINS: list[str] = [
        o.strip() for o in os.environ.get(
            "ALLOWED_ORIGINS", 
            "https://app.campus.edu,http://localhost:3000,http://localhost:8000,http://127.0.0.1:8000"
        ).split(",") if o.strip()
    ]
    STORAGE_ENDPOINT: str = os.environ.get("STORAGE_ENDPOINT", "https://s3.us-east-1.amazonaws.com")
    STORAGE_BUCKET: str = os.environ.get("STORAGE_BUCKET", "campus-intelligence-private")
    STORAGE_ACCESS_KEY: str = os.environ.get("STORAGE_ACCESS_KEY", "mock_storage_access_key")
    STORAGE_SECRET_KEY: str = os.environ.get("STORAGE_SECRET_KEY", "mock_storage_secret_key")
    GEMINI_API_KEY: str = os.environ.get("GEMINI_API_KEY", "mock_gemini_api_key")
    GEMINI_API_KEYS: list[str] = [
        k.strip() for k in os.environ.get(
            "GEMINI_API_KEYS",
            os.environ.get("GEMINI_API_KEY", "mock_gemini_api_key")
        ).split(",") if k.strip()
    ]
    GEMINI_MODEL_ROUTER: str = os.environ.get("GEMINI_MODEL_ROUTER", "gemini-3-flash-preview")
    GEMINI_MODEL_EXTRACT: str = os.environ.get("GEMINI_MODEL_EXTRACT", "gemini-3-flash-preview")
    GEMINI_MODEL_SYNTH: str = os.environ.get("GEMINI_MODEL_SYNTH", "gemini-3-flash-preview")
    EMBEDDING_MODEL: str = os.environ.get("EMBEDDING_MODEL", "gemini-embedding-001")
    RAG_MIN_SIMILARITY: float = float(os.environ.get("RAG_MIN_SIMILARITY", "0.45"))
    MAX_UPLOAD_BYTES: int = int(os.environ.get("MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))  # 10 MB
    MAX_PDF_PAGES: int = int(os.environ.get("MAX_PDF_PAGES", "50"))

settings = Settings()
