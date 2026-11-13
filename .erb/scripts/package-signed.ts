/**
 * Build a signed installer.
 *
 * Separate from `pnpm package` on purpose. Signing configuration cannot simply
 * live in `package.json`, because electron-builder would then try to sign every
 * build — and every build without Azure credentials would fail. That includes
 * the weekly cold build, anyone who clones the repo, and this machine on any
 * day the certificate is not to hand. An unsigned build must stay the default
 * and must always work.
 *
 * So the settings are passed as CLI overrides, and only when a full set of them
 * exists.
 *
 * ## What SmartScreen actually does
 *
 * Read this before expecting the warning to disappear, because it will not.
 *
 * Microsoft removed EV certificates' automatic reputation in 2024. Today a
 * signed file — OV, EV or cloud-signed alike — still has to *earn* reputation
 * through downloads that run without incident. No certificate at any price
 * buys silence on day one.
 *
 * What signing buys is worth having anyway:
 *
 *   - the "Unknown publisher" line becomes a name, which is most of the
 *     decision somebody makes at that dialog;
 *   - reputation attaches to the publisher identity rather than to one file, so
 *     it accumulates across releases instead of resetting at every version.
 *     Unsigned, 0.8.0 inherits nothing from 0.7.0.
 *
 * ## Configuration
 *
 * Eight environment variables: four that name the signing account, one that
 * repeats its certificate's full subject, and three that are credentials.
 * Their names are in SETTINGS, SUBJECT_VARIABLE and CREDENTIALS below, which
 * is the only place this file needs them written down. All eight or none.
 *
 * Where the build updates from is not one of them: the public feed
 * (`SIGNED_UPDATE_FEED_URL`, `signed.yml` in the GitHub releases) is in the
 * code. `FLUIDEQ_UPDATE_URL`, when set, replaces it — only for a build made
 * to test the crossing against a test repository, and said out loud.
 *
 * The full subject (`CN=…, O=…, L=…, S=…, C=…`, exactly as Windows shows it
 * for the certificate) is separate from the publisher name because Windows
 * needs all of it in two places before anything is signed: compiled into the
 * Dynamic Lighting helper, and written into that helper's identity package.
 * lighting-identity.ts checks it against the signature the build produced and
 * refuses the release when they differ.
 *
 * Which provider issues them, what an account costs and how to obtain one are
 * deliberately not here. This repository is public and that is the recipe for
 * producing the signed build that is sold, so it lives in the project's
 * private notes instead.
 *
 * `FLUIDEQ_SIGN_PUBLISHER` must match the certificate subject exactly. If it
 * does not, the build signs happily and the auto-updater then refuses every
 * update it downloads, because electron-updater verifies the publisher name
 * against the signature — a failure that appears months later and looks like a
 * broken updater rather than a typo.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import {
  APO_INSTALLER_SHA256,
  fetchEqualizerApoSource,
} from './fetch-equalizer-apo';
import { SUBJECT_VARIABLE } from './lighting-identity';
import { readMandatoryUpdateArgs } from './mandatory-update';
import {
  commonNameOf,
  IPackagedEngine,
  packagedEngineProblems,
  readAuthenticode,
  SIGN_ENGINE_VARIABLE,
} from './sign-engine';
import { signReleaseFeed } from './sign-update-feed';
import {
  SIGNED_UPDATE_CHANNEL,
  SIGNED_UPDATE_FEED_URL,
} from '../../src/common/updateChannel';

interface ISigningSettings {
  endpoint: string;
  codeSigningAccountName: string;
  certificateProfileName: string;
  publisherName: string;
}

const SETTINGS: Record<keyof ISigningSettings, string> = {
  endpoint: 'FLUIDEQ_SIGN_ENDPOINT',
  codeSigningAccountName: 'FLUIDEQ_SIGN_ACCOUNT',
  certificateProfileName: 'FLUIDEQ_SIGN_PROFILE',
  publisherName: 'FLUIDEQ_SIGN_PUBLISHER',
};

/**
 * A test feed in place of the public one, for a build made to test the
 * crossing. Empty for a release. Compiled into main as well (webpack's
 * EnvironmentPlugin reads the same variable), so the app and its
 * `app-update.yml` agree.
 */
const UPDATE_URL = 'FLUIDEQ_UPDATE_URL';

/** Set only by `pnpm package:bridge`; a signed build is never the bridge. */
const BRIDGE_PIN = 'FLUIDEQ_UPDATE_BRIDGE';

/** Where electron-builder leaves the signed line's feed. */
export const SIGNED_FEED_YML = `release/build/${SIGNED_UPDATE_CHANNEL}.yml`;

export interface IReleaseSettings {
  signing: ISigningSettings;
  updateUrl: string;
}

const REQUIRED = [...Object.values(SETTINGS), SUBJECT_VARIABLE];

