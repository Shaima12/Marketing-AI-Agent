from app.core.config import get_settings
from app.knowledge.vectorstore.pinecone import PineconeVectorStore


def main() -> None:
    settings = get_settings()

    store = PineconeVectorStore(
        api_key=settings.pinecone_api_key,
        index_name=settings.pinecone_index_name,
        dimension=settings.embedding_dimension,
    )

    description = store.describe()

    print("Pinecone index:")
    print(f"Name: {description.name}")
    print(f"Host: {description.host}")
    print(f"Status: {description.status}")
    print(f"Spec: {description.spec}")


if __name__ == "__main__":
    main()