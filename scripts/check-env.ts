import { env } from './lib/env';

const keys = ['ANTHROPIC_API_KEY', 'ELEVENLABS_API_KEY', 'BRIGHTDATA_API_KEY', 'BRIGHTDATA_ZONE', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_SYNC_MODE'];
for (const k of keys) console.log(`${k.padEnd(28)} ${env(k) ? 'set' : 'MISSING'}${k === 'VITE_SYNC_MODE' ? ` (${env(k) ?? 'off'})` : ''}`);
