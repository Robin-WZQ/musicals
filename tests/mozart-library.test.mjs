import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tracksFor,resolveTrackId,statusLabel} from '../assets/library.mjs';
import {normalizeCues} from '../assets/captions.mjs';
import {attachStudyNotes} from '../assets/study.mjs';
const root=new URL('../',import.meta.url);
const read=path=>JSON.parse(fs.readFileSync(new URL(path,root),'utf8'));

test('Mozart preserves recording metadata and imports all timed chapters into four study layers',()=>{
 const musical=read('data/musicals.json').find(row=>row.id==='mozart-opera-rock-2010');
 const tracks=tracksFor(musical,read('data/catalog.json'));
 const source=read('data/mozart-source.json'),report=read('data/mozart-study-import.json');
 assert.equal(tracks.length,22);assert.equal(source.sourceTimingCount,1779);
 let end=0,total=0,liaisons=0;
 for(const [i,track] of tracks.entries()){
  const song=read(`data/songs/${track.id}.json`),info=read(`data/info/${track.id}.json`),notes=read(`data/study/${track.id}.json`);
  assert.equal(track.id,`mozart-2010-${String(i+1).padStart(2,'0')}`);
  assert.equal(resolveTrackId(track.id,tracks),track.id);assert.equal(song.playbackVideoId,'83Qn2IvP_-I');
  assert.equal(song.playbackSegment.start,end);end=song.playbackSegment.end;
  assert.equal(song.originalPlaybackSegment.end,source.chapters[i].end_time);
  assert.deepEqual(song.playbackSegment,report.tracks[i].segment);assert.equal(track.duration,end-song.playbackSegment.start);
  assert.equal(track.captionStatus,'ready');assert.equal(track.studyKind,'four-layer');
  assert.equal(song.captionSource,'editorial');assert.equal(song.lyricsStorage,'user-provided');
  assert.equal(song.isGenerated,false);assert.equal(song.timingReviewStatus,'approximate');
  assert.equal(song.performanceYear,2010);assert.equal(song.productionYear,2009);assert.equal(song.uploadDate,'20161004');
  assert.equal(notes.sourceFileSHA256,report.sourceFileSHA256);assert.match(notes.sourceFileSHA256,/^[a-f0-9]{64}$/);
  assert.equal(notes.textSource,'user-supplied-timed-transcript');assert.equal(notes.entries.length,song.cues.length);
  const attached=attachStudyNotes(normalizeCues(song.cues),notes);assert.equal(attached.length,song.cues.length);
  for(const [j,cue] of song.cues.entries()){
   const note=notes.entries[j];assert.equal(note.sourceText,cue.text);assert.equal(note.start,cue.start);
   assert.ok(cue.start>=song.playbackSegment.start&&cue.duration>0&&cue.start+cue.duration<=end+.001);
   if(j)assert.ok(cue.start>=song.cues[j-1].start+song.cues[j-1].duration-.001);
   assert.ok(cue.start>=note.timing.anchorStart&&cue.start+cue.duration<=note.timing.anchorEnd+.001);
   assert.match(note.meaning,/\p{Script=Han}/u);assert.match(note.ear,/\p{Script=Han}/u);
   assert.doesNotMatch(note.ipa,/\((?:en|fr)\)|foreignphrase|undefined/);
   assert.doesNotMatch(cue.text,/secondes|Sous-titres|^#|foreignphrase/);
   assert.equal(attached[j].studyMeaning,note.meaning);if(note.ipa.includes('‿'))liaisons++;
  }
  assert.deepEqual(info.sections.map(s=>s.heading),['这首歌讲什么','剧情里的这一幕','演唱者与角色']);
  assert.match(statusLabel(track),/逐句学习/);total+=song.cues.length;
 }
 assert.equal(end,7252);assert.equal(total,1911);assert.equal(report.lineCount,total);
 assert.equal(report.tracks.reduce((n,t)=>n+t.anchors,0),716);assert.ok(liaisons>200);
 assert.equal(tracks.reduce((n,t)=>n+t.nativeCueCount,0),1793);assert.equal(tracks.filter(t=>t.isEncore).length,2);
 assert.equal(read('data/info/mozart-2010-06.json').artistOriginal,'Claire Pérot');
 const notes=tracks.flatMap(t=>read(`data/study/${t.id}.json`).entries);
 assert.equal(notes.find(n=>n.sourceText==='Constance!').meaning,'康斯坦丝！');
 assert.equal(notes.find(n=>n.sourceText==='Trop de notes!').meaning,'音符太多了！');
 assert.equal(notes.find(n=>n.sourceText==='We love you!').ipa,'[wi lʌv ju]');
});
