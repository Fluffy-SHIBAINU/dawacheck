import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function total(dir: string, filter: (p: string) => boolean = () => true): number {
  if (!existsSync(dir)) return 0;
  let sum = 0;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) sum += total(p, filter);
    else if (filter(p)) sum += st.size;
  }
  return sum;
}
const mb = (b: number) => `${(b / 1e6).toFixed(1)} MB`;
console.log(`whole offline app (dist): ${mb(total('dist'))}`);
console.log(`register pack: ${mb(statSync('dist/packs/register.json').size)}`);
console.log(`alerts pack: ${mb(statSync('dist/packs/alerts.json').size)}`);
console.log(`OCR engine + English model: ${mb(total('dist/tesseract'))}`);
console.log(`voice clips: ${mb(total('dist/voice'))}`);
console.log(`app code: ${mb(total('dist/assets', (p) => p.endsWith('.js') || p.endsWith('.css')))}`);
