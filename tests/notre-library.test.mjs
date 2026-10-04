import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tracksFor, statusLabel } from '../assets/library.mjs';
const root = new URL('../', import.meta.url);
const json = path => JSON.parse(fs.readFileSync(new URL(path, root), 'utf8'));
test('Notre-Dame has fifty main tracks and an encore, all with four study layers and Chinese introductions', () => {
  const musical = json('data/musicals.json').find(m => m.id === 'notre-dame-de-paris');
  assert.ok(musical); assert.equal(musical.year, 1998);
  const tracks = tracksFor(musical, json('data/catalog.json'));
  assert.equal(tracks.length, 51);
  assert.equal(tracks.filter(t => t.act === 1).length, 27);
  assert.equal(tracks.filter(t => t.act === 2 && !t.isEncore).length, 23);
  assert.equal(tracks[0].titleOriginal, 'Le temps des cathédrales');
  assert.equal(tracks.at(-2).titleOriginal, 'Danse mon Esmeralda');
  assert.equal(tracks.at(-1).isEncore, true);
  let count = 0;
  for (const track of tracks) {
    const song = json(`data/songs/${track.id}.json`), info = json(`data/info/${track.id}.json`);
    assert.equal(song.lyricsStorage, 'user-provided'); assert.ok(song.cues.length > 0);
    assert.equal(song.captionSource, 'editorial'); assert.equal(song.timingReviewStatus, 'approximate');
    const notes = json(`data/study/${track.id}.json`);
    assert.equal(notes.entries.length, song.cues.length); count += song.cues.length;
    for (const [i, cue] of song.cues.entries()) {
      const entry = notes.entries[i];
      assert.equal(entry.start, cue.start); assert.equal(entry.sourceText, cue.text);
      assert.match(entry.ipa, /^\[.+\]$/u); assert.match(entry.ear, /\p{Script=Han}/u); assert.match(entry.meaning, /\p{Script=Han}/u);
      assert.doesNotMatch(entry.ear, /[A-Za-zɪθɒɑɛɔœəʁ]/u);
      assert.doesNotMatch(entry.ipa, /\((?:en|fr)\)|ɒ|ð/u);
      assert.ok(cue.start >= song.playbackSegment.start && cue.duration > 0);
      assert.ok(cue.start + cue.duration <= song.playbackSegment.end + .001);
      assert.ok(!i || cue.start >= song.cues[i-1].start + song.cues[i-1].duration - .001);
    }
    assert.equal(song.playableInEmbed, true); assert.ok(song.duration > 0);
    assert.match(statusLabel(track), /逐句学习/);
    assert.equal(info.releaseYear, 1998); assert.ok(info.artistOriginal && info.roleZh);
    assert.deepEqual(info.sections.map(s => s.heading), ['这首歌讲什么', '剧情里的这一幕', '演唱者与角色']);
    assert.ok(info.sections.every(s => s.paragraphs.length > 0));
  }
  assert.equal(count, 1677);
  const opening = json(`data/study/${tracks[0].id}.json`).entries;
  assert.equal(opening.find(e => e.sourceText === 'Nous les artistes anonymes').ipa, '[nu lez‿aʁtist‿anonim]');
  assert.doesNotMatch(opening.find(e => e.sourceText === 'Les poètes et les troubadours').ipa, /pɔɛtz/);
});
test('the restricted clip keeps its route and alternate source alongside native-caption playback', () => {
  const song = json('data/songs/z8eZR8QvCw0.json');
  assert.equal(song.playbackVideoId, '3AnTqOIgPr0'); assert.equal(song.alternateVideoId, 'SxYNkMYEJN8'); assert.equal(song.mediaKind, 'stage-video');
  assert.ok(json('data/info/z8eZR8QvCw0.json').sources.some(s => s.url.endsWith('v=SxYNkMYEJN8')));
});
