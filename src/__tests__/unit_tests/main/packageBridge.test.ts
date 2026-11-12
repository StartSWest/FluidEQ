/* FluidEQ — GPL-3.0-or-later */

import {
  bridgeBuilderArgs,
  bridgeEnv,
  readBridgeSettings,
  verifyBridgeOutput,
} from '../../../../.erb/scripts/package-bridge';
import manifest from '../../../../package.json';

const PUBLISHER = 'Ivan Carmenates Garcia';
const SETTINGS = { publisherName: PUBLISHER, bridgeVersion: '2.5.0-bridge' };

describe('what the bridge is built with', () => {
  it('needs the publisher it hands over to, and nothing it would sign with', () => {
    expect(
      readBridgeSettings({ FLUIDEQ_SIGN_PUBLISHER: PUBLISHER }, '2.5.0'),
    ).toEqual(SETTINGS);
    expect(() => readBridgeSettings({}, '2.5.0')).toThrow(
      /FLUIDEQ_SIGN_PUBLISHER/,
    );
  });

  it('compiles in the publisher, the bridge pin and its own version', () => {
    const env = bridgeEnv({ PATH: 'x', FLUIDEQ_VERSION: '2.5.0' }, SETTINGS);
    expect(env).toMatchObject({
      PATH: 'x',
      FLUIDEQ_SIGN_PUBLISHER: PUBLISHER,
      FLUIDEQ_UPDATE_BRIDGE: '1',
      FLUIDEQ_VERSION: '2.5.0-bridge',
    });
  });

  it('gives electron-builder the bridge version and nothing that signs', () => {
    const args = bridgeBuilderArgs(SETTINGS);
    expect(args).toEqual(['--config.extraMetadata.version=2.5.0-bridge']);
    expect(args.join(' ')).not.toMatch(/azureSignOptions|publish\./);
  });

  it('installs over the same app as the signed release', () => {
    // Same app id and installer settings, so the bridge and the signed copy
    // after it install over 2.4.x and keep every setting: neither script
    // overrides them.
    const args = [...bridgeBuilderArgs(SETTINGS)].join(' ');
    expect(args).not.toMatch(/appId|productName|nsis\.|perMachine/);
    expect(manifest.build.appId).toBe('com.gigabytz.fluideq');
  });
});

describe('reading back what the bridge build produced', () => {
  const feed = [
    'version: 2.5.0-bridge',
    'files:',
    '  - url: FluidEQ-Setup-2.5.0-bridge.exe',
    '    sha512: abc==',
    'path: FluidEQ-Setup-2.5.0-bridge.exe',
    'sha512: abc==',
  ].join('\n');

  it('passes a feed for the bridge that names an installer that exists', () => {
    expect(verifyBridgeOutput(feed, SETTINGS, () => true)).toEqual([]);
  });

  it('fails a feed carrying the release version, which 2.4.x would take as the release', () => {
    const yaml = feed.replace(/2\.5\.0-bridge/g, '2.5.0');
    expect(verifyBridgeOutput(yaml, SETTINGS, () => true)).toEqual([
      expect.stringContaining('not 2.5.0-bridge'),
      expect.stringContaining("not the bridge's installer"),
    ]);
  });

  it('fails a feed whose installer was not built', () => {
    expect(verifyBridgeOutput(feed, SETTINGS, () => false)).toEqual([
      expect.stringContaining('was not built'),
    ]);
  });
});
