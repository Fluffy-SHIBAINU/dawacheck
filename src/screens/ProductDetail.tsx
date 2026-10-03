import { Link, useParams } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { Layout } from '../components/Layout';
import { lookup } from '../core/registerIndex';
import { formatDate } from '../lib/time';

export function ProductDetail() {
  const { t, ctx, status } = useApp();
  const { nrn = '' } = useParams();
  const products = ctx ? lookup(ctx.register, decodeURIComponent(nrn)) : [];

  return (
    <Layout>
      {status === 'ready' && products.length === 0 && <p className="muted">{t('find_none')}</p>}
      {products.map((p, i) => (
        <div className="card" key={`${p.nrn}-${i}`} data-testid="product-card">
          <h2>{p.name}</h2>
          <span>{p.ingredient}{p.strength ? ` · ${p.strength}` : ''}</span>
          <span className="muted small">{[p.form, p.route].filter(Boolean).join(' · ')}</span>
          <span className="code">{p.nrn}</span>
          <span className="small">{p.status === 'Active' ? t('status_active') : t('status_inactive')}</span>
          {p.regExpiry && <span className="small">{t('reg_valid_to', { date: formatDate(p.regExpiry) })}</span>}
          {p.applicant && <span className="small muted">{p.applicant}</span>}
          {(p.description || p.packSize) && (
            <div className="look">
              <span className="label">{t('looks_like')}</span>
              {p.description && <span>{p.description}</span>}
              {p.packSize && <span>{t('pack_label', { pack: p.packSize })}</span>}
            </div>
          )}
        </div>
      ))}
      <p className="notice small">{t('product_note')}</p>
      <Link to="/find" className="btn btn-outline">{t('find_title')}</Link>
    </Layout>
  );
}
