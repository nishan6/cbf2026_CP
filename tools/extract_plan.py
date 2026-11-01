"""Extract a 2D plan dataset from the CBF26 MVR (read-only; the MVR is never modified).
Usage: python3 -I extract_plan.py <extracted_mvr_dir> <out.json>
Coordinates: metres, MVR world space (X = audience-right / stage-left, Y = upstage, Z = up)."""
import sys, re, os, struct, json, collections
import xml.etree.ElementTree as ET
import numpy as np
from shapely.geometry import MultiPoint, Polygon, box, mapping
from shapely.ops import unary_union
from shapely import affinity
D, OUT = sys.argv[1], sys.argv[2]
root = ET.parse(os.path.join(D, 'GeneralSceneDescription.xml')).getroot()

def mat(e):
    m = e.find('Matrix')
    if m is None: return np.eye(4)
    v = [list(map(float, g.split(','))) for g in re.findall(r'\{([^}]*)\}', m.text)]
    T = np.eye(4); T[:3, :3] = np.array(v[:3]).T; T[:3, 3] = v[3]; return T

cache = {}
SYMDEFS = {sd.get('uuid'): sd for sd in root.iter('Symdef')}
def load3ds(fn):
    if fn in cache: return cache[fn]
    b = open(os.path.join(D, fn), 'rb').read(); vs = []
    def rd(o, end):
        while o + 6 <= end:
            cid, ln = struct.unpack_from('<HI', b, o)
            if ln < 6: break
            if cid in (0x4D4D, 0x3D3D, 0x4000, 0x4100):
                s = o + 6
                if cid == 0x4000:
                    while b[s] != 0: s += 1
                    s += 1
                rd(s, o + ln)
            elif cid == 0x4110:
                n = struct.unpack_from('<H', b, o + 6)[0]
                vs.append(np.frombuffer(b, dtype='<f4', count=n * 3, offset=o + 8).reshape(-1, 3))
            o += ln
    try: rd(0, len(b))
    except Exception: pass
    V = np.vstack(vs).astype(float) if vs else np.zeros((0, 3))
    cache[fn] = V; return V

def leaves(e, M, acc):
    """collect world-space vertex arrays for every geometry under e"""
    for c in e:
        if c.tag == 'ChildList': leaves(c, M, acc); continue
        if c.tag in ('GroupObject', 'SceneObject', 'Fixture', 'Truss', 'Symbol', 'Support', 'VideoScreen'):
            W = M @ mat(c)
            if c.tag == 'Symbol' and c.get('symdef') in SYMDEFS:
                for g in SYMDEFS[c.get('symdef')].iter('Geometry3D'):
                    V = load3ds(g.get('fileName'))
                    if len(V):
                        G = W @ mat(g); acc.append(((G[:3, :3] @ V.T).T + G[:3, 3]) / 1000.0)
            gs = c.find('Geometries')
            if gs is not None:
                for g in gs.iter('Geometry3D'):
                    V = load3ds(g.get('fileName'))
                    if len(V):
                        G = W @ mat(g); acc.append(((G[:3, :3] @ V.T).T + G[:3, 3]) / 1000.0)
                for sy in gs.iter('Symbol'):
                    sd = SYMDEFS.get(sy.get('symdef'))
                    if sd is None: continue
                    S = W @ mat(sy)
                    for g in sd.iter('Geometry3D'):
                        V = load3ds(g.get('fileName'))
                        if len(V):
                            G = S @ mat(g); acc.append(((G[:3, :3] @ V.T).T + G[:3, 3]) / 1000.0)
            leaves(c, W, acc)

def hullpoly(P):
    if len(P) < 3: return None
    h = MultiPoint(P[:, :2]).convex_hull
    return h if h.geom_type == 'Polygon' else h.buffer(0.03)

def rings(geom, tol=0.04):
    geom = geom.simplify(tol, preserve_topology=True)
    out = []
    for g in (geom.geoms if hasattr(geom, 'geoms') else [geom]):
        if g.is_empty or g.geom_type != 'Polygon': continue
        out.append([[round(x, 2), round(-y, 2)] for x, y in g.exterior.coords][:-1])  # store plan y as -Y (screen down = audience)
        for i in g.interiors:
            out.append([[round(x, 2), round(-y, 2)] for x, y in i.coords][:-1])
    return out

