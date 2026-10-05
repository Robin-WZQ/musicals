"""Parse a user-supplied songs.js and align the reviewed lines to local anchors."""
import argparse,array,difflib,functools,hashlib,json,math,re,unicodedata
from pathlib import Path
from import_notre_study import TOKEN,corrected_reference,write_json
from pronunciation import raw_pronunciation_map
ROOT=Path(__file__).resolve().parents[1]
WORD=re.compile('[a-z]+')
SPELL={"′":"'","’":"'",'par centaine':'par centaines',"c'est pas jolie":"c'est pas joli",
 "s'évertu,":"s'évertue", "qu'j'en vaut":"qu'j'en vaux",'faux-pas':'faux pas',
 'Ils sont prêt':'Ils sont prêts','Ils maitrisent':'Ils maîtrisent','animal des que':'animale dès que',
 'animal dès que':'animale dès que','Ni femme génie femme fatale':'Ni femme-objet ni femme fatale',
 'sans aucun remord':'sans aucun remords','mâle dominant mal dominer par leur sens':'Mâles dominants, mal dominés par leurs sens',
 'Pourquoi faut il':'Pourquoi faut-il','Homme pressé, la peau pressé':"Homme pressé, l'âme oppressée",
 'Tan de fêlures':'Tant de fêlures','la vide':'le vide',"Tu n'en a jamais":"Tu n'en as jamais",
 "j'accumulais ai":"j'accumulais", "Qu'importe les histoires":"Qu'importent les histoires",
 'En déplaise':'N’en déplaise', 'À mémoire':'À la mémoire','nous a éprouvé':'nous a éprouvés',
 'Fait le pacte':'Fais le pacte','je trouverais les mots':'je trouverai les mots',
 "m'a vu grandir":"m'a vue grandir",'de Modène, de Chambellan':'de Modène et chambellan',
 "à peine à 19 ans":"à peine dix-neuf ans","puisque'elle":"puisqu'elle",'Le saut du secret':'Le sceau du secret',
 'Tout ce qui contre nous font':'Tous ceux qui contre nous font',
 'tu avais tenté tant':'tu avais tant et tant','Tu avais tenté tant':'Tu avais tant et tant',
 'De rêves trop grand':'De rêves trop grands','De rêver trop grand':'De rêves trop grands',"dès que je l'ai prédit":"tel que je l'ai prédit",
 'Dans de mots suspendus':'Dans des mots suspendus','que je l’espère':'qui, je l’espère,',
 "que je l'espère":"qui, je l'espère,", "m'a prit ma mère":"m'a pris ma mère",'enfance fût':'enfance fut',
 'Comedia Del Arte':"commedia dell'arte",'Madelaine':'Madeleine','des comedienne':'des comédiennes',
 'je serai comedien':'je serai comédien','Les décors et son envers':'Le décor et son envers',
 'Aux diables toutes les conventions':'Au diable toutes les conventions',
}
LINE_FIXES={'05-028':"Rends-moi l'envie, et de ma vie le sens",'14-027':'Oui, tu avais tant et tant','04-040':"On en oublie l'enjeu"}
SPOKEN={"qu'c'est":"que c'est","J'm'en":"Je m'en","qu'j'en":"que j'en","J'n'ai":"Je n'ai","J'suis":"Je suis","j'suis":"je suis","j'fais":"je fais","n'veux":"ne veux","n'm'as":"ne m'as"}
def load(path):return json.loads(Path(path).read_text(encoding='utf-8'))
def supplied(path):
 raw=path.read_bytes();text=raw.decode('utf-8-sig').strip()
 if not text.startswith('window.songs='):raise ValueError('Expected a window.songs JSON assignment')
 body=text[len('window.songs='):].strip();songs,end=json.JSONDecoder().raw_decode(body)
 if body[end:].strip() not in ('',';'):raise ValueError('Unexpected executable text after JSON')
 if len(songs)!=16 or sum(len(s['lines']) for s in songs)!=654:raise ValueError('Expected the supplied sixteen-song edition')
 ids=[l['id'] for s in songs for l in s['lines']]
 if len(set(ids))!=len(ids):raise ValueError('Duplicate supplied line IDs')
 return songs,hashlib.sha256(raw).hexdigest()
