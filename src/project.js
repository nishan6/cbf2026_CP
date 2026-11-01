/* CBF 2026 · Broadcast & IMAG camera plan — project data (edit this file to update the plan).
   Plan coordinates are metres. x: + = stage left, − = stage right (performer's view).
   y: distance towards the audience (MVR −Y). Stage geometry comes from MVR V1 (read-only). */
window.PROJECT = {
  name: "Shillong Cherry Blossom Festival 2026",
  short: "CBF 2026",
  client: "HMBL Entertainment",
  revision: "R1",
  revisionDate: "31 Oct 2026",
  status: "Camera planning · provisional positions",
};

/* Provisional camera zones. These are planning areas, not camera coordinates. */
window.ZONES = {
  fohRear: { label: "Camera riser behind FOH", rect: [-9, 55.7, 9, 57.9], status: "prov",
             note: "Behind the FOH riser, inside the FOH barricade. Exact location and riser height to be confirmed." },
  slMid:   { label: "SL mid-field riser zone", rect: [10, 30, 24, 38], status: "prov",
             note: "Among the audience on the stage-left side, mid-field. Exact location to be confirmed." },
  srMid:   { label: "SR mid-field riser zone", rect: [-24, 30, -10, 38], status: "prov",
             note: "Among the audience on the stage-right side, mid-field. Exact location to be confirmed." },
};

/* Reference targets used for coverage estimates (derived from MVR deck geometry). */
window.TARGETS = {
  dsc:    { label: "Main stage, downstage centre", p: [0, 7.5] },
  thrust: { label: "Thrust, centre", p: [0, 13.5] },
  bstage: { label: "B-stage, centre", p: [0, 20.7] },
  dj:     { label: "DJ riser", p: [-17.07, 12.2] },
};
window.FRAMINGS = {
  wide:   { label: "Wide · full stage incl. side LED", w: 47.2 },
  medium: { label: "Medium · group / 8 m", w: 8 },
  tight:  { label: "Tight · medium close-up", w: 1.2 },
  cu:     { label: "Close-up · face", w: 0.6 },
};
window.SENSORS = {
  b4:  { label: '2/3" broadcast (B4), 9.59 mm wide', w: 9.59, assumed: true },
  ff:  { label: "Full frame, 35.9 mm wide", w: 35.9, assumed: true },
};

