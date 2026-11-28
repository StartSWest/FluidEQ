/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import ts from 'typescript';

/**
 * A source file read as the pieces its top level is made of, for the
 * stills' freshness (`freshness.ts`): each function, each value, the file's
 * load-time statements and its export table, with what each piece names and
 * where. Read by TypeScript's parser alone, no type checker, so the whole
 * app's drawing is read in a few seconds.
 *
 * The code, not the text: each piece is hashed as TypeScript's scanner reads
 * it, comments and layout skipped, so a comment rewritten or a file
 * reformatted is not a change to a look, and anything that is - a number, a
 * colour, a call, a new import - is.
 */

/**
 * `function`: runs only when called, so it decides a still only if it ran
 * while the still was drawn. `value`: built when its module loads, so it
 * decides a still whenever anything that decides it reads it. `effects`: the
 * file's load-time statements, run whenever the file is in the page.
 * `exports`: the file's export lists and re-exports, which a name read
 * through the file is resolved by.
 */
export type TUnitKind = 'function' | 'value' | 'effects' | 'exports';

export interface IUnit {
  /** The names it declares, `+`-joined; `effects` and `exports` for those. */
  key: string;
  kind: TUnitKind;
  /** Its extent in the file, for finding which piece a position is in. */
  ranges: ReadonlyArray<readonly [number, number]>;
  /** Every name it reads, as written, and where each read is. */
  reads: ReadonlyMap<string, readonly number[]>;
  /**
   * Every function written inside it, outermost first: a callback handed
   * to something that never called it is code the piece holds and never
   * ran (`pieceView.ts`).
   */
  functions: ReadonlyArray<readonly [number, number]>;
}

/** Where a name comes from when the file imports it. */
export interface IImported {
  module: string;
  /** The name in that module; `default`, or `*` for the whole module. */
  name: string;
}

/** What one of the file's exports is. */
export type TExported =
  | { kind: 'local'; local: string; listed: boolean }
  | { kind: 'from'; module: string; name: string };

export interface ISourceUnits {
  units: readonly IUnit[];
  /** The unit declaring each top-level name. */
  byName: ReadonlyMap<string, IUnit>;
  imports: ReadonlyMap<string, IImported>;
  exports: ReadonlyMap<string, TExported>;
  /** `export * from` modules, in order. */
  starFrom: readonly string[];
  /** Modules imported for what they do as they load: `import './bridge'`. */
  bareImports: readonly string[];
}

/** The tokens of `text`, comments and whitespace left out. */
export const codeOf = (text: string, file: string): string => {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    /\.[jt]sx$/.test(file)
      ? ts.LanguageVariant.JSX
      : ts.LanguageVariant.Standard,
    text,
  );
  const tokens: string[] = [];
  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  ) {
    tokens.push(scanner.getTokenText());
  }
  return tokens.join(' ');
};

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind) =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind);

/** A name in a declaration's or a property's own place, not a read. */
const isOwnName = (identifier: ts.Identifier): boolean => {
  const { parent } = identifier;
  if (ts.isMetaProperty(parent)) {
    return true;
  }
  if (ts.isLabeledStatement(parent)) {
    return parent.label === identifier;
  }
  if (ts.isBreakOrContinueStatement(parent)) {
    return parent.label === identifier;
  }
  if (
    ts.isPropertyAccessExpression(parent) ||
    ts.isPropertyAssignment(parent) ||
    ts.isMethodDeclaration(parent) ||
    ts.isPropertyDeclaration(parent) ||
    ts.isGetAccessorDeclaration(parent) ||
    ts.isSetAccessorDeclaration(parent) ||
    ts.isJsxAttribute(parent)
  ) {
    return parent.name === identifier;
  }
  return false;
};

/**
 * Every name `nodes` read at run time, with where: types are erased, so
 * what is inside one is not a read, nor a property's or a member's own
 * name. And every function written inside them, outermost first.
 */
