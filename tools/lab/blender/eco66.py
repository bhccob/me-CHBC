# LAB ONLY (throwaway). Round 66: Bob's "Digital Ecosystem" brief (2026-11-13), phase 1: three visual interpretations
# of the ecosystem in the brief's colours (obsidian, deep purple, royal violet, electric purple, soft white, muted grey,
# electric yellow used sparingly). No brain, planet, robot, body or city; no single object on a pedestal.
# Three frames each: 1 first view, 2 Digital Systems (the work), 3 the Horizon (ending).
#   overlap: three colossal structures, one per discipline, cross in a violet haze; where they meet, the core (About).
#   fold:    an endless floor of ceramic tiles, black on top and white beneath, that lifts and folds into every zone.
#   weight:  the ecosystem is one hanging mobile; every zone balances the others.
#   blender -b --factory-startup --python tools/lab/blender/eco66.py -- <out-dir> [overlap-1,fold-2,...] [samples] [res%]
# Project pictures come from round 65's textures (proof-out/lab/mock/ideas65/tex). Blender is Z up.
import bpy, bmesh, math, sys, os, random
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import instrument64 as K
import ideas65 as I
from instrument64 import Rx, Ry, Rz, T, link, principled, emit, setin, _math, _sock, TAU

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else '.')
ONLY = argv[1].split(',') if len(argv) > 1 and argv[1] else None
TEX = os.path.abspath('proof-out/lab/mock/ideas65/tex')

def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

OBS, DEEP, DPUR, VIOLET = srgb('#09080D'), srgb('#111015'), srgb('#21132F'), srgb('#512B78')
EPUR, WHITE, GREY, YEL = srgb('#8B5CF6'), srgb('#F4F1F7'), srgb('#A5A0AA'), srgb('#E8F14A')
def mul(c, k): return tuple(x * k for x in c)
def S(x, y=None, z=None): return Matrix.Diagonal((x, x if y is None else y, x if z is None else z, 1.0))

# ---------------------------------------------------------------- scene, sky, lights

def scene():
    s = K.fresh()
    s.cycles.transmission_bounces = 8
    s.cycles.volume_bounces = 1
    for k, v in (('volume_step_rate', 1.5),):
        try: setattr(s.cycles, k, v)
        except Exception: pass
    return s

def sky(top, horizon, strength=1.0, band=0.22):
    nt = bpy.context.scene.world.node_tree; bg = nt.nodes['Background']
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 0.0; mr.inputs['From Max'].default_value = band
    nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
    ease = _math(nt, 'POWER', mr.outputs['Result'], 0.6)
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'
    nt.links.new(ease, _sock(mx, 'Factor_Float'))
    _sock(mx, 'A_Color').default_value = (*horizon, 1); _sock(mx, 'B_Color').default_value = (*top, 1)
    nt.links.new(_sock(mx, 'Result_Color', True), bg.inputs['Color'])
    bg.inputs['Strength'].default_value = strength

def sun(az, el, energy, color, angle=1.5):
    d = bpy.data.lights.new('sun', 'SUN'); d.energy = energy; d.color = color; d.angle = math.radians(angle)
    ob = link(bpy.data.objects.new('sun', d))
    a, e = math.radians(az), math.radians(el)
    to_light = Vector((math.sin(a) * math.cos(e), math.cos(a) * math.cos(e), math.sin(e)))
    ob.rotation_euler = (-to_light).to_track_quat('-Z', 'Y').to_euler()
    return ob

GLOW = (0.42, 0.16, 0.95)

def fog(density, color=(0.74, 0.52, 1.0), anisotropy=0.45):
    """Haze in the world itself. (A haze box with the camera inside renders as no haze at all in Blender 5.3, and its
    far face shows as a hard dark shape.) The sky behind is hidden by it, so the glow comes from lights in the haze."""
    nt = bpy.context.scene.world.node_tree
    v = nt.nodes.new('ShaderNodeVolumePrincipled'); v.inputs['Density'].default_value = density
    v.inputs['Color'].default_value = (*color, 1); v.inputs['Anisotropy'].default_value = anisotropy
    nt.links.new(v.outputs[0], nt.nodes['World Output'].inputs['Volume'])

def spot(name, loc, target, power, color, size=30, blend=0.6, radius=1.0):
    d = bpy.data.lights.new(name, 'SPOT'); d.energy = power; d.color = color
    d.spot_size = math.radians(size); d.spot_blend = blend; d.shadow_soft_size = radius
    ob = link(bpy.data.objects.new(name, d)); ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return ob

def point(name, loc, power, color, radius=0.3):
    d = bpy.data.lights.new(name, 'POINT'); d.energy = power; d.color = color; d.shadow_soft_size = radius
    ob = link(bpy.data.objects.new(name, d)); ob.location = loc
    return ob

# ---------------------------------------------------------------- materials

def glassy(name, tint, rough=0.05, blend=0.22):
    """Architectural glass without refraction: tinted see-through plus a Fresnel reflection (clean and quick in haze)."""
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); tr.inputs['Color'].default_value = (*tint, 1)
    gl = nt.nodes.new('ShaderNodeBsdfGlossy'); gl.inputs['Roughness'].default_value = rough
    lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = blend
    mx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(lw.outputs['Fresnel'], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(gl.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], out.inputs['Surface'])
    return m

