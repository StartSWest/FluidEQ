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
  readSigningSettings,
  toBuilderArgs,
  verifyUpdateConfig,
} from '../../../../.erb/scripts/package-signed';
import manifest from '../../../../package.json';

const COMPLETE = {
  FLUIDEQ_SIGN_ENDPOINT: 'https://eus.codesigning.azure.net',
  FLUIDEQ_SIGN_ACCOUNT: 'fluideq-signing',
  FLUIDEQ_SIGN_PROFILE: 'fluideq-profile',
  FLUIDEQ_SIGN_PUBLISHER: 'Ivan Carmenates Garcia',
  FLUIDEQ_UPDATE_URL: 'https://updates.example.com/fluideq/',
  AZURE_TENANT_ID: 'tenant',
  AZURE_CLIENT_ID: 'client',
  AZURE_CLIENT_SECRET: 'secret',
};

const SETTINGS = readSigningSettings(COMPLETE)!;

describe('reading the signing configuration', () => {
  it('says nothing is configured when nothing is', () => {
    // The ordinary case. An unsigned build must always work, on a fresh clone
    // and in CI, so an empty environment is not an error.
    expect(readSigningSettings({})).toBeUndefined();
  });

  it('reads a complete configuration', () => {
    expect(readSigningSettings(COMPLETE)).toEqual({
      signing: {
        endpoint: 'https://eus.codesigning.azure.net',
        codeSigningAccountName: 'fluideq-signing',
        certificateProfileName: 'fluideq-profile',
        publisherName: 'Ivan Carmenates Garcia',
      },
      updateUrl: 'https://updates.example.com/fluideq/',
    });
  });

  it.each(Object.keys(COMPLETE))('refuses when %s is missing', (name) => {
    // Half a configuration is the dangerous state: it looks set up, and
    // whichever piece is absent fails somewhere far from here — a missing
    // credential during the build, a missing publisher months later when the
    // updater silently rejects every download it verifies.
    const partial = { ...COMPLETE };
    delete (partial as Record<string, string>)[name];
    expect(() => readSigningSettings(partial)).toThrow(/partly configured/);
  });

  it('names what is missing, rather than only complaining', () => {
    expect(() =>
      readSigningSettings({ FLUIDEQ_SIGN_ENDPOINT: 'https://x' }),
    ).toThrow(/AZURE_CLIENT_SECRET/);
  });

  it.each([
    'http://updates.example.com/fluideq/',
    'https://user:password@updates.example.com/fluideq/',
    'not a URL',
  ])('refuses the unsafe update URL %s', (updateUrl) => {
    expect(() =>
      readSigningSettings({ ...COMPLETE, FLUIDEQ_UPDATE_URL: updateUrl }),
    ).toThrow(/HTTPS URL/);
  });

  it('builds the overrides electron-builder expects', () => {
    // Passed on the command line rather than written into package.json,
    // because config sitting in the manifest would make every unsigned build
    // attempt to sign and fail.
    const args = toBuilderArgs(SETTINGS);
    expect(args).toContain(
      '--config.win.azureSignOptions.publisherName=Ivan Carmenates Garcia',
    );
    expect(
      args.filter((arg) => arg.startsWith('--config.win.azureSignOptions.')),
    ).toHaveLength(4);
  });

  it('adds the generic feed only for the signed build', () => {
    // The base manifest has no provider at all. The signing script must add the
    // generic feed explicitly rather than letting an ordinary package inherit
    // any update capability.
    const args = toBuilderArgs(SETTINGS);
    expect(args).toContain('--config.publish.provider=generic');
    expect(args).toContain(
      '--config.publish.url=https://updates.example.com/fluideq/',
    );
  });
});

describe('checking what the built app will do when it updates', () => {
  const good = [
    'provider: generic',
    'url: https://updates.example.com/fluideq/',
    'publisherName: Ivan Carmenates Garcia',
    'updaterCacheDirName: fluideq-app-updater',
  ].join('\n');

  it('passes a correctly configured build', () => {
    expect(verifyUpdateConfig(good, SETTINGS)).toEqual([]);
  });

  it('fails a build whose updater verifies nothing', () => {
    // No publisherName means NsisUpdater.verifySignature returns early without
    // checking anything, and an unsigned installer would be accepted. The
    // installer looks perfect; only a user finds out, much later.
    const yaml = good.replace(/^publisherName:.*$/m, '');
    expect(verifyUpdateConfig(yaml, SETTINGS)).toEqual([
      expect.stringContaining('no publisherName'),
    ]);
  });

  it('fails a build signed as somebody else', () => {
    const yaml = good.replace(
      'publisherName: Ivan Carmenates Garcia',
      'publisherName: Ivan Carmenates',
    );
    expect(verifyUpdateConfig(yaml, SETTINGS)).toEqual([
      expect.stringContaining('would be rejected'),
    ]);
  });

  it('fails a signed build still pointed at GitHub', () => {
    const yaml = good.replace('provider: generic', 'provider: github');
    expect(verifyUpdateConfig(yaml, SETTINGS)).toEqual([
      expect.stringContaining('must'),
    ]);
  });

  it('reads a publisher name the writer quoted', () => {
    // electron-builder quotes values that need it, and a name with a comma in
    // it — which a certificate subject may well have — comes back quoted.
    const yaml = good.replace(
      'publisherName: Ivan Carmenates Garcia',
      'publisherName: "Ivan Carmenates Garcia"',
    );
    expect(verifyUpdateConfig(yaml, SETTINGS)).toEqual([]);
  });

  it('fails a build pointed at a different generic feed', () => {
    const yaml = good.replace(
      'url: https://updates.example.com/fluideq/',
      'url: https://somewhere-else.example.com/',
    );
    expect(verifyUpdateConfig(yaml, SETTINGS)).toEqual([
      expect.stringContaining('somewhere-else.example.com'),
    ]);
  });
});

describe('the unsigned package manifest', () => {
  it('contains no GitHub or other update provider', () => {
    const build = manifest.build as typeof manifest.build & {
      publish?: { provider?: string };
    };
    expect(build.publish).toBeUndefined();
    expect(JSON.stringify(build)).not.toContain('"provider":"github"');
  });
});
