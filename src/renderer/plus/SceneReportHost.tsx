/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import ReportDialog from './ReportDialog';
import { closeSceneReport, useSceneReport } from './sceneReportRequest';

/**
 * The report dialog for a scene reported from outside the gallery — the look
 * picker today. Mounted at the app root, so the menu it was asked from can
 * close under it without taking it along (`sceneReportRequest.ts`). The same
 * dialog the gallery's scene page opens: four reasons, nothing to type.
 */
export default function SceneReportHost() {
  const { target } = useSceneReport();
  if (!target) {
    return null;
  }
  return (
    <ReportDialog
      key={target.lookId}
      scene={target}
      name={target.name}
      onClose={closeSceneReport}
    />
  );
}
