# LAB ONLY (throwaway). Round 64: three versions of "the Observation Instrument" from Bob's 2026-11-13 brief, as
# concept stills (Cycles). One object, original, titanium / aluminium / black anodised / smoked glass, a small lit core.
#   a  Gimbal: three nested scale rings on pivots around an upright glass chamber.
#   b  Frame:  a square titanium frame holding a scale ring, a tilted inner ring and a glass chamber hung on wires.
#   c  Plate:  a terraced dial of concentric scale rings, a glass dome in the middle and a scanning bridge over it.
# Each in two states: closed (first view) and open (scrolled: it opens and shows its insides).
#   blender -b --factory-startup --python tools/lab/blender/instrument64.py -- <out-dir> [a-closed,b-open,...] [samples] [res%]
# Blender is Z up; the camera looks along +Y.
import bpy, bmesh, math, sys, os, random
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else '.')
ONLY = argv[1].split(',') if len(argv) > 1 and argv[1] else None
SAMPLES = int(argv[2]) if len(argv) > 2 else 384
RES_PCT = int(argv[3]) if len(argv) > 3 else 100
TAU = math.tau
FONT_PATH = 'C:/Windows/Fonts/bahnschrift.ttf'
FLOOR = -1.75
WALL = 5.5

def Rx(d): return Matrix.Rotation(math.radians(d), 4, 'X')
def Ry(d): return Matrix.Rotation(math.radians(d), 4, 'Y')
def Rz(d): return Matrix.Rotation(math.radians(d), 4, 'Z')
def T(x, y=0.0, z=0.0): return Matrix.Translation(Vector((x, y, z)))

# ---------------------------------------------------------------- scene

def fresh():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = 'CYCLES'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        for kind in ('OPTIX', 'CUDA'):
            try:
                prefs.compute_device_type = kind
                prefs.get_devices()
                if any(d.type == kind for d in prefs.devices):
                    for d in prefs.devices:
                        d.use = d.type == kind
                    s.cycles.device = 'GPU'
                    break
            except Exception:
                pass
    except Exception:
        pass
    s.cycles.samples = SAMPLES
    s.cycles.use_adaptive_sampling = True
    s.cycles.use_denoising = True
    try: s.cycles.denoiser = 'OPTIX'
    except Exception: pass
    s.cycles.max_bounces = 12
    s.cycles.glossy_bounces = 6
    s.cycles.transmission_bounces = 12
    s.cycles.transparent_max_bounces = 32
    s.cycles.caustics_reflective = False
    s.cycles.caustics_refractive = False
    s.cycles.blur_glossy = 0.6
    s.render.resolution_x, s.render.resolution_y = 1920, 1080
    s.render.resolution_percentage = RES_PCT
    s.render.image_settings.file_format = 'JPEG'
    s.render.image_settings.quality = 93
    s.view_settings.view_transform = 'AgX'
    for look in ('AgX - Medium High Contrast', 'Medium High Contrast', 'AgX - Base Contrast', 'None'):
        try:
            s.view_settings.look = look
            break
        except Exception:
            pass
    w = bpy.data.worlds.new('world'); w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.0016, 0.0018, 0.0022, 1)
    s.world = w
    return s

def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob

# ---------------------------------------------------------------- materials

def setin(node, key, val):
    if key in node.inputs:
        node.inputs[key].default_value = val

def principled(name, base, metal=0.0, rough=0.4, aniso=0.0, coat=0.0, spec=0.5):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    setin(b, 'Base Color', (*base, 1)); setin(b, 'Metallic', metal); setin(b, 'Roughness', rough)
    setin(b, 'Anisotropic', aniso); setin(b, 'Coat Weight', coat); setin(b, 'Coat Roughness', 0.08)
    setin(b, 'Specular IOR Level', spec)
    return m

def _math(nt, op, a, b=None, c=None):
    n = nt.nodes.new('ShaderNodeMath'); n.operation = op
    for i, v in enumerate((a, b, c)):
        if v is None: continue
        if isinstance(v, (int, float)): n.inputs[i].default_value = v
        else: nt.links.new(v, n.inputs[i])
    return n.outputs[0]

def _sock(node, ident, out=False):
    for s in (node.outputs if out else node.inputs):
        if s.identifier == ident:
            return s

def scale_mat(name, base, metal, rough, ink, *, N=360, every=10, mode='r', minor=(0, 0), major=(0, 0), w=0.16, wM=0.05,
              aniso=0.0, ink_rough=0.6, ink_metal=0.0, knurl=0, knurl_band=None, coat=0.0):
    """A turned part with engraved, ink-filled scale ticks (minor every 360/N degrees, major every `every` minors), masked
    to a band of radius (mode 'r', top faces) or height (mode 'z', side faces). `knurl`: fine ridges round the axis."""
    m = principled(name, base, metal, rough, aniso, coat)
    nt = m.node_tree; b = nt.nodes.get('Principled BSDF')
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Object'], sep.inputs[0])
    x, y, z = sep.outputs['X'], sep.outputs['Y'], sep.outputs['Z']
    ang01 = _math(nt, 'MULTIPLY_ADD', _math(nt, 'ARCTAN2', y, x), 1 / TAU, 0.5)
    r = _math(nt, 'SQRT', _math(nt, 'ADD', _math(nt, 'MULTIPLY', x, x), _math(nt, 'MULTIPLY', y, y)))
    coord = r if mode == 'r' else z
    def tick(count, width):
        f = _math(nt, 'FRACT', _math(nt, 'MULTIPLY', ang01, count))
        d = _math(nt, 'MINIMUM', f, _math(nt, 'SUBTRACT', 1.0, f))
        return _math(nt, 'LESS_THAN', d, width / 2)
    def band(lo, hi):
        return _math(nt, 'MULTIPLY', _math(nt, 'GREATER_THAN', coord, lo), _math(nt, 'LESS_THAN', coord, hi))
    t = _math(nt, 'MAXIMUM', _math(nt, 'MULTIPLY', tick(N, w), band(*minor)), _math(nt, 'MULTIPLY', tick(N / every, wM), band(*major)))
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    nt.links.new(t, _sock(mix, 'Factor_Float'))
    _sock(mix, 'A_Color').default_value = (*base, 1); _sock(mix, 'B_Color').default_value = (*ink, 1)
    nt.links.new(_sock(mix, 'Result_Color', True), b.inputs['Base Color'])
    nt.links.new(_math(nt, 'MULTIPLY_ADD', t, ink_rough - rough, rough), b.inputs['Roughness'])
    nt.links.new(_math(nt, 'MULTIPLY_ADD', t, ink_metal - metal, metal), b.inputs['Metallic'])
    if knurl:
        f = _math(nt, 'FRACT', _math(nt, 'MULTIPLY', ang01, knurl))
        h = _math(nt, 'ABSOLUTE', _math(nt, 'SUBTRACT', f, 0.5))
        if knurl_band:
            h = _math(nt, 'MULTIPLY', h, band(*knurl_band))
        bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.7
        bump.inputs['Distance'].default_value = 0.004
        nt.links.new(h, bump.inputs['Height']); nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    return m

