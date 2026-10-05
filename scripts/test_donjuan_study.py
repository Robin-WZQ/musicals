import unittest
from import_donjuan_study import import_pack,split_span
class ImportValidation(unittest.TestCase):
    def test_requires_all_ordered_pages_before_reading_or_writing(self):
        with self.assertRaisesRegex(ValueError,'41 ordered'):
            import_pack({'tracks':[{'id':'donjuan-02'}]}, {}, {},lambda t:t)
    def test_subdivision_retains_absolute_time_and_anchor_end(self):
        spans=split_span(['Aimer','Un jour dans tes bras'],100,107)
        self.assertEqual(spans[0][0],100)
        self.assertEqual(spans[-1][1],107)
        self.assertEqual(spans[0][1],spans[1][0])
        self.assertLess(spans[0][1]-100,spans[1][1]-spans[1][0])
if __name__=='__main__':unittest.main()
