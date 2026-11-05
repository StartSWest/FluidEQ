/** Move only Linux download fields when publishing the same release to apt. */
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { atomicWrite, RELEASE_REPO, releaseAsset } from './apt-repository';

export default function updateLinuxDownloads(
  site: string,
  version: string,
  build: string,
): void {
  const file = path.join(site, 'site.config.json');
  let text = fs.readFileSync(file, 'utf8');
  const current: { linuxVersion?: string } = JSON.parse(text);
  if (
    current.linuxVersion &&
    current.linuxVersion.localeCompare(version, 'en', { numeric: true }) > 0
  ) {
    throw new Error('The website already offers a newer Linux release.');
  }
  const base = `https://github.com/${RELEASE_REPO}/releases`;
  const fields: Record<string, string> = {
    linuxVersion: version,
    linuxReleaseUrl: `${base}/tag/v${version}`,
  };
  [
    ['linuxDeb', releaseAsset(version)],
    ['linuxAppImage', `FluidEQ-${version}-x86_64.AppImage`],
  ].forEach(([prefix, name]) => {
    const bytes = fs.readFileSync(path.join(build, name));
    fields[`${prefix}Url`] = `${base}/download/v${version}/${name}`;
    fields[`${prefix}Size`] = `${Math.round(bytes.length / (1024 * 1024))} MB`;
    fields[`${prefix}Sha256`] = createHash('sha256')
      .update(bytes)
      .digest('hex')
      .toUpperCase();
  });
  Object.entries(fields).forEach(([key, value]) => {
    const line = new RegExp(
      `^([ \\t]*"${key}":[ \\t]*)([^\\r\\n]*?)(,?)$`,
      'gm',
    );
    if (Array.from(text.matchAll(line)).length !== 1) {
      throw new Error(`Missing/ambiguous website field: ${key}`);
    }
    text = text.replace(
      line,
      (_match, start: string, _old: string, comma: string) =>
        `${start}${JSON.stringify(value)}${comma}`,
    );
  });
  JSON.parse(text);
  atomicWrite(file, text);
}
