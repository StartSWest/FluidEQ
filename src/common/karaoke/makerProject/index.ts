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

/**
 * A karaoke Maker project: what one is, and everything that edits it.
 *
 * This was a single 2,270-line file. The seams below were already there — the
 * pieces barely referenced each other — but nothing made them visible, so
 * finding the two functions that resize a syllable meant scrolling past the
 * eight hundred lines that do not.
 *
 * The directory keeps the import path every caller already uses. Splitting a
 * module should not make forty files edit their import lines to say the same
 * thing.
 *
 * Read in this order — each layer only knows the ones above it:
 *
 * - `model`      what a project is: tokens, lines, notes, and the line-range
 *                arithmetic everything else asks about
 * - `syllables`  splitting one word into singable parts
 * - `timeline`   moving the whole performance, or one line's tail
 * - `boundaries` dragging one token edge, and the cascade that follows
 * - `recording`  timing lines by ear against playback
 * - `project`    creating, importing and serialising
 * - `parse`      reading one back from untrusted JSON
 * - `song`       turning a project into something playable
 */
export * from './lineTokens';
export * from './model';
export { default as splitKaraokeMakerWordIntoSyllables } from './syllables';
export * from './translationSeed';
export * from './timeline';
export * from './boundaries';
export * from './recording';
export * from './project';
export { default as parseKaraokeMakerProject } from './parse';
export * from './song';
