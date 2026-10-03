import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AppProvider, useApp } from './state/AppContext';
import type { LoadedPacks } from './data/packs';
import { Welcome } from './screens/Welcome';
import { Home } from './screens/Home';
import { TypeNumber } from './screens/TypeNumber';
import { Result } from './screens/Result';
import { Report } from './screens/Report';
import { History } from './screens/History';
import { Settings } from './screens/Settings';
import { DemoPacks } from './screens/DemoPacks';

function Gate({ children }: { children: ReactNode }) {
  const { status, error, settings, t } = useApp();
  const location = useLocation();
  if (status === 'loading') {
    return (
      <div className="app">
        <main className="main"><span className="brand">DawaCheck</span><div className="progress"><i style={{ width: '60%' }} /></div></main>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="app">
        <main className="main"><span className="brand">DawaCheck</span><p className="error">{t('load_failed')}</p><p className="small muted">{error}</p></main>
      </div>
    );
  }
  const open = location.pathname.startsWith('/demo-packs') || location.pathname.startsWith('/dashboard');
  if (!settings.onboarded && !open && location.pathname !== '/welcome') return <Navigate to="/welcome" replace />;
  return <>{children}</>;
}

export function App({ loader }: { loader?: () => Promise<LoadedPacks> }) {
  return (
    <AppProvider loader={loader}>
      <HashRouter>
        <Gate>
          <Routes>
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/" element={<Home />} />
            <Route path="/type" element={<TypeNumber />} />
            <Route path="/result/:id" element={<Result />} />
            <Route path="/report/:id" element={<Report />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/demo-packs" element={<DemoPacks />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Gate>
      </HashRouter>
    </AppProvider>
  );
}
