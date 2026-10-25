/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/** Every key of this language, by feature. Partial by design — see `../en`. */
import { Dictionary } from '../en';
import karaoke from './karaoke';
import eq from './eq';
import app from './app';
import look from './look';
import video from './video';
import library from './library';
import songEq from './songEq';
import songSound from './songSound';
import dsp from './dsp';
import dspDeEsser from './dspDeEsser';
import dspStageSave from './dspStageSave';
import remoteAudio from './remoteAudio';
import tour from './tour';
import help from './help';
import about from './about';
import account from './account';
import forum from './forum';
import profile from './profile';
import terms from './terms';
import studio from './studio';
import studioChat from './studioChat';
import studioStarter from './studioStarter';
import plus from './plus';
import trial from './trial';
import store from './store';
import creator from './creator';
import termsNotice from './termsNotice';
import engineHealth from './engineHealth';
import dspOff from './dspOff';
import engineUpdate from './engineUpdate';
import lighting from './lighting';
import wallpaper from './wallpaper';
import bugReport from './bugReport';
import review from './review';
import insights from './insights';
import announce from './announce';
import player from './player';
import genre from './genre';
import genrePop from './genrePop';
import genreRock from './genreRock';
import genreCountry from './genreCountry';
import genreUrban from './genreUrban';
import genreJazzClassical from './genreJazzClassical';
import genreElectronic from './genreElectronic';
import genreReggae from './genreReggae';
import genreLatin from './genreLatin';
import genreWorld from './genreWorld';
import troubleshoot from './troubleshoot';
import files from './files';

const fr: Partial<Dictionary> = {
  ...karaoke,
  ...eq,
  ...app,
  ...look,
  ...video,
  ...library,
  ...songEq,
  ...songSound,
  ...dsp,
  ...dspDeEsser,
  ...dspStageSave,
  ...remoteAudio,
  ...tour,
  ...help,
  ...about,
  ...account,
  ...forum,
  ...profile,
  ...terms,
  ...studio,
  ...studioChat,
  ...studioStarter,
  ...plus,
  ...trial,
  ...store,
  ...creator,
  ...termsNotice,
  ...engineHealth,
  ...dspOff,
  ...engineUpdate,
  ...lighting,
  ...wallpaper,
  ...bugReport,
  ...review,
  ...insights,
  ...announce,
  ...player,
  ...genre,
  ...genrePop,
  ...genreRock,
  ...genreCountry,
  ...genreUrban,
  ...genreJazzClassical,
  ...genreElectronic,
  ...genreReggae,
  ...genreLatin,
  ...genreWorld,
  ...troubleshoot,
  ...files,
};

export default fr;
