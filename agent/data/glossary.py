
import hashlib
import json
import os
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator

HERE = Path(__file__).resolve().parent
GLOSSARY_PATH = HERE / "glossary.yaml"
CACHE_PATH = HERE / "topics_cache.json"


class TextItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    definition: str | None = None
    rule: str | None = None

    @model_validator(mode="after")
    def validate_content(self):
        values = [v for v in (self.definition, self.rule) if v is not None]
        if len(values) != 1 or not values[0].strip():
            raise ValueError(
                "Each item must contain exactly one non-empty "
                "'definition' or 'rule'"
            )
        return self


class TopicBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")

    metrics: dict[str, TextItem] = Field(default_factory=dict)
    definitions: dict[str, TextItem] = Field(default_factory=dict)
    rules: dict[str, TextItem] = Field(default_factory=dict)


class Glossary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: int
    topics: dict[str, str]
    global_: TopicBlock = Field(alias="global")
    promotions_pricing: TopicBlock
    customers_retention: TopicBlock
    acquisition_economics: TopicBlock

    @model_validator(mode="after")
    def validate_glossary(self):
        if self.version < 1:
            raise ValueError("version must be >= 1")
        if not self.topics:
            raise ValueError("At least one topic is required")

        topic_blocks = {
            "promotions_pricing": self.promotions_pricing,
            "customers_retention": self.customers_retention,
            "acquisition_economics": self.acquisition_economics,
        }

        if set(self.topics) != set(topic_blocks):
            raise ValueError(
                "Topic descriptions must match the configured topic blocks. "
                f"Expected {sorted(topic_blocks)}, got {sorted(self.topics)}"
            )

        for topic_id, description in self.topics.items():
            if not topic_id.strip() or not description.strip():
                raise ValueError("Topic IDs and descriptions cannot be empty")

        return self


def load_glossary(path: Path = GLOSSARY_PATH) -> Glossary:
    with path.open("r", encoding="utf-8") as f:
        raw = yaml.safe_load(f)

    if not isinstance(raw, dict):
        raise ValueError("glossary.yaml must contain a YAML mapping")

    return Glossary.model_validate(raw)


def classify_topics(question: str, glossary: Glossary) -> list[str] | None:
    """
    Return validated topic IDs.
    None means classification failed; include every topic block.
    An empty list is a valid classification meaning no topic matched.
    """
    topic_payload = json.dumps(
        {"version": glossary.version, "topics": glossary.topics},
        sort_keys=True,
        ensure_ascii=False,
    )
    topic_hash = hashlib.sha256(topic_payload.encode("utf-8")).hexdigest()
    cache_key = hashlib.sha256(
        f"{topic_hash}|{question}".encode("utf-8")
    ).hexdigest()

    cache = {}
    try:
        if CACHE_PATH.exists():
            loaded = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                cache = loaded

        cached = cache.get(cache_key)
        if (
            isinstance(cached, list)
            and all(isinstance(t, str) and t in glossary.topics for t in cached)
        ):
            return list(dict.fromkeys(cached))
    except (OSError, ValueError, TypeError):
        cache = {}

    try:
        # Reuse the existing classifier integration.
        from agent.retrieval.retrieval import groq_chat, GROQ_MODEL

        topic_list = "\n".join(
            f"- {topic_id}: {description}"
            for topic_id, description in glossary.topics.items()
        )

        prompt = f"""
Classify the business question into every relevant topic.

Allowed topics:
{topic_list}

Return ONLY a JSON array of topic IDs.
Choose multiple topics when needed.
Return [] only when neither topic is relevant.
Never invent topic IDs.

Question:
{question}
""".strip()

        raw = groq_chat(GROQ_MODEL, prompt).strip()
        selected = json.loads(raw)

        if not isinstance(selected, list):
            return None

        if not all(
            isinstance(topic, str) and topic in glossary.topics
            for topic in selected
        ):
            return None

        selected = list(dict.fromkeys(selected))

        try:
            cache[cache_key] = selected
            CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
            CACHE_PATH.write_text(
                json.dumps(cache, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
        except (OSError, ValueError, TypeError):
            # Cache failure must not invalidate a successful classification.
            pass

        return selected

    except Exception:
        # Includes API errors, malformed responses, and import errors.
        return None


def render_block(name: str, block: TopicBlock) -> list[str]:
    lines = [f"## {name.replace('_', ' ').title()}"]

    for category, heading in (
        ("metrics", "Metrics"),
        ("definitions", "Definitions"),
        ("rules", "Rules"),
    ):
        items = getattr(block, category)
        if not items:
            continue

        lines.append(f"### {heading}")

        for item_id, item in items.items():
            value = item.definition or item.rule
            lines.append(f"- {item_id}: {value}")

    return lines


def glossary_block(
    question: str,
    route: bool | None = None,
) -> tuple[str, dict]:
    """
    Always include global conventions.
    Add complete blocks for selected topics.
    If routing is disabled or classification fails, include every block.
    """
    if route is None:
        route = os.environ.get("GLOSSARY_ROUTING", "on").lower() != "off"

    glossary = load_glossary()

    topics = classify_topics(question, glossary) if route else None
    fallback_to_all = route and topics is None

    if not route or fallback_to_all:
        selected_topics = list(glossary.topics)
    else:
        selected_topics = topics or []

    blocks = {"global": glossary.global_}
    all_topic_blocks = {
        "promotions_pricing": glossary.promotions_pricing,
        "customers_retention": glossary.customers_retention,
        "acquisition_economics": glossary.acquisition_economics,
    }

    lines = [
        "# BUSINESS GLOSSARY",
        "Global conventions apply unless the brand's own data dictionary "
        "defines the concept differently. The brand's data dictionary wins "
        "when definitions conflict.",
        "",
    ]

    lines.extend(render_block("global", blocks["global"]))

    for topic_id in selected_topics:
        lines.append("")
        lines.extend(render_block(topic_id, all_topic_blocks[topic_id]))

    metadata = {
        "topics": selected_topics,
        "routing_enabled": route,
        "fallback_to_all": fallback_to_all,
        "glossary_version": glossary.version,
    }

    return "\n".join(lines), metadata
