/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pieceView, type IPieceView } from './pieceView';
import { readUnits, type ISourceUnits, type IUnit } from './sourceUnits';

/**
 * Which pieces of the app's code a still was drawn from, worked out from
 * what ran while it was drawn (`coverage.ts`): every function that ran, and
 * every value, load-time statement and export list those read, file to file
 * through the imports. A function that never ran is not among them however
 * near it sits - a context provider in a file the drawing reads one hook
 * from, a texture's painter for a still in the window's own palette, which
 * has none - so changing it is not a change to a still.
 */

export const ROOT = path.resolve(__dirname, '../..');

/** 96 bits of SHA-256: kept per unit, so the list stays small. */
const sha = (data: string | Buffer) =>
  crypto.createHash('sha256').update(data).digest('hex').slice(0, 24);

/** A piece of one file, from the root with forward slashes. */
export interface IUnitRef {
  file: string;
  /** The unit's key (`IUnit.key`), or `BYTES` for a file that is not code. */
  key: string;
}

/** The whole of a file that is not code: a picture, a song. */
export const BYTES = 'bytes';

export const refId = ({ file, key }: IUnitRef) => `${file}\t${key}`;

export const refOf = (id: string): IUnitRef => {
  const [file, key] = id.split('\t');
  return { file, key };
};

/** Code, as webpack reads it here (`.erb/configs/webpack.config.base.ts`). */
const CODE = /\.[jt]sx?$/;
/** The order webpack tries endings in (`resolve.extensions`). */
const ENDINGS = ['', '.js', '.jsx', '.json', '.ts', '.tsx'];

const fromDisk = (file: string): string | undefined => {
  const full = path.join(ROOT, file);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : undefined;
};

const resolved = new Map<string, string | undefined>();

/**
 * `specifier` imported from `from`, as webpack finds it: beside the file,
 * or under `src/` (`resolve.modules`, which `renderer/`, `main/` and
 * `common/` all are). A package is not the app's: undefined.
 */
export const resolveModule = (
  from: string,
  specifier: string,
): string | undefined => {
  const asked = `${from}\t${specifier}`;
  if (resolved.has(asked)) {
    return resolved.get(asked);
  }
  const bare = specifier.split('?')[0];
  const base = bare.startsWith('.')
    ? path.posix.join(path.posix.dirname(from), bare)
    : path.posix.join('src', bare);
  const candidates = [
    ...ENDINGS.map((ending) => `${base}${ending}`),
    ...ENDINGS.slice(1).map((ending) => `${base}/index${ending}`),
  ];
  const found = candidates.find((candidate) => {
    const full = path.join(ROOT, candidate);
    return fs.existsSync(full) && fs.statSync(full).isFile();
  });
  resolved.set(asked, found);
  return found;
};

/**
 * The repository as the freshness reads it: one parse per file, and a way
 * for a test to read a file as somebody might have edited it.
 */
export class SourceReader {
  private readonly parsed: Map<string, ISourceUnits | undefined>;

  constructor(
    private readonly readText: (file: string) => string | undefined = fromDisk,
    /** Parses another reader made, for every file this one reads the same. */
    shared?: ReadonlyMap<string, ISourceUnits | undefined>,
  ) {
    this.parsed = new Map(shared);
  }

  text(file: string): string | undefined {
    return this.readText(file);
  }

  units(file: string): ISourceUnits | undefined {
    if (!this.parsed.has(file)) {
      const text = CODE.test(file) ? this.readText(file) : undefined;
      this.parsed.set(
        file,
        text === undefined ? undefined : readUnits(text, file),
      );
    }
    return this.parsed.get(file);
  }

  /** This tree with `file` reading `text`: what an edit would make of it. */
  edited(file: string, text: string): SourceReader {
    const shared = new Map(this.parsed);
    shared.delete(file);
    return new SourceReader(
      (each) => (each === file ? text : this.readText(each)),
      shared,
    );
  }

  unit(ref: IUnitRef): IUnit | undefined {
    return this.units(ref.file)?.units.find((unit) => unit.key === ref.key);
  }

  /** A unit's code with the functions `leaveOut` names left out (`pieceView`). */
  view(
    ref: IUnitRef,
    leaveOut: (name: string, extent: readonly [number, number]) => boolean,
  ): IPieceView | undefined {
    const unit = this.unit(ref);
    const text = unit && this.readText(ref.file);
    return unit && text !== undefined
      ? pieceView(text, ref.file, unit, leaveOut)
      : undefined;
  }

  /**
   * A unit's hash, the functions named in `leftOut` left out of it: its
   * code, and where each name it reads is imported from - so an import
   * pointed at another module is a change even though the code that reads
   * the name is not.
   */
  hashOf(ref: IUnitRef, leftOut: readonly string[] = []): string | undefined {
    if (ref.key === BYTES) {
      const full = path.join(ROOT, ref.file);
      return fs.existsSync(full) ? sha(fs.readFileSync(full)) : undefined;
    }
    const names = new Set(leftOut);
    const view = this.view(ref, (name) => names.has(name));
    const imports = this.units(ref.file)?.imports;
    if (!view || !imports) {
      return undefined;
    }
    const sources = view.reads
      .flatMap((name) => {
        const imported = imports.get(name);
        return imported ? [`${name}=${imported.name}@${imported.module}`] : [];
      })
      .sort();
    return sha([view.code, ...sources].join('\n'));
  }

