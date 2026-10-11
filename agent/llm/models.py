from langchain_google_genai import ChatGoogleGenerativeAI
from agent.config.settings import MODEL


def get_llm():
    return ChatGoogleGenerativeAI(
        model=MODEL,
        temperature=0,
        max_output_tokens=4000,
    )


def as_text(content) -> str:
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        return "".join(
            block.get("text", "")
            for block in content
            if isinstance(block, dict)
        )

    return str(content)