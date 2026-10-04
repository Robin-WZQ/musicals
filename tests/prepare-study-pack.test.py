import unittest
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from prepare_study_pack import align_meanings,slice_track
from pronunciation import annotate

class StudyPackTests(unittest.TestCase):
    def test_chinese_alignment_requires_actual_chinese(self):
        cues=[{'start':71,'end':74,'text':'Bonjour.'}]
        with self.assertRaises(ValueError):align_meanings(cues,[])
        with self.assertRaises(ValueError):align_meanings(cues,[{'start':71,'end':74,'text':'Hello.'}])
        self.assertEqual(align_meanings(cues,[{'start':71,'end':74,'text':'你好。'}])[0]['studyMeaning'],'你好。')
    def test_song_slicing_assigns_boundary_line_once_and_caps_end(self):
        cues=[{'start':99,'end':104,'text':'Before'},{'start':106,'end':111,'text':'Inside'}]
        rows=slice_track(cues,{'playbackSegment':{'start':100,'end':110}})
        self.assertEqual([(r['start'],r['end']) for r in rows],[(106,110)])
    def test_connected_reference_marks_safe_boundaries_only(self):
        ipa,ear=annotate('les amis','l e z | a m i')
        self.assertEqual(ipa,'[lez‿ami]');self.assertRegex(ear,r'[\u3400-\u9fff]')
        self.assertNotIn('‿',annotate('les, amis','l e z | a m i')[0])
        self.assertNotIn('‿',annotate('les héros','l e | e ʁ o')[0])
        self.assertNotIn('‿',annotate('toi et moi','t w a | e | m w a')[0])
        with self.assertRaises(ValueError):annotate('unknown','θ')

if __name__=='__main__':unittest.main()
