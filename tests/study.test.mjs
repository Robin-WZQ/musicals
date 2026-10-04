import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeCues } from '../assets/captions.mjs';
import { attachStudyNotes } from '../assets/study.mjs';
const song = JSON.parse(readFileSync(new URL('../data/songs/7BZhhlQFcbg.json', import.meta.url), 'utf8'));
const notes = JSON.parse(readFileSync(new URL('../data/study/7BZhhlQFcbg.json', import.meta.url), 'utf8'));
test('the original MV keeps its raw captions and presents complete corrected lines', () => {
  const original = normalizeCues(song.cues), annotated = attachStudyNotes(original, notes);
  assert.equal(song.sourceCues.length, 36);
  assert.equal(annotated.length, 39);
  assert.equal(annotated[0].start, 9.019);
  assert.match(annotated[0].displayText, /Reste à ta place/u);
  assert.equal(notes.timingReviewStatus, 'approximate');
  assert.ok(annotated.every(c => c.ipa && c.ear && c.studyMeaning && c.displayText));
  assert.deepEqual(annotated.map(c => [c.start, c.end, c.text]), original.map(c => [c.start, c.end, c.text]));
});
test('changed text or time cannot receive an unrelated study annotation', () => {
  assert.equal(attachStudyNotes([{start:9.019,text:'A different caption'}], notes)[0].ipa, undefined);
  assert.equal(attachStudyNotes([{start:20,text:song.cues[0].text}], notes)[0].ipa, undefined);
});
test('mandatory les-acquis and mes-ailes connections are marked; haut has no false z liaison', () => {
  const acquired = notes.entries.find(n => n.sourceText.includes('Les acquis'));
  const wings = notes.entries.find(n => n.sourceText.includes('mes ailes'));
  const high = notes.entries.find(n => n.sourceText.includes('viser plus haut'));
  assert.match(acquired.ipa, /le.z‿aki/u);
  assert.match(wings.ipa, /me.z‿ɛl/u);
  assert.match(high.ipa, /ply o$/u);
  assert.doesNotMatch(high.ipa, /ply.z/u);
});
