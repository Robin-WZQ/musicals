import { test } from 'node:test';
import assert from 'node:assert/strict';
import { videoId, normalizeCues, parseCaptions, cueAt, clock } from '../assets/captions.mjs';
test('YouTube URL validation rejects lookalike hosts and code schemes', () => {
  assert.equal(videoId('https://youtu.be/7BZhhlQFcbg?t=20'), '7BZhhlQFcbg');
  assert.equal(videoId('https://www.youtube.com/watch?v=7BZhhlQFcbg&list=abc'), '7BZhhlQFcbg');
  assert.equal(videoId('https://www.youtube.com/shorts/7BZhhlQFcbg'), '7BZhhlQFcbg');
  assert.equal(videoId('https://youtube.com.evil.test/watch?v=7BZhhlQFcbg'), null);
  assert.equal(videoId('javascript:alert(1)'), null);
});
test('overlapping cue ends are capped by the next start; silence has no active cue', () => {
  const cues = normalizeCues([{start:10,duration:5,text:'First'}, {start:12,duration:2,text:'Second'}, {start:20,duration:1,text:'Third'}]);
  assert.equal(cues[0].end, 12);
  assert.equal(cueAt(cues, 11.9), 0);
  assert.equal(cueAt(cues, 12), 1);
  assert.equal(cueAt(cues, 14), -1);
  assert.equal(cueAt(cues, 19), -1);
});
test('VTT and SRT timestamps preserve subsecond ranges and strip subtitle markup', () => {
  const vtt = 'WEBVTT\n\n00:01.250 --> 00:03.500 align:start\n<c>Hello &amp; goodbye</c>\n\n00:04.000 --> 00:05.500\nNext line\n';
  assert.deepEqual(parseCaptions(vtt).map(c=>[c.start,c.end,c.text]), [[1.25,3.5,'Hello & goodbye'],[4,5.5,'Next line']]);
  const srt = '1\n00:01:02,750 --> 00:01:05,000\nTwo\nlines\n';
  assert.equal(parseCaptions(srt)[0].start, 62.75);
  assert.equal(parseCaptions(srt)[0].text, 'Two lines');
});
test('YouTube JSON3 reads segment text and discards metadata-only events', () => {
  const parsed = parseCaptions(JSON.stringify({events:[{tStartMs:0,dDurationMs:0},{tStartMs:1250,dDurationMs:2400,segs:[{utf8:'one '},{utf8:'two'}]}]}));
  assert.equal(parsed.length, 1); assert.equal(parsed[0].start, 1.25); assert.equal(parsed[0].end, 3.65); assert.equal(parsed[0].text, 'one two');
});
test('invalid cues cannot create negative or infinite playback ranges', () => {
  assert.deepEqual(normalizeCues([{start:-1,duration:2,text:'bad'},{start:0,duration:Infinity,text:'bad'},{start:1,duration:0,text:'bad'}]), []);
  assert.equal(clock(3661), '1:01:01');
});
