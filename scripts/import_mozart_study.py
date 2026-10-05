"""Parse and import the user's timed transcript of the 2010 Mozart recording."""
import argparse
import hashlib
import json
import re
from pathlib import Path
from import_notre_study import corrected_reference, write_json

ROOT=Path(__file__).resolve().parents[1]
MID='mozart-opera-rock-2010'
VID='83Qn2IvP_-I'
STAMP=re.compile(r'^((?:\d{1,2}:)?\d{1,2}:\d{2})(.*)$')
UNITS=re.compile(r'^\d+\s*(?:heures?|minutes?|secondes?)(?:(?:,\s*|\s+et\s+)\d+\s*(?:heures?|minutes?|secondes?))*\s*')

def signature(text):
    return re.sub(r'[^a-z0-9]', '', text.lower().replace('é','e').replace('è','e').replace('â','a').replace('ô','o'))

def parse_supplied(raw, songs):
    lookup={signature(song['titleOriginal']):i for i,song in enumerate(songs)}
    lookup[signature('Je dors sur des roses')]=9
    lookup[signature('Ah! Vous dirais-je maman')]=5
    current=0;rows=[];markers={0:0};excluded=[]
    for line_number,line in enumerate(raw.splitlines(),1):
        chapter=re.match(r'^Chapitre\s+(\d+)\s*:',line.strip())
        if chapter:
            current=int(chapter[1])-1
            if not 0<=current<len(songs):raise ValueError('Unknown chapter')
            continue
        match=STAMP.match(line.strip())
        if not match:continue
        start=0
        for part in match[1].split(':'):start=start*60+int(part)
        original=UNITS.sub('',match[2]).strip()
        if original.startswith('['):
            excluded.append({'sourceLine':line_number,'start':start,'kind':'subtitle-credit'});continue
        for marker in re.findall(r'#([^#]+)#',original):
            chapter_index=lookup.get(signature(marker.strip()))
            if chapter_index is not None:
                current=chapter_index;markers.setdefault(current,start)
        text=re.sub(r'#[^#]+#','',original).strip()
        if not text:
            excluded.append({'sourceLine':line_number,'start':start,'kind':'music-title'});continue
        text=re.sub(r'\s+',' ',text)
        rows.append({'start':start,'text':text,'suppliedText':original,'sourceLine':line_number,'chapter':current})
    if any(a['start']>=b['start'] for a,b in zip(rows,rows[1:])):raise ValueError('Timestamps must strictly increase')
    if set(markers)!=set(range(22)):raise ValueError('Expected all 22 supplied chapter markers')
    return rows,markers,excluded

# Preserve proper names while recovering line breaks lost by the transcript UI.
NAMES=set('Wolfgang Amadeus Mozart Leopold Nannerl Aloysia Constance Weber Colloredo Salzbourg Paris Vienne Rosenberg Salieri Figaro Joseph Stéphanie Stephanie Cavalieri Anna Maria Autriche Allemagne Europe Dieu Seigneur Altesse Majesté Excellence Impériale Sire Empereur Saint Esprit Goethe Mannheim Munich Rome Allemand Allemande Français Française France Italie Stéphan Da Ponte Baron Requiem Dies Lacrimosa German Ja Schnell We Karl Theodor Fridolin Cécilia Lorenzo Arthur Wolfi Orange Sigismond Hieronymus Don Juan Flûte Pipeau Gutenberg'.split())
NAMES.update({'Noces','Enfers','Grimm','Stefani','Carlo','Goldoni','Münich','Sérail','Ville','II'})
TEXT_EDITS={'amoures mortes':'amours mortes','Les cliches sonnent': 'Les cloches sonnent',
    'Sachons êtres sages':'Sachons être sages','Nous serons debouts':'Nous serons debout',
    'Réveillons les fou qui sommeille en nous':'Réveillons le fou qui sommeille en nous',
    'Mozart a reussi':'Mozart a réussi',"C'est si bon de souffir":"C'est si bon de souffrir",'Sa Majesté Joseph Il,':'Sa Majesté Joseph II,'}
