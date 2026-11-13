/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * An engine is the same engine however many times it is signed
 * (engineContent.ts).
 *
 * The files are built the way a linker and signtool leave them
 * (utils/peFiles.ts). Every "same" stands beside a control where one byte of code
 * moved, so "same" is never everything reading alike.
 */

import { isDifferentFile, peContent } from '../../../main/engineContent';
import {
  CHANGED_CODE,
  ENGINE_CODE,
  linkedPe,
  OPTIONAL,
  PE_AT,
  signedPe,
} from '../../utils/peFiles';

describe('peContent', () => {
  it('reads a signed engine as the same content as the unsigned one', () => {
    const unsigned = peContent(linkedPe(ENGINE_CODE));
    const first = peContent(signedPe(linkedPe(ENGINE_CODE), 1, 0));

    expect(unsigned?.signed).toBe(false);
    expect(first?.signed).toBe(true);
    expect(first?.digest).toBe(unsigned?.digest);
    // The control: one byte of code is another engine.
    expect(peContent(linkedPe(CHANGED_CODE))?.digest).not.toBe(
      unsigned?.digest,
    );
  });

  it('reads two signings, with their own timestamps and padding, as one content', () => {
    const first = peContent(signedPe(linkedPe(ENGINE_CODE), 1, 0));
    const second = peContent(signedPe(linkedPe(ENGINE_CODE), 2, 7));

    expect(second?.digest).toBe(first?.digest);
    expect(peContent(signedPe(linkedPe(CHANGED_CODE), 2, 7))?.digest).not.toBe(
      first?.digest,
    );
  });

  it('leaves out only what signing touches', () => {
    const base = linkedPe(ENGINE_CODE);
    const plain = peContent(base)?.digest;
    // A header byte signing never writes, the COFF timestamp, still counts.
    const stamped = Buffer.from(base);
    stamped.writeUInt32LE(0x5f5e100, PE_AT + 8);
    expect(peContent(stamped)?.digest).not.toBe(plain);
    // So does data at the very end, when it is not the zeros of padding.
    const tail = Buffer.from(base);
    tail[tail.length - 1] = 1;
    expect(peContent(tail)?.digest).not.toBe(plain);
    // And the checksum alone does not.
    const summed = Buffer.from(base);
    summed.writeUInt32LE(0x9999, OPTIONAL + 64);
    expect(peContent(summed)?.digest).toBe(plain);
  });

  it('reads a 32-bit PE the same way', () => {
    const unsigned = peContent(linkedPe(ENGINE_CODE, 0x10b));
    const resigned = peContent(signedPe(linkedPe(ENGINE_CODE, 0x10b), 3, 4));

    expect(resigned?.signed).toBe(true);
    expect(resigned?.digest).toBe(unsigned?.digest);
    expect(peContent(linkedPe(CHANGED_CODE, 0x10b))?.digest).not.toBe(
      unsigned?.digest,
    );
  });

  it('does not read what is not a PE, or a table that is not the last thing in the file', () => {
    expect(peContent(Buffer.from('engine v2'))).toBeUndefined();
    const trailing = Buffer.concat([
      signedPe(linkedPe(ENGINE_CODE), 1, 0),
      Buffer.from([1, 2, 3]),
    ]);
    expect(peContent(trailing)).toBeUndefined();
    // The control: the same file without the extra bytes reads.
    expect(peContent(signedPe(linkedPe(ENGINE_CODE), 1, 0))).toBeDefined();
  });
});

describe('isDifferentFile', () => {
  const unsigned = linkedPe(ENGINE_CODE);
  const first = signedPe(linkedPe(ENGINE_CODE), 1, 0);
  const second = signedPe(linkedPe(ENGINE_CODE), 2, 7);

  it('offers the signed engine once to a machine that has it unsigned', () => {
    expect(isDifferentFile(unsigned, first)).toBe(true);
  });

  it('offers nothing for the same engine signed again', () => {
    expect(isDifferentFile(first, second)).toBe(false);
    // The control: signed again AND changed is an update.
    expect(isDifferentFile(first, signedPe(linkedPe(CHANGED_CODE), 2, 7))).toBe(
      true,
    );
  });

  it('offers nothing for an unsigned build of the engine installed signed', () => {
    expect(isDifferentFile(first, unsigned)).toBe(false);
    expect(isDifferentFile(first, linkedPe(CHANGED_CODE))).toBe(true);
  });

  it('compares the whole file when either side is not a PE', () => {
    expect(isDifferentFile(Buffer.from('a'), Buffer.from('a'))).toBe(false);
    expect(isDifferentFile(Buffer.from('a'), Buffer.from('b'))).toBe(true);
    expect(isDifferentFile(Buffer.from('engine v1'), first)).toBe(true);
  });
});
