import type { ReactNode } from 'react';
import { FluidEqProviderWrapper } from 'renderer/utils/FluidEqContext';
import { I18nProvider } from 'renderer/utils/I18nContext';
import defaultFluidEqContext from './mockFluidEqProvider';

/** Profile controls use the same stable translation and shell providers as the app. */
const ProfileTestProvider = ({ children }: { children: ReactNode }) => (
  <I18nProvider>
    <FluidEqProviderWrapper value={defaultFluidEqContext}>
      {children}
    </FluidEqProviderWrapper>
  </I18nProvider>
);

export default ProfileTestProvider;
