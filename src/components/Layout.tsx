import { Link, NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useApp } from '../state/AppContext';
import { LANGS } from '../i18n';

export function Layout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { t, settings } = useApp();
  const lang = LANGS.find((l) => l.code === settings.lang);
  return (
    <div className={wide ? 'app wide' : 'app'}>
      <header className="topbar">
        <Link to="/" className="brand">{t('app_name')}</Link>
        <Link to="/settings" className="pill" aria-label={t('settings_language')}>{lang?.native ?? 'English'}</Link>
      </header>
      <main className="main">{children}</main>
      <nav className="nav" aria-label="Main">
        <NavLink to="/" end>{t('nav_home')}</NavLink>
        <NavLink to="/history">{t('nav_history')}</NavLink>
        <NavLink to="/settings">{t('nav_settings')}</NavLink>
      </nav>
    </div>
  );
}
