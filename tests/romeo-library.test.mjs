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
 let count=0,end=0,studyCount=0,readyCount=0;
 for(const track of tracks){
  assert.equal(resolveTrackId(track.id,catalog),track.id);
  const song=json(`data/songs/${track.id}.json`),info=json(`data/info/${track.id}.json`);
  assert.equal(song.playbackVideoId,'kgGN5675TAY');assert.equal(song.captionLanguage,'fr-FR');
  assert.ok(song.playbackSegment.start>=end);end=song.playbackSegment.end;
  assert.equal(song.duration,end-song.playbackSegment.start);assert.equal(playbackStart(song),song.playbackSegment.start);
  assert.equal(info.performanceYear,2010);assert.equal(info.releaseYear,2009);
  assert.deepEqual(info.sections.map(s=>s.heading),['这首歌讲什么','剧情里的这一幕','演唱者与角色']);
  assert.ok(info.sections.every(s=>s.paragraphs.every(p=>/\p{Script=Han}/u.test(p))));
  const cues=nativeCues(song);count+=cues.length;
  if(track.captionStatus==='instrumental'){assert.equal(track.titleOriginal,'Le bal');assert.equal(cues.length,0);assert.match(statusLabel(track),/器乐/);assert.deepEqual(song.cues,[]);}
  else{
   readyCount++;assert.equal(song.lyricsStorage,'user-provided');assert.equal(song.captionSource,'editorial');assert.match(statusLabel(track),/逐句学习/);
   assert.ok(song.cues.length>0);assert.equal(song.timingReviewStatus,'approximate');
   const notes=json(`data/study/${track.id}.json`);assert.equal(notes.entries.length,song.cues.length);
   assert.equal(notes.textSource,'user-supplied-timed-transcript');assert.match(notes.sourceFileSHA256,/^[a-f0-9]{64}$/);
   for(const [i,cue] of song.cues.entries()){
    const note=notes.entries[i];assert.equal(note.sourceText,cue.text);assert.equal(note.start,cue.start);
    assert.ok(cue.start>=song.playbackSegment.start&&cue.duration>0&&cue.start+cue.duration<=end+.001);
    if(i)assert.ok(cue.start>=song.cues[i-1].start+song.cues[i-1].duration-.001);
    assert.match(note.meaning,/\p{Script=Han}/u);assert.match(note.ear,/\p{Script=Han}/u);assert.ok(note.ipa.length>2);
    assert.doesNotMatch(cue.text,/secondes|minutes et|Sous titres|Benvolio\/|^(?:Capulet|Romeo|Montaigu)\s*:/);
   }
   studyCount+=song.cues.length;
  }
  assert.ok(cues.every((c,i)=>c.start>=song.playbackSegment.start&&c.start+c.duration<=end+.001&&(!i||c.start>=cues[i-1].start+cues[i-1].duration-.001)));
 }
 assert.equal(count,799);
 assert.equal(readyCount,39);assert.equal(studyCount,1903);
 const opening=json('data/songs/romeo-2010-01.json');assert.equal(opening.playbackSegment.end,177);assert.ok(opening.cues.some(c=>c.start>=137));
 const duet=json('data/info/romeo-2010-07.json');assert.match(duet.artistOriginal,/Damien Sargue/);assert.match(duet.artistOriginal,/Joy Esther/);assert.doesNotMatch(duet.artistOriginal,/Cécilia Cara/);
});
