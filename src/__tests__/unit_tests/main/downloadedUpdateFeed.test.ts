/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createHash, generateKeyPairSync, sign } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  FEED_KEY_FIELD,
  FEED_SIGNATURE_FIELD,
  feedSha512s,
  updateFeedMessage,
  verifyDownloadedUpdateFeed,
  verifyUpdateFeedSignature,
} from '../../../main/updateFeedSignature';

const maker = generateKeyPairSync('ed25519');
const keys = {
  maker: maker.publicKey
    .export({ type: 'spki', format: 'der' })
    .toString('base64'),
};
const installer = Buffer.from('the installer the maker released');
const otherInstaller = Buffer.from(
  'an installer substituted at the release host',
);
const sha512 = (bytes: Buffer, encoding: 'base64' | 'hex' = 'base64') =>
  createHash('sha512').update(bytes).digest(encoding);
const signed = (fields: Record<string, unknown>) => {
  const info = { version: '2.4.0', ...fields };
  return {
    ...info,
    [FEED_KEY_FIELD]: 'maker',
    [FEED_SIGNATURE_FIELD]: sign(
      null,
      Buffer.from(updateFeedMessage(info.version, feedSha512s(info))),
      maker.privateKey,
    ).toString('base64'),
  };
};

describe('binding a signed feed to the downloaded installer', () => {
  let directory: string;
  let downloadedFile: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-feed-bytes-'));
    downloadedFile = path.join(directory, 'installer.exe');
    fs.writeFileSync(downloadedFile, installer);
  });

  afterEach(() => {
    if (
      path.dirname(directory) !== os.tmpdir() ||
      !path.basename(directory).startsWith('fluideq-feed-bytes-')
    ) {
      throw new Error('Unexpected fixture directory');
    }
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it.each(['base64', 'hex'] as const)(
    'accepts the released bytes with a signed %s SHA-512',
    async (encoding) => {
      const info = signed({
        files: [{ url: 'installer.exe', sha512: sha512(installer, encoding) }],
        sha512: sha512(installer, encoding),
      });
      await expect(
        verifyDownloadedUpdateFeed(info, downloadedFile, keys),
      ).resolves.toEqual({ valid: true });
    },
  );

  it('accepts legacy top-level hashes and a legitimate selected file in a multi-file feed', async () => {
    await Promise.all(
      [
        signed({ sha512: sha512(installer) }),
        signed({
          files: [
            { url: 'other-architecture.exe', sha512: sha512(otherInstaller) },
            { url: 'installer.exe', sha512: sha512(installer) },
          ],
        }),
      ].map((info) =>
        expect(
          verifyDownloadedUpdateFeed(info, downloadedFile, keys),
        ).resolves.toEqual({ valid: true }),
      ),
    );
  });

  it('rejects a SHA-256-only file substituted beside the unchanged signed top-level SHA-512', async () => {
    const info = {
      ...signed({ sha512: sha512(installer) }),
      files: [
        {
          url: 'substituted.exe',
          sha2: createHash('sha256').update(otherInstaller).digest('hex'),
        },
      ],
    };
    // This is the original bypass: v1 still authenticates the feed, while
    // electron-updater selects bytes identified only by the attacker's sha2.
    expect(verifyUpdateFeedSignature(info, keys)).toEqual({ valid: true });
    fs.writeFileSync(downloadedFile, otherInstaller);
    await expect(
      verifyDownloadedUpdateFeed(info, downloadedFile, keys),
    ).resolves.toMatchObject({
      valid: false,
      reason: expect.stringContaining('installer'),
    });
  });

  it('rejects replaced cache bytes even when the selected files[] entry has the genuine SHA-512', async () => {
    const info = signed({ files: [{ sha512: sha512(installer) }] });
    fs.writeFileSync(downloadedFile, otherInstaller);
    await expect(
      verifyDownloadedUpdateFeed(info, downloadedFile, keys),
    ).resolves.toMatchObject({ valid: false });
  });

  it('rejects bytes whose hash was inserted after signing, a missing file, and an unsigned feed', async () => {
    const info = signed({ sha512: sha512(otherInstaller) });
    await expect(
      verifyDownloadedUpdateFeed(
        { ...info, sha512: sha512(installer) },
        downloadedFile,
        keys,
      ),
    ).resolves.toMatchObject({ valid: false });
    await expect(
      verifyDownloadedUpdateFeed(
        info,
        path.join(directory, 'missing.exe'),
        keys,
      ),
    ).resolves.toMatchObject({ valid: false });
    await expect(
      verifyDownloadedUpdateFeed(
        { version: '2.4.0', sha512: sha512(installer) },
        downloadedFile,
        keys,
      ),
    ).resolves.toMatchObject({ valid: false });
  });

  it('preserves the explicit compatibility mode for builds that trust no feed key', async () => {
    await expect(
      verifyDownloadedUpdateFeed({}, path.join(directory, 'missing.exe'), {}),
    ).resolves.toEqual({ valid: true });
  });
});
