/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Asking a Media site's page which of its colour variables are dark greys, and
 * what each one paints.
 *
 * WHY WHAT IT PAINTS. A grey is picked by its value (`guestTint.ts`), and a
 * value does not say what it is for. YouTube Music's page is #030303, and so is
 * the label of its white Sign in button: changing every #030303 made that label
 * the panel's colour, and over a scene, where the page's own grey goes clear, it
 * made the label vanish from a white pill. YouTube's Subscribe button and every
 * other filled white button have their labels in the page's grey the same way.
 * The page's own stylesheets say which it is — `color` and `fill` are text and
 * icons, `background` and `border` are surfaces — so they are read, followed
 * through the variables defined from each grey, and the answer rides with the
 * grey: a grey that only ever paints text is never changed, and one that paints
 * both keeps its colour on the rules that use it as text (`TGuestKeep`).
 *
 * WHEN. Reading every rule costs a large page like YouTube's a tenth of a
 * second or two, so it is done only when the page holds a different number of
 * rules from the last reading, or a grey nobody has looked up yet; a page
 * whose styles have not changed is asked for its greys alone.
 */

/**
 * The darkest a grey may be and still be one of the page's surfaces rather
 * than its text: YouTube's lightest outline is #3f3f3f, and its grey text
 * starts far above this.
 */
export const LADDER_TOP = 72;

/** A variable and the colour it held: red, green, blue and alpha. */
export type TGuestGrey = readonly [string, number, number, number, number];

/** What a variable paints, as the page's stylesheets use it. */
export interface IGuestPaint {
  /** Somewhere it is the colour of text, an icon or a mark. */
  readonly text: boolean;
  /** Somewhere it is a background, a border or a shadow. */
  readonly surface: boolean;
}

/**
 * A rule of the page's own where a variable that also paints surfaces is the
 * colour of text: its selector, and the variable.
 */
export type TGuestKeep = readonly [string, string];

/** What a page said when it was asked. */
export interface IGuestTintReport {
  readonly greys: TGuestGrey[];
  /** How many rules its readable stylesheets held. */
  readonly ruleCount: number | undefined;
  /** Present only when its stylesheets were read this time. */
  readonly paints?: ReadonlyMap<string, IGuestPaint>;
  readonly keeps?: readonly TGuestKeep[];
}

/** No more rules than this are kept from one page for any one site. */
export const MAX_KEEPS = 600;

/**
 * The longest selector taken from a page. YouTube's longest rule that writes
 * a label in its page's grey is a list of four; anything far past that is not
 * one this needs.
 */
const MAX_SELECTOR = 400;

const CUSTOM_PROPERTY = /^--[A-Za-z0-9_-]{1,120}$/;

const isCustomProperty = (value: unknown): value is string =>
  typeof value === 'string' && CUSTOM_PROPERTY.test(value);

/**
 * Run in the guest page, read-only. `lastRuleCount` is how many rules the page
 * held when its stylesheets were last read (-1 for never), and `knownNames`
 * the greys already learned from the site: over a scene most of them read as
 * clear, which is not a colour, and they still need to be looked up.
 *
 * Returns `{ greys, rules }`, and `paints` and `keeps` when the rules were
 * read. Written as plain script, not a function turned into text: a bundler or
 * a coverage counter would rewrite a function's body into something the page
 * cannot run.
 */
