import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {nativeCues} from '../assets/native.mjs';
import {statusLabel} from '../assets/library.mjs';
import {normalizeCues} from '../assets/captions.mjs';
import {attachStudyNotes} from '../assets/study.mjs';
const root=new URL('../',import.meta.url);
const read=path=>JSON.parse(fs.readFileSync(new URL(path,root),'utf8'));

test('Molière keeps the supplied playlist order and time segments for each actual video',()=>{
 const musical=read('data/musicals.json').find(m=>m.id==='moliere');
 const tracks=read('data/catalog.json').filter(t=>t.musicalId==='moliere');
 assert.equal(tracks.length,45);assert.deepEqual(tracks.map(t=>t.id),musical.trackIds);
 assert.equal(tracks[0].id,'DfNkuu0ENTI');assert.equal(tracks.at(-1).id,'QS_MJxvB93Q');
 assert.equal(musical.year,2023);assert.equal(musical.albumReleaseYear,2025);
 let count=0,originalCount=0;
 for(const [i,track] of tracks.entries()){
  const song=read(`data/songs/${track.id}.json`),info=read(`data/info/${track.id}.json`);
  assert.equal(song.playbackVideoId,track.id);assert.equal(song.trackNumber,i+1);
  assert.equal(song.act,i<21?1:2);assert.equal(song.duration,song.playbackSegment.end);
  assert.equal(song.captionLanguage,'fr');
  if(i===14){assert.equal(song.captionStatus,'instrumental');assert.deepEqual(song.cues,[]);assert.match(statusLabel(track),/器乐/);}
  else if(i===43){assert.equal(song.captionStatus,'pending');assert.deepEqual(song.cues,[]);assert.match(song.studyEmptyMessage,/英文残句/);assert.match(statusLabel(track),/字幕待补/);}
  else {
   assert.equal(song.captionSource,'editorial');assert.equal(song.captionStatus,'ready');assert.equal(song.isGenerated,false);
   assert.equal(song.textReviewStatus,'source-auto-transcript-with-conservative-edits');assert.equal(song.lyricsStorage,'user-provided');
   assert.match(statusLabel(track),/四层学习/);
   const notes=read(`data/study/${track.id}.json`);assert.equal(notes.videoId,track.id);assert.equal(notes.playbackVideoId,track.id);
   assert.equal(notes.textSource,'user-supplied-auto-transcript');assert.equal(notes.sourceFileSHA256,song.studyInput.sha256);
   assert.equal(notes.entries.length,song.cues.length);assert.ok(song.cues.length>0);
   const annotated=attachStudyNotes(normalizeCues(song.cues),notes);
   assert.ok(annotated.every(c=>c.ipa&&c.ear&&c.studyMeaning));
   for(const [j,cue] of song.cues.entries()){
    const entry=notes.entries[j];assert.equal(entry.sourceText,cue.text);assert.equal(entry.start,cue.start);
    assert.equal(entry.timing.precision,'approximate');assert.match(entry.sourceLineId,/^moliere-timed-\d+$/);
    assert.equal(typeof entry.suppliedText,'string');assert.match(entry.meaning,/\p{Script=Han}/u);
    assert.match(entry.ear,/\p{Script=Han}/u);assert.doesNotMatch(entry.ear,/[A-Za-zɪθɒɑɛɔœəʁ]/u);
    assert.doesNotMatch(entry.ipa,/\((en|fr)\)/u);
    assert.ok(cue.start>=0&&cue.duration>0&&cue.start+cue.duration<=song.duration);
    if(j)assert.ok(cue.start>=song.cues[j-1].start+song.cues[j-1].duration);
   }
  }
  assert.equal(song.performanceYear,undefined);assert.match(song.uploadDate,/^2025\d{4}$/);
  const ranges=nativeCues(song);assert.equal(ranges.length,track.nativeCueCount);count+=ranges.length;
  assert.equal(song.nativeTimingSource,'user-supplied-time-caption');
  assert.equal(song.nativeTimingInput.file,'time-caption.txt');
  assert.match(song.nativeTimingInput.sha256,/^[a-f0-9]{64}$/);
  originalCount+=song.originalNativeCaptionRanges.length;
  assert.ok(ranges.length>0);assert.ok(ranges.every((r,j)=>r.start>=0&&r.duration>0&&r.start+r.duration<=song.duration&&(!j||r.start>=ranges[j-1].start+ranges[j-1].duration)));
  assert.ok(song.nativeCaptionRanges.every(r=>Object.keys(r).sort().join(',')==='duration,start'));
  assert.equal(info.sections.length,3);assert.ok(info.sections.every(s=>s.paragraphs.every(p=>/\p{Script=Han}/u.test(p))));
  assert.ok(info.sources.some(s=>s.url===song.sourceURL));
 }
 assert.equal(count,831);assert.equal(originalCount,835);
 const imported=read('data/moliere-timing-import.json');
 assert.equal(imported.sourceAnchors,833);assert.equal(imported.segments,831);
 assert.deepEqual(imported.tracks[19].duplicateSourceLines,[401]);
 assert.deepEqual(imported.tracks[42].endMarkerSourceLines,[860]);
 const study=read('data/moliere-study-import.json');
 assert.equal(study.fourLayerPages,43);assert.equal(study.fourLayerBlocks,727);assert.equal(study.instrumentalPages,1);
 assert.equal(study.pendingPages.length,1);assert.equal(study.pendingPages[0].id,'3A3on1aaNMs');
 assert.equal(study.excludedBlocks.length,106);
 assert.equal(tracks.filter(t=>t.captionStatus==='ready').reduce((n,t)=>n+t.studyCueCount,0),727);
});
