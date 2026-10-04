import { videoId, clock, normalizeCues, cueAt, parseCaptions } from './captions.mjs?v=20261004-3';
import { attachStudyNotes } from './study.mjs?v=20261004-3';
import { musicalURL, learningURL, tracksFor } from './library.mjs?v=20261004-3';
import { fetchData } from './data.mjs?v=20261004-3';

const $ = id => document.getElementById(id);
let catalog = [], musicals = [], song, cues = [], player, playerReady = false, ytPromise, active = -1, selected = -1;
let boundary = null, following = true, sentenceMode = true, repeating = false, pendingSeek = null, heldAtEnd = null, toastTimer;
const initial = new URL(location.href), preferredId = videoId(initial.searchParams.get('v')) || '7BZhhlQFcbg';
const initialTime = Math.max(0, Number(initial.searchParams.get('t')) || 0);
let initialSeek = initialTime, loadGeneration = 0;
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 4200); }
function pressed(id, state) { $(id).classList.toggle('active', state); $(id).setAttribute('aria-pressed', String(state)); }
function savedSongs() { try { return JSON.parse(localStorage.getItem('musicals-saved') || '[]'); } catch { return []; } }
function updateBookmark() { pressed('bookmark', savedSongs().includes(song?.id)); }
function languageName(code) { try { return new Intl.DisplayNames(['zh-CN'], { type: 'language' }).of(code); } catch { return code || '语言未知'; } }
function displayTitle(title) { return title.split(' - ').at(-1).replace(/\s*\[(?:Clip Officiel|Official[^\]]*|Lyrics[^\]]*)\]\s*$/i, '').trim(); }

