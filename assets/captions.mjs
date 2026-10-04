export function videoId(value) {
  const raw = String(value || '').trim();
  if (/^[\w-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be') return /^[\w-]{11}$/.test(url.pathname.slice(1)) ? url.pathname.slice(1) : null;
    if (!['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)) return null;
    const id = url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})(?:\/|$)/)?.[1];
    return /^[\w-]{11}$/.test(id || '') ? id : null;
  } catch { return null; }
}

export function clock(seconds) {
  const n = Math.max(0, Math.floor(Number(seconds) || 0));
  return n >= 3600 ? `${Math.floor(n / 3600)}:${String(Math.floor(n % 3600 / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}` : `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

function clean(text) {
  return String(text || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}

export function normalizeCues(cues) {
  const rows = cues.map(c => ({ start: Number(c.start), duration: Number(c.duration), text: clean(c.text), translation: clean(c.translation || ''),
    ...(c.ipa && c.ear && (c.studyMeaning || c.meaning) ? {ipa:clean(c.ipa),ear:clean(c.ear),studyMeaning:clean(c.studyMeaning || c.meaning)} : {}) }))
    .filter(c => Number.isFinite(c.start) && c.start >= 0 && Number.isFinite(c.duration) && c.duration > 0 && c.text)
    .sort((a, b) => a.start - b.start);
  const unique = [];
  for (const cue of rows) {
    const last = unique.at(-1);
    if (last && Math.abs(last.start - cue.start) < 0.01) {
      if (!last.text.includes(cue.text)) last.text += ' ' + cue.text;
      last.duration = Math.max(last.duration, cue.duration);
    } else unique.push(cue);
  }
  return unique.map((cue, i) => ({ ...cue, end: Math.min(cue.start + cue.duration, unique[i + 1]?.start ?? Infinity) })).filter(c => c.end > c.start);
}

export function cueAt(cues, time) {
  let lo = 0, hi = cues.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start <= time) lo = mid + 1; else hi = mid - 1;
  }
  return hi >= 0 && time < cues[hi].end ? hi : -1;
}

export function parseCaptions(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const data = JSON.parse(trimmed);
    if (Array.isArray(data.events)) return normalizeCues(data.events.filter(e => e.segs).map(e => ({ start: e.tStartMs / 1000, duration: e.dDurationMs / 1000, text: e.segs.map(s => s.utf8 || '').join('') })));
    const cues = Array.isArray(data) ? data : data.cues;
    if (!Array.isArray(cues)) throw new Error('文件没有字幕条目');
    return normalizeCues(cues);
  }
  const toSeconds = stamp => {
    const parts = stamp.replace(',', '.').split(':').map(Number);
    return parts.reduce((total, value) => total * 60 + value, 0);
  };
  const cues = [];
  const lines = trimmed.replace(/\r/g, '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/((?:\d{1,}:)?\d{2}:\d{2}[.,]\d{3})\s*-->\s*((?:\d{1,}:)?\d{2}:\d{2}[.,]\d{3})/);
    if (!match) continue;
    const start = toSeconds(match[1]), end = toSeconds(match[2]);
    const body = [];
    while (++i < lines.length && lines[i].trim()) body.push(lines[i]);
    cues.push({ start, duration: end - start, text: body.join(' ') });
  }
  return normalizeCues(cues);
}
