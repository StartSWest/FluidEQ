/* FluidEQ — GPL-3.0-or-later */

interface IWord {
  key: string;
  start: number;
  end: number;
}

/** Alternate spellings of names such as K-pop and Bass Punch, with ranges
 * in the original label so search highlights still point at the real words. */
const joinedHelpWords = (text: string, words: readonly IWord[]): IWord[] => {
  const joined: IWord[] = [];
  words.forEach((first, at) => {
    let { key } = first;
    for (let next = at + 1; next < Math.min(words.length, at + 3); next += 1) {
      const gap = text.slice(words[next - 1].end, words[next].start);
      if (!/^[\s\p{Pd}'’/&·]*$/u.test(gap)) {
        break;
      }
      key += words[next].key;
      if (key.length <= 48) {
        joined.push({ key, start: first.start, end: words[next].end });
      }
    }
  });
  return joined;
};

export default joinedHelpWords;
