from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/0"
    INTERNAL_API_KEY: str
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 465
    SMTP_USER: str
    SMTP_PASSWORD: str
    EMAIL_SENDER: str
    APP_BASE_URL: str = "http://localhost:3000"
    # Per-order delay after first payment failure before auto-cancel (default 5 minutes)
    PAYMENT_CANCEL_DELAY_SECONDS: int = 300
    # Beat backup for unpaid orders still open after this many hours
    AUTO_CANCEL_HOURS: int = 120
    AUTO_CANCEL_SCHEDULE_MINUTES: int = 60


settings = Settings()
