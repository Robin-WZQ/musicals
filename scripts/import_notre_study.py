"""Build the study edition from a user-supplied songs.js (parsed as JSON, never executed).

Timing anchors belong to the same 1998 YouTube recording. Merged transcript
segments are aligned monotonically against the supplied English glosses; French
syllable weights split an anchor into its constituent lines. These are approximate
cuts, not an acoustic alignment. The original text/IPA and alignment report remain
available for later listening review.
"""
import argparse
import difflib
import hashlib
import json
import math
import re
import unicodedata
from pathlib import Path
from pronunciation import annotate, cons, vowels

ROOT = Path(__file__).resolve().parents[1]
TOKEN = re.compile(r"[A-Za-zÀ-ÿŒœ]+(?:['’-][A-Za-zÀ-ÿŒœ]+)*")
LIAISON = set('les des mes tes ses nos vos ces aux leurs nous vous ils elles on un aucun mon ton son en bien rien très plus moins trop quand est sont ont petit petits grand grands gros bon bons beau beaux vieux nouveaux premier dernier deux trois six dix tout tous certains plusieurs quelles quels'.split())
ASPIRE = set('haut haute hauts hautes héros haines haine hélas hasard honte hontes haineux harpe harpes hors onze oui huit huitième'.split())
STOP = set('the a an is are was were in of to and or that this it i you we they he she my your his her our their for with on as at be have has will shall do does all so but'.split())
WORD_OVERRIDES = {
    "d'aujourd'hui": 'd o ʒ u ʁ d ɥ i', "qu'aujourd'hui": 'k o ʒ u ʁ d ɥ i',
    'dos': 'd o', 'qua-si-mo-do': 'k a z i m o d o', "qu'ça": 'k s a',
    'luther': 'l y t ɛ ʁ', "tell'ment": 't ɛ l m ɑ̃', 'testament': 't ɛ s t a m ɑ̃',
}


def read_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def write_json(path, value):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def load_supplied(path):
    source = Path(path).read_text(encoding='utf-8-sig').strip()
    if not source.startswith('window.songs='):
        raise ValueError('Expected a JSON assignment beginning window.songs=')
    songs = json.loads(source[len('window.songs='):].removesuffix(';'))
    if len(songs) != 51 or sum(len(s['lines']) for s in songs) != 1677:
        raise ValueError('Unexpected edition: expected 50 main songs and the 19-line reprise')
    return songs


def normalized(text):
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode().lower()
    text = text.replace('one thousand four hundred and eighty-two', '1482')
    text = text.replace('1 482', '1482').replace('our lord', 'god')
    return re.findall(r'[a-z0-9]+', text.replace('ln ', 'in ').replace('l ', 'i '))


def similarity(left, right):
    a, b = normalized(left), normalized(right)
    sa, sb = set(a) - STOP, set(b) - STOP
    overlap = 2 * len(sa & sb) / max(1, len(sa) + len(sb))
    sequence = difflib.SequenceMatcher(None, ' '.join(a), ' '.join(b)).ratio()
    numbers_a, numbers_b = {w for w in a if w.isdigit()}, {w for w in b if w.isdigit()}
    number_penalty = .18 if numbers_a != numbers_b else 0
    return max(0, .55 * overlap + .45 * sequence - number_penalty)


def align(lines, anchors):
    """Ordered matching; one English anchor may cover up to eight French lines."""
    n, m = len(lines), len(anchors)
    dp = [[-math.inf] * (m + 1) for _ in range(n + 1)]
    prev = {}
    dp[0][0] = 0
    for i in range(n + 1):
        for j in range(m + 1):
            if not math.isfinite(dp[i][j]):
                continue
            choices = []
            if j < m:
                choices.append((i, j + 1, -.55, ('caption-gap',)))
            if i < n:
                choices.append((i + 1, j, -.65, ('line-gap',)))
            if j < m:
                for size in range(1, min(8, n - i) + 1):
                    text = ' '.join(line['en'] for line in lines[i:i + size])
                    score = similarity(text, anchors[j]['text'])
                    choices.append((i + size, j + 1, 4 * score - 1.8 - .08 * (size - 1), ('match', i, i + size, j, score)))
            for ni, nj, cost, action in choices:
                value = dp[i][j] + cost
                if value > dp[ni][nj]:
                    dp[ni][nj], prev[(ni, nj)] = value, (i, j, action)
    actions = []
    i, j = n, m
    while i or j:
        pi, pj, action = prev[(i, j)]
        actions.append(action)
        i, j = pi, pj
    return [a for a in reversed(actions) if a[0] == 'match']


