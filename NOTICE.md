# FluidEQ derivative-work notice

FluidEQ is a modified version of AQUA, a system-wide parametric audio equalizer
interface originally developed by the AQUA Dev Team.

- Upstream project: https://github.com/h39s/AQUA
- Upstream copyright: Copyright © 2023 AQUA Dev Team
- License: GNU General Public License, version 3 or later
- FluidEQ repository: https://github.com/StartSWest/FluidEQ
- FluidEQ modifications: Copyright © 2026 Ivan Carmenates Garcia

GPL-3.0 section 5(a) requires a modified work to carry prominent notice that it
has been modified. It has been, substantially. Original to FluidEQ and not
present in upstream AQUA:

- automatic per-output profiles keyed to the stable Windows endpoint GUID,
  with attach-on-edit and a restorable manual snapshot;
- driver-type compensation, twelve transducer profiles written as their own
  Equalizer APO layer;
- voicing, five curated target curves written as a further layer;
- convolution, from the AutoEq catalogue or a user's own WAV;
- Smart EQ, closed-loop correction from a live measurement of the output;
- a single preamp computed from the combined response of every layer;
- reading the Equalizer APO config back as the source of truth on startup;
- import of Equalizer APO ParametricEQ and GraphicEQ files and WAV impulse
  responses, with a reader covering the full APO filter grammar;
- the GadgetryTech / Squiglink measurement source, fitted locally;
- a rebuilt interface: design-token layer, scrolling workspace, editable
  response graph with a live output curve, shared motion vocabulary;
- ten-language localisation;
- in-app updates and release notes;
- the FluidEQ name and visual identity.

Existing source-file notices and the repository's Git history are intentionally
preserved. FluidEQ is not presented as an official continuation endorsed by the
original AQUA maintainers.

The bundled AutoEQ-derived preset data remains attributable to its respective
authors and source projects. The current library was generated from the
official AutoEq results at commit 7ae0f56d53074872b028649617a22bbb4232feb7.
AutoEq is Copyright (c) 2018-2022 Jaakko Pasanen and distributed under the MIT
License; its full license text is included in assets/licenses. Equalizer APO is
a separate project and is not included as proprietary FluidEQ technology.

No part of this notice changes or restricts the rights granted by the GPL. If
this repository and the license text conflict, the license text controls.
