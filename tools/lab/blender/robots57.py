# LAB ONLY (throwaway). Round 57: three robot designs whose own shape makes the way into the brain seamless. The
# brain section opens on the site's gold octagon shaft with a glowing orb in the middle, so each head holds that shaft:
#   tv:   a coin-op TV robot. Its studies are channels 02 to 05; at the end the picture collapses to one bright dot,
#         and the dot is the orb: inside the tube, the gold rings.
#   lens: a robot with one camera-lens eye (it was watching: the works were what it saw). Its eight-blade aperture
#         opens into an octagon, and the barrel's rings carry on as the shaft.
#   oct:  an octagon-headed robot. Its face frame is the shaft's first ring; the face goes dark and the rings inside
#         its head light one after another.
# Original designs, in the site's purple and gold. Renders concept stills (Eevee), no export:
#   blender --background --factory-startup --python tools/lab/blender/robots57.py -- <out-dir>
# Blender is Z up with the front looking along -Y; in the page that is Y up, the front looking along +Z.
import bpy, sys, math, os
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '.'
ONLY = argv[1].split(',') if len(argv) > 1 else None
P = lambda x, y, z: (x, -z, y)
FONT = 'C:/Windows/Fonts/consolab.ttf'

def fresh():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    s.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else 'BLENDER_EEVEE'
    s.render.resolution_x, s.render.resolution_y = 1440, 810
    s.render.image_settings.file_format = 'JPEG'
    s.render.image_settings.quality = 92
    try: s.eevee.taa_render_samples = 48
    except Exception: pass
    w = bpy.data.worlds.new('w'); w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.008, 0.005, 0.014, 1)
    s.world = w
    for nm, loc, power, col in (('key', P(-30, 25, 40), 160000, (1, 0.93, 0.85)), ('rim', P(35, 15, -20), 120000, (0.6, 0.45, 1.0)), ('fill', P(0, -20, 40), 40000, (1, 0.8, 0.6))):
        l = bpy.data.objects.new(nm, bpy.data.lights.new(nm, 'POINT')); l.data.energy = power; l.data.color = col; l.location = loc; s.collection.objects.link(l)
    return s

