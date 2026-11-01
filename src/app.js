/* CBF 2026 camera plan — app logic. Data: window.PLAN (from MVR), PROJECT/CAMERAS/LAYERS/... (project.js) */
(() => {
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}, kids = []) => { const e = document.createElementNS(NS, tag); for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]); kids.forEach(c => e.appendChild(c)); return e; };
const h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const store = { get(k, d) { try { const v = localStorage.getItem("cbf26:" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem("cbf26:" + k, JSON.stringify(v)); } catch (e) {} } };
const fmt = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toFixed(d);
const ICON = {
  eye: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="2"/></svg>',
  eyeOff: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 2l12 12M6.6 3.7A6.8 6.8 0 0 1 8 3.5c4.1 0 6.5 4.5 6.5 4.5a11 11 0 0 1-1.9 2.4M4.2 4.9C2.5 6.1 1.5 8 1.5 8S3.9 12.5 8 12.5c1 0 1.9-.3 2.7-.7"/></svg>',
  iso: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/></svg>',
  chev: '<svg width="8" height="10" viewBox="0 0 8 10" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 1l4 4-4 4"/></svg>',
};

/* ------------------------------------------------------------------ model */
const CLIENT = !!window.CLIENT_VIEW;
const P = window.PLAN, CAMS = window.CAMERAS, LAYERS = window.LAYERS;
const camById = Object.fromEntries(CAMS.map(c => [c.id, c]));
const objById = Object.fromEntries(P.objects.map(o => [o.id, o]));
const fxById = Object.fromEntries(P.fixtures.map(f => [f.id, f]));
P.objects.forEach(o => {
  if (o.layer === "L02") { o.group = (LED_INFO[o.name] || {}).group || "LED surfaces"; }
  if (OBJECT_NAMES[o.name]) { o.label = OBJECT_NAMES[o.name]; o.identified = true; } else o.label = o.name;
});
// group registry: layer -> ordered [{key,name,count,kind}]
const GROUPS = Object.fromEntries(LAYERS.map(l => [l.id, []]));
const addGroup = (layer, name, count = 0, extra = {}) => { const key = layer + "|" + name; let g = GROUPS[layer].find(x => x.key === key); if (!g) { g = { key, name, count: 0, ...extra }; GROUPS[layer].push(g); } g.count += count; return key; };
addGroup("L01", "Stage decks & risers");
P.objects.forEach(o => { o.gkey = addGroup(o.layer, o.group, 1); });
P.fixtures.forEach(f => { f.gkey = addGroup(f.layer, f.group, 1); });
addGroup("L07", "Planning zones", 3, { note: "Provisional" });
CAMS.forEach(c => { c.gkey = addGroup("L07", c.id + " · " + c.name, 1, { cam: c.id }); });
["Viewing directions", "Field of view", "Frame width at target", "Potential obstructions"].forEach(n => addGroup("L08", n, 0));
addGroup("L09", "Camera pit (derived)", 1); addGroup("L09", "Audience area (derived)", 1);
GROUPS.L09.sort((a, b) => (a.name.includes("derived") ? 0 : 1) - (b.name.includes("derived") ? 0 : 1));
["Dimensions", "Area labels", "LED surface labels", "Camera notes"].forEach(n => addGroup("L10", n, 0));

const defaults = () => ({
  layers: Object.fromEntries(LAYERS.map(l => [l.id, { on: true, op: 1, open: false }])),
  groups: {}, hidden: [], iso: null, preset: "all",
  target: "auto", framing: "auto",
});
let S = Object.assign(defaults(), store.get("state", {}));
LAYERS.forEach(l => { S.layers[l.id] = Object.assign({ on: true, op: 1, open: false }, S.layers[l.id] || {}); });
let sel = null; // {t:'cam'|'obj'|'fx'|'zone', id}
const save = () => store.set("state", S);

const layerVisible = id => S.layers[id].on && (!S.iso || S.iso.includes(id));
const groupOn = key => S.groups[key] !== false;

/* ------------------------------------------------------------------ geometry helpers */
const ringPath = rings => rings.map(r => "M" + r.map(p => p[0] + "," + p[1]).join("L") + "Z").join("");
function segInter(a, b, c, d) { // returns t on ab
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0]; if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}
function pointIn(pt, ring) { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; }
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function zoneCorners(c) { const z = ZONES[c.zone]; if (!z) return [c.anchor]; const [x1, y1, x2, y2] = z.rect; return [[x1, y1], [x2, y1], [x1, y2], [x2, y2]]; }
const targetFor = c => S.target === "auto" ? (c.defaultTarget || "dsc") : S.target;
const framingFor = c => S.framing === "auto" ? (c.defaultFraming || "wide") : S.framing;
function obstructions(a, b) {
  const out = [];
  P.objects.forEach(o => {
    if (o.z[1] < 0.9) return;
    if (o.rings.some(r => pointIn(b, r)) || o.rings.some(r => pointIn(a, r))) return;
    let tmin = null;
    o.rings.forEach(r => { for (let i = 0; i < r.length; i++) { const t = segInter(a, b, r[i], r[(i + 1) % r.length]); if (t != null && t > 0.02 && t < 0.98 && (tmin == null || t < tmin)) tmin = t; } });
    if (tmin != null) out.push({ kind: "obj", id: o.id, key: o.gkey, name: (GROUPS[o.layer].find(g => g.key === o.gkey) || {}).count > 1 ? o.group : o.label, layer: o.layer, z: o.z, t: tmin, p: [a[0] + (b[0] - a[0]) * tmin, a[1] + (b[1] - a[1]) * tmin] });
  });
  P.fixtures.forEach(f => {
    if (f.z > 3.5) return;
    const L = dist(a, b), t = ((f.p[0] - a[0]) * (b[0] - a[0]) + (f.p[1] - a[1]) * (b[1] - a[1])) / (L * L);
    if (t <= 0.02 || t >= 0.98) return;
    const q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    if (dist(q, f.p) < 0.4) out.push({ kind: "fx", id: f.id, key: f.gkey, name: f.group, layer: f.layer, z: [f.z, f.z], t, p: f.p });
  });
  // collapse duplicates by name, keep nearest
  const seen = new Map(); out.sort((x, y) => x.t - y.t).forEach(o => { const k = o.key; if (!seen.has(k)) seen.set(k, o); });
  return [...seen.values()];
}
function coverage(c) {
  if (c.roaming || !c.anchor) return null;
  if (c.fixedFov) return { fixed: true, fov: c.fixedFov, a: c.anchor };
  const tk = targetFor(c), fk = framingFor(c), T = TARGETS[tk].p, F = FRAMINGS[fk];
  const a = c.anchor, d = dist(a, T), sensor = SENSORS[c.sensor];
  const dir = [(T[0] - a[0]) / d, (T[1] - a[1]) / d], perp = [-dir[1], dir[0]];
  const hw = F.w / 2;
  return { a, T, d, tk, fk, F, dir, perp, hfov: 2 * Math.atan(hw / d) * 180 / Math.PI,
    focal: sensor ? sensor.w * d / F.w : null,
    l: [T[0] + perp[0] * hw, T[1] + perp[1] * hw], r: [T[0] - perp[0] * hw, T[1] - perp[1] * hw] };
}