window.CAMERAS = [
  { id: "CAM 01", name: "FOH Master", zone: "fohRear", anchor: [0, 56.8], color: "#ffffff",
    position: "Camera riser behind FOH (shared with CAM 02)", positionStatus: "prov",
    type: "Broadcast system camera", lens: "≈14–16× standard broadcast zoom (class)", sensor: "b4",
    primary: "Full-stage master; complete performance coverage", secondary: "Safety wide; establishing shots; full-stage IMAG",
    mounting: "Camera riser behind FOH · tripod (riser size not specified)", signal: "Cabled to FOH production (cable type TBC)",
    tally: true, talkback: true, operator: "Manned", role: "Broadcast + IMAG",
    defaultTarget: "dsc", defaultFraming: "wide", coverage: "est",
    notes: "Must always be able to deliver a complete, usable stage picture." },
  { id: "CAM 02", name: "FOH Tight", zone: "fohRear", anchor: [0, 56.8],
    position: "Camera riser behind FOH (shared with CAM 01)", positionStatus: "prov",
    type: "Broadcast system camera", lens: "≈86–95× long-range box lens (class)", sensor: "b4",
    primary: "Artist close-ups; tight performer shots; facial expressions", secondary: "Instrument close-ups; long-distance performance coverage",
    mounting: "Camera riser behind FOH · heavy-duty support for box lens", signal: "Cabled to FOH production (cable type TBC)",
    tally: true, talkback: true, operator: "Manned", role: "Broadcast + IMAG",
    defaultTarget: "dsc", defaultFraming: "tight", coverage: "est",
    notes: "Box lens and support to be specified once the riser position is fixed." },
  { id: "CAM 03", name: "Stage Left Mid-field", zone: "slMid", anchor: [17, 34],
    position: "Riser among the audience, stage-left side, mid-field", positionStatus: "prov",
    type: "Broadcast system camera", lens: "To be confirmed", sensor: "b4",
    primary: "Lead vocalist; centre-stage performers; medium shots", secondary: "Stage-left performance coverage",
    mounting: "Dedicated audience riser (size not specified)", signal: "Cabled to FOH production (cable type TBC)",
    tally: true, talkback: true, operator: "Manned", role: "Broadcast + IMAG",
    defaultTarget: "dsc", defaultFraming: "medium", coverage: "est",
    notes: "Exact riser position to be confirmed." },
  { id: "CAM 04", name: "Stage Right Mid-field", zone: "srMid", anchor: [-17, 34],
    position: "Riser among the audience, stage-right side, mid-field", positionStatus: "prov",
    type: "Broadcast system camera", lens: "To be confirmed", sensor: "b4",
    primary: "Centre-stage performers; lead vocalist; medium and tight shots", secondary: "Alternative perspective to CAM 03",
    mounting: "Dedicated audience riser (size not specified)", signal: "Cabled to FOH production (cable type TBC)",
    tally: true, talkback: true, operator: "Manned", role: "Broadcast + IMAG",
    defaultTarget: "dsc", defaultFraming: "medium", coverage: "est",
    notes: "Exact riser position to be confirmed." },
  { id: "CAM 05", name: "Pit Roaming", zone: "pit", roaming: true,
    position: "Roams between the barricades: front pit, around the thrust and B-stage", positionStatus: "zone",
    type: "Mirrorless camera on gimbal (Sony or Nikon, TBC)", lens: "To be confirmed", sensor: "ff",
    primary: "Artist interaction; low-angle performance shots; dynamic close-ups", secondary: "Audience interaction at the barricade; IMAG performance coverage",
    mounting: "Handheld gimbal", signal: "Wireless video to FOH (system TBC)",
    tally: true, talkback: true, operator: "Manned", role: "Broadcast + IMAG",
    coverage: "pend",
    notes: "Mobile camera: shown as an operating zone, not a fixed position. RF latency to be checked for IMAG use." },
  { id: "CAM 06", name: "Roaming Gimbal", zone: "roam", roaming: true,
    position: "Pit, audience and stage. Not backstage.", positionStatus: "zone",
    type: "Gimbal-compatible camera system (TBC)", lens: "To be confirmed", sensor: "ff",
    primary: "Audience reactions; crowd coverage; festival atmosphere", secondary: "Artist movement and entrances; dynamic moving shots; transitions",
    mounting: "Handheld gimbal", signal: "Wireless video to FOH (system TBC)",
    tally: true, talkback: true, operator: "Manned", role: "Broadcast + IMAG",
    coverage: "pend",
    notes: "Mobile camera: shown as an operating zone, not a fixed position." },
  { id: "CAM 07", name: "DJ Console GoPro", zone: "dj", anchor: [-17.07, 12.8],
    position: "Mounted on the DJ console (DJ riser, stage-right front)", positionStatus: "prov",
    type: "GoPro action camera", lens: "Ultra-wide (mode TBC)", sensor: null,
    primary: "DJ perspective; wide stage view from behind the console", secondary: "Crowd and stage atmosphere; creative inserts for broadcast and IMAG",
    mounting: "Fixed mount on the DJ console, clear of the DJ's workspace", signal: "Live · wireless preferred, wired fallback",
    tally: false, talkback: false, operator: "Unmanned", role: "Auxiliary creative source",
    coverage: "est", fixedFov: 120, facing: [0, 1],
    notes: "Auxiliary source, not a critical broadcast camera. No genlock: needs frame sync before the switcher." },
];

