from langchain_google_genai import ChatGoogleGenerativeAI
from agent.config.settings import MODEL


def get_llm(*, thinking_level=None):
    kwargs = {
        "model": MODEL,
        "temperature": 0,
        "max_output_tokens": 16000,       # was 4000: thinking + answer must fit
    }

    # default to low thinking so the model keeps room to write the SQL
    kwargs["thinking_level"] = thinking_level or "low"

    return ChatGoogleGenerativeAI(**kwargs)


def as_text(content) -> str:
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        return "".join(
            item.get("text", "")
            for item in content
            if isinstance(item, dict)
        )

    return str(content)