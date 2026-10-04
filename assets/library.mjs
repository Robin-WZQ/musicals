import { dataRevision } from './data.mjs?v=20261004-5';

export function musicalURL(id) { return `./musical.html?id=${encodeURIComponent(id)}&rev=${dataRevision}`; }
export function learningURL(id) { return `./learn.html?v=${encodeURIComponent(id)}&rev=${dataRevision}`; }
export function tracksFor(musical, catalog) {
  const songs = new Map(catalog.map(song => [song.id, song]));
  return (musical.trackIds || []).map(id => songs.get(id)).filter(Boolean);
}
export function statusLabel(song) {
  return song.captionStatus === 'ready' ? '逐句学习' : '原唱试听 · 法语字幕待补';
}
