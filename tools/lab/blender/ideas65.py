# LAB ONLY (throwaway). Round 65: three ideas of my own for the whole site, after Bob said round 64 "looks like it's
# selling a product". No hero object on a pedestal: each idea is a world with one rule.
#   cut:   Cutaway. A plane of light cuts everything open: the headline (printed honeycomb inside), the three
#          discipline words (each made of what it means), the works (their line drawing under the picture, HTML).
#   parts: Parts. Thousands of small real parts (screws, chips, gears, keys) build the name, sort themselves into the
#          three disciplines and assemble each work.
#   hall:  Hall. A long concrete hall at night: projectors throw the name, the disciplines and the works on its walls.
#   blender -b --factory-startup --python tools/lab/blender/ideas65.py -- <out-dir> [cut-1,parts-2,...] [samples] [res%]
# Textures come from tools/lab/mock/tex65.mjs. Blender is Z up; "standing" text faces -Y (the camera side).
import bpy, bmesh, math, sys, os, random
from mathutils import Vector, Matrix, Euler
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import instrument64 as K
from instrument64 import Rx, Ry, Rz, T, link, principled, emit, lathe, ring, ring_pts, rod, box, gear, setin, _math, TAU

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else '.')
ONLY = argv[1].split(',') if len(argv) > 1 and argv[1] else None
TEX = os.path.abspath('proof-out/lab/mock/ideas65/tex')
BLACK = 'C:/Windows/Fonts/seguibl.ttf'

# ---------------------------------------------------------------- helpers

def font():
    return bpy.data.fonts.load(BLACK, check_existing=True)

def bake(ob):
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    ob.modifiers.clear()
    ob.data = me
    return ob

def text_solid(name, body, size, depth, offset=0.0, mat=None, space_line=0.82, bevel=0.0):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body; cu.font = font(); cu.size = size; cu.space_line = space_line
    cu.align_x = 'LEFT'; cu.offset = offset; cu.resolution_u = 5
    cu.extrude = max(0.0, depth / 2 - bevel); cu.bevel_depth = bevel; cu.bevel_resolution = 2
    tmp = link(bpy.data.objects.new(name + '-curve', cu))
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(me); bm.free()
    me.materials.clear()
    if mat: me.materials.append(mat)
    return link(bpy.data.objects.new(name, me))

def boolean(ob, cutter, op='DIFFERENCE', self_hit=False):
    md = ob.modifiers.new('b', 'BOOLEAN'); md.operation = op; md.object = cutter
    for k, v in (('solver', 'EXACT'), ('material_mode', 'TRANSFER'), ('use_self', self_hit), ('use_hole_tolerant', True)):
        try: setattr(md, k, v)
        except Exception: pass
    return bake(ob)

def clone(ob, name):
    c = ob.copy(); c.data = ob.data.copy(); c.name = name
    return link(c)

def hide(*obs):
    for o in obs:
        o.hide_render = True; o.hide_viewport = True

def bounds(ob):
    vs = [v.co for v in ob.data.vertices]
    return (min(v.x for v in vs), max(v.x for v in vs), min(v.y for v in vs), max(v.y for v in vs))

def inside_test(ob):
    """(x, y) -> is it inside the glyphs of this solid (cast down from above)."""
    bpy.context.view_layer.update()
    bvh = BVHTree.FromObject(ob, bpy.context.evaluated_depsgraph_get())
    return lambda x, y: bvh.ray_cast(Vector((x, y, 5.0)), Vector((0, 0, -1)))[0] is not None

def lit(name, base, strength, color=(0.86, 0.91, 0.95), rough=0.4):
    m = principled(name, base, 0.0, rough)
    b = m.node_tree.nodes.get('Principled BSDF')
    setin(b, 'Emission Color', (*color, 1)); setin(b, 'Emission Strength', strength)
    return m