def key(line):return line['id'].split('musical-')[-1]
def corrected(text,line_key):
 if line_key in LINE_FIXES:return LINE_FIXES[line_key]
 for a,b in SPELL.items():text=text.replace(a,b)
 text=re.sub(r'(?<!\w)A (?=quoi|vouloir|la comédie|la commedia)','À ',text)
 text=re.sub(r'\bdéshabillez moi\b','déshabillez-moi',text)
 text=re.sub(r'\brends moi\b','rends-moi',text,flags=re.I)
 return re.sub(r'\s+',' ',text).strip()
def spoken(text):
 for a,b in SPOKEN.items():text=text.replace(a,b)
 return text
def words(text):
 text=unicodedata.normalize('NFD',text.lower()).replace('œ','oe')
 text=''.join(c for c in text if unicodedata.category(c)!='Mn')
 return WORD.findall(text)
@functools.lru_cache(maxsize=200000)
def similarity(a,b):return 1.0 if a==b else difflib.SequenceMatcher(None,a,b,autojunk=False).ratio()
def align(target,source):
 """Global word alignment, including joined words, with stable repeat ordering."""
 n,m=len(target),len(source);dp=[array.array('f',[0])*(m+1) for _ in range(n+1)];back=[bytearray(m+1) for _ in range(n+1)]
 gap=.72
 for i in range(1,n+1):dp[i][0]=i*gap;back[i][0]=2
 for j in range(1,m+1):dp[0][j]=j*gap;back[0][j]=3
 for i in range(1,n+1):
  a=target[i-1]
  for j in range(1,m+1):
   b=source[j-1];score=similarity(a,b)
   # In a tie, consume trailing source repetitions rather than moving a
   # matched lyric to a later chorus with identical words.
   choices=[(dp[i][j-1]+gap,3),(dp[i-1][j-1]+1.25*(1-score),1),(dp[i-1][j]+gap,2)]
   if j>1:choices.append((dp[i-1][j-2]+1.25*(1-similarity(a,source[j-2]+b))+.12,4))
   if i>1:choices.append((dp[i-2][j-1]+1.25*(1-similarity(target[i-2]+a,b))+.12,5))
   value,op=min(choices,key=lambda c:round(c[0],5));dp[i][j]=value;back[i][j]=op
 mapping={};i,j=n,m
 while i or j:
  op=back[i][j]
  if op==1:mapping[i-1]=(j-1,similarity(target[i-1],source[j-1]));i-=1;j-=1
  elif op==2:i-=1
  elif op==3:j-=1
  elif op==4:mapping[i-1]=(j-2,similarity(target[i-1],source[j-2]+source[j-1]));i-=1;j-=2
  elif op==5:
   score=similarity(target[i-2]+target[i-1],source[j-1]);mapping[i-1]=(j-1,score);mapping[i-2]=(j-1,score);i-=2;j-=1
  else:raise ValueError('Broken alignment path')
 return mapping
def source_words(song,notes):
 out=[];points=[];owners=[];ranges=[]
 trims={876:'les autres',11:"je m'appelle",40:"je m'appelle",651:'je suis né',345:'regardez-moi',442:'oubliez'}
 paired=list(zip(song['cues'],notes['entries']))
 if song['id']=='SsTRsTN3teI':
  raw=next(b for b in song['suppliedCaptionBlocks'] if b['sourceLine']==123)
  paired.append(({'start':raw['start'],'duration':.7},{'sourceText':'Prénom','suppliedText':raw['text'],'timing':{'sourceLineNumber':123}}))
 paired.sort(key=lambda p:p[0]['start'])
 for cue,e in paired:
  start,end=cue['start'],cue['start']+cue['duration'];number=e['timing']['sourceLineNumber']
  if number in trims:
   raw=e['suppliedText'];p=raw.lower().find(trims[number]);allwords=words(raw)
   if p>=0:start+=(end-start)*len(words(raw[:p]))/max(1,len(allwords))
  if number==342:end=min(end,start+.6)
  text=e['sourceText']
  if number==432:text="Rien lâché. On a cravaché, on s'est"
  if number==433:text=text.replace('Accrochés.','Accrochés à des rochers.')
  if number==435:text='Tout est bien qui finit bien. Fais le pacte. Gardons nos rêves intacts. Fais le pacte.'
  ws=words(text);ranges.append({'start':start,'end':end,'sourceLine':number})
  for i,w in enumerate(ws):out.append(w);points.append(start+(end-start)*i/max(1,len(ws)));owners.append(number)
 return out,points,owners,ranges