def frosted(name, tint, see=0.4, rough=0.3):
    """Frosted acrylic: light scatters through it (translucent), part of what is behind shows, a soft sheen on top."""
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    tl = nt.nodes.new('ShaderNodeBsdfTranslucent'); tl.inputs['Color'].default_value = (*tint, 1)
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); tr.inputs['Color'].default_value = (*tint, 1)
    gl = nt.nodes.new('ShaderNodeBsdfGlossy'); gl.inputs['Roughness'].default_value = rough
    m1 = nt.nodes.new('ShaderNodeMixShader'); m1.inputs[0].default_value = see
    nt.links.new(tl.outputs[0], m1.inputs[1]); nt.links.new(tr.outputs[0], m1.inputs[2])
    lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.3
    m2 = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(lw.outputs['Fresnel'], m2.inputs[0]); nt.links.new(m1.outputs[0], m2.inputs[1]); nt.links.new(gl.outputs[0], m2.inputs[2])
    nt.links.new(m2.outputs[0], out.inputs['Surface'])
    return m

def bevelled(m, radius=0.012):
    nt = m.node_tree; b = nt.nodes.get('Principled BSDF')
    bv = nt.nodes.new('ShaderNodeBevel'); bv.inputs['Radius'].default_value = radius
    try: bv.samples = 6
    except Exception: pass
    nt.links.new(bv.outputs['Normal'], b.inputs['Normal'])
    return m

def ground(name, base, rough=0.22, var=0.12):
    m = principled(name, base, 0.0, rough, spec=0.5); nt = m.node_tree; b = nt.nodes.get('Principled BSDF')
    tc = nt.nodes.new('ShaderNodeTexCoord'); nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 0.08
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    nt.links.new(_math(nt, 'MULTIPLY_ADD', nz.outputs['Fac'], var * 2, rough - var), b.inputs['Roughness'])
    return m

def grid_glow(name, base, color, strength, pitch, width, offset=0.0):
    """A dark surface whose lines on a square grid glow (the substrate under the tiles)."""
    m = principled(name, base, 0.0, 0.6); nt = m.node_tree; b = nt.nodes.get('Principled BSDF')
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Object'], sep.inputs[0])
    def line(c):
        f = _math(nt, 'FRACT', _math(nt, 'ADD', _math(nt, 'MULTIPLY', c, 1 / pitch), offset))
        return _math(nt, 'LESS_THAN', _math(nt, 'ABSOLUTE', _math(nt, 'SUBTRACT', f, 0.5)), width / pitch / 2)
    g = _math(nt, 'MAXIMUM', line(sep.outputs['X']), line(sep.outputs['Y']))
    setin(b, 'Emission Color', (*color, 1))
    nt.links.new(_math(nt, 'MULTIPLY', g, strength), b.inputs['Emission Strength'])
    return m

def bricks(name, top, gap, pitch):
    """Far floor: the same tiles as a texture (beyond the modelled ones)."""
    m = principled(name, top, 0.0, 0.42, spec=0.5); nt = m.node_tree; b = nt.nodes.get('Principled BSDF')
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Object'], sep.inputs[0])
    def line(c):
        f = _math(nt, 'FRACT', _math(nt, 'MULTIPLY', c, 1 / pitch))
        return _math(nt, 'LESS_THAN', _math(nt, 'ABSOLUTE', _math(nt, 'SUBTRACT', f, 0.5)), 0.03)
    g = _math(nt, 'MAXIMUM', line(sep.outputs['X']), line(sep.outputs['Y']))
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'
    nt.links.new(g, _sock(mx, 'Factor_Float'))
    _sock(mx, 'A_Color').default_value = (*top, 1); _sock(mx, 'B_Color').default_value = (*gap, 1)
    nt.links.new(_sock(mx, 'Result_Color', True), b.inputs['Base Color'])
    return m

def picture(name, file, strength=1.0):
    return I.image_mat(name, os.path.join(TEX, file), strength)

# ---------------------------------------------------------------- one mesh, many parts

class B:
    def __init__(self, name, mats):
        self.name = name; self.mats = list(mats); self.bm = bmesh.new(); self.uv = self.bm.loops.layers.uv.new('UVMap')
    def _faces(self, verts, mi, smooth=False):
        for f in {f for v in verts for f in v.link_faces}:
            f.material_index = mi; f.smooth = smooth
    def box(self, M, mi=0):
        r = bmesh.ops.create_cube(self.bm, size=1.0, matrix=M); self._faces(r['verts'], mi)
    def rod(self, p0, p1, r, mi=0, seg=10):
        p0, p1 = Vector(p0), Vector(p1); d = p1 - p0; L = d.length
        if L < 1e-6: return
        M = Matrix.Translation((p0 + p1) / 2) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        res = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r, depth=L, matrix=M)
        self._faces(res['verts'], mi, True)
    def tile(self, M, w, h, t, top, bot, side, uv_top=None, uv_bot=None):
        """A box tile with its own faces: top (+Z), bottom (-Z), sides. uv_*(a, b) -> (u, v) for corner (a, b) in 0/1."""
        xs, ys, zs = (-w / 2, w / 2), (-h / 2, h / 2), (-t / 2, t / 2)
        v = {(a, b, c): self.bm.verts.new(M @ Vector((xs[a], ys[b], zs[c]))) for a in (0, 1) for b in (0, 1) for c in (0, 1)}
        F = self.bm.faces.new
        ft = F((v[0, 0, 1], v[1, 0, 1], v[1, 1, 1], v[0, 1, 1])); ft.material_index = top
        fb = F((v[0, 0, 0], v[0, 1, 0], v[1, 1, 0], v[1, 0, 0])); fb.material_index = bot
        for f in (F((v[0, 0, 0], v[1, 0, 0], v[1, 0, 1], v[0, 0, 1])), F((v[1, 0, 0], v[1, 1, 0], v[1, 1, 1], v[1, 0, 1])),
                  F((v[1, 1, 0], v[0, 1, 0], v[0, 1, 1], v[1, 1, 1])), F((v[0, 1, 0], v[0, 0, 0], v[0, 0, 1], v[0, 1, 1]))):
            f.material_index = side
        if uv_top:
            for loop, ab in zip(ft.loops, ((0, 0), (1, 0), (1, 1), (0, 1))): loop[self.uv].uv = uv_top(*ab)
        if uv_bot:
            for loop, ab in zip(fb.loops, ((0, 0), (0, 1), (1, 1), (1, 0))): loop[self.uv].uv = uv_bot(*ab)
    def done(self, M=None):
        me = bpy.data.meshes.new(self.name); self.bm.to_mesh(me); self.bm.free()
        for m in self.mats: me.materials.append(m)
        ob = link(bpy.data.objects.new(self.name, me))
        if M is not None: ob.matrix_world = M
        return ob

