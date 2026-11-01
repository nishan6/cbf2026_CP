# CBF 2026 · Broadcast & IMAG camera plan

Client view of the camera plan for Shillong Cherry Blossom Festival 2026 (HMBL Entertainment). View only.

- `dist/index.html` is the deployed page (Vercel serves `dist/`, no build step).
- `src/project.js` holds cameras, zones, equipment, notes and signal flow. Edit it, run `python3 tools/build.py`, commit `dist/`.
- `data/plan.json` is 2D geometry extracted from the Capture MVR (V1) with `tools/extract_plan.py`. The MVR itself is not in this repo.
- Internal team notes (`src/internal.js`) are not committed. The repo is public.
