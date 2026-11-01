# Production Preview · HMBL Entertainment

Interactive 3D production preview for client presentations. First event: Cherry Blossom Festival 2026 (Shillong).

- `index.html` is the preview. It loads `events/<event>/event.json` and the venue it points to. Default event: `cbf2026` (`?event=cbf2026`).
- `events/<event>/venue.json` is generated from the event's Capture MVR with `python3 tools/extract_3d.py <extracted_mvr_dir> events/<event>/venue.json`. The MVR itself is not stored here.
- `events/<event>/event.json` holds the title, LED surfaces, cameras, tour viewpoints and specs. LED video files can be set under `led.video` (paths relative to the event folder).
