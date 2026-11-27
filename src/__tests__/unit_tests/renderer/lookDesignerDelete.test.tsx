/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The look editor's Delete (Ivan, 2026-11-27: "when deleting a custom look,
 * please jump back to the previous one instead of jumping to Analyzer
 * always"). The panel stays in the tree for its exit after the press, and it
 * used to keep drawing through it: the selection moving off the deleted look
 * re-formed the draft on the look it went to, and the graph showed the
 * deleted look's colours on that form before the look itself. Every frame
 * the graph commits after the press is the look it went back to.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { useLayoutEffect, useState } from 'react';
import en from 'common/i18n/en';
import {
  DEFAULT_GRAPH_LOOK_ID,
  GRAPH_FORM_LOOKS,
  type IGraphLook,
} from 'common/graphStyles';
import { createDraftLook, type IResolvedLook } from 'common/customLooks';
import LookDesigner from '../../../renderer/components/LookDesigner';
import {
  getCustomLook,
  saveCustomLook,
} from '../../../renderer/utils/customLooks';
import {
  getGraphLookId,
  getResolvedLook,
  setGraphLook,
  useGraphLook,
} from '../../../renderer/utils/graphStyle';

jest.mock('../../../renderer/graph/textureUpload', () => {
  class TextureError extends Error {
    readonly reason = 'unreadable';
  }
  return { TextureError, tileFromFile: jest.fn() };
});

const formAt = (index: number): IGraphLook => {
  const form = GRAPH_FORM_LOOKS[index];
  if (!form) {
    throw new Error(`no form at ${index}`);
  }
  return form;
};

const BARS = formAt(1);
const CIRCLE = formAt(2);

/** Every look the graph committed, in order, as the chart would draw it. */
let committed: IResolvedLook[] = [];

const GraphProbe = () => {
  const look = useGraphLook();
  useLayoutEffect(() => {
    committed.push(look);
  }, [look]);
  return null;
};

/**
 * The panel as the graph holds it: a close leaves it in the tree, playing
 * its exit (`useExitAnimation`), until the exit's own end takes it out.
 */
const Panel = () => {
  const [isClosing, setIsClosing] = useState(false);
  return (
    <LookDesigner onClose={() => setIsClosing(true)} isClosing={isClosing} />
  );
};

const openOn = (style: IGraphLook['style']) => {
  const mine = createDraftLook(style, 'rainbow', 'Mine');
  saveCustomLook(mine);
  setGraphLook(mine.id);
  render(
    <>
      <GraphProbe />
      <Panel />
    </>,
  );
  return mine;
};

const pressDelete = () => {
  committed = [];
  fireEvent.click(screen.getByRole('button', { name: en['look.delete'] }));
};

beforeEach(() => {
  window.localStorage.clear();
  committed = [];
});

describe('the look editor’s Delete', () => {
  it('goes straight back to the look played before, drawing nothing else', () => {
    setGraphLook(BARS.id);
    const mine = openOn(formAt(3).style);
    // The control: the panel is drawing on the graph, so a draft that kept
    // drawing after the press would be seen here.
    expect(getResolvedLook().id).toBe(mine.id);

    pressDelete();

    // Still in the tree, on its way out.
    expect(screen.getByRole('dialog').className).toContain('is-closing');
    expect(getGraphLookId()).toBe(BARS.id);
    expect(committed.length).toBeGreaterThan(0);
    committed.forEach((look) => {
      expect(look.id).toBe(BARS.id);
      expect(look.style).toBe(BARS.style);
    });
    expect(committed.some((look) => look.id === DEFAULT_GRAPH_LOOK_ID)).toBe(
      false,
    );
    expect(getCustomLook(mine.id)).toBeUndefined();
  });

  it('leaves the look on the graph alone when it deletes another', () => {
    setGraphLook(BARS.id);
    const mine = openOn(formAt(3).style);
    // The picker walked on while the look was being edited: the panel
    // follows it (`rebaseDraftLook`) and the graph draws the draft there.
    act(() => setGraphLook(CIRCLE.id));
    expect(getResolvedLook().id).toBe(mine.id);
    expect(getResolvedLook().style).toBe(CIRCLE.style);

    pressDelete();

    expect(getGraphLookId()).toBe(CIRCLE.id);
    expect(committed.length).toBeGreaterThan(0);
    committed.forEach((look) => expect(look.id).toBe(CIRCLE.id));
    expect(getCustomLook(mine.id)).toBeUndefined();
  });
});
