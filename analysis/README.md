# Initial decompilation — minilogue xd Sound Librarian

Current reader: [110 raw settings and sequencer decoding](expanded-decoder.md).

Latest: [program loading and 32 decoded raw parameters](program-layout.md).
The reader now uses documented xd offsets, and the file-to-object-to-MIDI
copy path is traced. See `library-parameters.csv` for the supplied library.

Follow-up: [SysEx transport reconstruction](sysex-transport.md) documents the
recovered packing algorithm, message builders, validation, and unresolved
parameter-table layout. The offline implementation is `tools/sysex_codec.py`.

Installed version: 1.0.5 (Info.plist).
Executable: /Applications/minilogue xd Sound Librarian/minilogue xd Sound Librarian.app/Contents/MacOS/minilogue xd Sound Librarian
Architecture: x86_64 Mach-O.
SHA-256: a3943475b5a46ddab5d79451e9d46c36542c4686cf9d99d8a11d517e53dbb09a
Provider: Hopper through REA.

## Result

Initial decompilation succeeded for two selected functions. The analyzed inventory contains 10,191 procedures and 2,828 strings; this does not mean every procedure has been decompiled or represents application-specific logic.

- `decompiled/0x10001d5f2.c`: pseudocode contains a branch on the first byte being 0xF0, buffer allocation/copying, and a MIDISendSysex call. It also contains MIDIPacketListInit/Add and MIDISend calls. Interpreted as a MIDI/SysEx transmission routine; exact types and surrounding state remain unresolved. Evidence: ev_d50e5622c9a1caf5abfa8ff9f13580e8acc6ebc8794185ac226531eda39970f3.
- `decompiled/0x1000b5b80.c`: pseudocode contains timestamp acquisition, a 0xF0 branch, a loop copying chunks of up to 0x100 bytes, and MIDISend/MIDIReceived calls. Interpreted as another MIDI output routine. Evidence: ev_516581640b1821acaf5043a637e5125b340f5b0a7b1f3ba59fb35783daebe6f6.

Inventory evidence: ev_6de50fe28303664ca26491119dfb2f9a18f8f8c5116ad705136a1893c91829b2.
Caller evidence: ev_103383bb46ce3c6751c09568a4fc9a32ee0e91d0afe0678e038d5b044a8c346c and ev_6766ab4e194196f98b846a5f80ad1da764b499ac97e880d7ebefc51b092558f7.

## Limits and next steps

These files preserve raw decompiler output, including register variables, uncertain types, and possible reconstruction errors. They are not original source or buildable C. Named procedure searches for sysex/pack/unpack/program/midi returned imported CoreMIDI stubs rather than descriptive application function names; the selected internal functions have address-based names. Further investigation should follow callers toward message construction and file import/export, recover data structures, and validate important logic against assembly and controlled samples.

Only static analysis was performed. The target application was not launched, no hardware was contacted, and the installed app was not modified. Full-library reconstruction, patch-format documentation, and hardware protocol verification remain outside this initial decompilation attempt.

The REA evidence bundle and reusable analysis snapshot are saved alongside this report.

