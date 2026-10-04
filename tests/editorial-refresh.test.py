import unittest
import importlib.util
import json
import tempfile
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('ingest', Path(__file__).parents[1] / 'scripts/ingest_youtube.py')
ingest = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ingest)

class EditorialRefreshTests(unittest.TestCase):
    def setUp(self):
        self.previous = {'id':'original-id', 'captionSource':'editorial', 'playbackVideoId':'replacement-id',
                         'captionStatus':'ready', 'cues':[{'text':'Corrected French', 'start':8, 'duration':3}],
                         'sourceCues':[{'text':'old asr'}], 'timingReviewStatus':'approximate'}

    def test_success_archives_asr_without_destroying_learning_text_or_replacement(self):
        fresh = {'captionStatus':'ready','captionLanguage':'fr','cues':[{'text':'new asr','start':2,'duration':2}]}
        result = ingest.protect_editorial(self.previous, fresh, 'today')
        self.assertEqual(result['cues'], self.previous['cues'])
        self.assertEqual(result['playbackVideoId'], 'replacement-id')
        self.assertEqual(result['captionSource'], 'editorial')
        self.assertEqual(result['sourceCues'], fresh['cues'])
        self.assertEqual(self.previous['sourceCues'], [{'text':'old asr'}])

    def test_failure_preserves_both_the_original_source_and_reviewed_cues(self):
        result = ingest.protect_editorial(self.previous, {'captionStatus':'error','captionError':'429'}, 'today')
        self.assertEqual(result['sourceCues'], self.previous['sourceCues'])
        self.assertEqual(result['cues'], self.previous['cues'])
        self.assertEqual(result['captionStatus'], 'ready')
        self.assertEqual(result['sourceRefreshError'], '429')

    def test_uncorrected_song_can_still_receive_normal_caption_refresh(self):
        self.assertIsNone(ingest.protect_editorial({'captionSource':'youtube'}, {'captionStatus':'ready'}, 'today'))

    def test_external_song_refresh_reads_metadata_without_requesting_or_storing_lyrics(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as directory:
            root = Path(directory); path = root / 'data' / 'songs' / 'AAAAAAAAAAA.json'
            self.assertTrue(root.resolve().is_relative_to(Path(__file__).resolve().parent))
            path.parent.mkdir(parents=True)
            previous = {'id':'AAAAAAAAAAA','lyricsStorage':'external','captionSource':'youtube-player',
                        'captionStatus':'native','playbackVideoId':'BBBBBBBBBBB','cues':[],
                        'duration':40,'playbackSegment':{'start':100,'end':140},'nativeCaptionRanges':[{'start':102,'duration':3}]}
            path.write_text(json.dumps(previous), encoding='utf-8')
            with patch.object(ingest, 'ROOT', root), \
                 patch.object(ingest, 'metadata', return_value=({'id':'BBBBBBBBBBB','title':'Source title','duration':8000}, {})) as metadata, \
                 patch.object(ingest, 'fetch_captions') as captions:
                ingest.ingest('AAAAAAAAAAA', 'fr', 'zh-Hans')
            captions.assert_not_called()
            self.assertEqual(metadata.call_args.args[0], 'BBBBBBBBBBB')
            result = json.loads(path.read_text(encoding='utf-8'))
            self.assertEqual(result['cues'], [])
            self.assertEqual(result['captionStatus'], 'native')
            self.assertEqual(result['playbackVideoId'], 'BBBBBBBBBBB')
            self.assertEqual(result['id'], 'AAAAAAAAAAA')
            self.assertEqual(result['duration'], 40)
            self.assertEqual(result['sourceDuration'], 8000)
            self.assertEqual(result['playbackSegment'], previous['playbackSegment'])
            self.assertEqual(result['nativeCaptionRanges'], previous['nativeCaptionRanges'])

if __name__ == '__main__':
    unittest.main()
