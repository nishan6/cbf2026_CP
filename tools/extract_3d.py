"""CBF26 MVR -> compact 3D venue for the BMIC-style plot (read-only on the MVR).
Every MVR geometry becomes an oriented box (instanced in the browser). Coordinates are
converted to three.js: x = MVR X (stage left +), y = MVR Z (up), z = -MVR Y (audience +).
Usage: python3 -I extract_3d.py <extracted_mvr_dir> <out.json>"""
import sys, re, os, struct, json, base64
import xml.etree.ElementTree as ET
import numpy as np
D, OUT = sys.argv[1], sys.argv[2]
root = ET.parse(os.path.join(D, 'GeneralSceneDescription.xml')).getroot()
SYM = {s.get('uuid'): s for s in root.iter('Symdef')}
def mat(e):
    m = e.find('Matrix')
    if m is None: return np.eye(4)
    v = [list(map(float, g.split(','))) for g in re.findall(r'\{([^}]*)\}', m.text)]
    T = np.eye(4); T[:3, :3] = np.array(v[:3]).T; T[:3, 3] = v[3]; return T
mcache = {}
def mesh3ds(fn):
    if fn in mcache: return mcache[fn]
    b = open(os.path.join(D, fn), 'rb').read(); objs = []
    def rd(o, end, cur):
        while o + 6 <= end:
            cid, ln = struct.unpack_from('<HI', b, o)
            if ln < 6: break
            if cid in (0x4D4D, 0x3D3D, 0x4000):
                s0 = o + 6
                if cid == 0x4000:
                    while b[s0] != 0: s0 += 1
                    s0 += 1
                rd(s0, o + ln, cur)
            elif cid == 0x4100:
                obj = {'v': None, 'f': None}; objs.append(obj); rd(o + 6, o + ln, obj)
            elif cid == 0x4110 and cur is not None:
                n = struct.unpack_from('<H', b, o + 6)[0]
                cur['v'] = np.frombuffer(b, dtype='<f4', count=n * 3, offset=o + 8).reshape(-1, 3).astype(float)
            elif cid == 0x4120 and cur is not None:
                n = struct.unpack_from('<H', b, o + 6)[0]
                cur['f'] = np.frombuffer(b, dtype='<u2', count=n * 4, offset=o + 8).reshape(-1, 4)[:, :3].astype(np.int64)
            o += ln
    try: rd(0, len(b), None)
    except Exception: pass
    out = [(o['v'], o['f']) for o in objs if o['v'] is not None and o['f'] is not None and len(o['f'])]
    mcache[fn] = out; return out
MESHLAYERS = {'Production', 'Mojo Barricade', 'FOH Mojo Barricade', 'FOH Riser', 'FOH Desks', 'Fabrication - Foliage', 'Fabrication - Cherry Blossom Tree'}
meshes = {}  # lid -> list of (V,F)
cache = {}
def bbox3ds(fn):
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
    r = None
    if vs:
        V = np.vstack(vs).astype(float); r = (V.min(0), V.max(0))
    cache[fn] = r; return r
MAP3 = np.array([[1, 0, 0, 0], [0, 0, 1, 0], [0, -1, 0, 0], [0, 0, 0, 1]], float)  # MVR -> three
S_MM = np.diag([.001, .001, .001, 1.0])
# layer id per MVR layer
LID = {'Production': 0, 'Video Wall': 1, 'Truss - Roof': 2, 'Truss': 2, 'Scaffolding': 2, 'FPH Scaffolding': 2, 'SFX Scaffolding': 2,
       'PA': 4, 'Mojo Barricade': 6, 'FOH Mojo Barricade': 6, 'FOH Riser': 7, 'FOH Desks': 7,
       'Fabrication - Foliage': 8, 'Fabrication - Cherry Blossom Tree': 9}
