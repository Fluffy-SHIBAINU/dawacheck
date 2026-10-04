// Scripts and visuals for the narrated demo and technical walkthrough videos.
import { archDiagram, codeCard, dataCard, endCard, phoneFrame, syncCard, testsCard, wideFrame } from './gfx';

export type Visual = { clip?: string; from?: number; html?: string; weight?: number };
export type Segment = { id: string; say?: string; visuals: Visual[]; appClip?: string; appClipMax?: number; min?: number };
export type Story = { segments: Segment[]; highlight: Set<string> };

export const DEMO: Story = {
  highlight: new Set(['ONE', 'TEN', 'FAKE', 'SUBSTANDARD', 'NIGERIA', 'NO', 'PHARMACIST', 'INTERNET', 'DAWACHECK', 'NAFDAC', 'REGISTER', 'SNAP', 'HAUSA', 'AMBER', 'REPORT', 'SIGNAL', 'RED', 'PIDGIN', 'SYNC', 'FAKES', 'CLUSTER', 'CHECK']),
  segments: [
    { id: 'hook', say: 'In low- and middle-income countries, one in ten medicines is fake or substandard. In Nigeria, many people buy medicine with no pharmacist, and no internet.',
      visuals: [{ clip: 'market' }, { clip: 'vendor' }] },
    { id: 'offline', say: 'DawaCheck works with no internet. The full NAFDAC register is already on the phone.',
      visuals: [{ clip: 'scan', from: 0.4, weight: 0.9 }, { html: phoneFrame('03-home-ha-offline', 'OFFLINE', 'No internet needed', '8,922 registered products and 84 NAFDAC alerts, on the phone') }] },
    { id: 'green', say: 'Snap the box. DawaCheck reads the NAFDAC number, checks the register, and answers out loud, here in Hausa.', appClip: 'public/voice/ha/v_green.mp3', appClipMax: 3.2,
      visuals: [{ html: phoneFrame('04-scan-reading', 'ON-DEVICE OCR', 'Snap the box', 'The photo never leaves the phone'), weight: 0.8 }, { html: phoneFrame('05-green-ha', 'GREEN', 'Registered with NAFDAC', 'Shown and spoken out loud in Hausa'), weight: 1.5 }] },
    { id: 'amber', say: 'This box copies a real number, but the name and strength don’t match: amber, check carefully.',
      visuals: [{ html: phoneFrame('06-amber-en', 'AMBER', 'The box doesn’t match', 'A copied number with the wrong name and strength') }] },
    { id: 'report', say: 'Report it in one tap. The report waits on the phone until there’s signal.',
      visuals: [{ html: phoneFrame('07-report', 'REPORT', 'One tap to report', 'No name or phone number'), weight: 0.9 }, { html: phoneFrame('08-report-saved', 'OFFLINE', 'Saved on the phone', 'It sends itself when there is signal') }] },
    { id: 'red', say: 'Named in a NAFDAC alert? Red: do not take it. Here in Pidgin.', appClip: 'public/voice/pcm/v_red_alert.mp3', appClipMax: 3.2,
      visuals: [{ html: phoneFrame('09-red-pcm', 'RED', 'Named in a NAFDAC alert', 'Shown and spoken in Nigerian Pidgin') }] },
    { id: 'sync', say: 'Back online, reports sync, and NAFDAC sees where fakes cluster.',
      visuals: [{ html: phoneFrame('13-home-en-synced', 'BACK ONLINE', 'Reports sync', 'Fresh data and community flags come down'), weight: 0.9 }, { html: wideFrame('14-dashboard', 'REGULATOR VIEW', 'Where reports cluster', 'Live from phones, aggregates only, no personal data') }] },
    { id: 'end', say: 'DawaCheck. Check before you take.', min: 4.6,
      visuals: [{ clip: 'clinic', weight: 1 }, { html: endCard('Product demo &middot; real app screens &middot; scenes generated with Higgsfield'), weight: 1 }] },
  ],
};

export const TECH: Story = {
  highlight: new Set(['DAWACHECK', 'NINETEEN-MEGABYTE', 'PHONE', 'TESSERACT', 'OCR', 'WEBASSEMBLY', 'TYPESCRIPT', '8,922', '84', 'BRAND', 'CLAUDE', '307', 'ELEVENLABS', 'HAUSA', 'ENGLISH', 'PIDGIN', 'SUPABASE', 'INSERT-ONLY', 'CHECKSUM-VERIFIED', 'CODE', 'AI', 'AGENTS', '223', '22', 'IPHONE', 'AIRPLANE']),
  segments: [
    { id: 'k1', say: 'Here’s how DawaCheck works under the hood.', min: 2.8, visuals: [{ clip: 'tech' }] },
    { id: 'k2', say: 'It’s a nineteen-megabyte installable web app. Every verdict is made on the phone: no server, no GPU.', visuals: [{ html: archDiagram(1) }] },
    { id: 'k3', say: 'Tesseract OCR, compiled to WebAssembly, reads the box, and a parser pulls out the number, batch, expiry, name and strength.', visuals: [{ html: archDiagram(2) }] },
    { id: 'k4', say: 'A pure TypeScript engine checks 8,922 products and 84 alerts, and only corrects a misread number when the box’s brand confirms it.', visuals: [{ html: codeCard() }] },
    { id: 'k5', say: 'Claude extracted 307 batch numbers from NAFDAC’s alerts, and ElevenLabs recorded every verdict in Hausa, English and Pidgin.', visuals: [{ html: dataCard() }] },
    { id: 'k6', say: 'Online, reports sync to Supabase through insert-only rules with daily caps, and checksum-verified data comes back down.', visuals: [{ html: syncCard() }] },
    { id: 'k7', say: 'Built with Claude Code and AI agents, and tested: 223 unit tests and 22 end-to-end tests, including airplane mode and iPhone.', visuals: [{ html: testsCard() }] },
    { id: 'end', say: 'DawaCheck.', min: 3.0, visuals: [{ clip: 'device', weight: 1 }, { html: endCard('Technical walkthrough &middot; scenes generated with Higgsfield'), weight: 1.1 }] },
  ],
};
