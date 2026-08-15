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
 * says where the signed build fetches its updates from, and three that are
 * credentials. Their names are in SETTINGS, UPDATE_URL and CREDENTIALS below,
 * which is the only place this file needs them written down.
 *
 * All eight or none. There is no useful half of this: a signed build without a
 * feed cannot update, and a feed without signing is deliberately not an
 * updater-capable build at all.
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

import { fetchEqualizerApoSource } from './fetch-equalizer-apo';
import { readMandatoryUpdateArgs } from './mandatory-update';

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
 * Where signed builds look for their updates.
 *
 * The base manifest has no publish provider at all, so an unsigned build cannot
 * inherit an update source. This signed-only script is the one place that adds
 * a provider, and it always adds the generic HTTPS feed. Signing also writes
 * `publisherName` into `app-update.yml`, so electron-updater rejects any
 * downloaded installer whose Authenticode publisher does not match.
 *
 * The URL lives in the environment beside the credentials, because it names
 * where the paid build is sold from and this repository is public.
 */
const UPDATE_URL = 'FLUIDEQ_UPDATE_URL';

export interface IReleaseSettings {
  signing: ISigningSettings;
  updateUrl: string;
}

const REQUIRED = [...Object.values(SETTINGS), UPDATE_URL];

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

  let updateUrl: URL;
  try {
    updateUrl = new URL(env[UPDATE_URL] as string);
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
];

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
export const verifyUpdateConfig = (
  yaml: string,
  settings: IReleaseSettings,
): string[] => {
  const problems: string[] = [];
  const value = (key: string) =>
    yaml.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'))?.[1];
  const unquote = (raw: string | undefined) =>
    raw?.replace(/^(["'])(.*)\1$/, '$2');

  const publisher = unquote(value('publisherName'));
  if (!publisher) {
    problems.push(
      'app-update.yml has no publisherName, so the updater will not verify ' +
        'signatures at all and would accept an unsigned installer.',
    );
  } else if (publisher !== settings.signing.publisherName) {
    problems.push(
      `app-update.yml says publisherName ${publisher}, but this build signed ` +
        `as "${settings.signing.publisherName}". Updates would be rejected.`,
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
    console.log(`Updates will be fetched from: ${release.updateUrl}`);
    console.log(`Publish this alongside the installer: ${apoSource}`);
    if (mandatoryArgs.length > 0) {
      // Said out loud. This is the one build setting whose effect lands on
      // other people's machines rather than on this one, and it should not be
      // possible to produce it without having seen a line about it go past.
      console.log(
        'MANDATORY RELEASE: installed copies will block themselves until they take this update.',
      );
    }

    const pnpmScript = process.env.npm_execpath;
    if (!pnpmScript || !/\.[cm]?js$/i.test(pnpmScript)) {
      console.error(
        'Cannot locate the pnpm script that started this build. Run it as ' +
          '"pnpm package:signed" so the signed packaging command can be ' +
          'launched without an unsafe command shell.',
      );
      process.exit(1);
      return;
    }
    const child = spawn(
      process.execPath,
      [pnpmScript, 'package', ...toBuilderArgs(release), ...mandatoryArgs],
      { stdio: 'inherit' },
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
      process.exit(0);
    });
  })();
}
