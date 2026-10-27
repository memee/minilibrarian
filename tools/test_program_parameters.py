"""Tests anchored to the user's controlled exports and observed data bytes."""

from pathlib import Path
import tempfile
import unittest
import zipfile

from inspect_library import inspect
from program_parameters import decode_parameters, parameter_warnings

ROOT = Path(__file__).resolve().parents[1]


class ProgramParameterTests(unittest.TestCase):
    def read_export(self, name):
        with zipfile.ZipFile(ROOT / name) as archive:
            return archive.read('Prog_000.prog_bin')

    def test_controlled_cutoff_changes_only(self):
        before = decode_parameters(self.read_export('Before.mnlgxdprog'))
        self.assertEqual(before['filter_cutoff'], 640)
        for filename, expected in [('After.mnlgxdprog', 614),
                                   ('Cutoff0.mnlgxdprog', 0),
                                   ('Cutoff1023.mnlgxdprog', 1023)]:
            with self.subTest(filename=filename):
                after = decode_parameters(self.read_export(filename))
                changed = {name: value for name, value in after.items()
                           if value != before[name]}
                self.assertEqual(changed, {'filter_cutoff': expected})
                self.assertEqual(parameter_warnings(after), parameter_warnings(before))

    def test_square_lpg_observed_values(self):
        values = decode_parameters(self.read_export('Before.mnlgxdprog'))
        # Independently read from this fixture's bytes at documented offsets.
        expected = {'vco1_level': 157, 'vco2_level': 3, 'multi_level': 1023,
                    'filter_resonance': 159, 'amp_eg_attack': 0,
                    'amp_eg_decay': 130, 'amp_eg_sustain': 0,
                    'amp_eg_release': 319, 'eg_attack': 0, 'eg_decay': 350,
                    'lfo_rate': 680, 'lfo_intensity': 512}
        for name, value in expected.items():
            self.assertEqual(values[name], value, name)

    def test_reject_malformed_record(self):
        for record in [b'', b'PROG', b'FAIL' + bytes(1020)]:
            with self.assertRaises(ValueError):
                decode_parameters(record)

    def test_invalid_value_is_preserved_and_reported(self):
        record = bytearray(self.read_export('Before.mnlgxdprog'))
        baseline = parameter_warnings(decode_parameters(record))
        record[60:62] = b'\xff\xff'
        values = decode_parameters(record)
        self.assertEqual(values['filter_cutoff'], 65535)
        self.assertEqual(len(parameter_warnings(values)), len(baseline) + 1)
        self.assertTrue(any('filter_cutoff' in warning for warning in parameter_warnings(values)))

    def test_user_parameter_types_have_distinct_byte_locations(self):
        record = bytearray(self.read_export('Before.mnlgxdprog'))
        record[148:150] = bytes([0b00000110, 0b11100100])
        result = decode_parameters(record)
        self.assertEqual([result[f'user_parameter_{i}_type'] for i in range(1, 7)],
                         [0, 1, 2, 3, 2, 1])
        self.assertTrue(any('undocumented type code 3' in w for w in parameter_warnings(result)))

    def test_inspector_refuses_other_product_layout(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'other.mnlgxdprog'
            with zipfile.ZipFile(path, 'w') as archive:
                archive.writestr('FileInformation.xml',
                    '<KorgMSLibrarian_Data><Product>prologue</Product>'
                    '<Contents NumProgramData="0"/></KorgMSLibrarian_Data>')
            with self.assertRaisesRegex(ValueError, 'Unsupported product'):
                inspect(path)


if __name__ == '__main__':
    unittest.main()
