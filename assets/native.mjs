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

export function importedCues(song, cues) {
  const range = song.playbackSegment;
  if (!range) return cues;
  const relative = cues.every(cue => cue.end <= range.end - range.start);
  const offset = relative ? range.start : 0;
  return cues.map(cue => ({...cue, start: cue.start + offset, end: cue.end + offset}))
    .filter(cue => cue.start < range.end && cue.end > range.start)
    .map(cue => ({...cue, start: Math.max(range.start, cue.start), end: Math.min(range.end, cue.end)}))
    .map(cue => ({...cue, duration: cue.end - cue.start}));
}
