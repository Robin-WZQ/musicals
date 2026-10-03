import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeCues } from '../assets/captions.mjs';
import { attachStudyNotes } from '../assets/study.mjs';
const song = JSON.parse(readFileSync(new URL('../data/songs/7BZhhlQFcbg.json', import.meta.url), 'utf8'));
const notes = JSON.parse(readFileSync(new URL('../data/study/7BZhhlQFcbg.json', import.meta.url), 'utf8'));
test('every current YouTube cue has IPA, Chinese phonetic hints and meaning without changing timing', () => {
  const original = normalizeCues(song.cues), annotated = attachStudyNotes(original, notes);
  assert.equal(annotated.length, 36);
  assert.ok(annotated.every(c => c.ipa && c.ear && c.studyMeaning && c.displayText));
  assert.deepEqual(annotated.map(c => [c.start, c.end, c.text]), original.map(c => [c.start, c.end, c.text]));
});
test('changed text or time cannot receive an unrelated study annotation', () => {
  assert.equal(attachStudyNotes([{start:9.019,text:'A different caption'}], notes)[0].ipa, undefined);
  assert.equal(attachStudyNotes([{start:20,text:song.cues[0].text}], notes)[0].ipa, undefined);
});
test('mandatory les-acquis and mes-ailes connections are marked; haut has no false z liaison', () => {
  assert.match(notes.entries[1].ipa, /le.z‿aki/u);
  assert.match(notes.entries[21].ipa, /me.z‿ɛl/u);
  assert.match(notes.entries[2].ipa, /ply o$/u);
  assert.doesNotMatch(notes.entries[2].ipa, /ply.z/u);
});
