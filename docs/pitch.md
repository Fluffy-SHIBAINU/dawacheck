# DawaCheck pitch (10 slides)

1. **DawaCheck: check a medicine with no internet.** World Bank Small AI for Development · Health. Photo of the iPhone showing a green verdict.
2. **The problem.** 1 in 10 medical products in LMICs is substandard or falsified (WHO). Up to 169,000 child pneumonia deaths a year are linked to bad antibiotics. 75% of rural Nigerians first go to a medicine shop with no pharmacist. 2.2 billion people are offline.
3. **Who it is for.** Amina (caregiver, Kano, Hausa), Musa (medicine vendor, Zaria), Ngozi (community health worker, Enugu), and the NAFDAC pharmacovigilance desk.
4. **How it works.** Photo → number read on the phone (sideways photos are turned) → full NAFDAC register and alerts stored on the phone → green / amber / red → spoken in Hausa, English or Pidgin → report waits offline → sync and learn. Offline too: find a medicine by name when the number is unreadable, and search every NAFDAC alert.
5. **Three verdicts.** Screenshots: green (Artheget EZ), amber (copied number, wrong strength), red (not in the register / NAFDAC alert).
6. **Small AI in numbers.** 19.0 MB for the whole offline app (4.8 MB register of 8,922 products, 10.9 MB on-device OCR, 2.2 MB recorded voice, 0.5 MB app code). Airplane mode on an iPhone and on a low-cost Android. No GPU, no cloud, no per-check cost.
7. **It learns when it connects.** Community flags (3 reports from 2 phones), OCR corrections, coverage gaps for NAFDAC, fresher packs. Opt-in, no personal data, designed for NDPA 2023.
8. **Real data.** NAFDAC Greenbook (8,922 products). NAFDAC public alerts (84 since Jan 2025), with brands and 307 batch numbers extracted by Claude. ElevenLabs voices in Hausa, English and Pidgin. Supabase sync, live.
9. **Path to scale.** Pilot with patent medicine vendor associations and CHW programmes in Kano. NAFDAC data partnership. The same pack format serves Kenya PPB and Ghana FDA. Native Android. SMS shortcode for reports.
10. **Ask.** Introductions to NAFDAC and two state health ministries. A 3-month pilot with 50 vendors. Native-speaker reviewers for Hausa, Yoruba and Igbo.
