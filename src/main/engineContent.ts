/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What a DLL is, apart from its signature.
 *
 * The engine is signed from 2.5.1, and every signing gives a file different
 * bytes even when not one instruction changed: the timestamp is new each
 * time. The update offer compared whole files, so a re-signed engine that
 * had not changed would have put the Windows prompt in front of every user
 * at every release. The engine build is reproducible (`/Brepro`) so that the
 * same tree links the same file; this is the same promise across a signing.
 *
 * Signing a PE touches three things and nothing else: the optional header's
 * checksum, the certificate table's entry among the data directories, and
 * the certificate table itself, appended at the end of the file (after up to
 * seven bytes of padding that bring it to an eight-byte boundary). Those are
 * the bytes Authenticode leaves out of what it signs, for the same reason.
 * What is left is the code, the data and the resources: the engine itself.
 *
 * Plain Node, nothing that spawns: `sync-dev-engine` reads it too.
 */
import { createHash } from 'crypto';

export interface IPeContent {
  /** SHA-256 of the file without what a signature adds or changes. */
  digest: string;
  /** It carries a certificate table: somebody signed it. */
  signed: boolean;
}

const PE32 = 0x10b;
const PE32_PLUS = 0x20b;
/** The certificate table's place among the data directories. */
const SECURITY_DIRECTORY = 4;

/**
 * The content of a PE file, or nothing when it does not read as one — the
 * caller then compares the whole file, which can only ever offer an update
 * too many, never one too few.
 */
export const peContent = (bytes: Buffer): IPeContent | undefined => {
  if (bytes.length < 0x40 || bytes.readUInt16LE(0) !== 0x5a4d) {
    return undefined;
  }
  const pe = bytes.readUInt32LE(0x3c);
  if (pe + 24 > bytes.length || bytes.readUInt32LE(pe) !== 0x00004550) {
    return undefined;
  }
  const optionalSize = bytes.readUInt16LE(pe + 20);
  const optional = pe + 24;
  const headersEnd = optional + optionalSize;
  if (optional + 2 > bytes.length || headersEnd > bytes.length) {
    return undefined;
  }
  const magic = bytes.readUInt16LE(optional);
  if (magic !== PE32 && magic !== PE32_PLUS) {
    return undefined;
  }
  const countAt = optional + (magic === PE32 ? 92 : 108);
  const directories = optional + (magic === PE32 ? 96 : 112);
  const checksum = optional + 64;
  if (countAt + 4 > headersEnd) {
    return undefined;
  }
  const security = directories + SECURITY_DIRECTORY * 8;
  const hasSecurity =
    bytes.readUInt32LE(countAt) > SECURITY_DIRECTORY &&
    security + 8 <= headersEnd;

  let end = bytes.length;
  let signed = false;
  if (hasSecurity) {
    const tableAt = bytes.readUInt32LE(security);
    const tableSize = bytes.readUInt32LE(security + 4);
    if (tableSize !== 0) {
      // Signing appends the table: it is the file's last bytes, after the
      // headers. Anything else is a file this does not understand, and the
      // whole-file comparison is the safe answer.
      if (tableAt < headersEnd || tableAt + tableSize !== bytes.length) {
        return undefined;
      }
      end = tableAt;
      signed = true;
    }
  }
  const tail = hasSecurity ? security + 8 : checksum + 4;
  // The padding signing puts before the table is zeros, and so is the end of
  // a linker's last section: both read as nothing, so a file signed with or
  // without padding is the same file.
  while (end > tail && bytes[end - 1] === 0) {
    end -= 1;
  }

  const hash = createHash('sha256');
  hash.update(bytes.subarray(0, checksum));
  if (hasSecurity) {
    hash.update(bytes.subarray(checksum + 4, security));
    hash.update(bytes.subarray(security + 8, end));
  } else {
    hash.update(bytes.subarray(checksum + 4, end));
  }
  return { digest: hash.digest('hex'), signed };
};

/**
 * Whether the bundled file is a different one to put in place of the
 * installed one.
 *
 * A different engine, by its content; or the same engine, now signed, over a
 * copy that is not — the one update every machine that took the unsigned
 * engine (2.4, or the 2.5.0 bridge) is owed, so that what audiodg.exe loads
 * names its publisher. The same engine signed again, by a later release, is
 * not a different file. Neither is an unsigned development build of the
 * engine already installed signed.
 */
export const isDifferentFile = (installed: Buffer, bundled: Buffer) => {
  const was = peContent(installed);
  const is = peContent(bundled);
  if (!was || !is) {
    return !installed.equals(bundled);
  }
  if (was.digest !== is.digest) {
    return true;
  }
  return is.signed && !was.signed;
};
