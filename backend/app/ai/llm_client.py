"""Minimal OpenAI-compatible LLM client.

Reads credentials from the project's own USER_LLM_* environment variables
(see config.py). The API key is only used in the Authorization header and is
never logged or printed. When no key is configured, `llm_enabled()` is False
and callers should fall back to the local rule-based analyst.
"""

from __future__ import annotations

import json

import requests

from .. import config

SYSTEM_PROMPT = (
    "You are a precise, senior data analyst. You answer questions using ONLY "
    "the data and statistics provided to you. Never invent numbers, rows or "
    "facts that are not in the supplied context. If the answer is not in the "
    "context, say so clearly. Prefer short, concrete answers that cite the "
    "actual numbers."
)


def chat(messages: list[dict], temperature: float | None = None,
         max_tokens: int = 900) -> str:
    """Call the configured chat completion endpoint and return assistant text."""
    if not config.llm_enabled():
        raise RuntimeError("LLM is not configured")

    url = f"{config.USER_LLM_BASE_URL.rstrip('/')}/chat/completions"
    payload = {
        "model": config.USER_LLM_MODEL,
        "messages": messages,
        "temperature": config.LLM_TEMPERATURE if temperature is None else temperature,
        "max_tokens": max_tokens,
    }
    headers = {
        "Authorization": f"Bearer {config.USER_LLM_API_KEY}",
        "Content-Type": "application/json",
    }

    resp = requests.post(url, json=payload, headers=headers, timeout=config.LLM_TIMEOUT_SECONDS)
    resp.raise_for_status()
    data = resp.json()
    try:
        return data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"Unexpected LLM response shape: {exc}") from exc


def chat_json(messages: list[dict], **kwargs) -> dict:
    """Call the LLM and parse the response as JSON, with light recovery."""
    text = chat(messages, **kwargs)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Some models wrap JSON in markdown fences.
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            return json.loads(text[start:end + 1])
        raise ValueError(f"LLM returned non-JSON response: {text[:200]}")
