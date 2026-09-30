/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.

Writes assets/licenses/THIRD-PARTY-LICENSES.txt: every npm package installed
as a production dependency, each with the licence text its own package ships.

The hand-written THIRD-PARTY-NOTICES.txt beside it named sixteen packages, the
ones FluidEQ imports. The licences of those packages ask for their copyright
notice to travel with every copy, and so do the licences of what they bring
with them: 150 packages when this was first run, among them BSD-3-Clause,
Python-2.0 and Blue Oak terms the curated file never mentioned. A list kept by
hand falls behind the first time a dependency gains one of its own, so this one
is generated from the lock and `pnpm package` refuses to build against a stale
copy (`--check`).

It is a superset of what the application runs. `pnpm licenses list --prod`
cannot tell which parts of a package the bundles reach, so everything installed
for production is listed, including packages no code path loads (sharp, pulled
in by the lyric model's library and never used by its browser build).
Over-listing costs a few kilobytes; under-listing is a licence breach.

  pnpm licenses:notices           write the file
  pnpm licenses:notices --check   exit 1 if the file is not what would be written
*/

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface ILicensedPackage {
  name: string;
  versions: string[];
  paths: string[];
  license: string;
  author?: string;
  homepage?: string;
}

const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'assets/licenses/THIRD-PARTY-LICENSES.txt');
const RULE = '-'.repeat(78);

/** The file names a package's licence and notice travel under, in that order. */
const LICENSE_FILE = /^(licen[cs]e|copying|unlicense)(\.(md|txt|markdown))?$/i;
const NOTICE_FILE = /^notice(\.(md|txt))?$/i;

const listProduction = (): ILicensedPackage[] => {
  // `pnpm` is a .cmd shim on Windows, which only a shell can start. One fixed
  // command line, so the shell is handed nothing from outside.
  const json = execSync('pnpm licenses list --prod --json', {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const byLicense = JSON.parse(json) as Record<string, ILicensedPackage[]>;
  return Object.values(byLicense)
    .flat()
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
};

const readFirst = (dir: string, pattern: RegExp): string | undefined => {
  const name = fs
    .readdirSync(dir)
    .filter((entry) => pattern.test(entry))
    .sort()[0];
  return name
    ? fs
        .readFileSync(path.join(dir, name), 'utf8')
        .replace(/\r\n/g, '\n')
        .trim()
    : undefined;
};

const block = (pkg: ILicensedPackage): string => {
  const dir = pkg.paths[0];
  const licenseText = dir ? readFirst(dir, LICENSE_FILE) : undefined;
  const noticeText = dir ? readFirst(dir, NOTICE_FILE) : undefined;
  const lines = [
    RULE,
    `${pkg.name} ${pkg.versions.join(', ')}`,
    `License: ${pkg.license}`,
  ];
  if (pkg.author) lines.push(`Author: ${pkg.author}`);
  if (pkg.homepage) lines.push(`Home: ${pkg.homepage}`);
  lines.push('');
  lines.push(
    licenseText ??
      `The package ships no licence file. It declares ${pkg.license} in its package.json; the text of that licence is the one published for its SPDX identifier.`,
  );
  if (noticeText) lines.push('', 'NOTICE', '', noticeText);
  return lines.join('\n');
};

const render = (packages: ILicensedPackage[]): string =>
  [
    'THIRD-PARTY LICENSES FOR FLUIDEQ',
    '',
    'Every npm package installed with FluidEQ as a production dependency, with the',
    'licence text its own package carries. Generated from the lock by',
    '.erb/scripts/generate-third-party-licenses.ts; do not edit by hand.',
    '',
    'This is a superset of what the application runs: a package can be installed',
    'without any of its code being loaded. THIRD-PARTY-NOTICES.txt, beside this file,',
    'explains what the main components are for, and covers what is not an npm',
    'package: the bundled model weights, the data sets, the decoders compiled into',
    'the audio engine and the shaders ported from other projects.',
    '',
    `${packages.length} packages.`,
    '',
    ...packages.map(block),
    RULE,
    '',
  ].join('\n');

const main = () => {
  const text = render(listProduction());
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (current !== text) {
      console.error(
        `${path.relative(ROOT, OUT)} is out of date with the installed packages: run pnpm licenses:notices and commit it.`,
      );
      process.exit(1);
    }
    return;
  }
  const temp = `${OUT}.tmp-${process.pid}`;
  fs.writeFileSync(temp, text);
  fs.renameSync(temp, OUT);
};

main();
