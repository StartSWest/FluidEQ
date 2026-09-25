/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A readout rewritten while it is looked at changes the text node it has,
 * never swaps it for another: an insertion anywhere under the window's
 * `:has()` rules restyled ~1,100 elements, and the Studio's cost readings
 * did it nearly every frame. An observer of the document sees an insertion
 * as a `childList` record and a change of data as a `characterData` one.
 */

import writeLiveText from '../../../renderer/utils/liveText';

const watch = (target: Node) => {
  const observer = new MutationObserver(() => undefined);
  observer.observe(target, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  return () => {
    const records = observer.takeRecords();
    observer.disconnect();
    return records.map((record) => record.type);
  };
};

const readout = (text: string) => {
  const element = document.createElement('span');
  element.textContent = text;
  document.body.appendChild(element);
  return element;
};

afterEach(() => {
  document.body.replaceChildren();
});

it('changes the data of the text node that is there', () => {
  const element = readout('0.25');
  const node = element.firstChild;
  const records = watch(element);

  writeLiveText(element, '0.50');

  expect(element.textContent).toBe('0.50');
  expect(element.firstChild).toBe(node);
  expect(records()).toEqual(['characterData']);
});

it('is seen by the same observer when the node is swapped, the way it was', () => {
  // The control for the test above: the observer does report an insertion,
  // so its absence there is the helper's doing.
  const element = readout('0.25');
  const records = watch(element);

  element.textContent = '0.50';

  expect(records()).toContain('childList');
});

it('writes nothing when the text is already what it says', () => {
  const element = readout('0.50');
  const records = watch(element);

  writeLiveText(element, '0.50');

  expect(records()).toEqual([]);
});

it('gives an empty readout its text once, and changes it in place after', () => {
  const element = readout('');
  const first = watch(element);

  writeLiveText(element, '9.7 ms');
  expect(first()).toEqual(['childList']);
  const node = element.firstChild;

  const second = watch(element);
  writeLiveText(element, '8.9 ms');
  expect(second()).toEqual(['characterData']);
  expect(element.firstChild).toBe(node);
});

it('replaces anything that is not one text node, as textContent did', () => {
  const element = readout('');
  element.append('0.2', document.createElement('b'));

  writeLiveText(element, '0.50');

  expect(element.childNodes).toHaveLength(1);
  expect(element.textContent).toBe('0.50');
});

it('does nothing without an element', () => {
  expect(() => writeLiveText(null, '0.50')).not.toThrow();
});
