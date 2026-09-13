/**
 * The Dynamic Lighting helper's identity package, built into a signed release.
 *
 * Windows lets an app light devices while it is behind other windows only
 * when the app has package identity and declares the lighting extension (see
 * native/lighting-host/src/identity.h). FluidEQ is not a packaged app, so the
 * installer carries a small signed package with nothing in it but a manifest
 * — "packaging with external location" — that names the helper, in the folder
 * it is installed to, as its application. The app registers it for the person
 * at the desk the first time lighting is switched on
 * (src/main/lighting/lightingIdentity.ts).
 *
 * Three values have to agree character for character, and every mismatch
 * fails silently on somebody else's machine — registration succeeds, the
 * helper runs, and Windows simply lights nothing while FluidEQ is in the
 * background:
 *
 *   - the package's Publisher and the certificate that signs it;
 *   - the package's Publisher and the `msix` element embedded in the helper
 *     when it was compiled, from FLUIDEQ_SIGN_SUBJECT;
 *   - the package's name and application id, and that same element.
 *
 * So this step reads all three back from what was actually built and signed,
 * and fails the release when any of them differ.
 *
 * Runs from electron-builder's afterSign hook, after the helper has been
 * signed and before the installer is assembled around the app folder, so the
 * package it writes beside the helper ships. An unsigned build writes no
 * package — one nobody can register is worse than none — and falls back on the
 * bare manifest every native build leaves beside the helper
 * (`writeDevelopmentIdentity`), which Windows registers only with Developer
 * Mode on. Without either the helper lights nothing through Windows, not even
 * with FluidEQ in front: Windows gives an app in front's lamps to the process
 * owning that window, and the helper owns none.
 */

import { spawnSync } from 'child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import path from 'path';

import { packageVersionOf } from '../../src/main/lighting/lightingIdentity';
import {
  LIGHTING_APPLICATION_ID,
  LIGHTING_ASSETS_FOLDER,
  LIGHTING_EXECUTABLE_NAME,
  LIGHTING_IDENTITY_PACKAGE,
  LIGHTING_PACKAGE_NAME,
} from '../../src/main/lighting/lightingPath';

/** Where the signing certificate's full subject is given to the build. */
export const SUBJECT_VARIABLE = 'FLUIDEQ_SIGN_SUBJECT';

const escapeXml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const unescapeXml = (text: string): string =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

export interface IIdentityManifest {
  /** The signing certificate's subject, exactly as Windows reports it. */
  publisher: string;
  /** The app's version; the package carries it in four parts. */
  appVersion: string;
}

/**
 * The identity package's manifest, after Microsoft's template for packaging
 * with external location, plus the one extension Dynamic Lighting asks for.
 *
 * - Neutral architecture: the package describes a folder, not a binary.
 * - `AppListEntry="none"`: nothing appears in Start or in installed apps.
 * - Image paths resolve in the install folder, not in the package, which is
 *   why they point into the assets folder shipped beside the helper.
 * - `com.microsoft.windows.lighting` is what lists FluidEQ under Background
 *   light control in Windows' Dynamic Lighting settings, where the member
 *   drags it to the top; `PublicFolder` is optional in the schema, kept
 *   because every Microsoft sample and Razer's own package carry it.
 * - Windows 11 22H2 (22621) at least: background lighting does not exist
 *   before it, and registering on Windows 10 would promise it.
 */
export const identityManifest = ({
  publisher,
  appVersion,
}: IIdentityManifest): string => {
  const asset = (name: string) =>
    escapeXml(`${LIGHTING_ASSETS_FOLDER}\\${name}`);
  return `<?xml version="1.0" encoding="utf-8"?>
<Package IgnorableNamespaces="uap uap3 uap10 rescap"
  xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  xmlns:uap3="http://schemas.microsoft.com/appx/manifest/uap/windows10/3"
  xmlns:uap10="http://schemas.microsoft.com/appx/manifest/uap/windows10/10"
  xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities">
  <Identity Name="${escapeXml(LIGHTING_PACKAGE_NAME)}" Publisher="${escapeXml(publisher)}" Version="${packageVersionOf(appVersion)}" ProcessorArchitecture="neutral" />
  <Properties>
    <DisplayName>FluidEQ</DisplayName>
    <PublisherDisplayName>FluidEQ</PublisherDisplayName>
    <Logo>${asset('64x64.png')}</Logo>
    <uap10:AllowExternalContent>true</uap10:AllowExternalContent>
  </Properties>
  <Resources>
    <Resource Language="en-us" />
  </Resources>
  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.22621.0" MaxVersionTested="10.0.26100.0" />
  </Dependencies>
  <Capabilities>
    <rescap:Capability Name="runFullTrust" />
    <rescap:Capability Name="unvirtualizedResources" />
  </Capabilities>
  <Applications>
    <Application Id="${escapeXml(LIGHTING_APPLICATION_ID)}" Executable="${escapeXml(LIGHTING_EXECUTABLE_NAME)}" uap10:TrustLevel="mediumIL" uap10:RuntimeBehavior="win32App">
      <uap:VisualElements AppListEntry="none" DisplayName="FluidEQ" Description="FluidEQ Dynamic Lighting" BackgroundColor="transparent" Square150x150Logo="${asset('256x256.png')}" Square44x44Logo="${asset('48x48.png')}" />
      <Extensions>
        <uap3:Extension Category="windows.appExtension">
          <uap3:AppExtension Name="com.microsoft.windows.lighting" Id="${escapeXml(LIGHTING_APPLICATION_ID)}" DisplayName="FluidEQ" PublicFolder="public" />
        </uap3:Extension>
      </Extensions>
    </Application>
  </Applications>
</Package>
`;
};

