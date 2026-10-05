# 《唐璜》数据与来源

指定录像：[Esmeralda Belle 上传的 Don Juan 舞台录像](https://www.youtube.com/watch?v=ZmzpG11NJwc)，时长 7,794 秒，上传于 2012-11-06。录像具有人工法语、俄语字幕；上传简介中的演员名单用于本版介绍。作品首演与原专辑年份为 2004 年，上传没有说明确切拍摄日期，因此没有填写本版演出年份。

## 曲目与学习内容

采用用户在 2026-10-05 上传的时间对应歌词，按两幕的编号收录 41 项：第一幕 22 项、第二幕 19 项，包含歌曲、开场和过场对白。对应路由为 `donjuan-01` 至 `donjuan-41`，实际播放均使用 `ZmzpG11NJwc`。末曲在 7,423 秒结束，随后的字幕署名与谢幕不进入学习卡片。

710 个有效时间块整理为 1,582 条四层卡片。每条保存原始输入、源文件 SHA256、原行号及原时间块。明显的拼写、重音符号与语法错误在显示文本中修正，原输入继续保留在 `suppliedText` 中。

《Vivir》《Tristeza Andalucía》使用西班牙语读音，《Les femmes》保留其中的西班牙语副歌。其余使用法语参考音标，修正人名误读并补参考联诵；中文空耳按对应语言生成。中文释义先取得翻译参考，再逐曲检查并改写，目前 613 个不同句子有人工改写。参考音标采用标准读法。

用户提供的整秒时间是歌词块的起点。一个时间块有多句时，按元音权重分配块内时长；块末结合同一视频人工字幕文件的 1,622 个时间区间保留无字幕间隔。分句切点使用近似标记 `≈`，没有进行原唱逐音强制对齐。

学习数据写入 `data/songs/` 与 `data/study/`；中文介绍写入 `data/info/`；汇总报告为 `data/donjuan-study-import.json`。导入器先校验全部 41 页及播放来源，再写入数据。自动字幕刷新保留已编辑的学习卡片。

## 演员与资料

本录像的唐璜由 Jean-François Breau 饰演，玛丽亚由 Marie-Ève Janvier 饰演。其他角色：伊莎贝尔 Geneviève Charest、唐·卡洛斯 Mario Pelchat、拉斐尔 Philippe Berghella、唐·路易斯 Claude Lancelot、埃尔维拉 Cindy Daniel、吉卜赛歌者 Chico Castillo。骑士长的配音演员未在本上传中列明，页面以角色名介绍。

- [本场录像与演员名单](https://www.youtube.com/watch?v=ZmzpG11NJwc)
- [剧方作品介绍与创作团队](https://broadwaymontreal.ca/don-juan/)：Félix Gray 编剧、作词、作曲，Gilles Maheu 执导。
- [2004 年原专辑封面](https://music.apple.com/fr/album/1442675049)，本地保存 `assets/covers/don-juan.jpg`。
- [曲目与人物关系](https://en.wikipedia.org/wiki/Don_Juan_(musical))，作为分场资料补充；演员依本版上传名单填写。

## 验证

数据检查覆盖两幕顺序、曲目范围、四层匹配、演员与语言、原始输入留存，以及署名清除。浏览器检查覆盖全部 41 页、跳句、暂停、循环、末尾停止、第一句靠顶与后续居中、各层开关及窄屏和低矮窗口；另用真实 YouTube 嵌入确认播放。歌词区原有字号与颜色保持不变。
