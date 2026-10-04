# @landed_costs: script-to-Reel pipeline

Fully AI-made money and trade Reels. You write (or tweak) an episode file, one command turns it into a finished 1080×1920 Reel, and another queues it in Buffer.

- **Host:** Cargo, a talking shipping container. He's drawn in code, lip-syncs to the voice and appears in every episode, so the channel has a recurring face without any paid AI video tool.
- **Look:** fast animated scenes with a cut every 3–5 seconds, a zoom punch and flash on every cut, word-by-word captions, a progress bar, and whoosh and impact sound effects.
- **Voice:** free Microsoft neural voices via `edge-tts`, sped up and pitched up for energy. No account and no API key.
- **Music:** none by default, so you can add a trending sound in the Instagram app. Use `--music` to bake a track in for hands-off posting.

```
content/landed_costs/
  episodes/*.json      ← the scripts (source of truth): 10 episodes ready
  SCRIPTS.md           ← readable version: hooks, scene-by-scene breakdown, captions
  pipeline/
    make_reel.py       ← episode JSON → out/<id>/reel.mp4 + cover.jpg + caption.txt
    post_to_buffer.py  ← queue reels to Instagram via Buffer's API
    autopilot.py       ← render whatever's new + queue N reels, in one command
    render.py          ← the scene templates and Cargo
    voice.py           ← voice presets
    breakdown.py       ← regenerates SCRIPTS.md
  fonts/               ← optional: drop a heavy display font here
  out/                 ← renders (git-ignored)
```

## 1. One-time setup (your computer)

You need Python 3.10+ and ffmpeg.

```sh
# macOS:   brew install ffmpeg python
# Windows: winget install ffmpeg Python.Python.3.12
cd content/landed_costs/pipeline
pip install -r requirements.txt
```

**Font (recommended):** download [Anton](https://fonts.google.com/specimen/Anton) or [Bebas Neue](https://fonts.google.com/specimen/Bebas+Neue) (free) and put the `.ttf` file in `content/landed_costs/fonts/`. It's used automatically and looks far more "Reels" than the default bold font.

## 2. Pick the voice

```sh
python make_reel.py --voice-test      # writes out/voice-*.mp3, one per preset
```

| Preset | Voice | Feel |
|---|---|---|
| `hype` (default) | Andrew, +18% speed | confident, fast, the "explainer guy" |
| `storyteller` | Brian, +12% | smoother, documentary |
| `bright` | Ava, +15%, higher pitch | upbeat female |
| `deep` | Christopher, lower pitch | serious, dramatic |
| `uk` | Ryan (British) | witty, different from US competitors |

You can also pass any voice directly, e.g. `--voice "en-US-AndrewMultilingualNeural,+25%,+6Hz"`. Pick one voice and keep it: a consistent voice is part of the character.

**Tips for an exciting delivery:** short sentences, question marks ("Ten cents? Not a typo.") and numbers written as words ("twenty-five") make the voice punchier. The scripts are already written that way.

## 3. Make Reels

```sh
python make_reel.py --all --preview                  # quick silent check of every visual (~45s each)
python make_reel.py --all                            # real renders with voice
python make_reel.py ../episodes/ep01-tshirt.json --hook 2   # alternative hook for A/B testing
python make_reel.py --all --music mytrack.mp3        # bake in music (auto-ducked under the voice)
```

Each render lands in `out/<episode-id>/`: `reel.mp4`, `cover.jpg`, `caption.txt` (caption + hashtags) and `meta.json`.

## 4. Automate posting with Buffer

1. In Buffer, connect @landed_costs (an Instagram Business or Creator account).
2. Create an API key at **publish.buffer.com/settings/api**.
3. Run:

```sh
export BUFFER_API_KEY=xxxx                    # Windows: set BUFFER_API_KEY=xxxx
python post_to_buffer.py --list-channels      # copy the Instagram channel id
export BUFFER_CHANNEL_ID=yyyy
python post_to_buffer.py --dry-run            # see what would be queued
python post_to_buffer.py --host catbox        # queue every rendered, unposted reel
```

- **Video hosting:** Buffer's API can't take an uploaded file yet. It downloads the video from a public link. `--host catbox` uploads each reel to catbox.moe (free, public link). If you have your own storage (Cloudflare R2, S3, a website), use `--base-url https://your-host/reels` instead.
- **When posts go out:** by default reels join your Buffer queue, using the posting times you set in Buffer. To set times from the command line instead, use `--start 2026-10-06T09:00 --every-hours 8`.
- **No double posting:** a posted reel gets a `posted.json` file and is skipped next time.

### Trending audio vs. fully automatic: choose per run

Instagram only lets you add *trending* sounds inside the app, and no scheduler can do it. So you have two modes:

| Mode | Command | What happens |
|---|---|---|
| Fully automatic | `--music track.mp3` when rendering, then `post_to_buffer.py` | Buffer publishes by itself with your baked-in track. |
| Trending audio | render without music, then `post_to_buffer.py --notify` | At the slot, Buffer pings your phone. You open the Reel, add a trending sound at about 10–15% volume under the voice, and post. That's about 30 seconds of work. |

### Hands-off loop

```sh
python autopilot.py --per-run 2 --host catbox            # render anything new, queue 2
python autopilot.py --per-run 2 --host catbox --notify   # same, trending-audio mode
```

Schedule it once a day:

- **Mac/Linux:** `crontab -e`, then add `0 8 * * * cd /path/to/content/landed_costs/pipeline && BUFFER_API_KEY=... BUFFER_CHANNEL_ID=... python3 autopilot.py --per-run 2 --host catbox`
- **Windows:** Task Scheduler, daily, running `python autopilot.py ...` in the pipeline folder.

When it runs out of new episodes, it stops queuing. Add new episode files and it picks them up.

## 5. Writing new episodes

Copy an episode JSON and edit it. Each scene is a line of voiceover (`say`) plus a scene `type`:

| type | fields | use it for |
|---|---|---|
| `hook` | `lines` (2 short lines), `accent` | the first 2 seconds, always |
| `cargo` | `text`, `mood` (`smug`/`shocked`) | Cargo reacting or teasing the payoff |
| `number` | `value`, `prefix`, `suffix`, `decimals`, `label` | one shocking stat |
| `bars` | `items` [{label, value}], `prefix`/`suffix` | comparisons over time or options |
| `stack` | `layers` [{label, amount}], `prefix` | "where the money goes" breakdowns |
| `route` | `stops` [...] | supply chains and journeys |
| `versus` | `left`/`right` {label, value} | myth vs reality, before/after |
| `stamp` | `word` | the one-line takeaway |
| `list` | `items` [...] | 3–4 quick points |
| `outro` | `text` | follow call to action |

Then run `python breakdown.py` to refresh `SCRIPTS.md`.

### Hook rules the scripts follow

1. **Say the number or the contradiction first.** "$2 to make, $25 to buy" beats "Let's talk about T-shirts."
2. **Make them wrong.** "A tariff is a tax on another country, right? Wrong."
3. **Make it personal.** "Your shirt", "your savings", "your phone".
4. **Open a loop you close at the end.** "So who took the other $23?" The stamp scene pays it off.
5. **Keep it under 2 seconds and 12 words.** The hook text slams on screen as it's spoken.
6. **A/B test.** Every episode has 3 hook variants. Post the same episode with a different `--hook` a couple of weeks later and keep the formula that wins.

Keep numbers honest. Every episode puts a short on-screen footnote ("Illustrative estimates", "Not financial advice"), which protects the account and builds trust.