def floor_plane(name, mat, size=4000, z=0.0, M=None):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=size / 2); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    ob = link(bpy.data.objects.new(name, me)); ob.matrix_world = M if M is not None else T(0, 0, z)
    return ob

def facing(pos, look_at, up=(0, 0, 1)):
    """A matrix at `pos` whose local +Z faces `look_at` and local +Y is as close to `up` as it can be."""
    z = (Vector(look_at) - Vector(pos)).normalized(); x = Vector(up).cross(z).normalized(); y = z.cross(x)
    R = Matrix((x, y, z)).transposed().to_4x4()
    return T(*pos) @ R

def outline(b, M, w, h, t, mi):
    """A thin lit frame round a w x h rectangle in M's XY plane."""
    for (cx, cy, sx, sy) in ((0, h / 2 + t / 2, w + 2 * t, t), (0, -h / 2 - t / 2, w + 2 * t, t), (w / 2 + t / 2, 0, t, h), (-w / 2 - t / 2, 0, t, h)):
        b.box(M @ T(cx, cy, 0.01) @ S(sx, sy, t * 0.6), mi)

import json
OV = dict(fog=0.0018, behind=2.5e6, key=2.5e5, rim=1.2e5, fog3=0.00045, far=8e7, key3=1.5e5)
WT = dict(fog=0.0018, top=4e5, behind=1.2e6, side=4e4, fog3=0.0009, far=2e7)
OV.update(json.loads(os.environ.get('OV', '{}'))); WT.update(json.loads(os.environ.get('WT', '{}')))

WORKS = (('jontai.png', 1440 / 810, 'Jontai Energy'), ('lumo.png', 540 / 1050, 'Lumo'), ('cookies.png', 1440 / 900, 'Cookies Clicker'))

# ================================================================ 1 · OVERLAP

C = Vector((0, 0, 20))
M_DIG = T(*C) @ Rz(-22) @ Ry(-6)            # local X: the digital lattice's long axis
M_SEC = T(C.x, C.y, 0)                      # local Z: the protected shells stand up from the ground
M_PHY = T(*C) @ Rz(38) @ Ry(-30)            # local X: the physical truss, rising to the back left

def overlap_mats():
    return dict(
        smoked=glassy('smoked', (0.42, 0.38, 0.52), 0.05),
        frost=frosted('frost', (0.78, 0.70, 0.96), see=0.42),
        alu=principled('alu-dark', (0.30, 0.29, 0.33), 1.0, 0.32, aniso=0.6),
        ti=principled('titanium', (0.62, 0.60, 0.66), 1.0, 0.14, aniso=0.3),
        frame=principled('frame', (0.05, 0.045, 0.06), 0.9, 0.35),
        yel=emit('yellow', YEL, 18.0),
        vio=emit('violet', EPUR, 2.5),
        ground=ground('ground', mul(DEEP, 0.55), 0.2))

def lattice(m, M, length=240, size=9.0, cell=3.0, rnd=None, holes=(), name='digital'):
    """The digital structure: a modular lattice of frames, rails and smoked-glass panes, a few data lines inside."""
    rnd = rnd or random.Random(66)
    b = B(name, [m['frame'], m['smoked'], m['yel'], m['vio']])
    h = size / 2; n = int(length / cell); x0 = -length / 2; bar, rail = 0.14, 0.07
    for k in range(n + 1):
        x = x0 + k * cell
        for c, s in (((x, 0, h), (bar, size + bar, bar)), ((x, 0, -h), (bar, size + bar, bar)), ((x, h, 0), (bar, bar, size)), ((x, -h, 0), (bar, bar, size))):
            b.box(T(*c) @ S(*s), 0)
        if rnd.random() < 0.07:
            b.box(T(x, rnd.choice((-h, h)) * 1.02, rnd.choice((-h, h)) * 1.02) @ S(0.22), 2)
    for y, z in [(y, z) for y in (-h, -h / 3, h / 3, h) for z in (-h, h)] + [(y, z) for y in (-h, h) for z in (-h / 3, h / 3)]:
        b.box(T(0, y, z) @ S(length, rail, rail), 0)
    p = size / 3 - 0.12
    for k in range(n):
        xm = x0 + (k + 0.5) * cell
        for face in range(4):
            for q in range(3):
                if (k, face, q) in holes or rnd.random() < 0.16: continue
                o = -h + (q + 0.5) * size / 3
                c, s = (((xm, o, h), (cell - 0.12, p, 0.03)), ((xm, o, -h), (cell - 0.12, p, 0.03)),
                        ((xm, h, o), (cell - 0.12, 0.03, p)), ((xm, -h, o), (cell - 0.12, 0.03, p)))[face]
                b.box(T(*c) @ S(*s), 1)
    for _ in range(14):     # data lines running inside
        L = rnd.uniform(12, 50); xc = rnd.uniform(x0 + L, -x0 - L)
        b.box(T(xc, rnd.uniform(-h + 0.6, h - 0.6), rnd.uniform(-h + 0.6, h - 0.6)) @ S(L, 0.02, 0.02), 3)
    return b.done(M)

