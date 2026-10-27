"""Read a minilogue xd library without extracting or modifying it.

Decodes raw synth settings and sequencer summaries in minilogue xd exports.
Use --sequencer for full stored note and motion events.
"""

import argparse
import collections
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

from program_parameters import (decode_parameters, parameter_warnings,
                                SPEC_URL, SPEC_SHA256)
from program_sequence import decode_sequence, summarize_sequence


def inspect(path, include_sequencer=False):
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)):
            raise ValueError('Duplicate ZIP member names')
        bad = archive.testzip()
        if bad:
            raise ValueError(f'ZIP CRC failure: {bad}')
        manifest = ET.fromstring(archive.read('FileInformation.xml'))
        product = manifest.findtext('Product', '').strip()
        if product != 'minilogue xd':
            raise ValueError(f'Unsupported product for xd parameter decoding: {product!r}')
        contents = manifest.find('Contents')
        if contents is None:
            raise ValueError('Missing Contents in manifest')
        programs = []
        for index, entry in enumerate(contents.findall('ProgramData')):
            binary_name = entry.findtext('ProgramBinary')
            info_name = entry.findtext('Information')
            binary = archive.read(binary_name)
            if len(binary) != 1024 or binary[:4] != b'PROG':
                raise ValueError(f'Unexpected program header/size: {binary_name}')
            info = ET.fromstring(archive.read(info_name))
            parameters = decode_parameters(binary)
            sequence = decode_sequence(binary)
            record = {
                'manifest_index': index,
                'display_position': index + 1,
                'binary_file': binary_name,
                'size': len(binary),
                'name': binary[4:16].split(b'\0', 1)[0].decode('ascii'),
                'filter_cutoff_raw': parameters['filter_cutoff'],
                'parameters_raw': parameters,
                'parameter_warnings': parameter_warnings(parameters),
                'sequencer_summary': summarize_sequence(sequence),
                'programmer': info.findtext('Programmer', ''),
                'comment': info.findtext('Comment', ''),
                'sha256': hashlib.sha256(binary).hexdigest(),
            }
            if include_sequencer:
                record['sequencer'] = sequence
            programs.append(record)
        declared = int(contents.attrib['NumProgramData'])
        if declared != len(programs):
            raise ValueError('Declared program count differs from manifest entries')
        favorites = []
        for entry in contents.findall('FavoriteData'):
            root = ET.fromstring(archive.read(entry.findtext('File')))
            favorites.append([[int(item.text) for item in bank.findall('Data')]
                              for bank in root.findall('Bank')])
        return {
            'source': str(path.resolve()),
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'product': product,
            'parameter_mapping': {
                'source': SPEC_URL,
                'source_sha256': SPEC_SHA256,
                'section': 'Table 2; revision 1.01, 2020-02-10',
                'byte_order': 'little-endian, checked against supplied exports',
                'units': 'raw stored integers; not synth display values or physical units',
                'controlled_export_validation': ['filter_cutoff'],
            },
            'zip_crc_valid': True,
            'member_count': len(names),
            'member_suffix_counts': dict(collections.Counter(
                name.rsplit('.', 1)[-1] for name in names)),
            'declared_contents': contents.attrib,
            'program_count': len(programs),
            'unique_program_binaries': len({p['sha256'] for p in programs}),
            'favorites_raw': favorites,
            'programs': programs,
            'limitations': [
                'Name offset 4 and width 12 are inferred from this sample.',
                'Display position is manifest order plus one; hardware mapping is unverified.',
                'Favorite values preserve raw XML integers; numbering base is unverified.',
                'Raw fields use published offsets; only cutoff has controlled-export validation.',
                'Enum/display conversions and tuning tables are not decoded.',
                'Sequencer events describe stored data, not predicted playback; swing remains raw.',
            ],
        }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('library', type=Path)
    parser.add_argument('--sequencer', action='store_true', help='include all stored note and motion events')
    args = parser.parse_args()
    print(json.dumps(inspect(args.library, args.sequencer), indent=2, ensure_ascii=False))
