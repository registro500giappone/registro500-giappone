# -*- coding: utf-8 -*-
"""動画に「日本語の音声トラック（YouTube自動吹き替え）」があるかを実測する。"""
import sys, io, time, json
import yt_dlp

IDS = sys.argv[1:]
opts = {'quiet': True, 'no_warnings': True, 'skip_download': True,
        'extractor_args': {'youtube': {'player_client': ['visionos']}}}

out = io.open('audio_tracks.txt', 'w', encoding='utf-8')
summary = {'ja': 0, 'dub_any': 0, 'orig_only': 0, 'error': 0, 'total': 0}

with yt_dlp.YoutubeDL(opts) as ydl:
    for n, vid in enumerate(IDS):
        summary['total'] += 1
        try:
            info = ydl.extract_info(f'https://www.youtube.com/watch?v={vid}', download=False)
        except Exception as e:
            out.write(f'{vid}\tERROR\t{str(e)[:80]}\n')
            summary['error'] += 1
            continue

        langs = {}
        for f in info.get('formats', []):
            if f.get('vcodec') == 'none' and f.get('language'):
                note = f.get('format_note', '') or ''
                # 元音声か吹き替えかを区別
                kind = 'orig' if 'original' in note or f.get('language_preference', 0) > 0 else 'dub'
                langs.setdefault(f['language'], set()).add(kind)

        # yt-dlp の format_note に 'dubbed-auto' が入るものを拾い直す
        dubbed = set()
        for f in info.get('formats', []):
            if f.get('vcodec') == 'none' and f.get('language'):
                if 'dubbed' in (f.get('format_note') or '').lower():
                    dubbed.add(f['language'])

        keys = sorted(langs.keys())
        has_ja = any(k.startswith('ja') for k in keys)
        if has_ja:
            summary['ja'] += 1
        if dubbed:
            summary['dub_any'] += 1
        if len(keys) <= 1:
            summary['orig_only'] += 1

        out.write(f'{vid}\t{info.get("title","")[:52]}\n')
        out.write(f'   音声トラック: {keys}   吹き替え: {sorted(dubbed) if dubbed else "なし"}'
                  f'   日本語音声: {"★あり" if has_ja else "なし"}\n')
        out.flush()
        time.sleep(2)

out.write('\n=== 集計 ===\n')
out.write(json.dumps(summary, ensure_ascii=False, indent=1))
out.close()
print(json.dumps(summary))
