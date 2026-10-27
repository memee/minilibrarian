# Before/After program comparison

Inputs: `Before.mnlgxdprog` and `After.mnlgxdprog` in the workspace.
Both ZIP archives passed CRC checks and contain the same three member names.
The XML manifest and program metadata are byte-identical. Both program records
are 1,024 bytes, with the name field `Square LPG`.

Exactly one program byte differs (offsets are zero-based within the uncompressed
`Prog_000.prog_bin`, not within the ZIP container):

| Offset | Before | After |
| --- | --- | --- |
| 60 (`0x3C`) | 128 (`0x80`) | 102 (`0x66`) |

The following byte at offset 61 (`0x3D`) is unchanged at `0x02`.
If offsets 60–61 form an unsigned little-endian 16-bit field, its value changed
from `0x0280` (640) to `0x0266` (614). This field width and interpretation are a
hypothesis; the byte difference alone establishes neither the parameter name
nor its scale. The parameter changed by the user and its displayed before/after
values have not yet been supplied.

SHA-256:

- Before: `bf3b45c05345295e4638189152af75c6aeea272a59bef9b86d730e080a037207`
- After: `9bed8c86e2f21df6afe0cf08559cb99322e89f73b27af32e7c6898c0f4162546`

Evidence was obtained directly with Python zipfile and byte comparison. No app
execution or hardware communication was involved; neither input was modified.