def shells(m, M, height=170, radii=(5.9, 4.7, 3.5), band=2.5, gap=0.9, rnd=None):
    """The protected structure: nested frosted shells, their slots staggered so you see layer through layer."""
    rnd = rnd or random.Random(7)
    step = band + gap
    for L, r in enumerate(radii):
        z = -step + L * step / len(radii)
        while z < height:
            K.tube(f'shell-{L}', r - 0.07, r, max(0.0, z), z + band, m['frost'], M, seg=112)
            z += step
    b = B('ribs', [m['ti'], m['yel'], m['vio']])
    R = radii[0] + 0.22
    for k in range(18):
        a = TAU * k / 18
        b.rod(M @ Vector((R * math.cos(a), R * math.sin(a), 0)), M @ Vector((R * math.cos(a), R * math.sin(a), height)), 0.09, 0, 8)
    b.done()
    K.ring('scan', radii[1] - 0.12, radii[1] + 0.06, C.z - 6.0, C.z - 5.92, m['yel'], M, c=0.005, seg=160)
    K.ring('scan2', radii[2] - 0.1, radii[2] + 0.05, C.z + 13.0, C.z + 13.08, m['vio'], M, c=0.005, seg=160)

def truss(m, M, length=230, R=4.0, step=3.6, rnd=None):
    """The physical structure: a triangular space frame in dark brushed aluminium, a titanium bearing where it crosses."""
    rnd = rnd or random.Random(3)
    b = B('truss', [m['alu'], m['ti'], m['yel']])
    ang = [math.radians(a) for a in (90, 210, 330)]
    P = lambda k, x: Vector((x, R * math.cos(ang[k % 3]), R * math.sin(ang[k % 3])))
    for k in range(3): b.rod(P(k, -length / 2), P(k, length / 2), 0.24, 0, 12)
    n = int(length / step)
    for s in range(n + 1):
        x = -length / 2 + s * step
        for k in range(3):
            b.rod(P(k, x), P(k + 1, x), 0.09, 0, 8)
            if s < n: b.rod(P(k, x), P(k + 1, x + step), 0.075, 0, 8)
            if rnd.random() < 0.035: b.box(T(*P(k, x)) @ S(0.34), 2)
    b.done(M)
    K.ring('bearing', R + 0.7, R + 1.9, -0.7, 0.7, m['ti'], M @ Ry(90), seg=192)
    K.ring('bearing-2', R + 2.1, R + 2.35, -0.25, 0.25, m['alu'], M @ T(1.4, 0, 0) @ Ry(90), seg=192)

def core(m, at=C, size=1.5, light=9000):
    b = B('core', [m['yel']]); b.box(T(*at) @ Rz(45) @ Rx(35) @ S(size), 0); b.done()
    point('core-light', at, light, YEL, 0.8)

def overlap_world(m, extra=()):
    lattice(m, M_DIG); shells(m, M_SEC); truss(m, M_PHY); core(m)
    floor_plane('ground', m['ground'])
    for k, (pos, yaw, sc) in enumerate(extra):          # more crossings far away: the ecosystem goes on
        Mx = T(*pos) @ Rz(yaw) @ S(sc)
        lattice(m, Mx @ T(0, 0, 20) @ Rz(-22) @ Ry(-6), length=200, rnd=random.Random(10 + k), name=f'digital-far-{k}')
        truss(m, Mx @ T(0, 0, 20) @ Rz(38) @ Ry(-30), length=200, rnd=random.Random(20 + k))
        shells(m, Mx, height=160, rnd=random.Random(30 + k))
        b = B(f'core-far-{k}', [m['yel']]); b.box(Mx @ T(0, 0, 20) @ Rz(45) @ Rx(35) @ S(1.5), 0); b.done()

def build_overlap(key):
    s = scene(); m = overlap_mats()
    sky(mul(DPUR, 0.14), mul(VIOLET, 0.32), 0.5, 0.3)
    if key == 3:
        overlap_world(m, extra=(((260, 420, 0), 70, 1.0), ((-120, 640, 0), -35, 1.1), ((480, 1000, 0), 15, 1.2)))
        fog(OV['fog3'])
        point('far-glow', (260, 2400, 30), OV['far'], GLOW, 60)
        spot('key', (-260, -200, 500), C, OV['key3'], (0.88, 0.85, 1.0), 10)
        I.camera((-150, -330, 38), (10, 120, 46), 34)
        return s
    fog(OV['fog'])
    point('behind', (40, 300, 25), OV['behind'], GLOW, 25)
    spot('key', (-60, -40, 160), C, OV['key'], (0.88, 0.85, 1.0), 20)
    I.light('rim', (-170, 90, 40), C, 50, OV['rim'], (0.52, 0.34, 1.0))
    if key == 1:
        overlap_world(m)
        I.camera((-44, -76, 3.0), (-21, 0, 25), 24)
    else:
        # Digital Systems: inside the lattice; three panes have come out of its walls and turned to you as the works
        cam_l = Vector((-44, 1.1, -1.9)); look_l = Vector((0, -0.6, 0.6))
        holes = {(k, 3, q) for k in (24, 25, 26, 27, 28, 29, 30, 31, 32) for q in (0, 1, 2)} | {(k, 2, q) for k in (26, 27, 28, 29, 30) for q in (0, 1, 2)}
        lattice(m, M_DIG, holes=holes); shells(m, M_SEC); truss(m, M_PHY); core(m)
        floor_plane('ground', m['ground'])
        cam = M_DIG @ cam_l
        look = M_DIG @ look_l; up0 = M_DIG.to_3x3() @ Vector((0, 0, 1))
        fw = (look - cam).normalized(); rt = fw.cross(up0).normalized(); upc = rt.cross(fw)
        spots = (((2.5, 0.75, 8.0), 2.3, -14), ((-2.7, 0.55, 12.5), 2.7, 16), ((0.3, -0.35, 19.0), 2.0, -6))
        b = B('work-frames', [m['yel'], m['frame']])
        for k, ((file, aspect, _), ((x, y, z), h, turn)) in enumerate(zip(WORKS, spots)):
            w = h * aspect; pos = cam + rt * x + upc * y + fw * z
            Mf = facing(pos, cam, up=up0) @ Ry(turn)
            I.plane(f'work-{k}', w, h, picture(f'pic-{k}', file, 1.15), Mf)
            b.box(Mf @ T(0, 0, -0.04) @ S(w + 0.12, h + 0.12, 0.05), 1)
            if k == 0: outline(b, Mf, w + 0.12, h + 0.12, 0.045, 0)
        b.done()
        I.camera(tuple(cam), tuple(M_DIG @ look_l), 22)
    return s

