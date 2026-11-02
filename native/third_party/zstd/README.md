# Zstandard, as FluidEQ carries it

Share Audio squeezes the sound one computer sends another with Zstandard at
level 1, and every FluidEQ that links has to read what the others send. The
link moving out of Node into C++ (`native/share-host`) needs the library
itself, so its sources live here.

- **Version:** 1.5.7, from the official release archive
  `zstd-1.5.7.tar.gz` at <https://github.com/facebook/zstd/releases/tag/v1.5.7>.
- **SHA-256 of that archive:** `eb33e51f49a15e023950cd7825ca74a4a2b43db8354825ac24fc1b7ee09e6fa3`,
  the value the release itself publishes beside it.
- **Licence:** BSD 3-clause (`LICENSE`, as in the author's repository).
- **What is here:** `lib/zstd.h`, `lib/zstd_errors.h`, and `lib/common`,
  `lib/compress` and `lib/decompress` unchanged; nothing else of the archive.
  `huf_decompress_amd64.S` is left out and the library is built with
  `ZSTD_DISABLE_ASM`, so every platform compiles the same C.

To move to another version: take the release archive, check its SHA-256
against the one the release publishes, replace these files with the same
directories, and update this page.