def prepare(songs,manifest,meaning_edits,source_archive=None):
 tracks=[]
 for original,selected in zip(songs,manifest['tracks']):
  route=selected['id']
  if source_archive:song,notes=source_archive[route]['song'],source_archive[route]['notes']
  else:song=load(ROOT/'data/songs'/f'{route}.json');notes=load(ROOT/'data/study'/f'{route}.json')
  lines=[];target=[];ranges=[]
  # This stage recording cuts album verses and places the short coda last.
  # Preserve every supplied line in the archive, without inventing playback
  # positions for album-only text inside spoken scenes in the stage video.
  order=original['order'];input_lines=original['lines'];omitted=[]
  omissions={7:{'07-038'},9:{'09-001-a','09-001-b','09-017','09-031-b','09-032-a','09-032-b','09-033','09-033-a','09-033-b','09-038','09-039','09-040','09-041','09-042-a','09-042-b','09-043','09-044-a','09-044-b','09-045'},12:{'12-029','12-030','12-031','12-032','12-033','12-034'},14:{'14-025','14-026','14-027','14-028'}}
  omitted=[l for l in input_lines if key(l) in omissions.get(order,set())]
  input_lines=[l for l in input_lines if key(l) not in omissions.get(order,set())]
  if order==14:
   input_lines=[l for l in input_lines if key(l) not in {'14-022','14-023','14-024'}]+[l for l in input_lines if key(l) in {'14-022','14-023','14-024'}]
  for line in input_lines:
   text=corrected(line['original'],key(line));a=len(target);target.extend(words(text));ranges.append((a,len(target)))
   lines.append({**line,'text':text,'meaning':meaning_edits.get(key(line),line['zh'])})
  source,points,owners,source_ranges=source_words(song,notes);mapping=align(target,source)
  anchors=sorted(i for i,(_,score) in mapping.items() if score>=.5)
  def point(index):
   if index in mapping and mapping[index][1]>=.5:return points[mapping[index][0]]
   left=max((a for a in anchors if a<index),default=None);right=min((a for a in anchors if a>index),default=None)
   if left is None:return max(song['playbackSegment']['start'],points[mapping[right][0]]-(right-index)*.4)
   if right is None:
    end=source_ranges[-1]['end'];return min(end,points[mapping[left][0]]+(index-left)*max(.15,(end-points[mapping[left][0]])/(len(target)-left)))
   t0,t1=points[mapping[left][0]],points[mapping[right][0]]
   return t0+(t1-t0)*(index-left)/(right-left)
  starts=[point(a) for a,z in ranges];entries=[]
  for i,(line,(a,z)) in enumerate(zip(lines,ranges)):
   start=starts[i];end=starts[i+1] if i+1<len(starts) else source_ranges[-1]['end']
   coverage=sum(j in mapping and mapping[j][1]>=.5 for j in range(a,z))/max(1,z-a)
   matched=[mapping[j][0] for j in range(a,z) if j in mapping and mapping[j][1]>=.5]
   source_ids=list(dict.fromkeys(owners[j] for j in matched))
   if source_ids:
    last=max(r['end'] for r in source_ranges if r['sourceLine']==source_ids[-1])
    if end-last>4:end=last
   entries.append({**line,'start':round(start,3),'end':round(end,3),'coverage':round(coverage,3),'sourceAnchorLines':source_ids})
  tracks.append({'id':route,'trackNumber':original['order'],'title':original['title'],'duration':song['duration'],'lines':entries,'sourceRanges':source_ranges,'omittedLines':[{'id':l['id'],'reason':'album-stage-version-difference'} for l in omitted]})
 return tracks
