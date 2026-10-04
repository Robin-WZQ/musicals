"""Import the user's 2010 performance transcript with reviewed Chinese readings.

The transcript's timestamps anchor groups of lines. Subdivisions use vowel
weights, so all resulting cuts retain approximate status. External lyric pages
are not scraped. Text, Chinese meanings and pronunciation are independently
recorded; refreshes preserve the editorial edition and the actual video ID.
"""
import argparse,hashlib,json,re
from pathlib import Path
from import_notre_study import corrected_reference,write_json

ROOT=Path(__file__).resolve().parents[1]
CORRECTIONS={
    'L’amour, y que ça qui compte.':"L'amour, y a que ça qui compte.",
    "L'amour, y que ça qui compte.":"L'amour, y a que ça qui compte.",
    'Complément fou.':'Complètement fou.',
    'Être haït et trahi':'Être haï et trahi',
    'Vous en oublier même le plaisir':'Vous en oubliez même le plaisir',
    "M'a-t'il seulement aimé":"M'a-t-il seulement aimé",
    'NAIT fou.':'Naît fou.',
    "N'E.S.T où":"N'est ou",
    'N.A.I.T?':'Naît ?'
}
NUMBERS={'15':'quinze','16':'seize','20':'vingt','30':'trente'}
def clean_text(text):
    text=re.sub(r'\s+',' ',text).strip()
    if text in {'Benvolio/','Montaigu :','Capulet :'}:return ''
    text=re.sub(r'^(?:Romeo|Capulet)\s*:\s*','',text)
    text=CORRECTIONS.get(text,text)
    text=re.sub(r'\s*\(x\d+\)','',text).strip(' «»')
    for old,new in {
        'complétement':'complètement','qu’elle drôle':'quelle drôle',
        "on a que 16":"on n'a que 16",'la votre':'la vôtre',
        'qui vit debout':'qui vis debout','ou ils tomberont':'où ils tomberont',
        'ramènerai peut etre':'ramènerait peut-être',
        'À trahi ses parents':'A trahi ses parents','Mon cœur est trahit':'Mon cœur est trahi',
        'nous seront seuls':'nous serons seuls','Soit banni':'Sois banni',
        "toi qui a voulu":"toi qui as voulu",'Toi qui sait tout':'Toi qui sais tout',
        'Qu’est- ce':'Qu’est-ce','Qu\'est- ce':"Qu'est-ce",
    }.items():text=text.replace(old,new)
    return text if re.search(r'[A-Za-zÀ-ÿŒœ]',text) else ''

def spoken_text(text):
    text=re.sub(r'\d+',lambda m:NUMBERS.get(m[0],m[0]),text)
    for old,new in {
        'Qu’j’ai':"Que j'ai",'j’n’sens':'je ne sens','p’tit':'petits',
        "m'croyais":'me croyais',"n'crains":'ne crains',"d'plus":'de plus',
        'Etes-vous':'Êtes-vous',"C'n'est":"Ce n'est","qu'c'est":"que c'est",
        "n'doit":'ne doit',"d'médailles":'de médailles',"d'batailles":'de batailles',
        "d'venir":'devenir',"d'vivre":'de vivre',"d'jamais":'de jamais',
    }.items():text=text.replace(old,new)
    return text

def parse_transcript(raw):
    rows=[]
    for line_number,line in enumerate(raw.splitlines(),1):
        m=re.match(r'^((?:\d{1,2}:)?\d{1,2}:\d{2})(.*)$',line.strip())
        if not m:continue
        start=0
        for part in m[1].split(':'):start=start*60+int(part)
        text=re.sub(r'^\d+ (?:heures?|minutes?|secondes?)(?:(?:, | et )\d+ (?:heures?|minutes?|secondes?))*','',m[2]).strip()
        if text:rows.append({'start':start,'text':text,'sourceLine':line_number})
    if any(a['start']>=b['start'] for a,b in zip(rows,rows[1:])):raise ValueError('Timestamps must increase')
    return rows

