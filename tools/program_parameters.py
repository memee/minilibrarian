"""Decode selected raw minilogue xd program parameters.

Offsets/ranges: Korg MIDI Implementation rev. 1.01 (2020-02-10), Table 2.
Little-endian order: controlled cutoff exports plus library range checks.
These are stored integers, not Hz, seconds, percentages, or display values.
"""

SPEC_URL = 'https://www.korg.com/us/support/download/manual/0/811/4440/'
SPEC_FILE_URL = ('https://cdn.korg.com/us/support/download/files/'
                 '5227b0b2f7c1da5acd0911ac3e8c4f38.txt')
SPEC_SHA256 = 'f34014c103b0127f5150aa8984db1f890feb9ee4046089e2ed320fadcecaddb5'

# All fields below occupy two bytes and have a documented range of 0–1023.
# Byte offsets are relative to the start of PROG, including its name/header.
PARAMETER_OFFSETS = {
    'voice_mode_depth': 19,
    'vco1_pitch': 24,
    'vco1_shape': 26,
    'vco2_pitch': 30,
    'vco2_shape': 32,
    'cross_mod_depth': 36,
    'noise_shape': 42,
    'vpm_shape': 44,
    'user_shape': 46,
    'noise_shift_shape': 48,
    'vpm_shift_shape': 50,
    'user_shift_shape': 52,
    'vco1_level': 54,
    'vco2_level': 56,
    'multi_level': 58,
    'filter_cutoff': 60,
    'filter_resonance': 62,
    'amp_eg_attack': 66,
    'amp_eg_decay': 68,
    'amp_eg_sustain': 70,
    'amp_eg_release': 72,
    'eg_attack': 74,
    'eg_decay': 76,
    'eg_intensity': 78,
    'lfo_rate': 83,
    'lfo_intensity': 85,
    'mod_fx_time': 95,
    'mod_fx_depth': 97,
    'delay_time': 101,
    'delay_depth': 103,
    'reverb_time': 107,
    'reverb_depth': 109,
}

# Single-byte controls. Names and ranges are from Table 2. Keep enum values raw:
# the specification has contradictory labels for voice mode and sync/ring.
BYTE_FIELDS = {
    'octave': (16, 0, 4), 'portamento': (17, 0, 127),
    'key_trigger': (18, 0, 1), 'voice_mode_type': (21, 1, 4),
    'vco1_wave': (22, 0, 2), 'vco1_octave': (23, 0, 3),
    'vco2_wave': (28, 0, 2), 'vco2_octave': (29, 0, 3),
    'sync': (34, 0, 1), 'ring': (35, 0, 1),
    'multi_type': (38, 0, 2), 'noise_type': (39, 0, 3),
    'vpm_type': (40, 0, 15), 'user_oscillator': (41, 0, 15),
    'filter_drive': (64, 0, 2), 'filter_keyboard_tracking': (65, 0, 2),
    'eg_target': (80, 0, 2), 'lfo_wave': (81, 0, 2),
    'lfo_mode': (82, 0, 2), 'lfo_target': (87, 0, 2),
    'mod_fx_enabled': (88, 0, 1), 'mod_fx_type': (89, 1, 5),
    'chorus_type': (90, 0, 7), 'ensemble_type': (91, 0, 2),
    'phaser_type': (92, 0, 7), 'flanger_type': (93, 0, 7),
    'user_mod_fx': (94, 0, 15), 'delay_enabled': (99, 0, 1),
    'delay_type': (100, 0, 19), 'reverb_enabled': (105, 0, 1),
    'reverb_type': (106, 0, 19),
    'bend_range_plus': (111, 0, 12), 'bend_range_minus': (112, 0, 12),
    'joystick_assign_plus': (113, 0, 28), 'joystick_range_plus': (114, 0, 200),
    'joystick_assign_minus': (115, 0, 28), 'joystick_range_minus': (116, 0, 200),
    'cv_mode': (117, 0, 2), 'cv1_assign': (118, 0, 28),
    'cv1_range': (119, 0, 200), 'cv2_assign': (120, 0, 28),
    'cv2_range': (121, 0, 200), 'micro_tuning': (122, 0, 139),
    'scale_key': (123, 0, 24), 'program_tuning': (124, 0, 100),
    'lfo_key_sync': (125, 0, 1), 'lfo_voice_sync': (126, 0, 1),
    'lfo_target_oscillator': (127, 0, 3),
    'filter_velocity': (128, 0, 127), 'amp_velocity': (129, 0, 127),
    'multi_octave': (130, 0, 3), 'multi_routing': (131, 0, 1),
    'eg_legato': (132, 0, 1), 'portamento_mode': (133, 0, 1),
    'portamento_bpm_sync': (134, 0, 1), 'program_level': (135, 12, 132),
    **{f'vpm_parameter_{i + 1}': (136 + i, 0, 200) for i in range(6)},
    **{f'user_parameter_{i + 1}': (142 + i, 0, 255) for i in range(6)},
    'program_transpose': (150, 1, 25), 'aftertouch_assign': (155, 0, 28),
}
WET_FIELDS = {'delay_dry_wet': 151, 'reverb_dry_wet': 153}
PARAMETER_RANGES = {name: (0, 1023) for name in PARAMETER_OFFSETS}
PARAMETER_RANGES.update({name: (lo, hi) for name, (_, lo, hi) in BYTE_FIELDS.items()})
PARAMETER_RANGES.update({name: (0, 1024) for name in WET_FIELDS})
PARAMETER_RANGES.update({f'user_parameter_{i}_type': (0, 2) for i in range(1, 7)})


def decode_parameters(program: bytes) -> dict:
    """Return raw values; keep out-of-range values visible without clamping."""
    if len(program) != 1024 or program[:4] != b'PROG':
        raise ValueError('Expected a 1,024-byte PROG record')
    result = {name: int.from_bytes(program[offset:offset + 2], 'little')
              for name, offset in {**PARAMETER_OFFSETS, **WET_FIELDS}.items()}
    result.update({name: program[offset] for name, (offset, _, _) in BYTE_FIELDS.items()})
    for i in range(6):
        offset, shift = (149, i * 2) if i < 4 else (148, (i - 4) * 2)
        result[f'user_parameter_{i + 1}_type'] = (program[offset] >> shift) & 3
    return result


def parameter_warnings(parameters: dict) -> list:
    warnings = []
    for name, value in parameters.items():
        if name.startswith('user_parameter_') and name.endswith('_type') and value == 3:
            warnings.append(f'{name}: undocumented type code 3; value kept raw')
            continue
        lo, hi = PARAMETER_RANGES[name]
        if name.startswith('user_parameter_') and not name.endswith('_type'):
            kind = parameters.get(name + '_type')
            hi = {0: 101, 1: 200, 2: 100}.get(kind, 255)
        if not lo <= value <= hi:
            warnings.append(f'{name}: stored value {value} is outside documented range {lo}–{hi}')
    return warnings
