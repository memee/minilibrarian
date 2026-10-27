# Sample library findings

Source: `/Users/macio/Documents/MinilogueXDLibrary.mnlgxdlib`.
These observations come from Python ZIP/XML inspection of the supplied file,
not from application execution or REA Evidence. Its SHA-256 and per-program
hashes are recorded in `library-inventory.json`.

The file is a ZIP archive with 1,026 members. All members passed ZIP CRC checks.
`FileInformation.xml` identifies the product as `minilogue xd` and references
500 program binary/metadata pairs, one favorites file, six scale tuning pairs,
and six octave tuning pairs. The declared program count matches the manifest.

Every program binary is 1,024 bytes and starts with ASCII `PROG` at offsets
0–3. Offsets 4–15 appear to hold a 12-byte ASCII program name, with NUL padding
for shorter names; some names contain trailing spaces. The interpretation of
bytes from offset 16 onward remains unresolved. No parameter values are decoded.

The 500 records contain 214 distinct complete program binaries. Identical
binaries may intentionally occupy several positions. Metadata files all contain
the same `xd_ProgramInformation` XML with empty `Programmer` and `Comment`.

Favorites are XML (`xd_Favorite`) with two banks of eight integer values.
Their numbering base is unverified; the inventory preserves raw values.
Scale binaries are each 384 bytes; octave binaries are each 36 bytes. Their
parameter encoding is not established by these size observations.

`library-programs.csv` lists all programs in manifest order, assigning display
positions 1–500 for convenience. Hardware slot mapping has not been verified.

Reproduce the inventory with:

```sh
python3 tools/inspect_library.py /Users/macio/Documents/MinilogueXDLibrary.mnlgxdlib
```

The reader accesses ZIP members in memory and does not modify the source file.
It checks CRCs, duplicate member names, program headers/sizes, manifest program
count, and reads XML metadata. It currently targets this observed library format.

Next: trace the librarian's program reader and message-building routines to map
parameter offsets and conversion between these raw records and SysEx payloads.