const CREDENTIALS = [
  'AZURE_TENANT_ID',
  'AZURE_CLIENT_ID',
  'AZURE_CLIENT_SECRET',
];

/** Every setting, or nothing — a half-configured signer is worse than none. */
export const readSigningSettings = (
  env: NodeJS.ProcessEnv = process.env,
): IReleaseSettings | undefined => {
  const missing = [...REQUIRED, ...CREDENTIALS].filter((name) => !env[name]);

  if (missing.length === REQUIRED.length + CREDENTIALS.length) {
    // Nothing set at all, which is the ordinary case and not an error.
    return undefined;
  }
  if (missing.length > 0) {
    throw new Error(
      `Signing is partly configured, which is almost certainly a mistake.\n` +
        `Missing: ${missing.join(', ')}\n` +
        `Set all of them, or none of them and build unsigned with "pnpm package".`,
    );
  }

  if (env[BRIDGE_PIN]) {
    throw new Error(
      `${BRIDGE_PIN} is set: that builds the unsigned bridge (pnpm package:bridge), ` +
        'never a signed release. Unset it.',
    );
  }

  let updateUrl: URL;
  try {
    updateUrl = new URL(env[UPDATE_URL] || SIGNED_UPDATE_FEED_URL);
  } catch {
    throw new Error(`${UPDATE_URL} must be an absolute HTTPS URL.`);
  }
  if (
    updateUrl.protocol !== 'https:' ||
    updateUrl.username ||
    updateUrl.password
  ) {
    throw new Error(
      `${UPDATE_URL} must be an HTTPS URL with no embedded credentials.`,
    );
  }

  // The same certificate described twice: its subject has to open with the
  // publisher name, bare or quoted. Caught here, before ten minutes of build,
  // rather than by the identity check at the end of it.
  const subject = env[SUBJECT_VARIABLE] as string;
  const publisher = env[SETTINGS.publisherName] as string;
  if (commonNameOf(subject) !== publisher) {
    throw new Error(
      `${SUBJECT_VARIABLE} must be the certificate's full subject, starting ` +
        `with CN=${publisher} (from ${SETTINGS.publisherName}), for example ` +
        `"CN=${publisher}, O=${publisher}, L=City, S=State, C=US".`,
    );
  }

  return {
    signing: {
      endpoint: env[SETTINGS.endpoint] as string,
      codeSigningAccountName: env[SETTINGS.codeSigningAccountName] as string,
      certificateProfileName: env[SETTINGS.certificateProfileName] as string,
      publisherName: env[SETTINGS.publisherName] as string,
    },
    updateUrl: updateUrl.toString(),
  };
};

export const toBuilderArgs = (settings: IReleaseSettings): string[] => [
  ...Object.entries(settings.signing).map(
    ([key, value]) => `--config.win.azureSignOptions.${key}=${value}`,
  ),
  // The base manifest intentionally has no provider. Only the signed packaging
  // path adds one, and it can add only this generic HTTPS feed.
  '--config.publish.provider=generic',
  `--config.publish.url=${settings.updateUrl}`,
  // signed.yml, never latest.yml: that name carries the bridge for 2.4.x.
  `--config.publish.channel=${SIGNED_UPDATE_CHANNEL}`,
];

/**
 * How to start the pnpm that started this build again, without a shell.
 *
 * pnpm up to 10 is a JavaScript file run by Node. pnpm 11 ships as a native
 * program (`@pnpm/exe`), and `npm_execpath` names its `pnpm.exe`; accepting
 * only a script refused every signed build on it. A `.cmd` or `.ps1` shim is
 * still refused: Node will not start one without a command shell, and a shell
 * would re-parse every argument passed through it.
 */
export const pnpmLauncher = (
  execPath: string | undefined,
  nodePath: string,
): { command: string; prefix: string[] } | undefined => {
  if (!execPath) return undefined;
  const extension = path.extname(execPath).toLowerCase();
  if (['.js', '.cjs', '.mjs'].includes(extension)) {
    return { command: nodePath, prefix: [execPath] };
  }
  // A native binary: pnpm.exe on Windows, an extensionless file elsewhere.
  if (extension === '.exe' || extension === '') {
    return { command: execPath, prefix: [] };
  }
  return undefined;
};

/** Where electron-builder leaves the packaged app's resources. */
export const PACKAGED_RESOURCES = 'release/build/win-unpacked/resources';

/** The packaged engine, its helper and the APO installer, as shipped. */
const readPackagedEngine = (resources: string): IPackagedEngine => {
  const engine = path.join(resources, 'native', 'FluidEQ-Engine.dll');
  const apo = path.join(resources, 'equalizer-apo', 'equalizer-apo-setup.exe');
  return {
    engine: fs.readFileSync(engine),
    engineSignature: readAuthenticode(engine),
    helper: fs.readFileSync(
      path.join(resources, 'native', 'FluidEQ-Engine-Setup.exe'),
    ),
    apoInstaller: fs.existsSync(apo) ? fs.readFileSync(apo) : undefined,
  };
};

