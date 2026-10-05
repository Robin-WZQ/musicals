import { videoId, clock, normalizeCues, cueAt } from './captions.mjs?v=20261005-3';
import { attachStudyNotes } from './study.mjs?v=20261005-3';
import { musicalURL, learningURL, tracksFor, resolveTrackId } from './library.mjs?v=20261005-3';
import { fetchData } from './data.mjs?v=20261005-3';
import { playbackStart, nativeCues, importStudyCaptions, studyStorageKey, studyPack, savedStudyCaptions } from './native.mjs?v=20261005-3';

const $ = id => document.getElementById(id);
let catalog = [], musicals = [], song, cues = [], player, playerReady = false, ytPromise, active = -1, selected = -1;
let boundary = null, following = true, sentenceMode = true, repeating = false, pendingSeek = null, heldAtEnd = null, toastTimer;
const initial = new URL(location.href), preferredId = videoId(initial.searchParams.get('v')) || '7BZhhlQFcbg';
const initialTime = Math.max(0, Number(initial.searchParams.get('t')) || 0);
let initialSeek = initialTime, loadGeneration = 0;
let nativeExpanded = false, heldSongEnd = false;
function nativeMode() { return song?.captionSource === 'youtube-player' && !['instrumental', 'unavailable'].includes(song.studyKind) && song.nativeCaptionRanges?.length > 0; }
const videoShell = document.querySelector('.video-shell');
const sidebarPlaceholder = document.createElement('div'); sidebarPlaceholder.className = 'native-sidebar-placeholder';
const nativePoster = document.createElement('img'); nativePoster.alt = '';
const returnPlayer = document.createElement('button'); returnPlayer.textContent = '↙ 收回播放器';
returnPlayer.onclick = () => { nativeExpanded = false; resizeNativePlayer(); };
sidebarPlaceholder.append(nativePoster, returnPlayer); videoShell.before(sidebarPlaceholder);
function resizeNativePlayer() {
  const stage = $('native-video-stage'), pane = $('lyrics'), list = $('native-caption-list');
  const expanded = Boolean(nativeMode() && nativeExpanded && innerWidth > 720 && pane.clientHeight >= 360 && stage);
  document.body.classList.toggle('native-stage-open', expanded);
  if (stage) stage.hidden = !expanded;
  if (expanded) {
    stage.style.height = `${Math.max(200, Math.min(pane.clientHeight * 0.61, 460))}px`;
    const rect = stage.getBoundingClientRect();
    Object.assign(videoShell.style, {position:'fixed',left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,minHeight:'200px',zIndex:'3'});
  } else videoShell.removeAttribute('style');
  if (list) {
    list.style.setProperty('--native-edge-space', `${list.clientHeight / 2}px`);
    if (active >= 0 && following) updateSelection(active, true);
    else { const first = list.querySelector('[data-index]'); if (first) centerLyric(list, first, true, true); }
  }
}
function setCaptionSize() {
  try { if (nativeMode() && player?.getOptions?.('captions')?.includes('fontSize')) player.setOption('captions', 'fontSize', 1); } catch {}
}
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
      playerVars: { playsinline: 1, rel: 0, origin: location.origin, start: Math.floor(initialSeek), ...(song.playbackSegment ? {end: Math.floor(song.playbackSegment.end)} : {}), cc_load_policy: song.captionSource === 'youtube-player' && song.studyKind !== 'instrumental' ? 1 : 0, cc_lang_pref: song.captionLanguage || 'fr' },
      events: {
        onReady: () => { playerReady = true; $('player-placeholder').hidden = true; setSpeeds(); setCaptionSize(); if (initialSeek > 0) { player.seekTo(initialSeek, true); initialSeek = 0; } resizeNativePlayer(); },
        onApiChange: setCaptionSize,
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
function centerLyric(pane, line, atTop = false, instant = false) {
  const paneRect = pane.getBoundingClientRect();
  const lineRect = line.getBoundingClientRect();
  const top = pane.scrollTop + lineRect.top - paneRect.top - pane.clientTop
    + (atTop ? 0 : lineRect.height / 2 - pane.clientHeight / 2);
  pane.scrollTo({ top, behavior: instant || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}
function resizeLyricSpace() {
  const pane = $('lyrics');
  // Scrollable spacers keep centering room without forcing the flex pane taller.
  pane.style.paddingBlock = '0px';
  pane.style.setProperty('--lyric-edge-space', `${pane.clientHeight / 2}px`);
  if (nativeMode()) { resizeNativePlayer(); return; }
  if (following && active >= 0) updateSelection(active, true);
  else if (active < 0) {
    const first = pane.querySelector('.lyric-line');
    if (first) centerLyric(pane, first, true, true);
  }
}
if ('ResizeObserver' in window) new ResizeObserver(resizeLyricSpace).observe($('lyrics'));
else window.addEventListener('resize', resizeLyricSpace);
resizeLyricSpace();
function updateSelection(index, scroll = false) {
  for (const node of $('lyrics').querySelectorAll('.active')) { node.classList.remove('active'); node.removeAttribute('aria-current'); }
  active = index;
  const line = $('lyrics').querySelector(`[data-index="${index}"]`);
  if (line) {
    line.classList.add('active'); line.setAttribute('aria-current', 'true');
    if (scroll && following) {
      centerLyric(nativeMode() ? $('native-caption-list') : $('lyrics'), line, index === 0);
    }
    $('current-line').textContent = `${index + 1} / ${cues.length} ${nativeMode() ? '段' : '句'}`;
  } else $('current-line').textContent = cues.length ? `共 ${cues.length} ${nativeMode() ? '段' : '句'}` : '暂无字幕';
}
async function playCue(index) {
  if (!cues.length) return;
  if (!playerReady) { await ensurePlayer(); toast('播放器准备好后，再点击这一句开始。'); return; }
  selected = Math.max(0, Math.min(cues.length - 1, index));
  const cue = cues[selected]; boundary = sentenceMode || repeating ? cue.end : null;
  pendingSeek = { start: cue.start, end: cue.end, requestedAt: performance.now() };
  heldAtEnd = null;
  heldSongEnd = false;
  player.seekTo(cue.start, true); player.playVideo(); updateSelection(selected, true);
}
function tick() {
  if (!playerReady) return;
  const time = player.getCurrentTime(); $('time').textContent = clock(song.playbackSegment ? Math.max(0,time-song.playbackSegment.start) : time);
  if (!cues.length) {
    if (song.playbackSegment && player.getPlayerState() === 1) {
      if (time < song.playbackSegment.start - .5) player.seekTo(song.playbackSegment.start,true);
      if (time >= song.playbackSegment.end - .04) { player.pauseVideo(); heldSongEnd = true; }
    }
    return;
  }
  const playing = player.getPlayerState() === 1;
  if (pendingSeek) {
    if (time >= pendingSeek.start - 0.2 && time <= pendingSeek.start + Math.min(0.5, (pendingSeek.end - pendingSeek.start) / 2)) pendingSeek = null;
    else if (performance.now() - pendingSeek.requestedAt < 8000) return;
    else { pendingSeek = null; boundary = null; toast('跳句未成功，请再点击这一句。'); return; }
  }
  if (song.playbackSegment && playing && time < song.playbackSegment.start - 0.5) {
    player.seekTo(song.playbackSegment.start,true); return;
  }
  if (boundary !== null && playing && time >= boundary - 0.04) {
    if (repeating && selected >= 0) { playCue(selected); return; }
    player.pauseVideo(); heldAtEnd = { time, index: selected }; boundary = null; return;
  }
  if (song.playbackSegment && playing && time >= song.playbackSegment.end - 0.04) {
    player.pauseVideo(); heldSongEnd = true; boundary = null; return;
  }
  if (!playing && heldAtEnd && Math.abs(time - heldAtEnd.time) < 0.35) return;
  heldAtEnd = null;
  const index = cueAt(cues, time);
  if (index !== active) updateSelection(index, playing);
}
setInterval(tick, 80);

function renderLyrics() {
  $('lyrics').replaceChildren(); active = selected = -1; boundary = pendingSeek = heldAtEnd = null;
  $('lyrics').classList.toggle('native-pane', Boolean(nativeMode()));
  $('sentence-mode').textContent = nativeMode() ? '段末暂停' : '单句暂停';
  $('repeat').textContent = nativeMode() ? '↻ 循环这段' : '↻ 循环这句';
  const annotated = cues.some(c => c.ipa && c.ear);
  const availableTranslation = cues.some(c => c.studyMeaning || c.translation);
  $('study-legend').hidden = $('study-note').hidden = !annotated;
  $('ipa-toggle').disabled = $('ear-toggle').disabled = !annotated;
  $('translation-label').textContent = annotated ? '释义' : '译文';
  $('translation').disabled = !availableTranslation;
  $('translation').checked = availableTranslation;
  $('lyrics').classList.toggle('hide-translations', !availableTranslation);
  $('repeat').disabled = $('sentence-mode').disabled = $('previous').disabled = $('next').disabled = !cues.length;
  if (nativeMode()) { renderNativeCaptions(); return; }
  resizeNativePlayer();
  if (!cues.length) {
    if (song.captionSource === 'youtube-player') {
      const state = document.createElement('div'); state.className = 'empty-state native-source';
      const icon = document.createElement('span'); icon.className = 'empty-icon'; icon.textContent = '♫';
      const heading = document.createElement('h3'); heading.textContent = song.editorialInfo?.titleZh || song.title;
      const original = document.createElement('p'); original.className = 'native-original'; original.textContent = song.editorialInfo?.titleOriginal || song.title;
      const info = document.createElement('p'); info.textContent = song.studyEmptyMessage || (song.studyKind === 'instrumental' ? '这一段是舞会音乐与群舞。点击播放，观看两家人相聚的舞会现场。' : '听这一曲原唱，或打开带法语字幕的全剧录像。导入本曲字幕后，这里会显示逐句播放内容。');
      const actions = document.createElement('div'); actions.className = 'empty-actions';
      const play = document.createElement('button'); play.className = 'solid-button'; play.textContent = '▶ 播放本曲'; play.onclick = togglePlay;
      const full = document.createElement('a'); full.className = 'outline-button'; full.textContent = song.studyEmptyMessage ? '在 YouTube 打开 ↗' : '全剧 · 法语字幕 ↗'; full.href = song.fullPerformanceURL; full.target = '_blank'; full.rel = 'noopener noreferrer';
      const upload = document.createElement('button'); upload.className = 'outline-button'; upload.textContent = '导入本曲字幕'; upload.onclick = () => $('caption-file').click();
      actions.append(play, full); if (song.studyKind !== 'instrumental') actions.append(upload);
      state.append(icon, heading, original, info, actions); $('lyrics').append(state);
      $('current-line').textContent = song.studyKind === 'instrumental' ? '器乐 · 舞台舞蹈' : '原唱播放'; return;
    }
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
      const timeOrigin = song.playbackSegment?.start || 0;
      line.title = `${approximate ? '近似位置 ' : ''}${clock(cue.start-timeOrigin)} — ${clock(cue.end-timeOrigin)} · 点击听这一句`;
      const stamp = document.createElement('span'); stamp.className = 'timestamp'; stamp.textContent = `${approximate ? '≈ ' : ''}${clock(cue.start-timeOrigin)}`; stamp.setAttribute('aria-hidden', 'true');
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
  const pane = $('lyrics'); pane.append(fragment);
  const first = pane.querySelector('.lyric-line');
  if (first) centerLyric(pane, first, true, true);
  else pane.scrollTop = 0;
  $('current-line').textContent = `共 ${cues.length} 句`;
}
function renderNativeCaptions() {
  const session = document.createElement('div'); session.className = 'native-session';
  const actions = document.createElement('div'); actions.className = 'native-actions';
  const label = document.createElement('span'); label.textContent = song.isGenerated ? '法语字幕（自动） · 分段重听' : '原生法语字幕 · 分段重听';
  const full = document.createElement('button'); full.className = 'pill'; full.textContent = '重听整曲';
  full.onclick = async () => {
    if (!playerReady) { await ensurePlayer(); return; }
    selected = -1; boundary = null; heldAtEnd = null; heldSongEnd = false;
    repeating = false; pressed('repeat', false);
    player.seekTo(song.playbackSegment.start,true); player.playVideo();
  };
  const expand = document.createElement('button'); expand.className = 'pill'; expand.textContent = '放大字幕';
  expand.onclick = () => { nativeExpanded = !document.body.classList.contains('native-stage-open'); resizeNativePlayer(); };
  actions.append(label,full,expand);
  if (song.isGenerated) {
    const watch = document.createElement('a'); watch.className = 'pill'; watch.textContent = '在 YouTube 看字幕 ↗';
    watch.href = song.sourceURL || `https://www.youtube.com/watch?v=${song.playbackVideoId || song.id}`;
    watch.target = '_blank'; watch.rel = 'noopener noreferrer'; actions.append(watch);
  }
  const stage = document.createElement('div'); stage.id = 'native-video-stage'; stage.setAttribute('aria-hidden','true');
  const hint = document.createElement('p'); hint.className = 'native-hint'; hint.textContent = song.isGenerated ? '法语自动字幕可在播放器的 CC 中开启，也可前往 YouTube 查看。下方按转录时间点重听。' : '法语字幕在左侧播放器内显示，可点击“放大字幕”。下方时间段用于重听。';
  const list = document.createElement('div'); list.id = 'native-caption-list'; list.className = 'native-caption-list'; list.setAttribute('aria-label','字幕片段');
  cues.forEach((cue,index) => {
    const line = document.createElement('button'); line.className = 'lyric-line native-cue'; line.dataset.index = index;
    const title = document.createElement('span'); title.className = 'native-cue-label'; title.textContent = cue.text;
    const range = document.createElement('span'); range.className = 'native-cue-time'; range.textContent = `${clock(cue.start-song.playbackSegment.start)} — ${clock(cue.end-song.playbackSegment.start)}`;
    line.append(title,range); line.title = '按转录时间点播放这一段'; line.onclick = () => playCue(index); list.append(line);
  });
  session.append(actions,stage,hint,list); $('lyrics').append(session);
  $('current-line').textContent = `共 ${cues.length} 段`; requestAnimationFrame(resizeNativePlayer);
}
function studyRow(label, text, className) {
  const row = document.createElement('span'); row.className = `study-row ${className}`;
  const tag = document.createElement('span'); tag.className = 'study-label'; tag.textContent = label;
  const content = document.createElement('span'); content.className = 'study-content';
  if (className === 'study-ipa') {
    // The stylesheet supplies one pair of brackets for every IPA reading.
    const reading = String(text).trim();
    const unwrapped = /^\[.*\]$|^\/.*\/$/u.test(reading) ? reading.slice(1,-1) : reading;
    for (const part of unwrapped.split(/(‿)/u)) {
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
  nativePoster.src = $('cover').src;
  if (song.playbackSegment) $('youtube-link').href += `&t=${Math.floor(song.playbackSegment.start)}`;
  $('song-description').textContent = song.description || (song.metadataSource ? `YouTube 视频：${song.title}\n\n未读到视频介绍。` : '这首歌的原唱由 YouTube 播放。视频介绍在歌曲信息读取完成后显示。');
  $('song-description').classList.remove('expanded'); $('description-toggle').textContent = '展开介绍 ↓'; $('description-toggle').hidden = (song.description || '').length < 220;
  $('language-label').textContent = song.captionLanguage ? languageName(song.captionLanguage) : '字幕语言待确认';
  $('caption-badge').textContent = song.captionSource === 'local' ? '本地导入字幕' : cues.length ? (song.isGenerated ? 'YouTube 自动字幕' : 'YouTube 字幕') : song.captionStatus === 'pending' ? '字幕待读取' : '字幕不可用';
  const translated = cues.some(c => c.translation);
  $('source-note').textContent = song.captionSource === 'local' ? (song.localCaptionsSaved ? '导入的字幕保存在这个浏览器，刷新后会继续使用。可导出备份，或恢复本站字幕。' : '导入的字幕正在本页使用。浏览器未能保存，请导出备份。') : `字幕与时间戳来自 YouTube${song.isGenerated ? ' 自动字幕' : ''}。${translated ? `译文来自 YouTube（${languageName(song.translationLanguage || 'en')}）。` : '当前没有可用译文。'}${song.fetchedAt ? ` 更新：${new Date(song.fetchedAt).toLocaleDateString('zh-CN')}` : ''}`;
  $('export-captions').hidden = $('reset-captions').hidden = song.captionSource !== 'local';
  if (song.captionSource === 'local') {
    $('caption-badge').textContent = cues.every(c => c.ipa && c.ear && c.studyMeaning) ? '本地导入 · 四层学习' : '本地导入字幕';
    $('study-note').textContent = '音标、空耳和释义使用导入文件中的内容；‿ 表示联诵或连读。';
  }
  if (song.captionSource === 'youtube-player') {
    $('language-label').textContent = '法语'; $('caption-badge').textContent = song.studyKind === 'instrumental' ? '器乐 · 舞台舞蹈' : nativeMode() ? (song.isGenerated ? '法语自动字幕' : '人工法语字幕') : song.performanceYear ? `${song.performanceYear} 年舞台版` : '法语舞台原唱';
    const timingSource = song.nativeTimingSource === 'user-supplied-time-caption' ? '分段时间采用你提供的时间字幕文件' : `分段时间参考同一录像${song.nativeTimingLanguage === 'en' ? '的英文' : '的法语'}转录面板`;
    $('source-note').textContent = nativeMode() ? `法语${song.isGenerated ? '自动' : '人工'}字幕可在 YouTube 播放器中开启。${timingSource}，精度为整秒，段尾按下一条时间点定位。${song.isGenerated ? '识别文字尚未校对，分段用于重听原唱。' : ''}` : song.mediaKind === 'audio' ? '本曲使用原版 DVD 的音轨视频。全剧录像另有人工法语字幕，可在 YouTube 中开启。' : '本曲使用法语舞台视频，可在 YouTube 播放器中开启字幕。';
    if (song.studyKind === 'instrumental') $('source-note').textContent = '舞会器乐选自2010年舞台录像，播放范围按本场曲目时间表定位。';
    if (song.studyEmptyMessage) {
      $('source-note').textContent = song.studyEmptyMessage;
      if (song.studyKind === 'unavailable') $('caption-badge').textContent = '原唱 · 法语字幕待补';
    }
  }
  if (song.studyNotes && cues.some(c => c.ipa)) {
    const reviewed = song.studyNotes.textSource === 'youtube-video-description' || song.studyNotes.textReviewStatus === 'cross-checked';
    $('caption-badge').textContent = song.timingReviewStatus === 'approximate' ? '校正歌词 · 近似时间轴' : reviewed ? 'YouTube 时间轴 · 校正歌词' : 'YouTube 自动字幕 · 参考注释';
    $('source-note').textContent = song.studyNotes.note || '字幕和时间戳来自 YouTube。音标、空耳和中文释义为本站参考注释。';
    $('study-note').textContent = reviewed ? `${song.timingReviewStatus === 'approximate' ? '句子已重新整理，≈ 表示播放位置仍为近似值。' : ''}参考音标标出部分联诵与连读（‿）；并非原唱逐音转写。空耳仅辅助记忆，演唱发音以原唱为准。` : '新曲目学习注释自动生成，尚未逐句校对。音标是字幕文本的参考读法，‿ 表示可能的联诵或连读；空耳与中文机译均为近似参考，无法纠正字幕识别错误。';
    if (['user-supplied-songs-js','user-supplied-timed-transcript'].includes(song.studyNotes.textSource)) {
      $('caption-badge').textContent = '学习歌词 · 近似时间轴';
      $('study-note').textContent = '‿ 表示联诵或连读；空耳辅助记忆读音。≈ 表示原唱片段的近似切点。';
    }
    if (song.studyNotes.textSource === 'user-supplied-auto-transcript') {
      $('caption-badge').textContent = '四层学习 · 近似时间轴';
      $('study-note').textContent = '‿ 表示参考联诵或连读；空耳辅助记忆。≈ 是近似分段，原字幕识别不清处请对照原唱。';
    }
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
  const facts = [info.language, info.level ? `${info.level}（参考）` : '', info.genre, info.performanceYear ? `${info.performanceYear}年舞台版` : info.productionYear ? `${info.productionYear}年首演` : info.releaseYear ? `${info.releaseYear}年` : ''].filter(Boolean);
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
  const previousNative = song?.captionSource === 'youtube-player';
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
  let saved = null;
  try { saved = savedStudyCaptions(data, localStorage); } catch { /* Storage can be disabled. */ }
  if (saved) {
    data.captionSource = 'local'; data.cues = saved; data.localCaptionsSaved = true;
    delete data.studyNotes;
  }
  if (player && previousNative !== (data.captionSource === 'youtube-player')) {
    player.destroy?.(); const replacement = document.createElement('div'); replacement.id = 'youtube-player';
    const old = $('youtube-player'); if (old) old.replaceWith(replacement); else videoShell.prepend(replacement);
    player = null; playerReady = false; $('player-placeholder').hidden = false;
  }
  song = data; cues = attachStudyNotes(normalizeCues(nativeMode() ? nativeCues(data) : data.cues || []), data.studyNotes);
  initialSeek = playbackStart(song,initialSeek,initial.searchParams.get('timebase'));
  heldSongEnd = false;
  renderInfo();
  if (playerReady) { player.cueVideoById({ videoId: song.playbackVideoId || id, startSeconds: initialSeek, ...(song.playbackSegment ? {endSeconds:song.playbackSegment.end} : {}) }); setSpeeds(); setCaptionSize(); initialSeek = 0; }
  if (updateURL) { const url = new URL(location.href); url.searchParams.set('v', id); url.searchParams.delete('t'); url.searchParams.delete('timebase'); history.replaceState(null, '', url); }
  $('song-dialog').open && $('song-dialog').close();
  await ensurePlayer();
}
function renderLibrary() {
  $('song-list').replaceChildren(...catalog.map(entry => {
    const button = document.createElement('button'); button.className = 'song-card';
    const cover = document.createElement('img'); cover.src = entry.cover || `https://i.ytimg.com/vi/${entry.playbackVideoId || entry.id}/mqdefault.jpg`; cover.alt = ''; cover.loading = 'lazy';
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
  if (song.playbackSegment) url.searchParams.set('timebase','source'); else url.searchParams.delete('timebase');
  try { await navigator.clipboard.writeText(url.href); toast('链接已复制，包含当前播放位置。'); }
  catch { if (navigator.share) { try { await navigator.share({ title: song.title, url: url.href }); } catch {} } else toast('请复制浏览器地址栏中的链接。'); }
}
async function togglePlay() {
  if (!playerReady) { await ensurePlayer(); toast('播放器准备好后，点击播放。'); return; }
  if (player.getPlayerState() === 1) player.pauseVideo();
  else {
    if (song.playbackSegment && (heldSongEnd || player.getCurrentTime() >= song.playbackSegment.end)) {
      if (cues.length) playCue(0);
      else { heldSongEnd = false; player.seekTo(song.playbackSegment.start,true); player.playVideo(); }
      return;
    }
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
$('translation').onchange = () => { $('lyrics').classList.toggle('hide-translations', !$('translation').checked); if (following && active >= 0) updateSelection(active, true); };
$('ipa-toggle').onclick = () => { const hidden = $('lyrics').classList.toggle('hide-ipa'); pressed('ipa-toggle', !hidden); if (following && active >= 0) updateSelection(active, true); };
$('ear-toggle').onclick = () => { const hidden = $('lyrics').classList.toggle('hide-ear'); pressed('ear-toggle', !hidden); if (following && active >= 0) updateSelection(active, true); };
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
  const targetSong = song, generation = loadGeneration;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('字幕文件应小于 5 MB');
    const parsed = importStudyCaptions(targetSong, await file.text()); if (!parsed.length) throw new Error('没有识别到本曲范围内的字幕时间戳');
    if (generation !== loadGeneration || song !== targetSong) throw new Error('歌曲已切换，请在对应歌曲页重新导入');
    let saved = false;
    try { localStorage.setItem(studyStorageKey(song), JSON.stringify(studyPack(song, parsed))); saved = true; } catch {}
    playerReady && player.pauseVideo(); cues = parsed; song.captionSource = 'local'; song.cues = cues; song.localCaptionsSaved = saved; delete song.studyNotes;
    renderInfo(); toast(`已导入 ${cues.length} 条字幕${saved ? '，刷新后保留。' : '；浏览器未能保存，请导出备份。'}`);
  } catch (error) { toast(error.message || '字幕格式无法识别'); } finally { event.target.value = ''; }
};
$('export-captions').onclick = () => {
  const blob = new Blob([JSON.stringify(studyPack(song, cues), null, 2)], {type:'application/json;charset=utf-8'});
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `${song.id}-study.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('reset-captions').onclick = async () => {
  try { localStorage.removeItem(studyStorageKey(song)); }
  catch { toast('浏览器未能清除保存的字幕，请检查存储权限。'); return; }
  const id = song.id; initialSeek = playbackStart(song);
  await loadSong(id, false); toast('已恢复本站字幕。');
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
renderLibrary(); await loadSong(resolveTrackId(initial.searchParams.get('v'),catalog) || preferredId, false);
