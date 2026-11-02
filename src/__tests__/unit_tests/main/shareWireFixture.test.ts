/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readFileSync } from 'fs';
import path from 'path';
import { shareWireFixture } from 'main/shareAudio/shareWireFixture';

/**
 * Share Audio's link in C++ (`native/share-core`) is held by
 * `share_wire_test.cpp` to the bytes this app's own TypeScript writes and
 * the readings it makes (`share_wire_fixture.h`). A change to the wire here,
 * not regenerated there, holds the C++ to a wire no FluidEQ speaks — so the
 * header is held to the module byte for byte.
 */

let text = '';
beforeAll(async () => {
  text = await shareWireFixture();
});

it('is the wire the app speaks now', () => {
  const header = readFileSync(
    path.resolve(process.cwd(), 'native/share-core/tests/share_wire_fixture.h'),
    'utf8',
  );
  expect(header).toBe(text);
});

/**
 * Each table has to hold both answers, or the C++ is held to half a rule:
 * codes read and refused, control messages taken and refused, datagrams
 * that are and are not this listener's.
 */
it('asks both answers of every reading', () => {
  const block = (name: string) => {
    const start = text.indexOf(`${name}[] = {`);
    return text.slice(start, text.indexOf('};', start));
  };
  const codes = block('kCodeCases').split('\n').slice(1);
  expect(
    codes.filter((line) => line.endsWith(', ""},')).length,
  ).toBeGreaterThan(8);
  expect(
    codes.filter((line) => line.includes('\\042secret\\042')).length,
  ).toBeGreaterThan(4);
  const signals = block('kSignalCases');
  expect((signals.match(/, true\},/g) ?? []).length).toBeGreaterThan(10);
  expect((signals.match(/, false\},/g) ?? []).length).toBeGreaterThan(10);
  const datagrams = block('kDatagramCases');
  expect(datagrams).toContain(', true, ""},');
  expect(datagrams).toMatch(/, false, "51234\\012Den/);
});