/* ------------------------------------------------------------------ SVG plot */
const svg = $("#plot");
const FIT = [-33, -24, 66, 87];
let VB = store.get("vb", FIT.slice());
const world = el("g", { id: "world" }); let nzList = [];
svg.appendChild(el("defs", {}, [
  el("pattern", { id: "hatchA", width: 1.2, height: 1.2, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, [el("line", { x1: 0, y1: 0, x2: 0, y2: 1.2, stroke: "rgba(255,255,255,.35)", "stroke-width": .18 })]),
  el("pattern", { id: "hatchB", width: 2.2, height: 2.2, patternUnits: "userSpaceOnUse", patternTransform: "rotate(-45)" }, [el("line", { x1: 0, y1: 0, x2: 0, y2: 2.2, stroke: "rgba(255,255,255,.08)", "stroke-width": .2 })]),
  el("clipPath", { id: "frontOfWall" }, [el("rect", { x: -40, y: -9.0, width: 80, height: 100 })]),
]));
svg.appendChild(world);
const layerG = {}; // id -> [g,...]
function lg(id, key) { const g = el("g", { "data-layer": id }); (layerG[id] = layerG[id] || []).push(g); world.appendChild(g); const gg = {}; return (gkey) => { if (!gg[gkey]) { gg[gkey] = el("g", { "data-group": gkey }); g.appendChild(gg[gkey]); } return gg[gkey]; }; }
function nz(x, y, kids, key) { const g = el("g", { class: "nz" }, kids); g._x = x; g._y = y; nzList.push(g); return g; }
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v.replace(/var\((.*)\)/, "$1")).trim() || v;
const LC = Object.fromEntries(LAYERS.map(l => [l.id, css(l.color)]));
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
const STYLE = {
  L01: o => o.group.startsWith("Roof") ? { fill: "none", stroke: rgba(LC.L01, .35), sw: .6 } : o.group.startsWith("Scenic") ? { fill: rgba("#30d158", .07), stroke: rgba("#8e8e93", .45), sw: .6 } : { fill: rgba(LC.L01, .08), stroke: rgba(LC.L01, .7), sw: .8 },
  L02: () => ({ fill: LC.L02, stroke: LC.L02, sw: 1 }),
  L03: () => ({ fill: rgba(LC.L03, .05), stroke: rgba(LC.L03, .55), sw: .8 }),
  L04: () => ({ fill: rgba(LC.L04, .18), stroke: LC.L04, sw: .9 }),
  L05: () => ({ fill: rgba(LC.L05, .06), stroke: rgba(LC.L05, .6), sw: .7 }),
  L06: () => ({ fill: rgba(LC.L06, .08), stroke: rgba(LC.L06, .65), sw: .8 }),
  L09: () => ({ fill: "rgba(235,235,245,.16)", stroke: "rgba(235,235,245,.55)", sw: .6 }),
};
function drawObj(gfn, o) {
  const st = STYLE[o.layer](o);
  const p = el("path", { d: ringPath(o.rings), "fill-rule": "evenodd", fill: st.fill, stroke: st.stroke, "stroke-width": st.sw, class: "obj", "data-id": o.id, "vector-effect": "non-scaling-stroke" });
  p.addEventListener("click", e => { e.stopPropagation(); select({ t: "obj", id: o.id }); });
  hoverTip(p, () => [o.label, layerName(o.layer) + " · " + o.group]);
  gfn(o.gkey).appendChild(p);
}
const layerName = id => (LAYERS.find(l => l.id === id) || {}).name || id;

function buildPlot() {
  // L09 base fills
  const g9a = lg("L09");
  const aud = el("path", { d: ringPath(P.zones.audience.rings), fill: "rgba(10,132,255,.07)", stroke: "rgba(10,132,255,.25)", "stroke-width": .6, "vector-effect": "non-scaling-stroke", class: "obj", "data-zone": "audience" });
  const pit = el("path", { d: ringPath(P.zones.pit.rings), fill: rgba(LC.L09, .16), stroke: rgba(LC.L09, .55), "stroke-width": .8, "vector-effect": "non-scaling-stroke", class: "obj", "data-zone": "pit" });
  aud.addEventListener("click", e => { e.stopPropagation(); select({ t: "zone", id: "audience" }); });
  pit.addEventListener("click", e => { e.stopPropagation(); select({ t: "zone", id: "pit" }); });
  hoverTip(aud, () => ["Audience area", "Derived from barricade lines"]); hoverTip(pit, () => ["Camera pit", "Derived: inside the stage barricade, off the deck"]);
  g9a("L09|Audience area (derived)").appendChild(aud); g9a("L09|Camera pit (derived)").appendChild(pit);
  // L01 base deck
  const g1 = lg("L01");
  g1("L01|Stage decks & risers").appendChild(el("path", { d: ringPath(P.zones.deck.rings), fill: "rgba(255,255,255,.06)", stroke: "none", "pointer-events": "none" }));
  P.objects.filter(o => o.layer === "L01").sort((a, b) => b.size[0] * b.size[1] - a.size[0] * a.size[1]).forEach(o => drawObj(g1, o));
  ["L05", "L04", "L06"].forEach(id => { const g = lg(id); P.objects.filter(o => o.layer === id).forEach(o => drawObj(g, o)); });
  const g2 = lg("L02"); P.objects.filter(o => o.layer === "L02").forEach(o => drawObj(g2, o));
  const g3 = lg("L03"); P.objects.filter(o => o.layer === "L03").forEach(o => drawObj(g3, o));
  // fixtures (L03 + L06)
  const gfx = { L03: g3, L06: lg("L06") };
  P.fixtures.forEach(f => {
    const c = el("circle", { cx: f.p[0], cy: f.p[1], r: f.layer === "L06" ? .32 : .22, fill: LC[f.layer], class: "fx obj", "data-fx": f.id, stroke: "rgba(0,0,0,.6)", "stroke-width": .5, "vector-effect": "non-scaling-stroke" });
    c.addEventListener("click", e => { e.stopPropagation(); select({ t: "fx", id: f.id }); });
    hoverTip(c, () => [f.name, f.group + " · +" + fmt(f.z, 1) + " m"]);
    gfx[f.layer](f.gkey).appendChild(c);
  });
  // barricades on top of fills
  const g9b = lg("L09"); P.objects.filter(o => o.layer === "L09").forEach(o => drawObj(g9b, o));
  buildCoverage(); buildAnnotations(); buildCameras();
}

let covG;
function buildCoverage() {
  if (!covG) covG = lg("L08");
  ["Viewing directions", "Field of view", "Frame width at target", "Potential obstructions"].forEach(n => { const g = covG("L08|" + n); while (g.firstChild) g.firstChild.remove(); });
  CAMS.forEach(c => {
    const cv = coverage(c); if (!cv) return;
    const selc = sel && sel.t === "cam" && sel.id === c.id, col = selc ? "#64d2ff" : "#ffffff";
    if (cv.fixed) {
      const R = 16, a0 = Math.atan2(c.facing[1], c.facing[0]), half = cv.fov / 2 * Math.PI / 180;
      const p1 = [cv.a[0] + R * Math.cos(a0 - half), cv.a[1] + R * Math.sin(a0 - half)], p2 = [cv.a[0] + R * Math.cos(a0 + half), cv.a[1] + R * Math.sin(a0 + half)];
      covG("L08|Field of view").appendChild(el("path", { d: `M${cv.a}L${p1}A${R},${R} 0 0 1 ${p2}Z`, fill: rgba(col, selc ? .16 : .07), stroke: rgba(col, .35), "stroke-width": .8, "vector-effect": "non-scaling-stroke", "stroke-dasharray": "4 3" }));
      covG("L08|Viewing directions").appendChild(el("line", { x1: cv.a[0], y1: cv.a[1], x2: cv.a[0] + c.facing[0] * R, y2: cv.a[1] + c.facing[1] * R, stroke: rgba(col, .5), "stroke-width": 1, "vector-effect": "non-scaling-stroke" }));
      return;
    }
    covG("L08|Field of view").appendChild(el("path", { d: `M${cv.a}L${cv.l}L${cv.r}Z`, fill: rgba(col, selc ? .18 : .07), stroke: rgba(col, selc ? .8 : .3), "stroke-width": selc ? 1.2 : .8, "vector-effect": "non-scaling-stroke" }));
    covG("L08|Viewing directions").appendChild(el("line", { x1: cv.a[0], y1: cv.a[1], x2: cv.T[0], y2: cv.T[1], stroke: rgba(col, selc ? .9 : .45), "stroke-width": 1, "stroke-dasharray": "6 4", "vector-effect": "non-scaling-stroke" }));
    covG("L08|Frame width at target").appendChild(el("line", { x1: cv.l[0], y1: cv.l[1], x2: cv.r[0], y2: cv.r[1], stroke: rgba(col, .9), "stroke-width": 2, "vector-effect": "non-scaling-stroke" }));
    if (selc) obstructions(cv.a, cv.T).forEach(o => {
      const m = nz(o.p[0], o.p[1], [el("circle", { r: 6, fill: "#000", stroke: "#ffd60a", "stroke-width": 1.4 }), el("text", { y: 3.5, "text-anchor": "middle", "font-size": 9, "font-weight": 700, fill: "#ffd60a" })]);
      m.lastChild.textContent = "!";
      covG("L08|Potential obstructions").appendChild(m);
    });
  });
  placeNZ();
}