# MVR layer -> app layer/group
MAP = {
 'Production': ('L01', 'Stage decks & risers'), 'Truss - Roof': ('L01', 'Roof structure'),
 'Fabrication - Foliage': ('L01', 'Scenic · foliage'), 'Fabrication - Cherry Blossom Tree': ('L01', 'Scenic · cherry blossom trees'),
 'Video Wall': ('L02', None),
 'Truss': ('L03', 'Lighting trusses'), 'L LED Bar': ('L03', 'LED bars · Pixel Line IP'), 'L Spot': ('L03', 'Moving lights · MegaPointe'),
 'L Strobe': ('L03', 'Strobes · Color Strike M'), 'L Blinder': ('L03', 'Blinders · CUEPIX WW4'), 'L Profile': ('L03', 'Profiles · Sinfonya 600'),
 'L Wash': ('L03', 'Wash · Hy B-Eye'), 'L LED Tilt Bar': ('L03', 'LED tilt bars · Super Dotline'), 'L Scenic': ('L03', 'Scenic strobes · Raytheon'),
 'L DJ Booth Light': ('L03', 'DJ booth lights · Solaris Flare'), 'L Follow': ('L03', 'Follow fixtures · iForte FS'), 'L Followspot': ('L03', 'Followspots · Toru LT'),
 'PA': ('L04', None),
 'Scaffolding': ('L05', 'Wing scaffolding'), 'FPH Scaffolding': ('L05', 'FOH scaffolding'), 'FOH Riser': ('L05', 'FOH riser'), 'FOH Desks': ('L05', 'FOH desks'),
 'SFX ECO2': ('L06', 'CO₂ jets · ECO2JET'), 'SFX Flame': ('L06', 'Flame · FLAMEBLAZER'), 'SFX Sparkular Jet': ('L06', 'Sparkular Jet II'),
 'SFX Stadium Shot': ('L06', 'Confetti cannons · StadiumShot III'), 'SFX Confetti Blower': ('L06', 'Confetti blowers · StadiumBlaster'),
 'L Laser': ('L06', 'Lasers · KVANT Atom 42'), 'SFX Scaffolding': ('L06', 'SFX scaffolding (upstage)'),
 'Mojo Barricade': ('L09', 'Stage barricade'), 'FOH Mojo Barricade': ('L09', 'FOH barricade'),
}
objects, fixtures, groups_seen = [], [], collections.OrderedDict()
layerstats = {}
deck_hulls, barricade_hulls = [], []

def add_obj(layer, app, group, name, geom, z, extra=None):
    oid = f"o{len(objects)+1}"
    o = dict(id=oid, mvrLayer=layer, layer=app, group=group, name=name, rings=rings(geom), z=[round(z[0], 2), round(z[1], 2)])
    c = geom.centroid; o['c'] = [round(c.x, 2), round(-c.y, 2)]
    b = geom.bounds; o['size'] = [round(b[2]-b[0], 2), round(b[3]-b[1], 2)]
    if extra: o.update(extra)
    objects.append(o); groups_seen.setdefault((app, group), 0); groups_seen[(app, group)] += 1
    return o

for L in root.iter('Layer'):
    ln = L.get('name')
    cl = L.find('ChildList')
    kids = list(cl) if cl is not None else []
    layerstats[ln or '(unnamed)'] = len(kids)
    if ln not in MAP or not kids: continue
    app, grp = MAP[ln]
    if ln == 'Video Wall':
        # classify every 50x50 panel into LEDMapper surfaces (counts verified: 840 / 440+154+330 per wing)
        for g in kids:
            Mg = mat(g); panels = []
            def pw(e, M):
                for c in e:
                    if c.tag == 'ChildList': pw(c, M); continue
                    if c.tag in ('GroupObject', 'SceneObject'):
                        W = M @ mat(c)
                        if c.tag == 'SceneObject':
                            acc = []; leaves([c], M, acc)
                            if acc: panels.append(np.vstack(acc))
                        else: pw(c, W)
            pw([g], np.eye(4))
            C = np.array([p.mean(0) for p in panels])
            if abs(C[:, 0].mean()) < 3:
                surfaces = {'CENTER': list(range(len(panels)))}
            else:
                sgn = np.sign(C[:, 0].mean()); side = 'SL' if sgn > 0 else 'SR'
                yf = C[:, 1].min()
                s = np.where(np.abs(C[:, 1] - yf) < 0.4, 23.75 - np.abs(C[:, 0]), 12.5 + (C[:, 1] - yf))
                cols = np.unique(np.round(s * 2) / 2); rank = {v: i for i, v in enumerate(cols)}
                ci = np.array([rank[v] for v in np.round(s * 2) / 2])
                surfaces = {f'{side} I-MAG': list(np.where(ci < 20)[0]), f'{side} CURVE': list(np.where((ci >= 20) & (ci < 27))[0]), side: list(np.where(ci >= 27)[0])}
            for sname, idx in surfaces.items():
                P = np.vstack([panels[i] for i in idx])
                geom = unary_union([hullpoly(panels[i]).buffer(0.06) for i in idx])
                add_obj(ln, 'L02', 'LED surfaces', sname, geom, (P[:, 2].min(), P[:, 2].max()), dict(kind='led', panels=len(idx)))
        continue
    for i, k in enumerate(kids):
        if k.tag == 'Fixture':
            W = mat(k); p = W[:3, 3] / 1000
            fixtures.append(dict(id=f"f{len(fixtures)+1}", mvrLayer=ln, layer=app, group=grp, name=k.get('name'),
                                 gdtf=(k.findtext('GDTFSpec') or ''), mode=(k.findtext('GDTFMode') or ''),
                                 p=[round(p[0], 2), round(-p[1], 2)], z=round(p[2], 2)))
            continue
        acc = []; leaves([k], np.eye(4), acc)
        if not acc: continue
        parts = [hullpoly(a) for a in acc]; parts = [p for p in parts if p is not None]
        P = np.vstack(acc)
        geom = unary_union([p.buffer(0.02) for p in parts])
        if ln == 'Production':
            for a in acc:
                if a[:, 2].max() > 1.6: deck_hulls.append(hullpoly(a))
        if ln == 'Mojo Barricade':
            barricade_hulls.extend(parts)
        g2 = grp
        if ln == 'PA':
            cx, cy, zmax, zmin = P[:, 0].mean(), P[:, 1].mean(), P[:, 2].max(), P[:, 2].min()
            if k.tag == 'Truss': g2 = 'Array rigging'
            elif zmax < 2: g2 = 'Subwoofers (ground)'
            elif abs(cx) > 20: g2 = 'Outfill arrays'
            else: g2 = 'Main L/R arrays'
        add_obj(ln, app, g2, f"{(g2 or ln)} · {i+1:02d}", geom, (P[:, 2].min(), P[:, 2].max()))

