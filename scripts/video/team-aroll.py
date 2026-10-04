# Cuts Shawn's team-intro recording into the tight A-roll (pauses, "uh"s and slips removed),
# alternating a gentle punch-in to hide jump cuts, cleaning and levelling the voice.
# Writes media/team/aroll.mp4, media/team/edl.json (source and output times per segment) and
# media/team/words-out.json (caption word timings on the output timeline).
# Usage: python3 scripts/video/team-aroll.py "<path to the recording>"
# Needs media/team/transcript.json: ElevenLabs Speech-to-Text (scribe_v1) of the recording, with word timings.
import json, subprocess, sys
SRC = sys.argv[1] if len(sys.argv) > 1 else 'media/team/source.mov'
FF = 'node_modules/ffmpeg-static/ffmpeg'
# (source start, source end, zoom) — times come from media/team/transcript.json word timings
SEG = [
    (0.70, 4.66, 1.00),   # Hi, I'm Shawn Yoon. This is the DawaCheck team.
    (5.06, 5.46, 1.12),   # Me,
    (5.90, 6.80, 1.12),   # Claude Code,
    (7.32, 10.40, 1.00),  # and a crew of AI agents working together.
    (11.32, 15.52, 1.12), # I worked on a seven-year, $700M national project
    (15.98, 20.06, 1.00), # called DCPS, Disability Case Processing System.
    (21.04, 23.60, 1.12), # I'm also an immigrant.
    (24.04, 33.12, 1.00), # When my family first arrived ... wasn't deadly for us.
    (34.10, 36.36, 1.12), # For millions of people, it is deadly.
    (36.90, 43.92, 1.00), # One in ten medicines ... fake or substandard.
    (44.76, 46.00, 1.12), # So I built DawaCheck.
    (46.42, 48.28, 1.00), # Snap a photo of a medicine box.
    (48.66, 59.90, 1.12), # Your phone checks ... Hausa, English, or Pidgin.
    (61.18, 63.98, 1.00), # Next, a standalone DawaCheck device
    (65.70, 66.92, 1.12), # There's no phone needed,
    (71.08, 71.84, 1.00), # DawaCheck,
]
parts, labels, t = [], [], 0.0
edl = []
for i, (a, b, z) in enumerate(SEG):
    w, h = int(1280 / z) // 2 * 2, int(720 / z) // 2 * 2
    x, y = (1280 - w) // 2, max(0, int(250 - h * 0.36))
    parts.append(f"[0:v]trim={a}:{b},setpts=PTS-STARTPTS,crop={w}:{h}:{x}:{y},scale=1920:1080:flags=lanczos,setsar=1[v{i}]")
    parts.append(f"[0:a]aformat=channel_layouts=mono,atrim={a}:{b},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st={b-a-0.03:.3f}:d=0.03[a{i}]")
    labels.append(f"[v{i}][a{i}]")
    edl.append({'src_start': a, 'src_end': b, 'out_start': round(t, 3)})
    t += b - a
parts.append(f"{''.join(labels)}concat=n={len(SEG)}:v=1:a=1[vc][ac]")
parts.append("[vc]eq=contrast=1.05:saturation=1.08:brightness=0.01,unsharp=5:5:0.5,format=yuv420p[vout]")
parts.append("[ac]highpass=f=80,afftdn=nf=-25,acompressor=threshold=-20dB:ratio=3:attack=10:release=150,loudnorm=I=-16:TP=-1.5:LRA=11,aformat=sample_fmts=fltp:channel_layouts=mono,aresample=48000:in_chlayout=mono:out_chlayout=stereo,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[aout]")
open('media/team/aroll-filter.txt', 'w').write(';\n'.join(parts))
subprocess.run([FF, '-y', '-hide_banner', '-loglevel', 'error', '-i', SRC, '-filter_complex_script', 'media/team/aroll-filter.txt',
                '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-r', '30',
                '-c:a', 'aac', '-b:a', '192k', 'media/team/aroll.mp4'], check=True)
json.dump({'segments': edl, 'total': round(t, 3)}, open('media/team/edl.json', 'w'), indent=1)
FIX = {'Sean': 'Shawn'}  # speech-to-text spelling of the name
words = []
for w in json.load(open('media/team/transcript.json'))['words']:
    if w.get('type') != 'word':
        continue
    for seg in edl:
        if seg['src_start'] - 0.05 <= w['start'] < seg['src_end']:
            shift = seg['out_start'] - seg['src_start']
            end = min(w['end'], seg['src_end'])
            words.append({'w': FIX.get(w['text'], w['text']), 's': round(w['start'] + shift, 2), 'e': round(end + shift, 2)})
            break
json.dump(words, open('media/team/words-out.json', 'w'))
print('aroll', round(t, 2), 's')
