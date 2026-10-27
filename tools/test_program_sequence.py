from pathlib import Path
import unittest
import zipfile

from program_sequence import decode_motion, decode_sequence, summarize_sequence


def fixture():
    record = bytearray(1024)
    record[:4] = b'PROG'
    record[156:162] = b'PREDSQ'
    record[162:166] = bytes.fromhex('01 80 b0 04')  # Steps 1/16, tempo 120.0.
    record[166:170] = bytes([16, 0, 75, 54])
    return record


class SequenceTests(unittest.TestCase):
    def test_headers_and_active_mask(self):
        record = fixture()
        result = decode_sequence(record)
        self.assertEqual(result['tempo_bpm'], 120)
        self.assertEqual([s['step'] for s in result['steps'] if s['active']], [1, 16])
        record[160:164] = b'SEQD'
        legacy = decode_sequence(record)
        self.assertTrue(all(s['active'] for s in legacy['steps']))
        self.assertEqual(legacy['active_mask_source'], 'legacy_implicit_all_on')
        self.assertEqual(record[160:164], b'SEQD')  # No implicit conversion/write.

    def test_last_step_boundaries_and_note_semantics(self):
        record = fixture()
        offset = 970  # 190 + 15 * 52; the record ends at 1021.
        record[offset] = 60
        record[offset + 8] = 100
        record[offset + 16] = 0xff  # Trigger plus tied gate.
        record[offset + 1] = 127  # Zero velocity means no event.
        record[170:172] = b'\x00\x80'
        record[1022:1024] = bytes([72, 10])
        seq = decode_sequence(record)
        self.assertEqual(seq['steps'][15]['file_offset'], 970)
        self.assertTrue(seq['steps'][15]['enabled'])
        notes = seq['steps'][15]['notes']
        self.assertEqual(notes[0]['note'], 60)
        self.assertTrue(notes[0]['has_event'] and notes[0]['trigger'] and notes[0]['tie'])
        self.assertFalse(notes[1]['has_event'])
        self.assertEqual(summarize_sequence(seq)['stored_note_events'], 1)
        self.assertEqual((seq['arp_gate_raw'], seq['arp_rate_raw']), (72, 10))

    def test_motion_bit_order_and_slot_flags(self):
        # Independent packed vector for values 0, 1, 2, 3, 1023.
        self.assertEqual(decode_motion(bytes.fromhex('00 00 00 00 ff e4 03')),
                         [0, 1, 2, 3, 1023])
        record = fixture()
        record[174:176] = bytes([3, 42])  # Motion, smooth, cutoff target.
        record[182:184] = b'\x01\x00'
        record[214:221] = bytes.fromhex('00 00 00 00 ff e4 03')
        seq = decode_sequence(record)
        self.assertTrue(seq['motion_slots'][0]['enabled'])
        self.assertTrue(seq['motion_slots'][0]['smooth'])
        self.assertEqual(seq['motion_slots'][0]['parameter_id'], 42)
        self.assertEqual(seq['motion_slots'][0]['parameter_name'], 'filter_cutoff')
        self.assertEqual(seq['steps'][0]['motion'][0]['values_raw'], [0, 1, 2, 3, 1023])
        self.assertTrue(seq['steps'][0]['motion'][0]['step_enabled'])
        record[175] = 124
        unknown = decode_sequence(record)['motion_slots'][0]
        self.assertEqual(unknown['parameter_id'], 124)
        self.assertIsNone(unknown['parameter_name'])
        self.assertFalse(unknown['parameter_id_known'])

    def test_unknown_header_and_invalid_lengths(self):
        record = fixture()
        record[160:164] = b'????'
        self.assertFalse(decode_sequence(record)['supported'])
        with self.assertRaises(ValueError):
            decode_sequence(record[:-1])
        with self.assertRaises(ValueError):
            decode_motion(bytes(6))

    def test_controlled_exports_preserve_sequence(self):
        root = Path(__file__).resolve().parents[1]
        sequences = []
        for name in ['Before', 'After', 'Cutoff0', 'Cutoff1023']:
            with zipfile.ZipFile(root / f'{name}.mnlgxdprog') as archive:
                sequences.append(decode_sequence(archive.read('Prog_000.prog_bin')))
        self.assertTrue(all(seq == sequences[0] for seq in sequences))
        self.assertEqual(sequences[0]['header'], 'SQ')
        self.assertEqual(sequences[0]['tempo_bpm'], 120)
        self.assertEqual(summarize_sequence(sequences[0])['stored_note_events'], 0)


if __name__ == '__main__':
    unittest.main()
