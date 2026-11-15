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
 * The block YAML a word-timed lyrics export is written in, read into plain
 * values for `lyricsFormats.ts` — the same shape its JSON twin parses to.
 *
 * Not a YAML library: the subset such a file uses, and nothing that runs
 * code or reaches outside the text — mappings and sequences by indentation,
 * `- ` items holding mappings, plain, single- and double-quoted scalars,
 * `|` / `>` block scalars, `#` comments, and `{}` / `[]` flow forms only as
 * JSON. Numbers are read as numbers, so `start_ms: 7930` is 7930. Anything it
 * cannot read gives `undefined`, and the text is then not this format.
 */

interface IRow {
  indent: number;
  text: string;
}

type TYaml = unknown;

const scalar = (raw: string): TYaml => {
  const value = raw.trim();
  if (value === '' || value === '~' || value === 'null') {
    return null;
  }
  if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    value.startsWith('{') ||
    value.startsWith('[')
  ) {
    // Double quotes and flow collections are JSON wherever a lyrics export
    // writes them; one that is not is not read.
    return JSON.parse(value) as TYaml;
  }
  if (value === 'true' || value === 'false') {
    return value === 'true';
  }
  if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(value)) {
    return Number(value);
  }
  return value;
};

/** A plain scalar's own comment: ` #` and after. */
const withoutComment = (text: string): string => {
  if (text.trimStart().startsWith("'") || text.trimStart().startsWith('"')) {
    return text;
  }
  const at = text.search(/\s#/);
  return at < 0 ? text : text.slice(0, at);
};

/** `key: value`, or nothing for a line that is not one. */
const KEY =
  /^((?:'(?:[^']|'')*'|"(?:[^"\\]|\\.)*"|[^\s'"#][^:]*?)):(?:\s+(.*))?$/;

const keyName = (raw: string): string => {
  const parsed = scalar(raw);
  return typeof parsed === 'string' ? parsed : String(parsed);
};

class Reader {
  private index = 0;

  private readonly rows: IRow[];

  constructor(rows: IRow[]) {
    this.rows = rows;
  }

  /** The next row with something on it: blank rows mean something only
   * inside a block scalar, which reads them itself. */
  private next(): IRow | undefined {
    while (this.rows[this.index]?.text === '') {
      this.index += 1;
    }
    return this.rows[this.index];
  }

  /** The value whose rows start here and are indented `indent` or more. */
  value(indent: number): TYaml {
    const row = this.next();
    if (row === undefined || row.indent < indent) {
      return null;
    }
    return row.text.startsWith('- ') || row.text === '-'
      ? this.sequence(row.indent)
      : this.mapping(row.indent);
  }

  private sequence(indent: number): TYaml[] {
    const items: TYaml[] = [];
    for (;;) {
      const row = this.next();
      if (
        row === undefined ||
        row.indent !== indent ||
        !(row.text.startsWith('- ') || row.text === '-')
      ) {
        return items;
      }
      const rest = row.text === '-' ? '' : row.text.slice(2);
      if (rest.trim() === '') {
        this.index += 1;
        items.push(this.value(indent + 1));
      } else if (KEY.test(rest)) {
        // `- key: value` opens a mapping whose further keys line up with it.
        this.rows[this.index] = { indent: indent + 2, text: rest };
        items.push(this.mapping(indent + 2));
      } else {
        this.index += 1;
        items.push(scalar(withoutComment(rest)));
      }
    }
  }

  private mapping(indent: number): Record<string, TYaml> {
    const map: Record<string, TYaml> = {};
    for (;;) {
      const row = this.next();
      if (row === undefined || row.indent !== indent) {
        return map;
      }
      const match = KEY.exec(row.text);
      if (match === null) {
        throw new Error('Not a mapping row');
      }
      const key = keyName(match[1]);
      const rest = withoutComment(match[2] ?? '').trim();
      this.index += 1;
      if (rest === '') {
        const next = this.next();
        // A sequence may stand at its key's own indent, as YAML allows.
        const nested =
          next !== undefined &&
          (next.indent > indent ||
            (next.indent === indent && next.text.startsWith('- ')));
        map[key] = nested ? this.value(next.indent) : null;
      } else if (/^[|>][-+]?$/.test(rest)) {
        map[key] = this.block(indent, rest);
      } else {
        map[key] = scalar(rest);
      }
    }
  }

  /** A `|` (lines kept) or `>` (folded) block, its rows deeper than `indent`. */
  private block(indent: number, header: string): string {
    const lines: string[] = [];
    let blockIndent = -1;
    for (;;) {
      const row = this.rows[this.index];
      if (row === undefined || (row.indent <= indent && row.text !== '')) {
        break;
      }
      if (blockIndent < 0 && row.text !== '') {
        blockIndent = row.indent;
      }
      lines.push(
        row.text === '' ? '' : ' '.repeat(row.indent - blockIndent) + row.text,
      );
      this.index += 1;
    }
    while (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    const joined = header.startsWith('>')
      ? lines.join(' ').replace(/ {2,}/g, ' ')
      : lines.join('\n');
    return header.endsWith('-') ? joined : `${joined}\n`;
  }
}

/** The text as plain values, or `undefined` when it is not this YAML. */
const parseLyricsYaml = (input: string): unknown => {
  // A byte-order mark, by its code: a literal one is invisible in review.
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  try {
    const rows = text
      .split(/\r\n|\r|\n/)
      .filter((line) => !/^\s*#/.test(line) && line.trim() !== '---')
      .map((line): IRow => {
        if (/^\s*\t/.test(line)) {
          throw new Error('Tabs are not YAML indentation');
        }
        const kept = line.trimEnd();
        const trimmed = kept.trimStart();
        return { indent: kept.length - trimmed.length, text: trimmed };
      });
    return new Reader(rows).value(0);
  } catch {
    return undefined;
  }
};

export default parseLyricsYaml;
