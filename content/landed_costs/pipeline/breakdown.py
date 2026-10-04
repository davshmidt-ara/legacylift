#!/usr/bin/env python3
"""Regenerate ../SCRIPTS.md (readable scripts + scene breakdowns) from the episode JSON files."""
import glob
import json
import os

import voice

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))

VISUALS = {
    "hook": lambda s: "Slam text, line by line, with impact hits and shake: " + " / ".join(f"**{l}**" for l in s["lines"]),
    "cargo": lambda s: f"Cargo (the talking container) pops in, {s.get('mood', 'smug')}, lip-synced. Title: **{s['text']}**",
    "number": lambda s: f"Big count-up to **{s.get('prefix', '')}{s['value']:,.{s.get('decimals', 0)}f}{s.get('suffix', '')}** inside a filling ring. Label: {s['label']}",
    "bars": lambda s: "Racing bars: " + ", ".join(f"{i['label']} = {s.get('prefix', '')}{i['value']:,}{s.get('suffix', '')}" for i in s["items"]),
    "stack": lambda s: "Cost blocks drop and stack while TOTAL counts up: " + " + ".join(f"{l['label']} {s.get('prefix', '')}{l['amount']}" for l in s["layers"]),
    "route": lambda s: "Container travels a zig-zag route, stops light up: " + " → ".join(s["stops"]),
    "versus": lambda s: f"Split screen slides in, VS badge slams: **{s['left']['label']} {s['left']['value']}** vs **{s['right']['label']} {s['right']['value']}**",
    "stamp": lambda s: f"Red rubber stamp **{s['word']}** slams down (impact + shake), shocked mini-Cargo below",
    "list": lambda s: "Cards fly in one by one: " + " · ".join(s["items"]),
    "outro": lambda s: f"Cargo waves, pulsing button **{s['text']}**",
}


def main():
    out = ["# @landed_costs: scripts and scene breakdowns", "",
           "Generated from `episodes/*.json` by `pipeline/breakdown.py`. Edit the JSON, not this file.",
           "Timings are estimates at the hype voice pace; the real render times each scene to the voice.", ""]
    for f in sorted(glob.glob(os.path.join(ROOT, "episodes", "*.json"))):
        ep = json.load(open(f))
        out += [f"## {ep['id']}: {ep['title']}", "", "**Hook options** (A/B test with `--hook N`):", ""]
        out += [f"{i}. \"{h}\"" for i, h in enumerate(ep["hook_variants"])]
        out += ["", "| # | Time | Voiceover | On screen |", "|---|---|---|---|"]
        t = 0.0
        for i, sc in enumerate(ep["scenes"]):
            d, _ = voice.estimate_scene(sc["say"])
            d = max(1.2, d)
            out.append(f"| {i + 1} | {t:.0f}–{t + d:.0f}s | {sc['say']} | {VISUALS[sc['type']](sc)} |")
            t += d
        out += ["", f"Runtime ≈ {t:.0f}s. Footnote on screen: _{ep.get('note', '')}_", "",
                "**Caption:**", "", "> " + ep["caption"].replace("\n", "\n> "), "",
                " ".join(ep["hashtags"]), ""]
    with open(os.path.join(ROOT, "SCRIPTS.md"), "w") as fh:
        fh.write("\n".join(out))
    print("wrote", os.path.join(ROOT, "SCRIPTS.md"))


if __name__ == "__main__":
    main()
