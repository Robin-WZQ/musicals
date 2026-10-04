"""Reference French pronunciation and approximate Chinese sound hints."""
import re

vowels = ['a', 'ɑ', 'ɛ', 'e', 'i', 'ɔ', 'o', 'u', 'y', 'ə', 'œ', 'ø', 'ɑ̃', 'ɛ̃', 'ɔ̃', 'œ̃']
base = ['阿', '阿', '艾', '诶', '伊', '哦', '奥', '乌', '于', '呃', '厄', '厄', '昂', '安', '翁', '恩']
cv = {'p': ['帕', '帕', '佩', '佩', '皮', '珀', '波', '普', '普于', '珀', '珀厄', '珀厄', '庞', '潘', '蓬', '潘'], 'b': ['巴', '巴', '贝', '贝', '比', '博', '博', '布', '比于', '伯', '伯厄', '伯厄', '邦', '班', '崩', '班'], 't': ['塔', '塔', '泰', '特', '蒂', '托', '托', '图', '蒂于', '特', '特厄', '特厄', '唐', '坦', '通', '坦'], 'd': ['达', '达', '戴', '德', '迪', '多', '多', '杜', '迪于', '德', '德厄', '德厄', '当', '丹', '东', '丹'], 'k': ['卡', '卡', '凯', '克', '基', '科', '科', '库', '基于', '克', '克厄', '克厄', '康', '坎', '孔', '坎'], 'ɡ': ['嘎', '嘎', '盖', '格', '吉', '果', '戈', '古', '吉于', '格', '格厄', '格厄', '冈', '干', '贡', '干'], 'f': ['法', '法', '费', '费', '菲', '佛', '佛', '富', '菲于', '弗', '弗厄', '弗厄', '芳', '凡', '丰', '凡'], 'v': ['瓦', '瓦', '韦', '韦', '维', '沃', '沃', '乌', '维于', '弗', '弗厄', '弗厄', '旺', '万', '翁', '万'], 's': ['萨', '萨', '塞', '塞', '西', '索', '索', '苏', '西于', '瑟', '瑟厄', '瑟厄', '桑', '森', '松', '森'], 'z': ['扎', '扎', '泽', '泽', '齐', '佐', '佐', '祖', '齐于', '泽', '泽厄', '泽厄', '赞', '赞', '宗', '赞'], 'ʃ': ['沙', '沙', '谢', '谢', '希', '肖', '肖', '舒', '许', '舍', '舍厄', '舍厄', '尚', '山', '雄', '山'], 'ʒ': ['扎', '扎', '热', '热', '日', '若', '若', '茹', '日于', '热', '热厄', '热厄', '让', '然', '戎', '然'], 'm': ['玛', '玛', '梅', '梅', '米', '莫', '莫', '穆', '米于', '默', '默厄', '默厄', '芒', '曼', '蒙', '曼'], 'n': ['纳', '纳', '奈', '内', '尼', '诺', '诺', '努', '尼于', '讷', '讷厄', '讷厄', '南', '南', '农', '南'], 'l': ['拉', '拉', '莱', '莱', '利', '洛', '洛', '卢', '吕', '勒', '勒厄', '勒厄', '朗', '兰', '隆', '兰'], 'ʁ': ['哈', '哈', '赫', '赫', '希', '霍', '霍', '胡', '许', '赫', '赫厄', '赫厄', '杭', '汉', '洪', '汉']}
cons = {'p': '普', 'b': '布', 't': '特', 'd': '德', 'k': '克', 'ɡ': '格', 'f': '弗', 'v': '弗', 's': '斯', 'z': '兹', 'ʃ': '什', 'ʒ': '日', 'm': '姆', 'n': '恩', 'l': '勒', 'ʁ': '赫', 'j': '耶', 'w': '乌', 'ɥ': '于', 'ɲ': '涅', 'ŋ': '恩'}

def ear_word(phones):
    out = []
    i = 0
    while i < len(phones):
        c = phones[i]
        if c in cv and i + 1 < len(phones) and (phones[i + 1] in vowels):
            out.append(cv[c][vowels.index(phones[i + 1])])
            i += 2
        else:
            out.append(dict(zip(vowels, base)).get(c, cons.get(c, c)))
            i += 1
    return ''.join(out)


def annotate(text, raw):
    """Mark only connected boundaries identifiable in the supplied phrase reading."""
    raw = re.sub(r'[ːˑˈˌ]', '', raw)
    words = [w.strip().split() for w in raw.split('|') if w.strip()]
    tokens = list(re.finditer(r"[A-Za-zÀ-ÿŒœ]+(?:['’-][A-Za-zÀ-ÿŒœ]+)*", text))
    parts = []
    for i, phones in enumerate(words):
        parts.append(''.join(phones))
        if i + 1 < len(words):
            mark = ' '
            if len(tokens) == len(words):
                nxt = tokens[i + 1].group().lower()
                vowel_initial = nxt[0] in 'aàâäeéèêëiîïoôöuùûüyÿœ'
                punctuation = re.search(r'[,.;:!?…]', text[tokens[i].end():tokens[i + 1].start()])
                if vowel_initial and nxt != 'et' and not punctuation and phones and words[i + 1] and phones[-1] in cons and words[i + 1][0] in vowels:
                    mark = '‿'
            parts.append(mark)
    unknown = {p for word in words for p in word if p not in vowels and p not in cons}
    if unknown:
        raise ValueError('Unmapped pronunciation symbols: ' + ', '.join(sorted(unknown)))
    return '[' + ''.join(parts) + ']', ' '.join(ear_word(w) for w in words)


def pronunciation_map(texts):
    from phonemizer import phonemize
    from phonemizer.backend.espeak.wrapper import EspeakWrapper
    from phonemizer.separator import Separator
    import espeakng_loader
    import shutil
    import tempfile
    from pathlib import Path
    # The speech library needs an ASCII data path on Windows.
    data = Path(tempfile.gettempdir()) / 'musicals-espeak-data'
    shutil.copytree(espeakng_loader.get_data_path(), data / 'espeak-ng-data', dirs_exist_ok=True)
    EspeakWrapper.set_library(espeakng_loader.get_library_path())
    EspeakWrapper.set_data_path(str(data))
    texts = list(dict.fromkeys(texts))
    raw = phonemize(texts, language='fr-fr', separator=Separator(phone=' ',word=' | '),strip=True)
    if len(raw) != len(texts):
        raise ValueError('Pronunciation result count differs from caption count')
    return {text: annotate(text, phones) for text, phones in zip(texts, raw)}
