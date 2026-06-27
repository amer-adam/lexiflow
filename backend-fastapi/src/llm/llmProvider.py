import os
import threading
import time

import requests

from src.rateLimiter import RateLimiter

# Defaults per provider, so swapping providers is just an env var change - no
# code change required. Any provider that speaks the OpenAI-compatible chat
# completions API can be plugged in this way (mirrors
# src/whisper/apiWhisperContainer.py's PROVIDER_DEFAULTS pattern).
PROVIDER_DEFAULTS = {
    "deepseek": {
        "base_url": "https://api.deepseek.com",
        # "deepseek-chat" is a compatibility alias for this and is slated for
        # deprecation 2026/07/24 - use the explicit model id directly.
        "model": "deepseek-v4-flash",
        "api_key_env": "DEEPSEEK_API_KEY",
        "rate_limit": 60,
    },
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "model": "qwen/qwen3-32b",
        "api_key_env": "GROQ_API_KEY",
        "rate_limit": 60,
    },
}


class LlmProvider:
    """
    Thin OpenAI-compatible chat completions client. Swap providers/models via
    LLM_PROVIDER / LLM_MODEL env vars (or the explicit constructor args) - no
    code change needed to try a different provider.
    """

    _rate_limiters = {}
    _rate_limiters_lock = threading.Lock()

    def __init__(self, provider: str = None, model: str = None):
        self.provider = (provider or os.environ.get("LLM_PROVIDER", "deepseek")).lower()
        defaults = PROVIDER_DEFAULTS.get(self.provider)

        if defaults is None:
            raise ValueError(
                f"Unknown LLM provider '{self.provider}'. Available: {', '.join(PROVIDER_DEFAULTS)}"
            )

        self.base_url = os.environ.get("LLM_BASE_URL", defaults["base_url"]).rstrip("/")
        self.model = model or os.environ.get("LLM_MODEL", defaults["model"])
        self.api_key = os.environ.get("LLM_API_KEY") or os.environ.get(defaults["api_key_env"])

        if not self.api_key:
            raise ValueError(
                f"Missing API key for LLM provider '{self.provider}'. "
                f"Set LLM_API_KEY or {defaults['api_key_env']} in the environment."
            )

        rate_limit = int(os.environ.get("LLM_RATE_LIMIT", defaults["rate_limit"]))
        self.rate_limiter = self._get_rate_limiter(self.provider, rate_limit)

    @classmethod
    def _get_rate_limiter(cls, provider: str, max_requests: int) -> RateLimiter:
        with cls._rate_limiters_lock:
            limiter = cls._rate_limiters.get(provider)
            if limiter is None or limiter.max_requests != max_requests:
                limiter = RateLimiter(max_requests, period_seconds=60.0)
                cls._rate_limiters[provider] = limiter
            return limiter

    def chat_complete(self, system: str, user: str, json_mode: bool = False,
                      temperature: float = 0.2, retry: int = 0, max_retries: int = 3) -> str:
        url = f"{self.base_url}/chat/completions"
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        self.rate_limiter.acquire()

        # Split connect/read timeouts - a slow-to-respond provider (the read side)
        # shouldn't be confused with an unreachable one (the connect side). Both
        # configurable since "DeepSeek is just slow right now" calls for a longer
        # read timeout, not necessarily a code change.
        connect_timeout = float(os.environ.get("LLM_CONNECT_TIMEOUT_SECONDS", "10"))
        read_timeout = float(os.environ.get("LLM_READ_TIMEOUT_SECONDS", "90"))

        try:
            response = requests.post(url, headers=headers, json=payload, timeout=(connect_timeout, read_timeout))
        except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as e:
            if retry >= max_retries:
                raise
            backoff = 2 ** retry
            print(f"LLM provider '{self.provider}' request failed ({e}); retrying in {backoff}s "
                  f"(attempt {retry + 1}/{max_retries})")
            time.sleep(backoff)
            return self.chat_complete(system, user, json_mode=json_mode, temperature=temperature,
                                      retry=retry + 1, max_retries=max_retries)

        if response.status_code == 429 and retry < max_retries:
            retry_after = float(response.headers.get("Retry-After", 2 ** retry))
            print(f"LLM provider '{self.provider}' rate limited (429); retrying in {retry_after:.1f}s")
            time.sleep(retry_after)
            return self.chat_complete(system, user, json_mode=json_mode, temperature=temperature,
                                      retry=retry + 1, max_retries=max_retries)

        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]