def split_anchor(lines,start,end):
    if end<=start:raise ValueError('Empty anchor')
    weights=[max(1,len(re.findall('[aeiouyàâäéèêëîïôöùûüœ]',line['text'],re.I))) for line in lines]
    spans=[];cursor=start
    for weight in weights:
        tail=cursor+(end-start)*weight/sum(weights)
        spans.append((round(cursor,3),round(tail,3)));cursor=tail
    return spans

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prepared',required=True,type=Path)
    parser.add_argument('--meanings',required=True,type=Path)
    parser.add_argument('--reference',required=True,type=Path)
    parser.add_argument('--report',required=True,type=Path)
    args=parser.parse_args()
    load=lambda p:json.loads(p.read_text(encoding='utf-8'))
    prepared,meanings,reference=load(args.prepared),load(args.meanings),load(args.reference)
    catalog=load(ROOT/'data/catalog.json');tracks={t['id']:t for t in catalog}
    report=[]
    # Validate every input and prepare all files before modifying the edition.
    outputs=[]
    for part in prepared['tracks']:
        route=part['id'];track=tracks[route];song=load(ROOT/'data/songs'/f'{route}.json')
        if song['musicalId']!='romeo-et-juliette-2010' or song['playbackVideoId']!='kgGN5675TAY':raise ValueError('Edition mismatch')
        if part['instrumental']:continue
        segment=part['segment'];cues=[];entries=[]
        for anchor in part['anchors']:
            lines=[{**p,'text':clean_text(p['text']),'suppliedText':p['text']} for p in anchor['lines']]
            lines=[p for p in lines if p['text']]
            for line,(start,end) in zip(lines,split_anchor(lines,anchor['start'],anchor['end'])):
                text=line['text'];meaning=meanings[line['suppliedText']].strip()
                if not re.search('[\u3400-\u9fff]',meaning):raise ValueError('Missing Chinese meaning')
                ipa,ear=corrected_reference(spoken_text(text),reference)
                if not segment['start']<=start<end<=segment['end']:raise ValueError('Cue outside song')
                cues.append({'text':text,'start':start,'duration':round(end-start,3)})
                entries.append({'start':start,'sourceText':text,'ipa':ipa,'ear':ear,'meaning':meaning,'suppliedText':line['suppliedText'],'sourceLineId':f'romeo-timed-{anchor["sourceLine"]}-{len(entries)+1}','speaker':'' if line['speaker']=='???' else line['speaker'],'timing':{'method':'supplied-timestamp' if len(lines)==1 else 'supplied-timestamp-subdivision','anchorStart':anchor['start'],'sourceLineNumber':anchor['sourceLine'],'precision':'approximate'}})
        if not cues:raise ValueError('Empty vocal song')
        song.update(playbackSegment=segment,duration=segment['end']-segment['start'],cues=cues,captionSource='editorial',captionStatus='ready',captionDelivery='study-page',lyricsStorage='user-provided',studyKind='four-layer',textReviewStatus='user-supplied-with-spelling-corrections',timingReviewStatus='approximate',isGenerated=False,studyVersion=4)
        notes={'videoId':route,'playbackVideoId':song['playbackVideoId'],'version':4,'textSource':'user-supplied-timed-transcript','sourceFileSHA256':prepared['sourceFileSHA256'],'textReviewStatus':song['textReviewStatus'],'timingReviewStatus':'approximate','pronunciationReviewStatus':'reference-with-liaison-corrections','meaningSource':'editorial-chinese-from-user-french','pronunciationEngine':'eSpeak NG phrase and isolated-word reference with French and liaison corrections','note':'法语歌词、对白与时间点采用你提供的2010版字幕文本；中文释义逐条编写，音标与空耳按法语参考读法整理。≈ 表示字幕块内分句及片段尾部的近似切点。','sources':[{'label':'2010版原唱录像','url':song['sourceURL']}],'entries':entries}
        track.update(duration=song['duration'],captionStatus='ready',captionSource='editorial',textReviewStatus=song['textReviewStatus'],timingReviewStatus='approximate',cueCount=len(cues),studyCueCount=len(cues))
        outputs.extend([(ROOT/'data/songs'/f'{route}.json',song),(ROOT/'data/study'/f'{route}.json',notes)])
        report.append({'id':route,'title':part['title'],'anchors':len(part['anchors']),'lines':len(cues),'correctedPhrases':sum(e['sourceText']!=e['suppliedText'] for e in entries)})
    if len(report)!=39:raise ValueError('Expected 39 vocal songs')
    for path,value in outputs:write_json(path,value)
    write_json(ROOT/'data/catalog.json',catalog);write_json(args.report,report)
    print('Imported',len(report),'vocal tracks;',sum(r['lines'] for r in report),'four-layer lines; cuts remain approximate.')

if __name__=='__main__':main()