def reviewed(songs,meanings,reference):
 """Keep the complete supplied edition, including text absent from stage cuts."""
 canonical={}
 for song in songs:
  for line in song['lines']:
   if key(line) in meanings:canonical[' '.join(words(corrected(line['original'],key(line))))]=meanings[key(line)]
 result=[]
 for song in songs:
  lines=[]
  for line in song['lines']:
   text=corrected(line['original'],key(line));reading=spoken(text)
   ipa,ear=corrected_reference(reading,reference)
   meaning=canonical.get(' '.join(words(text)),line['zh']).strip()
   if not re.search('[\u3400-\u9fff]',meaning):raise ValueError('Missing Chinese: '+line['id'])
   lines.append({'sourceLineId':line['id'],'sourceLineIndex':line['sourceLineIndex'],'lineIndex':line['lineIndex'],'sourceText':text,'ipa':ipa,'ear':ear,'meaning':meaning,'suppliedText':line['original'],'sourceIPA':line['ipa'],'sourceMeaning':line['zh'],'speaker':line.get('speaker','')})
  result.append({'order':song['order'],'sourceSongId':song['id'],'title':song['title'],'titleZh':song['titleZh'],'lines':lines})
 return result

def reference_for(songs,path):
 texts=list(dict.fromkeys(spoken(corrected(l['original'],key(l))) for s in songs for l in s['lines']))
 tokens=list(dict.fromkeys(m.group() for t in texts for m in TOKEN.finditer(t)))
 reference=load(path) if path.exists() else {}
 missing=[t for t in texts+tokens if t not in reference]
 if missing:reference.update(raw_pronunciation_map(missing));write_json(path,reference)
 return reference

def apply(report,edition,anchors):
 """Validate every output before mutating the library or its study files."""
 digest=report['sourceSHA256'];by_line={l['sourceLineId']:l for s in edition for l in s['lines']}
 catalog=load(ROOT/'data/catalog.json');catalog_by_id={t['id']:t for t in catalog};outputs=[];stats=[]
 for track,full in zip(report['tracks'],edition):
  route=track['id'];song=load(ROOT/'data/songs'/f'{route}.json');cues=[];entries=[];previous=0
  for aligned in track['lines']:
   start,end=aligned['start'],aligned['end'];line=by_line[aligned['id']]
   if not 0<=previous<=start<end<=song['duration']:raise ValueError(f'Invalid interval {route} {line["sourceLineId"]}: {start} {end}')
   previous=end
   cues.append({'text':line['sourceText'],'start':start,'duration':round(end-start,3)})
   entries.append({**line,'start':start,'reviewNote':'','timing':{'method':'reference-word-alignment','precision':'approximate','sourceAnchorLines':aligned['sourceAnchorLines'],'wordCoverage':aligned['coverage']}})
  song.update(cues=cues,captionStatus='ready',captionLanguage='fr',captionSource='editorial',captionDelivery='study-page',lyricsStorage='user-provided',isGenerated=False,studyVersion=3,textReviewStatus='cross-checked',timingReviewStatus='approximate',studyInput={'file':'moliere-supplied-lyrics.json','sha256':digest})
  notes={'videoId':route,'playbackVideoId':song['playbackVideoId'],'version':3,'textSource':'user-supplied-songs-js','sourceFileSHA256':digest,'textReviewStatus':'cross-checked','textReviewScope':'supplied-lyrics-spelling-grammar-and-chinese-meaning','timingReviewStatus':'approximate','pronunciationReviewStatus':'reference-with-liaison-corrections-not-listening-verified','meaningSource':'reviewed-user-supplied-chinese','pronunciationEngine':'eSpeak NG phrase and isolated-word reference with liaison corrections','note':'歌词依据你提供的完整文件校对，中文释义已修订。学习卡片按现有现场录像整理，完整歌词另行归档；≈ 表示依据原字幕估算的分句位置。音标与空耳为文字的参考读法。','sources':[{'label':'用户提供的歌词资料对应网页','url':'https://fufu-life.github.io/musicals/moliere-le-spectacle-musical/index.html'},{'label':'本曲现场录像','url':song['sourceURL']}],'entries':entries}
  catalog_by_id[route].update(captionStatus='ready',captionLanguage='fr',captionSource='editorial',textReviewStatus='cross-checked',timingReviewStatus='approximate',cueCount=len(cues),studyCueCount=len(cues))
  stats.append({'id':route,'trackNumber':track['trackNumber'],'originalTrackNumber':song['originalTrackNumber'],'suppliedLines':len(full['lines']),'lines':len(entries),'versionDifferenceLines':track['omittedLines'],'textCorrections':sum(l['sourceText']!=l['suppliedText'].replace('′',"'").replace('’',"'") for l in full['lines']),'meaningCorrections':sum(l['meaning']!=l['sourceMeaning'] for l in full['lines'])})
  outputs.extend([(ROOT/'data/songs'/f'{route}.json',song),(ROOT/'data/study'/f'{route}.json',notes)])
 count=sum(len(t['lines']) for t in report['tracks'])
 if count!=625 or len(by_line)!=654:raise ValueError('Unexpected reviewed edition count')
 summary={'sourceFile':'moliere-supplied-lyrics.json','sourceFileSHA256':digest,'pageCount':16,'fourLayerPages':16,'fourLayerBlocks':count,'suppliedLyricLines':654,'versionDifferenceLines':654-count,'selectionSource':'https://fufu-life.github.io/musicals/moliere-le-spectacle-musical/index.html','retainedArchiveTracks':45,'removedFromCatalog':29,'textCorrections':sum(t['textCorrections'] for t in stats),'meaningCorrections':sum(t['meaningCorrections'] for t in stats),'reviewScope':'supplied-lyrics-spelling-grammar-and-chinese-meaning','timingMethod':'original-stage-transcript-word-alignment-approximate','tracks':stats}
 outputs.extend([(ROOT/'data/catalog.json',catalog),(ROOT/'data/moliere-study-import.json',summary),(ROOT/'data/moliere-supplied-lyrics.json',{'sourceFileSHA256':digest,'songs':report['suppliedSongs']}),(ROOT/'data/moliere-reviewed-lyrics.json',{'sourceFileSHA256':digest,'lineCount':654,'timingReviewStatus':'untimed-complete-supplied-edition','pronunciationReviewStatus':'reference-not-listening-verified','songs':edition}),(ROOT/'data/moliere-lyric-anchors.json',anchors)])
 for path,value in outputs:write_json(path,value)
 print('Imported',len(stats),'songs;',count,'timed lines; 654 complete reviewed lines;',summary['textCorrections'],'text corrections;',summary['meaningCorrections'],'meaning corrections')