function buildAnnotations() {
  const g = lg("L10");
  const dim = (x1, y1, x2, y2, label, off = [0, 0]) => {
    const grp = g("L10|Dimensions");
    grp.appendChild(el("line", { x1, y1, x2, y2, stroke: "rgba(152,152,157,.8)", "stroke-width": 1, "vector-effect": "non-scaling-stroke", "marker-start": "", "stroke-dasharray": "" }));
    const tick = (x, y) => { const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), nx = -dy / L * .6, ny = dx / L * .6; grp.appendChild(el("line", { x1: x - nx, y1: y - ny, x2: x + nx, y2: y + ny, stroke: "rgba(152,152,157,.9)", "stroke-width": 1, "vector-effect": "non-scaling-stroke" })); };
    tick(x1, y1); tick(x2, y2);
    grp.appendChild(nz((x1 + x2) / 2 + off[0], (y1 + y2) / 2 + off[1], [label2(label, "#98989d")]));
  };
  dim(-29.5, 9.2, -29.5, 49.37, "40.2 m stage edge → FOH riser", [0, 0]);
  dim(14, 22.6, 14, 49.37, "26.8 m B-stage → FOH riser");
  dim(-10.56, -12.2, 10.56, -12.2, "CENTER 21.1 m");
  dim(-23.6, -14.6, 23.6, -14.6, "LED overall 47.2 m");
  dim(29.6, 9.2, 29.6, 13.3, "Pit 4.1 m", [0, -3.2]);
  const lab = (x, y, t, grp = "L10|Area labels", c = "#c7c7cc") => g(grp).appendChild(nz(x, y, [label2(t, c, true)]));
  lab(0, -3, "Main stage  +1.83 m"); lab(0, 14.5, "Thrust"); lab(0, 21.2, "B-stage"); lab(-17.07, 15.2, "DJ riser");
  lab(-26.6, 11.4, "Front pit"); lab(0, 44, "Audience"); lab(0, 52.2, "FOH");
  P.objects.filter(o => o.layer === "L02").forEach(o => {
    const off = o.name.includes("I-MAG") ? [0, 2.2] : o.name === "CENTER" ? [0, -1.6] : o.name.includes("CURVE") ? [0, 3.6] : [o.c[0] > 0 ? -2.6 : 2.6, 0];
    lab(o.c[0] + off[0], o.c[1] + off[1], o.name, "L10|LED surface labels", "#64d2ff");
  });
  Object.values(ZONES).forEach(z => { const [x1, y1, x2, y2] = z.rect; g("L10|Camera notes").appendChild(nz((x1 + x2) / 2, y2 + 1.6, [label2("Provisional · position TBC", "#ffe066")])); });
  g("L10|Camera notes").appendChild(nz(0, 46.5, [label2("CAM 06 roams pit, audience and stage", "#a1a1a6")]));
}
function label2(t, color, strong) {
  const tx = el("text", { "text-anchor": "middle", "font-size": strong ? 11.5 : 10.5, "font-weight": strong ? 600 : 500, fill: color, y: 4, style: "paint-order:stroke;stroke:#000;stroke-width:3px;stroke-linejoin:round" }); tx.textContent = t; return tx;
}

function buildCameras() {
  const g = lg("L07");
  Object.entries(ZONES).forEach(([k, z]) => {
    const [x1, y1, x2, y2] = z.rect;
    const r = el("rect", { x: x1, y: y1, width: x2 - x1, height: y2 - y1, rx: .6, fill: "rgba(255,255,255,.05)", stroke: "rgba(255,255,255,.7)", "stroke-width": 1, "stroke-dasharray": "5 4", "vector-effect": "non-scaling-stroke", class: "obj", "data-zone": k });
    r.addEventListener("click", e => { e.stopPropagation(); select({ t: "zone", id: k }); });
    hoverTip(r, () => [z.label, "Provisional zone"]);
    g("L07|Planning zones").appendChild(r);
  });
  // roaming zones
  const c5 = camById["CAM 05"], c6 = camById["CAM 06"];
  const pz = el("path", { d: ringPath(P.zones.pit.rings), fill: "url(#hatchA)", stroke: "rgba(255,255,255,.5)", "stroke-width": .8, "stroke-dasharray": "3 3", "vector-effect": "non-scaling-stroke", class: "obj", "data-cz": "CAM 05" });
  const rz = el("g", { class: "obj", "data-cz": "CAM 06" }, [
    el("path", { d: ringPath(P.zones.audience.rings) + ringPath(P.zones.pit.rings), fill: "url(#hatchB)", stroke: "none" }),
    el("path", { d: ringPath(P.zones.deck.rings), fill: "url(#hatchB)", stroke: "none", "clip-path": "url(#frontOfWall)" })]);
  [[pz, c5], [rz, c6]].forEach(([e, c]) => { e.addEventListener("click", ev => { ev.stopPropagation(); select({ t: "cam", id: c.id }); }); hoverTip(e, () => [c.id + " operating zone", c.position]); });
  g(c6.gkey).appendChild(rz); g(c5.gkey).appendChild(pz);
  const chipAt = { "CAM 01": [-3.6, 56.8], "CAM 02": [3.6, 56.8], "CAM 05": [21.5, 11.4], "CAM 06": [0, 37.5] };
  CAMS.forEach(c => {
    const at = chipAt[c.id] || c.anchor;
    const chip = nz(at[0], at[1], [
      el("rect", { class: "chip", x: -27, y: -11, width: 54, height: 22, rx: 11 }),
      el("text", { "text-anchor": "middle", y: 5.5, "font-size": 15, transform: "skewX(-9)" }),
    ]);
    chip.lastChild.textContent = c.id.replace("CAM ", "CAM ");
    if (c.id === "CAM 07") chip.insertBefore(el("circle", { r: 3.2, cy: -18, fill: "#fff" }), chip.firstChild);
    chip.classList.add("cam"); chip.dataset.cam = c.id;
    chip.addEventListener("click", e => { e.stopPropagation(); select({ t: "cam", id: c.id }); });
    hoverTip(chip, () => [c.id + " · " + c.name, c.position]);
    g(c.gkey).appendChild(chip);
  });
}

