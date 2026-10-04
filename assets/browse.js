import { musicalURL, learningURL, tracksFor, statusLabel } from './library.mjs';
const $ = id => document.getElementById(id);
const node = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text) el.textContent = text; return el; };
async function json(url) { const response = await fetch(url); if (!response.ok) throw new Error('曲目库暂时无法读取，请刷新重试。'); return response.json(); }
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
      $('album-meta').textContent = `${musical.languageShort}　${musical.year}　${musical.country}　摇滚音乐剧`;
      $('album-summary').textContent = musical.summary; $('album-background').textContent = musical.background;
      $('playlist-source').href = musical.playlistURL; $('art-source').href = musical.coverSource;
      const tracks = tracksFor(musical, catalog);
      const ready = tracks.filter(t => t.captionStatus === 'ready').length;
      $('track-count').textContent = `${tracks.length} 首曲目 · ${ready} 首可逐句学习`;
      const corrected = tracks.filter(t => t.textReviewStatus === 'cross-checked').length;
      $('caption-disclosure').textContent = `按原播放列表顺序收录 ${tracks.length} 个视频。${corrected ? `${corrected} 个已交叉校正法语文字并重写中文释义；新分句的播放位置仍为近似值。` : ''}${tracks.length - ready ? `${tracks.length - ready} 个暂缺法语字幕。` : ''}${musical.id === 'le-rouge-et-le-noir' ? '原列表末项曲名有误，现已更正为《爱情的诅咒 · 宣传 MV》，保留旧名“总有一天”供搜索。' : ''}`;
      let saved = []; try { saved = JSON.parse(localStorage.getItem('musicals-saved') || '[]'); } catch {}
      let last = ''; try { last = localStorage.getItem(`musicals-last-${musical.id}`) || ''; } catch {}
      if (tracks.some(t => t.id === last)) { $('continue-study').href = learningURL(last); $('continue-study').hidden = false; }
      function render() {
        const query = $('track-search').value.trim().toLocaleLowerCase(); const readyOnly = $('ready-only').checked;
          const shown = tracks.filter(t => (!readyOnly || t.captionStatus === 'ready') && `${t.titleZh} ${t.titleOriginal} ${t.title} ${(t.aliases || []).join(' ')}`.toLocaleLowerCase().includes(query));
        $('track-list').replaceChildren(...shown.map(track => {
          const link = node('a', 'track-row'); link.href = learningURL(track.id);
          link.append(node('span', 'track-number', String(track.trackNumber).padStart(2, '0')));
          const name = node('div', 'track-name'); name.append(node('h3', '', track.titleZh), node('span', '', track.titleOriginal || '播放列表原曲')); link.append(name);
          const state = node('span', `track-state ${track.captionStatus === 'ready' ? 'ready' : 'pending'}`, statusLabel(track));
          const duration = node('span', 'track-duration', `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}`);
          link.append(state, duration, node('span', 'track-arrow', saved.includes(track.id) ? '★ →' : '→')); return link;
        }));
        $('search-empty').hidden = Boolean(shown.length);
      }
      $('track-search').addEventListener('input', render); $('ready-only').addEventListener('change', render); render();
      if (musical.legacyVideoId) { $('legacy-song').href = learningURL(musical.legacyVideoId); $('legacy-song').hidden = false; }
    }
    $('loading').hidden = true;
  } catch (error) { $('loading').textContent = error.message; $('loading').classList.add('load-error'); }
}