/* App layers. `src` lists the MVR layers each one is built from. */
window.LAYERS = [
  { id: "L01", name: "Stage and architecture", color: "var(--c-l01)", src: ["Production", "Truss - Roof", "Fabrication - Foliage", "Fabrication - Cherry Blossom Tree"] },
  { id: "L02", name: "LED and video", color: "var(--c-l02)", src: ["Video Wall"] },
  { id: "L03", name: "Lighting", color: "var(--c-l03)", src: ["Truss", "L LED Bar", "L Spot", "L Strobe", "L Blinder", "L Profile", "L Wash", "L LED Tilt Bar", "L Scenic", "L DJ Booth Light", "L Follow", "L Followspot"] },
  { id: "L04", name: "Audio", color: "var(--c-l04)", src: ["PA"] },
  { id: "L05", name: "Production infrastructure", color: "var(--c-l05)", src: ["Scaffolding", "FPH Scaffolding", "FOH Riser", "FOH Desks"] },
  { id: "L06", name: "Special effects", color: "var(--c-l06)", src: ["SFX ECO2", "SFX Flame", "SFX Sparkular Jet", "SFX Stadium Shot", "SFX Confetti Blower", "L Laser", "SFX Scaffolding"] },
  { id: "L07", name: "Camera system", color: "var(--c-l07)", src: [] },
  { id: "L08", name: "Camera coverage", color: "var(--c-l08)", src: [] },
  { id: "L09", name: "Audience and venue", color: "var(--c-l09)", src: ["Mojo Barricade", "FOH Mojo Barricade"] },
  { id: "L10", name: "Dimensions and annotations", color: "var(--c-l10)", src: [] },
];
/* Rows shown in the layer tree that have no source data yet. */
window.MISSING = {
  L02: ["Separate IMAG screens (the I-MAG surfaces are part of the wing LED blocks)"],
  L04: ["Delay towers", "Front fills", "Monitor systems", "Audio control position"],
  L09: ["Access routes", "Venue boundary"],
};

window.PRESETS = [
  { id: "all", name: "Complete production view", layers: "*" },
  { id: "arch", name: "Stage architecture only", layers: ["L01"] },
  { id: "led", name: "LED and video only", layers: ["L02"] },
  { id: "light", name: "Lighting only", layers: ["L03"] },
  { id: "audio", name: "Audio only", layers: ["L04"] },
  { id: "sfx", name: "Special effects only", layers: ["L06"] },
  { id: "cams", name: "Camera plot only", layers: ["L07"] },
  { id: "cov", name: "Camera coverage only", layers: ["L08"] },
  { id: "foh", name: "FOH and production only", layers: ["L05"] },
  { id: "venue", name: "Venue and audience only", layers: ["L09"] },
];

window.LED_INFO = {
  "CENTER":   { px: "5376 × 2560", m: "21 × 10 m", area: "210 m²", group: "Centre wall" },
  "SR I-MAG": { px: "2560 × 2816", m: "10 × 11 m", area: "110 m²", group: "IMAG screens" },
  "SL I-MAG": { px: "2560 × 2816", m: "10 × 11 m", area: "110 m²", group: "IMAG screens" },
  "SR CURVE": { px: "896 × 2816", m: "3.5 × 11 m", area: "38.15 m²", group: "Side surfaces" },
  "SL CURVE": { px: "896 × 2816", m: "3.5 × 11 m", area: "38.15 m²", group: "Side surfaces" },
  "SR":       { px: "1920 × 2816", m: "7.5 × 11 m", area: "82.5 m²", group: "Side surfaces" },
  "SL":       { px: "1920 × 2816", m: "7.5 × 11 m", area: "82.5 m²", group: "Side surfaces" },
};
/* Names for MVR objects that were identified from their geometry (the MVR has no object names). */
window.OBJECT_NAMES = {
  "Stage decks & risers · 01": "Stage deck · main, thrust and B-stage",
  "Stage decks & risers · 05": "Downstage step",
  "Stage decks & risers · 07": "DJ riser",
  "Stage decks & risers · 08": "DJ console",
};

