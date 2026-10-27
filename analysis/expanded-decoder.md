# Expanded program and sequencer decoder

The read-only reader now exposes 110 raw synth settings plus sequencer data.
The additional fields include oscillator choices, effect choices and switches,
joystick/CV assignments, tuning selection, user-oscillator values and type bits,
and delay/reverb dry-wet values. Enum values are intentionally kept numeric.
The original 32-field CSV remains an earlier snapshot; use
`library-expanded.csv` or `library-expanded.json` for current output.

Source: Korg MIDI Implementation revision 1.01, Table 2 and notes P23/P24,
S1–S4, available from the [official download page](https://www.korg.com/us/support/download/manual/0/811/4440/).
The previously recorded source SHA-256 remains
`f34014c103b0127f5150aa8984db1f890feb9ee4046089e2ed320fadcecaddb5`.
This pass implements the published format and checks sample compatibility;
it adds no new decompiler or hardware-execution evidence.

## Sequencer interpretation

- Recognizes both `SEQD` (legacy) and `SQ` headers. Legacy records use an
  implicit all-active mask, following note S1. Reading does not rewrite them.
- Reads tempo in tenths of BPM, sequence length/resolution, active-step,
  enabled-step, and motion masks independently.
- Reads four motion-slot enable/smooth flags, target IDs, and per-slot masks.
- Reads 16 event records of 52 bytes beginning at file offset 190. The last
  begins at 970 and ends at 1021. The specification's last-step row says 426,
  which conflicts with the stated stride and endpoint; the consistent stride
  is used and covered by a boundary test.
- Keeps all eight note slots per step. Velocity zero means no event. Gate
  low seven bits and trigger high bit are decoded separately; gate codes above
  72 are marked as ties according to the event table. This does not by itself
  assert that a tied note will sound: neighboring triggers and step masks matter.
- Decodes four seven-byte motion records per step into five ten-bit raw values
  each, preserving the remaining reserved bits. Parameter IDs are named only
  when listed in note S2-1. Smooth interpolation is not simulated.

Default output contains a compact `sequencer_summary` for each program.
`--sequencer` adds the complete stored events. The summary's note count counts
stored nonzero-velocity events, including events on disabled steps or past the
configured sequence length. It is not a playback or audible-note count.

## Results for the supplied library

| Check | Result |
| --- | --- |
| Program records | 500 |
| Raw synth settings per record | 110 |
| Legacy SEQD records | 485 |
| SQ records | 15 |
| Records containing stored notes | 205 |
| Stored nonzero-velocity events | 5,749 |
| Records with enabled motion slots | 85 |
| Decoded event records | 8,000 |
| Motion records with nonzero reserved bits | 0 |

All headers were recognized. The checked tempo, length, resolution, and
note/velocity ranges produced no sequence warnings. Synth-field warnings
were exclusively undocumented user-parameter type code 3: 1,230 occurrences
across 213 programs. This is an observation, not a claim that those files are
corrupt. Type 3 is preserved and its value is left uninterpreted.

Motion parameter ID 124 occurs in the library but is absent from the supplied
specification's target table. It remains numeric with `parameter_id_known=false`
and no fabricated name. Other unknown IDs receive the same treatment.

## Deliberately unresolved representations

Swing is kept as a raw byte. The published range is -75..75, while 490 library
records contain 75 and some contain values over 75. A biased representation is
plausible but has not been established through a controlled export or code.
Arpeggiator gate/rate stay raw; one legacy record contains gate 77 even though
the current table lists a maximum of 72. No coercion is applied.

The specification has conflicting voice-mode enum labels and a contradictory
portamento Range cell. We keep voice modes numeric and use the explicit
portamento description's 0..127 range, consistent with observed values.
Sync/ring enum labels are also not translated. Existing two-byte fields retain
the empirically supported little-endian order. Physical units and user-facing
labels require separate validation.

## Artifacts and tests

- `library-expanded.csv`: 500 rows with 110 raw settings.
- `library-expanded.json`: settings, metadata, source provenance, warnings,
  and sequencer summaries.
- `library-sequencer.csv`: 500 compact sequencer summaries.
- `sequencer-example.json`: complete stored sequencer data for TyoCityLoop,
  library position 7, the first record containing notes.
- `expanded-validation.json`: counts and unresolved-value frequencies.

Sixteen unittest cases pass. Added tests cover type-bit locations, legacy and
current headers, the final step boundary, zero-velocity semantics, gate/trigger
bit separation, a hand-derived motion-bit vector, motion target unknowns, and
the unchanged sequencer content in all four controlled cutoff exports. The
integration check also examined all 500 records, 16 steps each, eight note slots
per step, and four motion records per step.

No inputs were modified, no application was executed, and no MIDI was sent.
The decoder is ready for offline inspection and comparisons. Hardware playback,
editing/writing, full user-unit interpretation, and tuning-table decoding are
not implemented by this pass.