def image_mat(name, path, strength=1.0, mode='screen', dissolve=None):
    """An image as light: 'screen' is opaque emission; 'projection' adds light over whatever is behind (transparent where
    black). `dissolve` (x0): the image breaks up towards its right edge from uv x0, with an ice rim at the break."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(path, check_existing=True)
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Strength'].default_value = strength
    nt.links.new(tex.outputs['Color'], em.inputs['Color'])
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    if mode == 'projection':
        add = nt.nodes.new('ShaderNodeAddShader')
        nt.links.new(tr.outputs[0], add.inputs[0]); nt.links.new(em.outputs[0], add.inputs[1])
        nt.links.new(add.outputs[0], out.inputs['Surface'])
        return m
    if dissolve is None:
        nt.links.new(em.outputs[0], out.inputs['Surface'])
        return m
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['UV'], sep.inputs[0])
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 26.0
    nt.links.new(tc.outputs['UV'], nz.inputs['Vector'])
    v = _math(nt, 'ADD', _math(nt, 'MULTIPLY', sep.outputs['X'], 1.0), _math(nt, 'MULTIPLY', nz.outputs['Fac'], 0.32))
    gone = _math(nt, 'GREATER_THAN', v, dissolve + 0.16)
    rim = _math(nt, 'MULTIPLY', _math(nt, 'GREATER_THAN', v, dissolve + 0.145), _math(nt, 'LESS_THAN', v, dissolve + 0.16))
    ice = nt.nodes.new('ShaderNodeEmission'); ice.inputs['Color'].default_value = (0.57, 0.73, 0.8, 1); ice.inputs['Strength'].default_value = 6
    mix1 = nt.nodes.new('ShaderNodeMixShader'); nt.links.new(rim, mix1.inputs[0])
    nt.links.new(em.outputs[0], mix1.inputs[1]); nt.links.new(ice.outputs[0], mix1.inputs[2])
    mix2 = nt.nodes.new('ShaderNodeMixShader'); nt.links.new(gone, mix2.inputs[0])
    nt.links.new(mix1.outputs[0], mix2.inputs[1]); nt.links.new(tr.outputs[0], mix2.inputs[2])
    nt.links.new(mix2.outputs[0], out.inputs['Surface'])
    return m

def plane(name, w, h, mat, M):
    bm = bmesh.new(); bm.loops.layers.uv.new('UVMap')
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5, calc_uvs=True)
    bmesh.ops.scale(bm, vec=Vector((w, h, 1)), verts=bm.verts)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    ob = link(bpy.data.objects.new(name, me)); ob.matrix_world = M
    return ob

def camera(loc, target, lens=35, fstop=None, focus=None, shift_x=0.0, shift_y=0.0):
    cd = bpy.data.cameras.new('cam'); cd.lens = lens; cd.sensor_width = 36; cd.shift_x = shift_x; cd.shift_y = shift_y
    cam = link(bpy.data.objects.new('cam', cd)); cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    if fstop:
        cd.dof.use_dof = True; cd.dof.aperture_fstop = fstop
        cd.dof.focus_distance = focus or (Vector(target) - Vector(loc)).length
    bpy.context.scene.camera = cam

def light(name, loc, target, size, energy, color=(0.94, 0.97, 1.0), size_y=None, spread=None, visible=False):
    d = bpy.data.lights.new(name, 'AREA'); d.energy = energy; d.color = color
    if size_y: d.shape = 'RECTANGLE'; d.size = size; d.size_y = size_y
    else: d.size = size
    if spread is not None: d.spread = math.radians(spread)
    ob = link(bpy.data.objects.new(name, d)); ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    ob.visible_camera = visible
    return ob

def haze(density, size, center, color=(0.8, 0.86, 0.92)):
    vm = bpy.data.materials.new('haze'); vm.use_nodes = True
    nt = vm.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); v = nt.nodes.new('ShaderNodeVolumePrincipled')
    v.inputs['Density'].default_value = density; v.inputs['Anisotropy'].default_value = 0.45
    v.inputs['Color'].default_value = (*color, 1)
    nt.links.new(v.outputs[0], out.inputs['Volume'])
    hb = box('haze', size, vm, T(*center), 0)
    hb.visible_shadow = False

def floor_and_wall(floor_z, wall_y, grid=False):
    fl = bpy.data.materials.new('floor'); fl.use_nodes = True
    nt = fl.node_tree; b = nt.nodes.get('Principled BSDF')
    setin(b, 'Base Color', (0.006, 0.0065, 0.0072, 1)); setin(b, 'Specular IOR Level', 0.25)
    tc = nt.nodes.new('ShaderNodeTexCoord'); nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.4
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    nt.links.new(_math(nt, 'MULTIPLY_ADD', nz.outputs['Fac'], 0.22, 0.18), b.inputs['Roughness'])
    if grid:   # a faint drawing grid in the floor, as light
        sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Object'], sep.inputs[0])
        line = lambda c, step: _math(nt, 'LESS_THAN', _math(nt, 'ABSOLUTE', _math(nt, 'SUBTRACT', _math(nt, 'FRACT', _math(nt, 'MULTIPLY', c, 1 / step)), 0.5)), 0.012)
        g = _math(nt, 'MAXIMUM', line(sep.outputs['X'], 0.5), line(sep.outputs['Y'], 0.5))
        setin(b, 'Emission Color', (0.57, 0.73, 0.8, 1))
        nt.links.new(_math(nt, 'MULTIPLY', g, 0.35), b.inputs['Emission Strength'])
    me = bpy.data.meshes.new('floor'); bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=40); bm.to_mesh(me); bm.free(); me.materials.append(fl)
    f = link(bpy.data.objects.new('floor', me)); f.location = (0, 0, floor_z)
    wm = principled('wall', (0.0045, 0.0048, 0.0055), 0.0, 0.9)
    me = bpy.data.meshes.new('wall'); bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=40); bm.to_mesh(me); bm.free(); me.materials.append(wm)
    w = link(bpy.data.objects.new('wall', me)); w.location = (0, wall_y, floor_z + 20); w.rotation_euler = (math.radians(90), 0, 0)

# ---------------------------------------------------------------- CUT · the headline and the words, cut open

class CutMats:
    def __init__(self):
        self.skin = principled('skin', (0.075, 0.08, 0.088), 0.0, 0.32, coat=0.6)
        self.inner = principled('inner', (0.035, 0.038, 0.042), 0.0, 0.6)
        self.infill = principled('infill', (0.11, 0.12, 0.13), 0.0, 0.5)
        self.section = lit('section', (0.9, 0.92, 0.93), 2.2)
        self.laser = emit('laser', (0.57, 0.73, 0.8), 14)
        self.trace = principled('trace', (0.72, 0.74, 0.76), 1.0, 0.25)
        self.pad = principled('pad', (0.86, 0.87, 0.88), 1.0, 0.18)
        self.led = emit('led', (0.57, 0.73, 0.8), 18)
        self.ti = principled('gear-ti', (0.50, 0.52, 0.55), 1.0, 0.3, aniso=0.5)
        self.steel = principled('gear-steel', (0.16, 0.18, 0.2), 1.0, 0.36)

def honeycomb(name, x0, x1, y0, y1, z0, z1, R, wall, mat):
    bm = bmesh.new()
    inner = R - wall / math.sqrt(3)
    hgt = math.sqrt(3) * R
    i = 0
    x = x0
    while x < x1 + R:
        y = y0 + (hgt / 2 if i % 2 else 0)
        while y < y1 + hgt:
            vo = [bm.verts.new((x + R * math.cos(TAU * k / 6), y + R * math.sin(TAU * k / 6), z0)) for k in range(6)]
            vi = [bm.verts.new((x + inner * math.cos(TAU * k / 6), y + inner * math.sin(TAU * k / 6), z0)) for k in range(6)]
            for k in range(6):
                bm.faces.new([vo[k], vo[(k + 1) % 6], vi[(k + 1) % 6], vi[k]])
            y += hgt
        x += 1.5 * R; i += 1
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    res = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:])
    bmesh.ops.translate(bm, vec=(0, 0, z1 - z0), verts=[g for g in res['geom'] if isinstance(g, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    return link(bpy.data.objects.new(name, me))

def cut_word(m, name, body, S, D, W, window, interior, made):
    """A solid word, hollowed to a skin of W, with an interior, and a window cut through its front half.
    window = (x0, x1) as shares of the word's width. Everything is built at the origin, text in XY, depth on Z."""
    solid = text_solid(f'{name}-solid', body, S, D, mat=m.skin, bevel=0.012)
    cav = text_solid(f'{name}-cav', body, S, D - 2 * W, offset=-W, mat=m.inner)
    bx0, bx1, by0, by1 = bounds(solid)
    shell = boolean(clone(solid, f'{name}-shell'), cav)
    parts = [shell]
    wx0, wx1 = bx0 + (bx1 - bx0) * window[0], bx0 + (bx1 - bx0) * window[1]
    parts += interior(m, name, cav, (wx0, wx1, by0, by1), S, D, W)
    cutter = box(f'{name}-cutter', (wx1 - wx0, by1 - by0 + 0.6, D), m.section, T((wx0 + wx1) / 2, (by0 + by1) / 2, D / 2 + 0.0), 0)
    for p in parts:
        if p.get('cut', True):
            boolean(p, cutter)
    hide(solid, cav, cutter)
    made += parts
    # the light sheet's two edges, in front of the word
    for x in (wx0, wx1):
        made.append(box(f'{name}-laser', (0.006, by1 - by0 + 0.5, 0.006), m.laser, T(x, (by0 + by1) / 2, D / 2 + 0.03), 0))
    return (bx0, bx1, by0, by1, wx0, wx1)