const readsOf = (nodes: readonly ts.Node[], source: ts.SourceFile) => {
  const reads = new Map<string, number[]>();
  const functions: [number, number][] = [];
  const read = (name: string, at: number) =>
    reads.set(name, [...(reads.get(name) ?? []), at]);
  const visit = (node: ts.Node): void => {
    if (
      ts.isTypeNode(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isTypeParameterDeclaration(node)
    ) {
      return;
    }
    if (ts.isIdentifier(node)) {
      if (!isOwnName(node)) {
        read(node.text, node.getStart(source));
      }
      return;
    }
    if (ts.isShorthandPropertyAssignment(node)) {
      read(node.name.text, node.name.getStart(source));
    }
    if (ts.isFunctionLike(node) && 'body' in node && node.body) {
      functions.push([node.getStart(source), node.getEnd()]);
    }
    ts.forEachChild(node, visit);
  };
  nodes.forEach(visit);
  return { reads, functions };
};

const namesOfBinding = (name: ts.BindingName): string[] => {
  if (ts.isIdentifier(name)) {
    return [name.text];
  }
  return name.elements.flatMap((element) =>
    ts.isOmittedExpression(element) ? [] : namesOfBinding(element.name),
  );
};

const unwrap = (expression: ts.Expression): ts.Expression => {
  let at = expression;
  while (
    ts.isParenthesizedExpression(at) ||
    ts.isAsExpression(at) ||
    ts.isSatisfiesExpression(at) ||
    ts.isTypeAssertionExpression(at) ||
    ts.isNonNullExpression(at)
  ) {
    at = at.expression;
  }
  return at;
};

const isFunctionValue = (expression: ts.Expression | undefined) => {
  if (!expression) {
    return false;
  }
  const value = unwrap(expression);
  return ts.isArrowFunction(value) || ts.isFunctionExpression(value);
};

interface IDeclared {
  names: string[];
  kind: 'function' | 'value';
  exported: boolean;
  isDefault: boolean;
}

/** What a top-level statement declares, or nothing if it declares nothing that runs. */
const declaredBy = (
  statement: ts.Statement,
): IDeclared | 'type' | undefined => {
  const exported = hasModifier(statement, ts.SyntaxKind.ExportKeyword);
  const isDefault = hasModifier(statement, ts.SyntaxKind.DefaultKeyword);
  if (hasModifier(statement, ts.SyntaxKind.DeclareKeyword)) {
    return 'type';
  }
  if (
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement)
  ) {
    return 'type';
  }
  if (ts.isFunctionDeclaration(statement)) {
    // An overload's signature has no body and is a type.
    if (!statement.body) {
      return 'type';
    }
    return {
      names: [statement.name?.text ?? 'default'],
      kind: 'function',
      exported,
      isDefault,
    };
  }
  if (ts.isClassDeclaration(statement)) {
    return {
      names: [statement.name?.text ?? 'default'],
      kind: 'value',
      exported,
      isDefault,
    };
  }
  if (ts.isEnumDeclaration(statement) || ts.isModuleDeclaration(statement)) {
    return {
      names: [statement.name.getText()],
      kind: 'value',
      exported,
      isDefault: false,
    };
  }
  if (ts.isVariableStatement(statement)) {
    const { declarations } = statement.declarationList;
    return {
      names: declarations.flatMap((declaration) =>
        namesOfBinding(declaration.name),
      ),
      kind: declarations.every((declaration) =>
        isFunctionValue(declaration.initializer),
      )
        ? 'function'
        : 'value',
      exported,
      isDefault: false,
    };
  }
  return undefined;
};

