from pydantic_settings import BaseSettings,SettingsConfigDict

class Settings(BaseSettings):
    redis_url: str = "redis://localhost:6379/0"
    database_url: str = "postgresql://postgres:postgres@localhost:5432/collab"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algoritm: str = "HS256"
    snapshot_interval: int = 30
    stream_maxlen: int = 10000
    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()