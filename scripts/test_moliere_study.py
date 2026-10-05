import unittest
from import_moliere_study import make_entries, spoken_text

class ImportValidation(unittest.TestCase):
    def test_invalid_interval_is_rejected_before_pronunciation(self):
        part={'duration':10,'trackNumber':1,'blocks':[{'start':5,'end':5,'text':'Bonjour','sourceLine':1}]}
        with self.assertRaisesRegex(ValueError,'interval'):make_entries(part,{}, {})

    def test_missing_chinese_is_rejected(self):
        part={'duration':10,'trackNumber':1,'blocks':[{'start':0,'end':5,'text':'Bonjour','sourceLine':1}]}
        with self.assertRaisesRegex(ValueError,'Chinese'):make_entries(part,{'1':'Hello'}, {})

    def test_overlap_is_rejected(self):
        block={'start':0,'end':6,'text':'Bonjour','sourceLine':1,'suppliedText':'bonjour'}
        part={'duration':10,'trackNumber':1,'blocks':[block,{**block,'start':5,'end':9}]}
        with self.assertRaisesRegex(ValueError,'overlapping'):make_entries(part,{'1':'你好'}, {'Bonjour':'b ɔ̃ ʒ u ʁ'})

    def test_actual_source_time_and_original_text_survive(self):
        part={'duration':10,'trackNumber':1,'blocks':[{'start':2,'end':8,'text':'Bonjour','sourceLine':14,'suppliedText':'bonjour'}]}
        cues,notes=make_entries(part,{'14':'你好'}, {'Bonjour':'b ɔ̃ ʒ u ʁ'})
        self.assertEqual(cues,[{'text':'Bonjour','start':2,'duration':6}])
        self.assertEqual(notes[0]['suppliedText'],'bonjour')
        self.assertEqual(notes[0]['timing']['sourceLineNumber'],14)

    def test_reference_numbers_are_pronounced_without_changing_source_text(self):
        self.assertEqual(spoken_text('Louis XIV et 300 livres'),'Louis quatorze et trois cents livres')

if __name__=='__main__':unittest.main()
