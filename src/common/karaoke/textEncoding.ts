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
 * Bytes to text for lyric files, which are very often not UTF-8.
 *
 * `File.text()` and `fs.readFileSync(path, 'utf8')` both decode UTF-8 and
 * nothing else, and both fail quietly: a Windows-1252 `.lrc` opened with
 * correct timings and `Canci�n` in the words, and a UTF-16LE UltraStar
 * file — whose bytes are half NUL, all of them valid UTF-8 — was reported as
 * "does not declare BPM". Neither told the user anything was wrong.
 *
 * UltraStar Deluxe below format 1.0.0 defaults to CP1252 and honours an
 * `#ENCODING` header naming UTF8, CP1250 or CP1252; LRC files predate UTF-8's
 * dominance and are commonly CP1252, Shift-JIS or GB18030. The order below is
 * UltraStar's own `encAuto`: believe a BOM, then the declared header, then
 * UTF-8 if it decodes strictly, and only then the legacy codepage.
 */

/**
 * Where an undeclared, BOM-less file that is not valid UTF-8 lands.
 *
 * A Shift-JIS or GB18030 file with no BOM and no header is indistinguishable
 * from CP1252 without frequency analysis — every byte sequence is legal in all
 * three. UltraStar makes the same call and for the same reason; a file that
 * wants to be read as anything else has to say so in its header.
 */
const LEGACY_FALLBACK_ENCODING = 'windows-1252';

/** Both BOMs and the NUL sniff decide inside the first line of any real file. */
const SNIFF_BYTES = 1_024;

/** `#ENCODING` is a header tag, so it is in the first few lines or nowhere. */
const HEADER_BYTES = 2_048;

const BOM_ENCODINGS: readonly { bytes: readonly number[]; encoding: string }[] =
  [
    { bytes: [0xef, 0xbb, 0xbf], encoding: 'utf-8' },
    { bytes: [0xff, 0xfe], encoding: 'utf-16le' },
    { bytes: [0xfe, 0xff], encoding: 'utf-16be' },
  ];

/** The labels UltraStar writes, mapped onto the ones TextDecoder answers to. */
const DECLARED_ENCODINGS: Readonly<Record<string, string>> = {
  utf8: 'utf-8',
  'utf-8': 'utf-8',
  utf16: 'utf-16le',
  'utf-16': 'utf-16le',
  cp1250: 'windows-1250',
  'windows-1250': 'windows-1250',
  cp1252: 'windows-1252',
  'windows-1252': 'windows-1252',
  ansi: 'windows-1252',
  latin1: 'windows-1252',
  'iso-8859-1': 'windows-1252',
};

const decoderFor = (
  encoding: string,
  fatal: boolean,
): TextDecoder | undefined => {
  try {
    return new TextDecoder(encoding, { fatal });
  } catch {
    // A small-ICU build knows only UTF-8 and UTF-16, and an `#ENCODING` header
    // may name something no build knows at all. Both are recoverable: the
    // caller falls through to the next candidate rather than throwing at the
    // user, who only asked to open a song.
    return undefined;
  }
};

const decodeWith = (
  bytes: Uint8Array,
  encoding: string,
  fatal: boolean,
): string | undefined => {
  const decoder = decoderFor(encoding, fatal);
  if (!decoder) {
    return undefined;
  }
  try {
    return decoder.decode(bytes);
  } catch {
    // Only a fatal decoder throws here, and only because the bytes are not
    // that encoding — which is the question being asked.
    return undefined;
  }
};

const bomEncoding = (bytes: Uint8Array): string | undefined =>
  BOM_ENCODINGS.find((candidate) =>
    candidate.bytes.every((byte, index) => bytes[index] === byte),
  )?.encoding;

/**
 * BOM-less UTF-16, which strict UTF-8 accepts and turns into silent nonsense.
 *
 * Measured: an ASCII-range UTF-16LE file carries a NUL for every other byte,
 * and NUL is valid UTF-8, so `{fatal: true}` raises nothing and the parser sees
 * `#\0B\0P\0M\0`. No lyric file in any single-byte codepage contains a NUL at
 * all, so a quarter of the sample being NUL is decisive; the side they fall on
 * names the byte order.
 */
const bomlessUtf16Encoding = (bytes: Uint8Array): string | undefined => {
  const sample = Math.min(bytes.length, SNIFF_BYTES);
  let evenNuls = 0;
  let oddNuls = 0;
  for (let index = 0; index < sample; index += 1) {
    if (bytes[index] === 0) {
      if (index % 2 === 0) {
        evenNuls += 1;
      } else {
        oddNuls += 1;
      }
    }
  }
  if (evenNuls + oddNuls < sample / 4) {
    return undefined;
  }
  return oddNuls > evenNuls ? 'utf-16le' : 'utf-16be';
};

/**
 * The header as ASCII, without choosing a decoder to read it with.
 *
 * `#ENCODING:CP1252` is pure ASCII in every encoding this reads, and the point
 * of the peek is to find it before the file's own encoding is known. Non-ASCII
 * bytes become spaces so a title above the tag cannot break the line structure.
 */
const asciiHeader = (bytes: Uint8Array): string => {
  const sample = bytes.subarray(0, HEADER_BYTES);
  let text = '';
  for (let index = 0; index < sample.length; index += 1) {
    const byte = sample[index];
    text += byte < 0x80 ? String.fromCharCode(byte) : ' ';
  }
  return text;
};

const declaredEncoding = (bytes: Uint8Array): string | undefined => {
  const match = /^\s*#ENCODING\s*:\s*([\w-]+)/im.exec(asciiHeader(bytes));
  const label = match?.[1]?.toLowerCase();
  if (!label) {
    return undefined;
  }
  return DECLARED_ENCODINGS[label] ?? label;
};

/**
 * Decode a lyric file's bytes into the text its author wrote.
 *
 * Never throws: an unreadable byte is worth a replacement character, while an
 * exception here would present as "the song could not be opened".
 */
export const decodeKaraokeText = (bytes: Uint8Array): string => {
  // TextDecoder strips the BOM itself for all three, so the bytes go in whole.
  const bom = bomEncoding(bytes);
  const sniffed = bom ?? bomlessUtf16Encoding(bytes);
  const declared = sniffed ? undefined : declaredEncoding(bytes);
  const candidates = [sniffed, declared].filter(
    (encoding): encoding is string => Boolean(encoding),
  );
  const chosen = candidates.reduce<string | undefined>(
    (found, encoding) => found ?? decodeWith(bytes, encoding, false),
    undefined,
  );
  return (
    chosen ??
    decodeWith(bytes, 'utf-8', true) ??
    decodeWith(bytes, LEGACY_FALLBACK_ENCODING, false) ??
    new TextDecoder().decode(bytes)
  );
};

export default decodeKaraokeText;
