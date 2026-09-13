/**
 * electron-builder's afterSign hook: whatever each platform needs once the
 * app's own files are signed and before its installer is built around them.
 *
 * - macOS: notarisation (notarize.js, unchanged).
 * - Windows: the Dynamic Lighting helper's identity package
 *   (lighting-identity.ts), which has to be signed with the same certificate
 *   and has to ship inside the installer.
 */

import type { AfterPackContext } from 'electron-builder';

import { packageLightingIdentity } from './lighting-identity';

// A CommonJS module that predates this hook; loaded as it always was.
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require -- notarize.js is plain CommonJS shared with nothing else
const notarize: {
  default: (context: AfterPackContext) => Promise<void>;
} = require('./notarize.js');

interface IWindowsSigner {
  signIf: (file: string) => Promise<boolean>;
  platformSpecificBuildOptions: {
    azureSignOptions?: unknown;
    signtoolOptions?: {
      certificateFile?: unknown;
      certificateSubjectName?: unknown;
      certificateSha1?: unknown;
    };
  };
}

const isWindowsSigner = (packager: unknown): packager is IWindowsSigner =>
  typeof packager === 'object' &&
  packager !== null &&
  typeof (packager as { signIf?: unknown }).signIf === 'function' &&
  typeof (packager as { platformSpecificBuildOptions?: unknown })
    .platformSpecificBuildOptions === 'object';

export default async function afterSign(
  context: AfterPackContext,
): Promise<void> {
  if (context.electronPlatformName === 'darwin') {
    await notarize.default(context);
    return;
  }
  if (context.electronPlatformName !== 'win32') {
    return;
  }
  const { packager } = context;
  if (!isWindowsSigner(packager)) {
    throw new Error(
      'The Windows packager has no signer, so the Dynamic Lighting identity package cannot be signed.',
    );
  }
  const options = packager.platformSpecificBuildOptions;
  // How pnpm package:signed signs (package-signed.ts), or any certificate
  // given the ordinary signtool way. Neither means an unsigned build.
  const signing = Boolean(
    options.azureSignOptions ||
    options.signtoolOptions?.certificateFile ||
    options.signtoolOptions?.certificateSubjectName ||
    options.signtoolOptions?.certificateSha1 ||
    process.env.CSC_LINK ||
    process.env.WIN_CSC_LINK,
  );
  await packageLightingIdentity({
    appOutDir: context.appOutDir,
    outDir: context.outDir,
    appVersion: context.packager.appInfo.version,
    signing,
    sign: (file) => packager.signIf(file),
  });
}
