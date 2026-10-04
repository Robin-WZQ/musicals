# 巴黎圣母院曲库

2026-10-04 新增。版本为 1998 年法语原卡司《Notre-Dame de Paris》，吕克·普拉蒙东作词、理查德·科西昂特作曲。

## 曲目与播放来源

- [舞台 DVD 曲目列表](https://www.youtube.com/playlist?list=PLkNGO_Wjl9VRR3xOZRl0qoyUQAIe3m7Fj) 前 50 项为独立演唱曲目，前 27 首属第一幕，后 23 首属第二幕。末尾两个整幕视频不重复计入。
- 序曲留在 [全剧录像](https://www.youtube.com/watch?v=3AnTqOIgPr0) 中；本次另加《大教堂时代》的谢幕合唱，共51个独立学习页。该来源列有人工法语、英语、德语、俄语和西班牙语字幕。
- 每首保留独立页面，实际播放统一使用全剧录像 `3AnTqOIgPr0` 的本曲范围。原片段 ID 保留为路由及 `alternateVideoId`；《酷刑》保留公开 DVD 音轨 `SxYNkMYEJN8` 作为备用来源。
- 发布前核对 50 个实际播放来源的公开可嵌入状态、时长和频道。这个检查不代表已逐句听校，也不保证来源以后始终可用。

## 介绍与演员

每曲独立保存中文介绍，沿用「这首歌讲什么」「剧情里的这一幕」「演唱者与角色」。剧情介绍为本站撰写的概述。

| 演员 | 原卡司角色 |
| --- | --- |
| Bruno Pelletier | 格兰古瓦 |
| Garou | 卡西莫多 |
| Daniel Lavoie | 弗罗洛 |
| Hélène Ségara | 艾丝美拉达 |
| Patrick Fiori | 菲比斯 |
| Luck Mervil | 克洛潘 |
| Julie Zenatti | 百合花 |

创作与首演资料参考 [剧方历史页](https://notredamedeparislespectacle.com/historique)。原卡司曲目及演唱者对照参考唱片目录：[第一幕](https://classical.music.apple.com/ca/album/79745251)、[第二幕](https://classical.music.apple.com/us/album/79745474)。原著可读 [公共领域的雨果小说](https://www.gutenberg.org/ebooks/2610)。音乐剧分场核对参考 [Wikipedia 梗概与曲目表](https://en.wikipedia.org/wiki/Notre-Dame_de_Paris_(musical))；其文字采用 CC BY-SA 许可。此处中文介绍另行撰写，演出与原著的场景分别核对。

## 字幕状态

51 页的 `captionStatus` 为 `ready`、`captionSource` 为 `editorial`、`lyricsStorage` 为 `user-provided`。用户直接提供的 `songs.js` 包含50首正曲1658行和返场19行，共1677行；全部接入法语、音标、中文空耳和中文释义四层卡片。资料对应 [fufu-life 学习页](https://fufu-life.github.io/musicals/notre-dame-de-paris/index.html) 和 [来源项目](https://github.com/fufu-life/musicals)。

导入器只解析 `window.songs=` 后的JSON，不执行文件中的JavaScript。保留源文件摘要、原行ID和 `sourceIPA`，便于对照。读音参考整句和单词独立读音，去掉复数名词和部分变位动词后多出的 /z/、/t/；保留冠词和代词等的联诵，`et` 和嘘音h阻断潜在联诵。整理 `suis`、`lui` 等的 /ɥ/，修正 `dos`、`aujourd’hui`、`Luther`、`Testament` 等误切到英语的读音。中文空耳由整理后的音标生成，中文释义保留所提供的译文。参考音标仍需结合原唱核对演唱发音。

歌曲起止来自同一录像评论区的曲目时间表。转录面板提供761条人工英语字幕和整秒起点。与用户文件中的英语对照文本按顺序匹配，一条字幕可对应多行法语；合并字幕内部按法语音节权重拆分。未匹配行在相邻锚点之间估算，谢幕按本曲范围估算。较长的尾部空白保留为间奏。每行 `timing` 保存锚点、匹配分数和拆分方法，可用于优先听校低分条目。全部切点保持 `timingReviewStatus: approximate` 和页面的 `≈` 标记，尚未完成逐句听唱核对。

原唱播放器默认留在左侧，右侧采用用户确认的四层卡片和原有字号。第一句靠顶，后续跟随句居中；低窗口保留完整底部控制栏。数据使用全剧绝对秒数，页面显示本曲相对时间。导入本曲相对时间的 VTT、SRT 或 JSON 会加上本曲在全剧中的起点；导入全剧时间字幕则截取本曲范围。JSON 条目可携带 `ipa`、`ear`、`studyMeaning`。导入内容留在本次页面内存中。

YouTube内置字幕与本站文字分别处理。前次真实播放器能播放原唱，内置字幕请求返回HTTP 429；当前四层文字从本站学习数据读取，可独立显示。

刷新脚本读取实际 `playbackVideoId`，把新字幕存入来源归档，保留学习歌词、注释、独立路由和本曲范围。原有761段时间数据作为来源记录保留。导入脚本 `scripts/import_notre_study.py` 接收用户歌词文件、同一录像的转录锚点、发音参考文件及输出报告路径；不能将其他录像时间直接套用。播放器参数参考 [YouTube 播放器参数](https://developers.google.com/youtube/player_parameters) 与 [IFrame API](https://developers.google.com/youtube/iframe_api_reference)；调用 `seekTo` 后，本站继续检查本曲结束边界。

总页封面保存自 [1998 原版现场唱片目录](https://music.apple.com/fr/album/513913352)，图片和音乐权利归原权利人。
