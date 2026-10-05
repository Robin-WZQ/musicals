"""Import the user-supplied Don Juan transcript with reviewed reference annotations."""
import json,re
from pathlib import Path
from import_notre_study import corrected_reference,write_json
ROOT=Path(__file__).resolve().parents[1]
MID='don-juan'
VID='ZmzpG11NJwc'
def split_span(lines,start,end):
    weights=[max(1,len(re.findall('[aeiouyàâäéèêëîïôöùûüœ]',line,re.I))) for line in lines]
    cursor=start;spans=[]
    for weight in weights:
        tail=cursor+(end-start)*weight/sum(weights);spans.append((round(cursor,3),round(tail,3)));cursor=tail
    return spans

def import_pack(prepared, meanings, reference, spoken):
    expected=[f'donjuan-{i:02d}' for i in range(1,42)]
    if [p['id'] for p in prepared['tracks']]!=expected:raise ValueError('Expected all 41 ordered Don Juan pages')
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
                    'sourceLineId':f'donjuan-timed-{anchor["sourceLine"]}-{number}','suppliedText':anchor['suppliedText'],
                    'language':'es' if text in reference.get('_explicitReadings',{}) else 'fr','kind':'lyric-or-dialogue','timing':{'method':'user-supplied-anchor-subdivision' if len(anchor['lines'])>1 else 'user-supplied-anchor',
                        'anchorStart':anchor['start'],'anchorEnd':anchor['end'],'sourceLineNumber':anchor['sourceLine'],'precision':'approximate'}})
        if not cues:raise ValueError('Missing chapter content')
        song.setdefault('originalPlaybackSegment',song['playbackSegment'])
        song.update(cues=cues,playbackSegment=part['segment'],sourceURL=f'https://www.youtube.com/watch?v={VID}&t={part["segment"]["start"]}',duration=part['segment']['end']-part['segment']['start'],captionSource='editorial',captionStatus='ready',
            captionDelivery='study-page',lyricsStorage='user-provided',studyKind='four-layer',textReviewStatus='user-supplied-manual-transcript',
            timingReviewStatus='approximate',phoneticReviewStatus='reference-with-liaison-corrections',isGenerated=False,studyVersion=1)
        notes={'videoId':route,'playbackVideoId':'ZmzpG11NJwc','version':1,'textSource':'user-supplied-timed-transcript',
            'sourceFileSHA256':prepared['sourceFileSHA256'],'sourceFilename':prepared['sourceFilename'],'textReviewStatus':song['textReviewStatus'],
            'timingReviewStatus':'approximate','pronunciationReviewStatus':'reference-with-liaison-corrections','meaningSource':'machine-chinese-with-editorial-corrections',
            'pronunciationEngine':'eSpeak NG phrase and word readings with liaison corrections',
            'note':'歌词原文与时间点采用你提供的本场字幕。中文释义结合人物和情境整理；音标为参考读法。≈ 表示字幕块内分句及末尾的近似切点。',
            'sources':[{'label':'本场原唱录像','url':song['sourceURL']}],'entries':entries}
        track=tracks[route];track.update(duration=song['duration'],captionStatus='ready',captionSource='editorial',studyKind='four-layer',
            textReviewStatus=song['textReviewStatus'],timingReviewStatus='approximate',cueCount=len(cues),studyCueCount=len(cues))
        outputs.extend([(ROOT/'data/songs'/f'{route}.json',song),(ROOT/'data/study'/f'{route}.json',notes)])
        report.append({'id':route,'anchors':len(part['anchors']),'lines':len(cues),'segment':part['segment']})
    if len(report)!=41:raise ValueError('Expected 41 complete pages')
    for path,value in outputs:write_json(path,value)
    write_json(ROOT/'data/catalog.json',catalog)
    write_json(ROOT/'data/donjuan-study-import.json',{'sourceFileSHA256':prepared['sourceFileSHA256'],'sourceFilename':prepared['sourceFilename'],
        'tracks':report,'excluded':prepared['excluded'],'lineCount':sum(row['lines'] for row in report)})
    return report