/** The publisher native/CMakeLists.txt embeds when no release is being signed. */
export const DEVELOPMENT_PUBLISHER = 'CN=FluidEQ Development';

/**
 * The bare identity manifest beside a freshly built helper, for copies with
 * no signed package: `identity register-dev` registers it from its own folder
 * with Developer Mode on, the external location being the helper's folder.
 * Its publisher is whatever the helper was compiled with — FLUIDEQ_SIGN_SUBJECT
 * in a release build, the development name otherwise — so the two always
 * match. The pictures Windows shows go beside it, as in an installed copy.
 */
export const writeDevelopmentIdentity = (
  helperFolder: string,
  appVersion: string,
  iconsFolder: string,
  publisher: string = process.env[SUBJECT_VARIABLE] || DEVELOPMENT_PUBLISHER,
): string => {
  const manifestFolder = path.join(helperFolder, 'lighting-identity');
  mkdirSync(manifestFolder, { recursive: true });
  const manifest = path.join(manifestFolder, 'AppxManifest.xml');
  writeFileSync(manifest, identityManifest({ publisher, appVersion }), 'utf8');
  const assets = path.join(helperFolder, LIGHTING_ASSETS_FOLDER);
  mkdirSync(assets, { recursive: true });
  ['48x48.png', '64x64.png', '256x256.png'].forEach((name) =>
    copyFileSync(path.join(iconsFolder, name), path.join(assets, name)),
  );
  return manifest;
};

export interface IEmbeddedIdentity {
  publisher: string;
  packageName: string;
  applicationId: string;
}

/**
 * The `msix` element the linker embedded in the helper, read from the file's
 * bytes. The manifest resource is stored as the text it was given; the linker
 * reformats the element (`/>` comes back as `></msix>`), so attributes are
 * read up to the tag's end rather than matched as written.
 */
export const readEmbeddedIdentity = (
  executable: Buffer,
): IEmbeddedIdentity | undefined => {
  const text = executable.toString('latin1');
  const start = text.indexOf('<msix ');
  if (start < 0) {
    return undefined;
  }
  const end = text.indexOf('>', start);
  if (end < 0) {
    return undefined;
  }
  const tag = text.slice(start, end);
  const attribute = (name: string) => {
    const match = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
    return match
      ? unescapeXml(Buffer.from(match[1], 'latin1').toString('utf8'))
      : undefined;
  };
  const publisher = attribute('publisher');
  const packageName = attribute('packageName');
  const applicationId = attribute('applicationId');
  if (!publisher || !packageName || !applicationId) {
    return undefined;
  }
  return { publisher, packageName, applicationId };
};

/** Everything that disagrees between the package and what was built. */
export const identityProblems = (
  subject: string,
  embedded: IEmbeddedIdentity | undefined,
  signer: string | undefined,
): string[] => {
  const problems: string[] = [];
  if (!embedded) {
    problems.push(
      `${LIGHTING_EXECUTABLE_NAME} carries no msix element, so it can never run with the package's identity.`,
    );
  } else {
    if (embedded.publisher !== subject) {
      problems.push(
        `${LIGHTING_EXECUTABLE_NAME} was compiled for publisher "${embedded.publisher}", but ${SUBJECT_VARIABLE} is "${subject}". Rebuild the native tree with ${SUBJECT_VARIABLE} set.`,
      );
    }
    if (embedded.packageName !== LIGHTING_PACKAGE_NAME) {
      problems.push(
        `${LIGHTING_EXECUTABLE_NAME} names package "${embedded.packageName}", not "${LIGHTING_PACKAGE_NAME}".`,
      );
    }
    if (embedded.applicationId !== LIGHTING_APPLICATION_ID) {
      problems.push(
        `${LIGHTING_EXECUTABLE_NAME} names application "${embedded.applicationId}", not "${LIGHTING_APPLICATION_ID}".`,
      );
    }
  }
  if (signer === undefined) {
    problems.push(
      `${LIGHTING_EXECUTABLE_NAME} has no valid signature, so there is no certificate subject to check the package against.`,
    );
  } else if (signer !== subject) {
    problems.push(
      `${LIGHTING_EXECUTABLE_NAME} is signed by "${signer}", but ${SUBJECT_VARIABLE} is "${subject}". Windows refuses a package whose publisher is not its certificate's subject.`,
    );
  }
  return problems;
};

