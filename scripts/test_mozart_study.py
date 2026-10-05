import unittest
from import_mozart_study import parse_supplied,split_text,split_span
from import_notre_study import corrected_reference

class MozartImportTests(unittest.TestCase):
    def fixture(self):
        songs=[{'titleOriginal':f'Song {i}'} for i in range(22)]
        raw='0:066 secondes[ Sous-titres: credit ]\n'
        raw+='\n'.join(f'{i+1}:00{i+1} minutes# Song {i} # Bonjour.' for i in range(22))
        return raw,songs

    def test_ui_units_markers_and_source_line_retained(self):
        raw,songs=self.fixture();rows,markers,excluded=parse_supplied(raw,songs)
        self.assertEqual(len(rows),22);self.assertEqual(rows[0]['text'],'Bonjour.')
        self.assertEqual(rows[0]['start'],60);self.assertEqual(rows[0]['sourceLine'],2)
        self.assertEqual(markers[1],120);self.assertEqual(excluded[0]['kind'],'subtitle-credit')
        raw+='\n1:01:401 heure, 1 minute et 40 secondesBonsoir.'
        self.assertEqual(parse_supplied(raw,songs)[0][-1]['start'],3700)

    def test_repeated_or_reverse_times_rejected(self):
        raw,songs=self.fixture()
        with self.assertRaisesRegex(ValueError,'strictly increase'):parse_supplied(raw+'\n1:001 minuteSalut.',songs)

    def test_missing_chapter_rejected(self):
        raw,songs=self.fixture()
        with self.assertRaisesRegex(ValueError,'22'):parse_supplied(raw.replace('# Song 21 #',''),songs)

    def test_foreign_phrases_and_proper_names_not_split(self):
        self.assertEqual(split_text('Salut! Guten Tag, mein Herr! Bonsoir.'),['Salut!','Guten Tag, mein Herr!','Bonsoir.'])
        self.assertEqual(split_text('Wolfgang Amadeus Mozart. Je pars.'),['Wolfgang Amadeus Mozart.','Je pars.'])
        self.assertEqual(split_text('Elle aura mal Il faut partir'),['Elle aura mal','Il faut partir'])
        self.assertEqual(split_text('Les Viennois, votre public.'),['Les Viennois, votre public.'])

    def test_song_dialogue_boundary_and_spelling(self):
        self.assertEqual(split_text("Pour l'Histoire Wolfgang, tu vas attraper froid."),["Pour l'Histoire",'Wolfgang, tu vas attraper froid.'])
        self.assertEqual(split_text('Les cliches sonnent'),['Les cloches sonnent'])

    def test_subdivisions_cover_exact_anchor_interval(self):
        spans=split_span(['Tout','Une phrase beaucoup plus longue'],10,20)
        self.assertEqual(spans[0][0],10);self.assertEqual(spans[-1][1],20)
        self.assertEqual(spans[0][1],spans[1][0]);self.assertLess(spans[0][1]-10,20-spans[1][0])

    def test_preposition_liaison_kept_and_et_blocks_it(self):
        reference={'Sans un remords':'s ɑ̃ z | œ̃ | ʁ ə m ɔ ʁ','Sans':'s ɑ̃','un':'œ̃','remords':'ʁ ə m ɔ ʁ'}
        ipa,ear=corrected_reference('Sans un remords',reference)
        self.assertIn('sɑ̃z‿œ̃',ipa)
        reference={'dans et':'d ɑ̃ z | e','dans':'d ɑ̃','et':'e'}
        self.assertEqual(corrected_reference('dans et',reference)[0],'[dɑ̃ e]')

if __name__=='__main__':unittest.main()
