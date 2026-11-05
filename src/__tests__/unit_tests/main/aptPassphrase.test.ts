/** @jest-environment node */
import { createAptPassphraseStore } from '../../../../.erb/scripts/apt-passphrase';

const secret = 'a1'.repeat(32);

it('keeps the generated passphrase in Secret Service through stdin and verifies the stored value', () => {
  let stored: string | undefined;
  const calls: { args: string[]; input?: string }[] = [];
  const store = createAptPassphraseStore((args, input) => {
    calls.push({ args, input });
    if (args[0] === 'store') {
      stored = input;
      return { status: 0, stdout: '' };
    }
    return stored ? { status: 0, stdout: stored } : { status: 1, stdout: '' };
  });
  expect(store.read()).toBeUndefined();
  store.write(secret);
  expect(store.read()).toBe(secret);
  expect(calls.find((call) => call.args[0] === 'store')?.input).toBe(secret);
  expect(
    calls.every((call) => !call.args.some((arg) => arg.includes(secret))),
  ).toBe(true);
  expect(
    calls.every((call) => call.args.includes('fluideq-apt-repository')),
  ).toBe(true);
});

it('refuses failed or lossy keyring writes instead of falling back to an unprotected key', () => {
  const failed = createAptPassphraseStore(() => ({ status: 1, stdout: '' }));
  expect(() => failed.write(secret)).toThrow(/did not safely retain/);
  const lossy = createAptPassphraseStore((args) => ({
    status: 0,
    stdout: args[0] === 'lookup' ? 'b2'.repeat(32) : '',
  }));
  expect(() => lossy.write(secret)).toThrow(/did not safely retain/);
  expect(() => lossy.write('')).toThrow(/256-bit/);
});

it('does not expose secret stdout or subprocess errors when the keyring fails', () => {
  const store = createAptPassphraseStore(() => ({
    status: null,
    stdout: secret,
    error: new Error(secret),
  }));
  let failure: unknown;
  try {
    store.read();
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(Error);
  expect(String(failure)).toContain('could not read');
  expect(String(failure)).not.toContain(secret);
});