/**
 * The newest Windows SDK's MakeAppx. Chosen by version rather than by
 * whichever folder sorts last as text, where 10.0.9 would beat 10.0.26100.
 */
export const findMakeAppx = (
  kitsRoot: string | undefined = process.env['ProgramFiles(x86)'],
): string | undefined => {
  if (!kitsRoot) {
    return undefined;
  }
  const bin = path.join(kitsRoot, 'Windows Kits', '10', 'bin');
  if (!existsSync(bin)) {
    return undefined;
  }
  const versionParts = (name: string) =>
    name.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const newestFirst = readdirSync(bin)
    .filter((name) => /^\d+(\.\d+)+$/.test(name))
    .sort((left, right) => {
      const a = versionParts(left);
      const b = versionParts(right);
      for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
        const difference = (b[index] ?? 0) - (a[index] ?? 0);
        if (difference !== 0) {
          return difference;
        }
      }
      return 0;
    });
  return newestFirst
    .map((version) => path.join(bin, version, 'x64', 'makeappx.exe'))
    .find((candidate) => existsSync(candidate));
};

/** The subject of a file's signing certificate, when its signature is valid. */
const signerSubject = (file: string): string | undefined => {
  // The path reaches PowerShell through the environment, never through the
  // command text, so nothing in it can be read as script.
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '$s = Get-AuthenticodeSignature -LiteralPath $env:FEQ_SIGNED_FILE; ' +
        'if ($s.Status -eq "Valid") { $s.SignerCertificate.Subject }',
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, FEQ_SIGNED_FILE: file },
      windowsHide: true,
    },
  );
  const subject = result.status === 0 ? result.stdout.trim() : '';
  return subject || undefined;
};

/** What this step needs from electron-builder's afterSign context. */
export interface ISignedAppContext {
  appOutDir: string;
  outDir: string;
  appVersion: string;
  /** Whether this build was told how to sign at all. */
  signing: boolean;
  /** electron-builder's own signer, with the build's signing settings. */
  sign: (file: string) => Promise<boolean>;
}

export const packageLightingIdentity = async (
  context: ISignedAppContext,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> => {
  const native = path.join(context.appOutDir, 'resources', 'native');
  const helper = path.join(native, LIGHTING_EXECUTABLE_NAME);
  if (!context.signing) {
    console.log(
      'Dynamic lighting: unsigned build, so no identity package. Devices light while FluidEQ is in front.',
    );
    return;
  }
  const subject = env[SUBJECT_VARIABLE];
  if (!subject) {
    throw new Error(
      `${SUBJECT_VARIABLE} is not set. A signed release needs the certificate's full subject to give the Dynamic Lighting helper its package identity.`,
    );
  }
  if (!existsSync(helper)) {
    throw new Error(`${helper} is missing from the packaged app.`);
  }

  const problems = identityProblems(
    subject,
    readEmbeddedIdentity(readFileSync(helper)),
    signerSubject(helper),
  );
  if (problems.length > 0) {
    throw new Error(
      `The Dynamic Lighting identity package cannot be built:\n\n${problems
        .map((line) => `  - ${line}`)
        .join('\n')}`,
    );
  }

  const makeAppx = findMakeAppx(env['ProgramFiles(x86)']);
  if (!makeAppx) {
    throw new Error(
      'MakeAppx.exe was not found in any Windows 10/11 SDK. Install the Windows SDK to build a signed release.',
    );
  }

  // Scoped to one folder of its own inside the build output, and nowhere else.
  const staging = path.join(context.outDir, 'lighting-identity');
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  writeFileSync(
    path.join(staging, 'AppxManifest.xml'),
    identityManifest({ publisher: subject, appVersion: context.appVersion }),
    'utf8',
  );

  const output = path.join(native, LIGHTING_IDENTITY_PACKAGE);
  // `/nv`: the manifest names an exe and pictures that live in the install
  // folder, and validation would refuse a package that does not contain them.
  const packed = spawnSync(
    makeAppx,
    ['pack', '/o', '/nv', '/d', staging, '/p', output],
    { encoding: 'utf8', windowsHide: true },
  );
  if (packed.status !== 0 || !existsSync(output)) {
    throw new Error(
      `MakeAppx could not build the Dynamic Lighting identity package (exit ${packed.status}):\n${packed.stdout}${packed.stderr}`,
    );
  }

  if (!(await context.sign(output))) {
    throw new Error(
      `${output} was built but not signed, and Windows will not register an unsigned package.`,
    );
  }
  const packageSigner = signerSubject(output);
  if (packageSigner !== subject) {
    throw new Error(
      `${output} is signed by "${packageSigner ?? 'nobody'}", not "${subject}".`,
    );
  }
  console.log(
    `Dynamic lighting: identity package signed by "${subject}" at ${output}`,
  );
};
