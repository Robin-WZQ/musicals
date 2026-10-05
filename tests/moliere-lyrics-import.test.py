import importlib.util,json,sys,tempfile,unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import import_moliere_lyrics as importer

class LyricsImportTests(unittest.TestCase):
 def test_saved_source_archive_is_reused_for_multiple_songs(self):
  songs=[{'order':i+1,'title':'Mot','lines':[{'id':f'musical-0{i+1}-001','original':'bonjour','zh':'你好'}]} for i in range(2)]
  manifest={'tracks':[{'id':'x'},{'id':'y'}]}
  source={route:{'song':{'id':route,'duration':2,'playbackSegment':{'start':0},'cues':[{'start':0,'duration':2}]},'notes':{'entries':[{'sourceText':'bonjour','suppliedText':'bonjour','timing':{'sourceLineNumber':999}}]}} for route in ('x','y')}
  tracks=importer.prepare(songs,manifest,{},source)
  self.assertEqual([t['id'] for t in tracks],['x','y'])
  self.assertTrue(all(t['lines'][0]['start']==0 and t['lines'][0]['end']==2 for t in tracks))

 def test_supplied_json_rejects_executable_suffix_and_duplicate_ids(self):
  songs=json.loads((ROOT/'data/moliere-supplied-lyrics.json').read_text(encoding='utf-8'))['songs']
  with tempfile.TemporaryDirectory() as folder:
   path=Path(folder)/'songs.js';payload='window.songs='+json.dumps(songs)
   path.write_text(payload+';alert(1)',encoding='utf-8')
   with self.assertRaisesRegex(ValueError,'executable'):importer.supplied(path)
   songs[0]['lines'][1]['id']=songs[0]['lines'][0]['id']
   path.write_text('window.songs='+json.dumps(songs)+';',encoding='utf-8')
   with self.assertRaisesRegex(ValueError,'Duplicate'):importer.supplied(path)

 def test_joined_words_and_repeated_refrain_keep_monotonic_matches(self):
  mapping=importer.align(['aujourdhui','tout','va','bien','tout','va','bien'],['aujourd','hui','tout','va','bien','tout','va','bien'])
  self.assertEqual(mapping[0][1],1)
  self.assertEqual([mapping[i][0] for i in range(1,7)],list(range(2,8)))

 def test_trimming_intro_uses_original_input_and_leaves_dialogue_gap(self):
  song={'id':'x','cues':[{'start':1,'duration':10},{'start':20,'duration':15}]}
  notes={'entries':[{'sourceText':'Les autres','suppliedText':'bonjour vous les autres','timing':{'sourceLineNumber':876}},{'sourceText':'Lumière','suppliedText':'lumière','timing':{'sourceLineNumber':342}}]}
  words,points,owners,ranges=importer.source_words(song,notes)
  self.assertEqual(words,['les','autres','lumiere']);self.assertEqual(points[0],6)
  self.assertEqual(ranges[1]['end'],20.6)

 def test_supplied_and_reference_pronunciation_remain_separate(self):
  songs=[{'order':1,'id':'song','title':'T','titleZh':'歌','lines':[{'id':'musical-01-001','sourceLineIndex':1,'lineIndex':1,'original':"J'suis ici",'ipa':'original-reading','zh':'我在这里'}]}]
  from unittest.mock import patch
  with patch.object(importer,'corrected_reference',return_value=('[ʒə sɥiz‿isi]','热 随兹 伊西')) as reading:
   edition=importer.reviewed(songs,{}, {})
  reading.assert_called_once_with('Je suis ici',{})
  line=edition[0]['lines'][0];self.assertEqual(line['sourceIPA'],'original-reading');self.assertEqual(line['suppliedText'],"J'suis ici")

if __name__=='__main__':unittest.main()