/* nz elements keep constant pixel size */
function mpp() { const r = svg.getBoundingClientRect(); return Math.max(VB[2] / r.width, VB[3] / r.height); }
function placeNZ() { nzList = nzList.filter(g => g.isConnected); const k = mpp(); nzList.forEach(g => g.setAttribute("transform", `translate(${g._x},${g._y}) scale(${k})`)); }
function setVB(v) {
  VB = v; const r = svg.getBoundingClientRect(), ar = r.width / Math.max(r.height, 1);
  svg.setAttribute("viewBox", VB.join(" ")); svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  placeNZ(); updateScale(); store.set("vb", VB);
}
function updateScale() {
  const k = mpp(); const target = 110 * k; const steps = [1, 2, 5, 10, 20, 25, 50]; const m = steps.find(s => s >= target * .6) || 50;
  $("#scale").innerHTML = `<span>${m} m</span><i style="width:${m / k}px"></i>`;
}
function fit() { setVB(FIT.slice()); }
function zoomAt(f, cx, cy) {
  const r = svg.getBoundingClientRect(); const k = mpp();
  // convert client px to world (account for meet letterboxing)
  const sw = VB[2] / k, sh = VB[3] / k, ox = (r.width - sw) / 2, oy = (r.height - sh) / 2;
  const wx = VB[0] + (cx - r.left - ox) * k, wy = VB[1] + (cy - r.top - oy) * k;
  const w = Math.min(Math.max(VB[2] * f, 4), 220), hh = VB[3] * (w / VB[2]);
  setVB([wx - (wx - VB[0]) * (w / VB[2]), wy - (wy - VB[1]) * (w / VB[2]), w, hh]);
}
svg.addEventListener("wheel", e => { e.preventDefault(); zoomAt(Math.exp(e.deltaY * (e.ctrlKey ? .01 : .0018)), e.clientX, e.clientY); }, { passive: false });
const ptrs = new Map(); let pinch0 = null, moved = false;
svg.addEventListener("pointerdown", e => { ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = false; svg.setPointerCapture(e.pointerId); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = { d: dist(a, b), vb: VB.slice() }; } });
svg.addEventListener("pointermove", e => {
  if (!ptrs.has(e.pointerId)) return; const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (ptrs.size === 1) { const dx = e.clientX - prev[0], dy = e.clientY - prev[1]; if (Math.abs(dx) + Math.abs(dy) > 0) { if (!moved && Math.abs(dx) + Math.abs(dy) < 2) return; moved = true; svg.classList.add("drag"); const k = mpp(); setVB([VB[0] - dx * k, VB[1] - dy * k, VB[2], VB[3]]); } }
  else if (ptrs.size === 2 && pinch0) { const [a, b] = [...ptrs.values()]; const f = pinch0.d / dist(a, b); moved = true; const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; const cur = VB[2] / pinch0.vb[2]; zoomAt(f / cur, mid[0], mid[1]); }
});
const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = null; svg.classList.remove("drag"); };
svg.addEventListener("pointerup", up); svg.addEventListener("pointercancel", up);
svg.addEventListener("click", e => { if (moved) { e.stopPropagation(); return; } select(null); }, true);
$("#zIn").onclick = () => { const r = svg.getBoundingClientRect(); zoomAt(.7, r.left + r.width / 2, r.top + r.height / 2); };
$("#zOut").onclick = () => { const r = svg.getBoundingClientRect(); zoomAt(1 / .7, r.left + r.width / 2, r.top + r.height / 2); };
$("#zFit").onclick = fit;
window.addEventListener("resize", () => setVB(VB));

const tip = $("#tip");
function hoverTip(node, fn) {
  node.addEventListener("pointerenter", () => { const [a, b] = fn(); tip.innerHTML = esc(a) + (b ? `<small>${esc(b)}</small>` : ""); tip.style.display = "block"; });
  node.addEventListener("pointermove", e => { const r = $("#stage").getBoundingClientRect(); tip.style.left = (e.clientX - r.left) + "px"; tip.style.top = (e.clientY - r.top) + "px"; });
  node.addEventListener("pointerleave", () => { tip.style.display = "none"; });
}

/* ------------------------------------------------------------------ visibility (single source of truth) */
function applyVisibility() {
  LAYERS.forEach(l => {
    const vis = layerVisible(l.id);
    (layerG[l.id] || []).forEach(g => { g.style.display = vis ? "" : "none"; g.style.opacity = S.layers[l.id].op; });
  });
  $$("[data-group]", svg).forEach(g => { g.style.display = groupOn(g.dataset.group) ? "" : "none"; });
  const hid = new Set(S.hidden);
  $$("[data-id],[data-fx]", svg).forEach(n => { n.style.display = hid.has(n.dataset.id || n.dataset.fx) ? "none" : ""; });
  renderLayers(); save();
}

/* ------------------------------------------------------------------ layers panel */
function renderLayers() {
  const box = $("#tree"); const open = new Set(LAYERS.filter(l => S.layers[l.id].open).map(l => l.id));
  box.innerHTML = "";
  LAYERS.forEach(l => {
    const st = S.layers[l.id], vis = layerVisible(l.id), isIso = S.iso && S.iso.includes(l.id);
    const count = GROUPS[l.id].reduce((s, g) => s + g.count, 0);
    const sub = l.id === "L07" ? `${CAMS.length} cameras` : l.id === "L08" ? "Estimated" : l.id === "L10" ? "Measured from MVR" : `${count} items · MVR`;
    const node = h(`<div class="ly ${open.has(l.id) ? "open" : ""}">
      <div class="ly-row ${vis ? "" : "dim"}">
        <button class="chev" aria-label="Expand ${esc(l.name)}" aria-expanded="${open.has(l.id)}">${ICON.chev}</button>
        <button class="eye ${st.on ? "" : "off"}" aria-label="${st.on ? "Hide" : "Show"} ${esc(l.name)}" aria-pressed="${st.on}">${st.on ? ICON.eye : ICON.eyeOff}</button>
        <span class="sw" style="background:${l.color}"></span>
        <span class="ly-name"><b>${esc(l.name)}</b><small>${esc(sub)}</small></span>
        <button class="iso ${isIso ? "on" : ""}" title="Isolate (shift-click to add)" aria-label="Isolate ${esc(l.name)}">${ICON.iso}</button>
      </div><div class="ly-body"></div></div>`);
    const body = $(".ly-body", node);
    body.appendChild(h(`<div class="op"><span>Opacity</span><input type="range" min="0.1" max="1" step="0.05" value="${st.op}" aria-label="${esc(l.name)} opacity"><span>${Math.round(st.op * 100)}%</span></div>`));
    if (l.id === "L08") body.appendChild(h(`<div class="ctl">
      <label>Target<select class="pick" id="covT"><option value="auto">Each camera's default</option>${Object.entries(TARGETS).map(([k, t]) => `<option value="${k}" ${S.target === k ? "selected" : ""}>${esc(t.label)}</option>`).join("")}</select></label>
      <label>Framing<select class="pick" id="covF"><option value="auto">Each camera's default</option>${Object.entries(FRAMINGS).map(([k, t]) => `<option value="${k}" ${S.framing === k ? "selected" : ""}>${esc(t.label)}</option>`).join("")}</select></label>
      <span class="pill est" style="justify-self:start">All coverage is estimated, not verified</span></div>`));
    GROUPS[l.id].forEach(g => {
      const on = groupOn(g.key), cam = g.cam;
      const r = h(`<div class="gr-row ${on && vis ? "" : "dim"}">
        <button class="eye ${on ? "" : "off"}" aria-label="${on ? "Hide" : "Show"} ${esc(g.name)}" aria-pressed="${on}">${on ? ICON.eye : ICON.eyeOff}</button>
        <span class="ly-name"><b>${esc(g.name)}</b></span>${g.note ? `<span class="pill prov">${g.note}</span>` : cam ? `<span class="pill ${camById[cam].roaming ? "src" : "prov"}">${camById[cam].roaming ? "Zone" : "Prov."}</span>` : g.count ? `<span class="cnt">${g.count}</span>` : ""}</div>`);
      $(".eye", r).onclick = () => { S.groups[g.key] = !on; S.preset = "custom"; applyVisibility(); };
      if (cam) $(".ly-name", r).onclick = () => select({ t: "cam", id: cam }, true);
      body.appendChild(r);
    });
    (MISSING[l.id] || []).forEach(m => body.appendChild(h(`<div class="gr-row dim"><span class="eye off" aria-hidden="true">${ICON.eyeOff}</span><span class="ly-name"><b>${esc(m)}</b></span><span class="pill pend">Not in MVR</span></div>`)));
    $(".chev", node).onclick = () => { st.open = !st.open; renderLayers(); save(); };
    $(".ly-name", node).onclick = () => { st.open = !st.open; renderLayers(); save(); };
    $(".eye", node).onclick = () => { st.on = !st.on; S.preset = "custom"; applyVisibility(); };
    $(".iso", node).onclick = e => { if (e.shiftKey && S.iso) { S.iso = S.iso.includes(l.id) ? S.iso.filter(x => x !== l.id) : [...S.iso, l.id]; if (!S.iso.length) S.iso = null; } else S.iso = isIso && S.iso.length === 1 ? null : [l.id]; if (S.iso) st.on = true; applyVisibility(); };
    const rng = $("input[type=range]", node); rng.oninput = () => { st.op = +rng.value; rng.nextElementSibling.textContent = Math.round(st.op * 100) + "%"; (layerG[l.id] || []).forEach(g => g.style.opacity = st.op); save(); };
    box.appendChild(node);
  });
  const ct = $("#covT"), cf = $("#covF");
  if (ct) ct.onchange = () => { S.target = ct.value; buildCoverage(); applyVisibility(); renderInspector(); };
  if (cf) cf.onchange = () => { S.framing = cf.value; buildCoverage(); applyVisibility(); renderInspector(); };
  const ib = $("#isoBanner");
  ib.classList.toggle("on", !!S.iso);
  if (S.iso) $("#isoNames").textContent = S.iso.map(layerName).join(", ");
  const hn = $("#hiddenNote"); hn.classList.toggle("on", S.hidden.length > 0); $("#hiddenCount").textContent = S.hidden.length + (S.hidden.length === 1 ? " object hidden" : " objects hidden");
  $("#preset").value = PRESETS.some(p => p.id === S.preset) || customViews().some(c => "c:" + c.name === S.preset) ? S.preset : "";
}
function customViews() { return store.get("views", []); }
function fillPresets() {
  const s = $("#preset");
  s.innerHTML = `<option value="" disabled>Custom view</option>` + PRESETS.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("") +
    (customViews().length ? `<optgroup label="Saved views">${customViews().map(c => `<option value="c:${esc(c.name)}">${esc(c.name)}</option>`).join("")}</optgroup>` : "");
}
function applyPreset(id) {
  if (id.startsWith("c:")) { const v = customViews().find(c => "c:" + c.name === id); if (v) { S.layers = JSON.parse(JSON.stringify(v.layers)); S.groups = { ...v.groups }; S.iso = null; } }
  else { const p = PRESETS.find(x => x.id === id); S.iso = null; S.groups = {}; LAYERS.forEach(l => S.layers[l.id].on = p.layers === "*" || p.layers.includes(l.id)); }
  S.preset = id; applyVisibility();
}
$("#preset").onchange = e => applyPreset(e.target.value);
$("#restoreAll").onclick = () => { S.iso = null; S.groups = {}; S.hidden = []; LAYERS.forEach(l => { S.layers[l.id].on = true; S.layers[l.id].op = 1; }); S.preset = "all"; applyVisibility(); };
$("#saveView").onclick = () => { const name = prompt("Name this view"); if (!name) return; const v = customViews().filter(c => c.name !== name); v.push({ name, layers: JSON.parse(JSON.stringify(S.layers)), groups: { ...S.groups } }); store.set("views", v); fillPresets(); S.preset = "c:" + name; renderLayers(); };
$("#exitIso").onclick = () => { S.iso = null; applyVisibility(); };
$("#showHidden").onclick = () => { S.hidden = []; applyVisibility(); };

