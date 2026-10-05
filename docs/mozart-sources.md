# 摇滚莫扎特：2010年巴黎录像

- 播放来源：[用户指定的完整录像](https://www.youtube.com/watch?v=83Qn2IvP_-I)，Hartwin 上传。简介标注 `Complete live in Paris, 2010`，上传日期为2016年10月4日。演出年份按上传者简介记录；作品首演年份为2009年。
- [作品首演与剧场资料](https://www.artcena.fr/agendas/spectacles/mozart-lopera-rock-2009)、[演出介绍](https://www.theatreonline.com/Spectacle/Mozart-l-opera-rock/32053)。
- [封面所用唱片](https://music.apple.com/fr/album/331386305)、[唱片曲目与演唱者](https://music.apple.com/us/album/393791485)。封面专辑年份为2009年，独立于录像年份。
- [舞台剧情与角色对照](https://fr.wikipedia.org/wiki/Mozart,_l%27op%C3%A9ra_rock)。左侧为本站中文场景介绍，按人物与当前情境组织。

## 曲目与时间

按原视频的章节及简介时间表建立 `mozart-2010-01` 至 `mozart-2010-22`：开场、21首歌曲，其中末两项保留群唱返场。本页曲目范围从一个章节开始到下一个章节开始，包含歌后的对白和舞台过渡；页面时长是整个舞台片段的时长。

完整录像长7252秒。人工法语字幕文件读取成功，共1779个时间段；只将开始和持续时间接入网站，字幕文字在 YouTube 播放器显示。相同起点合并，重叠片段按下一条起点截断；跨曲目字幕分别裁剪，故22页合计1793段。使用字幕文件中的毫秒时间，不套用整秒转录面板分段。保留无字幕的间隔。

本场人工字幕为法语，另有英语与意大利语。本站未完成法语文字校对、原唱逐音核对或音标、空耳、中文释义；元数据分别记录状态，不以时间精度代表内容校对完成。

## 演员

采用原视频简介列出的演员：Mikelangelo Loconte（莫扎特）、Claire Pérot（康斯坦丝）、Florent Mothe（萨列里）、Melissa Mars（阿洛伊西娅）、Solal（利奥波德）、Maeva Méline（南内尔）、Merwan Rim（小丑及旅店老板）、Yamin Dib（罗森伯格伯爵）、Estelle Micheau（女歌手）。其他年份的康斯坦丝演员不覆盖本场信息。

## 更新与检查

工作目录中的 `mozart_source.py` 读取公开视频信息，`mozart_resources.py` 读取字幕时间和唱片封面信息，`build_mozart_library.py` 建立独立路由并保存中文介绍。后续元数据更新保留已有人工学习内容，歌曲ID保持稳定。公开 `data/mozart-source.json` 保存曲目来源与数量，不含临时字幕下载链接。

新增曲库后运行 `npm run check`、`npm test`，检查章节衔接、字幕边界、实际播放来源、三层导航和窄屏底部控制。原有四部音乐剧的数据与用户确认的字号沿用。
