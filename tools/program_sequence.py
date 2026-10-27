"""Read sequencer records using Korg rev. 1.01 Table 2 and notes S1–S4.

Decode stored events, not predicted playback. Legacy SEQD files have implicit
active-step flags. Swing and arpeggiator settings remain raw.
"""

MOTION_PARAMETERS = {
    0: None, 15: 'portamento', 16: 'voice_mode_depth', 17: 'voice_mode_type',
    18: 'vco1_wave', 19: 'vco1_octave', 20: 'vco1_pitch', 21: 'vco1_shape',
    22: 'vco2_wave', 23: 'vco2_octave', 24: 'vco2_pitch', 25: 'vco2_shape',
    26: 'sync', 27: 'ring', 28: 'cross_mod_depth', 29: 'multi_type',
    30: 'noise_type', 31: 'vpm_type', 33: 'noise_shape', 34: 'vpm_shape',
    35: 'user_shape', 36: 'noise_shift_shape', 37: 'vpm_shift_shape',
    38: 'user_shift_shape', 39: 'vco1_level', 40: 'vco2_level',
    41: 'multi_level', 42: 'filter_cutoff', 43: 'filter_resonance',
    45: 'filter_keyboard_tracking', 46: 'amp_eg_attack', 47: 'amp_eg_decay',
    48: 'amp_eg_sustain', 49: 'amp_eg_release', 50: 'eg_attack',
    51: 'eg_decay', 52: 'eg_intensity', 53: 'eg_target', 54: 'lfo_wave',
    55: 'lfo_mode', 56: 'lfo_rate', 57: 'lfo_intensity', 58: 'lfo_target',
    59: 'mod_fx_enabled', 66: 'mod_fx_time', 67: 'mod_fx_depth',
    68: 'delay_enabled', 70: 'delay_time', 71: 'delay_depth',
    72: 'reverb_enabled', 74: 'reverb_time', 75: 'reverb_depth',
    126: 'pitch_bend', 129: 'gate_time',
}


def _u16(data, offset):
    return int.from_bytes(data[offset:offset + 2], 'little')


def decode_motion(data):
    if len(data) != 7:
        raise ValueError('Motion record must contain seven bytes')
    low_bits = data[5] | (data[6] << 8)
    return [(data[i] << 2) | ((low_bits >> (2 * i)) & 3) for i in range(5)]


def decode_sequence(program):
    if len(program) != 1024 or program[:4] != b'PROG':
        raise ValueError('Expected a 1,024-byte PROG record')
    if program[160:164] == b'SEQD':
        header, active_mask = 'SEQD', 0xffff
    elif program[160:162] == b'SQ':
        header, active_mask = 'SQ', _u16(program, 162)
    else:
        return {'supported': False, 'header_hex': program[160:164].hex(),
                'warnings': ['Unrecognized sequencer header; events were not decoded']}
    enabled_mask, motion_mask = _u16(program, 170), _u16(program, 172)
    warnings = []
    tempo_raw, length, resolution = _u16(program, 164), program[166], program[167]
    if not 100 <= tempo_raw <= 3000:
        warnings.append(f'Tempo {tempo_raw} is outside documented range 100–3000')
    if not 1 <= length <= 16:
        warnings.append(f'Step length {length} is outside documented range 1–16')
    if resolution > 4:
        warnings.append(f'Unknown step resolution {resolution}')
    slots = []
    for i in range(4):
        flags = program[174 + i * 2]
        parameter_id = program[175 + i * 2]
        slots.append({'slot': i + 1, 'enabled': bool(flags & 1),
                      'smooth': bool(flags & 2), 'flags_raw': flags,
                      'parameter_id': parameter_id,
                      'parameter_name': MOTION_PARAMETERS.get(parameter_id),
                      'parameter_id_known': parameter_id in MOTION_PARAMETERS,
                      'step_mask': _u16(program, 182 + i * 2)})
    steps = []
    for i in range(16):
        offset = 190 + 52 * i
        data = program[offset:offset + 52]
        notes = []
        for j in range(8):
            note, velocity, gate = data[j], data[8 + j], data[16 + j]
            if note > 127 or velocity > 127:
                warnings.append(f'Step {i + 1}, note slot {j + 1}: non-MIDI note/velocity')
            notes.append({'slot': j + 1, 'note': note, 'velocity': velocity,
                          'has_event': velocity != 0, 'gate_raw': gate & 127,
                          'tie': (gate & 127) > 72, 'trigger': bool(gate & 128)})
        motion = []
        for j in range(4):
            raw = data[24 + 7 * j:31 + 7 * j]
            motion.append({'slot': j + 1, 'step_enabled': bool(slots[j]['step_mask'] & (1 << i)),
                           'values_raw': decode_motion(raw), 'reserved_bits': raw[6] >> 2})
        steps.append({'step': i + 1, 'file_offset': offset,
                      'active': bool(active_mask & (1 << i)),
                      'enabled': bool(enabled_mask & (1 << i)),
                      'motion_enabled': bool(motion_mask & (1 << i)),
                      'notes': notes, 'motion': motion})
    return {'supported': True, 'header': header,
            'active_mask_source': 'stored' if header == 'SQ' else 'legacy_implicit_all_on',
            'active_mask': active_mask, 'enabled_mask': enabled_mask,
            'motion_mask': motion_mask, 'tempo_raw': tempo_raw, 'tempo_bpm': tempo_raw / 10,
            'length': length, 'resolution_raw': resolution,
            'resolution': ['1/16', '1/8', '1/4', '1/2', '1/1'][resolution] if resolution < 5 else None,
            'swing_raw': program[168], 'default_gate_raw': program[169],
            'arp_gate_raw': program[1022], 'arp_rate_raw': program[1023],
            'motion_slots': slots, 'steps': steps, 'warnings': warnings}


def summarize_sequence(sequence):
    if not sequence['supported']:
        return sequence
    return {key: sequence[key] for key in
            ['supported', 'header', 'tempo_bpm', 'length', 'resolution', 'swing_raw',
             'active_mask', 'active_mask_source', 'enabled_mask', 'motion_mask', 'warnings']} | {
        'stored_note_events': sum(note['has_event'] for step in sequence['steps']
                                  for note in step['notes']),
        'enabled_motion_slots': sum(slot['enabled'] for slot in sequence['motion_slots']),
        'motion_parameter_ids': [slot['parameter_id'] for slot in sequence['motion_slots']],
    }
