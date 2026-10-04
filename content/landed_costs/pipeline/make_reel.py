#!/usr/bin/env python3
"""Turn an episode JSON into a finished 1080x1920 Reel.

  python make_reel.py ../episodes/ep01-tshirt.json            # one episode
  python make_reel.py --all                                   # every episode
  python make_reel.py ../episodes/ep01-tshirt.json --hook 2   # A/B a different hook line
  python make_reel.py --all --voice bright                    # other voice preset
  python make_reel.py --all --music beat.mp3                  # bake in a music bed (for auto-posting)
  python make_reel.py --all --preview                         # no voice, fast check of visuals/timing
  python make_reel.py --voice-test                            # hear every voice preset

Output: ../out/<episode-id>/reel.mp4, cover.jpg, caption.txt, meta.json
"""
import argparse
import glob
import hashlib
import json
import math
import os
import subprocess
import sys
import time

import numpy as np

import render
import voice

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
SR = 44100
TAIL = 0.12  # silence after each line; keep it tiny so the edit feels fast


def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "s16le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


# ---------- synthetic sound effects (no asset files needed) ----------

def sfx_whoosh(length=0.32):
    n = int(SR * length)
    rng = np.random.default_rng(1)
    noise = rng.standard_normal(n)
    # smooth noise = darker "air" sound; sweep the smoothing for movement
    out = np.convolve(noise, np.ones(12) / 12, mode="same")
    env = np.sin(np.linspace(0, math.pi, n)) ** 2
    return (out * env * 0.35).astype(np.float32)


def sfx_impact(length=0.55):
    n = int(SR * length)
    tt = np.arange(n) / SR
    freq = 110 * np.exp(-tt * 5) + 38
    phase = 2 * math.pi * np.cumsum(freq) / SR
    body = np.sin(phase) * np.exp(-tt * 7)
    click = np.random.default_rng(2).standard_normal(n) * np.exp(-tt * 60) * 0.4
    return ((body + click) * 0.55).astype(np.float32)


def add(track, clip, at):
    i = int(at * SR)
    if i >= len(track) or i + len(clip) <= 0:
        return
    s = max(0, -i)
    j = min(len(track), i + len(clip))
    track[max(0, i):j] += clip[s:s + j - max(0, i)]


# ---------- episode build ----------

def build_audio(ep, workdir, preset, preview):
    """Synthesises (or estimates) every scene. Returns scene list with timings, voice track, words."""
    scenes = []
    for k, sc in enumerate(ep["scenes"]):
        text = sc["say"]
        if preview:
            dur, words = voice.estimate_scene(text)
            audio = np.zeros(int(dur * SR), np.float32)
        else:
            key = hashlib.sha1(f"{preset}|{text}".encode()).hexdigest()[:12]
            mp3 = os.path.join(workdir, f"vo_{k:02d}_{key}.mp3")
            wj = mp3 + ".json"
            if os.path.exists(mp3) and os.path.exists(wj):
                words = json.load(open(wj))
                dur = voice.audio_duration(mp3)
            else:
                dur, words = voice.synth_scene(text, mp3, preset)
                json.dump(words, open(wj, "w"))
            audio = decode(mp3)
        dur = max(1.2, dur + TAIL)
        scenes.append({"scene": sc, "dur": dur, "words": words, "audio": audio})

    total = sum(s["dur"] for s in scenes)
    vo = np.zeros(int(total * SR) + SR, np.float32)
    fx = np.zeros_like(vo)
    whoosh, impact = sfx_whoosh(), sfx_impact()
    t0 = 0.0
    for k, s in enumerate(scenes):
        s["start"] = t0
        add(vo, s["audio"], t0)
        if k > 0:
            add(fx, whoosh, t0 - 0.16)
        typ = s["scene"]["type"]
        if typ == "hook":
            n = len(s["scene"].get("lines", []))
            gap = min(0.45, s["dur"] * 0.5 / max(1, n))
            for i in range(n):
                add(fx, impact * (0.7 if i == 0 else 1.0), t0 + i * gap)
        elif typ == "stamp":
            add(fx, impact * 1.2, t0 + 0.2)
        elif typ == "versus":
            add(fx, impact * 0.6, t0 + 0.3)
        t0 += s["dur"]
    vo = vo[: int(total * SR)]
    fx = fx[: int(total * SR)]
    return scenes, total, vo, fx


def mouth_envelope(audio, dur, words, preview):
    n = max(1, int(math.ceil(dur * render.FPS)))
    if preview or not audio.any():
        env = np.zeros(n)
        for i in range(n):
            t = i / render.FPS
            if any(w["t0"] <= t < w["t1"] for w in words):
                env[i] = 0.45 + 0.45 * abs(math.sin(t * 19))
        return env
    hop = SR // render.FPS
    env = np.array([np.sqrt(np.mean(audio[i * hop:(i + 1) * hop] ** 2)) if i * hop < len(audio) else 0
                    for i in range(n)])
    ref = np.percentile(env[env > 0], 90) if (env > 0).any() else 1
    env = np.clip(env / (ref + 1e-6), 0, 1)
    # light smoothing so the jaw doesn't jitter
    return np.convolve(env, [0.25, 0.5, 0.25], mode="same")


