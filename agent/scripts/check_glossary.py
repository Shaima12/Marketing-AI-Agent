
import argparse
import json

from agent.data.glossary import glossary_block, load_glossary


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("question", nargs="?", default="test question")
    parser.add_argument(
        "--all",
        action="store_true",
        help="Render global plus all topic blocks without classification",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Validate YAML and exit without classifying",
    )
    args = parser.parse_args()

    glossary = load_glossary()
    print(f"YAML valid: version={glossary.version}")

    if args.validate_only:
        print("Validation successful.")
        return

    block, metadata = glossary_block(
        args.question,
        route=False if args.all else None,
    )

    print("\nMetadata:")
    print(json.dumps(metadata, indent=2, ensure_ascii=False))
    print("\nRendered glossary:\n")
    print(block)


if __name__ == "__main__":
    main()
