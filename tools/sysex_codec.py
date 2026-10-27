"""Offline SysEx helpers reconstructed from Sound Librarian 1.0.5.

No MIDI ports are opened. Model bytes are explicit because target selection
has not yet been traced. Channel and program index use zero-based integers.
"""


def pack_7bit(data: bytes) -> bytes:
    """Put each group's high bits in a leading byte, bit 0 first."""
    result = bytearray()
    for start in range(0, len(data), 7):
        group = data[start:start + 7]
        result.append(sum(((value >> 7) & 1) << i
                          for i, value in enumerate(group)))
        result.extend(value & 0x7f for value in group)
    return bytes(result)


def unpack_7bit(data: bytes) -> bytes:
    """Inverse codec; reject malformed or noncanonical MIDI payloads."""
    if any(value > 0x7f for value in data):
        raise ValueError('Packed payload contains an eight-bit byte')
    result = bytearray()
    for start in range(0, len(data), 8):
        group = data[start:start + 8]
        count = len(group) - 1
        if count == 0:
            raise ValueError('High-bit prefix has no data bytes')
        if group[0] >> count:
            raise ValueError('Unused high-bit prefix bits must be zero')
        result.extend(value | (((group[0] >> i) & 1) << 7)
                      for i, value in enumerate(group[1:]))
    return bytes(result)


def _header(channel: int, model_bytes: bytes, command: int) -> bytes:
    if not 0 <= channel <= 15:
        raise ValueError('Channel must be 0–15')
    if len(model_bytes) != 2 or any(value > 127 for value in model_bytes):
        raise ValueError('Supply two MIDI-safe model bytes in wire order')
    return bytes([0xf0, 0x42, 0x30 | channel, 0]) + model_bytes + bytes([command])


def _index(index: int) -> bytes:
    if not 0 <= index <= 0x3fff:
        raise ValueError('Program index must fit 14 bits')
    return bytes([index & 0x7f, (index >> 7) & 0x7f])


def build_program_request(index: int, *, channel: int, model_bytes: bytes) -> bytes:
    """Command 0x1C, as constructed by sub_10005d152; slot range unverified."""
    return _header(channel, model_bytes, 0x1c) + _index(index) + b'\xf7'


def build_program_dump(program: bytes, index: int, *, channel: int,
                       model_bytes: bytes) -> bytes:
    """Reconstruct sub_10005d3d6's 1,181-byte command 0x4C message."""
    if len(program) != 1024 or program[:4] != b'PROG':
        raise ValueError('Expected a 1,024-byte PROG record')
    return (_header(channel, model_bytes, 0x4c) + _index(index)
            + pack_7bit(program) + b'\xf7')
