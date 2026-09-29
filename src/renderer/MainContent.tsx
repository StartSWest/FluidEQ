/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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

import './styles/MainContent.scss';
import './styles/MultiSelect.scss';

import useEqPageBands from './eq/useEqPageBands';
import useEqPageActions from './eq/useEqPageActions';
import EqPageView from './eq/EqPageView';

const MainContent = () => {
  const bands = useEqPageBands();
  const actions = useEqPageActions(bands);
  return <EqPageView bands={bands} actions={actions} />;
};

export default MainContent;