def thin_glass(name, tint=(0.42, 0.45, 0.5), rough=0.015):
    """Thin-walled smoked glass: see-through without refraction, so the parts inside stay lit; a fresnel reflection on top."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); tr.inputs['Color'].default_value = (*tint, 1)
    pr = nt.nodes.new('ShaderNodeBsdfPrincipled')
    setin(pr, 'Base Color', (0, 0, 0, 1)); setin(pr, 'Roughness', rough); setin(pr, 'Specular IOR Level', 0.9)
    add = nt.nodes.new('ShaderNodeAddShader')
    nt.links.new(tr.outputs[0], add.inputs[0]); nt.links.new(pr.outputs[0], add.inputs[1])
    nt.links.new(add.outputs[0], out.inputs['Surface'])
    return m

def solid_glass(name, tint=(0.96, 0.98, 1.0)):
    m = principled(name, tint, 0.0, 0.0)
    b = m.node_tree.nodes.get('Principled BSDF')
    setin(b, 'Transmission Weight', 1.0); setin(b, 'IOR', 1.52)
    return m

def emit(name, color, strength):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); e = nt.nodes.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = (*color, 1); e.inputs['Strength'].default_value = strength
    nt.links.new(e.outputs[0], out.inputs['Surface'])
    return m

class Mats:
    def __init__(self):
        self.ti = principled('titanium', (0.50, 0.52, 0.55), 1.0, 0.28, aniso=0.55)
        self.ti_dark = principled('titanium-dark', (0.30, 0.31, 0.33), 1.0, 0.34, aniso=0.4)
        self.alu = principled('aluminium', (0.88, 0.89, 0.90), 1.0, 0.12, aniso=0.3)
        self.black = principled('anodised', (0.018, 0.019, 0.021), 0.85, 0.42, coat=0.2)
        self.steel = principled('dark-steel', (0.16, 0.18, 0.20), 1.0, 0.38)
        self.sheath = principled('fibre-sheath', (0.025, 0.026, 0.028), 0.0, 0.32, coat=0.5)
        self.board = principled('board', (0.03, 0.035, 0.04), 0.0, 0.5)
        self.pad = principled('pad', (0.7, 0.72, 0.74), 1.0, 0.25)
        self.glass = thin_glass('smoked-glass')
        self.clear = thin_glass('clear-glass', (0.82, 0.86, 0.9), 0.008)
        self.lens = solid_glass('lens')
        self.core = emit('core', (0.84, 0.93, 1.0), 26)
        self.ice = emit('indicator', (0.57, 0.73, 0.80), 9)
        self.ice_dim = emit('fibre-light', (0.57, 0.73, 0.80), 1.6)
        self.frost = emit('frost', (0.89, 0.91, 0.92), 3)
        self.ink_white = principled('ink-white', (0.80, 0.82, 0.83), 0.0, 0.55)
        self.ink_dark = principled('ink-dark', (0.02, 0.02, 0.022), 0.0, 0.6)
        self.font = bpy.data.fonts.load(FONT_PATH, check_existing=True)

# ---------------------------------------------------------------- geometry

def lathe(name, pts, mat, M, seg=192, closed=True, sharp=32):
    """Spin a (radius, z) profile round local Z. Points on the axis become poles; profile corners sharper than `sharp`
    degrees become hard edges, everything else is smooth."""
    bm = bmesh.new(); n = len(pts); poles = {}
    for k, (r, z) in enumerate(pts):
        if r < 1e-6:
            poles[k] = bm.verts.new((0, 0, z))
    cols = []
    for i in range(seg):
        a = TAU * i / seg; ca, sa = math.cos(a), math.sin(a)
        cols.append([poles[k] if k in poles else bm.verts.new((r * ca, r * sa, z)) for k, (r, z) in enumerate(pts)])
    for i in range(seg):
        j = (i + 1) % seg
        for k in range(n if closed else n - 1):
            k2 = (k + 1) % n
            vs = []
            for v in (cols[i][k], cols[j][k], cols[j][k2], cols[i][k2]):
                if v not in vs: vs.append(v)
            if len(vs) >= 3:
                try:
                    bm.faces.new(vs).smooth = True
                except ValueError:
                    pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    for k in range(n):
        if k in poles or (not closed and k in (0, n - 1)): continue
        p0, p1, p2 = Vector(pts[k - 1]), Vector(pts[k]), Vector(pts[(k + 1) % n])
        d1, d2 = p1 - p0, p2 - p1
        if d1.length < 1e-9 or d2.length < 1e-9: continue
        if math.degrees(d1.angle(d2)) > sharp:
            for i in range(seg):
                e = bm.edges.get((cols[i][k], cols[(i + 1) % seg][k]))
                if e: e.smooth = False
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    if mat: me.materials.append(mat)
    ob = link(bpy.data.objects.new(name, me)); ob.matrix_world = M
    return ob

def ring_pts(ri, ro, z0, z1, c=0.004):
    return [(ri + c, z0), (ro - c, z0), (ro, z0 + c), (ro, z1 - c), (ro - c, z1), (ri + c, z1), (ri, z1 - c), (ri, z0 + c)]

def ring(name, ri, ro, z0, z1, mat, M, c=0.004, seg=256):
    return lathe(name, ring_pts(ri, ro, z0, z1, c), mat, M, seg)

def tube(name, ri, ro, z0, z1, mat, M, seg=160):
    return lathe(name, [(ro, z0), (ro, z1), (ri, z1), (ri, z0)], mat, M, seg, sharp=80)

def sphere(name, r, mat, M, seg=48):
    pts = [(r * math.sin(t), -r * math.cos(t)) for t in [math.pi * i / 24 for i in range(25)]]
    pts[0] = (0, -r); pts[-1] = (0, r)
    return lathe(name, pts, mat, M, seg, closed=False, sharp=90)

def lens(name, R, t, mat, M, edge=0.004, seg=96):
    top = [(R * i / 12, edge + (t - edge) * (1 - (i / 12) ** 2)) for i in range(12, -1, -1)]
    bot = [(R * i / 12, -edge - (t - edge) * (1 - (i / 12) ** 2)) for i in range(0, 13)]
    pts = bot + top
    pts[0] = (0, pts[0][1]); pts[-1] = (0, pts[-1][1])
    return lathe(name, pts, mat, M, seg, closed=False, sharp=40)

def rod(name, p0, p1, r, mat, seg=20):
    p0, p1 = Vector(p0), Vector(p1); d = p1 - p0; L = d.length
    M = Matrix.Translation((p0 + p1) / 2) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    return lathe(name, [(0, -L / 2), (r, -L / 2), (r, L / 2), (0, L / 2)], mat, M, seg)

def box(name, size, mat, M, bevel=0.003):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel:
        try:
            bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=2, affect='EDGES', profile=0.5)
        except Exception:
            pass
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(mat)
    ob = link(bpy.data.objects.new(name, me)); ob.matrix_world = M
    return ob

def arc_band(name, R, d0, d1, width, thick, mat, M, seg=160):
    """A rectangular band swept along an arc in local XY (degrees d0..d1), `width` along local Z."""
    bm = bmesh.new(); prof = [(R - thick / 2, -width / 2), (R + thick / 2, -width / 2), (R + thick / 2, width / 2), (R - thick / 2, width / 2)]
    cols = []
    for i in range(seg + 1):
        a = math.radians(d0 + (d1 - d0) * i / seg); ca, sa = math.cos(a), math.sin(a)
        cols.append([bm.verts.new((r * ca, r * sa, z)) for r, z in prof])
    for i in range(seg):
        for k in range(4):
            f = bm.faces.new([cols[i][k], cols[i + 1][k], cols[i + 1][(k + 1) % 4], cols[i][(k + 1) % 4]]); f.smooth = False
    bm.faces.new(cols[0]); bm.faces.new(list(reversed(cols[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    ob = link(bpy.data.objects.new(name, me)); ob.matrix_world = M
    return ob

def gear(name, r, teeth, thick, depth, mat, M):
    bm = bmesh.new(); pts = []
    for t in range(teeth):
        a0 = TAU * t / teeth; da = TAU / teeth
        for frac, rr in ((0.0, r - depth), (0.20, r - depth), (0.32, r), (0.60, r), (0.72, r - depth)):
            a = a0 + frac * da; pts.append((rr * math.cos(a), rr * math.sin(a)))
    top = [bm.verts.new((x, y, thick / 2)) for x, y in pts]
    bot = [bm.verts.new((x, y, -thick / 2)) for x, y in pts]
    m = len(pts)
    for i in range(m):
        j = (i + 1) % m
        bm.faces.new([bot[i], bot[j], top[j], top[i]])
    bm.faces.new(top); bm.faces.new(list(reversed(bot)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    ob = link(bpy.data.objects.new(name, me)); ob.matrix_world = M
    return ob

def text(name, body, size, mat, M, font):
    cu = bpy.data.curves.new(name, 'FONT'); cu.body = body; cu.font = font; cu.size = size
    cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.extrude = 0.0004
    cu.materials.append(mat)
    ob = link(bpy.data.objects.new(name, cu)); ob.matrix_world = M
    return ob

def numerals_flat(prefix, r, z, M, mat, font, step=30, size=0.034, fmt='{:03d}'):
    for deg in range(0, 360, step):
        a = math.radians(deg)
        L = T(r * math.cos(a), r * math.sin(a), z + 0.0008) @ Matrix.Rotation(a - math.pi / 2, 4, 'Z')
        text(f'{prefix}-{deg}', fmt.format(deg), size, mat, M @ L, font)

def numerals_side(prefix, r, z, M, mat, font, step=30, size=0.026, fmt='{:03d}'):
    for deg in range(0, 360, step):
        a = math.radians(deg)
        rot = Matrix(((-math.sin(a), 0, math.cos(a), 0), (math.cos(a), 0, math.sin(a), 0), (0, 1, 0, 0), (0, 0, 0, 1)))
        L = T((r + 0.0008) * math.cos(a), (r + 0.0008) * math.sin(a), z) @ rot
        text(f'{prefix}-{deg}', fmt.format(deg), size, mat, M @ L, font)

def bezier_pts(p0, p1, p2, p3, n=48):
    out = []
    for i in range(n + 1):
        t = i / n; u = 1 - t
        out.append(p0 * u ** 3 + p1 * 3 * u * u * t + p2 * 3 * u * t * t + p3 * t ** 3)
    return out

def fibre(name, pts, mat, r=0.0045):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
    cu.bevel_depth = r; cu.bevel_resolution = 3; cu.use_fill_caps = True
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (p.x, p.y, p.z, 1)
    sp.use_smooth = True
    cu.materials.append(mat)
    return link(bpy.data.objects.new(name, cu))

def hanging_fibres(prefix, mats, start, socket, count=6, spread=0.03, seed=3):
    """A slack bundle from the instrument's underside to a socket on the floor; two strands carry light."""
    rnd = random.Random(seed)
    for i in range(count):
        o = Vector((rnd.uniform(-spread, spread), rnd.uniform(-spread, spread), 0))
        s = Vector(socket) + Vector((rnd.uniform(-0.05, 0.05), rnd.uniform(-0.05, 0.05), 0))
        p0 = Vector(start) + o
        drop = (p0.z - s.z)
        p1 = p0 + Vector((0, 0, -drop * 0.45))
        p2 = s + Vector((rnd.uniform(-0.25, 0.25) - 0.15, rnd.uniform(-0.3, 0.0) - 0.25, drop * 0.25))
        mat = mats.ice_dim if i in (1, 4) else mats.sheath
        fibre(f'{prefix}-{i}', bezier_pts(p0, p1, p2, s), mat, 0.0042 if mat is mats.sheath else 0.0032)

