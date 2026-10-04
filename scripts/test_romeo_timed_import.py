import unittest
from import_romeo_timed import parse_transcript,clean_text,spoken_text,split_anchor

class RomeoTimedImport(unittest.TestCase):
    def test_copied_youtube_timestamps(self):
        rows=parse_transcript('Vérone\n0:4141 secondesUne phrase.\n1:211 minute et 21 secondesUne autre.\nSynchroniser avec la vidéo')
        self.assertEqual(len(rows),2);self.assertEqual(rows[1]['text'],'Une autre.')

    def test_all_time_formats(self):
        rows=parse_transcript('0:4141 secondesUne phrase.\n1:001 minuteUne autre.\n2:21:002 heures et 21 minutesAimer\n2:21:052 heures, 21 minutes et 5 secondesEncore.')
        self.assertEqual([r['start'] for r in rows],[41,60,8460,8465])
        self.assertEqual([r['text'] for r in rows],['Une phrase.','Une autre.','Aimer','Encore.'])

    def test_labels_and_spelling(self):
        self.assertEqual(clean_text('Capulet :'),'')
        self.assertEqual(clean_text('Romeo : Juliette !'),'Juliette !')
        self.assertEqual(clean_text('Être haït et trahi'),'Être haï et trahi')
        self.assertEqual(clean_text('«'),'')
        self.assertEqual(clean_text("C'est pas ma faute (x2)"),"C'est pas ma faute")

    def test_reference_reading_preserves_display(self):
        self.assertEqual(spoken_text("Avoir 20 ans"),'Avoir vingt ans')
        self.assertEqual(spoken_text("Je m'croyais fort"),'Je me croyais fort')

    def test_subdivision_keeps_anchor_bounds(self):
        spans=split_anchor([{'text':'Aimer'},{'text':'C’est ce qu’il y a de plus beau'}],100,108)
        self.assertEqual(spans[0][0],100);self.assertEqual(spans[-1][1],108)
        self.assertEqual(spans[0][1],spans[1][0]);self.assertGreater(spans[1][1]-spans[1][0],spans[0][1]-spans[0][0])

    def test_reject_duplicate_or_backwards_anchors(self):
        with self.assertRaises(ValueError):parse_transcript('1:001 minuteA\n0:4141 secondesB')

if __name__=='__main__':unittest.main()