/** Where electron-builder leaves the updater's configuration. */
export const APP_UPDATE_YML =
  'release/build/win-unpacked/resources/app-update.yml';

/**
 * What the built app will actually do when it checks for an update.
 *
 * Everything above is an *instruction* to electron-builder; this reads back
 * what it did. The two settings that decide whether only signed builds can
 * update are both silent when they go wrong:
 *
 *   - No `publisherName` in this file and `NsisUpdater.verifySignature` returns
 *     early without verifying anything. The build is signed, the updater checks
 *     nothing, and an unsigned installer would be accepted. Nothing anywhere
 *     says so.
 *   - A `github` provider here and the signed copy asks the public repository
 *     for updates that are not on it.
 *
 * Both produce a perfectly good-looking installer, and both are only
 * discovered by a user months later who cannot update. So the build fails here
 * instead.
 */
/**
 * The publisher names app-update.yml carries.
 *
 * electron-builder writes the key as a block list, `publisherName:` and then
 * `  - Ivan Carmenates Garcia` on the next line, which is what the updater
 * reads. Reading only `key: value` took the list's dash for part of the name
 * and refused the first real signed build. A single value on the key's own
 * line is read too; a flow list (`[a, b]`) is read as one odd name, so it is
 * refused rather than half-understood.
 */
const publishersIn = (
  yaml: string,
  unquote: (raw: string | undefined) => string | undefined,
): string[] => {
  const lines = yaml.split(/\r?\n/);
  const at = lines.findIndex((line) => /^publisherName:/.test(line));
  if (at < 0) return [];
  const inline = lines[at].slice('publisherName:'.length).trim();
  if (inline) return [unquote(inline) ?? inline];
  const names: string[] = [];
  for (const line of lines.slice(at + 1)) {
    const item = line.match(/^[ \t]+-[ \t]+(.+?)[ \t]*$/);
    if (!item) break;
    names.push(unquote(item[1]) ?? item[1]);
  }
  return names;
};