/* ------------------------------------------------------------------ selection + inspector */
function select(s, zoomTo) {
  sel = s;
  $$(".sel", svg).forEach(n => n.classList.remove("sel")); $$(".selc", svg).forEach(n => n.classList.remove("selc"));
  if (s && s.t === "obj") $$(`[data-id="${s.id}"]`, svg).forEach(n => n.classList.add("sel"));
  if (s && s.t === "fx") $$(`[data-fx="${s.id}"]`, svg).forEach(n => n.classList.add("sel"));
  if (s && s.t === "zone") $$(`[data-zone="${s.id}"]`, svg).forEach(n => n.classList.add("sel"));
  if (s && s.t === "cam") $$(`.cam[data-cam="${s.id}"]`, svg).forEach(n => n.classList.add("selc"));
  buildCoverage(); applyVisibility(); renderInspector();
  if (s && zoomTo) focusOn(s);
  if (s && window.matchMedia("(max-width:900px)").matches) document.body.classList.add("show-insp");
}
function focusOn(s) {
  let c, span = 30;
  if (s.t === "cam") {
    const cam = camById[s.id], cv = coverage(cam);
    if (cv && !cv.fixed) { const pts = [...zoneCorners(cam), cv.l, cv.r]; const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); c = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]; span = Math.max(Math.max(...ys) - Math.min(...ys), (Math.max(...xs) - Math.min(...xs)) / 1.6) * 1.25; }
    else { c = cam.anchor || (cam.id === "CAM 05" ? [0, 16] : [0, 22]); span = cam.roaming ? 80 : 34; }
  }
  else if (s.t === "obj") { const o = objById[s.id]; c = o.c; span = Math.max(14, Math.max(...o.size) * 2.2); }
  else if (s.t === "fx") { c = fxById[s.id].p; span = 12; }
  if (!c) return; const r = svg.getBoundingClientRect(), ar = r.width / r.height;
  const w = ar > 1 ? span * ar : span, hh = w / ar; setVB([c[0] - w / 2, c[1] - hh / 2, w, hh]);
}
const pillFor = st => ({ prov: '<span class="pill prov">Provisional position</span>', zone: '<span class="pill src">Operating zone</span>', est: '<span class="pill est">Coverage estimated</span>', pend: '<span class="pill pend">Coverage pending</span>' }[st] || "");
function renderInspector() {
  const b = $("#inspBody"), title = $("#inspTitle");
  if (!sel) {
    title.textContent = "Cameras";
    b.innerHTML = `<p class="note" style="margin-bottom:12px">Select a camera, LED surface, fixture or any object on the plan to see its details.</p><div class="camlist">${CAMS.map(c => `<button data-c="${c.id}"><span class="cid">${c.id}</span><span class="cn">${esc(c.name)}<small>${esc(c.position)}</small></span></button>`).join("")}</div>
    <div class="sec">Source</div><p class="note">${esc(P.source)}. Read only. LED sizes from LEDMapper pixel maps.</p>
    ${CLIENT ? "" : `<div class="sec">Open questions <span class="pill pend">${QUERIES.filter(q => q.status === "Open").length}</span></div><p class="note">See Notes for the full list.</p>`}`;
    $$(".camlist button", b).forEach(x => x.onclick = () => select({ t: "cam", id: x.dataset.c }, true));
    return;
  }
  if (sel.t === "cam") {
    const c = camById[sel.id], cv = coverage(c);
    title.textContent = "Camera";
    let cov = "";
    if (cv && !cv.fixed) {
      const T = TARGETS[cv.tk].p, cs = zoneCorners(c).map(p => dist(p, T)), dmin = Math.min(...cs), dmax = Math.max(...cs), sensor = SENSORS[c.sensor];
      const rows = Object.entries(FRAMINGS).map(([k, f]) => `<tr${k === cv.fk ? ' style="color:#64d2ff"' : ""}><td>${esc(f.label.split(" · ")[0])} · ${f.w} m</td><td>${fmt(2 * Math.atan(f.w / 2 / cv.d) * 180 / Math.PI)}°</td><td>${sensor ? (Math.round(sensor.w * dmin / f.w) === Math.round(sensor.w * dmax / f.w) ? Math.round(sensor.w * dmin / f.w) : Math.round(sensor.w * dmin / f.w) + "–" + Math.round(sensor.w * dmax / f.w)) + " mm" : "—"}</td></tr>`).join("");
      const obs = obstructions(cv.a, cv.T);
      cov = `<div class="sec">Coverage <span class="pill est">Estimated</span></div>
        <p class="note">To ${esc(TARGETS[cv.tk].label.toLowerCase())}: ${fmt(dmin)}–${fmt(dmax)} m across the zone (${fmt(cv.d)} m from its centre). Focal lengths assume ${esc(sensor.label)}; not confirmed.</p>
        <table class="mini" style="margin-top:8px"><tr><th>Framing</th><th>H-FOV</th><th>Focal length</th></tr>${rows}</table>
        <div class="sec">Potential obstructions <span class="pill est">Plan only</span></div>
        ${obs.length ? `<ul class="obs">${obs.map(o => `<li><b>${esc(o.name)}</b><span>${esc(layerName(o.layer))} · up to +${fmt(o.z[1])} m · ${fmt(dist(cv.a, o.p))} m from camera</span></li>`).join("")}</ul><p class="note" style="margin-top:8px">Objects the centre sightline crosses in plan. Camera height is not set, so none of these is a confirmed blockage.</p>` : `<p class="note">Nothing taller than 0.9 m crosses the centre sightline in plan.</p>`}`;
    } else if (cv && cv.fixed) cov = `<div class="sec">Coverage <span class="pill est">Estimated</span></div><p class="note">Ultra-wide, shown as a ${cv.fov}° wedge facing the audience. GoPro mode and exact mount are not confirmed.</p>`;
    else cov = `<div class="sec">Coverage <span class="pill pend">Pending</span></div><p class="note">Mobile camera. Coverage depends on where the operator is; the hatched area is its operating zone.</p>`;
    b.innerHTML = `<div class="camhead"><span class="camid">${c.id}</span><div class="camname">${esc(c.name)}</div><div class="pills">${pillFor(c.positionStatus)}${pillFor(c.coverage)}${c.tally ? '<span class="pill src">Tally · talkback</span>' : '<span class="pill src">No tally</span>'}</div></div>
      <dl class="kv"><dt>Position</dt><dd>${esc(c.position)}</dd><dt>Camera type</dt><dd>${esc(c.type)}</dd><dt>Lens</dt><dd>${esc(c.lens)}</dd>
      <dt>Primary</dt><dd>${esc(c.primary)}</dd><dt>Secondary</dt><dd>${esc(c.secondary)}</dd><dt>Mounting</dt><dd>${esc(c.mounting)}</dd>
      <dt>Signal</dt><dd>${esc(c.signal)}</dd><dt>Production role</dt><dd>${esc(c.role)}</dd><dt>Operator</dt><dd>${esc(c.operator)}</dd><dt>Notes</dt><dd>${esc(c.notes)}</dd></dl>${cov}`;
    return;
  }
  if (sel.t === "obj") {
    const o = objById[sel.id], led = LED_INFO[o.name];
    title.textContent = layerName(o.layer);
    b.innerHTML = `<div class="camhead"><div class="camname" style="margin-top:0">${esc(o.label)}</div><div class="pills"><span class="pill src">MVR V1</span>${o.identified ? '<span class="pill prov">Identified from geometry</span>' : ""}</div></div>
      <dl class="kv"><dt>Layer</dt><dd>${esc(layerName(o.layer))}</dd><dt>Group</dt><dd>${esc(o.group)}</dd><dt>MVR layer</dt><dd>${esc(o.mvrLayer)}</dd>
      ${led ? `<dt>Pixels</dt><dd>${led.px} · P3.9</dd><dt>Size</dt><dd>${led.m} (${led.area})</dd><dt>Panels</dt><dd>${o.panels} × 50 × 50 cm</dd>` : `<dt>Plan size</dt><dd>${fmt(o.size[0])} × ${fmt(o.size[1])} m</dd>`}
      <dt>Height</dt><dd>+${fmt(o.z[0], 2)} to +${fmt(o.z[1], 2)} m</dd><dt>Plan centre</dt><dd>x ${fmt(o.c[0])} · y ${fmt(o.c[1])} m</dd></dl>
      <div class="act"><button class="btn sm" id="hideObj">Hide this object</button><button class="btn sm" id="zoomObj">Zoom to</button></div>`;
    $("#hideObj").onclick = () => { S.hidden.push(o.id); select(null); };
    $("#zoomObj").onclick = () => focusOn(sel);
    return;
  }
  if (sel.t === "fx") {
    const f = fxById[sel.id]; title.textContent = layerName(f.layer);
    b.innerHTML = `<div class="camhead"><div class="camname" style="margin-top:0">${esc(f.name)}</div><div class="pills"><span class="pill src">MVR V1</span></div></div>
      <dl class="kv"><dt>Layer</dt><dd>${esc(layerName(f.layer))}</dd><dt>Group</dt><dd>${esc(f.group)}</dd><dt>MVR layer</dt><dd>${esc(f.mvrLayer)}</dd><dt>GDTF</dt><dd>${esc(f.gdtf)}</dd><dt>Mode</dt><dd>${esc(f.mode || "—")}</dd>
      <dt>Height</dt><dd>+${fmt(f.z, 2)} m</dd><dt>Plan position</dt><dd>x ${fmt(f.p[0])} · y ${fmt(f.p[1])} m</dd><dt>Patch</dt><dd class="muted">No address in the MVR</dd></dl>
      <div class="act"><button class="btn sm" id="hideObj">Hide this fixture</button><button class="btn sm" id="zoomObj">Zoom to</button></div>`;
    $("#hideObj").onclick = () => { S.hidden.push(f.id); select(null); };
    $("#zoomObj").onclick = () => focusOn(sel);
    return;
  }
  if (sel.t === "zone") {
    const z = ZONES[sel.id], cams = CAMS.filter(c => c.zone === sel.id);
    const info = z ? { name: z.label, note: z.note, pill: '<span class="pill prov">Provisional</span>' } :
      sel.id === "pit" ? { name: "Camera pit", note: `Area inside the stage barricade that is not stage deck: front pit, around the thrust and around the B-stage. ${fmt(P.zones.pit.area, 0)} m². CAM 05 works here; CAM 06 can enter.`, pill: '<span class="pill src">Derived from MVR</span>' } :
      { name: "Audience area", note: `From the stage barricade to the FOH barricade, ±30.5 m wide. ${fmt(P.zones.audience.area, 0)} m². The venue boundary is not in the MVR.`, pill: '<span class="pill src">Derived from MVR</span>' };
    title.textContent = "Zone";
    b.innerHTML = `<div class="camhead"><div class="camname" style="margin-top:0">${esc(info.name)}</div><div class="pills">${info.pill}</div></div><p class="note">${esc(info.note)}</p>${cams.length ? `<div class="sec">Cameras</div><div class="camlist">${cams.map(c => `<button data-c="${c.id}"><span class="cid">${c.id}</span><span class="cn">${esc(c.name)}</span></button>`).join("")}</div>` : ""}`;
    $$(".camlist button", b).forEach(x => x.onclick = () => select({ t: "cam", id: x.dataset.c }));
  }
}
$("#inspClose").onclick = () => { select(null); document.body.classList.remove("show-insp"); };
document.addEventListener("keydown", e => { if (e.key === "Escape") { select(null); document.body.classList.remove("show-layers", "show-insp"); } });

