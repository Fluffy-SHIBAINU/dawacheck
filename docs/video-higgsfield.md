# Demo video: draft and Higgsfield scenes

The draft video is built from real screens of the live app, ElevenLabs narration and the app's own recorded verdict voices. Four optional scene shots can be generated in Higgsfield and dropped in.

## Rebuild the video

```bash
npx tsx scripts/video/capture.ts      # real screens from https://dawacheck-smoky.vercel.app (files a demo report from Kano)
npx tsx scripts/video/make-demo.ts    # narration, frames and the MP4: media/dawacheck-demo-draft.mp4
```

Narration and frames are cached in `media/`. Delete `media/narration` or `media/frames` to redo them.

## Add Higgsfield scenes

1. Generate each shot below in Higgsfield: 16:9, 5 to 6 seconds, realistic.
2. Save them as `media/higgsfield/H1.mp4` to `H4.mp4`.
3. Run `npx tsx scripts/video/make-demo.ts` again. Each scene plays at the start of its segment, under the narration, and the video grows by the scene lengths.

Keep the scenes honest. No readable text or logos. No phone screen facing the camera: every app screen in the video is the real app. The end card says the app screens were recorded from the live app. If you use scenes, add "Scenes generated with Higgsfield" in your submission text.

| Shot | Goes before | Narration over it | Prompt |
|---|---|---|---|
| H1 | the "1 in 10" card (0:00) | "One in ten medicines…" | Documentary handheld shot of a busy open-air market in Kano, northern Nigeria, in warm morning light. A small medicine stall with shelves of colourful boxes. A woman in a bright headscarf picks up a small medicine box and looks at it closely, unsure. Shallow depth of field, natural colours, realistic. No readable text or brand names. |
| H2 | the first app screens (about 0:11) | "DawaCheck works with no internet…" | Close-up of a woman at home in northern Nigeria holding a smartphone and a small medicine box at a wooden table, soft window light, documentary realism. The phone screen faces away from the camera. No readable text. |
| H3 | the amber verdict (about 0:32) | "This box copies a real number…" | A medicine vendor in his small shop in Zaria, Nigeria, unpacks a carton of medicine boxes and holds one up to check it, warm interior light, shelves of medicine behind him, documentary style. The phone, if any, faces away from the camera. No readable text. |
| H4 | the end card (about 1:23) | "DawaCheck. Check before you take." | Slow aerial shot over a busy Nigerian town at dusk, motorbikes and small shops lighting up, hopeful mood, cinematic. No text. |

Timings shift by the length of each scene you add; `media/timeline.txt` lists the segment start times after every build.