# ================================================================ 2 · FOLD

P, TW, TH = 1.06, 1.0, 0.10          # tile pitch, width, thickness

def fold_mats():
    return [bevelled(principled('tile-top', mul(DEEP, 1.25), 0.0, 0.46, spec=0.55), 0.014),
            bevelled(principled('tile-under', WHITE, 0.0, 0.34, coat=0.35), 0.014),
            principled('tile-side', (0.022, 0.02, 0.028), 0.0, 0.55)]

FRAMES = {'+y': Matrix.Identity(4), '-y': Rz(180), '+x': Rz(-90), '-x': Rz(90)}
DIRS = {'+y': Vector((0, 1, 0)), '-y': Vector((0, -1, 0)), '+x': Vector((1, 0, 0)), '-x': Vector((-1, 0, 0))}

class Field:
    """The tile floor on a grid (tile (i, j) sits at (i*P, j*P)). Structures claim cells; the rest stay floor."""
    def __init__(self, mats):
        self.mats = mats; self.claimed = set(); self.lifted = B('lifted', mats + [emit('hinge', YEL, 22.0), emit('path', YEL, 5.0)])
        self.subs = []
    def cell(self, p):
        return (round(p.x / P), round(p.y / P))
    def curl(self, i0, i1, j0, rows, theta, orient='+y', spread=0.22, seed=1, R0=None):
        """Peel a strip up from its hinge and curl it over. i0..i1 across the hinge; j0 the first lifted row (as grid
        indices in the strip's own frame: across = i, along = j). theta: total turn (rad) in the middle of the strip."""
        rnd = random.Random(seed); F = FRAMES[orient]; a = F.to_3x3() @ Vector((1, 0, 0)); d = DIRS[orient]
        half = (i1 - i0) / 2; mid = (i0 + i1) / 2; L = rows * P
        cells = []
        for i in range(i0, i1 + 1):
            u = (i - mid) / (half + 1); w = math.cos(u * math.pi / 2) ** 2
            tot = theta * (0.18 + 0.82 * w)
            hinge = a * (i * P) + d * ((j0 - 0.5) * P)
            ss = [0.0]; pts = [Vector((0, 0))]; N = 400
            for k in range(N):
                s0 = L * k / N; s1 = L * (k + 1) / N; th = tot * ((s0 + s1) / 2 / L) ** 1.7
                pts.append(pts[-1] + Vector((math.cos(th), math.sin(th))) * (s1 - s0)); ss.append(s1)
            for r in range(rows):
                cells.append(hinge + d * ((r + 0.5) * P))
                sc = (r + 0.5) * P * (1 + spread * ((r + 0.5) / rows) ** 2)
                if sc > L * 1.25: break
                th = tot * min(sc / L, 1.3) ** 1.7
                kk = min(int(sc / L * N), N); yz = pts[kk] + Vector((math.cos(th), math.sin(th))) * (sc - ss[kk])
                jit = Matrix.Identity(4)
                if r / rows > 0.62:
                    q = (r / rows - 0.62) * 9
                    jit = Rx(rnd.uniform(-q, q)) @ Ry(rnd.uniform(-q, q)) @ Rz(rnd.uniform(-q, q))
                M = T(*hinge) @ F @ T(0, yz.x, yz.y) @ Rx(math.degrees(th)) @ T(0, 0, TH / 2) @ jit
                self.lifted.tile(M, TW, TW, TH, 0, 1, 2)
        for p in cells: self.claimed.add(self.cell(p))
        hb = T(*(a * (mid * P) + d * ((j0 - 0.5) * P))) @ F
        self.lifted.box(hb @ T(0, 0, 0.005) @ S((i1 - i0 + 1) * P, 0.05, 0.02), 3)
        self.subs.append(cells)
    def panel(self, i0, cols, j_hinge, rows, phi, file, lit=False):
        """Tiles that hinge up at their far edge to face you; the picture is printed across their white undersides."""
        if not hasattr(self, 'pics'): self.pics = []
        self.pics.append(picture(f'panel-{file}', file, 1.0)); idx = len(self.lifted.mats)
        self.lifted.mats.append(self.pics[-1])
        yh = (j_hinge + 0.5) * P; cells = []
        for c in range(cols):
            for r in range(rows):
                x = (i0 + c) * P; cells.append(Vector((x, yh - (r + 0.5) * P, 0)))
                M = T(x, yh, 0) @ Rx(-phi) @ T(0, -(r + 0.5) * P, TH / 2)
                uv = (lambda c, r: (lambda a, b: ((c + a) / cols, (r + (1 - b)) / rows)))(c, r)
                self.lifted.tile(M, TW, TW, TH, 0, idx, 2, uv_bot=uv)
        for p in cells: self.claimed.add(self.cell(p))
        if lit:
            self.lifted.box(T((i0 + (cols - 1) / 2) * P, yh, 0.005) @ S(cols * P, 0.05, 0.02), 3)
        self.subs.append(cells)
    def wall(self, ci, cj, half, height, seed=0):
        """Tiles stood on edge round a square: walls within walls (protected)."""
        rnd = random.Random(seed); cells = []
        for k in range(-half, half + 1):
            for (i, j, yaw) in ((ci + k, cj - half, 0), (ci + k, cj + half, 0), (ci - half, cj + k, 90), (ci + half, cj + k, 90)):
                for z in range(height):
                    M = T(i * P, j * P, TW / 2 + z * (TW + 0.06)) @ Rz(yaw) @ Rx(90)
                    self.lifted.tile(M, TW, TW, TH, 0, 1, 2)
                cells.append(Vector((i * P, j * P, 0)))
        for p in cells: self.claimed.add(self.cell(p))
        self.subs.append(cells)
    def steps(self, ci, cj, half, rise, seed=0):
        """Tiles raised on dark columns in terraces (physical, built up)."""
        cells = []
        for i in range(ci - half, ci + half + 1):
            for j in range(cj - half, cj + half + 1):
                lvl = half - max(abs(i - ci), abs(j - cj)); z = lvl * rise
                if z > 0: self.lifted.box(T(i * P, j * P, z / 2) @ S(TW * 0.96, TW * 0.96, z), 2)
                self.lifted.tile(T(i * P, j * P, z + TH / 2), TW, TW, TH, 0, 1, 2)
                cells.append(Vector((i * P, j * P, 0)))
        for p in cells: self.claimed.add(self.cell(p))
    def path(self, pts, width=0.05):
        """A thin lit line along the gaps between tiles (pts in tile units, on half-integers)."""
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            self.lifted.box(T((x0 + x1) / 2 * P, (y0 + y1) / 2 * P, TH + 0.004) @ S(abs(x1 - x0) * P + width, abs(y1 - y0) * P + width, 0.008), 4)
    def floor(self, i0, i1, j0, j1, sink=()):
        b = B('floor', self.mats)
        for i in range(i0, i1 + 1):
            for j in range(j0, j1 + 1):
                if (i, j) in self.claimed: continue
                b.tile(T(i * P, j * P, TH / 2), TW, TW, TH, 0, 1, 2)
        b.done()
        sub = grid_glow('substrate', mul(DPUR, 0.25), EPUR, 2.2, P, 0.05)
        for cells in self.subs:
            if not cells: continue
            xs = [p.x for p in cells]; ys = [p.y for p in cells]
            x0, x1, y0, y1 = min(xs) - P / 2, max(xs) + P / 2, min(ys) - P / 2, max(ys) + P / 2
            me = bpy.data.meshes.new('sub'); bm = bmesh.new()
            bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5); bmesh.ops.scale(bm, vec=Vector((x1 - x0, y1 - y0, 1)), verts=bm.verts)
            bm.to_mesh(me); bm.free(); me.materials.append(sub)
            ob = link(bpy.data.objects.new('sub', me)); ob.location = ((x0 + x1) / 2, (y0 + y1) / 2, 0.012)
        far = bricks('far-floor', mul(DEEP, 1.25), (0.004, 0.0035, 0.006), P)
        for ((cx, cy), (sx, sy)) in (((0, (j1 + 0.5) * P + 2500), (6000, 5000)), (((i1 + 0.5) * P + 2500, 0), (5000, 6000)),
                                  (((i0 - 0.5) * P - 2500, 0), (5000, 6000)), ((0, (j0 - 0.5) * P - 2500), (6000, 5000))):
            me = bpy.data.meshes.new('far'); bm = bmesh.new()
            bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5); bmesh.ops.scale(bm, vec=Vector((sx, sy, 1)), verts=bm.verts)
            bm.to_mesh(me); bm.free(); me.materials.append(far)
            ob = link(bpy.data.objects.new('far', me)); ob.location = (cx, cy, TH)
        self.lifted.done()

