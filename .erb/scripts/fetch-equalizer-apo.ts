/**
 * Fetch the Equalizer APO installer that gets bundled into ours.
 *
 * FluidEQ is a front end for Equalizer APO: without it there is no equaliser,
 * only a picture of one. Sending people off to SourceForge to find a download
 * button was the single worst moment in getting started, so the installer
 * carries APO with it and offers to run it.
 *
 * The binary is NOT committed. It is twelve megabytes of somebody else's build
 * and it would sit in this repository's history forever; it is fetched here
 * instead, pinned to an exact version and checked against a hash so a mirror
 * cannot quietly hand us something else. A checksum mismatch is fatal — an
 * installer we cannot identify is not one to run on a user's machine.
 *
 * Licensing: Equalizer APO is GPL-2.0-or-later by Jonas Thedering, so it is
 * compatible with FluidEQ's GPL-3.0 and may be redistributed — provided the
 * corresponding source goes with it. That is not optional. `pnpm
 * fetch-apo:source` fetches the archive matching the version pinned below, and
 * it is published alongside the installer wherever that installer is offered,
 * to the same people and at no extra charge. Bumping the version here moves
 * the hash, the byte count and the source archive together.
 *
 * A link to somebody else's server is not, strictly, forbidden. Because APO is
 * "or later" it can be conveyed under GPLv3, and section 6(d) does allow the
 * corresponding source to live on a third party's server. What that clause
 * does not do is hand over the responsibility: it leaves you obligated to keep
 * the source available for as long as it is needed, and SourceForge's file
 * list is not ours to guarantee. If 1.4.2 were ever pruned while installers
 * were still going out, there would be no fallback and the first sign of it
 * would be somebody else's bug report.
 *
 * So upstream is cited as the origin and our own copy is what actually
 * discharges the obligation. It is 36 MB next to a ~110 MB installer, which is
 * not a cost worth the argument.
 */

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

export const APO_VERSION = '1.4.2';

/** x64 only, which is the only architecture FluidEQ itself targets. */
const APO_INSTALLER = `EqualizerAPO-x64-${APO_VERSION}.exe`;

/**
 * What it is called once it is ours.
 *
 * Saved under a fixed name so the NSIS macro that runs it never has to know
 * which version is pinned — the version lives in exactly one place, here, and
 * bumping it does not mean remembering to edit a shell script as well.
 */
const BUNDLED_NAME = 'equalizer-apo-setup.exe';

/** What the release must also carry, for the source obligation. */
export const APO_SOURCE_ARCHIVE = `EqualizerAPO-src-${APO_VERSION}.zip`;

const APO_INSTALLER_SHA256 =
  '7403be7427bbe1936a40dded082829b6e217fc4f5990fee5cba501f0ae055afa';

const APO_INSTALLER_BYTES = 11980366;

/**
 * SourceForge's own redirector hands out whichever mirror it feels like, and
 * some of them are unreachable from some networks for minutes at a time. Each
 * is tried in turn rather than failing the whole build on one bad draw.
 */
const MIRRORS = [
  'https://downloads.sourceforge.net/project/equalizerapo',
  'https://netix.dl.sourceforge.net/project/equalizerapo',
  'https://netcologne.dl.sourceforge.net/project/equalizerapo',
  'https://phoenixnap.dl.sourceforge.net/project/equalizerapo',
];

const VENDOR_DIR = path.join(__dirname, '../../vendor/equalizer-apo');

const sha256 = (file: string) =>
  createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/**
 * Read the whole response, then write it. Deliberately not streamed.
 *
 * Streaming this through `pipeline` crashes inside Node's own HTTP parser with
 * `assert(!this.paused)`: the disk is slower than the network, backpressure
 * pauses the stream, and if the socket ends while it is paused undici trips an
 * internal assertion. Every byte arrives before it happens, so the file on
 * disk looks complete and the process dies immediately afterwards — which
 * reads like a flaky mirror rather than like a bug, and cost an afternoon to
 * see properly.
 *
 * The largest thing fetched here is under forty megabytes, once, at build
 * time. Holding it in memory is free, and it removes the entire class of
 * problem rather than working around one shape of it.
 */
