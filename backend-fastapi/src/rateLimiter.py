import threading
import time
from collections import deque


class RateLimiter:
    """
    Thread-safe sliding-window rate limiter for a single process.

    Blocks the calling thread in acquire() until a new request is allowed
    within the configured window, instead of raising - callers don't need
    their own retry/backoff loop for the common case.
    """

    def __init__(self, max_requests: int, period_seconds: float = 60.0):
        self.max_requests = max_requests
        self.period_seconds = period_seconds
        self._timestamps = deque()
        self._lock = threading.Lock()

    def acquire(self):
        while True:
            with self._lock:
                now = time.monotonic()

                while self._timestamps and now - self._timestamps[0] >= self.period_seconds:
                    self._timestamps.popleft()

                if len(self._timestamps) < self.max_requests:
                    self._timestamps.append(now)
                    return

                wait_time = self.period_seconds - (now - self._timestamps[0])

            time.sleep(max(wait_time, 0.05))
