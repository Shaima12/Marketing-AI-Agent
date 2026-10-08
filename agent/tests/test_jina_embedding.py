from app.core.config import get_settings
from app.knowledge.embeddings.jina import JinaEmbeddingProvider


def main() -> None:
    settings = get_settings()

    provider = JinaEmbeddingProvider(
        api_key=settings.jina_api_key,
        dimensions=settings.embedding_dimension,
    )

    try:
        documents = provider.embed_documents(
            [
                "Customer segmentation divides customers into meaningful groups.",
                "SEO helps search engines understand and discover web content.",
            ]
        )

        query = provider.embed_query(
            "What is customer segmentation?"
        )

        print(f"Document count: {len(documents)}")
        print(f"Document dimension: {len(documents[0])}")
        print(f"Query dimension: {len(query)}")
        print(f"First 5 query values: {query[:5]}")

    finally:
        provider.close()


if __name__ == "__main__":
    main()