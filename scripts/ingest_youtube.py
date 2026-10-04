"""Fetch only YouTube metadata/captions. Never download or transcribe audio."""
import argparse
import html
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import requests
import yt_dlp
from youtube_transcript_api import YouTubeTranscriptApi

ROOT = Path(__file__).resolve().parents[1]


def video_id(value):
    if re.fullmatch(r'[\w-]{11}', value):
        return value
    url = urlparse(value)
    host = (url.hostname or '').removeprefix('www.')
    if url.scheme not in ('https', 'http'):
        raise ValueError('Use a YouTube URL or an 11-character video ID')
    if host == 'youtu.be':
        candidate = url.path.strip('/')
    elif host in ('youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'):
        candidate = parse_qs(url.query).get('v', [''])[0]
        if not candidate:
            match = re.match(r'^/(?:shorts|embed|live)/([\w-]{11})(?:/|$)', url.path)
            candidate = match[1] if match else ''
    else:
        candidate = ''
    if not re.fullmatch(r'[\w-]{11}', candidate):
        raise ValueError('Not a valid YouTube video URL')
    return candidate


def clean(text):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]*>', '', text))).strip()


def metadata(vid, session, proxy=None):
    result = {}
    info = None
    # The oEmbed endpoint is lightweight and often works even if extraction fails.
    try:
        response = session.get('https://www.youtube.com/oembed', params={'url': f'https://www.youtube.com/watch?v={vid}', 'format': 'json'}, timeout=20)
        response.raise_for_status()
        data = response.json()
        result = {'title': data['title'], 'channel': data.get('author_name', ''), 'thumbnail': data.get('thumbnail_url', ''), 'metadataSource': 'youtube-oembed'}
    except Exception as error:
        print(f'oEmbed: {type(error).__name__}', flush=True)
    try:
        with yt_dlp.YoutubeDL({'quiet': True, 'no_warnings': True, 'skip_download': True, 'socket_timeout': 15, 'retries': 1, 'extractor_retries': 1, **({'proxy': proxy} if proxy else {})}) as ydl:
            info = ydl.extract_info(f'https://www.youtube.com/watch?v={vid}', download=False)
        result.update({'title': info['title'], 'channel': info.get('channel') or info.get('uploader', ''), 'channelId': info.get('channel_id'), 'description': info.get('description', ''), 'duration': info.get('duration'), 'uploadDate': info.get('upload_date'), 'metadataSource': 'youtube'})
    except Exception as error:
        print(f'Metadata extraction: {type(error).__name__}', flush=True)
    return result, info


def transcript_cues(transcript):
    fetched = transcript.fetch()
    return [{'start': row.start, 'duration': row.duration, 'text': clean(row.text)} for row in fetched if clean(row.text) and row.duration > 0]


def choose_track(tracks, language):
    available = list(tracks)
    def rank(track):
        same = track.language_code == language
        family = track.language_code.split('-')[0] == language.split('-')[0]
        return (0 if same else 1 if family else 2, track.is_generated)
    return sorted(available, key=rank)[0] if available else None


def combine_translation(cues, translated):
    for cue in cues:
        # YouTube translation normally retains cue times. Match by overlap rather
        # than assuming both tracks contain exactly the same number of entries.
        matches = [row for row in translated if min(cue['start'] + cue['duration'], row['start'] + row['duration']) > max(cue['start'], row['start'])]
        if matches:
            cue['translation'] = ' '.join(dict.fromkeys(row['text'] for row in matches))


def fetch_captions(vid, language, translation, session, info):
    errors = []
    unavailable = False
    try:
        tracks = YouTubeTranscriptApi(http_client=session).list(vid)
        selected = choose_track(tracks, language)
        if selected is None:
            return {'captionStatus': 'unavailable', 'cues': []}
        cues = transcript_cues(selected)
        result = {'captionStatus': 'ready', 'captionLanguage': selected.language_code, 'isGenerated': selected.is_generated, 'captionSource': 'youtube', 'cues': cues}
        if translation and translation != selected.language_code and selected.is_translatable:
            try:
                translated = transcript_cues(selected.translate(translation))
                combine_translation(cues, translated)
                result['translationLanguage'] = translation
                result['translationSource'] = 'youtube'
            except Exception as error:
                result['translationError'] = type(error).__name__
                print(f'Translation unavailable: {type(error).__name__}', flush=True)
        return result
    except Exception as error:
        kind = type(error).__name__
        unavailable = kind in ('TranscriptsDisabled', 'NoTranscriptFound')
        errors.append(kind)
        print(f'Transcript API: {kind}', flush=True)
    # The extractor's public subtitle URL is a second route to the same YouTube
    # data, not an alternate lyric provider. It also helps with rate-limit errors.
    if info:
        for generated, source in ((False, info.get('subtitles', {})), (True, info.get('automatic_captions', {}))):
            if not source:
                continue
            langs = sorted(source, key=lambda code: (code != language, code.split('-')[0] != language.split('-')[0], code != 'en'))
            for code in langs:
                track = next((row for row in source[code] if row.get('ext') == 'json3'), None)
                if not track:
                    continue
                try:
                    response = session.get(track['url'], timeout=25)
                    response.raise_for_status()
                    events = response.json().get('events', [])
                    cues = [{'start': row['tStartMs'] / 1000, 'duration': row.get('dDurationMs', 0) / 1000, 'text': clean(''.join(seg.get('utf8', '') for seg in row.get('segs', [])))} for row in events if row.get('segs') and row.get('dDurationMs', 0) > 0]
                    cues = [row for row in cues if row['text']]
                    if cues:
                        return {'captionStatus': 'ready', 'captionLanguage': code, 'isGenerated': generated, 'captionSource': 'youtube', 'cues': cues}
                except Exception as error:
                    errors.append(type(error).__name__)
                    print(f'Subtitle URL: {type(error).__name__}', flush=True)
                break
    return {'captionStatus': 'unavailable' if unavailable else 'error', 'captionError': ', '.join(dict.fromkeys(errors)), 'cues': []}


