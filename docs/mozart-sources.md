# 摇滚莫扎特：2010年巴黎录像

- 播放来源：[用户指定的完整录像](https://www.youtube.com/watch?v=83Qn2IvP_-I)，Hartwin 上传。简介标注 `Complete live in Paris, 2010`，上传日期为2016年10月4日。演出年份按上传者简介记录；作品首演年份为2009年。
- [作品首演与剧场资料](https://www.artcena.fr/agendas/spectacles/mozart-lopera-rock-2009)、[演出介绍](https://www.theatreonline.com/Spectacle/Mozart-l-opera-rock/32053)。
- [封面所用唱片](https://music.apple.com/fr/album/331386305)、[唱片曲目与演唱者](https://music.apple.com/us/album/393791485)。封面专辑年份为2009年，独立于录像年份。
- [舞台剧情与角色对照](https://fr.wikipedia.org/wiki/Mozart,_l%27op%C3%A9ra_rock)。左侧为本站中文场景介绍，按人物与当前情境组织。

## 曲目与时间

按原视频的章节及简介时间表建立 `mozart-2010-01` 至 `mozart-2010-22`：开场、21首歌曲，其中末两项保留群唱返场。本页曲目范围从一个章节开始到下一个章节开始，包含歌后的对白和舞台过渡；页面时长是整个舞台片段的时长。

完整录像长7252秒。原人工法语字幕文件共1779个时间段，跨曲目裁剪后合计1793段，作为原始时间资料保留。用户随后提供了本场完整的时间对应法语字幕：保留716个正文字幕块，去掉署名、曲名标记和复制附带的时间单位，整理为1911条四层学习内容，覆盖22页的歌词、对白和返场。

四层内容为法语原文、带联诵和连读标记的参考音标、中文空耳、中文释义。中文先作机器辅助翻译，再按人物、剧情和歌词修正788种不同短句，统一人名及作品名；所有句子均有中文释义。德语、英语和意大利语插句采用相应语言的参考读音。法语只修正明显的拼写和复制错误，原始字幕块文字仍保存在每条注释的 `suppliedText` 中。音标采用 eSpeak NG 词句读音，结合连读规则及人名读音修正，属于参考发音。

用户字幕里的曲名标记有几处比原视频章节早一到数秒；页面边界采用这些时间，保留提前出现的歌词，旧边界保存为 `originalPlaybackSegment`。同一字幕块内多句按音节长度分配时间，末尾结合原人工字幕文件保留无字幕间隔。新分句尚未逐句听音对齐，用 `≈` 标记近似切点。正文来源、时间校对和发音核对分别记录。

`data/mozart-study-import.json` 保存输入文件 SHA256、原文件名、22页的时间范围及数量；每条学习注释保留原行号、原时间块、原文和分句方式，方便继续听音校对。

## 演员

采用原视频简介列出的演员：Mikelangelo Loconte（莫扎特）、Claire Pérot（康斯坦丝）、Florent Mothe（萨列里）、Melissa Mars（阿洛伊西娅）、Solal（利奥波德）、Maeva Méline（南内尔）、Merwan Rim（小丑及旅店老板）、Yamin Dib（罗森伯格伯爵）、Estelle Micheau（女歌手）。其他年份的康斯坦丝演员不覆盖本场信息。

## 更新与检查

工作目录中的 `mozart_source.py` 读取公开视频信息，`mozart_resources.py` 读取字幕时间和唱片封面信息，`build_mozart_library.py` 建立独立路由并保存中文介绍。后续元数据更新保留已有人工学习内容，歌曲ID保持稳定。公开 `data/mozart-source.json` 保存曲目来源与数量，不含临时字幕下载链接。

四层导入使用 `scripts/import_mozart_study.py`。更新后运行 `npm run check`、`npm test` 和 `test_mozart_study.py`，检查文字与注释匹配、输入时间解析、章节边界及读音内容。浏览器逐页检查22页的四层卡片、原录像定位、暂停、循环、首句靠顶与后续居中；检查低矮窗口和手机的底部控制。沿用用户确认的字号和配色。
