/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The smaller parts the Studio's bench is built from: the version tag in its
 * bar, the empty stage where the first project starts, the stage's area with
 * the divider under it, and the card at the foot of the side column that
 * holds whichever share inside the bench chose.
 */

import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StudioShipSection from '../../../renderer/studio/StudioShipSection';
import StudioStageArea from '../../../renderer/studio/StudioStageArea';
import StudioStageStart from '../../../renderer/studio/StudioStageStart';
import StudioVersion from '../../../renderer/studio/StudioVersion';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key} ${JSON.stringify(vars)}` : key,
  }),
}));

describe('the version tag', () => {
  const tag = () => screen.getByText('studio.version.label {"version":3}');

  it('says a version nobody has yet is unpublished', () => {
    render(<StudioVersion version={3} published={undefined} />);
    const meaning = 'studio.version.unpublished {"version":3,"published":3}';
    expect(tag()).toHaveAttribute('title', meaning);
    expect(tag()).toHaveAttribute('aria-label', meaning);
    expect(tag()).not.toHaveClass('studio-bench__version--ahead');
  });

  it('says the version on the bench is the one people have', () => {
    render(<StudioVersion version={3} published={3} />);
    expect(tag()).toHaveAttribute(
      'title',
      'studio.version.live {"version":3,"published":3}',
    );
    expect(tag()).not.toHaveClass('studio-bench__version--ahead');
  });

  it('marks a version ahead of the published one, naming both', () => {
    render(<StudioVersion version={3} published={2} />);
    expect(tag()).toHaveAttribute(
      'title',
      'studio.version.ahead {"version":3,"published":2}',
    );
    expect(tag()).toHaveClass(
      'studio-bench__version',
      'studio-bench__version--ahead',
    );
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

describe('the card at the foot of the side column', () => {
  it('is a region named by its title, around the inside it is given', () => {
    render(
      <StudioShipSection>
        <button type="button">inside</button>
      </StudioShipSection>,
    );
    const card = screen.getByRole('region', { name: 'studio.ship.title' });
    expect(card).toHaveClass('studio-card', 'studio-ship-card');
    expect(
      within(card).getByRole('button', { name: 'inside' }),
    ).toBeInTheDocument();
  });
});
