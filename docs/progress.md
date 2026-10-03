# Progress log
- 14:56 · Task 1 · done · Vite 8, React 19, Vitest 4, TypeScript 7 installed without peer conflicts; smoke test, typecheck, build green
- 14:59 · Task 2 · done · types + text utils, 5 tests green
- 15:01 · Task 3 · done · real register: 8,922 products (16 rows dropped for invalid NRN); dotenv 18 needs config({quiet:true})
- 15:03 · Task 4 · done (partial data) · 84 real alerts via WP API in title-fallback mode (no ANTHROPIC_API_KEY yet; rerun `npm run data:alerts` after adding it; BrightData path needs BRIGHTDATA_API_KEY). Extraction uses claude-opus-5 + structured outputs (zodOutputFormat) per claude-api skill, not haiku + forced tool. Fallback brands keep generic words, so Task 8/9 add a register-derived generic-ingredient vocabulary to alert matching.
