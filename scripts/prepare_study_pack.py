"""Prepare local user-supplied bilingual captions for the four-layer learning UI.

Reads local files only. Does not fetch lyrics, publish files, or mark speech-engine
pronunciation as checked against the performance.
"""
import argparse
import json
import re
import subprocess
from pathlib import Path
from pronunciation import pronunciation_map

ROOT=Path(__file__).resolve().parents[1]


def read_captions(path):
    source=path.read_text(encoding='utf-8-sig')
    js="import {parseCaptions} from './assets/captions.mjs';let input='';for await(const c of process.stdin)input+=c;process.stdout.write(JSON.stringify(parseCaptions(input)));"
    result=subprocess.run(['node','--input-type=module','-e',js],input=source,encoding='utf-8',capture_output=True,cwd=ROOT,check=True)
    return json.loads(result.stdout)


def align_meanings(cues, chinese):
    for cue in cues:
        meaning=cue.get('studyMeaning') or cue.get('translation','')
        if not re.search(r'[\u3400-\u9fff]',meaning):
            overlaps=[row for row in chinese if min(cue['end'],row['end'])>max(cue['start'],row['start'])]
            meaning=' '.join(dict.fromkeys(row['text'] for row in overlaps))
        if not re.search(r'[\u3400-\u9fff]',meaning):
            raise ValueError(f'Chinese meaning missing at {cue["start"]:.3f}s; provide a bilingual JSON or matching Chinese captions')
        cue['studyMeaning']=meaning
    return cues


def slice_track(cues,song):
    segment=song['playbackSegment']
    rows=[]
    for cue in cues:
        # Assign by start to avoid duplicating a boundary-spanning sung line.
        if segment['start']<=cue['start']<segment['end']:
            end=min(cue['end'],segment['end'])
            rows.append({**cue,'duration':end-cue['start'],'end':end})
    return rows


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--captions',type=Path,required=True)
    p.add_argument('--chinese',type=Path)
    p.add_argument('--output',type=Path,required=True)
    p.add_argument('--musical',default='notre-dame-de-paris')
    args=p.parse_args()
    cues=read_captions(args.captions)
    if not cues:raise ValueError('No valid caption timestamps')
    cues=align_meanings(cues,read_captions(args.chinese) if args.chinese else [])
    missing=[c['text'] for c in cues if not(c.get('ipa') and c.get('ear'))]
    generated=pronunciation_map(missing) if missing else {}
    for cue in cues:
        if cue['text'] in generated:
            cue['ipa'],cue['ear']=generated[cue['text']]
    catalog=json.loads((ROOT/'data/catalog.json').read_text(encoding='utf-8'))
    tracks=[t for t in catalog if t.get('musicalId')==args.musical]
    if not tracks:raise ValueError('Unknown musical')
    packs=[]
    for track in tracks:
        song=json.loads((ROOT/f'data/songs/{track["id"]}.json').read_text(encoding='utf-8'))
        if not song.get('playbackSegment'):raise ValueError('This musical has no full-recording track segments')
        packs.append({'id':track['id'],'titleZh':track['titleZh'],'cueCount':len(slice_track(cues,song)),
                      'timebase':'source','playbackVideoId':song['playbackVideoId'],'cues':slice_track(cues,song)})
    pack={'version':1,'musicalId':args.musical,'playbackVideoId':packs[0]['playbackVideoId'],
          'timebase':'source','pronunciationReview':'reference-needs-listening-review' if generated else 'user-supplied',
          'cues':cues,'tracks':[{k:v for k,v in row.items() if k!='cues'} for row in packs]}
    args.output.mkdir(parents=True,exist_ok=True)
    (args.output/'study-pack.json').write_text(json.dumps(pack,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    for row in packs:
        if row['cues']:(args.output/f'{row["id"]}.json').write_text(json.dumps(row,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Prepared {len(cues)} annotated cues; {sum(bool(row["cues"]) for row in packs)} tracks covered; outputs stay local')


if __name__=='__main__':main()
