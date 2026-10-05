import unittest
from import_moliere_times import parse_times,intervals

class MoliereTimestampTests(unittest.TestCase):
    def test_reset_starts_next_video_and_duplicate_stays_in_same_video(self):
        groups=parse_times('0:000秒钟sample\n0:000秒钟sample\n0:088秒钟sample\n0:011秒钟sample\n0:055秒钟sample')
        self.assertEqual([[a['start'] for a in g] for g in groups],[[0,0,8],[1,5]])

    def test_duplicate_and_endpoint_have_no_zero_length_segments(self):
        ranges,duplicates,end_markers=intervals([{'start':s,'sourceLine':i+1} for i,s in enumerate([0,0,8,20])],20)
        self.assertEqual(ranges,[{'start':0,'duration':8},{'start':8,'duration':12}])
        self.assertEqual(duplicates,[2]);self.assertEqual(end_markers,[4])

    def test_out_of_range_and_decreasing_times_are_rejected(self):
        with self.assertRaises(ValueError):intervals([{'start':21,'sourceLine':1}],20)
        with self.assertRaises(ValueError):intervals([{'start':8,'sourceLine':1},{'start':2,'sourceLine':2}],20)

if __name__=='__main__':unittest.main()
