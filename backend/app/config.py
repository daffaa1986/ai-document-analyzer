from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg2://analyzer:change-me@db:5432/documents"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    max_upload_mb: int = 5

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
