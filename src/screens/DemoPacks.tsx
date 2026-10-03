import { useSearchParams } from 'react-router-dom';
import { CARTONS, cartonHtml } from '../demo/cartons';

export function DemoPacks() {
  const [params] = useSearchParams();
  const only = Number(params.get('fixture') ?? 0);
  const list = only ? CARTONS.filter((c) => c.n === only) : CARTONS;
  return (
    <div style={{ background: '#E9ECEA', minHeight: '100%', padding: 24, display: 'flex', flexWrap: 'wrap', gap: 24 }}>
      {list.map((c) => (
        <figure key={c.n} style={{ margin: 0 }}>
          <div dangerouslySetInnerHTML={{ __html: cartonHtml(c) }} />
          {!only && <figcaption style={{ fontFamily: 'Arial', marginTop: 8 }}>Carton {c.n}: expected {c.expected}</figcaption>}
        </figure>
      ))}
    </div>
  );
}
