from typing import List, Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI-Powered CRM API"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "supersecretkeyfor-dev-only-change-in-prod"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    DATABASE_URL: str = "postgresql://crm_user:crm_password@localhost:5432/crm_db"
    
    # CORS Origins
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173"]

    # AI & Cold Outreach Settings
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.0-flash"
    REDIS_URL: Optional[str] = "redis://localhost:6379/0"
    ML_EAGER_TRAIN: bool = False

    # Email Service Settings
    GMAIL_ADDRESS: Optional[str] = None
    GMAIL_APP_PASSWORD: Optional[str] = None
    GMAIL_SENDER_NAME: str = "Hamari Technology"
    BREVO_API_KEY: Optional[str] = None
    BREVO_SENDER_EMAIL: Optional[str] = None
    BREVO_SENDER_NAME: str = "Hamari Technology"

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

settings = Settings()