def main():
 p=argparse.ArgumentParser();p.add_argument('--input',required=True,type=Path);p.add_argument('--meanings',required=True,type=Path);p.add_argument('--prepared',required=True,type=Path);p.add_argument('--anchors',type=Path);p.add_argument('--reference',type=Path);p.add_argument('--apply',action='store_true');p.add_argument('--reuse-prepared',action='store_true');args=p.parse_args()
 songs,digest=supplied(args.input);manifest=load(ROOT/'data/moliere-song-selection.json');meanings=load(args.meanings)
 anchors=load(args.anchors) if args.anchors and args.anchors.exists() else {t['id']:{'song':load(ROOT/'data/songs'/f'{t["id"]}.json'),'notes':load(ROOT/'data/study'/f'{t["id"]}.json')} for t in manifest['tracks']}
 if args.anchors and not args.anchors.exists():write_json(args.anchors,anchors)
 if args.reuse_prepared:
  report=load(args.prepared)
  if report['sourceSHA256']!=digest or report['suppliedSongs']!=songs:raise ValueError('Prepared input differs from supplied file')
 else:
  tracks=prepare(songs,manifest,meanings,anchors);report={'sourceFile':args.input.name,'sourceSHA256':digest,'suppliedSongs':songs,'tracks':tracks};write_json(args.prepared,report)
 if args.apply:
  if not args.reference:raise ValueError('--reference is required for import')
  apply(report,reviewed(songs,meanings,reference_for(songs,args.reference)),anchors)
 else:print('Prepared',len(report['tracks']),'songs',sum(len(t['lines']) for t in report['tracks']),'lines')
if __name__=='__main__':main()
