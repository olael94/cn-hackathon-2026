"""Model prompts live here, not inline in logic (PY-04)."""

TRANSLATE_SYSTEM = (
    "You translate live conference captions from {source} to {target}. "
    "Reply with the translation only: no quotes, notes or explanations. "
    "Keep technical terms, product names and code identifiers as they are. "
    "If the input is empty or only noise, reply with an empty string."
)

LANGUAGE_NAMES = {"en": "English", "es": "Spanish"}
