"""Application configuration.

Secrets such as the LLM API key are read from environment variables that the
*user* of this project controls (USER_LLM_*). No defaults or placeholder
values are baked into the codebase.
"""

import os

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "50"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

ALLOWED_EXTENSIONS = {".csv", ".tsv", ".xlsx", ".xls"}

# Session / dataset lifecycle
SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", "7200"))
PREVIEW_ROWS = int(os.getenv("PREVIEW_ROWS", "50"))
MAX_PROFILE_ROWS = int(os.getenv("MAX_PROFILE_ROWS", "200000"))
MAX_ANALYZED_ROWS = int(os.getenv("MAX_ANALYZED_ROWS", "200000"))
CHART_SAMPLE_ROWS = int(os.getenv("CHART_SAMPLE_ROWS", "2000"))
TOP_K_CATEGORIES = int(os.getenv("TOP_K_CATEGORIES", "10"))

# Security / robustness
RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "60"))
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
# Comma-separated list of allowed CORS origins; "*" allows all (default).
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

# LLM configuration (user-supplied, optional). When the key is missing the
# app runs in a fully local, rule-based mode.
USER_LLM_API_KEY = os.getenv("USER_LLM_API_KEY", "").strip()
USER_LLM_BASE_URL = os.getenv("USER_LLM_BASE_URL", "https://api.deepseek.com/v1").strip()
USER_LLM_MODEL = os.getenv("USER_LLM_MODEL", "deepseek-chat").strip()
LLM_TIMEOUT_SECONDS = int(os.getenv("LLM_TIMEOUT_SECONDS", "60"))
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.1"))


def llm_enabled() -> bool:
    return bool(USER_LLM_API_KEY)
