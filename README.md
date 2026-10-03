# Musicals · 听见每一句

[打开网页](https://robin-wzq.github.io/musicals/)

一个音乐剧原唱学习页面：左侧 YouTube 播放器和视频介绍，右侧同步字幕。点击字幕跳到对应片段，支持句末暂停、单句循环、速度调节、译文开关、自动跟随、收藏和带时间的分享链接。适配桌面与手机。

当前歌曲的全部 36 条字幕已配套学习注释：**法语歌词 → 青色音标（带联诵/连读 `‿`）→ 珊瑚色中文空耳 → 金色中文释义**。音标、空耳、释义可分别隐藏，点击任意一层都能播放对应原唱片段。

## 数据来源

原始视频信息、字幕及时间戳来自 YouTube。不下载音频，不使用第三方歌词库，不生成时间戳。字幕条目不一定是一整句歌词，尤其是自动字幕；切分沿用 YouTube 时间戳，重叠条目在下一条开始时间截断。

`data/study/<videoId>.json` 保存本站补充的学习注释，不宣称来自 YouTube。当前显示歌词依据同一视频介绍修正了自动字幕的明显错字，但不会改动原始字幕文件和播放时间轴；省略号表示跨条目的续接。音标为标准法语参考读法，并非对演唱逐音复核；`‿` 表示联诵或连读。中文空耳只是近似读音，不能精确表示法语鼻化元音、圆唇元音和 /ʁ/。中文释义也属于学习注释，与可用时显示的 YouTube 字幕翻译区分。

注释须同时匹配原始字幕文本和起始时间。更新后的字幕若不同，会停止应用对应旧注释，避免配错歌词。新增歌曲需要添加它自己的注释文件，不能自动套用当前歌曲的音标和空耳。

联诵规则参考：[OQLF 禁止联诵的语境](https://vitrinelinguistique.oqlf.gouv.qc.ca/23552/la-prononciation/liaisons/contextes-de-liaisons-interdites)，[h aspiré（包括 haut）](https://vitrinelinguistique.oqlf.gouv.qc.ca/22203/la-prononciation/prononciation-de-certaines-lettres/la-prononciation-du-h-aspire)。

没有可用字幕或 YouTube 拒绝服务器请求时，页面会保留视频播放并显示缺失状态。接口错误不会被标为“该视频没有字幕”；更新失败不会覆盖已有可用字幕。YouTube 的地区、网络、年龄及嵌入限制仍适用。

## 添加歌曲

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

无需前端构建和 API 密钥。GitHub Pages 使用 GitHub Actions 部署。

```sh
npm run check
npm test
python -m http.server 8080
```

打开 `http://localhost:8080/`。字幕解析与时间边界测试在 `tests/`。主要页面文件是 `index.html`、`assets/style.css`、`assets/app.js`。`scripts/ingest_youtube.py` 是数据读取脚本。

播放器来自 YouTube IFrame API。收藏保存到浏览器 localStorage；导入字幕留在当前页面内存中。没有分析追踪器。第三方 YouTube 播放器和 Google Fonts 会访问其各自的服务。
