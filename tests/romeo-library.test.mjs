import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tracksFor,resolveTrackId,statusLabel} from '../assets/library.mjs';
import {nativeCues,playbackStart} from '../assets/native.mjs';
const root=new URL('../',import.meta.url);
const json=path=>JSON.parse(fs.readFileSync(new URL(path,root),'utf8'));
test('2010 Romeo follows the supplied recording with forty separate routes and version-specific cast',()=>{
 const catalog=json('data/catalog.json'), musical=json('data/musicals.json').find(m=>m.id==='romeo-et-juliette-2010');
 assert.equal(musical.year,2010);assert.ok(fs.existsSync(new URL(musical.cover,root)));
 const tracks=tracksFor(musical,catalog);assert.equal(tracks.length,40);assert.equal(tracks.filter(t=>t.act===1).length,19);
 assert.equal(tracks[0].titleOriginal,'Ouverture');assert.equal(tracks.at(-1).titleOriginal,'Avoir 20 ans');assert.equal(tracks.at(-1).isEncore,true);
 let count=0,end=0;
 for(const track of tracks){
  assert.equal(resolveTrackId(track.id,catalog),track.id);
  const song=json(`data/songs/${track.id}.json`),info=json(`data/info/${track.id}.json`);
  assert.equal(song.playbackVideoId,'kgGN5675TAY');assert.equal(song.captionLanguage,'fr-FR');
  assert.equal(song.lyricsStorage,'external');assert.deepEqual(song.cues,[]);
  assert.ok(song.playbackSegment.start>=end);end=song.playbackSegment.end;
  assert.equal(song.duration,end-song.playbackSegment.start);assert.equal(playbackStart(song),song.playbackSegment.start);
  assert.equal(info.performanceYear,2010);assert.equal(info.releaseYear,2009);
  assert.deepEqual(info.sections.map(s=>s.heading),['这首歌讲什么','剧情里的这一幕','演唱者与角色']);
  assert.ok(info.sections.every(s=>s.paragraphs.every(p=>/\p{Script=Han}/u.test(p))));
  const cues=nativeCues(song);count+=cues.length;
  if(track.captionStatus==='instrumental'){assert.equal(track.titleOriginal,'Le bal');assert.equal(cues.length,0);assert.match(statusLabel(track),/器乐/);}
  else{assert.ok(cues.length>0);assert.match(statusLabel(track),/法语字幕/);}
  assert.ok(cues.every((c,i)=>c.start>=song.playbackSegment.start&&c.start+c.duration<=end+.001&&(!i||c.start>=cues[i-1].start+cues[i-1].duration-.001)));
 }
 assert.equal(count,799);
 const duet=json('data/info/romeo-2010-07.json');assert.match(duet.artistOriginal,/Damien Sargue/);assert.match(duet.artistOriginal,/Joy Esther/);assert.doesNotMatch(duet.artistOriginal,/Cécilia Cara/);
});