def fold_light(key):
    sky(mul(DPUR, 0.3), (0.20, 0.10, 0.52), 0.8, 0.24)
    if key == 3: sun(64, 9, 2.0, (0.78, 0.66, 1.0), 2.5)        # from the side: no glare off the floor toward you
    else: sun(8, 5.5, 2.4, (0.78, 0.66, 1.0), 2.5)
    I.light('fill', (-40, -30, 14), (0, 34, 10), 50, 9.0e4, (0.86, 0.82, 1.0))

def build_fold(key):
    s = scene(); fold_light(key); f = Field(fold_mats())
    if key == 1:
        f.curl(-21, 21, 30, 46, 3.75, '+y', seed=1)
        f.curl(76, 96, 55, 24, 2.6, '-x', seed=2)
        f.floor(-80, 80, -6, 150)
        I.camera((-17.5, -1.0, 1.55), (1.5, 32, 8.6), 24)
    elif key == 2:
        f.panel(-4, 8, 19, 5, 78, WORKS[0][0], lit=True)
        f.panel(7, 3, 23, 6, 60, WORKS[1][0])
        f.panel(-14, 7, 25, 4, 46, WORKS[2][0])
        f.curl(-20, 20, 70, 44, 3.75, '+y', seed=3)
        f.floor(-70, 70, -6, 140)
        I.camera((0.4, -1.5, 1.45), (0.8, 17, 3.6), 26)
    else:
        # the whole floor from above: each zone is the same floor folded its own way, lit paths in the gaps join them
        f.curl(-75, -52, -35, 44, 3.9, '+x', seed=1)           # the first view's wave, seen side on
        f.curl(132, 156, -65, 30, 3.0, '-x', seed=2)
        f.curl(-85, -57, 160, 30, 3.4, '+y', seed=4)
        f.panel(-2, 6, 33, 4, 72, WORKS[0][0], lit=True)       # digital: the works
        f.panel(6, 3, 35, 6, 58, WORKS[1][0])
        f.panel(11, 6, 34, 4, 48, WORKS[2][0])
        f.wall(28, 52, 5, 2); f.wall(28, 52, 3, 4); f.wall(28, 52, 1, 6)   # protected: walls within walls
        f.steps(52, 104, 6, 0.6)                                # physical: built up in terraces
        f.path([(7.5, 33.5), (7.5, 45.5), (27.5, 45.5), (27.5, 46.5)])
        f.path([(7.5, 45.5), (-20.5, 45.5), (-20.5, 51.5), (-35.5, 51.5)])
        f.path([(27.5, 45.5), (52.5, 45.5), (52.5, 97.5)])
        f.floor(-140, 140, -20, 220)
        I.camera((-4, -24, 21), (2, 90, 0), 30)
    return s

