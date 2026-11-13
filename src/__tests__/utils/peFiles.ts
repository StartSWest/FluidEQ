/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * DLLs as a linker and signtool leave them, for the engine comparison's
 * tests: a PE header, a section of code padded with zeros, and for a signed
 * copy a new checksum, the certificate table's directory entry and the table
 * appended after padding to eight bytes.
 */

export const PE_AT = 0x80;
export const OPTIONAL = PE_AT + 24;
const CODE_AT = 0x200;

/** Code bytes for a "real" engine and, as the control, one that moved. */
export const ENGINE_CODE = [0x55, 0x48, 0x89, 0xe5, 0xc3];
export const CHANGED_CODE = [0x55, 0x48, 0x89, 0xe5, 0xc2];

/** A linked DLL: headers, then code, the last section padded with zeros. */
export const linkedPe = (code: number[], magic = 0x20b): Buffer => {
  const plus = magic === 0x20b;
  const optionalSize = plus ? 240 : 224;
  const file = Buffer.alloc(0x400);
  file.writeUInt16LE(0x5a4d, 0);
  file.writeUInt32LE(PE_AT, 0x3c);
  file.writeUInt32LE(0x00004550, PE_AT);
  file.writeUInt16LE(optionalSize, PE_AT + 20);
  file.writeUInt16LE(magic, OPTIONAL);
  file.writeUInt32LE(16, OPTIONAL + (plus ? 108 : 92));
  file.writeUInt32LE(0x1234, OPTIONAL + 64);
  code.forEach((value, at) => {
    file[CODE_AT + at] = value;
  });
  return file;
};

/**
 * What signtool leaves. `stamp` stands for the timestamp, which makes every
 * signing's table different; `padding` for the zeros before the table.
 */
export const signedPe = (
  file: Buffer,
  stamp: number,
  padding: number,
): Buffer => {
  const plus = file.readUInt16LE(OPTIONAL) === 0x20b;
  const security = OPTIONAL + (plus ? 112 : 96) + 4 * 8;
  const padded = Buffer.concat([file, Buffer.alloc(padding)]);
  const table = Buffer.alloc(96, stamp);
  const out = Buffer.concat([padded, table]);
  out.writeUInt32LE(0xa000 + stamp, OPTIONAL + 64);
  out.writeUInt32LE(padded.length, security);
  out.writeUInt32LE(table.length, security + 4);
  return out;
};
