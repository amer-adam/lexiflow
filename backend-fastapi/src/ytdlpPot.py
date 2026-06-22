import os


def pot_provider_extractor_args() -> dict:
    """
    Returns the extractor_args entry wiring yt-dlp to a remote PO (proof-of-origin)
    token provider sidecar, if YTDLP_POT_PROVIDER_URL is set, else {}.

    YouTube increasingly requires a PO token for the "web" player client - without
    one, "web" falls back to "Sign in to confirm you're not a bot" even with valid
    cookies attached. bgutil-ytdlp-pot-provider
    (https://github.com/Brainicism/bgutil-ytdlp-pot-provider) runs a small sidecar
    that generates these tokens; the matching pip package (bgutil-ytdlp-pot-provider,
    see requirements.txt) registers itself as a yt-dlp plugin that calls it. Merge
    this into ydl_opts['extractor_args'] alongside the youtube/player_client entry.
    """
    base_url = os.environ.get("YTDLP_POT_PROVIDER_URL")

    if not base_url:
        return {}

    return {"youtubepot-bgutilhttp": {"base_url": base_url}}