def infill_interior(m, name, cav, win, S, D, W):
    wx0, wx1, by0, by1 = win
    comb = honeycomb(f'{name}-infill', wx0 - 0.15, wx1 + 0.15, by0 - 0.15, by1 + 0.15, -D / 2, D / 2, 0.062, 0.0075, m.infill)
    return [boolean(comb, cav, 'INTERSECT')]

def traces_interior(m, name, cav, win, S, D, W):
    """DIGITAL: copper-less traces and vias on the back wall of the cavity, routed on a grid, only where they fit."""
    wx0, wx1, by0, by1 = win
    inside = inside_test(cav)
    zb = -(D / 2 - W) + 0.004
    rnd = random.Random(5); g = 0.035; made = []
    def fits(x, y, pad=0.022):
        return all(inside(x + dx, y + dy) for dx, dy in ((0, 0), (pad, 0), (-pad, 0), (0, pad), (0, -pad)))
    bm = bmesh.new(); pads = []
    for _ in range(900):
        x = round(rnd.uniform(wx0 - 0.1, wx1 + 0.1) / g) * g; y = round(rnd.uniform(by0, by1) / g) * g
        if not fits(x, y): continue
        pts = [(x, y)]; horiz = rnd.random() < 0.5
        for _ in range(rnd.randint(2, 5)):
            L = rnd.choice((2, 3, 4, 6)) * g * rnd.choice((1, -1))
            nx, ny = (pts[-1][0] + L, pts[-1][1]) if horiz else (pts[-1][0], pts[-1][1] + L)
            steps = 8
            if all(fits(pts[-1][0] + (nx - pts[-1][0]) * k / steps, pts[-1][1] + (ny - pts[-1][1]) * k / steps) for k in range(steps + 1)):
                pts.append((nx, ny)); horiz = not horiz
            else:
                break
        if len(pts) < 2: continue
        for (ax, ay), (cx, cy) in zip(pts, pts[1:]):
            c = Vector(((ax + cx) / 2, (ay + cy) / 2, zb)); sz = Vector((abs(cx - ax) + 0.012, abs(cy - ay) + 0.012, 0.006))
            bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation(c) @ Matrix.Diagonal((*sz, 1)))
        pads += [pts[0], pts[-1]]
    me = bpy.data.meshes.new(f'{name}-traces'); bm.to_mesh(me); bm.free(); me.materials.append(m.trace)
    tr = link(bpy.data.objects.new(f'{name}-traces', me)); tr['cut'] = False
    made.append(tr)
    for k, (x, y) in enumerate(pads):
        o = lathe(f'{name}-via-{k}', [(0, 0), (0.016, 0), (0.016, 0.008), (0.007, 0.008), (0.007, 0.004), (0, 0.004)], m.pad, T(x, y, zb), 24)
        o['cut'] = False; made.append(o)
        if k % 7 == 0:
            s = K.sphere(f'{name}-led-{k}', 0.008, m.led, T(x, y, zb + 0.012), 12); s['cut'] = False; made.append(s)
    return made

