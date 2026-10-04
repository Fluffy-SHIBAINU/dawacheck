# Submission videos

Three videos, each under 60 seconds: 1920×1080, 30 fps, H.264 with AAC audio at 48 kHz, mixed to about −16 LUFS.

| Video | File | Length | What it shows |
|---|---|---|---|
| Team introduction | `media/dawacheck-team-final.mp4` | 59.9 s | Shawn's own recording, cut tight, with scene shots, app screens, captions and graphics |
| Product demo | `media/dawacheck-demo-final.mp4` | 56.4 s | The live app: offline check, green in Hausa, amber, report, red in Pidgin, sync |
| Technical walkthrough | `media/dawacheck-tech-final.mp4` | 59.1 s | Architecture, the verdict engine, data, sync and tests |

`media/` is gitignored, so the videos and their inputs stay on the build machine. The scripts that make them are in `scripts/video/`.

## What is real and what is generated

- Every app screen is the real app, captured from https://dawacheck-smoky.vercel.app by `capture.ts`.
- The verdict voices are the app's own ElevenLabs clips from `public/voice`.
- The team video is Shawn's own voice. Demo and tech narration is ElevenLabs `eleven_multilingual_v2`.
- Scene shots (market, pharmacy, vendor, clinic, device concept, data globe, tech) are generated with Higgsfield: GPT Image 2.5 stills animated with Kling 3.0 (5 s, no sound). They contain no readable text and no app screens. Every end card says "scenes generated with Higgsfield".
- The standalone device in the team video is a concept, labelled "CONCEPT · NEXT".
- Music is ElevenLabs Music.

## Rebuild

These inputs were made once and are not scripted:

- `media/hf/*.mp4`: the Higgsfield scenes, made through the Higgsfield MCP (the Higgsfield CLI is blocked on trial accounts).
- `media/music-{team,demo,tech}.mp3`: ElevenLabs Music, 60 s each.
- `media/team/transcript.json`: ElevenLabs Speech-to-Text (`scribe_v1`) of the team recording, with word timings.
- `media/shots/*.png`: `npx tsx scripts/video/capture.ts` (it files one demo report from Kano on the live backend).

Then:

```bash
python3 scripts/video/team-aroll.py "<path to the team recording>"
npx tsx scripts/video/team-final.ts
npx tsx scripts/video/narrated.ts --video=demo
npx tsx scripts/video/narrated.ts --video=tech
```

- `team-aroll.py` cuts the recording (pauses and slips removed, alternating punch-ins to hide the cuts), cleans the voice, and writes the caption word timings. The cut list is the `SEG` table at the top.
- `team-final.ts` adds the cold open, scene shots, app screens, graphics, captions, music and end card. Overlays are timed to spoken words, so they follow the cut list.
- `narrated.ts` builds the demo and tech videos from `stories.ts` (narration line and visuals per segment). Narration is cached in `media/<video>/voice`; after editing a line, delete that segment's `.mp3` and `.json` to record it again. New narration needs `ELEVENLABS_API_KEY` in `.env`.
- `gfx.ts` holds the shared graphics: phone frames, cards, architecture diagrams, captions, logo and end card.

`make-demo.ts` builds the earlier long draft and is kept for reference.