export const verifyUpdateConfig = (
  yaml: string,
  settings: IReleaseSettings,
): string[] => {
  const problems: string[] = [];
  const value = (key: string) =>
    yaml.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'))?.[1];
  const unquote = (raw: string | undefined) =>
    raw?.replace(/^(["'])(.*)\1$/, '$2');

  const publishers = publishersIn(yaml, unquote);
  const expected = settings.signing.publisherName;
  if (publishers.length === 0) {
    problems.push(
      'app-update.yml has no publisherName, so the updater will not verify ' +
        'signatures at all and would accept an unsigned installer.',
    );
  } else if (publishers.length !== 1 || publishers[0] !== expected) {
    // More than one name is refused as well: the updater accepts an installer
    // signed by ANY name on the list, so a second one widens who can ship.
    problems.push(
      `app-update.yml says publisherName ${publishers
        .map((name) => `"${name}"`)
        .join(', ')}, but this build signed as "${expected}" alone. ` +
        'Updates would be rejected, or accepted from someone else.',
    );
  }

  const provider = unquote(value('provider'));
  if (provider !== 'generic') {
    problems.push(
      `app-update.yml names the "${provider}" provider. Signed builds must ` +
        'use the generic provider, since signed installers are not published ' +
        'to GitHub.',
    );
  }

  const updateUrl = unquote(value('url'));
  if (updateUrl !== settings.updateUrl) {
    problems.push(
      `app-update.yml points to "${updateUrl || 'no URL'}", but this build ` +
        `was configured for "${settings.updateUrl}".`,
    );
  }

  const channel = unquote(value('channel'));
  if (channel !== SIGNED_UPDATE_CHANNEL) {
    problems.push(
      `app-update.yml names the "${channel || 'latest'}" channel. The signed ` +
        `line reads ${SIGNED_UPDATE_CHANNEL}.yml; latest.yml belongs to the ` +
        'bridge that 2.4.x copies take.',
    );
  }

  return problems;
};

if (require.main === module) {
  let settings: IReleaseSettings | undefined;
  // Whether this release tells installed copies they have to take it. Read
  // first, and separately, because a misspelled value here has to stop the
  // build before it spends ten minutes producing a release that its author
  // believes is marked and is not. See .erb/scripts/mandatory-update.ts.
  let mandatoryArgs: string[] = [];
  try {
    mandatoryArgs = readMandatoryUpdateArgs();
    settings = readSigningSettings();
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }

  if (!settings) {
    console.error(
      'No signing configuration found, and this script only builds signed\n' +
        'installers. Set FLUIDEQ_SIGN_* and AZURE_* (see the top of\n' +
        '.erb/scripts/package-signed.ts), or run "pnpm package" for an\n' +
        'unsigned build.',
    );
    process.exit(1);
  }

  const release = settings;

  // The APO source archive is fetched here rather than in `pnpm package`.
  //
  // `package` builds the unsigned installer used for checking a change on a
  // real machine; that build is not conveyed to anyone, so it owes nobody a
  // source archive and should not pay for a download it will not use. This
  // script builds the installer that ships, and shipping it conveys Equalizer
  // APO's binary — at which point the corresponding source has to go out with
  // it. Fetching it here means the artefact that needs the archive is the one
  // that cannot be produced without it, instead of it being something to
  // remember at release time.
  //
  // The fetch is cached, so this costs nothing after the first run per version.
  (async () => {
    let apoSource: string;
    try {
      apoSource = await fetchEqualizerApoSource();
    } catch (error) {
      console.error((error as Error).message);
      process.exit(1);
      return;
    }

    console.log(`Signing as: ${release.signing.publisherName}`);
    console.log(
      `Dynamic Lighting identity publisher: ${process.env[SUBJECT_VARIABLE]}`,
    );
    console.log(
      `Updates will be fetched from: ${release.updateUrl}${SIGNED_UPDATE_CHANNEL}.yml`,
    );
    if (release.updateUrl !== SIGNED_UPDATE_FEED_URL) {
      // A test feed. Never a release: installed copies would follow it.
      console.log(
        'TEST FEED: this build updates from a test repository, not the public releases. Do not publish it.',
      );
    }
    console.log(`Publish this alongside the installer: ${apoSource}`);
    if (mandatoryArgs.length > 0) {
      // Said out loud. This is the one build setting whose effect lands on
      // other people's machines rather than on this one, and it should not be
      // possible to produce it without having seen a line about it go past.
      console.log(
        'MANDATORY RELEASE: installed copies will block themselves until they take this update.',
      );
    }

    const pnpm = pnpmLauncher(process.env.npm_execpath, process.execPath);
    if (!pnpm) {
      console.error(
        'Cannot locate the pnpm that started this build. Run it as ' +
          '"pnpm package:signed" so the signed packaging command can be ' +
          'launched without an unsafe command shell.',
      );
      process.exit(1);
      return;
    }
    const child = spawn(
      pnpm.command,
      [...pnpm.prefix, 'package', ...toBuilderArgs(release), ...mandatoryArgs],
      // The native build signs the engine before the helper takes its
      // digest (sign-engine.ts); only this build, never `pnpm package`.
      {
        stdio: 'inherit',
        env: { ...process.env, [SIGN_ENGINE_VARIABLE]: '1' },
      },
    );
    child.on('exit', (code) => {
      if (code !== 0) {
        process.exit(code ?? 1);
        return;
      }

      // The build succeeded. Whether it produced an installer whose updates can
      // actually be delivered is a different question, and this is the only
      // moment it can still be answered cheaply.
      let yaml: string;
      try {
        yaml = fs.readFileSync(APP_UPDATE_YML, 'utf8');
      } catch {
        console.error(
          `The installer was built but ${APP_UPDATE_YML} is not there, so ` +
            'there is no way to tell what it will do when it checks for an ' +
            'update. Refusing to call this a release build.',
        );
        process.exit(1);
        return;
      }

      const problems = verifyUpdateConfig(yaml, release);
      if (problems.length > 0) {
        console.error(
          `\nThe installer is signed, but it will not update correctly:\n\n` +
            problems.map((line) => `  - ${line}`).join('\n\n') +
            '\n\nDo not ship this build.',
        );
        process.exit(1);
        return;
      }

      console.log(
        `Verified: updates come from ${release.updateUrl} and must be signed ` +
          `by "${release.signing.publisherName}".`,
      );

      let engineProblems: string[];
      try {
        engineProblems = packagedEngineProblems(
          readPackagedEngine(PACKAGED_RESOURCES),
          release.signing.publisherName,
          APO_INSTALLER_SHA256,
        );
      } catch (error) {
        engineProblems = [(error as Error).message];
      }
      if (engineProblems.length > 0) {
        console.error(
          `\nThe installer is signed, but its engine is not ready to ship:\n\n` +
            engineProblems.map((line) => `  - ${line}`).join('\n\n') +
            '\n\nDo not ship this build.',
        );
        process.exit(1);
        return;
      }
      console.log(
        `Verified: the engine is signed by "${release.signing.publisherName}", ` +
          'its helper was built for it, and the Equalizer APO installer is ' +
          'the upstream file.',
      );
      process.exit(signReleaseFeed({ feedPath: SIGNED_FEED_YML }) ? 0 : 1);
    });
  })();
}
