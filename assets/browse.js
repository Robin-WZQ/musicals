import { musicalURL, learningURL, tracksFor, statusLabel } from './library.mjs?v=20261005-4';
import { fetchData } from './data.mjs?v=20261005-4';
const $ = id => document.getElementById(id);
const node = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text) el.textContent = text; return el; };
async function json(url) { const response = await fetchData(url); if (!response.ok) throw new Error('曲目库暂时无法读取，请刷新重试。'); return response.json(); }
function image(src, alt) { const img = node('img'); img.src = src; img.alt = alt; return img; }
const old = new URL(location.href);
if (document.body.dataset.view === 'gallery' && old.searchParams.has('v')) {
  location.replace(`./learn.html${old.search}${old.hash}`);
} else {
  try {
    const [musicals, catalog] = await Promise.all([json('./data/musicals.json'), json('./data/catalog.json')]);
    if (document.body.dataset.view === 'gallery') {
      $('collection-count').textContent = `${musicals.length} 部音乐剧 · ${musicals.reduce((n, m) => n + m.trackIds.length, 0)} 首歌曲`;
      for (const [i, musical] of musicals.entries()) {
        const card = node('a', 'musical-card'); card.href = musicalURL(musical.id);
        const art = node('div', 'card-art'); art.append(image(musical.cover, `${musical.titleZh}专辑封面`), node('span', 'art-number', String(i + 1).padStart(2, '0')));
        const body = node('div', 'card-body');
        body.append(node('p', 'tiny-meta', `${musical.languageShort}　${musical.year}　${musical.country}`), node('h2', '', musical.titleZh), node('p', 'card-original', musical.titleOriginal), node('p', 'card-description', musical.summary));
        const foot = node('div', 'card-foot'); foot.append(node('span', '', `${musical.trackIds.length} 首歌曲`), node('span', '', '进入曲目 →')); body.append(foot); card.append(art, body); $('musical-grid').append(card);
      }
    } else {
      const id = old.searchParams.get('id') || musicals[0]?.id;
      const musical = musicals.find(m => m.id === id); if (!musical) throw new Error('未找到这部音乐剧。返回音乐剧总页，选择已有作品。');
      document.title = `${musical.titleZh} · Musicals`;
      $('album-cover').src = musical.cover; $('album-cover').alt = `${musical.titleZh}专辑封面`;
      $('album-title').textContent = musical.titleZh; $('album-original').textContent = musical.titleOriginal;
      $('album-meta').textContent = `${musical.languageShort}　${musical.year}　${musical.country}　${musical.genreZh || '摇滚音乐剧'}`;
      $('album-summary').textContent = musical.summary; $('album-background').textContent = musical.background;
      $('playlist-source').href = musical.playlistURL; $('art-source').href = musical.coverSource;
      if (musical.playlistLabel) $('playlist-source').textContent = `${musical.playlistLabel} ↗`;
      if (musical.fullPerformanceURL) { $('full-performance').href = musical.fullPerformanceURL; $('full-performance').hidden = false; }
      const tracks = tracksFor(musical, catalog);
      const ready = tracks.filter(t => t.captionStatus === 'ready').length;
      const native = tracks.filter(t => t.captionStatus === 'native').length;
      $('track-count').textContent = `${tracks.length} 首曲目 · ${native ? `${native} 首法语字幕` : `${ready} 首可逐句学习`}`;
      if (tracks.some(t => t.studyKind === 'four-layer' && t.textReviewStatus === 'source-auto-transcript-with-conservative-edits')) {
        const instrumental = tracks.filter(t => t.captionStatus === 'instrumental').length;
        const pending = tracks.filter(t => t.captionStatus === 'pending').length;
        $('track-count').textContent = [`${tracks.length} 首曲目`, `${ready} 首四层学习`, instrumental ? `${instrumental} 段器乐` : '', pending ? `${pending} 首字幕待补` : ''].filter(Boolean).join(' · ');
      }
      if (native) $('ready-filter-label').textContent = '仅看有字幕的曲目';
      let saved = []; try { saved = JSON.parse(localStorage.getItem('musicals-saved') || '[]'); } catch {}
      let last = ''; try { last = localStorage.getItem(`musicals-last-${musical.id}`) || ''; } catch {}
      if (tracks.some(t => t.id === last)) { $('continue-study').href = learningURL(last); $('continue-study').hidden = false; }
      function render() {
        const query = $('track-search').value.trim().toLocaleLowerCase(); const readyOnly = $('ready-only').checked;
          const shown = tracks.filter(t => (!readyOnly || t.captionStatus === 'ready' || t.captionStatus === 'native') && `${t.titleZh} ${t.titleOriginal} ${t.title} ${(t.aliases || []).join(' ')}`.toLocaleLowerCase().includes(query));
        const elements = []; let act = null;
        for (const track of shown) {
          if (track.act && track.act !== act) {
            act = track.act; elements.push(node('h3', 'act-heading', act === 1 ? '第一幕' : '第二幕'));
          }
          const link = node('a', 'track-row'); link.href = learningURL(track.id);
          link.append(node('span', 'track-number', String(track.trackNumber).padStart(2, '0')));
          const name = node('div', 'track-name'); name.append(node('h3', '', track.titleZh), node('span', '', track.titleOriginal || '播放列表原曲')); link.append(name);
          const state = node('span', `track-state ${track.captionStatus === 'ready' || track.captionStatus === 'native' ? 'ready' : 'pending'}`, statusLabel(track));
          const duration = node('span', 'track-duration', `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}`);
          link.append(state, duration, node('span', 'track-arrow', saved.includes(track.id) ? '★ →' : '→')); elements.push(link);
        }
        $('track-list').replaceChildren(...elements);
        $('search-empty').hidden = Boolean(shown.length);
      }
      $('track-search').addEventListener('input', render); $('ready-only').addEventListener('change', render); render();
      if (musical.legacyVideoId) { $('legacy-song').href = learningURL(musical.legacyVideoId); $('legacy-song').hidden = false; }
    }
    $('loading').hidden = true;
  } catch (error) { $('loading').textContent = error.message; $('loading').classList.add('load-error'); }
}
