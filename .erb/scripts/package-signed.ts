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
 * Seven environment variables: four that name the signing account and three
 * that are credentials. Their names are in SETTINGS and CREDENTIALS below,
 * which is the only place this file needs them written down.
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

import { fetchEqualizerApoSource } from './fetch-equalizer-apo';

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

const CREDENTIALS = [
  'AZURE_TENANT_ID',
  'AZURE_CLIENT_ID',
  'AZURE_CLIENT_SECRET',
];

/** Every setting, or nothing — a half-configured signer is worse than none. */
export const readSigningSettings = (
  env: NodeJS.ProcessEnv = process.env,
): ISigningSettings | undefined => {
  const missing = [...Object.values(SETTINGS), ...CREDENTIALS].filter(
    (name) => !env[name],
  );

  if (missing.length === Object.values(SETTINGS).length + CREDENTIALS.length) {
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

  return {
    endpoint: env[SETTINGS.endpoint] as string,
    codeSigningAccountName: env[SETTINGS.codeSigningAccountName] as string,
    certificateProfileName: env[SETTINGS.certificateProfileName] as string,
    publisherName: env[SETTINGS.publisherName] as string,
  };
};

export const toBuilderArgs = (settings: ISigningSettings): string[] =>
  Object.entries(settings).map(
    ([key, value]) => `--config.win.azureSignOptions.${key}=${value}`,
  );

if (require.main === module) {
  let settings: ISigningSettings | undefined;
  try {
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

  const signing = settings;

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

    console.log(`Signing as: ${signing.publisherName}`);
    console.log(`Publish this alongside the installer: ${apoSource}`);

    const child = spawn('pnpm', ['package', ...toBuilderArgs(signing)], {
      stdio: 'inherit',
      shell: true,
    });
    child.on('exit', (code) => process.exit(code ?? 1));
  })();
}