export const guestTintProbe = (
  lastRuleCount: number | undefined,
  knownNames: readonly string[],
): string => {
  const last =
    lastRuleCount !== undefined && Number.isInteger(lastRuleCount)
      ? lastRuleCount
      : -1;
  const names = JSON.stringify(knownNames.filter(isCustomProperty));
  return String.raw`(() => {
  const TOP = ${LADDER_TOP};
  const LAST = ${last};
  const MAX_KEEPS = ${MAX_KEEPS};
  const doc = document;
  const root = doc.documentElement;
  const computed = getComputedStyle(root);
  const probe = doc.createElement('span');
  probe.style.display = 'none';
  root.append(probe);
  const greys = [];
  for (let i = 0; i < computed.length; i += 1) {
    const name = computed[i];
    if (!name.startsWith('--')) continue;
    const value = computed.getPropertyValue(name).trim();
    if (!/^(#|rgb)/.test(value)) continue;
    probe.style.color = '';
    probe.style.color = value;
    const m = /^rgba?\(([^)]*)\)$/.exec(getComputedStyle(probe).color);
    if (!m) continue;
    const c = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (Math.max(c[0], c[1], c[2]) > TOP) continue;
    greys.push([name, c[0], c[1], c[2], c.length > 3 ? c[3] : 1]);
  }
  probe.remove();

  const lists = [];
  for (const sheet of [...doc.styleSheets, ...(doc.adoptedStyleSheets || [])]) {
    try {
      lists.push(sheet.cssRules);
    } catch (unreadable) {
      // Another origin's stylesheet: what its rules paint stays unknown.
    }
  }
  let rules = 0;
  for (const list of lists) rules += list.length;
  const names = new Set(${names});
  if (rules === LAST && greys.every((grey) => names.has(grey[0]))) {
    return { greys, rules };
  }
  for (const grey of greys) names.add(grey[0]);

  // Every declaration that reads a variable: the variable, the property it
  // is read into, and the rule's selector.
  const declaration = /(?:^|;)\s*(-{0,2}[a-zA-Z][\w-]*)\s*:\s*([^;]*var\(\s*--[^;]*)/g;
  const reference = /var\(\s*(--[\w-]+)/g;
  const uses = new Map();
  const selectors = [];
  const visit = (list) => {
    for (const rule of list) {
      if (rule.style && typeof rule.selectorText === 'string') {
        const text = rule.style.cssText;
        if (text.indexOf('var(') !== -1) {
          const at = selectors.length;
          selectors.push(rule.selectorText);
          declaration.lastIndex = 0;
          let d;
          while ((d = declaration.exec(text))) {
            reference.lastIndex = 0;
            let r;
            while ((r = reference.exec(d[2]))) {
              let found = uses.get(r[1]);
              if (!found) {
                found = [];
                uses.set(r[1], found);
              }
              found.push([d[1], at]);
            }
          }
        }
      }
      if (rule.cssRules && rule.cssRules.length) visit(rule.cssRules);
    }
  };
  for (const list of lists) visit(list);

  // A rule for the root or the body sets the whole page, not one element.
  const body = doc.body;
  const rootish = new Map();
  const isRootish = (at) => {
    let found = rootish.get(at);
    if (found === undefined) {
      const selector = selectors[at];
      try {
        found = root.matches(selector) || (body !== null && body.matches(selector));
      } catch (invalid) {
        found = true;
      }
      if (!found) {
        found = selector.split(',').some((part) => {
          const compounds = part.trim().split(/[\s>+~]+/);
          return /^(html|:root|body|\[|\*)/i.test(compounds[compounds.length - 1] || '');
        });
      }
      rootish.set(at, found);
    }
    return found;
  };

  const TEXT = /^(color|fill|stroke|stop-color|flood-color|caret-color|accent-color|text-decoration(-color)?|text-emphasis(-color)?|-webkit-text-fill-color|-webkit-text-stroke(-color)?)$/;
  const paints = new Map();
  const paintOf = (name, seen) => {
    const done = paints.get(name);
    if (done) return done;
    if (seen.has(name)) return [false, false];
    seen.add(name);
    let text = false;
    let surface = false;
    for (const [property, at] of uses.get(name) || []) {
      if (property.startsWith('--')) {
        // A grey of the page's own defined from this one on the root is told
        // apart under its own name, not through this one.
        if (names.has(property) && isRootish(at)) continue;
        const inner = paintOf(property, seen);
        text = text || inner[0];
        surface = surface || inner[1];
      } else if (TEXT.test(property)) {
        text = true;
      } else {
        surface = true;
      }
    }
    const out = [text, surface];
    paints.set(name, out);
    return out;
  };
  const result = [];
  for (const name of names) result.push([name, paintOf(name, new Set())]);

  // A grey defined on the root as another name for a text colour is that text
  // colour, whatever it is drawn with: YouTube Music's checkmark is a border.
  const definedFrom = new Map();
  for (const [source, found] of uses) {
    for (const [property, at] of found) {
      if (names.has(property) && isRootish(at)) {
        const from = definedFrom.get(property) || [];
        from.push(source);
        definedFrom.set(property, from);
      }
    }
  }
  const isText = (name) => {
    const paint = paints.get(name);
    return names.has(name) && paint !== undefined && paint[0] && !paint[1];
  };
  for (const entry of result) {
    if (!isText(entry[0]) && (definedFrom.get(entry[0]) || []).some(isText)) {
      entry[1] = [true, false];
    }
  }

  // Where a grey that is both is the colour of text. Not on a rule that covers
  // most of the window: keeping the grey there would take the glass with it.
  const area = innerWidth * innerHeight;
  const covers = new Map();
  const isLarge = (at) => {
    let found = covers.get(at);
    if (found === undefined) {
      found = false;
      if (area > 0) {
        try {
          for (const element of doc.querySelectorAll(selectors[at])) {
            const box = element.getBoundingClientRect();
            if (box.width * box.height > area / 4) {
              found = true;
              break;
            }
          }
        } catch (invalid) {
          found = true;
        }
      }
      covers.set(at, found);
    }
    return found;
  };
  const keeps = [];
  const kept = new Set();
  for (const [name, paint] of result) {
    if (!paint[0] || !paint[1]) continue;
    for (const [property, at] of uses.get(name) || []) {
      if (keeps.length >= MAX_KEEPS || isRootish(at)) continue;
      const text = property.startsWith('--')
        ? paintOf(property, new Set())[0]
        : TEXT.test(property);
      const key = at + ' ' + name;
      if (text && !kept.has(key) && !isLarge(at)) {
        kept.add(key);
        keeps.push([selectors[at], name]);
      }
    }
  }
  return {
    greys,
    rules,
    paints: result.map(([name, paint]) => [name, paint[0] ? 1 : 0, paint[1] ? 1 : 0]),
    keeps,
  };
})()`;
};

