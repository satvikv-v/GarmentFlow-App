from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "GarmentFlow"

    DATABASE_URL: str = "postgresql+psycopg2://garmentflow:garmentflow@localhost:5432/garmentflow"

    SECRET_KEY: str = "change-me-in-.env"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8-hour shift-length session

    class Config:
        env_file = ".env"


settings = Settings()
