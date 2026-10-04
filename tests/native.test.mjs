import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {playbackStart,nativeCues,importedCues} from '../assets/native.mjs';
const song={playbackSegment:{start:100,end:160}};
test('deep links clamp to the song and support legacy relative times',()=>{
  assert.equal(playbackStart(song),100);
  assert.equal(playbackStart(song,15),115);
  assert.equal(playbackStart(song,125,'source'),125);
  assert.equal(playbackStart(song,15,'source'),100);
  assert.equal(playbackStart(song,170,'source'),100);
});
test('imports align relative captions and clip full-recording captions to the song',()=>{
  assert.deepEqual(importedCues(song,[{text:'User text',start:2,end:5}]),[{text:'User text',start:102,end:105,duration:3}]);
  assert.deepEqual(importedCues(song,[{text:'Before',start:90,end:102},{text:'After',start:155,end:165},{text:'Outside',start:170,end:180}]).map(c=>[c.start,c.end]),[[100,102],[155,160]]);
});
test('all fifty songs have ordered time-only ranges within their own recording segment',()=>{
 const root=new URL('../',import.meta.url);
 const catalog=JSON.parse(fs.readFileSync(new URL('data/catalog.json',root),'utf8')).filter(t=>t.musicalId==='notre-dame-de-paris');
 let end=0,count=0;
 for(const track of catalog){
  const data=JSON.parse(fs.readFileSync(new URL(`data/songs/${track.id}.json`,root),'utf8'));
  assert.equal(data.playbackVideoId,'3AnTqOIgPr0');assert.equal(data.captionLanguage,'fr');
  assert.ok(data.playbackSegment.start>=end);end=data.playbackSegment.end;
  assert.equal(data.duration,end-data.playbackSegment.start);
  const cues=nativeCues(data);assert.ok(cues.length>0);
  assert.equal(cues.length,track.nativeCueCount);count+=cues.length;
  assert.ok(data.nativeCaptionRanges.every(row=>Object.keys(row).sort().join(',')==='duration,start'));
  assert.ok(cues.every((c,i)=>c.start>=data.playbackSegment.start&&c.start+c.duration<=end&&(!i||c.start>=cues[i-1].start+cues[i-1].duration)));
 }
 assert.equal(count,761);
});
