/**
 * Sign the FluidEQ Engine DLL, before the setup helper is built beside it.
 *
 * electron-builder signs every program it packages and no DLL, so the engine
 * shipped unsigned in the signed 2.5.0, and Windows loaded a file into its
 * audio service that named nobody. It cannot be left to electron-builder: the
 * helper is compiled with the SHA-256 of every DLL it installs
 * (`shipped_dlls.cmake`) and installs nothing whose bytes differ, and
 * electron-builder signs while it packages, long after the helper was built.
 * Signed then, the engine would be refused by its own helper.
 *
 * So the native build signs it right after linking it, and builds again: the
 * digest step reads the signed file and the helper is recompiled with that
 * file's digest (`build-native-dsp.ts`, when `pnpm package:signed` sets
 * SIGN_ENGINE_VARIABLE). The engine itself is not linked again, since none of
 * its inputs changed; a file already signed by this publisher is kept as it
 * is, so a tree that has not changed reuses its signed engine.
 *
 * Only our own DLL. The C++ runtime and ONNX Runtime beside it are signed by
 * Microsoft, and putting another name on somebody else's file is not ours to
 * do.
 *
 * A signature changes the file at every signing (its timestamp is new), so
 * the app compares engines without it (`src/main/engineContent.ts`): a later
 * release that signs the same engine again offers nobody an update.
 *
 * The signing call is electron-builder's own, parameter for parameter
 * (app-builder-lib 26.15.3, `windowsSignAzureManager.js`), so the engine and
 * the programs beside it carry the same kind of signature from the same
 * account.
 */

import { createHash } from 'crypto';
import { spawnSync } from 'child_process';

/** Set by `pnpm package:signed` for the build it starts, and only there. */
export const SIGN_ENGINE_VARIABLE = 'FLUIDEQ_SIGN_ENGINE';

export interface IEngineSigning {
  endpoint: string;
  codeSigningAccountName: string;
  certificateProfileName: string;
  publisherName: string;
}

/** electron-builder's default, which the programs beside the engine get. */
export const TIMESTAMP_URL = 'http://timestamp.acs.microsoft.com';

/** The common name of a certificate subject, bare or quoted. */
export const commonNameOf = (subject: string): string | undefined => {
  const commonName = subject.match(/^CN=("(?:[^"]|"")*"|[^,]*)(?:,|$)/)?.[1];
  return commonName?.startsWith('"')
    ? commonName.slice(1, -1).replace(/""/g, '"')
    : commonName?.trim();
};

/** A PowerShell single-quoted string: nothing inside it is interpreted. */
const quoted = (value: string) => `'${value.replace(/'/g, "''")}'`;

export const trustedSigningCommand = (
  signing: IEngineSigning,
  file: string,
): string =>
  `Invoke-TrustedSigning ${[
    ['Endpoint', signing.endpoint],
    ['CertificateProfileName', signing.certificateProfileName],
    ['CodeSigningAccountName', signing.codeSigningAccountName],
    ['TimestampRfc3161', TIMESTAMP_URL],
    ['TimestampDigest', 'SHA256'],
    ['FileDigest', 'SHA256'],
    ['Files', file],
  ]
    .map(([name, value]) => `-${name} ${quoted(value)}`)
    .join(' ')}`;

/** What Windows says about a file's signature. */
export interface IAuthenticode {
  /** `Valid`, `NotSigned`, `HashMismatch`… as Get-AuthenticodeSignature says. */
  status: string;
  /** The signer certificate's subject; empty when there is none. */
  subject: string;
}

export const isSignedBy = (signature: IAuthenticode, publisher: string) =>
  signature.status === 'Valid' && commonNameOf(signature.subject) === publisher;

const powershell = (command: string) =>
  spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      // UTF-8 out, or a subject outside the console's code page comes back
      // mangled and never matches the publisher.
      `[Console]::OutputEncoding = [Text.Encoding]::UTF8; ${command}`,
    ],
    { encoding: 'utf8' },
  );

export const readAuthenticode = (file: string): IAuthenticode => {
  const result = powershell(
    `$s = Get-AuthenticodeSignature -LiteralPath ${quoted(file)}; ` +
      `[Console]::Out.Write($s.Status.ToString() + [char]10 + $s.SignerCertificate.Subject)`,
  );
  if (result.status !== 0) {
    throw new Error(
      `Could not read the signature of ${file}: ${result.stderr || result.stdout}`,
    );
  }
  const [status = '', subject = ''] = result.stdout.split('\n');
  return { status: status.trim(), subject: subject.trim() };
};

/**
 * Signs the engine unless it already carries this publisher's valid
 * signature. Throws on anything short of a file Windows reads as signed by
 * `publisherName`: a signed release must never fall back to shipping the
 * engine unsigned.
 */
