import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {nativeCues} from '../assets/native.mjs';
import {statusLabel} from '../assets/library.mjs';
const root=new URL('../',import.meta.url);
const read=path=>JSON.parse(fs.readFileSync(new URL(path,root),'utf8'));

test('Molière keeps the supplied playlist order and time segments for each actual video',()=>{
 const musical=read('data/musicals.json').find(m=>m.id==='moliere');
 const tracks=read('data/catalog.json').filter(t=>t.musicalId==='moliere');
 assert.equal(tracks.length,45);assert.deepEqual(tracks.map(t=>t.id),musical.trackIds);
 assert.equal(tracks[0].id,'DfNkuu0ENTI');assert.equal(tracks.at(-1).id,'QS_MJxvB93Q');
 assert.equal(musical.year,2023);assert.equal(musical.albumReleaseYear,2025);
 let count=0;
 for(const [i,track] of tracks.entries()){
  const song=read(`data/songs/${track.id}.json`),info=read(`data/info/${track.id}.json`);
  assert.equal(song.playbackVideoId,track.id);assert.equal(song.trackNumber,i+1);
  assert.equal(song.act,i<21?1:2);assert.equal(song.duration,song.playbackSegment.end);
  assert.equal(song.captionSource,'youtube-player');assert.equal(song.captionLanguage,'fr');
  assert.equal(song.captionStatus,'native');assert.equal(song.isGenerated,true);
  assert.equal(song.textReviewStatus,'unreviewed-native-auto');assert.equal(song.lyricsStorage,'external');
  assert.deepEqual(song.cues,[]);assert.match(statusLabel(track),/法语字幕（自动）/);
  assert.equal(song.performanceYear,undefined);assert.match(song.uploadDate,/^2025\d{4}$/);
  const ranges=nativeCues(song);assert.equal(ranges.length,track.nativeCueCount);count+=ranges.length;
  assert.ok(ranges.length>0);assert.ok(ranges.every((r,j)=>r.start>=0&&r.duration>0&&r.start+r.duration<=song.duration&&(!j||r.start>=ranges[j-1].start+ranges[j-1].duration)));
  assert.ok(song.nativeCaptionRanges.every(r=>Object.keys(r).sort().join(',')==='duration,start'));
  assert.equal(info.sections.length,3);assert.ok(info.sections.every(s=>s.paragraphs.every(p=>/\p{Script=Han}/u.test(p))));
  assert.ok(info.sources.some(s=>s.url===song.sourceURL));
 }
 assert.equal(count,835);
});
