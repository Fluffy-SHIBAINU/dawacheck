# iPhone demo checklist

1. On the iPhone, open the production URL in **Safari** (not Chrome) while online.
2. Pick a language and choose your **State** (for example Kano, so the dashboard can show it). Wait about 30 seconds on the home screen. The app downloads the register, OCR model and voices for offline use, and its first sync shows "Register updated: 8,910 → 8,922 products" (the newer pack comes from Supabase).
3. Tap **Share → Add to Home Screen → Add**. Open DawaCheck from the home screen icon.
4. Turn on **Airplane Mode**. Force-quit and reopen the app. It must open with the status "No internet".
5. On the laptop, open `https://dawacheck-smoky.vercel.app/#/demo-packs`. Photograph carton 1 with the iPhone: expect green, then tap **Listen** and hear Hausa.
6. Carton 2: amber (box does not match number). Tap **Report this box**, then **Save report**: expect "Reports waiting: 1".
7. Carton 3 (not in register): red. Carton 5 (NAFDAC alert): red. Switch the language to Pidgin in Settings to show the red verdict in Pidgin.
8. Turn Airplane Mode **off**. The app syncs on its own, or tap Settings → Sync now: "Sent 1 reports…".
9. On the laptop, open `https://dawacheck-smoky.vercel.app/#/dashboard`: the report appears under its state.
10. If a photo does not read, use "Number unclear? Draw a box around it", or type the number.