def weights(line):
    # Nasal marks are attached to their vowel, so count the vowel nuclei once.
    return max(1, len(re.findall('[aeiouyɑɛɔœøə]', line['ipa'])))


def split_span(lines, start, end):
    counts = [weights(line) for line in lines]
    total = sum(counts)
    cursor = start
    result = []
    for weight in counts:
        tail = cursor + (end - start) * weight / total
        result.append((round(cursor, 3), round(tail, 3)))
        cursor = tail
    return result


def time_lines(lines, anchors, segment):
    matches = align(lines, anchors)
    spans, details = [None] * len(lines), [None] * len(lines)
    for _, lo, hi, j, score in matches:
        start = anchors[j]['start']
        # UI captions give starts only. Cap unusually long trailing intervals,
        # leaving applause/instrumental transitions outside the line repeat.
        next_start = anchors[j + 1]['start'] if j + 1 < len(anchors) else segment['end']
        end = min(next_start, start + max(5, min(18, sum(weights(l) for l in lines[lo:hi]) * .65)), segment['end'])
        times = split_span(lines[lo:hi], start, end)
        for k, time in zip(range(lo, hi), times):
            spans[k] = time
            details[k] = {'method': 'matched-transcript-anchor', 'anchorStart': start, 'similarity': round(score, 3), 'groupSize': hi - lo}
    # Interpolate unmatched text only between known neighbours. Do not stretch
    # the complete song uniformly and erase the actual transcript anchors.
    i = 0
    while i < len(lines):
        if spans[i] is not None:
            i += 1
            continue
        lo = i
        while i < len(lines) and spans[i] is None:
            i += 1
        start = spans[lo - 1][1] if lo else segment['start']
        end = spans[i][0] if i < len(lines) else segment['end']
        if end - start < .12 * (i - lo):
            # Make room inside the preceding anchor without changing its start.
            if lo:
                start = max(spans[lo - 1][0] + .15, end - max(.4, .7 * (i - lo)))
                spans[lo - 1] = (spans[lo - 1][0], start)
            else:
                end = min(segment['end'], start + max(.4, .7 * (i - lo)))
                if i < len(lines):
                    spans[i] = (end, max(end + .1, spans[i][1]))
        for k, time in zip(range(lo, i), split_span(lines[lo:i], start, end)):
            spans[k], details[k] = time, {'method': 'between-anchor-interpolation'}
    return spans, details


def corrected_reference(text, reference):
    tokens = list(TOKEN.finditer(text))
    raw = re.sub('[ːˑˈˌ]', '', reference[text])
    words = [w.strip().split() for w in raw.split('|') if w.strip()]
    # eSpeak emits /yi/ instead of the glide in suis/suivre and their forms.
    def glides(phones):
        return re.sub(r'(?<!\S)y i(?=\s|$)', 'ɥ i', ' '.join(phones)).split()
    words = [glides(w) for w in words]
    if len(tokens) == len(words):
        for i, token in enumerate(tokens):
            word = token.group().lower()
            if word in WORD_OVERRIDES:
                words[i] = WORD_OVERRIDES[word].split()
            alone = re.sub('[ːˑˈˌ]', '', reference[token.group()])
            isolated = WORD_OVERRIDES[word].split() if word in WORD_OVERRIDES else glides(alone.replace('|', '').split())
            if i + 1 < len(tokens):
                nxt = tokens[i + 1].group().lower()
                connected = not re.search('[,.;:!?…]', text[token.end():tokens[i + 1].start()])
                liaison_word = word in LIAISON or word.endswith("'est") or word.endswith('’est')
                # The /t/ in vingt-deux ... vingt-neuf belongs to the compound
                # numeral even when the supplied spelling uses spaces.
                liaison_word = liaison_word or word == 'vingt' and nxt in {'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'}
                allow = connected and liaison_word and nxt not in ASPIRE and nxt != 'et'
                # Reject liaison after plural nouns and finite verbs, and before
                # et / an aspirated h. Keep consonants belonging to the word.
                if not allow and words[i] != isolated and words[i][-1:] in (['t'], ['z'], ['n']):
                    if words[i][:-1] == isolated:
                        words[i] = isolated
            # Also remove a doubled final root consonant emitted as liaison.
            if len(words[i]) > 1 and words[i][-1] == words[i][-2] and words[i][-1] in ('t', 'z'):
                words[i] = words[i][:-1]
    # Use the word-boundary annotation after corrections. Mute h can link, while
    # aspirated h blocks it. Spell out the connection explicitly when identifiable.
    ipa, ear = annotate(text, ' | '.join(' '.join(w) for w in words))
    if len(tokens) == len(words):
        pieces = []
        for i, phones in enumerate(words):
            pieces.append(''.join(phones))
            if i + 1 < len(words):
                nxt = tokens[i + 1].group().lower()
                gap = text[tokens[i].end():tokens[i + 1].start()]
                can_link = nxt != 'et' and nxt not in ASPIRE and not re.search('[,.;:!?…]', gap)
                onset = words[i + 1][0]
                # A vowel-initial spelling may begin with a glide: oiseau,
                # yeux, huile. Their grammatical liaison must still be shown.
                vowel_onset = onset in vowels or onset in {'j', 'w', 'ɥ'} and nxt[0] in 'aàâäeéèêëiîïoôöuùûüyÿœh'
                pieces.append('‿' if can_link and phones[-1] in cons and vowel_onset else ' ')
        ipa = '[' + ''.join(pieces) + ']'
    return ipa, ear


