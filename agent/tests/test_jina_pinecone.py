from app.core.config import get_settings
from app.knowledge.embeddings.jina import JinaEmbeddingProvider
from app.knowledge.vectorstore.pinecone import PineconeVectorStore


def main() -> None:
    settings = get_settings()

    embedding_provider = JinaEmbeddingProvider(
        api_key=settings.jina_api_key,
        dimensions=settings.embedding_dimension,
    )

    vector_store = PineconeVectorStore(
        api_key=settings.pinecone_api_key,
        index_name=settings.pinecone_index_name,
        dimension=settings.embedding_dimension,
    )

    documents = [
        {
            "id": "test-segmentation",
            "text": (
                "Customer segmentation divides customers into meaningful "
                "groups based on shared characteristics or behaviors."
            ),
        },
        {
            "id": "test-seo",
            "text": (
                "SEO helps search engines discover, understand, and rank "
                "useful content."
            ),
        },
    ]

    try:
        texts = [document["text"] for document in documents]

        embeddings = embedding_provider.embed_documents(texts)

        vectors = [
            {
                "id": document["id"],
                "values": embedding,
                "metadata": {
                    "text": document["text"],
                    "source_type": "test",
                },
            }
            for document, embedding in zip(documents, embeddings)
        ]

        vector_store.upsert(
            vectors,
            namespace=settings.pinecone_namespace,
        )

        print("Vectors successfully upserted.")

        query = "What is customer segmentation?"

        query_embedding = embedding_provider.embed_query(query)

        results = vector_store.query(
            query_embedding,
            namespace=settings.pinecone_namespace,
            top_k=2,
        )

        print("\nQuery:")
        print(query)

        print("\nResults:")

        for match in results.matches:
            print(f"\nID: {match['id']}")
            print(f"Score: {match['score']}")
            print(f"Text: {match['metadata']['text']}")

    finally:
        embedding_provider.close()


if __name__ == "__main__":
    main()