def walls_interior(m, name, cav, win, S, D, W):
    """SECURITY: nested walls inside the skin, each a smaller outline of the word: defence in depth."""
    made = []
    for k, off in enumerate((-W - 0.03, -W - 0.06)):
        outer = text_solid(f'{name}-wo{k}', cav['body'], S, D - 2 * W - 0.01, offset=off, mat=m.infill)
        inner = text_solid(f'{name}-wi{k}', cav['body'], S, D - 2 * W - 0.004, offset=off - 0.011, mat=m.inner)
        made.append(boolean(outer, inner)); hide(inner)
    return made

def gears_interior(m, name, cav, win, S, D, W):
    """PHYSICAL: a train of gears on axles in the back half, only where they fit."""
    wx0, wx1, by0, by1 = win
    inside = inside_test(cav)
    rnd = random.Random(9); made = []; placed = []
    def fits(x, y, r):
        return all(inside(x + (r + 0.012) * math.cos(a), y + (r + 0.012) * math.sin(a)) for a in [TAU * i / 12 for i in range(12)]) and inside(x, y)
    for _ in range(1500):
        if placed and rnd.random() < 0.8:
            px, py, pr, pz = rnd.choice(placed); r = rnd.uniform(0.035, 0.09); a = rnd.uniform(0, TAU)
            x, y = px + (pr + r - 0.012) * math.cos(a), py + (pr + r - 0.012) * math.sin(a)
        else:
            r = rnd.uniform(0.04, 0.1); x, y = rnd.uniform(wx0 - 0.05, wx1 + 0.05), rnd.uniform(by0, by1)
        if not fits(x, y, r): continue
        if any((x - qx) ** 2 + (y - qy) ** 2 < (r + qr - 0.016) ** 2 for qx, qy, qr, _ in placed): continue
        z = -D / 2 + W + 0.03 + (len(placed) % 2) * 0.018
        o = gear(f'{name}-gear-{len(placed)}', r, max(8, int(r * 160)), 0.014, min(0.012, r * 0.18), m.ti if len(placed) % 3 else m.steel, T(x, y, z) @ Rz(rnd.uniform(0, 30)))
        o['cut'] = False; made.append(o)
        a = rod(f'{name}-axle-{len(placed)}', Vector((x, y, -D / 2 + W)), Vector((x, y, z + 0.02)), max(0.006, r * 0.14), m.pad)
        a['cut'] = False; made.append(a)
        placed.append((x, y, r, z))
        if len(placed) > 60: break
    return made

def build_cut(key):
    s = K.fresh(); m = CutMats()
    made = []
    if key == 1:
        S, D, W = 1.0, 0.62, 0.032
        b = cut_word(m, 'head', 'CURIOUS\nABOUT HOW\nTHINGS\nWORK.', S, D, W, (0.34, 0.66), infill_interior, made)
    else:
        S, D, W = 1.06, 0.5, 0.026
        rows = (('DIGITAL', (0.30, 0.78), traces_interior), ('SECURITY', (0.12, 0.52), walls_interior), ('PHYSICAL', (0.36, 0.86), gears_interior))
        for k, (word, win, fn) in enumerate(rows):
            start = len(made)
            def interior(m_, name, cav, w_, S_, D_, W_, fn=fn, word=word):
                cav['body'] = word
                return fn(m_, name, cav, w_, S_, D_, W_)
            cut_word(m, word.lower(), word, S, D, W, win, interior, made)
            for o in made[start:]:
                o.matrix_world = T(0, -k * 1.16, 0) @ o.matrix_world
    # stand it all up: text XY -> world XZ, front faces to -Y; bottom on the floor
    xs, zs = [], []
    for o in made:
        if o.hide_render: continue
        for v in (o.data.vertices if o.type == 'MESH' else []):
            w = o.matrix_world @ v.co; xs.append(w.x); zs.append(w.y)
    x0, x1, z0 = min(xs), max(xs), min(zs)
    P = T(-(x0 + x1) / 2, 0, -z0 + 0.0) @ Rx(90)
    for o in made:
        o.matrix_world = P @ o.matrix_world
    floor_and_wall(0.0, 6.0)
    width = x1 - x0
    if key == 1:
        light('key', (-7, -5, 4), (0, 0, 1.2), 3.0, 1900, (0.95, 0.97, 1.0))
        light('rim', (6, 3, 3), (0, 0, 1.2), 0.5, 900, (0.85, 0.92, 1.0), size_y=4)
        light('fill', (2, -8, 1.5), (0, 0, 1.2), 3.0, 260)
        light('wash', (0, 3, 6), (0, 6, 0), 6.0, 160, (0.85, 0.9, 1.0))
        camera((1.5, -10.2, 1.55), (0.3, 0, 1.6), 40, 8.0, shift_x=0.1, shift_y=-0.02)
    else:
        light('key', (-7, -5, 4.5), (0, 0, 1.6), 3.0, 2000, (0.95, 0.97, 1.0))
        light('rim', (6, 3, 3), (0, 0, 1.6), 0.5, 900, (0.85, 0.92, 1.0), size_y=4)
        light('fill', (2, -8, 1.5), (0, 0, 1.6), 3.0, 260)
        light('wash', (0, 3, 6), (0, 6, 0), 6.0, 160, (0.85, 0.9, 1.0))
        camera((1.6, -10.0, 1.45), (0.3, 0, 1.45), 40, 8.0, shift_x=0.19, shift_y=-0.02)
    return s

