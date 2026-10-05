import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {nativeCues} from '../assets/native.mjs';
import {tracksFor,resolveTrackId,statusLabel} from '../assets/library.mjs';
const root=new URL('../',import.meta.url);
const read=path=>JSON.parse(fs.readFileSync(new URL(path,root),'utf8'));

test('Mozart indexes this recording in chapter order with manual French timings and version-specific cast',()=>{
 const musical=read('data/musicals.json').find(row=>row.id==='mozart-opera-rock-2010');
 const tracks=tracksFor(musical,read('data/catalog.json'));
 const source=read('data/mozart-source.json');
 assert.equal(tracks.length,22);assert.equal(source.sourceTimingCount,1779);
 let end=0,total=0;
 for(const [i,track] of tracks.entries()){
  const song=read(`data/songs/${track.id}.json`),info=read(`data/info/${track.id}.json`);
  assert.equal(track.id,`mozart-2010-${String(i+1).padStart(2,'0')}`);
  assert.equal(resolveTrackId(track.id,tracks),track.id);
  assert.equal(song.playbackVideoId,'83Qn2IvP_-I');
  assert.equal(song.playbackSegment.start,end);end=song.playbackSegment.end;
  assert.equal(end,source.chapters[i].end_time);assert.equal(track.duration,end-song.playbackSegment.start);
  assert.equal(song.captionSource,'youtube-player');assert.equal(song.isGenerated,false);
  assert.equal(song.nativeTimingPrecision,'milliseconds');assert.equal(song.phoneticReviewStatus,'not-generated');
  assert.equal(song.performanceYear,2010);assert.equal(song.productionYear,2009);assert.equal(song.uploadDate,'20161004');
  const cues=nativeCues(song);assert.equal(cues.length,track.nativeCueCount);assert.ok(cues.length>0);
  assert.ok(cues.every((c,j)=>c.start>=song.playbackSegment.start&&c.start+c.duration<=end+1e-8&&(!j||c.start>=cues[j-1].start+cues[j-1].duration-1e-8)));
  assert.equal(info.sections.length,3);assert.equal(info.performanceYear,2010);
  assert.match(statusLabel(track),/法语字幕/);assert.doesNotMatch(statusLabel(track),/逐句学习|自动/);
  total+=cues.length;
 }
 assert.equal(end,7252);assert.equal(total,source.indexedTimingCount);
 assert.equal(total,1793);
 assert.equal(tracks.filter(t=>t.isEncore).length,2);
 const constance=read('data/info/mozart-2010-06.json');
 assert.equal(constance.artistOriginal,'Claire Pérot');assert.doesNotMatch(constance.artistOriginal,/Diane/);
});