def material(name, color, metal=0.0, rough=0.4, emit=None, strength=0.0, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if 'Coat Weight' in b.inputs: b.inputs['Coat Weight'].default_value = coat
    if emit is not None:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m

def halo(name, color, strength):
    """A soft round glow: emission fading to transparent from the middle (drawn on a plane facing you)."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Location'].default_value = (-1.0, -1.0, 0); mp.inputs['Scale'].default_value = (2, 2, 1)
    gr = nt.nodes.new('ShaderNodeTexGradient'); gr.gradient_type = 'SPHERICAL'
    sc = nt.nodes.new('ShaderNodeMath'); sc.operation = 'MULTIPLY'; sc.inputs[1].default_value = 1.0
    pw = nt.nodes.new('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = 2.6
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Color'].default_value = (*color, 1); em.inputs['Strength'].default_value = strength
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(tc.outputs['UV'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], gr.inputs['Vector'])
    nt.links.new(gr.outputs['Fac'], sc.inputs[0]); nt.links.new(sc.outputs[0], pw.inputs[0])
    nt.links.new(pw.outputs[0], mix.inputs['Fac']); nt.links.new(tr.outputs[0], mix.inputs[1]); nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    try: m.surface_render_method = 'BLENDED'
    except Exception: pass
    return m

def lens_glass():
    m = material('lens_glass', (0.02, 0.015, 0.04), 0.0, 0.04, coat=1.0)
    m.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value = 0.28
    try: m.surface_render_method = 'BLENDED'
    except Exception: pass
    return m

def mats():
    return dict(
        BODY=material('body', (0.09, 0.055, 0.16), 0.3, 0.42, coat=0.6),
        TRIM=material('trim', (0.78, 0.55, 0.24), 1.0, 0.3),
        DARK=material('dark', (0.02, 0.016, 0.03), 0.4, 0.5),
        GLASS=material('glass', (0.012, 0.01, 0.02), 0.0, 0.05, coat=1.0),
        GOLD=material('gold_lit', (0.05, 0.03, 0.01), 0, 0.5, emit=(1.0, 0.62, 0.24), strength=2.6),
        LAMP=material('lamp', (0.05, 0.03, 0.01), 0, 0.5, emit=(1.0, 0.72, 0.3), strength=4),
        WHITE=material('white_lit', (0.05, 0.05, 0.05), 0, 0.5, emit=(1.0, 0.9, 0.75), strength=10),
        LENSGLASS=lens_glass(),
    )

def link(o):
    bpy.context.scene.collection.objects.link(o) if o.name not in bpy.context.scene.collection.objects else None
    return o

def own(o, mat, smooth=True):
    if mat is not None: o.data.materials.append(mat)
    if smooth and hasattr(o.data, 'polygons'):
        for p in o.data.polygons: p.use_smooth = True
    return o

def box(name, size, at, mat, bevel=0.0, segs=4, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at, rotation=rot)
    o = bpy.context.active_object; o.name = name
    for v in o.data.vertices: v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
    if bevel:
        m = o.modifiers.new('bevel', 'BEVEL'); m.width = bevel; m.segments = segs; m.limit_method = 'ANGLE'
    return own(o, mat)

def cyl(name, r, depth, at, rot, mat, verts=64, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=verts, location=at, rotation=rot)
    o = bpy.context.active_object; o.name = name
    if bevel:
        m = o.modifiers.new('bevel', 'BEVEL'); m.width = bevel; m.segments = 3; m.limit_method = 'ANGLE'
    return own(o, mat)

def sphere(name, r, at, mat, segs=32):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=segs, ring_count=segs // 2, location=at)
    o = bpy.context.active_object; o.name = name
    return own(o, mat)

def ring8(name, R, r, at, mat):
    """An octagon ring facing you, flat side on top."""
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=8, minor_segments=8, location=at, rotation=(math.pi / 2, math.pi / 8, 0))
    o = bpy.context.active_object; o.name = name
    return own(o, mat, smooth=False)

def cut(target, name, size, at, shape='box', rot=(0, 0, 0), verts=64, first=True):
    if shape == 'box':
        bpy.ops.mesh.primitive_cube_add(size=1, location=at, rotation=rot)
        c = bpy.context.active_object
        for v in c.data.vertices: v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
    else:
        bpy.ops.mesh.primitive_cylinder_add(radius=size[0], depth=size[1], vertices=verts, location=at, rotation=rot)
        c = bpy.context.active_object
    c.name = name; c.hide_render = True; c.hide_viewport = True
    m = target.modifiers.new(name, 'BOOLEAN'); m.operation = 'DIFFERENCE'; m.object = c; m.solver = 'EXACT'
    if first: target.modifiers.move(len(target.modifiers) - 1, 0)

def text(name, body, at, size, mat, align='CENTER'):
    cu = bpy.data.curves.new(name, 'FONT'); cu.body = body; cu.font = bpy.data.fonts.load(FONT, check_existing=True)
    cu.align_x = align; cu.align_y = 'CENTER'; cu.size = size; cu.extrude = 0.01
    o = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(o)
    o.location = at; o.rotation_euler = (math.pi / 2, 0, 0)
    cu.materials.append(mat)
    return o

def plane_glow(name, at, size, color, strength):
    bpy.ops.mesh.primitive_plane_add(size=size, location=at, rotation=(math.pi / 2, 0, 0))
    o = bpy.context.active_object; o.name = name
    o.data.materials.append(halo(name + '_m', color, strength))
    return o

def eyes(prefix, mat, dx=3.1, y=0.8, z=0.05, h=5.0):
    return [box(f'{prefix}_eye_{s}', (2.4, 0.25, h), P(s * dx, y, z), mat, bevel=1.1, segs=6) for s in (-1, 1)]

def legs(x0, top, M):
    for s in (-1, 1):
        cyl(f'leg_{s}', 1.0, 3.6, P(x0 + s * 3.8, top - 1.8, -7.0), (0, 0, 0), M['TRIM'], verts=32, bevel=0.1)
        box(f'foot_{s}', (4.2, 5.4, 1.4), P(x0 + s * 3.8, top - 4.2, -6.4), M['DARK'], bevel=0.5)

def tunnel(prefix, z0, n, R0, R1, step, M, y=0.0, orb_z=None):
    rings = [ring8(f'{prefix}_ring_{i}', R0 + (R1 - R0) * i / max(1, n - 1), 0.07, P(0, y, z0 - i * step), M['GOLD']) for i in range(n)]
    oz = orb_z if orb_z is not None else z0 - n * step
    rings.append(sphere(f'{prefix}_orb', 0.55, P(0, y, oz), M['WHITE']))
    rings.append(plane_glow(f'{prefix}_orbglow', P(0, y, oz + 0.2), 9.0, (1.0, 0.8, 0.55), 6.0))
    return rings

def camera(loc, target, lens=35):
    s = bpy.context.scene
    cam = s.camera or bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    if cam.name not in s.collection.objects: s.collection.objects.link(cam)
    s.camera = cam
    cam.data.lens = lens
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()

def shoot(name, show=(), hide=()):
    for o in show: o.hide_render = False
    for o in hide: o.hide_render = True
    s = bpy.context.scene
    s.render.filepath = os.path.join(OUT, name + '.jpg')
    bpy.ops.render.render(write_still=True)
    print('RENDERED', name)

# =========================================================================================== the coin-op TV robot
def tv():
    fresh(); M = mats()
    # the set: a deep cabinet (screen left, controls right), the tube's hump behind, rabbit-ear antennas, a jaw with the slot
    head = box('head', (27.0, 18.0, 17.0), P(2.75, 0.4, -8.0), M['BODY'], bevel=2.4, segs=8)
    cut(head, 'tube_cut', (15.9, 16.5, 12.8), P(0, 0, -7.0))
    box('hump', (16.0, 11.0, 12.0), P(2.0, 0.6, -19.5), M['BODY'], bevel=3.0, segs=6)
    for nm, size, at in (('bz_t', (17.2, 0.9, 0.7), P(0, 6.75, 0.6)), ('bz_b', (17.2, 0.9, 0.7), P(0, -6.75, 0.6)),
                         ('bz_l', (0.7, 0.9, 14.2), P(-8.25, 0, 0.6)), ('bz_r', (0.7, 0.9, 14.2), P(8.25, 0, 0.6))):
        box(nm, size, at, M['TRIM'], bevel=0.3, segs=4)
    screen = box('screen', (15.6, 0.1, 12.5), P(0, 0, -0.4), M['GLASS'])
    # the control column: the channel dial (its studies are channels), a small knob, a speaker
    dial = cyl('dial', 2.3, 1.0, P(12.3, 3.2, 1.0), (math.pi / 2, 0, 0), M['TRIM'], bevel=0.12)
    cyl('dial_cap', 1.5, 1.5, P(12.3, 3.2, 1.3), (math.pi / 2, 0, 0), M['DARK'], bevel=0.1)
    ptr = box('dial_ptr', (0.28, 0.2, 1.3), P(12.3, 3.95, 2.1), M['GOLD'])
    for k in range(4):
        a = math.radians(135 - k * 30)
        box(f'tick_{k}', (0.18, 0.1, 0.6), P(12.3 + math.cos(a) * 3.0, 3.2 + math.sin(a) * 3.0, 0.95), M['GOLD'], rot=(0, -(a - math.pi / 2), 0))
    cyl('knob', 1.1, 1.0, P(12.3, -1.6, 1.0), (math.pi / 2, 0, 0), M['TRIM'], bevel=0.1)
    for k in range(5):
        box(f'grille_{k}', (4.2, 0.2, 0.25), P(12.3, -4.4 - k * 0.65, 0.95), M['DARK'])
    # the jaw: the coin slot on top, INSERT COIN on its front
    jaw = box('jaw', (12.0, 3.8, 1.8), P(0, -7.75, 2.1), M['BODY'], bevel=0.45)
    cut(jaw, 'slot_cut', (3.4, 0.5, 4.0), P(0, -6.85, 2.3))
    box('slot_rim', (3.9, 0.9, 0.12), P(0, -6.8, 2.3), M['TRIM'])
    box('coin_plate', (5.6, 0.12, 1.0), P(0, -7.75, 4.02), M['DARK'], bevel=0.06)
    text('coin_txt', 'INSERT COIN', P(0, -7.75, 4.1), 0.62, M['LAMP'])
    # rabbit ears
    cyl('ear_base', 1.6, 1.2, P(2.75, 9.9, -8.0), (0, 0, 0), M['TRIM'], bevel=0.3)
    for s in (-1, 1):
        a = math.radians(24 * s)
        cyl(f'ear_{s}', 0.13, 9.0, P(2.75 + math.sin(a) * 4.5, 10.5 + math.cos(a) * 4.5, -8.0), (0, a, 0), M['TRIM'], verts=16)
        sphere(f'ear_tip_{s}', 0.45, P(2.75 + math.sin(a) * 9.0, 10.5 + math.cos(a) * 9.0, -8.0), M['LAMP'])
    box('torso', (15.0, 10.0, 8.0), P(2.75, -13.0, -7.5), M['BODY'], bevel=1.6, segs=6)
    box('waist', (16.0, 10.6, 0.5), P(2.75, -8.9, -7.5), M['TRIM'], bevel=0.15)
    legs(2.75, -17.0, M)
    # what the screen shows
    face = eyes('tv', M['GOLD'], z=-0.25)
    ch = [text('ch_n', 'CH 03', P(0, 2.4, -0.25), 3.4, M['GOLD']), text('ch_t', 'GAME & APP', P(0, -1.6, -0.25), 1.55, M['GOLD']), text('ch_t2', 'DEVELOPMENT', P(0, -3.6, -0.25), 1.55, M['GOLD'])]
    line = box('crt_line', (15.0, 0.1, 0.12), P(0, 0, -0.25), M['WHITE'])
    dot = [sphere('crt_dot', 0.28, P(0, 0, -0.2), M['WHITE']), plane_glow('crt_glow', P(0, 0, -0.1), 6.0, (1.0, 0.82, 0.55), 5.0)]
    inside = tunnel('tv', -1.5, 8, 6.2, 3.2, 1.8, M, orb_z=-14.8)
    for o in ch + [line] + dot + inside: o.hide_render = True
    camera(P(-17, 3, 62), P(2.5, -3.0, -6.0))
    shoot('robots57-tv-1')
    camera(P(-10, 3, 40), P(1.5, -1.0, -2.0))
    dial.rotation_euler[1] = math.radians(-30); ptr.hide_render = True
    shoot('robots57-tv-2', show=ch, hide=face)
    camera(P(0, -0.6, 27), P(0, -0.6, 0))
    shoot('robots57-tv-3', show=dot, hide=ch)
    camera(P(0, 0, 19.0), P(0, 0, -10))
    shoot('robots57-tv-4', show=inside + dot[1:], hide=[screen, dot[0]])

# =========================================================================================== the lens robot
def lens():
    fresh(); M = mats()
    head = box('head', (22.0, 18.0, 15.0), P(0, 0.4, -7.5), M['BODY'], bevel=2.6, segs=8)
    cut(head, 'eye_cut', (6.2, 16.0), P(0, 0, -6.0), shape='cyl', rot=(math.pi / 2, 0, 0), first=False)
    # the barrel: mount, a dark knurled body, a brass focus ring, the front ring
    mount = cyl('mount', 8.0, 1.0, P(0, 0, 0.4), (math.pi / 2, 0, 0), M['TRIM'], bevel=0.12)
    cut(mount, 'mount_cut', (6.2, 4.0), P(0, 0, 0.4), shape='cyl', rot=(math.pi / 2, 0, 0))
    barrel = cyl('barrel', 7.3, 3.4, P(0, 0, 2.5), (math.pi / 2, 0, 0), M['DARK'], verts=96, bevel=0.1)
    cut(barrel, 'barrel_cut', (6.2, 8.0), P(0, 0, 2.5), shape='cyl', rot=(math.pi / 2, 0, 0))
    for k in range(48):
        a = k / 48 * math.pi * 2
        box(f'knurl_{k}', (0.16, 1.6, 0.16), P(math.cos(a) * 7.35, math.sin(a) * 7.35, 2.0), M['TRIM'], rot=(0, -a, 0))
    focus = cyl('focus', 7.55, 0.9, P(0, 0, 3.6), (math.pi / 2, 0, 0), M['TRIM'], verts=96, bevel=0.1)
    cut(focus, 'focus_cut', (6.3, 4.0), P(0, 0, 3.6), shape='cyl', rot=(math.pi / 2, 0, 0))
    front = cyl('front', 7.0, 0.5, P(0, 0, 4.25), (math.pi / 2, 0, 0), M['TRIM'], verts=96, bevel=0.08)
    cut(front, 'front_cut', (6.2, 4.0), P(0, 0, 4.25), shape='cyl', rot=(math.pi / 2, 0, 0))
    glass = cyl('glass', 6.25, 0.08, P(0, 0, 3.9), (math.pi / 2, 0, 0), M['LENSGLASS'], verts=96)
    # eight blades make an octagon; `a` is how far open
    def aperture(a, z=1.2):
        out = []
        for k in range(8):
            th = math.radians(22.5 + k * 45)
            cx, cy = math.cos(th) * (a + 2.1), math.sin(th) * (a + 2.1)
            b = box(f'blade_{a}_{k}', (6.0, 0.06, 4.2), P(cx, cy, z - k * 0.012), M['DARK'], rot=(0, -(th - math.pi / 2), 0))
            out.append(b)
        return out
    small, wide = aperture(2.2), aperture(4.6)
    glow = [cyl('eye_glow', 3.2, 0.05, P(0, 0, 0.6), (math.pi / 2, 0, 0), M['GOLD'], verts=48), plane_glow('eye_halo', P(0, 0, 0.9), 9.0, (1.0, 0.78, 0.45), 2.5)]
    glyph = text('eye_glyph', '</>', P(0, 0, 0.9), 2.6, M['WHITE'])
    # under the lens: a strip that names what it focuses on
    box('strip', (13.0, 0.2, 1.6), P(0, -13.0, -2.95), M['DARK'], bevel=0.08)
    strip = text('strip_txt', '02  SOFTWARE ENGINEERING', P(0, -13.0, -2.8), 0.74, M['GOLD'])
    for s in (-1, 1):
        cyl(f'ear_{s}', 2.2, 1.2, P(s * 11.3, 2.0, -7.0), (0, math.pi / 2, 0), M['TRIM'], bevel=0.15)
    cyl('antenna', 0.16, 3.4, P(-6.0, 11.2, -8.0), (0, 0, 0), M['TRIM'])
    sphere('bulb', 0.55, P(-6.0, 13.1, -8.0), M['LAMP'])
    box('torso', (15.0, 10.0, 9.0), P(0, -13.5, -7.5), M['BODY'], bevel=1.6, segs=6)
    box('waist', (16.0, 10.6, 0.5), P(0, -8.9, -7.5), M['TRIM'], bevel=0.15)
    ledge = box('ledge', (9.0, 3.4, 1.4), P(0, -10.4, -1.6), M['BODY'], bevel=0.35)
    cut(ledge, 'slot_cut', (3.4, 0.5, 4.0), P(0, -9.7, -1.4))
    box('slot_rim', (3.9, 0.9, 0.12), P(0, -9.66, -1.4), M['TRIM'])
    legs(0, -18.0, M)
    inside = tunnel('lens', -0.5, 7, 5.6, 3.0, 1.9, M, orb_z=-13.3)
    for o in wide + [glyph, strip] + inside: o.hide_render = True
    camera(P(-17, 4, 60), P(0, -3.0, -5.0))
    shoot('robots57-lens-1')
    camera(P(-7, 2, 34), P(0, -1.5, 0))
    shoot('robots57-lens-2', show=[glyph, strip], hide=glow[1:])
    camera(P(0, 0, 16), P(0, 0, -5))
    shoot('robots57-lens-3', show=wide + inside, hide=small + glow + [glyph, glass])

# =========================================================================================== the octagon robot
def oct8():
    fresh(); M = mats()
    head = cyl('head', 10.6, 13.0, P(0, 0.4, -6.5), (math.pi / 2, math.pi / 8, 0), M['BODY'], verts=8, bevel=1.2)
    cut(head, 'face_cut', (8.6, 22.0), P(0, 0.4, -6.0), shape='cyl', rot=(math.pi / 2, math.pi / 8, 0), verts=8)
    bpy.ops.mesh.primitive_cylinder_add(radius=8.7, depth=0.6, vertices=8, location=P(0, 0.4, -12.6), rotation=(math.pi / 2, math.pi / 8, 0))
    own(bpy.context.active_object, M['DARK'], smooth=False).name = 'back_wall'
    ring8('bezel', 9.0, 0.5, P(0, 0.4, 0.3), M['TRIM'])
    screen = cyl('screen', 8.6, 0.08, P(0, 0.4, -0.5), (math.pi / 2, math.pi / 8, 0), M['GLASS'], verts=8)
    # eight light strips round the face: two light for each study played
    R = 8.15
    segs = []
    for k in range(8):
        a = math.radians(k * 45)
        mx, my = math.cos(a) * R * math.cos(math.radians(22.5)), math.sin(a) * R * math.cos(math.radians(22.5))
        segs.append(box(f'seg_{k}', (0.32, 0.25, 2 * R * math.sin(math.radians(22.5)) * 0.82), P(mx, 0.4 + my, 0.15), M['GOLD'], rot=(0, -a, 0)))
    face = eyes('oct', M['GOLD'], y=1.0, z=-0.35)
    st = [text('st_n', '03', P(0, 3.2, -0.35), 3.6, M['GOLD']), text('st_t', 'GAME & APP', P(0, -1.0, -0.35), 1.5, M['GOLD']), text('st_t2', 'DEVELOPMENT', P(0, -3.0, -0.35), 1.5, M['GOLD'])]
    for s in (-1, 1):
        cyl(f'ear_{s}', 2.6, 1.4, P(s * 11.2, 0.4, -6.5), (0, math.pi / 2, math.pi / 8), M['DARK'], verts=8, bevel=0.15)
        cyl(f'ear_ring_{s}', 2.8, 0.5, P(s * 11.9, 0.4, -6.5), (0, math.pi / 2, math.pi / 8), M['TRIM'], verts=8, bevel=0.1)
    cyl('antenna', 0.16, 3.6, P(5.0, 11.8, -7.0), (0, 0, 0), M['TRIM'])
    sphere('bulb', 0.55, P(5.0, 13.8, -7.0), M['LAMP'])
    jaw = box('jaw', (11.0, 3.8, 1.8), P(0, -9.2, 1.6), M['BODY'], bevel=0.45)
    cut(jaw, 'slot_cut', (3.4, 0.5, 4.0), P(0, -8.3, 1.8))
    box('slot_rim', (3.9, 0.9, 0.12), P(0, -8.25, 1.8), M['TRIM'])
    box('torso', (15.0, 9.0, 8.0), P(0, -14.6, -7.0), M['BODY'], bevel=1.6, segs=6)
    box('waist', (16.0, 10.0, 0.5), P(0, -10.4, -7.0), M['TRIM'], bevel=0.15)
    legs(0, -19.0, M)
    inside = tunnel('oct', -1.4, 7, 7.6, 4.6, 1.6, M, y=0.4, orb_z=-12.2)
    for o in st + inside + segs: o.hide_render = True
    camera(P(-17, 4, 60), P(0, -3.0, -5.0))
    shoot('robots57-oct-1', show=segs[:0])
    camera(P(-7, 2, 34), P(0, -1.0, 0))
    shoot('robots57-oct-2', show=st + segs[:6], hide=face)
    camera(P(0, 0.4, 17), P(0, 0.4, -5))
    shoot('robots57-oct-3', show=inside + segs, hide=st + [screen])

for name, fn in (('tv', tv), ('lens', lens), ('oct', oct8)):
    if ONLY is None or name in ONLY:
        fn()
print('DONE')
