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
License; its full license text is included in assets/licenses.

## The FluidEQ name and logo

The name **FluidEQ** and the FluidEQ logo — the teal S-curve wave glyph on a
dark rounded square, as in `assets/icon.svg` and the in-app brand mark — are
unregistered marks of Ivan Carmenates Garcia.

They are distributed with one additional term, of the kind GPL-3.0 section 7(e)
expressly allows a licensor to add:

> Rights under trademark law to use the name FluidEQ or the FluidEQ logo are
> not granted. This term declines to grant those rights. It does not restrict
> any right the GPL grants, and it does not apply to the source code.

This is an additional term under section 7, not a further restriction on the
licence. The code stays GPL-3.0-or-later in full. Redistributing FluidEQ
unchanged under its own name is fine; naming it truthfully as the thing your
work is based on is fine; a modified version distributed to others should carry
a name and an icon of its own, which `src/common/branding.ts` makes a one-file
change. Section 7 also permits removing this term from material you convey.
The full policy is in `TRADEMARK.md`.

AQUA is the name of the upstream project and is used here only to say
truthfully where FluidEQ came from. No claim is made to it.

## Equalizer APO

FluidEQ is an interface to Equalizer APO and distributes its installer. It is a
separate program, not a part of FluidEQ and not proprietary FluidEQ technology.

- Upstream project: https://sourceforge.net/projects/equalizerapo/
- Copyright © Jonas Thedering and contributors
- License: GNU General Public License, version 2 or later
- License text: `assets/licenses/EqualizerAPO-LICENSE.txt`, and in the
  Equalizer APO installation itself

Because the installer is distributed with FluidEQ, the corresponding source is
distributed with it: `EqualizerAPO-src-<version>.zip` is published as an asset
of the same release and matches the exact version bundled. Bumping the bundled
version moves that archive with it.

The two programs are never combined into one work. FluidEQ does not link
against Equalizer APO, does not load it into its own process, and includes no
part of its code; they are separate programs that exchange text configuration
files. Where FluidEQ's source describes how Equalizer APO parses those files,
that is a statement of fact about the interface, established by reading the
published source. No part of it has been copied.

## Third-party websites reached from the Video tab

FluidEQ includes a Video tab, which opens a small fixed set of music and video
websites in an embedded Chromium window so that something can be playing while
the equaliser is adjusted.

Those websites, their content, their trade marks and their names belong to their
respective owners. FluidEQ is not affiliated with, endorsed by, sponsored by or
connected to any of them, and no such relationship should be inferred from a
site being reachable from the app.

FluidEQ does not host, store, cache, copy, proxy or redistribute any content
from those sites, and provides no means of downloading from them. Each site is
loaded directly from its own servers, over HTTPS, into an ordinary browser
engine, and is rendered as that site serves it.

The session used is kept between runs, so that a site you have signed in to
remembers you the next time the tab is opened. It is a browser profile and
nothing more: cookies and site storage written by those sites, held in a
partition of their own, separate from anything else the application stores, and
encrypted at rest by the operating system in the same way any browser profile on
the machine is. FluidEQ does not read it. No credential, token or cookie is
inspected, transmitted, or sent anywhere by this application, and none is shared
with any other part of it. The Video tab's toolbar carries a control that
deletes the whole of it — every cookie, sign-in and cached page — in one press.

Use of each site remains subject to that site's own terms of service and to the
rights of the copyright holders in the material it carries. Signing in to an
account brings that account's terms with it. Responsibility for observing those
terms rests with the person using the application, not with this project.

No part of this notice changes or restricts the rights granted by the GPL. If
this repository and the license text conflict, the license text controls.