# ================================================================ 3 · COUNTERWEIGHT

def weight_mats():
    return dict(
        ti=principled('titanium', (0.66, 0.64, 0.70), 1.0, 0.12, aniso=0.25),
        alu=principled('alu', (0.34, 0.33, 0.37), 1.0, 0.3, aniso=0.6),
        black=principled('anodised', (0.02, 0.018, 0.025), 0.85, 0.4, coat=0.2),
        cable=principled('cable', (0.4, 0.39, 0.42), 1.0, 0.35),
        smoked=glassy('smoked', (0.40, 0.36, 0.50), 0.04),
        frost=frosted('frost', (0.80, 0.72, 0.98), see=0.35),
        warm=bevelled(principled('warm-ceramic', srgb('#D9C7B5'), 0.0, 0.5), 0.02),
        yel=emit('yellow', YEL, 22.0),
        vio=emit('violet', EPUR, 6.0),
        ground=ground('ground', mul(DEEP, 0.45), 0.16))

def hang(b, top, length, m):
    b.rod(top, top - Vector((0, 0, length)), 0.028, 1, 6)
    return top - Vector((0, 0, length))

def bar(b, pivot, yaw, left, right, m, lit=True):
    d = Vector((math.cos(math.radians(yaw)), math.sin(math.radians(yaw)), 0))
    a, c = pivot - d * left, pivot + d * right
    b.rod(a, c, 0.16, 0, 14)
    for e in (a, c): b.box(T(*e) @ S(0.42), 0)
    b.rod(pivot - Vector((0, 0, 0.35)), pivot + Vector((0, 0, 0.35)), 0.34, 2 if lit else 0, 20)
    return a, c

def digital_cluster(b, top, yaw, m, fan=0.0, pics=None, cam=None):
    """A rail with smoked-glass panes hung under it like files; `fan` opens them out (the zone reorganising)."""
    d = Vector((math.cos(math.radians(yaw)), math.sin(math.radians(yaw)), 0)); n = 7; w, h = 3.8, 2.5
    b.box(T(*top) @ Rz(yaw) @ S(5.0, 0.22, 0.22), 3)
    out = []
    for k in range(n):
        off = (k - (n - 1) / 2) * 0.72
        p = top + d * off - Vector((0, 0, 0.35 + h / 2 + 0.25))
        turn = fan * (k - (n - 1) / 2) * 11
        M = T(*p) @ Rz(yaw + 90 + turn) @ Rx(90)
        b.rod(top + d * off + Vector((0, 0, -0.1)), p + Vector((0, 0, h / 2)), 0.012, 1, 4)
        b.box(M @ S(w, h, 0.035), 4)
        out.append((p, yaw + 90 + turn))
    return out

def protected_cluster(b, top, m, rnd):
    c = top - Vector((0, 0, 3.0))
    for k, sz in enumerate((4.2, 3.0, 1.8)):
        R = T(*c) @ Rz(k * 14) @ Rx(k * 9)
        e = sz / 2
        for (p, s) in (((0, e, e), (sz, 0.07, 0.07)), ((0, -e, e), (sz, 0.07, 0.07)), ((0, e, -e), (sz, 0.07, 0.07)), ((0, -e, -e), (sz, 0.07, 0.07)),
                       ((e, 0, e), (0.07, sz, 0.07)), ((-e, 0, e), (0.07, sz, 0.07)), ((e, 0, -e), (0.07, sz, 0.07)), ((-e, 0, -e), (0.07, sz, 0.07)),
                       ((e, e, 0), (0.07, 0.07, sz)), ((-e, e, 0), (0.07, 0.07, sz)), ((e, -e, 0), (0.07, 0.07, sz)), ((-e, -e, 0), (0.07, 0.07, sz))):
            b.box(R @ T(*p) @ S(*s), 3)
        for (p, s) in (((0, 0, e), (sz, sz, 0.02)), ((0, 0, -e), (sz, sz, 0.02)), ((e, 0, 0), (0.02, sz, sz)), ((-e, 0, 0), (0.02, sz, sz)),
                       ((0, e, 0), (sz, 0.02, sz)), ((0, -e, 0), (sz, 0.02, sz))):
            b.box(R @ T(*p) @ S(*s), 5)
    b.box(T(*c) @ Rz(45) @ Rx(35) @ S(0.36), 2)
    b.rod(top, c + Vector((0, 0, 2.1)), 0.03, 1, 6)

def physical_cluster(b, top, yaw, m):
    c = top - Vector((0, 0, 2.6))
    R = T(*c) @ Rz(yaw) @ Rx(90)
    b.rod(top, c + Vector((0, 0, 1.0)), 0.03, 1, 6)
    b.box(T(*(c + Vector((0, 0, 0.9)))) @ Rz(yaw) @ S(3.2, 0.3, 0.3), 3)
    K_g = [(R @ T(-0.9, 0, 0), 1.7, 30), (R @ T(1.55, -0.55, 0), 0.95, 17)]
    for (M, r, n) in K_g:
        K.gear('gear', r, n, 0.32, 0.16, m['alu'], M)
        b.rod(M @ Vector((0, 0, -0.5)), M @ Vector((0, 0, 0.5)), 0.12, 0, 12)
    b.rod(R @ Vector((-0.9, -2.3, 0.9)), R @ Vector((-0.9, -2.3, -1.2)), 0.55, 6, 24)
    b.box(R @ T(-0.9, -1.2, 0.0) @ S(0.25, 2.4, 0.2), 0)

