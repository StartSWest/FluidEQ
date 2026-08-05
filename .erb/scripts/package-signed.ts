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
 * signed file — OV, EV or Trusted Signing alike — still has to *earn*
 * reputation through downloads that run without incident. No certificate at any
 * price buys silence on day one.
 *
 * What signing buys is worth having anyway:
 *
 *   - the "Unknown publisher" line becomes a name, which is most of the
 *     decision somebody makes at that dialog;
 *   - reputation attaches to the publisher identity rather than to one file, so
 *     it accumulates across releases instead of resetting at every version.
 *     Unsigned, 0.8.0 inherits nothing from 0.7.0.
 *
 * ## Setting it up
 *
 * Azure Artifact Signing, formerly Trusted Signing: about ten dollars a month,
 * no hardware token. Self-employed individuals in the USA and Canada have been
 * eligible without a business-history requirement since April 2026.
 *
 * Four settings describe the account. None are secret:
 *
 *   FLUIDEQ_SIGN_ENDPOINT   e.g. https://eus.codesigning.azure.net
 *   FLUIDEQ_SIGN_ACCOUNT    the Trusted Signing account name
 *   FLUIDEQ_SIGN_PROFILE    the certificate profile name
 *   FLUIDEQ_SIGN_PUBLISHER  exactly as it appears in the certificate
 *
 * Three are credentials and belong nowhere near the repository:
 *
 *   AZURE_TENANT_ID
 *   AZURE_CLIENT_ID
 *   AZURE_CLIENT_SECRET
 *
 * `FLUIDEQ_SIGN_PUBLISHER` must match the certificate subject exactly. If it
 * does not, the build signs happily and the auto-updater then refuses every
 * update it downloads, because electron-updater verifies the publisher name
 * against the signature — a failure that appears months later and looks like a
 * broken updater rather than a typo.
 */

import { spawn } from 'child_process';

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

  console.log(`Signing as: ${settings.publisherName}`);
  const child = spawn('pnpm', ['package', ...toBuilderArgs(settings)], {
    stdio: 'inherit',
    shell: true,
  });
  child.on('exit', (code) => process.exit(code ?? 1));
}
