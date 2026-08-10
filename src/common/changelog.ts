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

/** A version heading in CHANGELOG.md: `## 1.1.0`, and nothing else. */
const VERSION_HEADING = /^##\s+\S/;

/** A horizontal rule, which separates one version's section from the next. */
const HORIZONTAL_RULE = /^-{3,}$/;

/**
 * The newest version's section of CHANGELOG.md, without the file around it.
 *
 * The dialog is called "What's new", and it used to answer with the entire
 * history: eleven releases, in a window you had to scroll to reach the bottom
 * of. It opens by itself the first time you run a new version, which is exactly
 * the moment when everything below the top section is the opposite of new.
 *
 * So: from the first version heading to the one after it. The file's own title
 * and its explanatory preamble go too — the dialog already has a title, and was
 * drawing a second copy of it inside the body.
 *
 * Anything that is not a changelog comes back whole rather than empty. A file we
 * cannot find the shape of is still worth showing; refusing to render it would
 * turn a cosmetic surprise into a blank dialog.
 */
export const latestReleaseNotes = (markdown: string): string => {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => VERSION_HEADING.test(line.trim()));
  if (start === -1) {
    return markdown.trim();
  }

  const after = lines
    .slice(start + 1)
    .findIndex((line) => VERSION_HEADING.test(line.trim()));
  const end = after === -1 ? lines.length : start + 1 + after;

  const section = lines.slice(start, end);
  // The rule belongs to the boundary between two sections, not to the section
  // above it, so it goes with the half being dropped.
  while (
    section.length > 0 &&
    (section[section.length - 1].trim() === '' ||
      HORIZONTAL_RULE.test(section[section.length - 1].trim()))
  ) {
    section.pop();
  }

  return section.join('\n');
};

export default latestReleaseNotes;