const isByte = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= 255;

const isFlag = (value: unknown): value is 0 | 1 => value === 0 || value === 1;

/**
 * A selector this can put back into the page: a plain one of bounded length,
 * with its brackets balanced so it cannot reach past the `:is()` it is put in.
 * Nothing nested (`&`) and nothing that is not an element (`::before`,
 * `:host`) — `:is()` cannot hold those, and they would be dropped anyway.
 */
const isPlainSelector = (value: unknown): value is string => {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_SELECTOR ||
    /[{};&]|::|:host/.test(value)
  ) {
    return false;
  }
  // Quoted attribute values may hold anything; what is left must be balanced.
  const bare = value.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '');
  if (/["']/.test(bare)) {
    return false;
  }
  let depth = 0;
  const isNeverBelowZero = Array.from(bare).every((char) => {
    if (char === '(' || char === '[') {
      depth += 1;
    } else if (char === ')' || char === ']') {
      depth -= 1;
    }
    return depth >= 0;
  });
  return isNeverBelowZero && depth === 0;
};

const parseGrey = (entry: unknown): TGuestGrey | undefined => {
  if (!Array.isArray(entry) || entry.length !== 5) {
    return undefined;
  }
  const [name, r, g, b, alpha] = entry as unknown[];
  if (
    isCustomProperty(name) &&
    isByte(r) &&
    isByte(g) &&
    isByte(b) &&
    typeof alpha === 'number' &&
    alpha >= 0 &&
    alpha <= 1
  ) {
    return [name, r, g, b, alpha];
  }
  return undefined;
};

const parsePaints = (raw: unknown): Map<string, IGuestPaint> | undefined => {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const paints = new Map<string, IGuestPaint>();
  raw.forEach((entry: unknown) => {
    if (!Array.isArray(entry) || entry.length !== 3) {
      return;
    }
    const [name, text, surface] = entry as unknown[];
    if (isCustomProperty(name) && isFlag(text) && isFlag(surface)) {
      paints.set(name, { text: text === 1, surface: surface === 1 });
    }
  });
  return paints;
};

const parseKeeps = (raw: unknown): TGuestKeep[] | undefined => {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const keeps: TGuestKeep[] = [];
  raw.slice(0, MAX_KEEPS).forEach((entry: unknown) => {
    if (!Array.isArray(entry) || entry.length !== 2) {
      return;
    }
    const [selector, name] = entry as unknown[];
    if (isPlainSelector(selector) && isCustomProperty(name)) {
      keeps.push([selector, name]);
    }
  });
  return keeps;
};

/**
 * The page's answer, as data this can trust: it comes from a page on the
 * internet, whose script runs beside this one and can make it return anything.
 * A name that is not a plain custom property, a channel that is not a byte, or
 * a selector that could reach outside its own rule is dropped rather than
 * written into a stylesheet.
 */
export const parseGuestTintReport = (raw: unknown): IGuestTintReport => {
  if (typeof raw !== 'object' || raw === null) {
    return { greys: [], ruleCount: undefined };
  }
  const report = raw as Record<string, unknown>;
  const greys = Array.isArray(report.greys)
    ? report.greys
        .map(parseGrey)
        .filter((grey): grey is TGuestGrey => grey !== undefined)
    : [];
  const ruleCount =
    typeof report.rules === 'number' &&
    Number.isInteger(report.rules) &&
    report.rules >= 0
      ? report.rules
      : undefined;
  const paints = parsePaints(report.paints);
  const keeps = parseKeeps(report.keeps);
  return {
    greys,
    ruleCount,
    ...(paints ? { paints } : {}),
    ...(keeps ? { keeps } : {}),
  };
};