window.EQUIPMENT = [
  { cat: "Cameras", item: "Broadcast system camera", qty: 4, for: "CAM 01–04", spec: "Model TBC", status: "TBC" },
  { cat: "Cameras", item: "Mirrorless camera for gimbal", qty: 1, for: "CAM 05", spec: "Sony or Nikon, model TBC", status: "Provisional" },
  { cat: "Cameras", item: "Gimbal-compatible camera system", qty: 1, for: "CAM 06", spec: "Model TBC", status: "TBC" },
  { cat: "Cameras", item: "GoPro action camera", qty: 1, for: "CAM 07", spec: "Model TBC · ultra-wide mode", status: "Provisional" },
  { cat: "Lenses", item: "Standard broadcast zoom", qty: 1, for: "CAM 01", spec: "≈14–16× class", status: "Provisional" },
  { cat: "Lenses", item: "Long-range box lens", qty: 1, for: "CAM 02", spec: "≈86–95× class", status: "Provisional" },
  { cat: "Lenses", item: "Lens for mid-field cameras", qty: 2, for: "CAM 03, CAM 04", spec: "Class TBC", status: "TBC" },
  { cat: "Lenses", item: "Lens for gimbal cameras", qty: 2, for: "CAM 05, CAM 06", spec: "TBC", status: "TBC" },
  { cat: "Support", item: "Tripod and fluid head", qty: 3, for: "CAM 01, 03, 04", spec: "TBC", status: "TBC" },
  { cat: "Support", item: "Heavy-duty support for box lens", qty: 1, for: "CAM 02", spec: "TBC", status: "TBC" },
  { cat: "Support", item: "Camera riser behind FOH", qty: 1, for: "CAM 01, CAM 02", spec: "Size not specified", status: "Provisional" },
  { cat: "Support", item: "Audience camera riser", qty: 2, for: "CAM 03, CAM 04", spec: "Size not specified", status: "Provisional" },
  { cat: "Support", item: "Handheld gimbal", qty: 2, for: "CAM 05, CAM 06", spec: "TBC", status: "TBC" },
  { cat: "Support", item: "GoPro mount", qty: 1, for: "CAM 07", spec: "Console mount, clear of DJ workspace", status: "TBC" },
  { cat: "Camera control", item: "CCU / camera control unit", qty: 4, for: "CAM 01–04", spec: "TBC", status: "TBC" },
  { cat: "Camera control", item: "Shading panel (RCP)", qty: 4, for: "CAM 01–04", spec: "TBC", status: "TBC" },
  { cat: "Signal conversion", item: "Wireless video TX/RX", qty: 2, for: "CAM 05, CAM 06", spec: "System TBC", status: "TBC" },
  { cat: "Signal conversion", item: "Wireless or wired link for GoPro", qty: 1, for: "CAM 07", spec: "Wireless preferred, wired fallback", status: "TBC" },
  { cat: "Signal conversion", item: "HDMI to SDI converter", qty: 1, for: "CAM 07", spec: "If GoPro is wired", status: "TBC" },
  { cat: "Signal conversion", item: "Frame synchroniser", qty: 3, for: "CAM 05, 06, 07", spec: "For non-genlocked sources", status: "TBC" },
  { cat: "Production", item: "Production switcher, 2 M/E", qty: 1, for: "M/E 1 broadcast · M/E 2 IMAG", spec: "Model TBC", status: "Provisional" },
  { cat: "Production", item: "SDI router / distribution", qty: 1, for: "FOH production", spec: "TBC", status: "TBC" },
  { cat: "Production", item: "Recorder", qty: 1, for: "Broadcast PGM (+ ISOs TBC)", spec: "TBC", status: "TBC" },
  { cat: "Production", item: "Streaming encoder", qty: 1, for: "Live stream", spec: "TBC", status: "TBC" },
  { cat: "Visuals", item: "Resolume with Notch block", qty: 1, for: "Camera effects on CENTER", spec: "Existing visuals system", status: "Provisional" },
  { cat: "Visuals", item: "LED processor", qty: 1, for: "CENTER, SR/SL I-MAG", spec: "TBC", status: "TBC" },
  { cat: "Monitoring", item: "Multiviewer", qty: 1, for: "Broadcast and IMAG directors", spec: "TBC", status: "TBC" },
  { cat: "Monitoring", item: "Director / preview monitors", qty: 2, for: "Broadcast and IMAG", spec: "TBC", status: "TBC" },
  { cat: "Accessories", item: "Tally system", qty: 1, for: "CAM 01–06", spec: "TBC", status: "TBC" },
  { cat: "Accessories", item: "Intercom (talkback)", qty: 1, for: "Directors, CAM 01–06, shading, visuals", spec: "TBC", status: "TBC" },
];

