/* FluidEQ — GPL-3.0-or-later */

/**
 * Where the signed line updates from, shared by the updater in main and the
 * release scripts that build what it reads.
 *
 * From 2.5 every public build is signed and updates itself from the public
 * GitHub releases. Each release carries two feeds:
 *
 *   - `signed.yml`, the signed line's, read here through the address that
 *     always answers with the newest release's files;
 *   - `latest.yml`, which installed 2.4.x copies read (their GitHub provider
 *     is compiled in) and which, since their updater accepts only an unsigned
 *     installer, now names the bridge: one unsigned 2.5 whose own updater
 *     accepts only the signed publisher and moves the install over.
 *
 * Neither address is a secret. What keeps an installer out is the publisher
 * pinned into the build and the feed key that signs both files.
 */

export const SIGNED_UPDATE_FEED_URL =
  'https://github.com/StartSWest/FluidEQ/releases/latest/download/';

/** `signed.yml`: the file name electron-builder and electron-updater derive. */
export const SIGNED_UPDATE_CHANNEL = 'signed';

/**
 * The bridge's version is the release's with this prerelease part: semver
 * sorts `2.5.0-bridge` above every 2.4.x (so 2.4.x takes it) and below
 * `2.5.0` (so the bridge sees the signed 2.5.0 as newer and moves to it).
 * Checked against electron-updater 6.8.9, the version 2.4.0 shipped with:
 * with a stable current version its GitHub provider reads `latest.yml` from
 * the newest non-prerelease *release*, whatever the version inside it, and
 * `isUpdateAvailable` is a plain semver comparison.
 */
export const BRIDGE_VERSION_SUFFIX = '-bridge';

export const bridgeVersionOf = (releaseVersion: string): string => {
  if (!/^\d+\.\d+\.\d+$/.test(releaseVersion)) {
    throw new Error(
      `A bridge is built from a plain release version, not "${releaseVersion}".`,
    );
  }
  return `${releaseVersion}${BRIDGE_VERSION_SUFFIX}`;
};