# ---------------------------------------------------------------- PARTS · thousands of small real parts

class PartMats:
    def __init__(self):
        self.ti = principled('p-ti', (0.50, 0.52, 0.55), 1.0, 0.3, aniso=0.4)
        self.alu = principled('p-alu', (0.86, 0.87, 0.88), 1.0, 0.16)
        self.steel = principled('p-steel', (0.17, 0.19, 0.21), 1.0, 0.35)
        self.black = principled('p-black', (0.02, 0.021, 0.024), 0.6, 0.45, coat=0.3)
        self.body = principled('p-body', (0.26, 0.28, 0.31), 0.0, 0.42)
        self.ice = emit('p-led', (0.57, 0.73, 0.8), 16)

def part_library(m):
    lib = {}
    def keep(ob, flat=False):
        me = ob.data; bpy.data.objects.remove(ob)
        if flat:
            for p in me.polygons: p.use_smooth = False
        return me
    pts = [(0, -1.2), (0.2, -1.2)]
    z = -1.15
    while z < -0.05:
        pts += [(0.24, z), (0.18, z + 0.04)]; z += 0.08
    pts += [(0.24, -0.02), (0.5, 0), (0.5, 0.22), (0.44, 0.3), (0, 0.3)]
    lib['screw'] = [keep(lathe('screw', pts, m.ti, Matrix(), 20))]
    lib['bolt'] = [keep(lathe('bolt', pts, m.steel, Matrix(), 6), flat=True)]
    lib['nut'] = [keep(lathe('nut', ring_pts(0.26, 0.5, -0.2, 0.2, 0.03), m.steel, Matrix(), 6), flat=True)]
    lib['washer'] = [keep(lathe('washer', ring_pts(0.24, 0.55, -0.04, 0.04, 0.01), m.alu, Matrix(), 32))]
    lib['gear'] = [keep(gear('gear', 0.5, 12, 0.16, 0.1, m.ti, Matrix()))]
    lib['gear2'] = [keep(gear('gear2', 0.5, 20, 0.12, 0.07, m.alu, Matrix()))]
    lib['bearing'] = [keep(lathe('b-out', ring_pts(0.36, 0.5, -0.14, 0.14, 0.02), m.steel, Matrix(), 32)),
                      keep(lathe('b-in', ring_pts(0.14, 0.26, -0.14, 0.14, 0.02), m.alu, Matrix(), 32))]
    def boxes(name, specs, mat):
        bm = bmesh.new()
        for c, sz in specs:
            bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation(Vector(c)) @ Matrix.Diagonal((*sz, 1)))
        me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
        return me
    legs = [((x, sy * 0.36, -0.03), (0.07, 0.2, 0.03)) for x in (-0.38, -0.23, -0.08, 0.08, 0.23, 0.38) for sy in (1, -1)]
    lib['chip'] = [boxes('chip', [((0, 0, 0), (1.0, 0.56, 0.14))], m.black), boxes('legs', legs, m.alu)]
    lib['resistor'] = [keep(lathe('resistor', [(0, -1.0), (0.03, -1.0), (0.03, -0.32), (0.12, -0.3), (0.15, -0.22), (0.15, 0.22), (0.12, 0.3),
                                              (0.03, 0.32), (0.03, 1.0), (0, 1.0)], m.body, Matrix(), 16))]
    lib['led'] = [keep(lathe('led', [(0, -0.25), (0.17, -0.25), (0.17, 0.08), (0.12, 0.22), (0, 0.27)], m.ice, Matrix(), 20))]
    lib['cap'] = [boxes('cap', [((0, 0, 0), (0.36, 0.26, 0.26))], m.body), boxes('cap-ends', [((0.22, 0, 0), (0.1, 0.27, 0.27)), ((-0.22, 0, 0), (0.1, 0.27, 0.27))], m.alu)]
    teeth = [((x, -0.12, 0), (0.07, 0.1, 0.08)) for x in (0.32, 0.46, 0.6)]
    lib['key'] = [keep(lathe('key-bow', ring_pts(0.12, 0.3, -0.04, 0.04, 0.008), m.alu, T(-0.55, 0, 0), 32)),
                  boxes('key-blade', [((0.2, 0, 0), (0.9, 0.14, 0.08))] + teeth, m.alu)]
    # a chain link: a torus stretched along X
    bm = bmesh.new(); U, V = 32, 10; R0, r0 = 0.32, 0.07; vs = []
    for i in range(U):
        u = TAU * i / U; row = []
        for j in range(V):
            v = TAU * j / V
            x = (R0 + r0 * math.cos(v)) * math.cos(u) * 1.6; y = (R0 + r0 * math.cos(v)) * math.sin(u); z = r0 * math.sin(v)
            row.append(bm.verts.new((x, y, z)))
        vs.append(row)
    for i in range(U):
        for j in range(V):
            f = bm.faces.new([vs[i][j], vs[(i + 1) % U][j], vs[(i + 1) % U][(j + 1) % V], vs[i][(j + 1) % V]]); f.smooth = True
    me = bpy.data.meshes.new('link'); bm.to_mesh(me); bm.free(); me.materials.append(m.ti)
    lib['link'] = [me]
    # a spring
    cu = bpy.data.curves.new('spring', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.04; cu.bevel_resolution = 2
    sp = cu.splines.new('POLY'); n = 120; sp.points.add(n - 1)
    for i in range(n):
        a = TAU * 6 * i / n; sp.points[i].co = (0.3 * math.cos(a), 0.3 * math.sin(a), -0.6 + 1.2 * i / n, 1)
    cu.materials.append(m.steel)
    tmp = link(bpy.data.objects.new('spring', cu)); bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get())); bpy.data.objects.remove(tmp)
    lib['spring'] = [me]
    return lib

