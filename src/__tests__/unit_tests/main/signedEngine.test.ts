/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The signed release signs its engine before the helper takes its digest,
 * and refuses to ship when the packaged engine, helper or Equalizer APO
 * installer says otherwise (.erb/scripts/sign-engine.ts).
 *
 * The 2.5.0 signed build signed every program and no DLL, and nothing
 * noticed: the engine went out unsigned in a release that was called signed.
 * Each refusal below stands beside the same files passing.
 */

import {
  commonNameOf,
  ENGINE_BUILD_DLL,
  IPackagedEngine,
  isSignedBy,
  packagedEngineProblems,
  sha256Hex,
  signEngineBeforePackaging,
  TIMESTAMP_URL,
  trustedSigningCommand,
} from '../../../../.erb/scripts/sign-engine';
import { musicProcessingSources } from '../../../../.erb/scripts/music-dsp-evidence';
import manifest from '../../../../package.json';

describe('when the engine is signed', () => {
  it('signs the engine the native build just linked, after that build', () => {
    const steps: string[] = [];
    const how = signEngineBeforePackaging(
      () => {
        steps.push('build');
        return true;
      },
      (dll) => {
        steps.push(`sign ${dll}`);
        return 'signed';
      },
    );
    expect(how).toBe('signed');
    expect(steps).toEqual(['build', `sign ${ENGINE_BUILD_DLL}`]);
  });

  it('signs nothing when the native build failed', () => {
    const sign = jest.fn(() => 'signed' as const);
    expect(() => signEngineBeforePackaging(() => false, sign)).toThrow(
      /native build failed/,
    );
    expect(sign).not.toHaveBeenCalled();
  });

  // Signing changes no sound: it must not move the fingerprint the DSP
  // evidence pins (2.5.1's suite failed three audits when it did).
  it('happens in no file the DSP evidence fingerprints', () => {
    const { files } = musicProcessingSources(process.cwd());
    expect(files).toContain('.erb/scripts/build-native-dsp.ts');
    expect(files).not.toContain('.erb/scripts/sign-engine.ts');
    expect(files).not.toContain('.erb/scripts/package-signed.ts');
  });
});

const PUBLISHER = 'Ivan Carmenates Garcia';
const SIGNING = {
  endpoint: 'https://eus.codesigning.azure.net',
  codeSigningAccountName: 'fluideq-signing',
  certificateProfileName: 'fluideq-profile',
  publisherName: PUBLISHER,
};

describe('the signing call', () => {
  it('is electron-builder’s, parameter for parameter', () => {
    expect(trustedSigningCommand(SIGNING, 'C:\\b\\FluidEQ-Engine.dll')).toBe(
      "Invoke-TrustedSigning -Endpoint 'https://eus.codesigning.azure.net' " +
        "-CertificateProfileName 'fluideq-profile' " +
        "-CodeSigningAccountName 'fluideq-signing' " +
        `-TimestampRfc3161 '${TIMESTAMP_URL}' -TimestampDigest 'SHA256' ` +
        "-FileDigest 'SHA256' -Files 'C:\\b\\FluidEQ-Engine.dll'",
    );
    expect(TIMESTAMP_URL).toBe('http://timestamp.acs.microsoft.com');
  });

  it('passes a quote in a path as a quote, never as the end of the string', () => {
    expect(
      trustedSigningCommand(SIGNING, "C:\\Ivan's builds\\engine.dll"),
    ).toContain("-Files 'C:\\Ivan''s builds\\engine.dll'");
  });
});

describe('who signed it', () => {
  it('reads the common name, bare or quoted', () => {
    expect(commonNameOf(`CN=${PUBLISHER}, O=${PUBLISHER}, C=US`)).toBe(
      PUBLISHER,
    );
    expect(commonNameOf('CN="Doe, ""J""", C=US')).toBe('Doe, "J"');
    expect(commonNameOf('O=Nobody')).toBeUndefined();
  });

  it('counts only a valid signature by exactly this publisher', () => {
    const subject = `CN=${PUBLISHER}, O=${PUBLISHER}, C=US`;
    expect(isSignedBy({ status: 'Valid', subject }, PUBLISHER)).toBe(true);
    expect(isSignedBy({ status: 'HashMismatch', subject }, PUBLISHER)).toBe(
      false,
    );
    expect(isSignedBy({ status: 'NotSigned', subject: '' }, PUBLISHER)).toBe(
      false,
    );
    expect(
      isSignedBy(
        { status: 'Valid', subject: `CN=${PUBLISHER} Ltd, C=US` },
        PUBLISHER,
      ),
    ).toBe(false);
  });
});