/** `file`'s top level as `ISourceUnits`. */
export const readUnits = (text: string, file: string): ISourceUnits => {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    /\.[jt]sx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const units: IUnit[] = [];
  const byName = new Map<string, IUnit>();
  const imports = new Map<string, IImported>();
  const exportsOf = new Map<string, TExported>();
  const starFrom: string[] = [];
  const bareImports: string[] = [];
  const effects: ts.Statement[] = [];
  const exportLists: ts.Statement[] = [];
  const keys = new Map<string, number>();
  const add = (
    kind: 'function' | 'value',
    names: readonly string[],
    nodes: readonly ts.Node[],
  ) => {
    const base = names.join('+');
    const seen = keys.get(base) ?? 0;
    keys.set(base, seen + 1);
    const unit: IUnit = {
      key: seen === 0 ? base : `${base}#${seen}`,
      kind,
      ranges: nodes.map((node) => [node.getStart(source), node.getEnd()]),
      ...readsOf(nodes, source),
    };
    units.push(unit);
    names.forEach((name) => byName.set(name, unit));
  };
  source.statements.forEach((statement) => {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      const module = (statement.moduleSpecifier as ts.StringLiteral).text;
      if (!clause) {
        // Imported for what it does as it loads.
        effects.push(statement);
        bareImports.push(module);
        return;
      }
      if (clause.isTypeOnly) {
        return;
      }
      if (clause.name) {
        imports.set(clause.name.text, { module, name: 'default' });
      }
      const bindings = clause.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) {
        imports.set(bindings.name.text, { module, name: '*' });
      } else if (bindings) {
        bindings.elements
          .filter((element) => !element.isTypeOnly)
          .forEach((element) =>
            imports.set(element.name.text, {
              module,
              name: (element.propertyName ?? element.name).text,
            }),
          );
      }
      return;
    }
    if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) {
        return;
      }
      exportLists.push(statement);
      const module = statement.moduleSpecifier
        ? (statement.moduleSpecifier as ts.StringLiteral).text
        : undefined;
      const clause = statement.exportClause;
      if (!clause) {
        if (module) {
          starFrom.push(module);
        }
        return;
      }
      if (ts.isNamespaceExport(clause)) {
        if (module) {
          exportsOf.set(clause.name.text, { kind: 'from', module, name: '*' });
        }
        return;
      }
      clause.elements
        .filter((element) => !element.isTypeOnly)
        .forEach((element) => {
          const inner = (element.propertyName ?? element.name).text;
          exportsOf.set(
            element.name.text,
            module
              ? { kind: 'from', module, name: inner }
              : { kind: 'local', local: inner, listed: true },
          );
        });
      return;
    }
    if (ts.isExportAssignment(statement)) {
      const value = unwrap(statement.expression);
      if (ts.isIdentifier(value)) {
        exportLists.push(statement);
        exportsOf.set('default', {
          kind: 'local',
          local: value.text,
          listed: true,
        });
        return;
      }
      add(
        isFunctionValue(value) ? 'function' : 'value',
        ['default'],
        [statement],
      );
      exportsOf.set('default', {
        kind: 'local',
        local: 'default',
        listed: false,
      });
      return;
    }
    const declared = declaredBy(statement);
    if (declared === 'type') {
      return;
    }
    if (!declared) {
      effects.push(statement);
      return;
    }
    add(declared.kind, declared.names, [statement]);
    if (declared.exported) {
      declared.names.forEach((name) =>
        exportsOf.set(declared.isDefault ? 'default' : name, {
          kind: 'local',
          local: name,
          listed: false,
        }),
      );
    }
  });
  const pooled = (
    kind: 'effects' | 'exports',
    statements: readonly ts.Statement[],
  ) => {
    if (statements.length > 0) {
      units.push({
        key: kind,
        kind,
        ranges: statements.map((node) => [
          node.getStart(source),
          node.getEnd(),
        ]),
        ...readsOf(statements, source),
      });
    }
  };
  pooled('effects', effects);
  pooled('exports', exportLists);
  return { units, byName, imports, exports: exportsOf, starFrom, bareImports };
};

/** The unit `position` falls in, if it is in one that runs. */
export const unitAt = (
  units: ISourceUnits,
  position: number,
): IUnit | undefined =>
  units.units.find((unit) =>
    unit.ranges.some(([start, end]) => position >= start && position < end),
  );
