"""Free voiceover via Microsoft Edge neural voices (edge-tts). No account, no API key.

Each scene is synthesised separately so scene length = voice length, and we get
per-word timings for the captions.
"""
import asyncio
import subprocess
import time

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

# Offline backup: Kokoro, an open-source voice model that runs on your computer.
# No account, no internet after the first model download. Needs: pip install kokoro
KOKORO = {
    "kokoro": ("am_michael", 1.15),   # confident male
    "kokoro-puck": ("am_puck", 1.15),  # playful, energetic male
    "kokoro-fenrir": ("am_fenrir", 1.12),  # deeper male
    "kokoro-heart": ("af_heart", 1.12),  # warm female
}

EDGE_HELP = """The free Edge voice failed. Most common fixes:
  1. Update it (Microsoft changes things often):  pip install -U edge-tts
  2. Turn off VPN, and antivirus "HTTPS/web scanning" (it causes SSL certificate errors)
  3. Check your computer's clock is correct (a wrong clock makes Microsoft reject the request)
  4. Use the offline backup voice instead:  pip install kokoro  then  --voice kokoro"""


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


_kokoro_pipeline = None


def _synth_kokoro(text, out_path, voice, speed):
    global _kokoro_pipeline
    try:
        import numpy as np
        from kokoro import KPipeline
    except ImportError:
        raise SystemExit("Kokoro isn't installed. Run:  pip install kokoro")
    if _kokoro_pipeline is None:
        _kokoro_pipeline = KPipeline(lang_code="a")  # American English; downloads the model once
    sr, offset, pieces, words = 24000, 0.0, [], []
    for res in _kokoro_pipeline(text, voice=voice, speed=speed, split_pattern=None):
        if res.audio is None:
            continue
        audio = res.audio.detach().cpu().numpy() if hasattr(res.audio, "detach") else np.asarray(res.audio)
        for tok in res.tokens or []:
            if tok.start_ts is None or tok.end_ts is None:
                continue
            if words and not any(c.isalnum() for c in tok.text):
                words[-1]["w"] += tok.text  # glue punctuation onto the previous word
                continue
            words.append({"w": tok.text, "t0": offset + tok.start_ts, "t1": offset + tok.end_ts})
        pieces.append(audio)
        offset += len(audio) / sr
    pcm = (np.clip(np.concatenate(pieces), -1, 1) * 32767).astype("<i2").tobytes()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(sr), "-ac", "1", "-i", "-", out_path],
                   input=pcm, check=True)
    if not words:  # no timestamps: spread estimated timings over the real length
        est_dur, words = estimate_scene(text)
        k = offset / est_dur
        words = [{"w": w["w"], "t0": w["t0"] * k, "t1": w["t1"] * k} for w in words]
    return words


def synth_scene(text, out_mp3, preset=DEFAULT_PRESET):
    """Returns (duration_seconds, words).

    preset: an Edge preset (VOICES), a Kokoro preset (KOKORO), 'kokoro:<voice>,<speed>',
    or a raw Edge voice 'Name,+15%,+2Hz'."""
    if preset in KOKORO or preset.startswith("kokoro:"):
        voice, speed = KOKORO[preset] if preset in KOKORO else (preset[7:].split(",") + ["1.15"])[:2]
        words = _synth_kokoro(text, out_mp3, voice, float(speed))
        return audio_duration(out_mp3), words
    if preset in VOICES:
        voice, rate, pitch = VOICES[preset]
    else:
        voice, rate, pitch = (preset.split(",") + ["+15%", "+0Hz"])[:3]
    for attempt in range(3):
        try:
            words = asyncio.run(_synth(text, out_mp3, voice, rate, pitch))
            if words and audio_duration(out_mp3) > 0:
                return audio_duration(out_mp3), words
        except Exception as e:  # network hiccups, Microsoft rate limits, outdated client
            err = e
            time.sleep(2 ** attempt)
            continue
        err = RuntimeError("no audio came back")
        time.sleep(2 ** attempt)
    raise SystemExit(f"{EDGE_HELP}\n\nLast error: {type(err).__name__}: {err}")


def estimate_scene(text, wps=3.1):
    """Offline/preview mode: fake word timings at a fast speaking pace, no audio."""
    words, t = [], 0.15
    for w in text.split():
        d = max(0.18, len(w) * 0.055) * (3.1 / wps)
        words.append({"w": w, "t0": t, "t1": t + d})
        t += d + (0.18 if w[-1] in ".?!," else 0.03)
    return t + 0.25, words