def floor_socket(mats, at):
    x, y, z = at
    lathe('socket', [(0, z), (0.16, z), (0.16, z + 0.012), (0.14, z + 0.03), (0.06, z + 0.03), (0.05, z + 0.045), (0, z + 0.045)],
          mats.black, T(x, y), 96)
    ring('socket-ring', 0.10, 0.12, z + 0.03, z + 0.036, mats.alu, T(x, y), c=0.001, seg=96)

# ---------------------------------------------------------------- room and light

def room(look):
    nt_mats = []
    fl = bpy.data.materials.new('floor'); fl.use_nodes = True
    nt = fl.node_tree; b = nt.nodes.get('Principled BSDF')
    setin(b, 'Base Color', (0.006, 0.0065, 0.0072, 1)); setin(b, 'Specular IOR Level', 0.12)
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Object'], sep.inputs[0])
    noise = nt.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 1.6
    nt.links.new(tc.outputs['Object'], noise.inputs['Vector'])
    seam = lambda c: _math(nt, 'LESS_THAN', _math(nt, 'ABSOLUTE', _math(nt, 'SUBTRACT', _math(nt, 'FRACT', _math(nt, 'MULTIPLY', c, 1 / 3.2)), 0.5)), 0.0012)
    s = _math(nt, 'MAXIMUM', seam(sep.outputs['X']), seam(sep.outputs['Y']))
    rough = _math(nt, 'MULTIPLY_ADD', noise.outputs['Fac'], 0.25, 0.24)
    nt.links.new(_math(nt, 'MULTIPLY_ADD', s, 0.12, rough), b.inputs['Roughness'])
    pl = bpy.data.meshes.new('floor'); bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=40); bm.to_mesh(pl); bm.free(); pl.materials.append(fl)
    f = link(bpy.data.objects.new('floor', pl)); f.location = (0, 0, FLOOR)

    wm = principled('wall', (0.0045, 0.0048, 0.0055), 0.0, 0.9)
    wl = bpy.data.meshes.new('wall'); bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=40); bm.to_mesh(wl); bm.free(); wl.materials.append(wm)
    w = link(bpy.data.objects.new('wall', wl)); w.location = (0, WALL, FLOOR + 20); w.rotation_euler = (math.radians(90), 0, 0)

    sl = emit('slit', (0.80, 0.86, 0.92), look.get('slit', 5.0))
    slit = box('slit', (0.34, 0.02, 30), sl, T(look.get('slit_x', 3.3), WALL - 0.03, FLOOR + 15), 0)
    slit.visible_shadow = False
    if look.get('haze'):
        vm = bpy.data.materials.new('haze'); vm.use_nodes = True
        nt = vm.node_tree; nt.nodes.clear()
        out = nt.nodes.new('ShaderNodeOutputMaterial'); v = nt.nodes.new('ShaderNodeVolumePrincipled')
        v.inputs['Density'].default_value = look['haze']; v.inputs['Anisotropy'].default_value = 0.55
        v.inputs['Color'].default_value = (0.8, 0.86, 0.92, 1)
        nt.links.new(v.outputs[0], out.inputs['Volume'])
        hb = box('haze', (24, WALL * 2 - 0.2, 12), vm, T(0, 0, FLOOR + 6), 0)
        hb.visible_shadow = False