/* ------------------------------------------------------------------ tabs */
function setTab(t) {
  $$("nav.tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === t));
  $$(".view").forEach(v => v.classList.toggle("on", v.id === "v-" + t));
  store.set("tab", t); if (t === "plot") setVB(VB);
}
$$("nav.tabs button").forEach(b => b.onclick = () => setTab(b.dataset.tab));
$("#mLayers").onclick = () => document.body.classList.toggle("show-layers");
$("#mInsp").onclick = () => document.body.classList.toggle("show-insp");

/* ------------------------------------------------------------------ schedule */
const SCOLS = [["id", "ID"], ["name", "Name"], ["position", "Position"], ["type", "Camera type"], ["lens", "Lens"], ["primary", "Primary responsibility"], ["secondary", "Secondary responsibility"], ["mounting", "Mounting"], ["signal", "Signal"], ["tb", "Tally / talkback"], ["status", "Status"], ["notes", "Notes"]];
const camRow = c => ({ ...c, tb: c.tally ? "Yes" : "No", status: c.positionStatus === "zone" ? "Operating zone" : "Provisional position" });
let schSort = ["id", 1], schFilter = { q: "", m: "all" };
function renderSchedule() {
  const q = schFilter.q.toLowerCase();
  let rows = CAMS.map(camRow).filter(c => (schFilter.m === "all" || (schFilter.m === "fixed" ? !c.roaming : c.roaming)) && (!q || SCOLS.some(([k]) => String(c[k]).toLowerCase().includes(q))));
  rows.sort((a, b) => String(a[schSort[0]]).localeCompare(String(b[schSort[0]]), undefined, { numeric: true }) * schSort[1]);
  $("#schTable").innerHTML = `<thead><tr>${SCOLS.map(([k, n]) => `<th data-k="${k}" ${schSort[0] === k ? `aria-sort="${schSort[1] > 0 ? "ascending" : "descending"}"` : ""}>${n}</th>`).join("")}</tr></thead>
  <tbody>${rows.map(c => `<tr class="click" data-c="${c.id}">${SCOLS.map(([k]) => k === "id" ? `<td class="id"><span>${c.id}</span></td>` : `<td${k === "notes" || k === "position" ? ' style="min-width:220px"' : ""}>${esc(c[k])}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${SCOLS.length}" class="muted">No cameras match. Clear the search to see all seven.</td></tr>`}</tbody>`;
  $$("#schTable th").forEach(th => th.onclick = () => { schSort = [th.dataset.k, schSort[0] === th.dataset.k ? -schSort[1] : 1]; renderSchedule(); });
  $$("#schTable tr.click").forEach(tr => tr.onclick = () => { setTab("plot"); select({ t: "cam", id: tr.dataset.c }, true); });
}
$("#schQ").oninput = e => { schFilter.q = e.target.value; renderSchedule(); };
$$("#schM button").forEach(b => b.onclick = () => { schFilter.m = b.dataset.m; $$("#schM button").forEach(x => x.setAttribute("aria-pressed", x === b)); renderSchedule(); });

/* ------------------------------------------------------------------ equipment */
const ECOLS = [["cat", "Category"], ["item", "Item"], ["qty", "Qty"], ["for", "For"], ["spec", "Specification"], ["status", "Status"]];
let eqSort = ["cat", 1], eqFilter = { q: "", s: "all" };
function renderEquipment() {
  const q = eqFilter.q.toLowerCase();
  let rows = EQUIPMENT.filter(r => (eqFilter.s === "all" || r.status === eqFilter.s) && (!q || ECOLS.some(([k]) => String(r[k]).toLowerCase().includes(q))));
  rows.sort((a, b) => (typeof a[eqSort[0]] === "number" ? a[eqSort[0]] - b[eqSort[0]] : String(a[eqSort[0]]).localeCompare(String(b[eqSort[0]]))) * eqSort[1]);
  $("#eqTable").innerHTML = `<thead><tr>${ECOLS.map(([k, n]) => `<th data-k="${k}" ${eqSort[0] === k ? `aria-sort="${eqSort[1] > 0 ? "ascending" : "descending"}"` : ""}>${n}</th>`).join("")}</tr></thead>
  <tbody>${rows.map(r => `<tr>${ECOLS.map(([k]) => k === "status" ? `<td><span class="pill ${r.status === "TBC" ? "pend" : r.status === "Provisional" ? "prov" : "ok"}">${r.status}</span></td>` : `<td>${esc(r[k])}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="6" class="muted">Nothing matches. Clear the search or the status filter.</td></tr>`}</tbody>`;
  $$("#eqTable th").forEach(th => th.onclick = () => { eqSort = [th.dataset.k, eqSort[0] === th.dataset.k ? -eqSort[1] : 1]; renderEquipment(); });
}
$("#eqQ").oninput = e => { eqFilter.q = e.target.value; renderEquipment(); };
$$("#eqS button").forEach(b => b.onclick = () => { eqFilter.s = b.dataset.s; $$("#eqS button").forEach(x => x.setAttribute("aria-pressed", x === b)); renderEquipment(); });

/* ------------------------------------------------------------------ signal flow */
const EC = { v: "#f5f5f7", c: "#8e8e93", t: "#ff453a", i: "#ffd60a" };
let flowSel = null, flowTypes = store.get("flowTypes", { v: true, c: true, t: false, i: false });
function renderFlow() {
  const F = FLOW, W = 1320, colX = [24, 238, 452, 652, 880, 1100], nw = 176, nh = 44, gap = 14, top = 104;
  const byCol = F.cols.map((_, i) => F.nodes.filter(n => n.col === i));
  const pos = {};
  byCol.forEach((ns, i) => ns.forEach((n, j) => { pos[n.id] = [colX[i], top + j * (nh + gap) + (i === 0 ? 0 : i === 5 ? 20 : 40)]; }));
  pos.ic = [452, top + 2 * (nh + gap) + 200]; pos.tal = [652, top + 3 * (nh + gap) + 120];
  const H = Math.max(...Object.values(pos).map(p => p[1])) + nh + 40;
  const s = $("#flow"); s.setAttribute("viewBox", `0 0 ${W} ${H}`); s.innerHTML = "";
  F.cols.forEach((c, i) => { const t = el("text", { x: colX[i], y: 90, class: "col" }); t.textContent = c; s.appendChild(t); });
  const conn = new Set();
  if (flowSel) { const walk = (id, dir) => F.edges.forEach(e => { if (!flowTypes[e[2]]) return; const [a, b] = dir > 0 ? [e[0], e[1]] : [e[1], e[0]]; if (a === id && !conn.has(e.join())) { conn.add(e.join()); walk(b, dir); } }); walk(flowSel, 1); walk(flowSel, -1); }
  const lit = new Set([flowSel]); F.edges.forEach(e => { if (conn.has(e.join())) { lit.add(e[0]); lit.add(e[1]); } });
  F.edges.forEach(e => {
    if (!flowTypes[e[2]]) return;
    const a = pos[e[0]], b = pos[e[1]]; let x1 = a[0] + nw, y1 = a[1] + nh / 2, x2 = b[0], y2 = b[1] + nh / 2;
    if (b[0] < a[0]) { x1 = a[0]; x2 = b[0] + nw; } if (b[0] === a[0]) { x1 = a[0] + nw; x2 = b[0] + nw; }
    const cx = (x1 + x2) / 2 + (b[0] === a[0] ? 60 : 0);
    const p = el("path", { d: `M${x1},${y1}C${cx},${y1} ${cx},${y2} ${x2},${y2}`, class: "e" + (flowSel ? (conn.has(e.join()) ? " hl" : " dim") : ""), stroke: EC[e[2]], "stroke-opacity": e[2] === "v" ? .55 : .7, "stroke-dasharray": e[2] === "t" ? "2 4" : e[2] === "i" ? "6 4" : e[2] === "c" ? "4 3" : null });
    s.appendChild(p);
  });
  F.nodes.forEach(n => {
    const [x, y] = pos[n.id];
    const g = el("g", { class: "node" + (n.tbc ? " tbc" : "") + (flowSel === n.id ? " sel" : "") + (flowSel && !lit.has(n.id) ? " dim" : ""), transform: `translate(${x},${y})`, tabindex: 0, role: "button", "aria-label": n.t });
    g.appendChild(el("rect", { width: nw, height: nh, rx: 10 }));
    const t1 = el("text", { x: 12, y: 19 }); t1.textContent = n.t; const t2 = el("text", { x: 12, y: 34, class: "s" }); t2.textContent = n.s || ""; g.append(t1, t2);
    if (n.cam) { const c = camById[n.cam]; g.appendChild(el("circle", { cx: nw - 14, cy: 14, r: 3.5, fill: c.tally ? "#ff453a" : "#3a3a3c" })); }
    const act = () => { flowSel = flowSel === n.id ? null : n.id; renderFlow(); };
    g.addEventListener("click", act); g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); } });
    s.appendChild(g);
  });
  const d = $("#flowInfo");
  if (!flowSel) { d.innerHTML = `<p class="note">Select a block to trace its signal path. Dashed outlines are equipment still to be confirmed.</p><div class="sec">Switching</div><p class="note">One 2 M/E switcher at FOH. M/E 1 cuts broadcast for the live stream and recording. M/E 2 cuts IMAG to SR and SL I-MAG. Both draw from the same camera pool.</p><div class="sec">Visuals</div><p class="note">AUX outputs send camera feeds to Resolume, where a Notch block adds effects for CENTER.</p>`; return; }
  const n = F.nodes.find(x => x.id === flowSel), c = n.cam && camById[n.cam];
  const ins = F.edges.filter(e => e[1] === n.id && flowTypes[e[2]]).map(e => F.nodes.find(x => x.id === e[0]).t), outs = F.edges.filter(e => e[0] === n.id && flowTypes[e[2]]).map(e => F.nodes.find(x => x.id === e[1]).t);
  d.innerHTML = `<div class="camhead"><div class="camname" style="margin-top:0;font-size:17px">${esc(n.t)}</div><div class="pills">${n.tbc ? '<span class="pill pend">To be confirmed</span>' : '<span class="pill prov">Planned</span>'}</div></div>
    <p class="note">${esc(c ? c.signal + ". " + (c.tally ? "Tally and talkback." : "No tally or talkback.") : n.d || n.s || "")}</p>
    <dl class="kv" style="margin-top:12px"><dt>Inputs</dt><dd>${esc(ins.join(", ") || "—")}</dd><dt>Outputs</dt><dd>${esc(outs.join(", ") || "—")}</dd></dl>
    ${c ? `<div class="act"><button class="btn sm" id="flowToPlot">Show ${c.id} on the plot</button></div>` : ""}`;
  if (c) $("#flowToPlot").onclick = () => { setTab("plot"); select({ t: "cam", id: c.id }, true); };
}
$$("#flowTypes button").forEach(b => { b.setAttribute("aria-pressed", flowTypes[b.dataset.t]); b.onclick = () => { flowTypes[b.dataset.t] = !flowTypes[b.dataset.t]; b.setAttribute("aria-pressed", flowTypes[b.dataset.t]); store.set("flowTypes", flowTypes); renderFlow(); }; });

