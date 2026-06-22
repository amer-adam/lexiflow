import os


def cookie_opts() -> dict:
    """
    Returns {"cookiefile": path} if YTDLP_COOKIES_FILE is set and points to an
    existing file, else {}.

    YouTube increasingly blocks datacenter/VPS IPs with "Sign in to confirm
    you're not a bot", even with a spoofed mobile user agent and the
    android/ios player client workaround already in place. The reliable fix
    is supplying cookies from a real, logged-in browser session: export one
    as a Netscape-format cookies.txt (e.g. via the "Get cookies.txt LOCALLY"
    browser extension), copy it onto the server, and point this env var at it.
    """
    path = os.environ.get("YTDLP_COOKIES_FILE")

    if not path:
        return {}

    if not os.path.isfile(path):
        print(f"YTDLP_COOKIES_FILE={path} is set but the file doesn't exist - continuing without cookies")
        return {}

    return {"cookiefile": path}
