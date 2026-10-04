# Musicals · 听见每一句

[打开网页](https://robin-wzq.github.io/musicals/)

后续修改和新增歌曲沿用 [页面与内容原则](docs/product-principles.md)。其中记录已确认的中文写作、逐曲介绍、字号、配色、歌词跟随和窗口适配要求。

三层静态曲库：**音乐剧总页 → 音乐剧曲目页 → 单曲学习页**。总页使用原专辑封面；每首歌有独立可分享地址，曲目页按指定播放列表顺序排列，支持中法文搜索、字幕可用筛选和继续上次学习。

新增 [《巴黎圣母院》](https://robin-wzq.github.io/musicals/musical.html?id=notre-dame-de-paris)：1998 年法语原卡司版，收录两幕的 50 首正曲及谢幕合唱。51 页都有中文基本资料和介绍，以及法语、音标、中文空耳、中文释义四层歌词，共 1677 行。原唱使用全剧录像中各曲的对应片段，原独立视频作为备用资料保留。

本作品接入用户提供的 `songs.js`，使用 `captionStatus: ready`、`captionSource: editorial` 与 `lyricsStorage: user-provided`。音标修正了多余的词尾辅音和英语误读，并补联诵与中文空耳。原唱时间参考同一录像的 761 条英语字幕内容，合并字幕内部按法语分句估算；逐句切点仍标为近似值，谢幕按本曲范围估算。刷新保留学习内容和录像范围。来源与方法见 [巴黎圣母院数据说明](docs/notre-dame-de-paris.md)。

单曲学习页保持已确定的布局：左侧 YouTube 播放器和中文介绍，右侧同步字幕。点击字幕跳到对应片段，支持句末暂停、单句循环、速度调节、译文开关、自动跟随、收藏和带时间的分享链接。新增返回曲目、上一首和下一首入口。适配桌面与手机。

《摇滚红与黑》收录 [指定 YouTube 播放列表](https://www.youtube.com/playlist?list=PLCxPUdEskUoWi63e6flyUBOU_pLNA_0S9) 的 **16 个视频**。法语文字已交叉校正，碎片重新整理，中文释义按校正后的文字重写。原来缺法语字幕的 4 项改用完整替代视频，原歌曲页网址仍可访问。末项原名“总有一天”有误，实际为《爱情的诅咒》的宣传 MV；它与第 4 项是同一首歌曲的不同视频，不算另一首新歌。旧名保留供搜索。

原来的《荣耀向我俯首》原 MV 网址保留，本次也整理为完整歌词行。学习层为：**法语歌词 → 青色参考音标（联诵/连读 `‿`）→ 珊瑚色近似空耳 → 金色中文释义**。音标、空耳、释义可分别隐藏，点击任意一层都能播放对应原唱片段。对白单独标注。

旧链接 `/?v=VIDEO_ID&t=SECONDS` 自动跳到 `learn.html`，完整保留视频 ID 与时间参数。新版链接为 `musical.html?id=MUSICAL_ID` 和 `learn.html?v=VIDEO_ID`，无需服务器路由重写，可直接刷新。

左侧以中文展示歌曲基本资料，并按「这首歌讲什么」「剧情里的这一幕」「演唱者与角色」介绍各曲；法语原名保留用于对照。`data/info/<videoId>.json` 保存这些介绍，独立于 YouTube 自动获取的数据。歌曲发行年份与视频上传日期分开处理，演唱者与上传频道也分别标识。学习难度 B2 标为参考级别，中文歌名采用用户指定的《荣耀向我俯首》；资料来源可在侧栏展开。

## 数据来源

视频通过 YouTube 播放。原自动字幕归档在歌曲文件的 `sourceCues`；替代视频的公开转写面板文本另存为 `playbackSourceCues`，并记录实际识别语言。校正参考剧方公开分场剧本、歌词资料和视频歌词画面，来源写入注释文件。**本轮是文字校对，不是逐句听音认证：新分句起止时间为近似定位，页面用 `≈` 和“近似时间轴”明确标示，不能当作精确演唱切点。** 少数存在异文或听辨疑点的文字也在对应行标注“仍待听校”。

`data/study/<videoId>.json` 保存学习注释。中文释义为编辑改写，音标由 eSpeak NG 辅助生成，重点词、英语误读、部分词尾和联诵另作修正；空耳为近似汉字读音提示。`reviewStatus: text-reviewed-timing-approximate` 区分文字校对与未完成的精确时间校对，`pronunciationReviewStatus` 也不宣称完成原唱逐音审核。`‿` 标出部分参考联诵或连读；h aspiré（如 haut、héros）不强行联诵，et 前不增加潜在联诵辅音。中文空耳无法精确表示法语鼻化元音、圆唇元音和 /ʁ/。

专辑封面来自 Apple Music 唱片目录，保存为本地图片，出处写入音乐剧清单。封面及音乐的权利归原权利人；仓库代码许可不覆盖第三方封面和歌曲。

注释须同时匹配学习字幕文本和起始时间，不能套用其他句子的注释。`captionSource: editorial` 的歌曲在自动刷新时只更新原始字幕归档，保留校正后的文字与时间轴。替代视频由 `playbackVideoId` 明确指定：网址、收藏仍使用原歌曲 ID，播放器、封面和外部播放链接使用实际视频 ID，避免把新视频配到旧时间轴。

联诵规则参考：[OQLF 禁止联诵的语境](https://vitrinelinguistique.oqlf.gouv.qc.ca/23552/la-prononciation/liaisons/contextes-de-liaisons-interdites)，[h aspiré（包括 haut）](https://vitrinelinguistique.oqlf.gouv.qc.ca/22203/la-prononciation/prononciation-de-certaines-lettres/la-prononciation-du-h-aspire)。

没有可用字幕或 YouTube 拒绝服务器请求时，页面会保留视频播放并显示缺失状态。接口错误不会被标为“该视频没有字幕”；更新失败不会覆盖已有可用字幕。YouTube 的地区、网络、年龄及嵌入限制仍适用。

## 添加歌曲

### 扩展其他音乐剧

总页与曲目页均读取数据，添加作品不需要复制页面模板：

1. 在 `data/musicals.json` 添加一个对象：唯一 `id`、`titleZh`、`titleOriginal`、`languageShort`、`country`、`year`、相对 `cover` 路径、`coverSource`、`summary`、`background`、`playlistURL` 和按顺序排列的 `trackIds`。
2. 歌曲加入 `data/catalog.json`，保留 `id`、`titleZh`、`titleOriginal`、`musicalId`、`trackNumber`、秒数 `duration` 及 `captionStatus`。播放数据写入 `data/songs/<id>.json`；介绍与学习注释各写入对应独立目录。
3. `trackIds` 确定展示顺序，曲目不会混入其他音乐剧。运行下面的检查验证引用完整性，再提交部署。

读取歌曲的脚本会保留现有的作品归属与曲序。默认部署只读取 `pending` 歌曲，不反复尝试已明确缺少字幕的视频；显式填写视频链接仍可重试。

1. 打开 [Actions → Update songs and deploy Pages](https://github.com/Robin-WZQ/musicals/actions/workflows/pages.yml)。
2. 点击 **Run workflow**，在 `youtube_url` 填入 YouTube 视频链接。
3. `language` 默认 `fr`；`translation` 默认 `en`，可填写 `zh-Hans`。按优先语言读取已有字幕，缺失时使用该视频的其他可用字幕。译文不可用时只显示原文。
4. 运行成功后，数据写入 `data/songs/`，歌单更新，网页自动部署。

网页的“＋”也可以直接打开新 YouTube 视频；未录入的视频需要运行上面的工作流，或导入该视频的 YouTube VTT/SRT/JSON3 字幕。导入字幕仅用于当前页面，不上传服务器。

GitHub 托管服务器可能被 YouTube 限流或拒绝访问。这时可在能连接 YouTube 的电脑上运行同一脚本，将生成的数据提交到仓库：

```sh
pip install -r scripts/requirements.txt
python scripts/ingest_youtube.py --video 'YOUTUBE_URL' --language fr --translation en
```

本机需要既有网络代理时，可添加 `--proxy 'http://HOST:PORT'`。代理地址不会写入歌曲数据或网页。GitHub 服务器的读取结果可能与本机不同；已成功保存的字幕可直接供网页使用。

## 开发与部署

用户提供的双语字幕可通过 [本地四层字幕制作](docs/study-pack.md) 批量整理为学习包。网页导入后保留联诵音标、空耳、释义，并校验录像来源与本曲范围。

无需前端构建和 API 密钥。GitHub Pages 使用 GitHub Actions 部署。

```sh
npm run check
npm test
python -m http.server 8080
```

打开 `http://localhost:8080/`。字幕解析、时间边界、学习注释匹配、曲库引用及未来作品隔离测试在 `tests/`。页面分别是 `index.html`（总页）、`musical.html`（曲目）、`learn.html`（学习页）。`assets/browse.js` 与 `assets/browse.css` 管理曲库外观，`assets/app.js` 与学习页样式管理原有播放功能。`scripts/ingest_youtube.py` 是数据读取脚本。

播放器来自 YouTube IFrame API。收藏保存到浏览器 localStorage；导入字幕留在当前页面内存中。没有分析追踪器。第三方 YouTube 播放器和 Google Fonts 会访问其各自的服务。
