from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    jina_api_key: str

    pinecone_api_key: str 
    pinecone_index_name: str = "marketing-knowledge"
    pinecone_namespace: str = "marketing"

    embedding_model: str = "jina-embeddings-v5-text-small"
    embedding_dimension: int = 1024

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()