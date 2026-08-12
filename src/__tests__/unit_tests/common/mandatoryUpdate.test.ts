/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
  MANDATORY_UPDATE_FIELD,
  MANDATORY_UPDATE_VALUE,
  isMandatoryUpdate,
} from 'common/mandatoryUpdate';

/**
 * The one input that blocks an app, and the very long list that does not.
 *
 * This is the test that matters most in the feature. A false negative delays an
 * urgent update by a few hours; a false positive stops somebody's audio
 * software from opening. So the positive case gets one test and the negative
 * case gets everything else — absent, empty, garbage, wrong type, and the
 * near-misses that a person writing the release by hand would actually produce.
 */
describe('the mandatory-update signal', () => {
  it('recognises the one shape that means it', () => {
    expect(
      isMandatoryUpdate({
        version: '1.3.0',
        vendor: { [MANDATORY_UPDATE_FIELD]: MANDATORY_UPDATE_VALUE },
      }),
    ).toBe(true);
  });

  it('recognises it in a parsed document rather than a literal', () => {
    // What reaches `update-available` is a document that was serialised into
    // `latest.yml` and parsed back out of it, not an object anybody wrote in
    // TypeScript. Parsing here rather than passing a literal keeps the test
    // honest about that: the flag has to be a plain own string property of a
    // plain object, which is what both YAML and JSON produce, and nothing that
    // relies on how the literal above happened to be written.
    const parsed = JSON.parse(
      `{"version":"1.3.0","files":[{"url":"FluidEQ-Setup-1.3.0.exe","sha512":"abc"}],` +
        `"vendor":{"${MANDATORY_UPDATE_FIELD}":"${MANDATORY_UPDATE_VALUE}"}}`,
    );
    expect(isMandatoryUpdate(parsed)).toBe(true);
  });

  describe('fails open for', () => {
    // *** Absent ***
    it('an update with no vendor block at all — the ordinary release', () => {
      expect(isMandatoryUpdate({ version: '1.3.0', files: [] })).toBe(false);
    });

    it('a vendor block without the key', () => {
      expect(isMandatoryUpdate({ vendor: { somethingElse: 'required' } })).toBe(
        false,
      );
    });

    it('the key present and undefined', () => {
      expect(
        isMandatoryUpdate({ vendor: { [MANDATORY_UPDATE_FIELD]: undefined } }),
      ).toBe(false);
    });

    // *** Empty ***
    it('an empty update object', () => {
      expect(isMandatoryUpdate({})).toBe(false);
    });

    it('an empty vendor block', () => {
      expect(isMandatoryUpdate({ vendor: {} })).toBe(false);
    });

    it('an empty string for the flag', () => {
      expect(
        isMandatoryUpdate({ vendor: { [MANDATORY_UPDATE_FIELD]: '' } }),
      ).toBe(false);
    });

    // *** Garbage ***
    it.each([
      ['a near miss in case', 'Required'],
      ['a near miss in whitespace', ' required'],
      ['a trailing newline from a shell', 'required\n'],
      ['the word inside a sentence', 'this update is required'],
      ['something else entirely', 'yes'],
      ['the string "true"', 'true'],
      ['the string "1"', '1'],
    ])('%s', (_label, value) => {
      expect(
        isMandatoryUpdate({ vendor: { [MANDATORY_UPDATE_FIELD]: value } }),
      ).toBe(false);
    });

    it('a vendor block that is a YAML string rather than a map', () => {
      // What `vendor: required` in latest.yml would actually parse to.
      expect(isMandatoryUpdate({ vendor: 'required' })).toBe(false);
    });

    it('a vendor block that is a list', () => {
      expect(isMandatoryUpdate({ vendor: [MANDATORY_UPDATE_VALUE] })).toBe(
        false,
      );
    });

    // *** Wrong type ***
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['a string', 'required'],
      ['a number', 1],
      ['a boolean', true],
      ['an array', []],
      ['a function', () => undefined],
    ])('an update info that is %s', (_label, info) => {
      expect(isMandatoryUpdate(info)).toBe(false);
    });

    it.each([
      ['boolean true', true],
      ['the number 1', 1],
      ['null', null],
      ['an object', {}],
      ['an array', []],
    ])('a flag that is %s rather than the word', (_label, value) => {
      expect(
        isMandatoryUpdate({ vendor: { [MANDATORY_UPDATE_FIELD]: value } }),
      ).toBe(false);
    });

    // *** Hostile ***
    it('the word arriving from the prototype rather than the file', () => {
      const vendor = Object.create({
        [MANDATORY_UPDATE_FIELD]: MANDATORY_UPDATE_VALUE,
      });
      expect(isMandatoryUpdate({ vendor })).toBe(false);
    });

    it('a getter that throws', () => {
      const vendor = {};
      Object.defineProperty(vendor, MANDATORY_UPDATE_FIELD, {
        enumerable: true,
        get() {
          throw new Error('nope');
        },
      });
      expect(isMandatoryUpdate({ vendor })).toBe(false);
    });

    it('an update whose own vendor getter throws', () => {
      const info = {};
      Object.defineProperty(info, 'vendor', {
        enumerable: true,
        get() {
          throw new Error('nope');
        },
      });
      expect(isMandatoryUpdate(info)).toBe(false);
    });
  });
});
