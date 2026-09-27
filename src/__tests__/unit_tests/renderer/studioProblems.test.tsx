/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The box under the Studio's stage that says what is wrong with the newest
 * version: every rule its files break, where, and a photo to choose when the
 * picture is what is missing; the one driver line worth reading when the
 * shader does not compile; and why a heavy scene was stopped. Absent the rest
 * of the time, which is most of it.
 */

import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import StudioProblems from '../../../renderer/studio/StudioProblems';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key} ${JSON.stringify(vars)}` : key,
  }),
}));

it('shows nothing while nothing is wrong with the version', () => {
  const { container } = render(
    <StudioProblems problems={undefined} trouble={undefined} />,
  );
  expect(container).toBeEmptyDOMElement();
});

it('leaves a computer that cannot draw at all to the cost line', () => {
  // There is nothing in the scene to fix, so nothing is listed here.
  const { container } = render(
    <StudioProblems problems={undefined} trouble={{ kind: 'unavailable' }} />,
  );
  expect(container).toBeEmptyDOMElement();
});

it('lists every broken rule with its file, and its line where it has one', () => {
  render(
    <StudioProblems
      problems={[
        { code: 'while', file: 'source', line: 12 },
        { code: 'bad-json', file: 'pack.json' },
      ]}
      trouble={undefined}
    />,
  );
  const box = screen.getByRole('alert');
  expect(within(box).getByText('studio.problem.heading')).toBeInTheDocument();
  const [loop, pack] = within(box).getAllByRole('listitem');
  expect(loop).toHaveTextContent(
    'studio.problem.line {"file":"studio.file.source","line":12}',
  );
  expect(loop).toHaveTextContent('studio.problem.while');
  expect(pack).toHaveTextContent('studio.file.pack');
  expect(pack).toHaveTextContent('studio.problem.bad-json');
  // Neither is the picture's, so there is no photo to ask for.
  expect(screen.queryByText('studio.picture.hint')).toBeNull();
});

it('calls a missing picture the picture, and says to choose a photo for it', () => {
  render(
    <StudioProblems
      problems={[{ code: 'missing-file', file: 'artwork' }]}
      trouble={undefined}
    />,
  );
  expect(screen.getByRole('listitem')).toHaveTextContent(
    'studio.picture.missing',
  );
  expect(screen.getByText('studio.picture.hint')).toBeInTheDocument();
});

it("quotes the driver's first error line, not the warnings before it", () => {
  render(
    <StudioProblems
      problems={undefined}
      trouble={{
        kind: 'compile',
        log: 'WARNING: 0:3: unused\n  ERROR: 0:12: sceneColour : no matching overload  \nERROR: 1 compilation errors.',
      }}
    />,
  );
  expect(screen.getByText('studio.compile.heading')).toBeInTheDocument();
  expect(
    screen.getByText('ERROR: 0:12: sceneColour : no matching overload'),
  ).toBeInTheDocument();
  expect(screen.getByText('studio.compile.hint')).toBeInTheDocument();
});

it('quotes the whole log when no line of it says error', () => {
  render(
    <StudioProblems
      problems={undefined}
      trouble={{ kind: 'compile', log: '  link failed\n' }}
    />,
  );
  expect(screen.getByText('link failed')).toBeInTheDocument();
});

it("quotes the first error of a 3D world that was not built, under the world's own heading", () => {
  // The stage plays the shader alone then, so the heading says the sky is
  // all that was drawn, not that the shader failed.
  render(
    <StudioProblems
      problems={undefined}
      trouble={{
        kind: 'world',
        report: {
          drawn: false,
          notes: [
            {
              code: 'material',
              log: "world: material glow\n  ERROR: 0:14: 'worldSurface' : no matching overloaded function found  \nERROR: 1 compilation errors.",
            },
          ],
        },
      }}
    />,
  );
  const box = screen.getByRole('alert');
  expect(within(box).getByText('studio.world.heading')).toBeInTheDocument();
  expect(
    within(box).getByText('studio.worldNote.material'),
  ).toBeInTheDocument();
  expect(
    within(box).getByText(
      "ERROR: 0:14: 'worldSurface' : no matching overloaded function found",
    ),
  ).toBeInTheDocument();
  expect(within(box).getByText('studio.compile.hint')).toBeInTheDocument();
  expect(screen.queryByText('studio.compile.heading')).toBeNull();
});

it('says each reason in the member’s language, never the engine’s English', () => {
  // The notes come out of a worker that knows no language; an English line
  // from it once stood under a translated heading in every locale.
  render(
    <StudioProblems
      problems={undefined}
      trouble={{
        kind: 'world',
        report: {
          drawn: false,
          notes: [
            { code: 'engine-failed', detail: 'NetworkError' },
            { code: 'engine-missing' },
            { code: 'engine-unsupported' },
          ],
        },
      }}
    />,
  );
  const [failed, missing, unsupported] = screen.getAllByRole('listitem');
  expect(failed).toHaveTextContent(
    'studio.worldNote.engine-failed {"detail":"NetworkError"}',
  );
  expect(missing).toHaveTextContent('studio.worldNote.engine-missing');
  expect(unsupported).toHaveTextContent('studio.worldNote.engine-unsupported');
});

it('says a world that drew with a model left out was drawn, and names the model', () => {
  // Built with a part missing is not "only its sky": the heading says what
  // is on the stage, and the model's name is where to look.
  render(
    <StudioProblems
      problems={undefined}
      trouble={{
        kind: 'world',
        report: {
          drawn: true,
          notes: [
            { code: 'model-refused', model: 'ship' },
            { code: 'model-unreadable', model: 'tree', detail: 'bad chunk' },
          ],
        },
      }}
    />,
  );
  const box = screen.getByRole('alert');
  expect(within(box).getByText('studio.world.partial')).toBeInTheDocument();
  expect(screen.queryByText('studio.world.heading')).toBeNull();
  const [refused, unreadable] = within(box).getAllByRole('listitem');
  expect(refused).toHaveTextContent(
    'studio.worldNote.model-refused {"model":"ship"}',
  );
  expect(unreadable).toHaveTextContent(
    'studio.worldNote.model-unreadable {"model":"tree","detail":"bad chunk"}',
  );
});

it("names the 3D world as the file a world's problem is in", () => {
  render(
    <StudioProblems
      problems={[
        { code: 'while', file: 'world', line: 3 },
        { code: 'bad-world', file: 'world' },
      ]}
      trouble={undefined}
    />,
  );
  const [loop, empty] = screen.getAllByRole('listitem');
  expect(loop).toHaveTextContent(
    'studio.problem.line {"file":"studio.file.world","line":3}',
  );
  expect(loop).toHaveTextContent('studio.problem.while');
  expect(empty).toHaveTextContent('studio.file.world');
  expect(empty).toHaveTextContent('studio.problem.bad-world');
});

it('says why a scene too heavy for this computer was stopped', () => {
  render(<StudioProblems problems={undefined} trouble={{ kind: 'heavy' }} />);
  expect(screen.getByRole('alert')).toHaveTextContent('studio.heavy.body');
});
