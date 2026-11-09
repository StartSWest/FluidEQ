/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The smaller parts the Studio's bench is built from: the version tag in its
 * bar, the empty stage where the first project starts, the stage's area with
 * the divider under it, and the tabs the work on the scene is in under it.
 */

import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StudioStageArea from '../../../renderer/studio/StudioStageArea';
import StudioStageStart from '../../../renderer/studio/StudioStageStart';
import StudioVersion from '../../../renderer/studio/StudioVersion';
import StudioWorkTabs from '../../../renderer/studio/StudioWorkTabs';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key} ${JSON.stringify(vars)}` : key,
  }),
}));

// Ivan, 2026-11-09: the status line shows "The scene's version, for example
// v23" - the one people have, which moves only when it is published.
describe('the version tag', () => {
  const tag = (version: number) =>
    screen.getByText(`studio.version.label {"version":${version}}`);

  it("shows an unpublished scene's own number, and says nobody has it yet", () => {
    render(<StudioVersion version={3} published={undefined} />);
    const meaning = 'studio.version.unpublished {"version":3,"next":4}';
    expect(tag(3)).toHaveAttribute('title', meaning);
    expect(tag(3)).toHaveAttribute('aria-label', meaning);
    expect(tag(3)).not.toHaveClass('studio-bench__version--changed');
  });

  it('shows the version people have, whatever the project file says', () => {
    // A project a maker's AI ran ahead to 23 while the gallery has 10.
    render(<StudioVersion version={23} published={10} changed={false} />);
    expect(tag(10)).toHaveAttribute(
      'title',
      'studio.version.live {"version":10,"next":11}',
    );
    expect(screen.queryByText(/"version":23/)).toBeNull();
    expect(tag(10)).not.toHaveClass('studio-bench__version--changed');
  });

  it('marks a scene changed since its published version, naming the next', () => {
    render(<StudioVersion version={10} published={10} changed />);
    expect(tag(10)).toHaveAttribute(
      'title',
      'studio.version.changed {"version":10,"next":11}',
    );
    expect(tag(10)).toHaveClass(
      'studio-bench__version',
      'studio-bench__version--changed',
    );
  });

  it('claims no change it cannot know about', () => {
    render(<StudioVersion version={10} published={10} />);
    expect(tag(10)).not.toHaveClass('studio-bench__version--changed');
    expect(tag(10).getAttribute('title')).toMatch(/^studio\.version\.live/);
  });
});

describe('the empty stage', () => {
  it('starts a new project in the loud style and opens a folder in the quiet one', async () => {
    const onNewProject = jest.fn();
    const onLinkFolder = jest.fn();
    render(
      <StudioStageStart
        onNewProject={onNewProject}
        onLinkFolder={onLinkFolder}
      />,
    );
    expect(screen.getByText('studio.stage.startTitle')).toBeInTheDocument();
    const start = screen.getByRole('button', { name: 'studio.project.new' });
    const open = screen.getByRole('button', { name: 'studio.project.add' });
    expect(start).toHaveClass('button', 'small');
    expect(start).not.toHaveClass('subtle');
    expect(open).toHaveClass('button', 'small', 'subtle');

    await userEvent.click(start);
    expect(onNewProject).toHaveBeenCalledTimes(1);
    expect(onLinkFolder).not.toHaveBeenCalled();
    await userEvent.click(open);
    expect(onLinkFolder).toHaveBeenCalledTimes(1);
  });
});

describe("the stage's area", () => {
  const RATIO_KEY = 'fluideq.studio.stageRatio';

  afterEach(() => window.localStorage.removeItem(RATIO_KEY));

  const areaOf = (container: HTMLElement) => {
    const area = container.querySelector('.studio-bench__stage');
    if (!(area instanceof HTMLElement)) {
      throw new Error('no stage area');
    }
    return area;
  };

  it('puts the stage first, then the divider, then what stands under it', () => {
    const { container } = render(
      <StudioStageArea
        stage={<div className="studio-stage__well">stage</div>}
        resizable
      >
        <p>under</p>
      </StudioStageArea>,
    );
    const area = areaOf(container);
    // The divider measures the stage from the area's first child.
    expect(area.firstElementChild).toHaveClass('studio-stage__well');
    expect(area.children[1]).toBe(
      screen.getByRole('separator', { name: 'studio.stage.resize' }),
    );
    expect(area.lastElementChild).toHaveTextContent('under');
  });

  it('has no divider where the stage is a fixed panel', () => {
    render(
      <StudioStageArea stage={<div>stage</div>} resizable={false}>
        <p>under</p>
      </StudioStageArea>,
    );
    expect(screen.queryByRole('separator')).toBeNull();
    // The control: the area still holds the stage and what is under it.
    expect(screen.getByText('stage')).toBeInTheDocument();
    expect(screen.getByText('under')).toBeInTheDocument();
  });

  it('lays the stage out at the shape its divider was last left at', () => {
    window.localStorage.setItem(RATIO_KEY, '1.5');
    const { container } = render(
      <StudioStageArea stage={<div>stage</div>} resizable>
        <p>under</p>
      </StudioStageArea>,
    );
    expect(
      areaOf(container).style.getPropertyValue('--studio-stage-ratio'),
    ).toBe('1.5');
  });
});

describe('the work tabs under the stage', () => {
  const tabs = [
    { id: 'make', label: 'Make' },
    { id: 'code', label: 'Code', badge: 2, isAlert: true },
    { id: 'tune', label: 'Tune' },
  ] as const;

  const renderTabs = (onSelect = jest.fn(), selected = 'make') =>
    render(
      <StudioWorkTabs
        label="Work"
        tabs={tabs}
        selected={selected as 'make' | 'code' | 'tune'}
        onSelect={onSelect}
      >
        <p>panel of {selected}</p>
      </StudioWorkTabs>,
    );

  it('is a tab list whose selected tab labels its panel', () => {
    renderTabs();
    const list = screen.getByRole('tablist', { name: 'Work' });
    const make = within(list).getByRole('tab', { name: 'Make' });
    expect(make).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Make' })).toHaveTextContent(
      'panel of make',
    );
    // Only the selected tab is in the tab order: the panel is one Tab away.
    expect(make).toHaveAttribute('tabindex', '0');
    expect(within(list).getByRole('tab', { name: 'Tune' })).toHaveAttribute(
      'tabindex',
      '-1',
    );
  });

  it('says a count after a name, and a problem count as an alert', () => {
    renderTabs();
    const code = screen.getByRole('tab', { name: 'Code 2' });
    expect(within(code).getByText('2')).toHaveClass(
      'studio-work__badge',
      'is-alert',
    );
    // POSITIVE CONTROL: a tab with no count has no badge.
    expect(
      screen
        .getByRole('tab', { name: 'Make' })
        .querySelector('.studio-work__badge'),
    ).toBeNull();
  });

  it('walks the tabs with the arrows, round the ends, and Home and End', async () => {
    const onSelect = jest.fn();
    renderTabs(onSelect);
    screen.getByRole('tab', { name: 'Make' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onSelect).toHaveBeenLastCalledWith('code');
    await userEvent.keyboard('{ArrowLeft}');
    expect(onSelect).toHaveBeenLastCalledWith('tune');
    await userEvent.keyboard('{End}');
    expect(onSelect).toHaveBeenLastCalledWith('tune');
    await userEvent.keyboard('{Home}');
    expect(onSelect).toHaveBeenLastCalledWith('make');
  });
});