COL = {0: (58, 60, 68), 2: (150, 156, 168), 3: (46, 52, 66), 4: (40, 44, 50), 5: (62, 46, 48), 6: (190, 190, 196), 7: (70, 74, 86), 8: (52, 96, 64), 9: (232, 150, 190)}
LEDC = {'CENTER': (40, 70, 255), 'I-MAG': (190, 50, 255), 'CURVE': (40, 200, 205), 'SIDE': (255, 60, 190)}
boxes = []  # (12 floats, rgb, layer, emissive, shape)
def add_box(Wmm, lo, hi, rgb, lid, emis=False, minsz=.02, shape=0):
    c = (lo + hi) / 2; s = np.maximum(hi - lo, minsz * 1000)
    B = np.eye(4); B[:3, :3] = np.diag(s); B[:3, 3] = c
    M = MAP3 @ S_MM @ Wmm @ B
    if shape == 0 and lid in (2, 4):  # long thin parts -> tubes (axis moved to local Y by a cyclic permutation)
        ln = np.linalg.norm(M[:3, :3], axis=0); k = int(np.argmax(ln)); o = sorted(ln)
        if lid == 2 and o[2] > 4 * o[1] and o[1] < .2:
            perm = [(k + 2) % 3, k, (k + 1) % 3]; M[:3, :3] = M[:3, :3][:, perm]; shape = 1
    boxes.append((M[:3, :].reshape(-1), rgb, lid, emis, shape))
def add_mesh(Wmm, fn, lid):
    G = MAP3 @ S_MM @ Wmm
    for V, F in mesh3ds(fn):
        P = (G[:3, :3] @ V.T).T + G[:3, 3]
        meshes.setdefault(lid, []).append((P, F))
def geoms(c, W, cb):
    gs = c.find('Geometries')
    if gs is None: return
    for g in gs.iter('Geometry3D'):
        bb = bbox3ds(g.get('fileName'))
        if bb: cb(W @ mat(g), *bb, g.get('fileName'))
    for sy in gs.iter('Symbol'):
        sd = SYM.get(sy.get('symdef'))
        if sd is None: continue
        S = W @ mat(sy)
        for g in sd.iter('Geometry3D'):
            bb = bbox3ds(g.get('fileName'))
            if bb: cb(S @ mat(g), *bb, g.get('fileName'))
def walk(e, M, cb):
    for c in e:
        if c.tag == 'ChildList': walk(c, M, cb); continue
        if c.tag in ('GroupObject', 'SceneObject', 'Truss', 'Symbol', 'Support'):
            W = M @ mat(c); geoms(c, W, cb); walk(c, W, cb)
fixtures = 0
led_panels = []
inv = {}
for L in root.iter('Layer'):
    ln = L.get('name'); cl = L.find('ChildList')
    if cl is None: continue
    if ln == 'Video Wall':
        for g in cl:
            raw = []
            walk([g], np.eye(4), lambda Wm, lo, hi, fn: raw.append((Wm, lo, hi)))
            # one record per 50x50 panel (each panel has several geometry parts): keep the largest part per centre
            best = {}
            for Wm, lo, hi in raw:
                ctr = (Wm @ np.r_[(lo + hi) / 2, 1])[:3] / 1000; key = tuple(np.round(ctr / .1).astype(int))
                vol = float(np.prod(np.maximum(hi - lo, 1)))
                if key not in best or vol > best[key][0]: best[key] = (vol, Wm, lo, hi, ctr)
            P = list(best.values()); C = np.array([p[4] for p in P])
            if abs(C[:, 0].mean()) < 3:
                surf = np.zeros(len(P), int); col = np.round((C[:, 0] - C[:, 0].min()) / .5).astype(int)
            else:
                yf = C[:, 1].min(); s_ = np.where(np.abs(C[:, 1] - yf) < .4, 23.75 - np.abs(C[:, 0]), 12.5 + (C[:, 1] - yf))
                cols = np.unique(np.round(s_ * 2) / 2); rank = {v: i for i, v in enumerate(cols)}
                col = np.array([rank[v] for v in np.round(s_ * 2) / 2])
                base = 1 if C[:, 0].mean() < 0 else 4
                surf = base + np.where(col < 20, 0, np.where(col < 27, 1, 2))
            row = np.round((C[:, 2] - C[:, 2].min()) / .5).astype(int)
            G = [MAP3 @ S_MM @ Wm for _, Wm, _, _, _ in P]
            ctr3 = np.array([(Gm @ np.r_[(lo + hi) / 2, 1])[:3] for Gm, (_, _, lo, hi, _) in zip(G, P)])
            colc = {c: ctr3[col == c].mean(0) for c in np.unique(col)}
            for i, (Gm, (_, Wm, lo, hi, _)) in enumerate(zip(G, P)):
                c = col[i]; nxt = colc.get(c + 1); prv = colc.get(c - 1)
                tan = (nxt - colc[c]) if nxt is not None else (colc[c] - prv)
                tan[1] = 0; tan /= np.linalg.norm(tan)
                led_panels.append((ctr3[i], tan * .5, int(surf[i]), int(col[i]), int(row[i])))
        continue
    for k in cl:
        if k.tag == 'Fixture':
            lid = 5 if (ln.startswith('SFX') or ln == 'L Laser') else 3
            W = mat(k); sz = np.array([420., 420., 520.]) if lid == 3 else np.array([450., 450., 600.])
            add_box(W, -sz / 2, sz / 2, COL[lid], lid); fixtures += 1
            key = (ln, k.get('name') or ''); inv[key] = inv.get(key, 0) + 1; continue
        if ln not in LID: continue
        lid = LID[ln]
        real = ln in MESHLAYERS
        def cb(Wm, lo, hi, fn, lid=lid, real=real):
            add_box(Wm, lo, hi, COL[lid], lid, shape=2 if real else 0)
            if real: add_mesh(Wm, fn, lid)
        walk([k], np.eye(4), cb)
