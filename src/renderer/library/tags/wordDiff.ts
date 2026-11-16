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

export interface IDiffPart {
  text: string;
  isChanged: boolean;
}

/**
 * Which words of a value change: the before with what goes marked, the
 * after with what arrives marked — "Llorar (Feat. Maro Domm)" shows Feat.
 * and Maro, not the whole title. The longest common run of words (LCS) is
 * kept; titles are a handful of words, so the table is tiny.
 */
export const wordDiff = (
  before: string,
  after: string,
): { before: IDiffPart[]; after: IDiffPart[] } => {
  const a = before.split(/(\s+)/);
  const b = after.split(/(\s+)/);
  const table = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i][j] =
        a[i] === b[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const keptA = new Set<number>();
  const keptB = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      keptA.add(i);
      keptB.add(j);
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  // A run of changed words is one mark, the spaces inside it included:
  // "Luna de Papel" arriving whole reads as one insertion, not three.
  const parts = (words: string[], kept: Set<number>) => {
    const isWordChanged = (index: number) =>
      index >= 0 &&
      index < words.length &&
      !kept.has(index) &&
      words[index].trim() !== '';
    return words
      .map((text, index) => ({
        text,
        isChanged:
          text.trim() === ''
            ? isWordChanged(index - 1) && isWordChanged(index + 1)
            : !kept.has(index),
      }))
      .filter((part) => part.text !== '')
      .reduce<IDiffPart[]>((merged, part) => {
        const last = merged[merged.length - 1];
        if (last !== undefined && last.isChanged === part.isChanged) {
          last.text += part.text;
        } else {
          merged.push({ ...part });
        }
        return merged;
      }, []);
  };
  return { before: parts(a, keptA), after: parts(b, keptB) };
};