def protect_editorial(previous, captions, now):
    """Archive refresh results without replacing corrected text or video-specific timing."""
    if previous.get('captionSource') != 'editorial' or not previous.get('cues'):
        return None
    data = {**previous, 'lastAttemptAt': now}
    if captions.get('captionStatus') == 'ready':
        data['sourceCues'] = captions['cues']
        data['sourceCaptionLanguage'] = captions.get('captionLanguage', '')
        data['sourceFetchedAt'] = now
        data.pop('sourceRefreshError', None)
    else:
        data['sourceRefreshError'] = captions.get('captionError') or captions.get('captionStatus')
    return data


def ingest(vid, language, translation, proxy=None):
    session = requests.Session()
    session.trust_env = False
    if proxy:
        session.proxies = {'http': proxy, 'https': proxy}
    session.headers['User-Agent'] = 'Mozilla/5.0'
    path = ROOT / 'data' / 'songs' / f'{vid}.json'
    previous = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
    source_id = previous.get('playbackVideoId', vid)
    meta, info = metadata(source_id, session, proxy)
    if previous.get('lyricsStorage') == 'external':
        data = {**previous, **meta, 'lastAttemptAt': datetime.now(timezone.utc).isoformat()}
        for key in ('id', 'title', 'duration', 'playbackSegment', 'nativeCaptionRanges', 'captionStatus', 'captionLanguage', 'playbackVideoId'):
            if key in previous:
                data[key] = previous[key]
        if previous.get('playbackSegment') and meta.get('duration'):
            data['sourceDuration'] = meta['duration']
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'{vid}: metadata refreshed; captions stay in the YouTube player', flush=True)
        return
    captions = fetch_captions(source_id, language, translation, session, info)
    if previous.get('musicalId') == 'le-rouge-et-le-noir' and captions.get('captionStatus') == 'ready' and captions.get('captionLanguage', '').split('-')[0] != 'fr':
        # Some playlist videos contain French singing that YouTube misdetects
        # as Spanish, Dutch or English. Do not advertise those as French lyrics.
        captions = {'captionStatus': 'unavailable', 'captionError': 'No usable French captions; other-language automatic track ignored', 'cues': []}
    now = datetime.now(timezone.utc).isoformat()
    protected = protect_editorial(previous, captions, now)
    data = protected or {**previous, **meta, 'id': vid, 'captionSource': 'youtube', 'lastAttemptAt': now}
    if not data.get('title'):
        data['title'] = f'YouTube · {vid}'
    if protected:
        pass  # Corrected learning cues and replacement-video metadata stay intact.
    elif captions['captionStatus'] != 'ready' and previous.get('cues'):
        # Never replace successfully retrieved captions with an error response.
        data['refreshError'] = captions.get('captionError') or captions['captionStatus']
    else:
        for key in ('translationError', 'translationLanguage', 'translationSource', 'captionError', 'refreshError'):
            data.pop(key, None)
        data.update(captions)
        if captions['captionStatus'] == 'ready':
            data['fetchedAt'] = now
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    catalog_path = ROOT / 'data' / 'catalog.json'
    catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
    entry = {**next((row for row in catalog if row['id'] == vid), {}), **{key: data.get(key, '') for key in ('id', 'title', 'channel', 'captionStatus', 'captionLanguage')}}
    catalog = [entry if row['id'] == vid else row for row in catalog]
    if not any(row['id'] == vid for row in catalog):
        catalog.append(entry)
    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{vid}: {data.get("captionStatus")} · {len(data.get("cues", []))} cues', flush=True)
    if data.get('captionStatus') != 'ready' and not meta:
        print('YouTube could not be reached; no replacement lyrics or timestamps were generated.', flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--video', default='')
    parser.add_argument('--language', default='fr')
    parser.add_argument('--translation', default='en')
    parser.add_argument('--proxy', default=None, help='Optional normal network proxy for local use (not stored in song data)')
    parser.add_argument('--pending', action='store_true')
    args = parser.parse_args()
    if args.video:
        ids = [video_id(args.video.strip())]
    elif args.pending:
        ids = [row['id'] for row in json.loads((ROOT / 'data' / 'catalog.json').read_text(encoding='utf-8')) if row.get('captionStatus') == 'pending']
    else:
        ids = [row['id'] for row in json.loads((ROOT / 'data' / 'catalog.json').read_text(encoding='utf-8'))]
    for vid in ids:
        ingest(vid, args.language, args.translation, args.proxy)


if __name__ == '__main__':
    main()
