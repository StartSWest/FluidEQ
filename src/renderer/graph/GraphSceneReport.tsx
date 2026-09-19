/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { parseMemberLookId } from 'common/memberScenes';
import Glyph from '../community/Glyph';
import { requestSceneReport, useSceneReport } from '../plus/sceneReportRequest';
import { useTranslation } from '../utils/I18nContext';

interface IGraphSceneReportProps {
  lookId: string;
  name: string;
}

/**
 * Reporting another member's scene from the looks, where it is played —
 * which is where a scene that flashes or is not theirs to share is first
 * noticed, not the gallery page it was once added from. Anybody may report,
 * the admin included; one's own scenes are not offered, and the server
 * refuses them regardless.
 *
 * The dialog opens at the app root (`SceneReportHost`), because this lives in
 * a menu that closes on the first press outside it.
 */
export default function GraphSceneReport({
  lookId,
  name,
}: IGraphSceneReportProps) {
  const { t } = useTranslation();
  const { reported } = useSceneReport();
  const ref = parseMemberLookId(lookId);
  if (!ref) {
    return null;
  }
  const sent = reported.has(lookId);
  const label = sent
    ? t('plus.scene.reported')
    : t('graph.scene.report', { name });
  return (
    <button
      type="button"
      className={`graph-scene-report${sent ? ' is-sent' : ''}`}
      aria-label={label}
      title={label}
      disabled={sent}
      onClick={(event) => {
        event.stopPropagation();
        requestSceneReport({
          lookId,
          authorId: ref.authorId,
          sceneId: ref.packId,
          name,
        });
      }}
    >
      <Glyph name={sent ? 'check' : 'report'} />
    </button>
  );
}