def make_encore(catalog, musical):
    if any(t['id'] == '3AnTqOIgPr0' for t in catalog):
        return
    first = read_json(ROOT / 'data/songs' / f"{musical['trackIds'][0]}.json")
    song = {**first, 'id': '3AnTqOIgPr0', 'title': 'Le temps des cathédrales · Rappel', 'titleOriginal': 'Le temps des cathédrales · Rappel', 'titleZh': '大教堂时代 · 谢幕合唱', 'trackNumber': 51, 'act': 2, 'isEncore': True, 'duration': 114, 'playbackSegment': {'start': 7947, 'end': 8061, 'source': 'youtube-timestamp-comment', 'precision': 'seconds'}, 'nativeCaptionRanges': [], 'sourceURL': 'https://www.youtube.com/watch?v=3AnTqOIgPr0&t=7947'}
    song.pop('alternateVideoId', None)
    write_json(ROOT / 'data/songs/3AnTqOIgPr0.json', song)
    info = read_json(ROOT / 'data/info' / f"{musical['trackIds'][0]}.json")
    info.update(videoId=song['id'], titleZh=song['titleZh'], titleOriginal=song['titleOriginal'], artistZh='1998 年法语原卡司', artistOriginal='Distribution originale 1998', roleZh='全体演员', actZh='谢幕')
    paragraphs = ['故事结束后，演员们再次唱起开场曲。熟悉的旋律把观众带回大教堂前，这一次是全体演员的谢幕合唱。', '《舞吧，我的艾丝美拉达》之后，演出进入谢幕。乐队演奏过后，演员们重回台前，用《大教堂时代》的副歌向观众告别。', '1998年法语原版的七位主演一同返场：布鲁诺·佩尔蒂埃、加鲁、丹尼尔·拉沃伊、海伦娜·塞加拉、帕特里克·菲奥里、吕克·梅尔维尔和朱莉·泽纳蒂。']
    for section, paragraph in zip(info['sections'], paragraphs):
        section['paragraphs'] = [paragraph]
    info['sources'] = [s for s in info['sources'] if s['id'] not in ('stage-clip', 'native-captions')] + [{'id': 'encore-video', 'label': '1998 原版谢幕合唱', 'url': song['sourceURL']}]
    write_json(ROOT / 'data/info/3AnTqOIgPr0.json', info)
    catalog.append({k: song[k] for k in ('id', 'title', 'titleZh', 'titleOriginal', 'duration', 'musicalId', 'trackNumber', 'act', 'isEncore')})
    musical['trackIds'].append(song['id'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('songs_js', type=Path)
    parser.add_argument('--anchors', required=True, type=Path)
    parser.add_argument('--pronunciation-reference', required=True, type=Path)
    parser.add_argument('--report', required=True, type=Path)
    args = parser.parse_args()
    supplied, reference = load_supplied(args.songs_js), read_json(args.pronunciation_reference)
    anchors = read_json(args.anchors)
    for anchor in anchors:
        time = 0
        for component in anchor['time'].split(':'):
            time = time * 60 + int(component)
        anchor['start'] = time
        if not anchor.get('text'):
            raise ValueError('Transcript anchors need text for matching')
    catalog, musicals = read_json(ROOT / 'data/catalog.json'), read_json(ROOT / 'data/musicals.json')
    musical = next(m for m in musicals if m['id'] == 'notre-dame-de-paris')
    make_encore(catalog, musical)
    tracks = {t['id']: t for t in catalog}
    digest = hashlib.sha256(args.songs_js.read_bytes()).hexdigest()
    report, count = [], 0
    for route, source in zip(musical['trackIds'], supplied):
        track, song = tracks[route], read_json(ROOT / 'data/songs' / f'{route}.json')
        # Order is part of the supplied edition, but verify names as well.
        if track.get('isEncore'):
            assert source['displayOrder'] == 51
        else:
            expected = ''.join(normalized(song['titleOriginal']))
            actual = ''.join(normalized(source['title']))
            assert expected == actual, (expected, actual)
        lines, segment = source['lines'], song['playbackSegment']
        local_anchors = [a for a in anchors if segment['start'] <= a['start'] < segment['end']]
        if local_anchors:
            spans, details = time_lines(lines, local_anchors, segment)
        else:
            spans = split_span(lines, segment['start'], segment['end'])
            details = [{'method': 'chapter-interpolation'}] * len(lines)
        cues, entries = [], []
        for line, (start, end), detail in zip(lines, spans, details):
            text = line['original'].strip()
            ipa, ear = corrected_reference(text, reference)
            if not re.search(r'[\u3400-\u9fff]', line['zh']):
                raise ValueError('Missing Chinese meaning: ' + line['id'])
            if not segment['start'] <= start < end <= segment['end'] or end - start < .05:
                raise ValueError(f'Invalid span {route} {line["id"]}: {start} {end}')
            cues.append({'text': text, 'start': start, 'duration': round(end - start, 3)})
            entries.append({'start': start, 'sourceText': text, 'ipa': ipa, 'ear': ear, 'meaning': line['zh'].strip(), 'sourceIPA': line['ipa'], 'sourceLineId': line['id'], 'speaker': line.get('speaker', ''), 'timing': detail})
        song.update(cues=cues, captionSource='editorial', captionStatus='ready', captionLanguage='fr', captionDelivery='study-page', lyricsStorage='user-provided', isGenerated=False, textReviewStatus='user-supplied', timingReviewStatus='approximate', studyVersion=3)
        write_json(ROOT / 'data/songs' / f'{route}.json', song)
        notes = {'videoId': route, 'playbackVideoId': song['playbackVideoId'], 'version': 3, 'textSource': 'user-supplied-songs-js', 'textReviewStatus': 'user-supplied', 'timingReviewStatus': 'approximate', 'pronunciationReviewStatus': 'reference-with-liaison-corrections', 'reviewStatus': 'user-text-reference-pronunciation-approximate-timing', 'meaningSource': 'user-supplied-chinese', 'pronunciationEngine': 'eSpeak NG phrase and isolated-word reference with liaison corrections', 'sourceFileSHA256': digest, 'sources': [{'label': '用户提供的歌词资料对应网页', 'url': 'https://fufu-life.github.io/musicals/notre-dame-de-paris/index.html'}, {'label': '1998 年法语原卡司演出', 'url': song['sourceURL']}], 'note': '法语和中文译文来自你提供的 songs.js；音标按词尾和联诵规则整理，中文空耳由音标生成。原唱采用1998年法语原卡司演出；逐句切点依据同一录像的字幕内容匹配及分句估算，≈ 表示近似位置。', 'entries': entries}
        write_json(ROOT / 'data/study' / f'{route}.json', notes)
        track.update(captionStatus='ready', captionLanguage='fr', captionSource='editorial', textReviewStatus='user-supplied', timingReviewStatus='approximate', cueCount=len(cues), studyCueCount=len(cues), nativeCueCount=len(song['nativeCaptionRanges']))
        count += len(cues)
        report.append({'id': route, 'title': song['titleOriginal'], 'lines': len(cues), 'anchors': len(local_anchors), 'matchedLines': sum(e['timing']['method'] == 'matched-transcript-anchor' for e in entries), 'interpolatedLines': sum(e['timing']['method'] != 'matched-transcript-anchor' for e in entries), 'lowConfidenceGroups': [e['sourceLineId'] for e in entries if e['timing'].get('similarity', 1) < .4]})
    assert count == 1677
    musical['background'] = '改编自雨果的《巴黎圣母院》，吕克·普拉蒙东作词，理查德·科西昂特作曲，1998年在巴黎首演。按两幕剧情顺序收录法语原卡司的50首正曲，并附谢幕合唱。'
    write_json(ROOT / 'data/catalog.json', catalog)
    write_json(ROOT / 'data/musicals.json', musicals)
    write_json(args.report, report)
    print(f'Built {len(report)} songs / {count} four-layer lines; {sum(r["matchedLines"] for r in report)} lines matched to transcript anchors; all cuts remain approximate.')


if __name__ == '__main__':
    main()
