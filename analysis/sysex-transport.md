# Program transfer reconstruction

Follow-up: [program loading and parameter decoding](program-layout.md) now
establishes the raw file-to-object copy path and documents 32 decoded fields.
The unresolved table discussed below was not used for decoding.

Target: minilogue xd Sound Librarian 1.0.5, x86_64 Mach-O, SHA-256
`a3943475b5a46ddab5d79451e9d46c36542c4686cf9d99d8a11d517e53dbb09a`.
Static Hopper analysis through REA. No target execution or MIDI I/O.

## Answered: program payload packing

`sub_1000694a8` converts arbitrary bytes to seven-bit-safe bytes. Each group of
up to seven source bytes becomes a prefix plus the seven low-bit values.
Source byte i's high bit becomes prefix bit i (i = 0..6). The final partial
group receives its own prefix. Thus 1,024 bytes become 1,171 (`0x493`) bytes.

Example, derived directly from the instruction-level bit operations:

```
input:  80 01 FF 7F 81 00 FE
output: 55 00 01 7F 7F 01 00 7E
```

Evidence: pseudocode `ev_21cc7f3a7e3b6cbd07fc19d82a67207905a17ac1f25a0a61f64bb547a0313c10`;
assembly `ev_eefcec7a6386569263659fa5f4f2e38e7b198b5f16e7ccd7e46cad4688648aa6`.
The receive-side routine `sub_100066ecc` contains a complementary loop reading
a prefix every seven output bytes and reconstructing 1,024 source bytes.
Evidence: `ev_6b669490123c0e4865b2a8b7459e0c24b3f2c4b0134bf6716d85205b034af85e`.
A later pass identified its 0x4C case as the program payload path; device model
bytes and hardware reply framing still need confirmation below.

## Answered: outgoing message construction

Assembly for `sub_10005d3d6` constructs this 1,181-byte (`0x49D`) message:

```
F0 42 (30 | channel) 00 model_hi model_lo 4C index_lo index_hi
[1171 packed bytes]
F7
```

The channel is masked to four bits. `index_lo = index & 0x7F`,
`index_hi = (index >> 7) & 0x7F`. The two model bytes come from a runtime
configuration integer's bits 8..14 and 0..6 respectively. This differs from
the seven-bit split used for the program index. Model identity selection is
not yet traced, so the offline builder requires explicit wire-order bytes.
The function packs 1,024 bytes from its program object's address plus 0x10;
this is an object offset, not an instruction to skip 16 bytes of a file.
The file-to-object load path still needs tracing to prove their relationship.

Evidence: pseudocode `ev_91a48bfa5cd20b253918f377e0e77be20298b6973548e6b88dedb77609bec6ea`;
assembly `ev_90d198766e26cbebd6c912e85ecfbbf2524c714decb33b4f88c022071c4b44b7`.

`sub_10005d152` constructs a ten-byte indexed request:

```
F0 42 (30 | channel) 00 model_hi model_lo 1C index_lo index_hi F7
```

Evidence: assembly `ev_0e353b503f887fcc13eb5542c9f356b84851a7e4ea3fc71998ec1d0458c1be32`.
It copies up to 1,024 received decoded bytes into a program object.

`sub_10005cf04` constructs an eight-byte request with command 0x0E:

```
F0 42 (30 | channel) 00 model_hi model_lo 0E F7
```

Evidence: `ev_c61564b14288186489d298001ee4ec7435c3ff1c715e7d16ec8305621e2180fa`.
The command's exact user-facing operation is not established here.
Return/status numbers in pseudocode must not be equated to wire-level response
commands without tracing the response classifier.

## Implemented and checked

`tools/sysex_codec.py` implements packing, its inverse, an indexed request
builder, and the 0x4C message builder. It opens no MIDI ports and sends nothing.
The inverse adds strict canonical-input checks as a local implementation
choice; these are not claims about the original app's acceptance rules.
Program index bounds express the observed 14-bit encoding, not verified device
slot limits. Channel uses a zero-based integer (0–15).

Five unittest cases pass, covering a manually derived bit-order vector,
all byte values and group boundaries, malformed inputs, header/index layout,
and the four supplied exports. Each export produces 1,171 packed bytes and
round-trips without loss. Endpoint cutoff changes appear at payload positions
69–70, with the high bit of file byte 60 stored in prefix byte 64, bit 4.
These tests check the reconstruction, not actual device compatibility or
equivalence obtained by executing the original function.

Run: `python3 -m unittest discover -s tools -p 'test_*.py' -v`.

## Partially answered: cutoff and additional parameters

The sample-confirmed cutoff file offset remains 0x3C–0x3D. String references
led to initializer `EntryPoint_27` at 0x1001A2F88. It initializes a regular
table containing labels including Cutoff, Resonance, and envelopes, but its
Cutoff-associated offset is 0x2C. Earlier entries associate Header 1–4 with
offsets 0–3 and Program Name 1 with offset 4. This is insufficient to identify
the table's target layout or justify adding 16 to every parameter offset.
No additional parameter field has been promoted to the file reader.
Evidence: `ev_ba43160355f941d62e549493bc49a007c4cad31264b99240e3420ed0cebe7122`.
The display 613 versus saved 614 discrepancy remains unexplained.

## First receive implementation and remaining protocol assumptions

`src/sysex.js` now requests a slot with command 0x1C and waits for command
0x4C. The receive routine `sub_100066ecc` checks the command byte at offset 6,
then for its 0x4C case reconstructs 1,024 bytes starting at offset 7 when the
message length exceeds 0x49A. This supports a reply with the packed program
payload immediately after the command and no echoed slot number. The requested
slot is therefore associated with the outstanding request. This is a static
interpretation and still needs a captured hardware reply.

The Electron receiver currently uses device bytes `00 01 51`, also used in the
independent [`minilogue-xd` Rust SysEx frame reference](https://docs.rs/minilogue-xd/latest/src/minilogue_xd/sysex/frame.rs.html).
The decompiled app compares incoming model bytes with a runtime model ID, but
the static notes have not extracted that runtime value. Treat `00 01 51` as a
corroborated implementation assumption, not verified hardware evidence.

Next: connect the synth and receive one known slot, then compare the returned
1,024-byte record with a Korg-exported `.mnlgxdprog`. Confirm the actual device
bytes, reply framing, index order, and timing before relying on a full
500-slot backup. The UI currently receives program records only; favorites,
tuning tables, and user-unit data are outside this first milestone.

Follow-on reverse-engineering: trace indexed-request callers
0x1000680BC and 0x100068D4C toward device configuration; identify the xd
parameter descriptor table before expanding editor functionality.

Raw selected pseudocode and assembly are in `analysis/decompiled/`.
Complete retained Evidence: `transport-evidence.json`; reusable session:
`transport.snapshot.json`. Initial evidence files remain separate.