  /** What a name read in `file` is: a unit of the file, or one it imports. */
  named(file: string, name: string, seen = new Set<string>()): IUnitRef[] {
    const units = this.units(file);
    if (!units) {
      return [];
    }
    const declared = units.byName.get(name);
    if (declared) {
      return [{ file, key: declared.key }];
    }
    const imported = units.imports.get(name);
    const target = imported && resolveModule(file, imported.module);
    return imported && target ? this.exported(target, imported.name, seen) : [];
  }

  /**
   * The units that make one of `file`'s exports (`*` for all of them), with
   * the export lists the name was passed through.
   */
  exported(file: string, name: string, seen = new Set<string>()): IUnitRef[] {
    const visit = `${file}\t${name}`;
    if (seen.has(visit)) {
      return [];
    }
    seen.add(visit);
    const units = this.units(file);
    if (!units) {
      return CODE.test(file) ? [] : [{ file, key: BYTES }];
    }
    const lists: IUnitRef[] = units.units.some((unit) => unit.key === 'exports')
      ? [{ file, key: 'exports' }]
      : [];
    const starred = (wanted: string) =>
      units.starFrom.flatMap((module) => {
        const target = resolveModule(file, module);
        return target ? this.exported(target, wanted, seen) : [];
      });
    if (name === '*') {
      return [
        ...lists,
        ...[...units.exports.keys()].flatMap((each) =>
          this.exported(file, each, seen),
        ),
        ...starred('*'),
      ];
    }
    const exported = units.exports.get(name);
    if (exported?.kind === 'local') {
      const declared = units.byName.get(exported.local);
      return [
        ...(exported.listed ? lists : []),
        ...(declared
          ? [{ file, key: declared.key }]
          : this.named(file, exported.local, seen)),
      ];
    }
    if (exported?.kind === 'from') {
      const target = resolveModule(file, exported.module);
      return [
        ...lists,
        ...(target ? this.exported(target, exported.name, seen) : []),
      ];
    }
    const found = starred(name);
    return found.length > 0 ? [...lists, ...found] : [];
  }
}

/**
 * The translations: a still is drawn with its key off and holds no words,
 * and the strings change by the day.
 */
const WORDS = /^src\/common\/i18n\/[^/]+\//;

/**
 * Everything a still was drawn from, given what ran (`ran`: the function
 * units coverage saw run, loading included, and `at`: where in each file
 * each function that ran starts and ends), what makes its bytes outside
 * the page (`always`: every unit of the generator's own files that do, all
 * they read followed whether it ran or not, and the demo song) and the files
 * the page bundled (`bundled`). A file's load-time statements count once
 * anything of it counts, or once it is imported for them alone.
 *
 * Each piece comes with the functions written in it that never ran left
 * out (`pieceView`), by name: what they read is not followed, and changing
 * them is not a change to the still.
 */
export const closeOver = (
  reader: SourceReader,
  {
    ran,
    at,
    always,
    bundled,
  }: {
    ran: ReadonlySet<string>;
    at: ReadonlyMap<string, readonly number[]>;
    always: readonly IUnitRef[];
    bundled: readonly string[];
  },
): Map<string, string[]> => {
  const included = new Map<string, string[]>();
  /** Followed whatever ran: what runs outside the page. */
  const whole = new Set<string>();
  const queue: { ref: IUnitRef; isWhole: boolean }[] = [];
  const take = (ref: IUnitRef, isWhole: boolean) => {
    const id = refId(ref);
    if (
      WORDS.test(ref.file) ||
      (included.has(id) && (!isWhole || whole.has(id)))
    ) {
      return;
    }
    included.set(id, []);
    if (isWhole) {
      whole.add(id);
    }
    queue.push({ ref, isWhole });
  };
  const effectsOf = (file: string) => {
    if (reader.units(file)?.units.some((unit) => unit.key === 'effects')) {
      take({ file, key: 'effects' }, false);
    }
  };
  ran.forEach((id) => take(refOf(id), false));
  always.forEach((ref) => take(ref, true));
  bundled.forEach((importer) =>
    reader.units(importer)?.bareImports.forEach((module) => {
      const target = resolveModule(importer, module);
      if (target) {
        effectsOf(target);
      }
    }),
  );
  for (let next = queue.shift(); next; next = queue.shift()) {
    const { ref, isWhole } = next;
    if (ref.key !== BYTES) {
      effectsOf(ref.file);
    }
    const places = at.get(ref.file) ?? [];
    const view = reader.view(
      ref,
      (_, [from, to]) =>
        !isWhole && !places.some((place) => place >= from && place < to),
    );
    included.set(refId(ref), view?.leftOut ?? []);
    view?.reads.forEach((name) =>
      reader.named(ref.file, name).forEach((target) => {
        const kind = reader.unit(target)?.kind;
        if (kind !== 'function' || isWhole || ran.has(refId(target))) {
          take(target, isWhole);
        }
      }),
    );
  }
  return included;
};