const download = async (url: string, to: string) => {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  const body = Buffer.from(await response.arrayBuffer());
  if (body.byteLength === 0) {
    throw new Error('empty response');
  }
  fs.writeFileSync(to, body);
};

export const fetchEqualizerApo = async (): Promise<string> => {
  const target = path.join(VENDOR_DIR, BUNDLED_NAME);
  fs.mkdirSync(VENDOR_DIR, { recursive: true });

  if (fs.existsSync(target)) {
    const existing = sha256(target);
    if (existing === APO_INSTALLER_SHA256) {
      return target;
    }
    // Half a download from a previous interrupted run, or a mirror that
    // served an error page with a 200. Either way it is not the installer.
    fs.rmSync(target);
  }

  const failures: string[] = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const mirror of MIRRORS) {
    const url = `${mirror}/${APO_VERSION}/${APO_INSTALLER}?viasf=1`;
    try {
      // eslint-disable-next-line no-await-in-loop
      await download(url, target);
      // eslint-disable-next-line no-await-in-loop
      const digest = sha256(target);
      if (digest !== APO_INSTALLER_SHA256) {
        throw new Error(
          `checksum mismatch: expected ${APO_INSTALLER_SHA256}, got ${digest}`,
        );
      }
      if (fs.statSync(target).size !== APO_INSTALLER_BYTES) {
        throw new Error('size mismatch');
      }
      // So the app, and anyone looking in the install directory, can say
      // which version is sitting there.
      fs.writeFileSync(
        path.join(VENDOR_DIR, 'version.txt'),
        `${APO_VERSION}\n`,
        'utf8',
      );
      return target;
    } catch (error) {
      failures.push(`${mirror}: ${(error as Error).message}`);
      if (fs.existsSync(target)) {
        fs.rmSync(target);
      }
    }
  }

  throw new Error(
    `Could not fetch ${APO_INSTALLER}. The installer cannot be built without` +
      ` it — FluidEQ bundles it rather than sending people to a website.\n` +
      `${failures.join('\n')}`,
  );
};

/**
 * Fetch the source archive that has to be published with the release.
 *
 * Separate from the installer fetch because it is needed at a different
 * moment and is three times the size: the build does not want it, and the
 * release does. Not checksummed against a pinned value — this is the thing
 * being pointed at as the corresponding source, so what matters is that it is
 * the archive SourceForge publishes for this version, whatever its bytes are.
 */
export const fetchEqualizerApoSource = async (): Promise<string> => {
  const target = path.join(VENDOR_DIR, APO_SOURCE_ARCHIVE);
  fs.mkdirSync(VENDOR_DIR, { recursive: true });

  if (fs.existsSync(target) && fs.statSync(target).size > 1_000_000) {
    return target;
  }

  const failures: string[] = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const mirror of MIRRORS) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await download(
        `${mirror}/${APO_VERSION}/${APO_SOURCE_ARCHIVE}?viasf=1`,
        target,
      );
      if (fs.statSync(target).size < 1_000_000) {
        throw new Error('too small to be the source archive');
      }
      return target;
    } catch (error) {
      failures.push(`${mirror}: ${(error as Error).message}`);
      if (fs.existsSync(target)) {
        fs.rmSync(target);
      }
    }
  }

  throw new Error(
    `Could not fetch ${APO_SOURCE_ARCHIVE}. This is not optional: publishing` +
      ` the installer without the corresponding source is a licence` +
      ` violation.\n${failures.join('\n')}`,
  );
};

if (require.main === module) {
  const wantsSource = process.argv.includes('--source');
  (wantsSource ? fetchEqualizerApoSource() : fetchEqualizerApo())
    .then((file) => {
      console.log(`Equalizer APO ${APO_VERSION} ready at ${file}`);
      return file;
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
