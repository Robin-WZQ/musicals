"""Import time anchors from the supplied playlist transcript without rewriting text."""
import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def parse_times(raw):
    groups=[]
    for source_line,line in enumerate(raw.splitlines(),1):
        match=re.match(r'^(\d+):(\d{2})(?=\D|\d)',line.strip())
        if not match:continue
        start=int(match[1])*60+int(match[2])
        if not groups or start<groups[-1][-1]['start']:groups.append([])
        groups[-1].append({'start':start,'sourceLine':source_line})
    return groups

def intervals(anchors,duration):
    if duration<=0:raise ValueError('Video duration must be positive')
    if any(a['start']>b['start'] for a,b in zip(anchors,anchors[1:])):
        raise ValueError('Anchors must be ordered')
    starts=[];duplicates=[];end_markers=[]
    for anchor in anchors:
        start=anchor['start']
        if start<0 or start>duration:raise ValueError('Anchor outside video')
        if start==duration:end_markers.append(anchor['sourceLine']);continue
        if starts and start==starts[-1]:duplicates.append(anchor['sourceLine']);continue
        starts.append(start)
    ranges=[{'start':start,'duration':(starts[i+1] if i+1<len(starts) else duration)-start} for i,start in enumerate(starts)]
    return ranges,duplicates,end_markers

def write(path,data):
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',required=True,type=Path)
    args=parser.parse_args()
    raw=args.input.read_bytes();groups=parse_times(raw.decode('utf-8-sig'))
    catalog_path=ROOT/'data/catalog.json'
    catalog=json.loads(catalog_path.read_text(encoding='utf-8'))
    tracks=[t for t in catalog if t.get('musicalId')=='moliere']
    if len(groups)!=len(tracks) or len(tracks)!=45:
        raise ValueError('Expected one timestamp sequence per video, 45 in playlist order')
    digest=hashlib.sha256(raw).hexdigest()
    report={'sourceFile':args.input.name,'sourceFileSHA256':digest,'sourceAnchors':sum(len(g) for g in groups),'tracks':[]}
    updates=[]
    for track,anchors in zip(tracks,groups):
        path=ROOT/'data/songs'/f"{track['id']}.json"
        song=json.loads(path.read_text(encoding='utf-8'))
        if song['playbackVideoId']!=track['id'] or song['playbackSegment']['start']!=0:
            raise ValueError('Unexpected recording mapping')
        ranges,duplicates,end_markers=intervals(anchors,song['duration'])
        if not ranges:raise ValueError('A video has no usable timestamps')
        song.setdefault('originalNativeCaptionRanges',song['nativeCaptionRanges'])
        song.setdefault('originalNativeTimingSource',song['nativeTimingSource'])
        song['nativeCaptionRanges']=ranges
        song['nativeTimingSource']='user-supplied-time-caption'
        song['nativeTimingInput']={'file':args.input.name,'sha256':digest}
        song['timingReviewStatus']='user-supplied-timestamps'
        track['nativeCueCount']=len(ranges)
        updates.append((path,song))
        report['tracks'].append({'id':track['id'],'trackNumber':track['trackNumber'],'sourceAnchors':len(anchors),'segments':len(ranges),'duplicateSourceLines':duplicates,'endMarkerSourceLines':end_markers,'lastStart':ranges[-1]['start'],'lastSegmentDuration':ranges[-1]['duration']})
    report['segments']=sum(t['segments'] for t in report['tracks'])
    # Validate the complete playlist before replacing any local data.
    for path,song in updates:write(path,song)
    write(catalog_path,catalog)
    write(ROOT/'data/moliere-timing-import.json',report)
    print(f"Local import: {len(updates)} videos; {report['sourceAnchors']} anchors -> {report['segments']} segments.")
    print('Duplicate anchors merged:',sum(len(t['duplicateSourceLines']) for t in report['tracks']))
    print('Endpoint markers omitted:',sum(len(t['endMarkerSourceLines']) for t in report['tracks']))

if __name__=='__main__':main()