/* Open questions live in src/internal.js (team build only). */
window.QUERIES = window.QUERIES || [];

window.ASSUMPTIONS = [
  "Stage geometry is read from MVR V1 without changes. No camera objects are added to the MVR.",
  "Stage left and stage right are from the performer's view. On the plan, stage left is on the right.",
  "LED surfaces are split using the LEDMapper pixel maps (P3.9, 50 × 50 cm panels). Panel counts in the MVR match exactly.",
  "The camera pit is the area inside the stage barricade that is not stage deck. It is derived from the MVR, not drawn by hand.",
  "The audience area runs from the stage barricade to the FOH barricade, ±30.5 m wide. The venue boundary is not in the MVR.",
  "Camera zones are planning areas. Coverage maths uses the centre of each zone.",
  "Focal-length estimates assume a 2/3\" sensor for system cameras and full frame for gimbal cameras. Sensors are not confirmed.",
  "M/E 1 cuts broadcast (stream and recording). M/E 2 cuts IMAG to SR and SL I-MAG.",
];

window.NOTES = [
  "FOH riser front is about 40 m from the main stage front edge and about 27 m from the B-stage front.",
  "Fourteen subwoofers sit inside the front pit, about 2.9 m in front of the main stage edge. CAM 05 moves around them.",
  "The B-stage has a foliage strip along its front edge (up to about 2.1 m high) that crosses low sightlines from the audience.",
  "CAM 07 is not genlocked. Its feed needs frame sync before the switcher.",
  "IMAG goes to SR and SL I-MAG. CENTER can take camera feeds through Resolume and the Notch block for effects.",
  "Tally and talkback go to every manned camera (CAM 01–06). CAM 07 has neither.",
];

window.REVISIONS = [
  { r: "R1", date: "31 Oct 2026", d: "Seven cameras, renumbered. CAM 01/02 move to a riser behind FOH. CAM 03 stage-left and CAM 04 stage-right mid-field risers. Stage-wing pairs removed. Pit camera becomes a wireless gimbal. 2 M/E switching and Resolume/Notch to CENTER added." },
  { r: "R0", date: "30 Oct 2026", d: "Original brief: nine cameras with four stage-wing risers." },
];

