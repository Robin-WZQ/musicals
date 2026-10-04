import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { musicalURL, learningURL, tracksFor, statusLabel, resolveTrackId } from '../assets/library.mjs';
import { normalizeCues } from '../assets/captions.mjs';
import { attachStudyNotes } from '../assets/study.mjs';
const root = new URL('../', import.meta.url);
const json = path => JSON.parse(fs.readFileSync(new URL(path, root), 'utf8'));
const musicals = json('data/musicals.json'), catalog = json('data/catalog.json');
test('all musical entries preserve ordered independent tracks and playable static links', () => {
  assert.equal(new Set(musicals.map(m => m.id)).size, musicals.length);
  assert.equal(new Set(catalog.map(s => s.id)).size, catalog.length);
  for (const musical of musicals) {
    const tracks = tracksFor(musical, catalog);
    assert.equal(tracks.length, musical.trackIds.length);
    assert.deepEqual(tracks.map(t => t.id), musical.trackIds);
    assert.ok(fs.existsSync(new URL(musical.cover, root)));
    assert.ok(musicalURL(musical.id).startsWith('./musical.html?id='));
    for (const [i, track] of tracks.entries()) {
      assert.equal(track.musicalId, musical.id);
      assert.equal(track.trackNumber, i + 1);
      assert.ok(learningURL(track.id).startsWith('./learn.html?v='));
      const song = json(`data/songs/${track.id}.json`), info = json(`data/info/${track.id}.json`);
      assert.equal(song.id, track.id); assert.equal(info.videoId, track.id);
      assert.ok(info.sections.every(s => s.paragraphs.every(p => /\p{Script=Han}/u.test(p))));
      if (track.captionStatus === 'ready') {
        const notes = json(`data/study/${track.id}.json`);
        const cues = normalizeCues(song.cues), annotated = attachStudyNotes(cues, notes);
        assert.ok(cues.length > 0); assert.equal(notes.entries.length, cues.length);
        assert.ok(annotated.every(cue => cue.ipa && cue.ear && cue.studyMeaning));
        assert.deepEqual(annotated.map(c => [c.start, c.end, c.text]), cues.map(c => [c.start, c.end, c.text]));
      } else { assert.equal(song.cues.length, 0); assert.match(statusLabel(track), /字幕待补|可导入字幕|法语字幕|器乐/); }
    }
  }
});
test('a second musical keeps its own order and does not inherit another musical tracks', () => {
  const future = {id:'another-musical',trackIds:['BBBBBBBBBBB','AAAAAAAAAAA']};
  const songs = [{id:'AAAAAAAAAAA'},{id:'CCCCCCCCCCC'},{id:'BBBBBBBBBBB'}];
  assert.deepEqual(tracksFor(future,songs).map(s=>s.id),future.trackIds);
});
test('chapter routes resolve through the catalog while unknown input uses strict YouTube validation', () => {
  const chapters = [{id:'romeo-2010-02'}, {id:'../not-a-route'}];
  assert.equal(resolveTrackId('romeo-2010-02', chapters), 'romeo-2010-02');
  assert.equal(resolveTrackId('https://youtu.be/kgGN5675TAY', chapters), 'kgGN5675TAY');
  assert.equal(resolveTrackId('romeo-2010-99', chapters), null);
  assert.equal(resolveTrackId('../not-a-route', chapters), null);
  assert.equal(resolveTrackId('https://youtube.com.attacker.test/watch?v=kgGN5675TAY', chapters), null);
});
test('the original reviewed song remains independently addressable', () => {
  const old = catalog.find(s => s.id === '7BZhhlQFcbg');
  assert.ok(old?.isLegacy);
  assert.equal(json(`data/info/${old.id}.json`).titleZh,'荣耀向我俯首');
});

test('all playlist lyrics are corrected independently of the original ASR', () => {
  for (const track of catalog.filter(t => t.musicalId === 'le-rouge-et-le-noir')) {
    const song = json(`data/songs/${track.id}.json`), notes = json(`data/study/${track.id}.json`);
    assert.equal(song.captionSource, 'editorial');
    assert.equal(notes.meaningSource, 'editorial-chinese-paraphrase');
    assert.equal(song.timingReviewStatus, 'approximate');
    assert.ok(Array.isArray(song.sourceCues));
    for (const entry of notes.entries) {
      assert.doesNotMatch(entry.sourceText, /^\s*(?:\[.*\]|\d+|[a-z])\s*$/iu, track.id);
      assert.doesNotMatch(entry.ipa, /\((?:en|fr)\)/u, track.id);
      assert.doesNotMatch(entry.ear, /[A-Za-zɪθɒɑɛɔœəʁ]/u, track.id);
      assert.match(entry.meaning, /\p{Script=Han}/u);
      assert.ok(entry.start >= 0 && entry.start < song.duration);
    }
  }
  const opening = json('data/songs/yHnVC5moNdU.json').cues.map(c => c.text).join(' ');
  assert.match(opening, /votre camp/u); assert.match(opening, /votre foi/u);
  assert.doesNotMatch(opening, /carladous|votre foie|france est citée/u);
  const last = catalog.find(s => s.id === '1VeyW1d7kFM');
  assert.equal(last.titleOriginal, 'Les maudits mots d’amour');
  assert.ok(last.aliases.includes('总有一天'));
});

test('replacement videos have their own timing and explicit source records', () => {
  const replacements = {oz0hz4my3GY:'RPKjD6ZNHus',dkdy7OC4CBw:'0P-MGvSaJiw',EccLCTsTWMw:'ERRvQGsQSmw',Ry779aHGWes:'3vEwXTBP6VM'};
  for (const [id, actual] of Object.entries(replacements)) {
    const song = json(`data/songs/${id}.json`), notes = json(`data/study/${id}.json`);
    assert.equal(song.playbackVideoId, actual); assert.equal(notes.playbackVideoId, actual);
    assert.ok(notes.sources.some(s => s.url === `https://www.youtube.com/watch?v=${actual}`));
    assert.ok(song.playbackSourceCues.length > 0);
    const cues = normalizeCues(song.cues);
    assert.ok(cues.every(c => c.end <= song.duration && c.end > c.start));
    assert.ok(cues.every((c,i) => !i || c.start >= cues[i-1].end));
  }
});