/* ------------------------------------------------------------------ notes */
function renderNotes() {
  const open = QUERIES.filter(q => q.status === "Open").length;
  $("#notesBody").innerHTML = `
  <div class="stats">
    <div class="stat"><b>${CAMS.length}</b><span>camera sources</span></div>
    <div class="stat"><b>${CAMS.filter(c => c.operator === "Manned").length}</b><span>manned, with tally</span></div>
    <div class="stat"><b>${CAMS.filter(c => /wireless/i.test(c.signal)).length}</b><span>wireless</span></div>
    ${CLIENT ? "" : `<div class="stat"><b>${open}</b><span>open questions</span></div>`}
    <div class="stat"><b>${P.fixtures.length}</b><span>fixtures in the MVR</span></div>
  </div>
  <div class="cols2">
    ${CLIENT ? "" : `<div class="card"><h3>Open questions</h3>${QUERIES.map((q, i) => `<div class="q"><span class="qn">Q${i + 1}</span><div><b>${esc(q.t)}</b><p>${esc(q.d)}</p></div><span class="pill ${q.status === "Open" ? "pend" : "ok"}">${q.status}</span></div>`).join("")}</div>`}
    <div style="display:grid;gap:18px;align-content:start">
      <div class="card"><h3>Sightline status</h3>${CAMS.map(c => `<div class="q" style="grid-template-columns:64px 1fr auto"><span class="qn">${c.id}</span><div>${esc(c.name)}</div>${pillFor(c.coverage)}</div>`).join("")}<p class="note" style="margin:10px 0 0">No sightline is verified. Coverage is estimated from the plan, without camera heights.</p></div>
      <div class="card"><h3>Technical notes</h3><ul>${NOTES.map(n => `<li>${esc(n)}</li>`).join("")}</ul></div>
    </div>
    <div class="card"><h3>Planning assumptions</h3><ul>${ASSUMPTIONS.map(n => `<li>${esc(n)}</li>`).join("")}</ul></div>
    <div class="card"><h3>Revision history</h3>${REVISIONS.map(r => `<div class="q" style="grid-template-columns:44px 1fr auto"><span class="qn">${r.r}</span><div>${esc(r.d)}</div><span class="muted" style="white-space:nowrap">${r.date}</span></div>`).join("")}
      <h3 style="margin-top:18px">Sources</h3><ul><li><b>MVR</b>: ${esc(P.source)}. Not modified.</li><li><b>LEDMapper Pro</b>: LED names, pixel maps and sizes, from screenshots.</li><li><b>BMIC 2026 camera plot</b>: interface reference.</li></ul></div>
  </div>`;
}

