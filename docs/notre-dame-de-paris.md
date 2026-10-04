# 巴黎圣母院曲库

2026-10-04 新增。版本为 1998 年法语原卡司《Notre-Dame de Paris》，吕克·普拉蒙东作词、理查德·科西昂特作曲。

## 曲目与播放来源

- [舞台 DVD 曲目列表](https://www.youtube.com/playlist?list=PLkNGO_Wjl9VRR3xOZRl0qoyUQAIe3m7Fj) 前 50 项为独立演唱曲目，前 27 首属第一幕，后 23 首属第二幕。末尾两个整幕视频不重复计入。
- 序曲及谢幕段落留在 [全剧录像](https://www.youtube.com/watch?v=3AnTqOIgPr0) 中。该来源元数据列有人工法语、英语、德语、俄语和西班牙语字幕。
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

50 首的 `captionStatus` 为 `native`：播放器默认打开人工法语字幕。仓库保存 761 个时间范围，供点击跳转、段末暂停和循环；歌词与译文由 YouTube 播放器显示。

歌曲起止位置来自同一录像评论中的曲目时间表。分段起点来自该录像人工英语字幕的转录面板，面板精度为整秒；结束位置采用下一个起点，并在本曲结尾截断。因此时间段可能包括间奏，也可能与法语字幕的换行位置不同。这批范围没有标记为法语逐句听校完成。

原唱播放器默认放在左侧，可手动放大到右侧；窄屏或低窗口回到侧栏播放器，底部控制保留。导入本曲相对时间的 VTT、SRT 或 JSON 会加上本曲在全剧中的起点；导入全剧时间字幕则截取本曲范围。JSON 条目可携带 `ipa`、`ear`、`studyMeaning`，直接沿用原四层歌词卡片。导入内容只留在本次页面内存中。完整音标、空耳与中文逐句释义尚未补入这批曲目。

2026-10-04 实测：真实播放器成功播放并选中 `fr` 字幕轨；当前测试网络的字幕请求返回 HTTP 429，字幕文字未能呈现。50 页的范围跳转、段末暂停、循环、曲末边界、字幕导入与布局通过模拟播放器检查；原有歌词字号与居中通过回归检查。字幕轨存在与字幕在当前网络成功加载分别记录。

刷新脚本只更新这批曲目的来源元数据，保留独立路由、本曲时长与时间范围。播放器参数参考 [YouTube 播放器参数](https://developers.google.com/youtube/player_parameters) 与 [IFrame API](https://developers.google.com/youtube/iframe_api_reference)；调用 `seekTo` 后，由本站继续检查本曲结束边界。

总页封面保存自 [1998 原版现场唱片目录](https://music.apple.com/fr/album/513913352)，图片和音乐权利归原权利人。
