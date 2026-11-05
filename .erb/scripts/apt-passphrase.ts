/** Protect the apt GPG passphrase with the same login keyring as the feed key. */
import { spawnSync } from 'child_process';

export interface IAptPassphraseStore {
  read(): string | undefined;
  write(secret: string): void;
}

export interface ISecretResult {
  status: number | null;
  stdout: string;
  error?: Error;
}
type TSecretCommand = (args: string[], input?: string) => ISecretResult;
const attributes = [
  'application',
  'fluideq-apt-repository',
  'purpose',
  'gpg-signing',
];
const command: TSecretCommand = (args, input) =>
  spawnSync('secret-tool', args, {
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

export const createAptPassphraseStore = (
  run: TSecretCommand = command,
): IAptPassphraseStore => {
  const read = () => {
    const result = run(['lookup', ...attributes]);
    if (result.error || (result.status !== 0 && result.status !== 1)) {
      // A subprocess error may carry secret stdout. Never rethrow that object.
      throw new Error(
        'The Linux login keyring could not read the apt signing passphrase.',
      );
    }
    if (result.status === 1 && !result.stdout) {
      return undefined;
    }
    const secret = result.stdout.trim();
    if (result.status !== 0 || !/^[a-f0-9]{64}$/.test(secret)) {
      throw new Error(
        'The Linux login keyring holds an invalid apt signing passphrase.',
      );
    }
    return secret;
  };
  return {
    read,
    write: (secret) => {
      if (!/^[a-f0-9]{64}$/.test(secret)) {
        throw new Error('Apt signing requires a generated 256-bit passphrase.');
      }
      const result = run(
        [
          'store',
          '--label=FluidEQ apt repository signing passphrase',
          ...attributes,
        ],
        secret,
      );
      if (result.error || result.status !== 0 || read() !== secret) {
        throw new Error(
          'The Linux login keyring did not safely retain the apt signing passphrase.',
        );
      }
    },
  };
};
