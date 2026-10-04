# 本地四层字幕制作

最终页面沿用法语、联诵音标、中文空耳、中文释义四层卡片。本工具处理用户提供的字幕文件，不抓取外站歌词，也不自动发布。

输入使用与 `3AnTqOIgPr0` 同一录像的完整时间轴。支持法语 VTT、SRT、JSON；中文可放在 JSON 的 `translation` 或 `studyMeaning` 中，也可提供时间对应的中文字幕文件。

```sh
pip install -r scripts/study-requirements.txt
python scripts/prepare_study_pack.py --captions my-french.vtt --chinese my-chinese.srt --output local-study
```

输出 `study-pack.json` 供任一对应曲目页导入，另输出有字幕覆盖的每曲文件。完整包使用 `timebase: source`，网页按本曲范围显示；单曲包同时校验路由和录像来源。

`ipa` 与 `ear` 已提供时原样保留；缺少时使用 eSpeak NG 生成参考法语读法和中文近似发音。`‿` 只标注可从词边界确认的连读；标点、未知词边界及 h 开头词不自动加标记。参考读法需要结合原唱核对，不能当成逐音听写。中文释义必须来自输入中的中文内容；缺失时工具报告时间点并停止，不用英文或空白占位。

生成包留在指定本地目录，工具不会更改作品曲库状态。完整法语文字、中文译文、演唱连读与音频边界校对完成后，再按网站原有内容流程整理。