async function youtubeAPI() {
  if (window.YT?.Player) return window.YT;
  if (!ytPromise) ytPromise = new Promise((resolve, reject) => {
    let settled = false;
    window.onYouTubeIframeAPIReady = () => { settled = true; resolve(window.YT); };
    const script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => { if (!settled) { ytPromise = null; reject(new Error('无法连接 YouTube')); } };
    document.head.append(script);
    setTimeout(() => { if (!settled) { ytPromise = null; reject(new Error('连接 YouTube 超时')); } }, 18000);
  });
  return ytPromise;
}
async function ensurePlayer() {
  if (player) return;
  $('load-player').disabled = true;
  try {
    const YT = await youtubeAPI();
    if (player) return;
    player = new YT.Player('youtube-player', {
      width: '100%', height: '100%', videoId: song.playbackVideoId || song.id,
      playerVars: { playsinline: 1, rel: 0, origin: location.origin, start: Math.floor(initialSeek), cc_load_policy: 0 },
      events: {
        onReady: () => { playerReady = true; $('player-placeholder').hidden = true; setSpeeds(); if (initialSeek > 0) { player.seekTo(initialSeek, true); initialSeek = 0; } },
        onStateChange: event => {
          const playing = event.data === 1;
          $('play').textContent = playing ? 'Ⅱ' : '▶';
          $('play').setAttribute('aria-label', playing ? '暂停' : '播放');
          if (event.data === 0 && repeating && selected >= 0) playCue(selected);
        },
        onError: event => { boundary = null; const errors = { 2: '视频地址无效', 5: '播放器无法播放此视频', 100: '视频已被删除或设为私密', 101: '视频作者关闭了嵌入播放', 150: '视频作者关闭了嵌入播放', 153: '播放器未能验证本站来源，请在 YouTube 中播放' }; toast(errors[event.data] || 'YouTube 暂时无法播放这个视频'); }
      }
    });
  } catch { toast('暂时无法连接 YouTube。请检查网络，或点击左侧“打开”前往 YouTube。'); }
  finally { $('load-player').disabled = false; }
}
function setSpeeds() {
  const speeds = player.getAvailablePlaybackRates?.() || [1];
  const previous = Number($('speed').value);
  $('speed').replaceChildren(...speeds.map(value => { const option = new Option(`${value}×`, value); return option; }));
  $('speed').value = speeds.includes(previous) ? previous : 1;
  player.setPlaybackRate(Number($('speed').value));
}
function updateSelection(index, scroll = false) {
  for (const node of $('lyrics').querySelectorAll('.active')) { node.classList.remove('active'); node.removeAttribute('aria-current'); }
  active = index;
  const line = $('lyrics').querySelector(`[data-index="${index}"]`);
  if (line) {
    line.classList.add('active'); line.setAttribute('aria-current', 'true');
    if (scroll && following) {
      const pane = $('lyrics');
      pane.scrollTo({ top: line.offsetTop - pane.offsetTop - pane.clientHeight / 2 + line.clientHeight / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
    $('current-line').textContent = `${index + 1} / ${cues.length} 句`;
  } else $('current-line').textContent = cues.length ? `共 ${cues.length} 句` : '暂无字幕';
}
async function playCue(index) {
  if (!cues.length) return;
  if (!playerReady) { await ensurePlayer(); toast('播放器准备好后，再点击这一句开始。'); return; }
  selected = Math.max(0, Math.min(cues.length - 1, index));
  const cue = cues[selected]; boundary = sentenceMode || repeating ? cue.end : null;
  pendingSeek = { start: cue.start, end: cue.end, requestedAt: performance.now() };
  heldAtEnd = null;
  player.seekTo(cue.start, true); player.playVideo(); updateSelection(selected, true);
}
function tick() {
  if (!playerReady) return;
  const time = player.getCurrentTime(); $('time').textContent = clock(time);
  if (!cues.length) return;
  const playing = player.getPlayerState() === 1;
  if (pendingSeek) {
    if (time >= pendingSeek.start - 0.2 && time <= pendingSeek.start + Math.min(0.5, (pendingSeek.end - pendingSeek.start) / 2)) pendingSeek = null;
    else if (performance.now() - pendingSeek.requestedAt < 8000) return;
    else { pendingSeek = null; boundary = null; toast('跳句未成功，请再点击这一句。'); return; }
  }
  if (boundary !== null && playing && time >= boundary - 0.04) {
    if (repeating && selected >= 0) { playCue(selected); return; }
    player.pauseVideo(); heldAtEnd = { time, index: selected }; boundary = null; return;
  }
  if (!playing && heldAtEnd && Math.abs(time - heldAtEnd.time) < 0.35) return;
  heldAtEnd = null;
  const index = cueAt(cues, time);
  if (index !== active) updateSelection(index, playing);
}
setInterval(tick, 80);

function renderLyrics() {
  $('lyrics').replaceChildren(); active = selected = -1; boundary = pendingSeek = heldAtEnd = null;
  const annotated = cues.some(c => c.ipa && c.ear);
  const availableTranslation = cues.some(c => c.studyMeaning || c.translation);
  $('study-legend').hidden = $('study-note').hidden = !annotated;
  $('ipa-toggle').disabled = $('ear-toggle').disabled = !annotated;
  $('translation-label').textContent = annotated ? '释义' : '译文';
  $('translation').disabled = !availableTranslation;
  $('translation').checked = availableTranslation;
  $('lyrics').classList.toggle('hide-translations', !availableTranslation);
  $('repeat').disabled = $('sentence-mode').disabled = $('previous').disabled = $('next').disabled = !cues.length;
  if (!cues.length) {
    const status = song.captionStatus || 'pending';
    const title = status === 'unavailable' ? '这个视频暂无可用字幕' : status === 'error' ? '这次没能读取 YouTube 字幕' : '先听原唱，再开启逐句学习';
    const state = document.createElement('div'); state.className = 'empty-state';
    const icon = document.createElement('span'); icon.className = 'empty-icon'; icon.textContent = '♫';
    const heading = document.createElement('h3'); heading.textContent = title;
    const info = document.createElement('p'); info.textContent = '左侧可以播放完整歌曲。字幕就绪后，点击任何一句，即可跳到原唱的对应片段。';
    const actions = document.createElement('div'); actions.className = 'empty-actions';
    const choose = document.createElement('button'); choose.className = 'solid-button'; choose.textContent = '换一首歌'; choose.onclick = () => $('song-dialog').showModal();
    const upload = document.createElement('button'); upload.className = 'outline-button'; upload.textContent = '导入 YouTube 字幕'; upload.onclick = () => $('caption-file').click();
    actions.append(choose, upload); state.append(icon, heading, info, actions);
    if (song.captionError) { const details = document.createElement('p'); details.className = 'empty-details'; details.textContent = 'YouTube 字幕读取未成功；没有生成或替代字幕。'; state.append(details); }
    $('lyrics').append(state); $('current-line').textContent = '暂无字幕'; return;
  }
  const fragment = document.createDocumentFragment();
  cues.forEach((cue, index) => {
    const line = document.createElement('button'); line.className = 'lyric-line'; line.dataset.index = index;
      const approximate = song.timingReviewStatus === 'approximate';
      line.title = `${approximate ? '近似位置 ' : ''}${clock(cue.start)} — ${clock(cue.end)} · 点击听这一句`;
      const stamp = document.createElement('span'); stamp.className = 'timestamp'; stamp.textContent = `${approximate ? '≈ ' : ''}${clock(cue.start)}`; stamp.setAttribute('aria-hidden', 'true');
    const original = document.createElement('span'); original.className = 'original'; original.textContent = cue.displayText || cue.text;
    line.append(stamp, original);
      if (cue.kind === 'dialogue') { const tag = document.createElement('span'); tag.className = 'cue-note'; tag.textContent = '舞台对白'; line.append(tag); }
      if (cue.reviewNote) { const tag = document.createElement('span'); tag.className = 'cue-note'; tag.textContent = cue.reviewNote; line.append(tag); }
    if (cue.ipa && cue.ear) {
      line.classList.add('annotated');
      line.append(studyRow('音标', cue.ipa, 'study-ipa'), studyRow('空耳', cue.ear, 'study-ear'));
      if (cue.studyMeaning) line.append(studyRow('释义', cue.studyMeaning, 'study-meaning'));
    } else if (cue.translation) { const translated = document.createElement('span'); translated.className = 'translated'; translated.textContent = cue.translation; line.append(translated); }
    line.onclick = () => playCue(index); fragment.append(line);
  });
  $('lyrics').append(fragment); $('lyrics').scrollTop = 0; $('current-line').textContent = `共 ${cues.length} 句`;
}
function studyRow(label, text, className) {
  const row = document.createElement('span'); row.className = `study-row ${className}`;
  const tag = document.createElement('span'); tag.className = 'study-label'; tag.textContent = label;
  const content = document.createElement('span'); content.className = 'study-content';
  if (className === 'study-ipa') {
    for (const part of text.split(/(‿)/u)) {
      if (part === '‿') { const mark = document.createElement('span'); mark.className = 'link-mark'; mark.textContent = part; mark.title = '联诵 / 连读'; content.append(mark); }
      else content.append(document.createTextNode(part));
    }
  } else content.textContent = text;
  row.append(tag, content); return row;
}
function renderInfo() {
  document.title = `${song.title} · Musicals`;
  $('song-title').textContent = displayTitle(song.title);
  $('channel').textContent = song.channel || 'YouTube';
  $('channel').href = /^UC[\w-]+$/.test(song.channelId || '') ? `https://www.youtube.com/channel/${song.channelId}` : `https://www.youtube.com/watch?v=${song.playbackVideoId || song.id}`;
  $('youtube-link').href = `https://www.youtube.com/watch?v=${song.playbackVideoId || song.id}`;
  $('cover').src = `https://i.ytimg.com/vi/${song.playbackVideoId || song.id}/hqdefault.jpg`;
  $('song-description').textContent = song.description || (song.metadataSource ? `YouTube 视频：${song.title}\n\n未读到视频介绍。` : '这首歌的原唱由 YouTube 播放。视频介绍在歌曲信息读取完成后显示。');
  $('song-description').classList.remove('expanded'); $('description-toggle').textContent = '展开介绍 ↓'; $('description-toggle').hidden = (song.description || '').length < 220;
  $('language-label').textContent = song.captionLanguage ? languageName(song.captionLanguage) : '字幕语言待确认';
  $('caption-badge').textContent = song.captionSource === 'local' ? '本地导入字幕' : cues.length ? (song.isGenerated ? 'YouTube 自动字幕' : 'YouTube 字幕') : song.captionStatus === 'pending' ? '字幕待读取' : '字幕不可用';
  const translated = cues.some(c => c.translation);
  $('source-note').textContent = song.captionSource === 'local' ? '你导入的字幕仅用于当前页面，不会上传。请使用对应视频的 YouTube 字幕。' : `字幕与时间戳来自 YouTube${song.isGenerated ? ' 自动字幕' : ''}。${translated ? `译文来自 YouTube（${languageName(song.translationLanguage || 'en')}）。` : '当前没有可用译文。'}${song.fetchedAt ? ` 更新：${new Date(song.fetchedAt).toLocaleDateString('zh-CN')}` : ''}`;
  if (song.studyNotes && cues.some(c => c.ipa)) {
    const reviewed = song.studyNotes.textSource === 'youtube-video-description' || song.studyNotes.textReviewStatus === 'cross-checked';
    $('caption-badge').textContent = song.timingReviewStatus === 'approximate' ? '校正歌词 · 近似时间轴' : reviewed ? 'YouTube 时间轴 · 校正歌词' : 'YouTube 自动字幕 · 参考注释';
    $('source-note').textContent = song.studyNotes.note || '字幕和时间戳来自 YouTube。音标、空耳和中文释义为本站参考注释。';
    $('study-note').textContent = reviewed ? `${song.timingReviewStatus === 'approximate' ? '句子已重新整理，≈ 表示播放位置仍为近似值。' : ''}参考音标标出部分联诵与连读（‿）；并非原唱逐音转写。空耳仅辅助记忆，演唱发音以原唱为准。` : '新曲目学习注释自动生成，尚未逐句校对。音标是字幕文本的参考读法，‿ 表示可能的联诵或连读；空耳与中文机译均为近似参考，无法纠正字幕识别错误。';
  }
  renderNavigation();
  renderEditorialInfo(song.editorialInfo);
  updateBookmark(); renderLyrics();
}
function renderEditorialInfo(info) {
  const exists = Boolean(info?.sections?.length);
  $('song-info').classList.toggle('has-intro', exists);
  $('editorial-info').hidden = $('info-sources').hidden = !exists;
  $('artist').hidden = $('original-title').hidden = $('song-facts').hidden = $('album').hidden = $('role').hidden = !exists;
  $('channel').hidden = exists;
  document.querySelector('.song-info > .about').hidden = exists;
  $('editorial-info').replaceChildren(); $('info-source-links').replaceChildren(); $('song-facts').replaceChildren();
  if (!exists) return;
  $('song-title').textContent = info.titleZh || displayTitle(song.title);
  document.title = `${info.titleZh || displayTitle(song.title)} · Musicals`;
  $('original-title').textContent = `${info.titleOriginal} · ${info.titleNote || '法语原名'}`;
  $('artist').textContent = `${info.artistZh}（${info.artistOriginal}）`;
  const facts = [info.language, info.level ? `${info.level}（参考）` : '', info.genre, info.releaseYear ? `${info.releaseYear}年` : ''].filter(Boolean);
  $('song-facts').append(...facts.map(text => { const span = document.createElement('span'); span.textContent = text; if (text.startsWith(info.level)) span.title = info.levelNote || ''; return span; }));
  $('album').textContent = `所属专辑：《${info.albumZh}》`; $('album').title = info.albumOriginal;
  $('role').textContent = info.roleZh ? `演唱角色：${info.roleZh}` : ''; $('role').hidden = !info.roleZh;
  for (const item of info.sections) {
    const section = document.createElement('section'); section.className = 'intro-section'; section.id = item.id; section.dataset.kind = item.kind;
    const heading = document.createElement('h2'); heading.textContent = item.heading; section.append(heading);
    for (const text of item.paragraphs) { const paragraph = document.createElement('p'); paragraph.textContent = text; section.append(paragraph); }
    $('editorial-info').append(section);
  }
  for (const item of info.sources || []) {
    try { const url = new URL(item.url); if (url.protocol !== 'https:') continue;
      const anchor = document.createElement('a'); anchor.textContent = `${item.label} ↗`; anchor.href = url.href; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; $('info-source-links').append(anchor);
    } catch { /* Ignore malformed source links. */ }
  }
}
async function loadSong(id, updateURL = true) {
  const generation = ++loadGeneration;
  boundary = null; playerReady && player.pauseVideo();
  const fallback = catalog.find(s => s.id === id) || { id, title: 'YouTube · 新歌曲', channel: 'YouTube' };
  let data;
  try { const response = await fetchData(`./data/songs/${id}.json`); if (!response.ok) throw new Error('未录入'); data = await response.json(); if (data.id !== id) throw new Error('歌曲 ID 不一致'); }
  catch { data = { ...fallback, captionStatus: 'pending', cues: [] }; }
  if (data.cues?.length) {
    try { const response = await fetchData(`./data/study/${id}.json`); if (response.ok) { const notes = await response.json(); if (notes.videoId === id) data.studyNotes = notes; } } catch { /* Optional notes never block video playback. */ }
  }
  try { const response = await fetchData(`./data/info/${id}.json`); if (response.ok) { const info = await response.json(); if (info.videoId === id) data.editorialInfo = info; } } catch { /* A missing introduction never blocks the player. */ }
  if (generation !== loadGeneration) return;
  song = data; cues = attachStudyNotes(normalizeCues(data.cues || []), data.studyNotes);
  renderInfo();
  if (playerReady) { player.cueVideoById({ videoId: song.playbackVideoId || id, startSeconds: initialSeek }); setSpeeds(); initialSeek = 0; }
  if (updateURL) { const url = new URL(location.href); url.searchParams.set('v', id); url.searchParams.delete('t'); history.replaceState(null, '', url); }
  $('song-dialog').open && $('song-dialog').close();
  await ensurePlayer();
}
function renderLibrary() {
  $('song-list').replaceChildren(...catalog.map(entry => {
    const button = document.createElement('button'); button.className = 'song-card';
    const cover = document.createElement('img'); cover.src = `https://i.ytimg.com/vi/${entry.id}/mqdefault.jpg`; cover.alt = ''; cover.loading = 'lazy';
    const info = document.createElement('div'); const title = document.createElement('strong'); title.textContent = entry.titleZh || entry.title;
    const channel = document.createElement('span'); channel.textContent = entry.channel || 'YouTube'; info.append(title, channel); button.append(cover, info); button.onclick = () => { initialSeek = 0; loadSong(entry.id); }; return button;
  }));
}
function renderNavigation() {
  const entry = catalog.find(item => item.id === song.id);
  const musical = musicals.find(item => item.id === entry?.musicalId || item.legacyVideoId === song.id);
  $('back-musical').hidden = !musical;
  if (musical) { $('back-musical').href = musicalURL(musical.id); $('back-musical').textContent = musical.titleZh; }
  const tracks = musical ? tracksFor(musical, catalog) : [];
  const index = tracks.findIndex(item => item.id === song.id);
  for (const [name, offset] of [['previous-track', -1], ['next-track', 1]]) {
    const track = index >= 0 ? tracks[index + offset] : null; $(name).hidden = !track;
    if (track) { $(name).href = learningURL(track.id); $(name).textContent = `${offset < 0 ? '← ' : ''}${track.titleZh}${offset > 0 ? ' →' : ''}`; }
  }
  if (musical && index >= 0) { try { localStorage.setItem(`musicals-last-${musical.id}`, song.id); } catch {} }
}
async function share() {
  const url = new URL(location.href); url.searchParams.set('v', song.id);
  const time = playerReady ? Math.floor(player.getCurrentTime()) : 0;
  if (time) url.searchParams.set('t', time); else url.searchParams.delete('t');
  try { await navigator.clipboard.writeText(url.href); toast('链接已复制，包含当前播放位置。'); }
  catch { if (navigator.share) { try { await navigator.share({ title: song.title, url: url.href }); } catch {} } else toast('请复制浏览器地址栏中的链接。'); }
}
async function togglePlay() {
  if (!playerReady) { await ensurePlayer(); toast('播放器准备好后，点击播放。'); return; }
  if (player.getPlayerState() === 1) player.pauseVideo();
  else {
    if (heldAtEnd && selected >= 0 && (sentenceMode || repeating)) { playCue(selected); return; }
    if ((sentenceMode || repeating) && cues.length) {
      const current = cueAt(cues, player.getCurrentTime());
      if (current >= 0) { selected = current; boundary = cues[current].end; }
      else if (selected >= 0) { playCue(selected); return; }
    }
    player.playVideo();
  }
}
$('load-player').onclick = ensurePlayer;
$('open-song').onclick = event => { event.preventDefault(); $('song-dialog').showModal(); };
$('banner-close').onclick = () => $('banner-close').parentElement.hidden = true;
$('share').onclick = $('banner-share').onclick = share;
$('play').onclick = togglePlay;
$('speed').onchange = () => { if (playerReady) player.setPlaybackRate(Number($('speed').value)); else toast('播放器连接后可以调整速度。'); };
$('previous').onclick = () => playCue(Math.max(0, (active >= 0 ? active : selected >= 0 ? selected : 1) - 1));
$('next').onclick = () => playCue(Math.min(cues.length - 1, (active >= 0 ? active : selected) + 1));
$('repeat').onclick = () => { repeating = !repeating; pressed('repeat', repeating); if (repeating) playCue(active >= 0 ? active : selected >= 0 ? selected : 0); else boundary = sentenceMode && selected >= 0 ? cues[selected].end : null; };
$('sentence-mode').onclick = () => { sentenceMode = !sentenceMode; pressed('sentence-mode', sentenceMode); if (sentenceMode && active >= 0) selected = active; boundary = (sentenceMode || repeating) && selected >= 0 ? cues[selected].end : null; };
$('follow').onclick = () => { following = !following; pressed('follow', following); if (following && active >= 0) updateSelection(active, true); };
$('translation').onchange = () => $('lyrics').classList.toggle('hide-translations', !$('translation').checked);
$('ipa-toggle').onclick = () => { const hidden = $('lyrics').classList.toggle('hide-ipa'); pressed('ipa-toggle', !hidden); };
$('ear-toggle').onclick = () => { const hidden = $('lyrics').classList.toggle('hide-ear'); pressed('ear-toggle', !hidden); };
$('description-toggle').onclick = () => { const expanded = $('song-description').classList.toggle('expanded'); $('description-toggle').textContent = expanded ? '收起介绍 ↑' : '展开介绍 ↓'; };
$('info-toggle').onclick = () => { const expanded = document.querySelector('.sidebar').classList.toggle('info-expanded'); pressed('info-toggle', expanded || innerWidth > 720); };
for (const id of ['artist', 'album']) $(id).addEventListener('click', () => {
  if (innerWidth <= 720) { document.querySelector('.sidebar').classList.add('info-expanded'); pressed('info-toggle', true); }
});
$('help').onclick = () => $('help-dialog').showModal();
$('bookmark').onclick = () => { const saved = savedSongs(); const next = saved.includes(song.id) ? saved.filter(id => id !== song.id) : [...saved, song.id]; try { localStorage.setItem('musicals-saved', JSON.stringify(next)); updateBookmark(); toast(next.includes(song.id) ? '已收藏到这个浏览器。' : '已取消收藏。'); } catch { toast('这个浏览器暂时不能保存收藏。'); } };
$('import').onclick = () => $('caption-file').click();
$('caption-file').onchange = async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('字幕文件应小于 5 MB');
    const parsed = parseCaptions(await file.text()); if (!parsed.length) throw new Error('没有识别到有效字幕时间戳');
    playerReady && player.pauseVideo(); cues = parsed; song.captionSource = 'local'; song.cues = cues; renderInfo(); toast(`已导入 ${cues.length} 条字幕；请确认与当前视频一致。`);
  } catch (error) { toast(error.message || '字幕格式无法识别'); } finally { event.target.value = ''; }
};
$('video-form').onsubmit = event => { event.preventDefault(); const id = videoId($('video-url').value); if (!id) { toast('请输入有效的 YouTube 视频链接或 11 位 ID。'); return; } initialSeek = 0; loadSong(id); };
document.addEventListener('keydown', event => {
  if (event.target.matches('input,select,textarea,button,a') || document.querySelector('dialog[open]')) return;
  if (event.code === 'Space') { event.preventDefault(); togglePlay(); }
  else if (event.key === 'ArrowUp' && cues.length) { event.preventDefault(); $('previous').click(); }
  else if (event.key === 'ArrowDown' && cues.length) { event.preventDefault(); $('next').click(); }
  else if (event.key.toLowerCase() === 'r' && cues.length) $('repeat').click();
});
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
try { const response = await fetchData('./data/catalog.json'); if (!response.ok) throw new Error('歌单加载失败'); catalog = await response.json(); } catch { catalog = [{ id: preferredId, title: 'La gloire à mes genoux', channel: 'YouTube' }]; }
try { const response = await fetchData('./data/musicals.json'); if (response.ok) musicals = await response.json(); } catch {}
renderLibrary(); await loadSong(preferredId, false);