/* ------------------------------------------------------------------ export */
function csv(rows, cols) { return [cols.map(c => c[1]), ...rows.map(r => cols.map(c => r[c[0]]))].map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n"); }
function download(name, text) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv" })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
$("#exp").onclick = e => { e.stopPropagation(); $("#expMenu").classList.toggle("open"); };
document.addEventListener("click", () => $("#expMenu").classList.remove("open"));
$("#csvCams").onclick = () => download(`CBF26_${PROJECT.revision}_camera_schedule.csv`, csv(CAMS.map(camRow), SCOLS));
$("#csvEq").onclick = () => download(`CBF26_${PROJECT.revision}_equipment_lens_schedule.csv`, csv(EQUIPMENT, ECOLS));
$("#csvQ").onclick = () => download(`CBF26_${PROJECT.revision}_open_questions.csv`, csv(QUERIES.map((q, i) => ({ n: "Q" + (i + 1), ...q })), [["n", "No."], ["t", "Question"], ["d", "Detail"], ["owner", "Owner"], ["status", "Status"]]));
$("#pdf").onclick = () => { buildPrint(); setTimeout(() => window.print(), 60); };
function buildPrint() {
  const clone = svg.cloneNode(true); clone.removeAttribute("id"); clone.setAttribute("class", "pl plotimg"); clone.style.background = "#000"; clone.setAttribute("viewBox", FIT.join(" "));
  const k = FIT[3] / 560; $$(".nz", clone).forEach(g => g.setAttribute("transform", `translate(${g._x ?? 0},${g._y ?? 0}) scale(${k})`));
  // nz clones lose _x/_y; copy from originals
  const orig = $$(".nz", svg); $$(".nz", clone).forEach((g, i) => g.setAttribute("transform", `translate(${orig[i]._x},${orig[i]._y}) scale(${k})`));
  const tbl = (rows, cols) => `<table><tr>${cols.map(c => `<th>${c[1]}</th>`).join("")}</tr>${rows.map(r => `<tr>${cols.map(c => `<td>${esc(r[c[0]])}</td>`).join("")}</tr>`).join("")}</table>`;
  $("#print").innerHTML = `<div class="ph">${$(".brand svg").outerHTML}<h1>${esc(PROJECT.name)}</h1><span class="small" style="margin-left:auto">Broadcast & IMAG camera plan · ${PROJECT.revision} · ${PROJECT.revisionDate}</span></div>
    <section><h2>Camera plot</h2><p class="small">Visible layers: ${LAYERS.filter(l => layerVisible(l.id)).map(l => l.name).join(", ")}. Camera positions are provisional zones; coverage is estimated.</p></section>`;
  $("#print").appendChild(clone);
  $("#print").insertAdjacentHTML("beforeend", `<section><h2>Camera schedule</h2>${tbl(CAMS.map(camRow), SCOLS.filter(c => c[0] !== "notes"))}</section>
    <section><h2>Equipment and lens schedule</h2>${tbl(EQUIPMENT, ECOLS)}</section>
    ${CLIENT ? "" : `<section><h2>Open questions</h2>${tbl(QUERIES.map((q, i) => ({ n: "Q" + (i + 1), ...q })), [["n", "No."], ["t", "Question"], ["d", "Detail"], ["owner", "Owner"], ["status", "Status"]])}</section>`}
    <section><h2>Planning assumptions</h2><ul>${ASSUMPTIONS.map(a => `<li>${esc(a)}</li>`).join("")}</ul><p class="small">Source: ${esc(P.source)} (not modified). HMBL Entertainment.</p></section>`);
}

/* ------------------------------------------------------------------ boot */
$("#revBadge").textContent = `${PROJECT.revision} · ${PROJECT.revisionDate}${CLIENT ? " · View only" : ""}`;
if (CLIENT) { $("#csvQ").remove(); $("#pdf small").textContent = "Plot and schedules"; $("#v-notes .lede").textContent = "What is confirmed and what is still assumed for the CBF 2026 camera plan."; }
fillPresets(); buildPlot(); renderSchedule(); renderEquipment(); renderFlow(); renderNotes(); renderInspector();
applyVisibility();
setTab(store.get("tab", "plot"));
requestAnimationFrame(() => setVB(VB));
window.__app = { S, select, applyVisibility, applyPreset, setTab };
})();
