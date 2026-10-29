/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

/**
 * The update feed key on Linux, where the Linux packages are signed: kept in
 * the account's keyring through `secret-tool`, with only a mark naming the
 * entry in the key file — never the key itself, on disk or on a command line.
 */

const mockExecFileSync = jest.fn();

jest.mock('child_process', () => ({
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
}));

/* eslint-disable import/first -- install the mock first */
import {
  KEYRING_MARK,
  libsecretCipher,
} from '../../../../.erb/scripts/update-feed-key-store';
/* eslint-enable import/first */

const KEY = 'MC4CAQAwBQYDK2VwBCIEIExampleOnlyNotARealKeyAtAllExample0000000';

beforeEach(() => {
  mockExecFileSync.mockReset();
});

describe('the update feed key in the Linux keyring', () => {
  it('hands the key to the keyring on standard input and keeps only the mark', () => {
    mockExecFileSync.mockReturnValue('');

    const sealed = libsecretCipher.protect(KEY);

    expect(sealed).toBe(KEYRING_MARK);
    expect(sealed).not.toContain(KEY);
    const [file, args, options] = mockExecFileSync.mock.calls[0];
    expect(file).toBe('secret-tool');
    expect(args[0]).toBe('store');
    expect(args.join(' ')).not.toContain(KEY);
    expect(options.input).toBe(KEY);
  });

  it('reads the key back from the keyring', () => {
    mockExecFileSync.mockReturnValue(`${KEY}\n`);

    expect(libsecretCipher.unprotect(KEYRING_MARK)).toBe(KEY);
    expect(mockExecFileSync.mock.calls[0][1][0]).toBe('lookup');
  });

  it('refuses a key file sealed on Windows, and an empty keyring', () => {
    expect(() => libsecretCipher.unprotect('AQAAANCMnd8BFdERjHoAwE')).toThrow(
      /written on Windows/,
    );
    expect(mockExecFileSync).not.toHaveBeenCalled();

    mockExecFileSync.mockReturnValue('');
    expect(() => libsecretCipher.unprotect(KEYRING_MARK)).toThrow(
      /holds no update feed key/,
    );
  });
});