def area(name, loc, target, size, energy, color=(0.94, 0.97, 1.0), size_y=None, spread=180):
    d = bpy.data.lights.new(name, 'AREA'); d.energy = energy; d.color = color
    if size_y:
        d.shape = 'RECTANGLE'; d.size = size; d.size_y = size_y
    else:
        d.size = size
    try: d.spread = math.radians(spread if size_y is None else 70)
    except Exception: pass
    ob = link(bpy.data.objects.new(name, d)); ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    ob.visible_camera = False
    return ob

def camera(dist, height, target_z, shift_x=-0.14, lens_mm=85, fstop=5.6):
    cd = bpy.data.cameras.new('cam'); cd.lens = lens_mm; cd.sensor_width = 36; cd.shift_x = shift_x
    cd.dof.use_dof = True; cd.dof.aperture_fstop = 2.8
    cam = link(bpy.data.objects.new('cam', cd))
    cam.location = (0, -dist, height)
    tgt = Vector((0, 0, target_z))
    cam.rotation_euler = (tgt - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cd.dof.focus_distance = (tgt - cam.location).length
    bpy.context.scene.camera = cam

def core_light(M, at=(0, 0, 0), energy=4.0):
    d = bpy.data.lights.new('core-light', 'POINT'); d.energy = energy; d.color = (0.84, 0.93, 1.0)
    try: d.shadow_soft_size = 0.02
    except Exception: pass
    ob = link(bpy.data.objects.new('core-light', d)); ob.matrix_world = M @ T(*at)

# ---------------------------------------------------------------- A · Gimbal

def build_gimbal(m, t):
    lerp = lambda a, b: a + (b - a) * t
    Mc = T(0, 0, 0.02) @ Rx(8) @ Rz(18)
    lift = lerp(0.0, 0.30)
    up, dn = Mc @ T(0, 0, lift), Mc @ T(0, 0, -lift)
    # chamber: glass in two halves, caps, tie rods
    tube('glass-top', 0.285, 0.295, 0.0, 0.25, m.glass, up)
    tube('glass-bot', 0.285, 0.295, -0.25, 0.0, m.glass, dn)
    cap = [(0, 0.25), (0.31, 0.25), (0.335, 0.265), (0.335, 0.30), (0.32, 0.315), (0.22, 0.315), (0.21, 0.33), (0.21, 0.37),
           (0.19, 0.385), (0.08, 0.385), (0.07, 0.40), (0, 0.40)]
    lathe('cap-top', cap, m.ti, up)
    lathe('cap-bot', [(r, -z) for r, z in cap], m.ti, dn)
    ring('cap-band-top', 0.30, 0.338, 0.272, 0.292, m.black, up, c=0.002)
    ring('cap-band-bot', 0.30, 0.338, -0.292, -0.272, m.black, dn, c=0.002)
    for i in range(8):
        a = TAU * i / 8 + 0.2
        for sgn, B in ((1, up), (-1, dn)):
            lathe(f'screw-{sgn}-{i}', [(0, 0), (0.011, 0), (0.011, 0.004), (0.008, 0.007), (0, 0.007)], m.alu,
                  B @ T(0.27 * math.cos(a), 0.27 * math.sin(a), sgn * 0.315) @ (Rx(0) if sgn > 0 else Rx(180)), 24)
    gl = [(0, -0.40), (0.05, -0.40), (0.04, -0.46), (0, -0.46)]
    lathe('gland', gl, m.black, dn)
    for sx in (1, -1):
        rod(f'tie-{sx}', Mc @ Vector((sx * 0.315, 0, -0.31 - lift)), Mc @ Vector((sx * 0.315, 0, 0.31 + lift)), 0.011, m.ti_dark)
    # inside: spindle, lenses on holders, gears, core
    rod('spindle', Mc @ Vector((0, 0, -0.25 - lift)), Mc @ Vector((0, 0, 0.25 + lift)), 0.009, m.alu)
    for sgn in (1, -1):
        zl = sgn * lerp(0.11, 0.2)
        L = Mc @ T(0, 0, zl)
        lens(f'lens-{sgn}', 0.165, 0.024, m.lens, L)
        ring(f'holder-{sgn}', 0.165, 0.188, -0.008, 0.008, m.ti, L, c=0.002, seg=128)
        for k in range(3):
            a = TAU * k / 3 + (0.5 if sgn > 0 else 0)
            rod(f'spoke-{sgn}-{k}', L @ Vector((0.012 * math.cos(a), 0.012 * math.sin(a), 0)),
                L @ Vector((0.168 * math.cos(a), 0.168 * math.sin(a), 0)), 0.0035, m.ti)
    gear('gear-1', 0.09, 22, 0.016, 0.012, m.steel, Mc @ T(0, 0, -0.18 - lift * 0.4))
    gear('gear-2', 0.055, 14, 0.016, 0.01, m.ti, Mc @ T(0.138, 0, -0.18 - lift * 0.4) @ Rz(8))
    rod('gear-post', Mc @ Vector((0.138, 0, -0.25 - lift)), Mc @ Vector((0.138, 0, -0.17 - lift * 0.4)), 0.006, m.alu)
    gear('gear-3', 0.07, 18, 0.014, 0.01, m.ti, Mc @ T(0, 0, 0.19 + lift * 0.4) @ Rz(5))
    sphere('core', 0.042, m.core, Mc, 40)
    core_light(Mc, energy=3.0)
    if t > 0.5:
        for k in range(4):
            a = TAU * k / 4 + 0.6
            p0 = Mc @ Vector((0.03 * math.cos(a), 0.03 * math.sin(a), 0))
            p3 = Mc @ Vector((0.30 * math.cos(a), 0.30 * math.sin(a), -0.25 - lift))
            fibre(f'inner-fibre-{k}', bezier_pts(p0, p0 + (p3 - p0) * 0.2 + Vector((0, 0, 0.08)), p3 + Vector((0, 0, 0.25)), p3), m.ice_dim, 0.003)
    # rings on pivots
    a1, a2, a3 = lerp(58, 84), lerp(46, 100), lerp(-22, 30)
    M1 = Mc @ Rx(a1); M2 = M1 @ Ry(a2); M3 = M2 @ Rx(a3)
    r1 = scale_mat('ring-1', (0.86, 0.87, 0.88), 1.0, 0.14, (0.02, 0.02, 0.022), N=180, every=5, mode='r',
                   minor=(0.565, 0.595), major=(0.54, 0.595), w=0.14, wM=0.06, aniso=0.3)
    ring('ring-1', 0.49, 0.60, -0.016, 0.016, r1, M1)
    r2 = scale_mat('ring-2', (0.50, 0.52, 0.55), 1.0, 0.27, (0.02, 0.02, 0.022), N=360, every=10, mode='r',
                   minor=(0.785, 0.815), major=(0.76, 0.815), w=0.16, wM=0.04, aniso=0.55)
    ring('ring-2', 0.68, 0.82, -0.018, 0.018, r2, M2)
    numerals_flat('n2', 0.72, 0.018, M2, m.ink_dark, m.font, 30, 0.032)
    r3 = scale_mat('ring-3', (0.018, 0.019, 0.021), 0.85, 0.42, (0.80, 0.82, 0.83), N=360, every=10, mode='r',
                   minor=(1.04, 1.074), major=(1.012, 1.074), w=0.18, wM=0.05, coat=0.2)
    ring('ring-3', 0.90, 1.08, -0.022, 0.022, r3, M3, c=0.005)
    numerals_flat('n3', 0.95, 0.022, M3, m.ink_white, m.font, 30, 0.04)
    for i, deg in enumerate((0, 120, 240)):
        a = math.radians(deg + 7)
        sphere(f'cal-{i}', 0.0065, m.ice, M2 @ T(0.745 * math.cos(a), 0.745 * math.sin(a), 0.015), 16)
    # pivots: chamber->1 on X, 1->2 on Y of ring 1, 2->3 on X of ring 2
    for sx in (1, -1):
        rod(f'pin-c1-{sx}', Mc @ Vector((sx * 0.326, 0, 0)), Mc @ Vector((sx * 0.52, 0, 0)), 0.009, m.alu)
        lathe(f'boss-1-{sx}', [(0, -0.02), (0.024, -0.02), (0.024, 0.02), (0, 0.02)], m.ti, M1 @ T(sx * 0.505, 0, 0) @ Ry(90), 32)
        rod(f'pin-12-{sx}', M1 @ Vector((0, sx * 0.595, 0)), M1 @ Vector((0, sx * 0.70, 0)), 0.009, m.alu)
        lathe(f'boss-2-{sx}', [(0, -0.022), (0.026, -0.022), (0.026, 0.022), (0, 0.022)], m.black, M1 @ T(0, sx * 0.695, 0) @ Rx(90), 32)
        rod(f'pin-23-{sx}', M2 @ Vector((sx * 0.815, 0, 0)), M2 @ Vector((sx * 0.92, 0, 0)), 0.01, m.alu)
        lathe(f'boss-3-{sx}', [(0, -0.026), (0.03, -0.026), (0.03, 0.026), (0, 0.026)], m.ti, M2 @ T(sx * 0.91, 0, 0) @ Ry(90), 32)
    # reader carriage on the outer ring
    a = math.radians(62)
    C = M3 @ T(0.99 * math.cos(a), 0.99 * math.sin(a), 0) @ Rz(62)
    box('carriage', (0.16, 0.05, 0.07), m.alu, C, 0.004)
    box('carriage-face', (0.05, 0.052, 0.072), m.black, C @ T(0.03, 0, 0), 0.002)
    sphere('carriage-led', 0.006, m.ice, C @ T(0.03, 0, 0.037), 16)
    text('carriage-label', 'OBS-01', 0.014, m.ink_dark, C @ T(-0.035, 0, 0.0355), m.font)
    # fibres to the floor
    return dict(dist=lerp(12.2, 13.2), height=0.6, target=lerp(0.0, 0.0))

# ---------------------------------------------------------------- B · Frame

def build_frame(m, t):
    lerp = lambda a, b: a + (b - a) * t
    MF = T(0, 0, 0.05) @ Rz(-28) @ Rx(3)
    g = lerp(0.0, 0.32)                     # how far the four bars pull apart
    h = 0.95                                # frame half size (bar centre lines)
    bars = (('top', (0, 0, h + g), (2 * h + 0.1, 0.13, 0.1)), ('bottom', (0, 0, -h - g), (2 * h + 0.1, 0.13, 0.1)),
            ('left', (-h - g, 0, 0), (0.1, 0.13, 2 * h - 0.1)), ('right', (h + g, 0, 0), (0.1, 0.13, 2 * h - 0.1)))
    for name, at, size in bars:
        box(f'bar-{name}', size, m.ti, MF @ T(*at), 0.006)
        box(f'bar-{name}-inlay', (size[0] - 0.02 if size[0] > 0.2 else 0.04, 0.01, size[2] - 0.02 if size[2] > 0.2 else 0.04),
            m.black, MF @ T(at[0], -0.066, at[2]), 0.001)
    for sx in (1, -1):
        for sz in (1, -1):
            cx, cz = sx * (h + g * (1 if t > 0.5 else 0)), sz * (h + g * (1 if t > 0.5 else 0))
            C = MF @ T(cx, 0, cz)
            box(f'corner-{sx}{sz}', (0.17, 0.15, 0.17), m.black, C, 0.008)
            for k in (-1, 1):
                lathe(f'corner-screw-{sx}{sz}{k}', [(0, 0), (0.012, 0), (0.012, 0.004), (0.009, 0.007), (0, 0.007)], m.alu,
                      C @ T(0.04 * k, -0.075, 0.04 * k) @ Rx(90), 24)
    # a ruler engraved down the right bar, and the instrument's mark on the bottom bar
    R = MF @ T(h + g, -0.071, 0)
    for i in range(-20, 21):
        major = i % 5 == 0
        box(f'tick-{i}', (0.035 if major else 0.018, 0.002, 0.004), m.ink_white, R @ T(-0.05 + (0.0175 if major else 0.026), 0, i * 0.04), 0)
    text('mark', 'OBS-01', 0.034, m.ink_white, MF @ T(-0.62, -0.071, -h - g) @ Rx(90), m.font)
    text('mark-2', '0.000', 0.026, m.ink_white, MF @ T(0.62, -0.071, -h - g) @ Rx(90), m.font)
    # outer scale ring in the frame plane, on four spokes
    MO = MF @ Rz(lerp(0, 38)) @ Rx(90)
    so = scale_mat('ring-outer', (0.018, 0.019, 0.021), 0.85, 0.42, (0.80, 0.82, 0.83), N=360, every=10, mode='r',
                   minor=(0.69, 0.725), major=(0.665, 0.725), w=0.18, wM=0.05, coat=0.2)
    ring('ring-outer', 0.58, 0.74, -0.03, 0.03, so, MO, c=0.005)
    numerals_flat('no', 0.62, 0.03, MO, m.ink_white, m.font, 30, 0.032)
    for i, deg in enumerate((45, 225)):
        a = math.radians(deg)
        sphere(f'cal-{i}', 0.008, m.ice, MO @ T(0.60 * math.cos(a), 0.60 * math.sin(a), 0.03), 16)
    for k, (dx, dz) in enumerate(((1, 0), (-1, 0), (0, 1), (0, -1))):
        if t < 0.5:
            rod(f'spoke-{k}', MF @ Vector((0.74 * dx, 0, 0.74 * dz)), MF @ Vector(((h - 0.05) * dx, 0, (h - 0.05) * dz)), 0.012, m.alu)
            lathe(f'spoke-boss-{k}', [(0, -0.03), (0.026, -0.03), (0.026, 0.03), (0, 0.03)], m.ti,
                  MF @ T(0.86 * dx, 0, 0.86 * dz) @ (Ry(90) if dx else Matrix.Identity(4)), 32)
    # inner ring, turned out of the plane on a vertical pivot
    MI = MF @ Rz(lerp(38, 104)) @ Rx(90)
    si = scale_mat('ring-inner', (0.86, 0.87, 0.88), 1.0, 0.14, (0.02, 0.02, 0.022), N=180, every=5, mode='r',
                   minor=(0.45, 0.475), major=(0.43, 0.475), w=0.14, wM=0.06, aniso=0.3)
    ring('ring-inner', 0.38, 0.48, -0.018, 0.018, si, MI)
    for sz in (1, -1):
        rod(f'pivot-{sz}', MF @ Vector((0, 0, sz * 0.47)), MF @ Vector((0, 0, sz * 0.6)), 0.009, m.alu)
    # the chamber, hung on four wires from the frame's inner corners
    lift = lerp(0.0, 0.16)
    Mc = MF
    tube('glass-top', 0.128, 0.136, 0.0, 0.2, m.glass, Mc @ T(0, 0, lift))
    tube('glass-bot', 0.128, 0.136, -0.2, 0.0, m.glass, Mc @ T(0, 0, -lift))
    cap = [(0, 0.2), (0.15, 0.2), (0.16, 0.21), (0.16, 0.25), (0.15, 0.26), (0.08, 0.26), (0.07, 0.29), (0, 0.29)]
    lathe('cap-top', cap, m.ti, Mc @ T(0, 0, lift), 96)
    lathe('cap-bot', [(r, -z) for r, z in cap], m.ti, Mc @ T(0, 0, -lift), 96)
    ring('cap-band-top', 0.14, 0.163, 0.222, 0.238, m.black, Mc @ T(0, 0, lift), c=0.0015, seg=96)
    ring('cap-band-bot', 0.14, 0.163, -0.238, -0.222, m.black, Mc @ T(0, 0, -lift), c=0.0015, seg=96)
    rod('spindle', Mc @ Vector((0, 0, -0.2 - lift)), Mc @ Vector((0, 0, 0.2 + lift)), 0.006, m.alu)
    sphere('core', 0.034, m.core, Mc, 40)
    core_light(Mc, energy=2.5)
    for sz in (1, -1):
        L = Mc @ T(0, 0, sz * lerp(0.09, 0.13))
        lens(f'lens-{sz}', 0.1, 0.016, m.lens, L)
        ring(f'holder-{sz}', 0.1, 0.116, -0.006, 0.006, m.ti, L, c=0.0015, seg=96)
    gear('gear', 0.06, 16, 0.012, 0.009, m.ti, Mc @ T(0, 0, -0.15 - lift * 0.5))
    hi = h - 0.05 + (g if t > 0.5 else 0)
    for sx in (1, -1):
        for sz in (1, -1):
            rod(f'wire-{sx}{sz}', Mc @ Vector((0.05 * sx, 0, sz * (0.285 + lift))), MF @ Vector((sx * hi, 0, sz * hi)), 0.0022, m.alu)
    for k, x in enumerate((-0.32, 0.0, 0.3)):
        p0 = Mc @ Vector((0.02 * (k - 1), 0, -0.29 - lift))
        p3 = MF @ Vector((x, 0, -h - g + 0.05))
        fibre(f'fibre-{k}', bezier_pts(p0, p0 + Vector((0, 0, -0.25)), p3 + Vector((0, 0, 0.3)), p3), m.ice_dim if k == 1 else m.sheath, 0.0034)
    return dict(dist=lerp(12.6, 16.0), height=lerp(0.7, 0.9), target=lerp(0.0, 0.0))

# ---------------------------------------------------------------- C · Plate

def build_plate(m, t):
    lerp = lambda a, b: a + (b - a) * t
    Mp = T(0, 0, 0.1) @ Ry(-8) @ Rx(22) @ Rz(12)
    up = lambda k: Mp @ T(0, 0, k * lerp(0.0, 1.0))
    lathe('base', [(0, -0.17), (0.94, -0.17), (1.0, -0.12), (1.0, -0.06), (0, -0.06)], m.black, up(-0.12), 192)
    # revealed under the rings when open
    if t > 0.5:
        gear('ring-gear', 0.86, 120, 0.02, 0.018, m.steel, up(-0.05) @ T(0, 0, -0.035))
        lathe('board', [(0.1, -0.05), (0.80, -0.05), (0.80, -0.04), (0.1, -0.04)], m.board, up(-0.05), 160)
        rnd = random.Random(11)
        for k in range(40):
            a = rnd.uniform(0, TAU); r = rnd.uniform(0.18, 0.74)
            sz = (rnd.uniform(0.025, 0.07), rnd.uniform(0.018, 0.045), rnd.uniform(0.006, 0.02))
            box(f'chip-{k}', sz, m.black if k % 3 else m.pad, up(-0.05) @ T(r * math.cos(a), r * math.sin(a), -0.04 + sz[2] / 2) @ Rz(math.degrees(a)), 0.001)
    r4 = scale_mat('ring-4', (0.86, 0.87, 0.88), 1.0, 0.16, (0.86, 0.87, 0.88), knurl=600, knurl_band=(1.295, 1.31), aniso=0.3)
    ring('ring-4', 1.12, 1.30, -0.10, 0.0, r4, up(0.0) @ Rz(lerp(0, -12)), c=0.005, seg=320)
    r3 = scale_mat('ring-3', (0.018, 0.019, 0.021), 0.85, 0.42, (0.80, 0.82, 0.83), N=360, every=10, mode='r',
                   minor=(1.062, 1.092), major=(1.036, 1.092), w=0.18, wM=0.05, coat=0.2)
    R3 = up(0.16) @ Rz(lerp(0, 25))
    ring('ring-3', 0.86, 1.10, -0.06, 0.025, r3, R3, c=0.005, seg=320)
    numerals_flat('n3', 0.975, 0.025, R3, m.ink_white, m.font, 30, 0.036)
    for i, deg in enumerate((15, 135, 255)):
        a = math.radians(deg)
        sphere(f'cal-{i}', 0.008, m.ice, R3 @ T(0.895 * math.cos(a), 0.895 * math.sin(a), 0.025), 16)
    r2 = scale_mat('ring-2', (0.50, 0.52, 0.55), 1.0, 0.27, (0.02, 0.02, 0.022), N=360, every=5, mode='r',
                   minor=(0.80, 0.832), major=(0.78, 0.832), w=0.16, wM=0.07, aniso=0.55)
    R2 = up(0.32) @ Rz(lerp(0, -38))
    ring('ring-2', 0.64, 0.84, -0.06, 0.05, r2, R2, c=0.005)
    numerals_flat('n2', 0.725, 0.05, R2, m.ink_dark, m.font, 45, 0.03)
    r1 = scale_mat('ring-1', (0.018, 0.019, 0.021), 0.85, 0.42, (0.80, 0.82, 0.83), N=360, every=10, mode='r',
                   minor=(0.588, 0.612), major=(0.566, 0.612), w=0.16, wM=0.05, coat=0.2)
    R1 = up(0.48) @ Rz(lerp(0, 60))
    ring('ring-1', 0.44, 0.62, -0.06, 0.08, r1, R1)
    numerals_flat('n1', 0.505, 0.08, R1, m.ink_white, m.font, 30, 0.026)
    R0 = up(0.64)
    ring('ring-0', 0.30, 0.42, -0.06, 0.12, m.alu, R0, c=0.005)
    for i in range(12):
        a = TAU * i / 12
        lathe(f'screw-{i}', [(0, 0), (0.011, 0), (0.011, 0.004), (0.008, 0.007), (0, 0.007)], m.ti, R0 @ T(0.36 * math.cos(a), 0.36 * math.sin(a), 0.12), 24)
    D = up(lerp(0.64, 1.2))
    shell = [(0.28 * math.cos(u), 0.12 + 0.28 * math.sin(u)) for u in [math.pi / 2 * i / 20 for i in range(21)]]
    inner = [(0.273 * math.cos(u), 0.12 + 0.273 * math.sin(u)) for u in [math.pi / 2 * i / 20 for i in range(20, -1, -1)]]
    shell[-1] = (0, 0.40); inner[0] = (0, 0.393)
    lathe('dome', shell + inner, m.clear, D, 128)
    ring('dome-seat', 0.27, 0.30, 0.10, 0.125, m.black, D, c=0.002)
    C = up(lerp(0.64, 0.95))
    sphere('core', 0.045, m.core, C @ T(0, 0, 0.21), 40)
    core_light(C, (0, 0, 0.21), 3.5)
    gear('dome-gear', 0.25, 54, 0.012, 0.01, m.ti, C @ T(0, 0, 0.135))
    for k, (zz, rr) in enumerate(((0.16, 0.2), (0.27, 0.15), (0.33, 0.09))):
        lens(f'lens-{k}', rr, 0.016, m.lens, C @ T(0, 0, zz + (0.06 * k if t > 0.5 else 0)))
        ring(f'lens-holder-{k}', rr, rr + 0.018, -0.006, 0.006, m.ti, C @ T(0, 0, zz + (0.06 * k if t > 0.5 else 0)), c=0.0015, seg=128)
    rod('lens-post', C @ Vector((0, 0, 0.135)), C @ Vector((0, 0, 0.36 + (0.12 if t > 0.5 else 0))), 0.006, m.alu)
    # the scanning arc: a quarter-circle goniometer rising from the rim to over the centre, a carriage on it aims at the core
    B = up(0.0) @ Rz(lerp(150, 128)) @ Rx(90)
    ac = scale_mat('arc', (0.50, 0.52, 0.55), 1.0, 0.27, (0.02, 0.02, 0.022), N=360, every=5, mode='r',
                   minor=(1.215, 1.235), major=(1.205, 1.235), w=0.18, wM=0.08, aniso=0.5)
    arc_band('arc', 1.22, 4, 92, 0.05, 0.035, ac, B)
    box('arc-foot', (0.12, 0.08, 0.1), m.black, B @ T(1.22, 0.02, 0), 0.005)
    th = math.radians(lerp(58, 74))
    K = B @ T(1.22 * math.cos(th), 1.22 * math.sin(th), 0) @ Rz(math.degrees(th))
    box('carriage', (0.06, 0.12, 0.11), m.alu, K, 0.006)
    box('carriage-face', (0.062, 0.05, 0.112), m.black, K @ T(0, 0.03, 0), 0.002)
    sphere('carriage-led', 0.007, m.ice, K @ T(0.0, 0.03, -0.057), 16)
    rod('probe', K @ Vector((-0.03, 0, 0)), K @ Vector((-0.32, 0, 0)), 0.006, m.alu)
    sphere('probe-tip', 0.009, m.ice, K @ T(-0.32, 0, 0), 16)
    p0 = K @ Vector((0.03, -0.03, 0.0))
    p3 = D @ Vector((0.29 * math.cos(2.6), 0.29 * math.sin(2.6), 0.12))
    fibre('arc-fibre', bezier_pts(p0, p0 + (B.to_3x3() @ Vector((0.25, 0, 0))), p3 + Vector((0, 0, 0.3)), p3), m.ice_dim, 0.003)
    return dict(dist=lerp(14.2, 16.4), height=lerp(2.6, 2.9), target=lerp(0.05, 0.35), shift=-0.175)

# ---------------------------------------------------------------- lights per design

LOOKS = {
    'a': dict(slit=0.16, slit_x=1.9, haze=0.0011, lights=[
        ('key', (-3.5, -6.5, 6.5), (0, 0, 0), 3.0, 900, (0.92, 0.96, 1.0), None),
        ('wash', (3.5, 2.0, 5.5), (2.6, WALL, -0.5), 1.5, 70, (0.85, 0.9, 1.0), None),
        ('rim-r', (3.2, 3.0, 1.2), (0, 0, 0), 0.4, 700, (0.85, 0.92, 1.0), 2.6),
        ('rim-l', (-4.6, 3.4, 1.4), (0, 0, 0), 0.4, 420, (1.0, 1.0, 1.0), 2.6),
        ('top', (0, 0.5, 6.0), (0, 0, 0), 6.0, 260, (1.0, 1.0, 1.0), None)]),
    'b': dict(slit=0.16, slit_x=2.0, haze=0.0011, lights=[
        ('wash', (3.5, 2.0, 5.5), (2.6, WALL, -0.5), 1.5, 60, (0.85, 0.9, 1.0), None),
        ('top', (0.6, -0.8, 6.5), (0, 0, 0), 1.8, 1500, (1.0, 0.99, 0.97), None),
        ('rim-r', (3.0, 3.2, 1.2), (0, 0, 0), 0.35, 650, (0.85, 0.92, 1.0), 2.8),
        ('rim-l', (-4.6, 3.0, 1.4), (0, 0, 0), 0.35, 520, (1.0, 1.0, 1.0), 2.8),
        ('fill', (-4.0, -7.0, 1.0), (0, 0, 0), 4.0, 140, (0.9, 0.95, 1.0), None)]),
    'c': dict(slit=0.16, slit_x=2.1, haze=0.0011, lights=[
        ('wash', (3.5, 2.0, 5.5), (2.6, WALL, -0.5), 1.5, 70, (0.85, 0.9, 1.0), None),
        ('rake', (6.5, -1.4, 1.6), (0, 0, 0), 1.0, 1300, (1.0, 0.98, 0.95), 3.0),
        ('rim-l', (-4.6, 3.2, 1.6), (0, 0, 0), 0.4, 600, (0.85, 0.92, 1.0), 2.6),
        ('top', (-1.0, -0.5, 6.5), (0, 0, 0), 5.0, 380, (1.0, 1.0, 1.0), None),
        ('fill', (-5.0, -6.0, 2.0), (0, 0, 0), 4.0, 90, (0.9, 0.95, 1.0), None)]),
}
BUILD = {'a': build_gimbal, 'b': build_frame, 'c': build_plate}

def render(key, state):
    s = fresh(); m = Mats(); look = LOOKS[key]
    room(look)
    for name, loc, tgt, size, energy, color, size_y in look['lights']:
        area(name, loc, tgt, size, energy, color, size_y)
    cam = BUILD[key](m, 1.0 if state == 'open' else 0.0)
    camera(cam['dist'], cam['height'], cam['target'], cam.get('shift', -0.14))
    s.render.filepath = os.path.join(OUT, f'obs-{key}-{state}.jpg')
    bpy.ops.render.render(write_still=True)
    print('wrote', s.render.filepath)

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for job in (ONLY or [f'{k}-{st}' for k in 'abc' for st in ('closed', 'open')]):
        k, st = job.split('-')
        render(k, st)