KINDS = {
    'all': (('screw', 5), ('bolt', 3), ('nut', 4), ('washer', 4), ('gear', 3), ('gear2', 2), ('bearing', 2), ('chip', 3),
            ('resistor', 3), ('cap', 3), ('led', 1), ('key', 1), ('link', 2), ('spring', 2)),
    'digital': (('chip', 5), ('resistor', 5), ('cap', 5), ('led', 2)),
    'security': (('key', 4), ('link', 6), ('nut', 1), ('led', 1)),
    'physical': (('gear', 5), ('gear2', 4), ('screw', 4), ('bearing', 3), ('spring', 3), ('washer', 3), ('bolt', 2)),
}

def pick(rnd, mix):
    total = sum(w for _, w in mix); x = rnd.uniform(0, total)
    for k, w in mix:
        x -= w
        if x <= 0: return k
    return mix[-1][0]

def put(lib, kind, M):
    for me in lib[kind]:
        o = bpy.data.objects.new(kind, me); bpy.context.scene.collection.objects.link(o); o.matrix_world = M

def rand_rot(rnd):
    return Euler((rnd.uniform(0, TAU), rnd.uniform(0, TAU), rnd.uniform(0, TAU))).to_matrix().to_4x4()

def glyph_points(body, size, n, rnd):
    """Area-weighted random points inside flat glyphs (text in XY)."""
    flat = text_solid('flat', body, size, 0.0)
    bm = bmesh.new(); bm.from_mesh(flat.data); bmesh.ops.triangulate(bm, faces=bm.faces[:])
    tris = [[v.co.copy() for v in f.verts] for f in bm.faces]; bm.free(); hide(flat)
    areas = [((b - a).cross(c - a)).length / 2 for a, b, c in tris]
    total = sum(areas); acc = []; s = 0
    for a in areas:
        s += a; acc.append(s)
    out = []
    import bisect
    for _ in range(n):
        i = bisect.bisect_left(acc, rnd.uniform(0, total)); a, b, c = tris[min(i, len(tris) - 1)]
        u, v = rnd.random(), rnd.random()
        if u + v > 1: u, v = 1 - u, 1 - v
        out.append(a + (b - a) * u + (c - a) * v)
    return out

