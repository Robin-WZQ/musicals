import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {nativeCues} from '../assets/native.mjs';
import {statusLabel} from '../assets/library.mjs';
import {normalizeCues} from '../assets/captions.mjs';
import {attachStudyNotes} from '../assets/study.mjs';
const root=new URL('../',import.meta.url);
const read=path=>JSON.parse(fs.readFileSync(new URL(path,root),'utf8'));
const expected=['QS_MJxvB93Q','SmW9IpZlvMs','3nvql84Sbfc','ByZEaeRjtPM','5MoPwWau5kw','A5STesdpUqg','dqxl5YVktz0','pHhXM6TCwns','x-7l2SIxYI0','OEe6Jxooszc','LBMV4AF0PWk','SsTRsTN3teI','jPo5jZKp948','zcMTzJ-Y3Bg','1a4HnbB4HrM','DfNkuu0ENTI'];
test('Molière exposes only the sixteen requested songs in reference order',()=>{
 const musical=read('data/musicals.json').find(m=>m.id==='moliere');
 const tracks=read('data/catalog.json').filter(t=>t.musicalId==='moliere');
 const selection=read('data/moliere-song-selection.json');
 assert.deepEqual(tracks.map(t=>t.id),expected);assert.deepEqual(musical.trackIds,expected);
 assert.deepEqual(selection.trackIds,expected);assert.equal(selection.songCount,16);
 assert.equal(musical.year,2023);assert.equal(musical.albumReleaseYear,2025);
 let count=0;
 for(const [i,track] of tracks.entries()){
  const song=read(`data/songs/${track.id}.json`),info=read(`data/info/${track.id}.json`);
  assert.equal(song.playbackVideoId,track.id);assert.equal(song.trackNumber,i+1);assert.equal(track.trackNumber,i+1);
  assert.equal(song.originalTrackNumber,selection.tracks[i].originalTrackNumber);assert.equal(track.act,undefined);
  assert.equal(song.captionLanguage,'fr');assert.equal(song.captionSource,'editorial');assert.equal(song.captionStatus,'ready');
  assert.equal(song.textReviewStatus,'spelling-and-grammar-edits');assert.equal(song.lyricsStorage,'user-provided');
  assert.equal(statusLabel(track),'四层学习');
  const notes=read(`data/study/${track.id}.json`);assert.equal(notes.videoId,track.id);
  assert.equal(notes.sourceFileSHA256,song.studyInput.sha256);assert.equal(notes.entries.length,song.cues.length);
  assert.ok(song.cues.length>0);count+=song.cues.length;assert.doesNotMatch(notes.note,/识别不清|待核听/u);
  assert.ok(attachStudyNotes(normalizeCues(song.cues),notes).every(c=>c.ipa&&c.ear&&c.studyMeaning));
  for(const [j,cue] of song.cues.entries()){
   const e=notes.entries[j];assert.equal(e.sourceText,cue.text);assert.equal(e.start,cue.start);
   assert.equal(e.timing.precision,'approximate');assert.equal(e.reviewNote,'');
   assert.match(e.meaning,/\p{Script=Han}/u);assert.doesNotMatch(e.meaning,/识别不清|待核听/u);
   assert.match(e.ear,/\p{Script=Han}/u);assert.doesNotMatch(e.ear,/[A-Za-zɪθɒɑɛɔœəʁ]/u);
   assert.doesNotMatch(e.ipa,/\((en|fr)\)/u);
   assert.ok(cue.start>=0&&cue.duration>0&&cue.start+cue.duration<=song.duration);
   if(j)assert.ok(cue.start>=song.cues[j-1].start+song.cues[j-1].duration);
   assert.ok(song.suppliedCaptionBlocks.some(b=>b.sourceLine===e.timing.sourceLineNumber&&b.text===e.suppliedText));
  }
  assert.equal(info.sections.length,3);assert.ok(info.sources.some(s=>s.url===song.sourceURL));
 }
 const report=read('data/moliere-study-import.json');assert.equal(count,284);assert.equal(report.fourLayerBlocks,count);
 assert.equal(report.pageCount,16);assert.equal(report.fourLayerPages,16);assert.equal(report.removedFromCatalog,29);
});
test('Molière retains all forty-five original timestamp archives',()=>{
 const imported=read('data/moliere-timing-import.json');
 assert.equal(imported.tracks.length,45);assert.equal(imported.sourceAnchors,833);assert.equal(imported.segments,831);
 let count=0,originalCount=0;
 for(const track of imported.tracks){
  const song=read(`data/songs/${track.id}.json`),ranges=nativeCues(song);
  assert.equal(song.nativeTimingSource,'user-supplied-time-caption');assert.equal(ranges.length,track.segments);
  assert.equal(song.nativeTimingInput.file,'time-caption.txt');count+=ranges.length;originalCount+=song.originalNativeCaptionRanges.length;
  assert.ok(ranges.every((r,j)=>r.start>=0&&r.duration>0&&r.start+r.duration<=song.duration&&(!j||r.start>=ranges[j-1].start+ranges[j-1].duration)));
 }
 assert.equal(count,831);assert.equal(originalCount,835);
 assert.deepEqual(imported.tracks[19].duplicateSourceLines,[401]);assert.deepEqual(imported.tracks[42].endMarkerSourceLines,[860]);
});
