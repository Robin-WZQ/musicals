import {parseCaptions} from './captions.mjs?v=20261005-7';

export function playbackStart(song, requested = 0, timebase = '') {
  const value = Math.max(0, Number(requested) || 0);
  const range = song.playbackSegment;
  if (!range) return value;
  if (value >= range.start && value < range.end) return value;
  if (timebase !== 'source' && value > 0 && value < range.end - range.start) return range.start + value;
  return range.start;
}

export function nativeCues(song) {
  const window = song.playbackSegment;
  if (!window) return [];
  return (song.nativeCaptionRanges || []).map(row => ({start: Number(row.start), duration: Number(row.duration)}))
    .filter(row => Number.isFinite(row.start) && Number.isFinite(row.duration) && row.duration > 0 && row.start >= window.start && row.start < window.end)
    .sort((a, b) => a.start - b.start)
    .map((row, index) => ({...row, duration: Math.min(row.duration, window.end - row.start), text: `第 ${String(index + 1).padStart(2, '0')} 段`}));
}

export function importedCues(song, cues, timebase = '') {
  const range = song.playbackSegment;
  if (!range) return cues;
  const relative = timebase === 'relative' || timebase !== 'source' && cues.every(cue => cue.end <= range.end - range.start);
  const offset = relative ? range.start : 0;
  return cues.map(cue => ({...cue, start: cue.start + offset, end: cue.end + offset}))
    .filter(cue => cue.start < range.end && cue.end > range.start)
    .map(cue => ({...cue, start: Math.max(range.start, cue.start), end: Math.min(range.end, cue.end)}))
    .map(cue => ({...cue, duration: cue.end - cue.start}));
}

export function importStudyCaptions(song, text) {
  const trimmed=text.trim();
  const data=trimmed.startsWith('{') || trimmed.startsWith('[') ? JSON.parse(trimmed) : null;
  if(data?.playbackVideoId && data.playbackVideoId !== (song.playbackVideoId || song.id)) throw new Error('字幕对应的录像与本曲播放来源不同');
  if(data?.id && data.id !== song.id) throw new Error('这是另一首歌的学习字幕包');
  return importedCues(song,parseCaptions(text),data?.timebase || '');
}

export function studyStorageKey(song) {
  return `musicals-captions-${song.id}`;
}

export function studyPack(song, cues) {
  return {version:1, id:song.id, playbackVideoId:song.playbackVideoId || song.id,
    timebase:'source', playbackSegment:song.playbackSegment || null,
    cues:cues.map(cue => ({start:cue.start, duration:cue.end-cue.start, text:cue.text,
      ...(cue.translation ? {translation:cue.translation} : {}),
      ...(cue.ipa && cue.ear && cue.studyMeaning ? {ipa:cue.ipa, ear:cue.ear, studyMeaning:cue.studyMeaning} : {})}))};
}

export function savedStudyCaptions(song, storage) {
  try {
    const text = storage.getItem(studyStorageKey(song));
    if (!text) return null;
    const pack = JSON.parse(text);
    // A replacement recording or changed song boundary needs its own timing.
    if (pack.version !== 1 || pack.timebase !== 'source' || pack.id !== song.id
      || pack.playbackVideoId !== (song.playbackVideoId || song.id)
      || (pack.playbackSegment?.start ?? null) !== (song.playbackSegment?.start ?? null)
      || (pack.playbackSegment?.end ?? null) !== (song.playbackSegment?.end ?? null)) return null;
    const cues = importStudyCaptions(song, text);
    return cues.length ? cues : null;
  } catch { return null; }
}
