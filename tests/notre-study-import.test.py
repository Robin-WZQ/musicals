import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from import_notre_study import align, corrected_reference, load_supplied, split_span


class NotreImportTests(unittest.TestCase):
    def test_assignment_is_data_and_cannot_execute_javascript(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
            path = Path(directory) / 'songs.js'
            path.write_text('window.songs=[];alert("execute");', encoding='utf-8')
            with self.assertRaises(ValueError):
                load_supplied(path)

    def test_merged_caption_keeps_its_year_with_the_opening_three_lines(self):
        lines = [{'en': s} for s in ["It's a story that takes place", 'Beautiful Paris in the year of God', 'One thousand four hundred and eighty-two', 'Story of love and desire']]
        anchors = [{'text': 'This is a story that takes place in fair Paris in the year of our Lord 1 482'}, {'text': 'A story of love and desire'}]
        matches = align(lines, anchors)
        self.assertEqual([(m[1], m[2], m[3]) for m in matches], [(0, 3, 0), (3, 4, 1)])

    def test_plural_noun_does_not_gain_a_liaison_z(self):
        text = 'Les artistes anonymes'
        reference = {text: 'l e z | a ʁ t i s t z | a n o n i m', 'Les': 'l e', 'artistes': 'a ʁ t i s t', 'anonymes': 'a n o n i m'}
        ipa, ear = corrected_reference(text, reference)
        self.assertEqual(ipa, '[lez‿aʁtist‿anonim]')
        self.assertNotIn('兹', ear.split()[1])

    def test_no_inserted_consonant_before_et(self):
        text = 'Poètes et artistes'
        reference = {text: 'p ɔ ɛ t z | e | a ʁ t i s t', 'Poètes': 'p ɔ ɛ t', 'et': 'e', 'artistes': 'a ʁ t i s t'}
        self.assertEqual(corrected_reference(text, reference)[0], '[pɔɛt e aʁtist]')

    def test_est_une_retains_the_actual_liaison(self):
        text = "C'est une histoire"
        reference = {text: 's ɛ t | y n | i s t w a ʁ', "C'est": 's ɛ', 'une': 'y n', 'histoire': 'i s t w a ʁ'}
        self.assertEqual(corrected_reference(text, reference)[0], '[sɛt‿yn‿istwaʁ]')

    def test_span_split_preserves_anchor_ends_and_never_overlaps(self):
        times = split_span([{'ipa': '/a/'}, {'ipa': '/ae/'}, {'ipa': '/aei/'}], 100, 106)
        self.assertEqual(times, [(100, 101), (101, 103), (103, 106)])

    def test_compound_number_keeps_its_pronounced_t(self):
        text = 'Vingt deux'
        reference = {text: 'v ɛ̃ t | d ø', 'Vingt': 'v ɛ̃', 'deux': 'd ø'}
        self.assertEqual(corrected_reference(text, reference)[0], '[vɛ̃t dø]')

    def test_vowel_initial_words_with_glides_show_their_liaison(self):
        text = 'Mes yeux'
        reference = {text: 'm e z | j ø', 'Mes': 'm e', 'yeux': 'j ø'}
        self.assertEqual(corrected_reference(text, reference)[0], '[mez‿jø]')


if __name__ == '__main__':
    unittest.main()
