"""Offline validation; these tests do not establish device compatibility."""

from pathlib import Path
import unittest
import zipfile

from sysex_codec import (pack_7bit, unpack_7bit, build_program_dump,
                         build_program_request)


class CodecTests(unittest.TestCase):
    def test_known_high_bit_order(self):
        self.assertEqual(pack_7bit(bytes.fromhex('80 01 ff 7f 81 00 fe')),
                         bytes.fromhex('55 00 01 7f 7f 01 00 7e'))
        self.assertEqual(pack_7bit(b'\xff'), b'\x01\x7f')

    def test_all_byte_values_and_group_boundaries(self):
        for size in [0, 1, 6, 7, 8, 13, 14, 15, 255, 256, 1024]:
            raw = bytes(i % 256 for i in range(size))
            packed = pack_7bit(raw)
            self.assertEqual(len(packed), size + (size + 6) // 7)
            self.assertTrue(all(value < 128 for value in packed))
            self.assertEqual(unpack_7bit(packed), raw)

    def test_malformed_payloads(self):
        for payload in [b'\x80\x00', b'\x00', b'\x02\x00']:
            with self.assertRaises(ValueError):
                unpack_7bit(payload)

    def test_message_layout_with_synthetic_model(self):
        # Model bytes are deliberately synthetic; no device identity is claimed.
        model = b'\x12\x34'
        self.assertEqual(build_program_request(130, channel=2, model_bytes=model),
                         bytes.fromhex('f0 42 32 00 12 34 1c 02 01 f7'))
        program = b'PROG' + bytes(1020)
        message = build_program_dump(program, 130, channel=2, model_bytes=model)
        self.assertEqual(len(message), 1181)
        self.assertEqual(message[:9], bytes.fromhex('f0 42 32 00 12 34 4c 02 01'))
        self.assertEqual(message[-1], 0xf7)
        self.assertEqual(unpack_7bit(message[9:-1]), program)

    def test_user_exports(self):
        root = Path(__file__).resolve().parents[1]
        files = [root / name for name in ['Before.mnlgxdprog', 'After.mnlgxdprog',
                  'Cutoff0.mnlgxdprog', 'Cutoff1023.mnlgxdprog']]
        for path in files:
            with zipfile.ZipFile(path) as archive:
                raw = archive.read('Prog_000.prog_bin')
            packed = pack_7bit(raw)
            self.assertEqual(len(packed), 1171)
            self.assertEqual(unpack_7bit(packed), raw)
        # Independent endpoint expectations at group 8: offsets 56–62.
        with zipfile.ZipFile(files[2]) as a, zipfile.ZipFile(files[3]) as b:
            low, high = [pack_7bit(z.read('Prog_000.prog_bin')) for z in [a, b]]
        self.assertEqual(low[69:71], b'\x00\x00')
        self.assertEqual(high[69:71], b'\x7f\x03')
        self.assertEqual(high[64] ^ low[64], 1 << 4)


if __name__ == '__main__':
    unittest.main()
