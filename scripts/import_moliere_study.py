"""Import staged user-supplied Molière blocks and Chinese glosses locally.

The original video, playlist order and timestamp archives are retained. Neither
phonetic references nor spelling cleanup constitute a listening verification.
An instrumental excerpt and an unusable language-detection excerpt remain
explicitly distinct from the forty-three four-layer learning pages.
"""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path
from import_notre_study import corrected_reference, write_json

ROOT=Path(__file__).resolve().parents[1]
INSTRUMENTAL='_2YgJDC1ua4'
UNUSABLE='3A3on1aaNMs'
REVISION=1
NUMBERS={'2':'deux','3':'trois','9':'neuf','16':'seize','17':'dix-sept','19':'dix-neuf','21':'vingt et un','30':'trente','100':'cent','300':'trois cents','2400':'deux mille quatre cents','745':'sept cent quarante-cinq','1664':'mille six cent soixante-quatre'}

def spoken_text(text):
    text=re.sub(r'\bLouis\s+XIV\b','Louis quatorze',text)
    return re.sub(r'\d+',lambda m:NUMBERS.get(m[0],m[0]),text)

def make_entries(part,meanings,reference):
    cues=[];entries=[];previous_end=0
    for block in part['blocks']:
        start,end=block['start'],block['end']
        text=block['text'].strip()
        if not all(math.isfinite(x) for x in (start,end)) or not 0<=start<end<=part['duration'] or start<previous_end:
            raise ValueError('Invalid or overlapping supplied interval')
        previous_end=end
        meaning=meanings[str(block['sourceLine'])].strip()
        if not text or not re.search('[\u3400-\u9fff]',meaning):raise ValueError('Missing French text or Chinese gloss')
        ipa,ear=corrected_reference(spoken_text(text),reference)
        if not re.search('[\u3400-\u9fff]',ear) or re.search(r'\((en|fr)\)',ipa):raise ValueError('Unmapped reference reading')
        if part['trackNumber']==43 and block['sourceLine']>=855:
            review='舞台伪拉丁文 · 字幕待核听；音标按拼写作参考'
        else:
            review='原字幕此处识别不清 · 请对照原唱' if '识别不清' in meaning else ''
        cues.append({'text':text,'start':start,'duration':end-start})
        entries.append({
            'sourceText':text,'start':start,'ipa':ipa,'ear':ear,'meaning':meaning,
            'suppliedText':block['suppliedText'],'sourceLineId':f"moliere-timed-{block['sourceLine']}",
            'reviewNote':review,
            'timing':{'method':'supplied-timestamp','anchorStart':start,'sourceLineNumber':block['sourceLine'],'precision':'approximate'},
        })
    return cues,entries

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prepared',required=True,type=Path)
    parser.add_argument('--meanings',required=True,type=Path)
    parser.add_argument('--reference',required=True,type=Path)
    parser.add_argument('--source',required=True,type=Path)
    args=parser.parse_args()
    load=lambda p:json.loads(p.read_text(encoding='utf-8'))
    prepared,meanings,reference=map(load,(args.prepared,args.meanings,args.reference))
    digest=hashlib.sha256(args.source.read_bytes()).hexdigest()
    if digest!=prepared['sourceFileSHA256']:raise ValueError('The staged blocks do not match the supplied file')
    catalog=load(ROOT/'data/catalog.json');tracks=[t for t in catalog if t.get('musicalId')=='moliere']
    if len(tracks)!=45 or [t['id'] for t in tracks]!=[p['id'] for p in prepared['tracks']]:raise ValueError('Playlist mapping mismatch')
    original=prepared['sourceTracks']
    if set(original)!={t['id'] for t in tracks}:raise ValueError('Original transcript archive mismatch')
    pending=[];outputs=[];report=[]
    for track,part in zip(tracks,prepared['tracks']):
        route=track['id'];song=load(ROOT/'data/songs'/f'{route}.json')
        if song.get('playbackVideoId')!=route or song['duration']!=part['duration'] or song['playbackSegment']['start']!=0:raise ValueError('Recording mismatch')
        song.update(studyVersion=REVISION,studyInput={'file':args.source.name,'sha256':digest})
        song['suppliedCaptionBlocks']=original[route]
        if route in {INSTRUMENTAL,UNUSABLE}:
            if part['blocks']:raise ValueError('Unexpected vocal blocks in the nonverbal/unusable excerpt')
            kind='instrumental' if route==INSTRUMENTAL else 'unavailable'
            status='instrumental' if route==INSTRUMENTAL else 'pending'
            message='这一段是舞蹈与器乐片段，没有可导入的歌词。点击播放观看原唱现场。' if route==INSTRUMENTAL else '你提供的这一段字幕被识别成失真的英文残句，暂未生成法语学习卡片。可以先看原唱，或导入这段的法语字幕。'
            song.update(cues=[],captionStatus=status,captionSource='youtube-player',captionDelivery='source-video',studyKind=kind,lyricsStorage='external',studyEmptyMessage=message,textReviewStatus='nonverbal' if route==INSTRUMENTAL else 'unusable-language-detection',timingReviewStatus='user-supplied-timestamps')
            track.update(captionStatus=status,captionSource=song['captionSource'],studyKind=kind,cueCount=0,studyCueCount=0,textReviewStatus=song['textReviewStatus'])
            if route==UNUSABLE:pending.append({'id':route,'title':part['title'],'reason':'Source transcript contains unusable English fragments, not French lyrics'})
            report.append({'id':route,'trackNumber':part['trackNumber'],'kind':kind,'lines':0})
        else:
            cues,entries=make_entries(part,meanings,reference)
            if not cues:raise ValueError('Missing vocal content')
            song.update(cues=cues,captionStatus='ready',captionSource='editorial',captionDelivery='study-page',lyricsStorage='user-provided',studyKind='four-layer',isGenerated=False,textReviewStatus='source-auto-transcript-with-conservative-edits',timingReviewStatus='approximate')
            notes={
                'videoId':route,'playbackVideoId':route,'version':REVISION,
                'textSource':'user-supplied-auto-transcript','sourceFileSHA256':digest,
                'textReviewStatus':song['textReviewStatus'],'timingReviewStatus':'approximate',
                'pronunciationReviewStatus':'reference-with-liaison-corrections-not-listening-verified',
                'meaningSource':'editorial-chinese-from-user-transcript',
                'pronunciationEngine':'eSpeak NG phrase and word references with French liaison and loan corrections',
                'note':'法语和时间点来自你提供的分视频字幕，已整理明显拼写错误及中文释义。原字幕有识别残句，识别不清处已注明；… 表示残句缺口或分段接续。≈ 表示分段起止为近似值，音标和空耳是参考读法，尚未逐段核听。',
                'sources':[{'label':'本段原唱录像','url':song['sourceURL']}],
                'entries':entries,
            }
            outputs.append((ROOT/'data/study'/f'{route}.json',notes))
            track.update(captionStatus='ready',captionSource='editorial',studyKind='four-layer',isGenerated=False,cueCount=len(cues),studyCueCount=len(cues),textReviewStatus=song['textReviewStatus'],timingReviewStatus='approximate')
            report.append({'id':route,'trackNumber':part['trackNumber'],'kind':'four-layer','lines':len(cues),'unclearBlocks':sum(bool(e['reviewNote']) for e in entries),'editedBlocks':sum(e['sourceText']!=e['suppliedText'] for e in entries)})
        outputs.append((ROOT/'data/songs'/f'{route}.json',song))
    if len([r for r in report if r['kind']=='four-layer'])!=43:raise ValueError('Expected forty-three vocal pages')
    result={'sourceFile':args.source.name,'sourceFileSHA256':digest,'pageCount':45,'fourLayerPages':43,'instrumentalPages':1,'pendingPages':pending,'fourLayerBlocks':sum(r['lines'] for r in report),'excludedBlocks':prepared['excluded'],'tracks':report}
    # All routes, intervals and annotations have been validated before mutation.
    for path,data in outputs:write_json(path,data)
    write_json(ROOT/'data/catalog.json',catalog)
    write_json(ROOT/'data/moliere-study-import.json',result)
    print('Imported:',result['fourLayerPages'],'four-layer pages;',result['fourLayerBlocks'],'blocks; one instrumental and one unusable transcript page')

if __name__=='__main__':main()
