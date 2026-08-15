/**
 * Marking a release as one that installed copies must take.
 *
 * ## What this actually does
 *
 * It turns one environment variable into one electron-builder config override.
 * That override puts a line under `releaseInfo.vendor`, electron-builder
 * spreads `releaseInfo` verbatim into `latest.yml`, electron-updater parses
 * that file with `yaml.load` and hands the whole object to `update-available`,
 * and `common/mandatoryUpdate` reads it there. No second file, no second
 * request, nothing to remember to upload alongside the installer.
 *
 * `vendor` and not `releaseName` or `releaseNotes`, even though both of those
 * also reach `latest.yml`: those fields are user-facing release prose and may
 * be filled or transformed by publishing tooling. Carrying the signal in
 * either would mean a release title or note was one unlucky sentence away from
 * blocking every installation.
 *
 * ## Why it is a separate module from the signing settings
 *
 * `package-signed.ts` reads environment variables and turns them into config
 * overrides, which is the same shape, and it would have been the obvious place
 * to add ten more lines. It is not the same subject. Signing is about who the
 * build says it is; this is about what the release says about itself. Keeping
 * them apart means the test for one cannot pass because of the other, and
 * means a reader of either file is looking at one idea.
 *
 * ## Not set here, and not settable by mistake
 *
 * The variable is unset for every ordinary build, and an unset variable
 * produces no argument at all — the config is untouched, `latest.yml` has no
 * `vendor` key, and no installation anywhere sees anything new. The value has
 * to be one exact word; anything else is refused loudly rather than quietly
 * producing a release that looks marked and is not.
 */

import {
  MANDATORY_UPDATE_FIELD,
  MANDATORY_UPDATE_VALUE,
} from '../../src/common/mandatoryUpdate';

/** The environment variable, named once. */
export const MANDATORY_UPDATE_ENV = 'FLUIDEQ_MANDATORY_UPDATE';

/**
 * The electron-builder arguments for this build, which is usually none.
 *
 * Throws on a value that is set but wrong. That asymmetry is the point: an
 * absent variable is the ordinary case and means nothing, whereas a variable
 * somebody has deliberately set and misspelled is a release they believe is
 * marked. Failing the build is the only way they find out before it ships.
 */
export const readMandatoryUpdateArgs = (
  env: NodeJS.ProcessEnv = process.env,
): string[] => {
  const raw = env[MANDATORY_UPDATE_ENV];
  if (raw === undefined || raw.trim() === '') {
    return [];
  }
  const value = raw.trim();
  if (value !== MANDATORY_UPDATE_VALUE) {
    throw new Error(
      `${MANDATORY_UPDATE_ENV} is set to "${value}", which means nothing.\n` +
        `The only value that marks a release mandatory is "${MANDATORY_UPDATE_VALUE}".\n` +
        `Unset it for an ordinary release.`,
    );
  }
  return [
    `--config.releaseInfo.vendor.${MANDATORY_UPDATE_FIELD}=${MANDATORY_UPDATE_VALUE}`,
  ];
};

export default readMandatoryUpdateArgs;
