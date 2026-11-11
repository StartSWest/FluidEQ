/**
 * @jest-environment node
 */
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

/**
 * In development the main process is run by ts-node, one file at a time
 * (`dev-main.cjs`: `ts-node/register/transpile-only`), and nothing there
 * resolves the path aliases the renderer's webpack does - `common/...`,
 * `renderer/...`, `main/...`. A file main loads that asks for one dies on
 * launch with "Cannot find module 'common/...'".
 *
 * Nothing else catches it: tsc resolves the alias, Jest maps it, and the
 * packaged main is bundled by webpack, which resolves it too. On 2026-11-11
 * main was given a run-time import of the renderer's `importGrid.ts`, whose
 * own imports are aliases; every check passed, and `pnpm dev` would not
 * start.
 *
 * So this follows what main really loads. Each file is transpiled the way
 * ts-node does it and the `require`s left in the output are followed - an
 * import used only as a type is gone by then, exactly as it is at run time,
 * which is why main may name a renderer file for its types - and any alias
 * still standing is a launch that will not happen.
 */

const ROOT = path.join(__dirname, '../../../..');
const ALIAS = /^(common|renderer|main)\//;

interface IDisk {
  read(file: string): string | undefined;
}

const options = (): ts.CompilerOptions => {
  const config = ts.readConfigFile(
    path.join(ROOT, 'tsconfig.json'),
    ts.sys.readFile,
  );
  return ts.convertCompilerOptionsFromJson(
    (config.config as { compilerOptions?: unknown }).compilerOptions ?? {},
    ROOT,
  ).options;
};

/** What `file` asks for once it is JavaScript: its run-time loads. */
const loadsOf = (
  file: string,
  text: string,
  compilerOptions: ts.CompilerOptions,
): string[] => {
  const { outputText } = ts.transpileModule(text, {
    fileName: file,
    compilerOptions,
  });
  return [...outputText.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)].map(
    (match) => match[1],
  );
};

/** The file a relative request names, as Node finds a TypeScript one. */
const resolved = (from: string, request: string, disk: IDisk) => {
  const base = path.resolve(path.dirname(from), request);
  return [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ].find(
    (candidate) =>
      /\.tsx?$/.test(candidate) && disk.read(candidate) !== undefined,
  );
};

/**
 * Every alias a file loads at run time, among `entries` and all they reach,
 * each said with the entry it was reached from.
 */
const aliasLoads = (entries: readonly string[], disk: IDisk): string[] => {
  const compilerOptions = options();
  const seen = new Set<string>();
  const queue = entries.map((entry) => ({ file: entry, from: entry }));
  const found: string[] = [];
  const said = (file: string) => path.relative(ROOT, file).replace(/\\/g, '/');
  for (let next = queue.pop(); next; next = queue.pop()) {
    const { file, from } = next;
    const text = seen.has(file) ? undefined : disk.read(file);
    seen.add(file);
    if (text !== undefined) {
      loadsOf(file, text, compilerOptions).forEach((request) => {
        if (ALIAS.test(request)) {
          found.push(
            `${said(file)} loads '${request}' (reached from ${said(from)})`,
          );
        } else if (request.startsWith('.')) {
          const target = resolved(file, request, disk);
          if (target) {
            queue.push({ file: target, from });
          }
        }
      });
    }
  }
  return found;
};

const sourcesUnder = (folder: string): string[] =>
  fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      return sourcesUnder(full);
    }
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')
      ? [full]
      : [];
  });

const realDisk: IDisk = {
  read: (file) => {
    try {
      return fs.statSync(file).isFile()
        ? fs.readFileSync(file, 'utf8')
        : undefined;
    } catch {
      // Not there: the request was for something else (a folder, JSON).
      return undefined;
    }
  },
};

/** A few files that exist only here, for the controls. */
const madeUp = (files: Record<string, string>): IDisk => {
  const at = new Map(
    Object.entries(files).map(([name, text]) => [path.join(ROOT, name), text]),
  );
  return { read: (file) => at.get(file) };
};

describe('what the main process loads in development', () => {
  it('asks for nothing by a path alias, in any file it can reach', () => {
    const found = aliasLoads(
      sourcesUnder(path.join(ROOT, 'src/main')),
      realDisk,
    );
    expect(found).toEqual([]);
  });

  // The controls: the same walk over files with the fault in them.
  it('would name an alias loaded by a renderer file main brings in', () => {
    const disk = madeUp({
      'src/main/sheet.ts':
        "import { detectGrid } from '../renderer/grid';\nexport const run = () => detectGrid();\n",
      'src/renderer/grid.ts':
        "import { bounds } from 'common/pictureBounds';\nexport const detectGrid = () => bounds();\n",
    });
    expect(aliasLoads([path.join(ROOT, 'src/main/sheet.ts')], disk)).toEqual([
      "src/renderer/grid.ts loads 'common/pictureBounds' (reached from src/main/sheet.ts)",
    ]);
  });

  it('would name an alias main asks for itself, a late one included', () => {
    const disk = madeUp({
      'src/main/direct.ts':
        "import { A } from 'common/a';\nexport const run = async () => [A, await import('renderer/late')];\n",
    });
    expect(aliasLoads([path.join(ROOT, 'src/main/direct.ts')], disk)).toEqual([
      "src/main/direct.ts loads 'common/a' (reached from src/main/direct.ts)",
      "src/main/direct.ts loads 'renderer/late' (reached from src/main/direct.ts)",
    ]);
  });

  it('lets main name a renderer file for its types alone, as it does today', () => {
    const disk = madeUp({
      'src/main/typed.ts':
        "import type { IGrid } from '../renderer/grid';\nimport { IOther } from '../renderer/other';\nimport type { IThird } from 'common/third';\nexport const run = (grid: IGrid, other: IOther, third: IThird) => [grid, other, third];\n",
      'src/renderer/grid.ts':
        "import { bounds } from 'common/pictureBounds';\nexport interface IGrid { columns: number }\nexport const detectGrid = () => bounds();\n",
      'src/renderer/other.ts':
        "import { bounds } from 'common/pictureBounds';\nexport interface IOther { rows: number }\nexport const other = () => bounds();\n",
    });
    expect(aliasLoads([path.join(ROOT, 'src/main/typed.ts')], disk)).toEqual(
      [],
    );
  });
});