# ---- derived zones (computed from MVR geometry; labelled as derived in the app) ----
deck = unary_union([h.buffer(0.05) for h in deck_hulls if h is not None]).buffer(0.1).buffer(-0.1)
barr = unary_union([h.buffer(0.12) for h in barricade_hulls])
res = 0.2; xs = np.arange(-30.8, 30.6, res); ys = np.arange(-29.4, -8.6, res)
from scipy import ndimage
from shapely import prepared
pb = prepared.prep(barr); pdk = prepared.prep(deck)
from shapely.geometry import Point
blocked = np.zeros((len(ys), len(xs)), bool); isdeck = np.zeros_like(blocked)
for j, y in enumerate(ys):
    for i, x in enumerate(xs):
        pt = Point(x + res/2, y + res/2)
        blocked[j, i] = pb.contains(pt); isdeck[j, i] = pdk.contains(pt)
lab, n = ndimage.label(~blocked)
aud = lab[0, len(xs)//2]  # bottom row centre = audience side (y=-29.4)
stage_side = (lab != aud) & (~blocked)
pit_cells = stage_side & ~isdeck
cells = [box(xs[i], ys[j], xs[i]+res, ys[j]+res) for j, i in zip(*np.where(pit_cells))]
pit = unary_union(cells).buffer(0.05).buffer(-0.05)
pit = unary_union([g for g in (pit.geoms if hasattr(pit, 'geoms') else [pit]) if g.area > 2])
foh_barr = [o for o in objects if o['mvrLayer'] == 'FOH Mojo Barricade']
stage_region = unary_union(cells + [deck, barr]).buffer(0.3)
fohy = min(-(o['c'][1]) for o in foh_barr) if foh_barr else -47.4  # nearest FOH barricade to stage (MVR Y)
fb_ymax = max(max(-pt[1] for r in o['rings'] for pt in r) for o in foh_barr)
audience = box(-30.5, fb_ymax, 30.5, -9.5).difference(stage_region)
audience = unary_union([g for g in (audience.geoms if hasattr(audience, 'geoms') else [audience]) if g.area > 20])
zones = dict(
  deck=dict(rings=rings(deck), area=round(deck.area, 1)),
  pit=dict(rings=rings(pit, 0.08), area=round(pit.area, 1)),
  audience=dict(rings=rings(audience, 0.1), area=round(audience.area, 1)),
)
# key measurements (from MVR geometry)
db = deck.bounds
meas = dict(deckFrontY=None)
data = dict(source='CBF26 - MVR - V1 - HMBL Entertainment.mvr (Capture 2025.1.14, MVR 1.4)', units='m',
            axes='x = stage-left (+) / stage-right (−) as seen by performer; plan y = distance towards audience (MVR −Y)',
            layerstats=layerstats, objects=objects, fixtures=fixtures, zones=zones,
            groups=[dict(layer=a, group=g, count=c) for (a, g), c in groups_seen.items()],
            bounds=dict(deck=[round(v, 2) for v in db], fohBarricadeStageSideY=round(fb_ymax, 2)))
json.dump(data, open(OUT, 'w'), separators=(',', ':'))
print('objects', len(objects), 'fixtures', len(fixtures), 'bytes', os.path.getsize(OUT))
print('deck bounds', db, 'pit area', pit.area, 'aud area', audience.area, 'foh barr stage-side y', fb_ymax)
for (a, g), c in groups_seen.items(): print(a, g, c)