Sh = np.array([b[4] for b in boxes], 'u1')
SC = 80.0
mout = []
for lid, parts in sorted(meshes.items()):
    # chunk into <=65000-vertex meshes so indices fit Uint16
    cv, cf, n = [], [], 0
    def flush():
        global cv, cf, n
        if not cv: return
        P = np.vstack(cv); F = np.vstack(cf)
        q = np.clip(np.round(P / SC * 32767), -32767, 32767).astype('<i2')
        mout.append({'l': lid, 'c': list(COL[lid]), 'p': base64.b64encode(q.tobytes()).decode(), 'i': base64.b64encode(F.astype('<u2').tobytes()).decode()})
        cv, cf, n = [], [], 0
    for P, F in parts:
        if n + len(P) > 65000: flush()
        cv.append(P); cf.append(F + n); n += len(P)
    flush()
M = np.array([b[0] for b in boxes], '<f4'); C = np.array([b[1] for b in boxes], 'u1'); Lr = np.array([b[2] for b in boxes], 'u1'); E = np.array([b[3] for b in boxes], bool)
_seen = {}
for p_ in led_panels:  # one quad per (surface, col, row); wings have a front and a back skin
    k = (p_[2], p_[3], p_[4])
    if k not in _seen or (p_[2] in (1, 4) and p_[0][2] > _seen[k][0][2]) or (p_[2] not in (1, 4) and abs(p_[0][0]) < abs(_seen[k][0][0]) if p_[2] in (3, 6) else False): _seen[k] = p_
LP = list(_seen.values())
led = {'c': None}
b64 = lambda a: base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()
led = {'p': b64(np.array([p[0] for p in LP], '<f4')), 'h': b64(np.array([p[1] for p in LP], '<f4')), 'm': b64(np.array([[p[2], p[3], p[4]] for p in LP], 'u1')), 'n': len(LP)}
out = {'src': os.path.basename(D.rstrip('/')), 'sc': SC, 'mesh': mout, 'led': led,
       'box0': {'m': b64(M[~E]), 'c': b64(C[~E]), 'l': b64(Lr[~E]), 's': b64(Sh[~E])}, 'N': [int((~E).sum()), 0],
       'inventory': [{'layer': a, 'name': b, 'qty': n} for (a, b), n in sorted(inv.items())]}
json.dump(out, open(OUT, 'w'), separators=(',', ':'))
print('tubes', int((Sh==1).sum()), 'meshed', int((Sh==2).sum()), 'mesh tris', sum(len(F) for v in meshes.values() for _, F in v), 'boxes', len(boxes), 'lit', int((~E).sum()), 'led panels', len(LP), 'fixtures', fixtures, 'KB', os.path.getsize(OUT) // 1024)
for i in range(10): print(i, int((Lr == i).sum()))