def write_wav(path, data):
    data = np.clip(data, -1, 1)
    pcm = (data * 32767).astype("<i2").tobytes()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "-", path],
                   input=pcm, check=True)


def make(ep_path, args):
    ep = json.load(open(ep_path))
    if args.hook is not None:
        ep["scenes"][0]["say"] = ep["hook_variants"][args.hook]
    out_dir = os.path.join(args.out, ep["id"] + (f"-hook{args.hook}" if args.hook is not None else ""))
    work = os.path.join(args.out, ".cache", ep["id"])
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(work, exist_ok=True)
    started = time.time()

    scenes, total, vo, fx = build_audio(ep, work, args.voice, args.preview)
    mix = vo * 1.0 + fx * args.sfx
    peak = np.abs(mix).max() or 1
    mix = mix / peak * 0.95 if peak > 0.95 else mix
    wav = os.path.join(work, "mix.wav")
    write_wav(wav, mix)

    out = os.path.join(out_dir, "reel.mp4")
    cmd = ["ffmpeg", "-v", "error", "-y",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{render.W}x{render.H}", "-r", str(render.FPS), "-i", "-",
           "-i", wav]
    if args.music:
        cmd += ["-stream_loop", "-1", "-i", args.music, "-filter_complex",
                f"[1:a]asplit[v1][v2];[2:a]volume={args.music_volume}[m0];"
                "[m0][v1]sidechaincompress=threshold=0.03:ratio=6:attack=15:release=350[m];"
                "[v2][m]amix=inputs=2:duration=first:normalize=0[a]",
                "-map", "0:v", "-map", "[a]"]
    else:
        cmd += ["-map", "0:v", "-map", "1:a"]
    cmd += ["-c:v", "libx264", "-preset", "fast" if args.preview else "medium", "-crf", "19",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "44100",
            "-movflags", "+faststart", "-t", f"{total:.3f}", out]
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)

    cover_t = min(1.1, scenes[0]["dur"] - 0.1)
    frame_no = 0
    for idx, s in enumerate(scenes):
        sc, dur = s["scene"], s["dur"]
        mouth = mouth_envelope(s["audio"], dur, s["words"], args.preview)
        ctx = {"index": idx, "chunks": render.caption_chunks(s["words"])}
        n = int(round((s["start"] + dur) * render.FPS)) - frame_no
        for i in range(n):
            t = i / render.FPS
            gt = frame_no / render.FPS
            ctx["mouth"] = float(mouth[min(i, len(mouth) - 1)])
            img = render.render_frame(sc, t, dur, ctx, gt, total, ep.get("note"))
            ff.stdin.write(img.tobytes())
            if idx == 0 and abs(t - cover_t) < 0.5 / render.FPS:
                img.save(os.path.join(out_dir, "cover.jpg"), quality=92)
            frame_no += 1
    ff.stdin.close()
    if ff.wait() != 0:
        raise SystemExit(f"ffmpeg failed for {ep_path}")

    with open(os.path.join(out_dir, "caption.txt"), "w") as f:
        f.write(ep["caption"] + "\n\n" + " ".join(ep["hashtags"]) + "\n")
    json.dump({"id": ep["id"], "title": ep["title"], "duration": round(total, 2),
               "cover_offset_ms": int(cover_t * 1000), "voice": None if args.preview else args.voice,
               "music_baked_in": bool(args.music), "preview": args.preview},
              open(os.path.join(out_dir, "meta.json"), "w"), indent=2)
    print(f"✓ {out}  ({total:.1f}s, rendered in {time.time() - started:.0f}s)")
    return out


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("episodes", nargs="*", help="episode JSON files")
    p.add_argument("--all", action="store_true", help="render every episode in ../episodes")
    p.add_argument("--voice", default=voice.DEFAULT_PRESET,
                   help=f"preset ({', '.join(voice.VOICES)}) or 'VoiceName,+15%%,+2Hz'")
    p.add_argument("--hook", type=int, help="use hook_variants[N] as the opening line")
    p.add_argument("--music", help="music file to bake in (auto-ducked under the voice)")
    p.add_argument("--music-volume", type=float, default=0.35)
    p.add_argument("--sfx", type=float, default=0.8, help="whoosh/impact volume (0 = off)")
    p.add_argument("--preview", action="store_true", help="skip TTS; silent, estimated timing")
    p.add_argument("--voice-test", action="store_true", help="write a sample of each voice preset")
    p.add_argument("--out", default=os.path.join(ROOT, "out"))
    args = p.parse_args()

    if args.voice_test:
        os.makedirs(args.out, exist_ok=True)
        line = "This shirt cost about two dollars to make. You paid twenty-five. So who took the rest?"
        for name in voice.VOICES:
            path = os.path.join(args.out, f"voice-{name}.mp3")
            voice.synth_scene(line, path, name)
            print("wrote", path)
        return

    files = args.episodes or []
    if args.all:
        files = sorted(glob.glob(os.path.join(ROOT, "episodes", "*.json")))
    if not files:
        p.print_help()
        sys.exit(1)
    for f in files:
        make(f, args)


if __name__ == "__main__":
    main()
