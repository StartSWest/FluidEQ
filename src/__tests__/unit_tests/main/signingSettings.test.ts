/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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
} from '../../../../.erb/scripts/package-signed';

const COMPLETE = {
  FLUIDEQ_SIGN_ENDPOINT: 'https://eus.codesigning.azure.net',
  FLUIDEQ_SIGN_ACCOUNT: 'fluideq-signing',
  FLUIDEQ_SIGN_PROFILE: 'fluideq-profile',
  FLUIDEQ_SIGN_PUBLISHER: 'Ivan Carmenates Garcia',
  AZURE_TENANT_ID: 'tenant',
  AZURE_CLIENT_ID: 'client',
  AZURE_CLIENT_SECRET: 'secret',
};

describe('reading the signing configuration', () => {
  it('says nothing is configured when nothing is', () => {
    // The ordinary case. An unsigned build must always work, on a fresh clone
    // and in CI, so an empty environment is not an error.
    expect(readSigningSettings({})).toBeUndefined();
  });

  it('reads a complete configuration', () => {
    expect(readSigningSettings(COMPLETE)).toEqual({
      endpoint: 'https://eus.codesigning.azure.net',
      codeSigningAccountName: 'fluideq-signing',
      certificateProfileName: 'fluideq-profile',
      publisherName: 'Ivan Carmenates Garcia',
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

  it('builds the overrides electron-builder expects', () => {
    // Passed on the command line rather than written into package.json,
    // because config sitting in the manifest would make every unsigned build
    // attempt to sign and fail.
    const args = toBuilderArgs(readSigningSettings(COMPLETE)!);
    expect(args).toContain(
      '--config.win.azureSignOptions.publisherName=Ivan Carmenates Garcia',
    );
    expect(args).toHaveLength(4);
    args.forEach((arg) =>
      expect(arg.startsWith('--config.win.azureSignOptions.')).toBe(true),
    );
  });
});