def split_text(text):
    for old,new in TEXT_EDITS.items():text=text.replace(old,new)
    text=text.replace('"','')
    foreign=['Guten Tag, mein Herr!','Schon Fraulein, mmh!','Ja, ja, ja Schnell!','We love you!']
    for i,line in enumerate(foreign):text=text.replace(line,f'\nforeignphrase{i}\n')
    for old,new in {'Fit de nous de joyeux pantins Wolfgang':'Fit de nous de joyeux pantins\nWolfgang',
        'En embrassant nos pères Wolfgang':'En embrassant nos pères\nWolfgang',
        'Nos ébats Constance':'Nos ébats\nConstance','Pour l\'Histoire Wolfgang':'Pour l\'Histoire\nWolfgang'}.items():text=text.replace(old,new)
    text=re.sub(r'\s+-\s+', '\n',text)
    text=re.sub(r'(?<=[.!?])\s+(?=[A-ZÀ-Ý])','\n',text)
    def break_at(match):
        following=re.match(r"[A-ZÀ-Ý](?:[a-zà-ÿ]+|['’][a-zà-ÿ]+)?",text[match.end():])[0]
        return match[0] if following in NAMES else '\n'
    text=re.sub(r"(?<=\S)\s+(?=[A-ZÀ-Ý](?:[a-zà-ÿ]+|['’][a-zà-ÿ]+|(?=\s)))",break_at,text)
    lines=[line.strip(' -') for line in text.split('\n') if line.strip(' -')]
    for i,line in enumerate(foreign):lines=[item.replace(f'foreignphrase{i}',line) for item in lines]
    # An article or preposition alone is a lost line break, not a study sentence.
    result=[];pending=''
    for line in lines:
        if line in {'Le','Les','Que','À la demande de','Faites hommage à'}:pending+=line+' ';continue
        result.append(pending+line);pending=''
    if pending:result.append(pending.strip())
    return result

def prepare(source_path, songs):
    source=source_path.read_bytes();rows,markers,excluded=parse_supplied(source.decode('utf-8-sig'),songs)
    parts=[]
    for index,song in enumerate(songs):
        start=markers[index];end=markers[index+1] if index+1<len(songs) else song['sourceDuration']
        if end<=start:raise ValueError('Chapter range must be positive')
        selected=[row for row in rows if row['chapter']==index]
        if not selected:raise ValueError('Empty chapter')
        anchors=[]
        for row in selected:
            next_time=next((r['start'] for r in rows if r['start']>row['start']),end)
            native=[r for r in song['nativeCaptionRanges'] if row['start']-.01<=r['start']<min(next_time,end)]
            # Retain a subtitle-file gap instead of looping applause or music.
            tail=min(next_time,end,max((r['start']+r['duration'] for r in native),default=next_time))
            text=row['text'];lines=split_text(text)
            if not start<=row['start']<tail<=end:raise ValueError(f'Anchor outside chapter: {song["id"]} line {row["sourceLine"]}')
            anchors.append({**row,'end':round(tail,3),'lines':lines})
        parts.append({'id':song['id'],'title':song['titleOriginal'],'segment':{'start':start,'end':end,'source':'user-supplied-mozart-timestamps','precision':'seconds'},'anchors':anchors})
    return {'sourceFileSHA256':hashlib.sha256(source).hexdigest(),'sourceFilename':source_path.name,'tracks':parts,'excluded':excluded}

def split_span(lines,start,end):
    weights=[max(1,len(re.findall('[aeiouyàâäéèêëîïôöùûüœ]',line,re.I))) for line in lines]
    cursor=start;spans=[]
    for weight in weights:
        tail=cursor+(end-start)*weight/sum(weights);spans.append((round(cursor,3),round(tail,3)));cursor=tail
    return spans

