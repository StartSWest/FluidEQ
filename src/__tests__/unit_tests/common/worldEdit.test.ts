/**
 * @jest-environment node
 */
import {
  applyWorldEdits,
  nudged,
  sameShape,
  scaled,
} from '../../../common/worldEdit';

const world = () => ({
  camera: { position: [0, 2, 10], target: [0, 0, 0], fov: 40 },
  future: { kept: true },
  nodes: [
    { type: 'mesh', name: 'Moon', position: [1, 2, 3] },
    {
      type: 'group',
      name: 'Boat',
      position: [0, 'sin(time) * 2', 0],
      scale: 2,
      children: [{ type: 'mesh', name: 'Hull' }],
    },
  ],
});

describe('a hand edit written into a world', () => {
  it('adds to a number and keeps a formula, nudged', () => {
    const edited = applyWorldEdits(world(), [
      { kind: 'move', path: [1], position: [1.5, 0.25, 0] },
    ]);
    expect(edited.ok && (edited.world.nodes as never[])[1]).toMatchObject({
      position: [1.5, '(sin(time) * 2) + 0.25', 0],
    });
  });

  it('changes the number at the end when nudged again, never the brackets', () => {
    expect(nudged('(sin(time) * 2) + 0.25', 1, 0)).toBe(
      '(sin(time) * 2) + 1.25',
    );
    expect(nudged('(sin(time) * 2) + 0.25', -1, 0)).toBe(
      '(sin(time) * 2) - 0.75',
    );
    // Back where it began: the formula as its author wrote it.
    expect(nudged('(sin(time) * 2) + 0.25', -0.25, 0)).toBe('sin(time) * 2');
    // Two brackets that only look like one are left alone and wrapped.
    expect(nudged('(a) + (b) + 1', 1, 0)).toBe('((a) + (b) + 1) + 1');
    expect(scaled('(bass) * 2', 1.5, 1)).toBe('(bass) * 3');
  });

  it('refuses a formula grown past what a world keeps', () => {
    const long = `sin(time)${' + 1'.repeat(98)}`;
    const edited = applyWorldEdits(
      { nodes: [{ type: 'group', position: [long, 0, 0] }] },
      [{ kind: 'move', path: [0], position: [0.5, 0, 0] }],
    );
    expect(edited).toEqual({ ok: false, reason: 'formula-full' });
  });

  it('keeps one size for all sides until the sides differ', () => {
    const even = applyWorldEdits(world(), [
      { kind: 'move', path: [1], scale: [2, 2, 2] },
    ]);
    expect(even.ok && (even.world.nodes as never[])[1]).toMatchObject({
      scale: 4,
    });
    const uneven = applyWorldEdits(world(), [
      { kind: 'move', path: [1], scale: [2, 1, 1] },
    ]);
    expect(uneven.ok && (uneven.world.nodes as never[])[1]).toMatchObject({
      scale: [4, 2, 2],
    });
  });

  it('leaves the original and everything unnamed untouched', () => {
    const before = world();
    const edited = applyWorldEdits(before, [
      { kind: 'rename', path: [0], name: 'Sun' },
      { kind: 'camera', position: [1, 1, 1], target: [0, 1, 0] },
    ]);
    expect(before).toEqual(world());
    expect(edited.ok && edited.world).toMatchObject({
      future: { kept: true },
      camera: { fov: 40, position: [1, 1, 1], target: [0, 1, 0] },
    });
  });

  it('copies beside the first, under a name of its own', () => {
    const edited = applyWorldEdits(world(), [{ kind: 'copy', path: [0] }]);
    expect(edited.ok && edited.world.nodes).toMatchObject([
      { name: 'Moon', position: [1, 2, 3] },
      { name: 'Moon 2', position: [2, 2, 3] },
      { name: 'Boat' },
    ]);
  });

  it('does all of an edit or none of it', () => {
    const edited = applyWorldEdits(world(), [
      { kind: 'delete', path: [0] },
      { kind: 'delete', path: [7] },
    ]);
    expect(edited).toEqual({ ok: false, reason: 'missing' });
  });

  it('tells a world that kept every thing from one that lost a thing', () => {
    const raw = world().nodes;
    const read = [{ children: [] }, { children: [{ children: [] }] }];
    expect(sameShape(raw, read)).toBe(true);
    expect(sameShape(raw, [read[1]])).toBe(false);
    expect(sameShape(raw, [read[0], { children: [] }])).toBe(false);
  });
});
