/**
 * Build the bridge: the one unsigned 2.5 that carries 2.4.x onto the signed
 * line.
 *
 * Installed 2.4.x copies update from `latest.yml` in the newest GitHub
 * release and refuse any installer that is signed — that is compiled into
 * them (cdd99960f) and cannot be changed from here. So the release carries,
 * beside the signed installer and `signed.yml`, this build and its own
 * `latest.yml`: unsigned, feed-signed, versioned `<release>-bridge`, exactly
 * what 2.4.x accepts. Its own updater is the signed one, told by
 * `FLUIDEQ_UPDATE_BRIDGE` that it is the bridge: it checks that it is itself
 * unsigned, reads `signed.yml`, installs only what the pinned publisher signed
 * and the feed key vouches for, and moves over at its first check.
 *
 * Needs `FLUIDEQ_SIGN_PUBLISHER` — the publisher it hands over to — and
 * nothing else of the signing set: nothing here is signed. The feed key signs
 * `latest.yml` at the end, as for any release.
 *
 * The same bridge is uploaded again with every later release (unchanged
 * bytes), so a 2.4 copy left closed for months still crosses.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import { pnpmLauncher } from './package-signed';
import { readFeed, signReleaseFeed } from './sign-update-feed';
import { bridgeVersionOf } from '../../src/common/updateChannel';
// eslint-disable-next-line import/no-relative-packages -- the version being bridged to is the app package's own
import { version as releaseVersion } from '../../release/app/package.json';

export const BRIDGE_FEED_YML = 'release/build/latest.yml';

export interface IBridgeSettings {
  publisherName: string;
  bridgeVersion: string;
}

/** What the bridge needs, or a reason it cannot be built. */
export const readBridgeSettings = (
  env: NodeJS.ProcessEnv,
  version: string,
): IBridgeSettings => {
  const publisherName = (env.FLUIDEQ_SIGN_PUBLISHER || '').trim();
  if (!publisherName) {
    throw new Error(
      'FLUIDEQ_SIGN_PUBLISHER is not set. The bridge accepts only installers ' +
        'signed by that publisher; without it, it would update to nothing.',
    );
  }
  return { publisherName, bridgeVersion: bridgeVersionOf(version) };
};

/** The environment `pnpm package` runs with: the pins main compiles in. */
export const bridgeEnv = (
  env: NodeJS.ProcessEnv,
  settings: IBridgeSettings,
): NodeJS.ProcessEnv => ({
  ...env,
  FLUIDEQ_SIGN_PUBLISHER: settings.publisherName,
  FLUIDEQ_UPDATE_BRIDGE: '1',
  // What the window and main show: webpack's EnvironmentPlugin takes it
  // over the default `public-env.ts` reads from the app package.
  FLUIDEQ_VERSION: settings.bridgeVersion,
});

/** electron-builder's own version, so the installer and its feed carry it. */
export const bridgeBuilderArgs = (settings: IBridgeSettings): string[] => [
  `--config.extraMetadata.version=${settings.bridgeVersion}`,
];

/**
 * What the build produced, read back: a `latest.yml` for the bridge's
 * version naming an installer that exists. Anything else would hand 2.4.x a
 * feed that leads nowhere, and nobody would notice until nobody updated.
 */
export const verifyBridgeOutput = (
  yaml: string,
  settings: IBridgeSettings,
  installerExists: (fileName: string) => boolean,
): string[] => {
  const problems: string[] = [];
  const { version } = readFeed(yaml);
  if (version !== settings.bridgeVersion) {
    problems.push(
      `latest.yml says version ${version || 'none'}, not ${settings.bridgeVersion}.`,
    );
  }
  const file = yaml.match(/^path:\s*['"]?([^'"\r\n]+?)['"]?\s*$/m)?.[1];
  if (!file) {
    problems.push('latest.yml names no installer.');
  } else if (!file.includes(settings.bridgeVersion)) {
    problems.push(`latest.yml names ${file}, not the bridge's installer.`);
  } else if (!installerExists(file)) {
    problems.push(`latest.yml names ${file}, which was not built.`);
  }
  return problems;
};

if (require.main === module) {
  let settings: IBridgeSettings;
  try {
    settings = readBridgeSettings(process.env, releaseVersion);
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
  const bridge = settings;

  // The same launcher the signed build uses: pnpm 11 is a native pnpm.exe,
  // not a script for node to run.
  const pnpm = pnpmLauncher(process.env.npm_execpath, process.execPath);
  if (!pnpm) {
    console.error(
      'Cannot locate the pnpm that started this build. Run it as ' +
        '"pnpm package:bridge".',
    );
    process.exit(1);
  }

  console.log(
    `Bridge ${bridge.bridgeVersion}: unsigned, hands over to installers signed by "${bridge.publisherName}".`,
  );
  if (process.env.FLUIDEQ_UPDATE_URL) {
    console.log(
      `TEST FEED: hands over from ${process.env.FLUIDEQ_UPDATE_URL}, not the public releases. Do not publish it.`,
    );
  }

  const child = spawn(
    pnpm.command,
    [...pnpm.prefix, 'package', ...bridgeBuilderArgs(bridge)],
    { stdio: 'inherit', env: bridgeEnv(process.env, bridge) },
  );
  child.on('exit', (code) => {
    if (code !== 0) {
      process.exit(code ?? 1);
      return;
    }
    let yaml: string;
    try {
      yaml = fs.readFileSync(BRIDGE_FEED_YML, 'utf8');
    } catch {
      console.error(`${BRIDGE_FEED_YML} was not built. Do not ship this.`);
      process.exit(1);
      return;
    }
    const problems = verifyBridgeOutput(yaml, bridge, (file) =>
      fs.existsSync(path.join(path.dirname(BRIDGE_FEED_YML), file)),
    );
    if (problems.length > 0) {
      console.error(
        `\nThe bridge was built, but 2.4.x could not follow it:\n\n${problems
          .map((line) => `  - ${line}`)
          .join('\n')}\n\nDo not ship this build.`,
      );
      process.exit(1);
      return;
    }
    process.exit(signReleaseFeed({ feedPath: BRIDGE_FEED_YML }) ? 0 : 1);
  });
}