def build_parts(key):
    s = K.fresh(); m = PartMats(); lib = part_library(m); rnd = random.Random(21)
    floor_and_wall(-1.6, 9.0)
    if key == 1:
        P = T(-3.15, 0, 0.0) @ Rx(90)
        for p in glyph_points('BOB CHUNG', 1.0, 5200, rnd):
            sc = rnd.uniform(0.02, 0.042)
            M = P @ T(p.x, p.y, rnd.gauss(0, 0.07)) @ rand_rot(rnd) @ Matrix.Diagonal((sc, sc, sc, 1))
            put(lib, pick(rnd, KINDS['all']), M)
        for _ in range(1400):   # the swarm that has not landed yet
            x, y, z = rnd.uniform(-6, 7), rnd.uniform(-1.5, 3.5), rnd.uniform(-1.4, 2.4)
            if abs(y) < 0.3 and -3.3 < x < 3.3 and -0.1 < z < 0.8: continue
            sc = rnd.uniform(0.02, 0.05)
            put(lib, pick(rnd, KINDS['all']), T(x, y, z) @ rand_rot(rnd) @ Matrix.Diagonal((sc, sc, sc, 1)))
        for _ in range(26):     # a few close to the lens
            x, y, z = rnd.uniform(-3.4, 1.0), rnd.uniform(-4.4, -3.0), rnd.uniform(-0.6, 1.4)
            sc = rnd.uniform(0.04, 0.07)
            put(lib, pick(rnd, KINDS['all']), T(x, y, z) @ rand_rot(rnd) @ Matrix.Diagonal((sc, sc, sc, 1)))
        light('key', (-4, -5, 5), (0, 0, 0.3), 4.0, 900, (0.95, 0.97, 1.0))
        light('rim', (5, 4, 2), (0, 0, 0.3), 0.6, 900, (0.85, 0.92, 1.0), size_y=4)
        light('fill', (0, -7, 0.5), (0, 0, 0.3), 4.0, 120)
        camera((-1.2, -6.6, 0.62), (0.0, 0, 0.36), 32, 2.8, focus=6.4, shift_y=-0.04)
    elif key == 2:
        bands = (('digital', 1.25), ('security', 0.0), ('physical', -1.25))
        for kind, z in bands:
            a, b = Vector((-5.5, -1.0, z)), Vector((7.0, 7.0, z + 0.4))
            for _ in range(2300):
                t = rnd.random() ** 0.85; c = a + (b - a) * t
                spread = 0.16 + 0.12 * t
                M = T(c.x + rnd.gauss(0, spread), c.y + rnd.gauss(0, spread), c.z + rnd.gauss(0, spread * 0.8))
                sc = rnd.uniform(0.028, 0.055)
                put(lib, pick(rnd, KINDS[kind]), M @ rand_rot(rnd) @ Matrix.Diagonal((sc, sc, sc, 1)))
        for _ in range(500):
            x, y, z = rnd.uniform(-6, 7), rnd.uniform(-1, 8), rnd.uniform(-1.5, 2.5)
            sc = rnd.uniform(0.02, 0.04)
            put(lib, pick(rnd, KINDS['all']), T(x, y, z) @ rand_rot(rnd) @ Matrix.Diagonal((sc, sc, sc, 1)))
        light('key', (-4, -5, 5), (0, 2, 0), 4.0, 1000, (0.95, 0.97, 1.0))
        light('rim', (6, 6, 2), (0, 2, 0), 0.6, 1000, (0.85, 0.92, 1.0), size_y=4)
        light('fill', (0, -7, 0.5), (0, 2, 0), 4.0, 120)
        camera((-4.6, -4.4, 0.4), (1.2, 2.6, 0.05), 32, 4.0, focus=5.0)
    else:
        W_, H_ = 4.8, 2.7
        M = T(-0.6, 0.6, 0.35) @ Rz(16) @ Rx(90)
        plane('work', W_, H_, image_mat('jontai', os.path.join(TEX, 'jontai.png'), 1.15, dissolve=0.62), M)
        box('work-back', (W_, H_, 0.02), m.black, M @ T(0, 0, -0.016) @ Matrix.Diagonal((1, 1, 1, 1)), 0)
        for _ in range(3400):   # the right edge of the work, still in parts, drifting off
            u = rnd.uniform(0.72, 1.0) + abs(rnd.gauss(0, 0.16)); v = rnd.uniform(0, 1)
            drift = max(0.0, u - 0.78)
            lx, ly = (u - 0.5) * W_, (v - 0.5) * H_
            lz = rnd.gauss(0, 0.03 + drift * 1.4) + drift * 0.8
            sc = rnd.uniform(0.018, 0.036) * (1 + drift * 0.6)
            put(lib, pick(rnd, KINDS['all']), M @ T(lx + drift * 1.2, ly, lz) @ rand_rot(rnd) @ Matrix.Diagonal((sc, sc, sc, 1)))
        light('key', (-4, -5, 4), (0, 0, 0.3), 4.0, 700, (0.95, 0.97, 1.0))
        light('rim', (5, 4, 2), (0, 0, 0.3), 0.6, 800, (0.85, 0.92, 1.0), size_y=4)
        camera((0.9, -5.6, 0.7), (0.6, 0.6, 0.35), 38, 3.2)
    return s

# ---------------------------------------------------------------- HALL · a night exhibition