/* Signal flow. col: 0 sources · 1 transport/control · 2 routing · 3 switching · 4 processing · 5 destinations */
window.FLOW = {
  cols: ["Sources", "Transport & control", "Routing", "Switching", "Processing", "Destinations"],
  nodes: [
    { id: "c1", col: 0, t: "CAM 01", s: "FOH Master", cam: "CAM 01" },
    { id: "c2", col: 0, t: "CAM 02", s: "FOH Tight", cam: "CAM 02" },
    { id: "c3", col: 0, t: "CAM 03", s: "SL mid-field", cam: "CAM 03" },
    { id: "c4", col: 0, t: "CAM 04", s: "SR mid-field", cam: "CAM 04" },
    { id: "c5", col: 0, t: "CAM 05", s: "Pit roaming · wireless", cam: "CAM 05" },
    { id: "c6", col: 0, t: "CAM 06", s: "Roaming gimbal · wireless", cam: "CAM 06" },
    { id: "c7", col: 0, t: "CAM 07", s: "DJ GoPro · aux", cam: "CAM 07" },
    { id: "ccu", col: 1, t: "CCU × 4", s: "Camera control · TBC", tbc: true, d: "Camera control units for CAM 01–04. Cable type between camera and CCU to be confirmed." },
    { id: "rcp", col: 1, t: "Shading", s: "RCP × 4 · TBC", tbc: true, d: "Shading position for CAM 01–04." },
    { id: "rx", col: 1, t: "Wireless RX × 2", s: "At FOH · system TBC", tbc: true, d: "Receivers for CAM 05 and CAM 06." },
    { id: "gp", col: 1, t: "GoPro link", s: "Wireless or HDMI→SDI", tbc: true, d: "Wireless preferred, wired fallback." },
    { id: "fs", col: 1, t: "Frame sync", s: "CAM 05 · 06 · 07", tbc: true, d: "Non-genlocked sources are synchronised before routing." },
    { id: "rt", col: 2, t: "SDI router / DA", s: "FOH production", tbc: true, d: "Distributes every camera to both M/Es, the multiviewer and Resolume." },
    { id: "me1", col: 3, t: "M/E 1 · Broadcast", s: "2 M/E switcher", d: "Broadcast director cuts from the shared camera pool." },
    { id: "me2", col: 3, t: "M/E 2 · IMAG", s: "2 M/E switcher", d: "IMAG director cuts from the same pool, independently." },
    { id: "aux", col: 3, t: "AUX outputs", s: "Camera feeds to visuals", d: "Selected camera feeds for Resolume." },
    { id: "tal", col: 3, t: "Tally", s: "To CAM 01–06", tbc: true, d: "Tally from both M/Es to every manned camera." },
    { id: "mv", col: 4, t: "Multiviewer", s: "Directors' monitoring", tbc: true },
    { id: "res", col: 4, t: "Resolume + Notch", s: "Camera effects", d: "Notch block in Resolume for camera-based effects on CENTER." },
    { id: "ledp", col: 4, t: "LED processor", s: "TBC", tbc: true },
    { id: "enc", col: 4, t: "Streaming encoder", s: "TBC", tbc: true },
    { id: "rec", col: 5, t: "Recording", s: "Broadcast PGM", tbc: true },
    { id: "str", col: 5, t: "Live stream", s: "Platform TBC", tbc: true },
    { id: "imag", col: 5, t: "SR / SL I-MAG", s: "2 × 2560 × 2816", d: "IMAG screens: the outer faces of the wing LED blocks." },
    { id: "ctr", col: 5, t: "CENTER", s: "5376 × 2560", d: "Upstage centre wall. Camera feeds only through Resolume." },
    { id: "mon", col: 5, t: "Director monitors", s: "Broadcast and IMAG", tbc: true },
    { id: "ic", col: 2, t: "Intercom", s: "Talkback · TBC", tbc: true, d: "Directors, CAM 01–06 operators, shading and visuals." },
  ],
  edges: [
    ["c1","ccu","v"],["c2","ccu","v"],["c3","ccu","v"],["c4","ccu","v"],
    ["c5","rx","v"],["c6","rx","v"],["c7","gp","v"],["rx","fs","v"],["gp","fs","v"],
    ["ccu","rt","v"],["fs","rt","v"],["rcp","ccu","c"],
    ["rt","me1","v"],["rt","me2","v"],["rt","aux","v"],["rt","mv","v"],
    ["me1","rec","v"],["me1","enc","v"],["enc","str","v"],
    ["me2","ledp","v"],["ledp","imag","v"],["aux","res","v"],["res","ledp","v"],["ledp","ctr","v"],
    ["me1","mv","v"],["me2","mv","v"],["mv","mon","v"],
    ["me1","tal","t"],["me2","tal","t"],["tal","c1","t"],["tal","c2","t"],["tal","c3","t"],["tal","c4","t"],["tal","c5","t"],["tal","c6","t"],
    ["ic","c1","i"],["ic","c2","i"],["ic","c3","i"],["ic","c4","i"],["ic","c5","i"],["ic","c6","i"],["ic","rcp","i"],["ic","res","i"],
  ],
};
