# Filter cutoff mapping

Controlled exports supplied by the user identify offsets 60–61 (`0x3C–0x3D`)
within the uncompressed 1,024-byte program record as filter cutoff, stored as
an unsigned little-endian value. Only these two bytes differ between the
Before, Cutoff0, and Cutoff1023 program records; all other program bytes match.
All four input archives passed ZIP CRC checks.

| Export | Reported synth display | Bytes at 0x3C–0x3D | Stored value |
| --- | --- | --- | --- |
| Before.mnlgxdprog | Unknown | 80 02 | 640 |
| After.mnlgxdprog | 613 | 66 02 | 614 |
| Cutoff0.mnlgxdprog | 0 (requested endpoint export) | 00 00 | 0 |
| Cutoff1023.mnlgxdprog | 1023 (requested endpoint export) | FF 03 | 1023 |

Endpoint exports establish a stored range reaching 0 and 1023 and strongly
corroborate the two-byte little-endian interpretation. They contradict a
universal stored-value-equals-display-plus-one rule. The earlier discrepancy
at 613/614 remains unexplained; possible causes include a difference between
the observed display and captured state, or display conversion. Neither cause
has been established. Interior mapping and exact bit usage remain unverified.

Decode the stored value with `int.from_bytes(program[60:62], 'little')`.
The reader exposes this as `filter_cutoff_raw`, without applying an offset.
This is sample-based static evidence, not a finding from decompilation or
hardware traffic capture. No input file was modified.

Endpoint archive SHA-256 hashes:

- Cutoff0: `c48e52468d12715f511f98852c1a131ce7b55eb59d25747e1e9495ad310e0c33`
- Cutoff1023: `29e117de6f9a7cdf73f0e68a31989a80f19aba2c1e0a3e4f25b8b6ddbd962869`