def import_pack(prepared, meanings, reference, spoken):
    catalog=json.loads((ROOT/'data/catalog.json').read_text(encoding='utf-8'))
    tracks={row['id']:row for row in catalog};outputs=[];report=[]
    for part in prepared['tracks']:
        route=part['id'];song=json.loads((ROOT/'data/songs'/f'{route}.json').read_text(encoding='utf-8'))
        if song['musicalId']!=MID or song['playbackVideoId']!=VID:raise ValueError('Wrong recording')
        cues=[];entries=[]
        for anchor in part['anchors']:
            for number,(text,(start,end)) in enumerate(zip(anchor['lines'],split_span(anchor['lines'],anchor['start'],anchor['end'])),1):
                meaning=meanings[text].strip()
                if not re.search('[\u3400-\u9fff]',meaning):raise ValueError('Missing Chinese meaning')
                if text in reference.get('_explicitReadings',{}):ipa,ear=reference['_explicitReadings'][text]
                else:ipa,ear=corrected_reference(spoken(text),reference)
                if not part['segment']['start']<=start<end<=part['segment']['end']:raise ValueError('Invalid span')
                cues.append({'text':text,'start':start,'duration':round(end-start,3)})
                entries.append({'start':start,'sourceText':text,'ipa':ipa,'ear':ear,'meaning':meaning,
                    'sourceLineId':f'mozart-timed-{anchor["sourceLine"]}-{number}','suppliedText':anchor['suppliedText'],
                    'kind':'lyric-or-dialogue','timing':{'method':'user-supplied-anchor-subdivision' if len(anchor['lines'])>1 else 'user-supplied-anchor',
                        'anchorStart':anchor['start'],'anchorEnd':anchor['end'],'sourceLineNumber':anchor['sourceLine'],'precision':'approximate'}})
        if not cues:raise ValueError('Missing chapter content')
        song.setdefault('originalPlaybackSegment',song['playbackSegment'])
        song.update(cues=cues,playbackSegment=part['segment'],sourceURL=f'https://www.youtube.com/watch?v={VID}&t={part["segment"]["start"]}',duration=part['segment']['end']-part['segment']['start'],captionSource='editorial',captionStatus='ready',
            captionDelivery='study-page',lyricsStorage='user-provided',studyKind='four-layer',textReviewStatus='user-supplied-manual-transcript',
            timingReviewStatus='approximate',phoneticReviewStatus='reference-with-liaison-corrections',isGenerated=False,studyVersion=1)
        notes={'videoId':route,'playbackVideoId':VID,'version':1,'textSource':'user-supplied-timed-transcript',
            'sourceFileSHA256':prepared['sourceFileSHA256'],'sourceFilename':prepared['sourceFilename'],'textReviewStatus':song['textReviewStatus'],
            'timingReviewStatus':'approximate','pronunciationReviewStatus':'reference-with-liaison-corrections','meaningSource':'machine-chinese-with-editorial-corrections',
            'pronunciationEngine':'eSpeak NG phrase and word readings with liaison corrections',
            'note':'法语原文与时间点采用你提供的本场字幕。中文释义结合人物和情境整理；音标为参考读法。≈ 表示字幕块内分句及末尾的近似切点。',
            'sources':[{'label':'2010年巴黎原唱录像','url':song['sourceURL']}],'entries':entries}
        track=tracks[route];track.update(duration=song['duration'],captionStatus='ready',captionSource='editorial',studyKind='four-layer',
            textReviewStatus=song['textReviewStatus'],timingReviewStatus='approximate',cueCount=len(cues),studyCueCount=len(cues))
        outputs.extend([(ROOT/'data/songs'/f'{route}.json',song),(ROOT/'data/study'/f'{route}.json',notes)])
        report.append({'id':route,'anchors':len(part['anchors']),'lines':len(cues),'segment':part['segment']})
    if len(report)!=22:raise ValueError('Expected 22 complete pages')
    for path,value in outputs:write_json(path,value)
    write_json(ROOT/'data/catalog.json',catalog)
    write_json(ROOT/'data/mozart-study-import.json',{'sourceFileSHA256':prepared['sourceFileSHA256'],'sourceFilename':prepared['sourceFilename'],
        'tracks':report,'excluded':prepared['excluded'],'lineCount':sum(row['lines'] for row in report)})
    return report