def beyond_cluster(b, top, m):
    c = top - Vector((0, 0, 2.2))
    b.rod(top, c + Vector((0, 0, 1.0)), 0.03, 1, 6)
    K.ring('warm-ring', 0.9, 1.7, -0.22, 0.22, m['warm'], T(*c) @ Rx(90) @ Rz(20), c=0.06, seg=160)
    K.lathe('warm-disc', [(0, -0.35), (0.85, -0.35), (0.95, -0.2), (0.95, 0.2), (0.85, 0.35), (0, 0.35)], m['warm'], T(*(c + Vector((1.4, 0.6, -1.4)))) @ Rx(80), seg=96)

def mobile(m, root=Vector((0, 0, 36)), scale=1.0, seed=0, fan=0.0, turn=0.0):
    """The whole ecosystem, hanging from one point (the core). Returns where the digital panes hang."""
    rnd = random.Random(seed)
    b = B(f'mobile-{seed}', [m['ti'], m['cable'], m['yel'], m['alu'], m['smoked'], m['frost'], m['black']])
    root = Vector(root)
    b.rod(root + Vector((0, 0, 140)), root, 0.035, 1, 6)
    L0, R0 = bar(b, root, 18 + turn, 15 * scale, 11 * scale, m)
    P1 = hang(b, L0, 8, m); a1, c1 = bar(b, P1, -42 + turn * 1.6, 8.5, 5.6, m)
    pans = digital_cluster(b, hang(b, a1, 4.2, m), -42 + turn * 1.6, m, fan=fan)
    cw = hang(b, c1, 4.6, m); b.rod(cw, cw - Vector((0, 0, 2.8)), 1.0, 0, 32)
    P2 = hang(b, R0, 5, m); a2, c2 = bar(b, P2, 74 - turn * 1.3, 9, 6.2, m)
    protected_cluster(b, hang(b, a2, 3.2, m), m, rnd)
    P3 = hang(b, c2, 4, m); a3, c3 = bar(b, P3, -12 + turn * 2.1, 5.2, 4.6, m)
    physical_cluster(b, hang(b, a3, 2.6, m), -12 + turn * 2.1, m)
    beyond_cluster(b, hang(b, c3, 2.4, m), m)
    b.done()
    return pans

def build_weight(key):
    s = scene(); m = weight_mats()
    sky(mul(DPUR, 0.3), mul(VIOLET, 0.55), 0.5, 0.25)
    floor_plane('ground', m['ground'])
    others = (((-70, 120, 30), 1), ((95, 170, 40), 2), ((-150, 260, 34), 3), ((40, 330, 44), 4))
    if key == 3:
        mobile(m)
        for pos, sd in others + (((180, 60, 30), 5), ((-230, 90, 30), 6)): mobile(m, Vector(pos), seed=sd, turn=sd * 47.0)
        fog(WT['fog3'])
        spot('top', (0, 6, 160), (0, 0, 20), WT['top'], (0.9, 0.86, 1.0), 26)
        point('far-glow', (20, 900, 80), WT['far'], GLOW, 40)
        I.camera((-14, -160, 16), (6, 40, 34), 36)
        return s
    fog(WT['fog'])
    spot('top', (0, 6, 150), (0, 0, 20), WT['top'], (0.9, 0.86, 1.0), 24)
    point('behind', (-6, 200, 80), WT['behind'], GLOW, 20)
    I.light('side', (-90, 30, 18), (0, 0, 22), 40, WT['side'], GLOW)
    if key == 1:
        mobile(m)
        for pos, sd in others: mobile(m, Vector(pos), seed=sd, turn=sd * 47.0)
        point('core-light', (0, 0, 36), 1200, YEL, 0.4)
        I.camera((-8, -35, 7.5), (-13, 0, 23), 22)
    else:
        pans = mobile(m, fan=1.5)
        for pos, sd in others: mobile(m, Vector(pos), seed=sd, turn=sd * 47.0)
        (pa, ya), (pb, yb), (pc, yc) = pans[0], pans[3], pans[6]
        cam = Vector((-23.5, -10.5, 18.4))
        fb = B('work-frames', [m['yel'], m['black']])
        for k, ((file, aspect, _), (p, yaw)) in enumerate(zip(WORKS, ((pb, yb), (pa, ya), (pc, yc)))):
            h = 2.2 if aspect > 1 else 2.35; w = h * aspect
            n = Vector((math.cos(math.radians(yaw - 90)), math.sin(math.radians(yaw - 90)), 0))
            if n.dot(cam - p) < 0: n = -n
            M = facing(p + n * 0.04, p + n * 10)
            I.plane(f'work-{k}', w, h, picture(f'pic-{k}', file, 1.1), M)
            if k == 0: outline(fb, M, w + 0.05, h + 0.05, 0.04, 0)
        fb.done()
        I.camera(tuple(cam), tuple(pb + Vector((0.4, 0, 0.1))), 30)
    return s

# ---------------------------------------------------------------- run

BUILD = {'overlap': build_overlap, 'fold': build_fold, 'weight': build_weight}
if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for job in (ONLY or [f'{i}-{f}' for i in BUILD for f in (1, 2, 3)]):
        idea, f = job.split('-')
        s = BUILD[idea](int(f))
        s.render.filepath = os.path.join(OUT, f'{idea}-{f}.jpg')
        bpy.ops.render.render(write_still=True)
        print('wrote', s.render.filepath, flush=True)
