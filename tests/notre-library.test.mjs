import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tracksFor, statusLabel } from '../assets/library.mjs';
const root = new URL('../', import.meta.url);
const json = path => JSON.parse(fs.readFileSync(new URL(path, root), 'utf8'));
test('Notre-Dame has fifty original-cast tracks in two acts with separate Chinese introductions', () => {
  const musical = json('data/musicals.json').find(m => m.id === 'notre-dame-de-paris');
  assert.ok(musical); assert.equal(musical.year, 1998);
  const tracks = tracksFor(musical, json('data/catalog.json'));
  assert.equal(tracks.length, 50);
  assert.equal(tracks.filter(t => t.act === 1).length, 27);
  assert.equal(tracks.filter(t => t.act === 2).length, 23);
  assert.equal(tracks[0].titleOriginal, 'Le temps des cathédrales');
  assert.equal(tracks.at(-1).titleOriginal, 'Danse mon Esmeralda');
  for (const track of tracks) {
    const song = json(`data/songs/${track.id}.json`), info = json(`data/info/${track.id}.json`);
    assert.equal(song.lyricsStorage, 'external'); assert.deepEqual(song.cues, []);
    assert.equal(song.playableInEmbed, true); assert.ok(song.duration > 0);
    assert.match(statusLabel(track), /法语字幕/);
    assert.equal(info.releaseYear, 1998); assert.ok(info.artistOriginal && info.roleZh);
    assert.deepEqual(info.sections.map(s => s.heading), ['这首歌讲什么', '剧情里的这一幕', '演唱者与角色']);
    assert.ok(info.sections.every(s => s.paragraphs.length > 0));
  }
});
test('the restricted clip keeps its route and alternate source alongside native-caption playback', () => {
  const song = json('data/songs/z8eZR8QvCw0.json');
  assert.equal(song.playbackVideoId, '3AnTqOIgPr0'); assert.equal(song.alternateVideoId, 'SxYNkMYEJN8'); assert.equal(song.mediaKind, 'stage-video');
  assert.ok(json('data/info/z8eZR8QvCw0.json').sources.some(s => s.url.endsWith('v=SxYNkMYEJN8')));
});
