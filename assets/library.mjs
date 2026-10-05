import { dataRevision } from './data.mjs?v=20261005-2';
import { videoId } from './captions.mjs?v=20261005-2';

// Chapter pages have their own stable IDs; the player still receives a real
// YouTube ID from playbackVideoId. Unknown input remains subject to URL checks.
export function resolveTrackId(value, catalog) {
  const id = String(value || '').trim();
  if (/^[\w-]{1,100}$/.test(id) && catalog.some(track => track.id === id)) return id;
  return videoId(value);
}

export function musicalURL(id) { return `./musical.html?id=${encodeURIComponent(id)}&rev=${dataRevision}`; }
export function learningURL(id) { return `./learn.html?v=${encodeURIComponent(id)}&rev=${dataRevision}`; }
export function tracksFor(musical, catalog) {
  const songs = new Map(catalog.map(song => [song.id, song]));
  return (musical.trackIds || []).map(id => songs.get(id)).filter(Boolean);
}
export function statusLabel(song) {
  if (song.captionStatus === 'instrumental') return '器乐 · 舞台舞蹈';
  if (song.captionStatus === 'native') return song.isGenerated ? '法语字幕（自动） · 分段重听' : '法语字幕 · 分段重听';
  if (song.captionStatus === 'external') return '原唱 · 可导入字幕';
  return song.captionStatus === 'ready' ? '逐句学习' : '原唱试听 · 法语字幕待补';
}