def build_hall(key):
    s = K.fresh()
    s.view_settings.exposure = 0.0
    L, Wd, Hh = 58.0, 9.2, 6.6
    conc = bpy.data.materials.new('concrete'); conc.use_nodes = True
    nt = conc.node_tree; b = nt.nodes.get('Principled BSDF')
    tc = nt.nodes.new('ShaderNodeTexCoord'); nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 0.9
    nz.inputs['Detail'].default_value = 8
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    cr = nt.nodes.new('ShaderNodeMix'); cr.data_type = 'RGBA'
    nt.links.new(nz.outputs['Fac'], K._sock(cr, 'Factor_Float'))
    K._sock(cr, 'A_Color').default_value = (0.035, 0.037, 0.04, 1); K._sock(cr, 'B_Color').default_value = (0.075, 0.078, 0.082, 1)
    nt.links.new(K._sock(cr, 'Result_Color', True), b.inputs['Base Color']); setin(b, 'Roughness', 0.9)
    fl = bpy.data.materials.new('hall-floor'); fl.use_nodes = True
    nt = fl.node_tree; b = nt.nodes.get('Principled BSDF')
    setin(b, 'Base Color', (0.02, 0.021, 0.023, 1)); setin(b, 'Specular IOR Level', 0.5)
    tc = nt.nodes.new('ShaderNodeTexCoord'); nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 0.7
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    nt.links.new(_math(nt, 'MULTIPLY_ADD', nz.outputs['Fac'], 0.2, 0.06), b.inputs['Roughness'])
    box('floor', (Wd, L + 4, 0.2), fl, T(0, L / 2, -0.1), 0)
    box('ceiling', (Wd, L + 4, 0.3), conc, T(0, L / 2, Hh + 0.15), 0)
    for sx in (1, -1):
        box(f'wall-{sx}', (0.4, L + 4, Hh), conc, T(sx * (Wd / 2 + 0.2), L / 2, Hh / 2), 0)
    box('end', (Wd, 0.4, Hh), conc, T(0, L, Hh / 2), 0)
    box('back', (Wd, 0.4, Hh), conc, T(0, -2.2, Hh / 2), 0)
    slot = emit('slot', (0.86, 0.9, 0.95), 2.2)
    for i, y in enumerate(range(4, int(L), 6)):
        for sx in (1, -1):
            box(f'pier-{sx}-{i}', (0.5, 0.7, Hh), conc, T(sx * (Wd / 2 - 0.25), y, Hh / 2), 0)
            box(f'slot-{sx}-{i}', (0.03, 0.03, 3.6), slot, T(sx * (Wd / 2 - 0.51), y - 0.36, 2.2), 0)
        box(f'beam-{i}', (Wd, 0.5, 0.45), conc, T(0, y, Hh - 0.22), 0)
    haze(0.012, (Wd - 0.1, L + 2, Hh - 0.1), (0, L / 2, Hh / 2))
    beams_only = bpy.data.collections.new('beams-only'); beams_only.objects.link(bpy.data.objects['haze'])
    def projection(name, img, w, h, M, strength, projector):
        plane(name, w, h, image_mat(name, os.path.join(TEX, img), strength, mode='projection'), M)
        c = M @ Vector((0, 0, 0))
        bm_ = light(f'{name}-beam', projector, tuple(c), 0.4, 0, size_y=0.24, spread=6)
        bm_.data.energy = (c - Vector(projector)).length ** 2 * 5
        try:
            bm_.light_linking.receiver_collection = beams_only
        except Exception as e:
            print('light linking unavailable', e)
    face_end = T(0, L - 0.22, 3.1) @ Rx(90) @ Rz(180) @ Ry(180)
    if key == 1:
        projection('name', 'name.png', 8.4, 8.4 * 1400 / 4096, T(0, L - 0.22, 3.0) @ Rx(90), 4.0, (0, 30.0, Hh - 0.5))
        light('fill', (0, 2, 3), (0, 20, 1), 2.0, 120, (0.85, 0.9, 1.0))
        camera((0.0, 0.6, 1.62), (0, L, 2.55), 26)
    elif key == 2:
        xw = Wd / 2 - 0.02
        for k, (img, y) in enumerate((('digital.png', 19.0), ('security.png', 25.0), ('physical.png', 31.0))):
            M = T(xw, y, 2.5) @ Rz(90) @ Rx(90) @ Matrix.Diagonal((-1, 1, 1, 1))
            projection(f'disc-{k}', img, 3.6, 2.25, M, 6.0, (-3.2, y - 1.4, Hh - 0.6))
        light('fill', (-2, 14, 3), (4, 25, 1.5), 2.0, 160, (0.85, 0.9, 1.0))
        camera((-3.7, 24.2, 1.7), (xw, 25.2, 2.35), 18)
    else:
        xw = -(Wd / 2 - 0.02)
        works = (('lumo.png', 33.0, 1.34), ('jontai.png', 37.8, 4.6), ('cookies.png', 43.6, 4.16))
        for k, (img, y, w) in enumerate(works):
            M = T(xw, y, 2.7) @ Rz(-90) @ Rx(90) @ Matrix.Diagonal((-1, 1, 1, 1))
            projection(f'work-{k}', img, w, 2.6, M, 2.4, (3.4, y + 1.6, Hh - 0.6))
        light('fill', (2, 28, 3), (-4, 38, 1.5), 2.0, 160, (0.85, 0.9, 1.0))
        camera((2.3, 27.6, 1.7), (xw, 39.4, 2.4), 26)
    return s

# ---------------------------------------------------------------- run

BUILD = {'cut': build_cut, 'parts': build_parts, 'hall': build_hall}
if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for job in (ONLY or [f'{i}-{f}' for i in ('cut', 'parts', 'hall') for f in (1, 2, 3) if not (i == 'cut' and f == 3)]):
        idea, f = job.split('-')
        s = BUILD[idea](int(f))
        s.render.filepath = os.path.join(OUT, f'{idea}-{f}.jpg')
        bpy.ops.render.render(write_still=True)
        print('wrote', s.render.filepath, flush=True)
