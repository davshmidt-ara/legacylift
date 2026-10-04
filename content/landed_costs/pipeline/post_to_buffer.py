#!/usr/bin/env python3
"""Queue rendered Reels to Instagram through Buffer's GraphQL API.

Setup (once):
  1. Buffer → Settings → API (publish.buffer.com/settings/api) → create a personal API key.
  2. export BUFFER_API_KEY=...
  3. python post_to_buffer.py --list-channels        → copy the @landed_costs channel id
  4. export BUFFER_CHANNEL_ID=...

Buffer can't take a file upload through the API yet: it fetches the video from a
public URL. Either host ../out/ somewhere (Cloudflare R2, S3, your site) and pass
--base-url, or pass --host catbox to upload each reel to catbox.moe (free, public).

  python post_to_buffer.py --host catbox                     # queue every unposted reel
  python post_to_buffer.py --base-url https://cdn.example.com/reels ep01-tshirt
  python post_to_buffer.py --host catbox --notify            # phone reminder instead of auto-post
  python post_to_buffer.py --host catbox --start 2026-10-06T09:00 --every-hours 8

Modes:
  default   schedulingType=automatic: Buffer publishes the Reel by itself.
  --notify  schedulingType=notification: Buffer pings your phone at the slot, you open
            Instagram, add a trending sound, post. Use this when you want trending audio.
"""
import argparse
import datetime as dt
import glob
import json
import mimetypes
import os
import sys
import urllib.request
import uuid

API = "https://api.buffer.com"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "out"))


def gql(query, key):
    req = urllib.request.Request(API, data=json.dumps({"query": query}).encode(), method="POST", headers={
        "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        body = json.load(r)
    if body.get("errors"):
        raise SystemExit("Buffer API error: " + json.dumps(body["errors"], indent=2))
    return body["data"]


def s(v):
    """GraphQL string literal."""
    return json.dumps(v, ensure_ascii=False)


def list_channels(key):
    orgs = gql("query { account { organizations { id name } } }", key)["account"]["organizations"]
    for o in orgs:
        print(f"Organization {o['name']}  ({o['id']})")
        chans = gql(f"query {{ channels(input: {{ organizationId: {s(o['id'])} }}) {{ id name service }} }}", key)
        for c in chans["channels"]:
            print(f"  {c['service']:<10} {c['name']:<30} id={c['id']}")


def upload_catbox(path):
    boundary = uuid.uuid4().hex
    with open(path, "rb") as f:
        data = f.read()
    ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"
    body = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"reqtype\"\r\n\r\nfileupload\r\n"
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"fileToUpload\"; filename=\"{os.path.basename(path)}\"\r\n"
        f"Content-Type: {ctype}\r\n\r\n"
    ).encode() + data + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request("https://catbox.moe/user/api.php", data=body, method="POST",
                                 headers={"Content-Type": f"multipart/form-data; boundary={boundary}",
                                          "User-Agent": "landed-costs-pipeline"})
    with urllib.request.urlopen(req, timeout=300) as r:
        url = r.read().decode().strip()
    if not url.startswith("https://"):
        raise SystemExit(f"catbox upload failed: {url}")
    return url


def create_post(key, channel, text, video_url, thumb_ms, notify, due_at):
    mode = f"mode: customScheduled, dueAt: {s(due_at)}" if due_at else "mode: addToQueue"
    q = f"""mutation {{
  createPost(input: {{
    text: {s(text)}
    channelId: {s(channel)}
    schedulingType: {"notification" if notify else "automatic"}
    {mode}
    assets: [{{ video: {{ url: {s(video_url)}, metadata: {{ thumbnailOffset: {int(thumb_ms)} }} }} }}]
    metadata: {{ instagram: {{ type: reel, shouldShareToFeed: true }} }}
  }}) {{
    ... on PostActionSuccess {{ post {{ id dueAt }} }}
    ... on MutationError {{ message }}
  }}
}}"""
    res = gql(q, key)["createPost"]
    if "message" in res:
        raise SystemExit(f"Buffer refused the post: {res['message']}")
    return res["post"]


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("ids", nargs="*", help="episode ids / folder names in ../out (default: all unposted)")
    p.add_argument("--list-channels", action="store_true")
    p.add_argument("--channel", default=os.environ.get("BUFFER_CHANNEL_ID"))
    p.add_argument("--base-url", help="public URL where ../out/ is hosted")
    p.add_argument("--host", choices=["catbox"], help="upload each reel to a free public host")
    p.add_argument("--notify", action="store_true", help="reminder mode so you can add trending audio")
    p.add_argument("--start", help="first slot, e.g. 2026-10-06T09:00 (UTC unless offset given)")
    p.add_argument("--every-hours", type=float, default=12, help="spacing between custom slots")
    p.add_argument("--limit", type=int, help="queue at most N reels this run")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--out", default=OUT, help="folder with rendered reels")
    args = p.parse_args()

    key = os.environ.get("BUFFER_API_KEY")
    if not key and not args.dry_run:
        raise SystemExit("Set BUFFER_API_KEY first (Buffer → Settings → API).")
    if args.list_channels:
        return list_channels(key)
    if not args.channel and not args.dry_run:
        raise SystemExit("Set BUFFER_CHANNEL_ID or pass --channel (see --list-channels).")
    if not (args.base_url or args.host or args.dry_run):
        raise SystemExit("Buffer needs a public video URL: pass --base-url or --host catbox.")

    folders = [os.path.join(args.out, i) for i in args.ids] if args.ids else sorted(
        d for d in glob.glob(os.path.join(args.out, "*")) if os.path.isdir(d) and not os.path.basename(d).startswith("."))
    slot = None
    if args.start:
        slot = dt.datetime.fromisoformat(args.start)
        if slot.tzinfo is None:
            slot = slot.replace(tzinfo=dt.timezone.utc)
    queued = 0
    for d in folders:
        name = os.path.basename(d)
        reel, meta_path = os.path.join(d, "reel.mp4"), os.path.join(d, "meta.json")
        if not os.path.exists(reel):
            print(f"- {name}: no reel.mp4, render it first")
            continue
        if os.path.exists(os.path.join(d, "posted.json")) and not args.ids:
            continue
        meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
        if meta.get("preview"):
            print(f"- {name}: preview render (no voice), skipping")
            continue
        if args.limit is not None and queued >= args.limit:
            break
        text = open(os.path.join(d, "caption.txt")).read().strip()
        due = slot.isoformat().replace("+00:00", "Z") if slot else None
        notify = args.notify
        if not meta.get("music_baked_in") and not notify:
            print(f"  note: {name} has no music baked in; use --notify to add trending audio in the app")
        if args.dry_run:
            print(f"would queue {name} ({'notify' if notify else 'auto'}, {due or 'next queue slot'})")
        else:
            url = upload_catbox(reel) if args.host == "catbox" else f"{args.base_url.rstrip('/')}/{name}/reel.mp4"
            post = create_post(key, args.channel, text, url, meta.get("cover_offset_ms", 1000), notify, due)
            json.dump({"buffer_post_id": post["id"], "due_at": post.get("dueAt"), "video_url": url,
                       "mode": "notification" if notify else "automatic"},
                      open(os.path.join(d, "posted.json"), "w"), indent=2)
            print(f"✓ queued {name} → {post.get('dueAt') or 'queue'}")
        queued += 1
        if slot:
            slot += dt.timedelta(hours=args.every_hours)
    if not queued:
        print("Nothing to queue.")


if __name__ == "__main__":
    sys.exit(main())
