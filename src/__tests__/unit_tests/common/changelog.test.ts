/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import fs from 'fs';
import path from 'path';
import { latestReleaseNotes } from 'common/changelog';

const CHANGELOG = [
  "# What's new in FluidEQ",
  '',
  'Every released version.',
  '',
  '---',
  '',
  '## 1.1.0',
  '',
  'The newest one.',
  '',
  '- A thing that changed',
  '',
  '---',
  '',
  '## 1.0.0',
  '',
  'The old one.',
  '',
  '- A thing that changed then',
  '',
].join('\n');

describe("the notes shown in the What's new dialog", () => {
  it('keeps the newest version and nothing below it', () => {
    const notes = latestReleaseNotes(CHANGELOG);
    expect(notes).toContain('## 1.1.0');
    expect(notes).toContain('A thing that changed');
    expect(notes).not.toContain('1.0.0');
    expect(notes).not.toContain('The old one.');
  });

  it('drops the file title, which the dialog already draws itself', () => {
    const notes = latestReleaseNotes(CHANGELOG);
    expect(notes.startsWith('## 1.1.0')).toBe(true);
    expect(notes).not.toContain("What's new in FluidEQ");
    expect(notes).not.toContain('Every released version.');
  });

  it('leaves no separator hanging off the end', () => {
    // The rule divides two sections, so it goes with the half being dropped.
    expect(latestReleaseNotes(CHANGELOG).trimEnd()).not.toMatch(/-{3,}$/);
  });

  it('reads a file written with Windows line endings', () => {
    const notes = latestReleaseNotes(CHANGELOG.replace(/\n/g, '\r\n'));
    expect(notes).toContain('## 1.1.0');
    expect(notes).not.toContain('1.0.0');
  });

  it('shows a file it cannot find a version in rather than nothing', () => {
    // A blank dialog is a worse failure than an unexpected one.
    expect(latestReleaseNotes('Something else entirely.')).toBe(
      'Something else entirely.',
    );
    expect(latestReleaseNotes('')).toBe('');
  });

  it('holds for the changelog that actually ships', () => {
    const file = path.join(__dirname, '../../../../CHANGELOG.md');
    const notes = latestReleaseNotes(fs.readFileSync(file, 'utf8'));
    expect(notes.startsWith('## ')).toBe(true);
    expect(
      notes.split(/\r?\n/).filter((line) => /^##\s+\S/.test(line)),
    ).toHaveLength(1);
  });
});