describe('the release gate', () => {
  const APO = Buffer.from('upstream Equalizer APO installer');
  const engine = Buffer.from('the signed engine');
  /** The helper carries each DLL's digest as text among its own bytes. */
  const helperFor = (dll: Buffer) =>
    Buffer.concat([
      Buffer.from('MZ helper code '),
      Buffer.from(sha256Hex(dll), 'ascii'),
      Buffer.from(' more code'),
    ]);
  const good: IPackagedEngine = {
    engine,
    engineSignature: {
      status: 'Valid',
      subject: `CN=${PUBLISHER}, O=${PUBLISHER}, C=US`,
    },
    helper: helperFor(engine),
    apoInstaller: APO,
    programs: ['FluidEQ.exe', 'resources\\native\\FluidEQ-Media.exe'].map(
      (name) => ({
        name,
        signature: {
          status: 'Valid',
          subject: `CN=${PUBLISHER}, O=${PUBLISHER}, C=US`,
        },
      }),
    ),
    runtimes: [
      {
        name: 'resources\\native\\msvcp140.dll',
        signature: {
          status: 'Valid',
          subject:
            'CN=Microsoft Windows Software Compatibility Publisher, O=Microsoft Corporation, C=US',
        },
      },
    ],
  };
  const problems = (packaged: IPackagedEngine) =>
    packagedEngineProblems(packaged, PUBLISHER, sha256Hex(APO));

  it('passes a signed engine, its own helper and the upstream installer', () => {
    expect(problems(good)).toEqual([]);
  });

  it('refuses an engine that is not signed by the publisher', () => {
    expect(
      problems({
        ...good,
        engineSignature: { status: 'NotSigned', subject: '' },
      }),
    ).toHaveLength(1);
  });

  it('refuses a helper built before the engine was signed', () => {
    // It carries the digest of the unsigned engine, and would refuse to
    // install the signed one on every user's machine.
    expect(
      problems({ ...good, helper: helperFor(Buffer.from('unsigned engine')) }),
    ).toHaveLength(1);
  });

  it('refuses an Equalizer APO installer that is not the upstream file', () => {
    expect(
      problems({
        ...good,
        apoInstaller: Buffer.concat([APO, Buffer.from('a signature')]),
      }),
    ).toHaveLength(1);
    expect(problems({ ...good, apoInstaller: undefined })).toHaveLength(1);
  });

  // "We ship the Fluid app and the Fluid engine signed" (Ivan, 2026-11-12).
  it('refuses a FluidEQ program that is not signed by the publisher', () => {
    expect(
      problems({
        ...good,
        programs: [
          ...good.programs,
          {
            name: 'resources\\native\\FluidEQ-Volume.exe',
            signature: { status: 'NotSigned', subject: '' },
          },
        ],
      }),
    ).toHaveLength(1);
    expect(problems({ ...good, programs: [] })).toHaveLength(1);
  });

  it('refuses a runtime that lost its own signature or carries ours', () => {
    const runtime = (status: string, subject: string) => ({
      ...good,
      runtimes: [
        {
          name: 'resources\\native\\vcruntime140.dll',
          signature: { status, subject },
        },
      ],
    });
    expect(
      problems(runtime('Valid', `CN=${PUBLISHER}, O=${PUBLISHER}, C=US`)),
    ).toHaveLength(1);
    expect(problems(runtime('NotSigned', ''))).toHaveLength(1);
    // The control: Microsoft's own signature passes.
    expect(
      problems(
        runtime('Valid', 'CN=Microsoft Corporation, O=Microsoft Corporation'),
      ),
    ).toEqual([]);
  });
});

describe('what electron-builder signs', () => {
  const { signExts } = manifest.build.win;

  it('never signs the Equalizer APO installer', () => {
    expect(signExts).toContain('!equalizer-apo-setup.exe');
  });

  // electron-builder signs while it packages, after the helper took the
  // engine's digest; a DLL it signed would be refused by its own helper.
  it('signs no DLL', () => {
    expect(
      signExts.filter((pattern) => pattern.toLowerCase().endsWith('.dll')),
    ).toEqual([]);
  });
});
