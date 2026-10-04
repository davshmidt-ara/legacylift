"""Free voiceover via Microsoft Edge neural voices (edge-tts). No account, no API key.

Each scene is synthesised separately so scene length = voice length, and we get
per-word timings for the captions.
"""
import asyncio
import subprocess

# Energetic presets. Rate/pitch push the default "newsreader" delivery into
# something punchier. Try them with:  python make_reel.py --voice-test
VOICES = {
    "hype": ("en-US-AndrewMultilingualNeural", "+18%", "+4Hz"),   # warm, confident, fast
    "storyteller": ("en-US-BrianMultilingualNeural", "+12%", "+0Hz"),
    "bright": ("en-US-AvaMultilingualNeural", "+15%", "+6Hz"),     # female, upbeat
    "deep": ("en-US-ChristopherNeural", "+14%", "-4Hz"),
    "uk": ("en-GB-RyanNeural", "+15%", "+2Hz"),
}
DEFAULT_PRESET = "hype"


async def _synth(text, out_mp3, voice, rate, pitch):
    import edge_tts

    comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary="WordBoundary")
    words = []
    with open(out_mp3, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                # offsets are in 100ns units
                start = chunk["offset"] / 1e7
                words.append({"w": chunk["text"], "t0": start, "t1": start + chunk["duration"] / 1e7})
    return words


def audio_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        capture_output=True, text=True, check=True,
    ).stdout
    return float(out.strip())


def synth_scene(text, out_mp3, preset=DEFAULT_PRESET):
    """Returns (duration_seconds, words). preset may be a VOICES key or 'voice,rate,pitch'."""
    if preset in VOICES:
        voice, rate, pitch = VOICES[preset]
    else:
        voice, rate, pitch = (preset.split(",") + ["+15%", "+0Hz"])[:3]
    words = asyncio.run(_synth(text, out_mp3, voice, rate, pitch))
    return audio_duration(out_mp3), words


def estimate_scene(text, wps=3.1):
    """Offline/preview mode: fake word timings at a fast speaking pace, no audio."""
    words, t = [], 0.15
    for w in text.split():
        d = max(0.18, len(w) * 0.055) * (3.1 / wps)
        words.append({"w": w, "t0": t, "t1": t + d})
        t += d + (0.18 if w[-1] in ".?!," else 0.03)
    return t + 0.25, words
