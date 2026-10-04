#!/usr/bin/env python3
"""One command for the whole loop: render any episode that has no reel yet, then
queue up to N reels in Buffer. Run it by hand, or daily from cron / Task Scheduler.

  python autopilot.py --per-run 2 --host catbox            # auto-publish
  python autopilot.py --per-run 2 --host catbox --notify   # phone reminder, add trending audio
"""
import argparse
import glob
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--per-run", type=int, default=2, help="reels to queue per run")
    p.add_argument("--voice", default="hype")
    p.add_argument("--music", help="bake this track in (auto-post mode without trending audio)")
    p.add_argument("--host", choices=["catbox"])
    p.add_argument("--base-url")
    p.add_argument("--notify", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    todo = []
    for ep in sorted(glob.glob(os.path.join(ROOT, "episodes", "*.json"))):
        eid = json.load(open(ep))["id"]
        meta = os.path.join(ROOT, "out", eid, "meta.json")
        if not os.path.exists(meta) or json.load(open(meta)).get("preview"):
            todo.append(ep)
    if todo:
        cmd = [sys.executable, os.path.join(HERE, "make_reel.py"), *todo, "--voice", args.voice]
        if args.music:
            cmd += ["--music", args.music]
        subprocess.run(cmd, check=True)

    cmd = [sys.executable, os.path.join(HERE, "post_to_buffer.py"), "--limit", str(args.per_run)]
    for flag in ("host", "base_url"):
        if getattr(args, flag):
            cmd += ["--" + flag.replace("_", "-"), getattr(args, flag)]
    if args.notify:
        cmd.append("--notify")
    if args.dry_run:
        cmd.append("--dry-run")
    subprocess.run(cmd, check=True)


if __name__ == "__main__":
    main()