export const signEngineDll = (
  file: string,
  signing: IEngineSigning,
): 'kept' | 'signed' => {
  if (isSignedBy(readAuthenticode(file), signing.publisherName)) {
    return 'kept';
  }
  // As electron-builder prepares the same module: the provider may already be
  // there, so its failure is not one; the module's is.
  powershell(
    'Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force -Scope CurrentUser',
  );
  const module = powershell(
    'Install-Module -Name TrustedSigning -MinimumVersion 0.5.0 -Force -Repository PSGallery -Scope CurrentUser',
  );
  if (module.status !== 0) {
    throw new Error(
      `Could not install the TrustedSigning module: ${module.stderr || module.stdout}`,
    );
  }
  const signed = powershell(trustedSigningCommand(signing, file));
  if (signed.status !== 0) {
    throw new Error(
      `Signing ${file} failed: ${signed.stderr || signed.stdout}`,
    );
  }
  const after = readAuthenticode(file);
  if (!isSignedBy(after, signing.publisherName)) {
    throw new Error(
      `${file} was signed but Windows reads it as ${after.status}, by ` +
        `"${after.subject || 'nobody'}", not as signed by "${signing.publisherName}".`,
    );
  }
  return 'signed';
};

export const sha256Hex = (bytes: Buffer) =>
  createHash('sha256').update(bytes).digest('hex');

/** What the release gate reads from the packaged app. */
export interface IPackagedEngine {
  /** The packaged FluidEQ-Engine.dll. */
  engine: Buffer;
  engineSignature: IAuthenticode;
  /** The packaged FluidEQ-Engine-Setup.exe. */
  helper: Buffer;
  /** The packaged Equalizer APO installer; missing is a broken release. */
  apoInstaller: Buffer | undefined;
  /** FluidEQ.exe and every FluidEQ-*.exe, which all carry our name. */
  programs: { name: string; signature: IAuthenticode }[];
  /** The other DLLs beside the engine: Microsoft's, never ours to sign. */
  runtimes: { name: string; signature: IAuthenticode }[];
}

const describeSignature = ({ status, subject }: IAuthenticode) =>
  `${status}${subject ? `, by "${subject}"` : ''}`;

/**
 * Why the packaged engine is not a signed release's, or nothing.
 *
 * Each of these comes out of a build that otherwise looks perfect: an engine
 * linked again after it was signed (so unsigned), a helper built before the
 * signing (so it refuses its own engine, and every install and update fails
 * on users' machines), and somebody else's installer carrying this
 * publisher's name. Ivan's rule (2026-11-12): "we don't ship APO signed. We
 * ship the Fluid app and the Fluid engine signed" — so every FluidEQ program
 * must carry the name, and the APO installer and the Microsoft runtimes must
 * not.
 */
export const packagedEngineProblems = (
  packaged: IPackagedEngine,
  publisher: string,
  apoInstallerSha256: string,
): string[] => {
  const problems: string[] = [];
  if (!isSignedBy(packaged.engineSignature, publisher)) {
    problems.push(
      `The packaged FluidEQ-Engine.dll reads as ${describeSignature(packaged.engineSignature)}, not as signed by "${publisher}".`,
    );
  }
  // The helper carries each DLL's digest as text (`shipped_dlls.h`).
  const digest = sha256Hex(packaged.engine);
  if (!packaged.helper.includes(Buffer.from(digest, 'ascii'))) {
    problems.push(
      `The packaged FluidEQ-Engine-Setup.exe was not built for the packaged ` +
        `engine (sha256 ${digest}): it would refuse to install it.`,
    );
  }
  if (!packaged.apoInstaller) {
    problems.push(
      'The packaged app carries no Equalizer APO installer: setup offers it.',
    );
  } else if (sha256Hex(packaged.apoInstaller) !== apoInstallerSha256) {
    problems.push(
      'The packaged Equalizer APO installer is not the upstream file byte for ' +
        'byte: something signed it, and it is not ours to sign.',
    );
  }
  if (packaged.programs.length === 0) {
    problems.push('The packaged app has no FluidEQ programs to check.');
  }
  packaged.programs
    .filter(({ signature }) => !isSignedBy(signature, publisher))
    .forEach(({ name, signature }) =>
      problems.push(
        `The packaged ${name} reads as ${describeSignature(signature)}, not as signed by "${publisher}".`,
      ),
    );
  packaged.runtimes
    .filter(
      ({ signature }) =>
        signature.status !== 'Valid' ||
        commonNameOf(signature.subject) === publisher,
    )
    .forEach(({ name, signature }) =>
      problems.push(
        `The packaged ${name} reads as ${describeSignature(signature)}: it must keep its own publisher's signature, never "${publisher}".`,
      ),
    );
  return problems;
};
