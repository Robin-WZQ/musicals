import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tracksFor,resolveTrackId,statusLabel} from '../assets/library.mjs';
import {normalizeCues} from '../assets/captions.mjs';
import {attachStudyNotes} from '../assets/study.mjs';
const root=new URL('../',import.meta.url);
const read=path=>JSON.parse(fs.readFileSync(new URL(path,root),'utf8'));

test('Don Juan imports both acts with correct recording, language and four-layer alignment',()=>{
 const musical=read('data/musicals.json').find(m=>m.id==='don-juan');
 const tracks=tracksFor(musical,read('data/catalog.json'));
 const source=read('data/donjuan-source.json'),report=read('data/donjuan-study-import.json');
 assert.equal(tracks.length,41);assert.equal(source.duration,7794);assert.equal(source.sourceTimingCount,1622);
 assert.equal(source.performanceYear,null);assert.equal(source.uploadDate,'20121106');
 assert.ok(fs.statSync(new URL(musical.cover,root)).size>10000);
 let end=0,total=0,liaisons=0,spanish=0;
 for(const [i,track] of tracks.entries()){
  const song=read(`data/songs/${track.id}.json`),info=read(`data/info/${track.id}.json`),notes=read(`data/study/${track.id}.json`);
  assert.equal(track.id,`donjuan-${String(i+1).padStart(2,'0')}`);assert.equal(track.act,i<22?1:2);
  assert.equal(resolveTrackId(track.id,tracks),track.id);assert.equal(song.playbackVideoId,'ZmzpG11NJwc');
  assert.equal(song.playbackSegment.start,end);end=song.playbackSegment.end;
  assert.deepEqual(song.playbackSegment,report.tracks[i].segment);
  assert.equal(song.productionYear,2004);assert.equal(song.performanceYear,undefined);
  assert.equal(song.captionStatus,'ready');assert.equal(song.studyKind,'four-layer');assert.equal(song.lyricsStorage,'user-provided');
  assert.equal(song.timingReviewStatus,'approximate');assert.equal(song.isGenerated,false);
  assert.match(statusLabel(track),/逐句学习/);
  assert.equal(notes.sourceFileSHA256,report.sourceFileSHA256);assert.match(notes.sourceFileSHA256,/^[a-f0-9]{64}$/);
  assert.equal(notes.entries.length,song.cues.length);assert.equal(notes.textSource,'user-supplied-timed-transcript');
  const attached=attachStudyNotes(normalizeCues(song.cues),notes);
  assert.equal(attached.length,song.cues.length);
  for(const [j,cue] of song.cues.entries()){
   const note=notes.entries[j];assert.equal(note.sourceText,cue.text);assert.equal(note.start,cue.start);
   assert.ok(cue.start>=song.playbackSegment.start&&cue.duration>0&&cue.start+cue.duration<=end+.001);
   if(j)assert.ok(cue.start>=song.cues[j-1].start+song.cues[j-1].duration-.001);
   assert.ok(cue.start>=note.timing.anchorStart&&cue.start+cue.duration<=note.timing.anchorEnd+.001);
   assert.match(note.meaning,/\p{Script=Han}/u);assert.match(note.ear,/\p{Script=Han}/u);
   assert.doesNotMatch(note.meaning,/第\d+服|新服|双线/);assert.doesNotMatch(note.ear,/[A-Za-z]/);
   assert.doesNotMatch(note.ipa,/\((?:en|fr)\)|undefined|spanishrefrain/);
   assert.doesNotMatch(cue.text,/^\d+\s+secondes|Sous-titres|https?:|@|spanishrefrain|choisiee|veulentnt/);
   assert.ok(note.suppliedText);assert.ok(note.timing.sourceLineNumber>0);
   assert.equal(attached[j].studyMeaning,note.meaning);
   if(note.ipa.includes('‿'))liaisons++;
   if(note.language==='es')spanish++;
  }
  assert.deepEqual(info.sections.map(s=>s.heading),['这首歌讲什么','剧情里的这一幕','演唱者与角色']);
  if([13,38].includes(i+1)){assert.equal(song.captionLanguage,'es');assert.ok(notes.entries.every(n=>n.language==='es'));}
  total+=song.cues.length;
 }
 assert.equal(end,7423);assert.equal(total,1582);assert.equal(report.lineCount,total);
 assert.equal(report.tracks.reduce((n,t)=>n+t.anchors,0),710);assert.ok(liaisons>100);assert.ok(spanish>60);
 assert.ok(report.excluded.every(row=>row.start>=7423));
 assert.equal(read('data/info/donjuan-04.json').artistOriginal,'Geneviève Charest');
 assert.equal(read('data/info/donjuan-10.json').artistOriginal,'Claude Lancelot');
 const mixed=read('data/study/donjuan-16.json').entries;
 assert.equal(mixed.find(n=>n.sourceText==='Solo por amor').language,'es');
 assert.equal(mixed.find(n=>n.sourceText==='Solo por amor').meaning,'只为爱情。');
});
