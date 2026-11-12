# LAB ONLY (throwaway). Round 55: the robot as a slot machine, so the coins make sense going in. One cabinet, in world
# units (the page uses it at scale 1), painted metal and brass, no glass:
#   the head: the squared housing with the flat screen (mesh 'visor', 15.5 x 12.4: the works were on it, then its
#     eyes), a brass bezel, speaker-ears, an antenna with a bulb; a crown of bulbs on top with a plate ('crown_label');
#   the belly: the reel window (empty 'reels': three reels, made by the page), framed in brass, a lamp each side;
#   the deck: one coin slot in its top (empty 'slot'), two buttons, an INSERT COIN plate on its front ('coin_label');
#   the lower body with the payout tray, a plinth;
#   its arm: the lever on its right side, turning on 'lever_pivot' (the rod and the ball are its children).
# Original design. Exports glTF:
#   blender --background --factory-startup --python tools/lab/blender/slotbot.py -- <out.glb> [preview.png]
# Blender is Z up with the front looking along -Y; in the page that is Y up, the front looking along +Z.
import bpy, sys, math

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'slotbot.glb'
PREVIEW = argv[1] if len(argv) > 1 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def material(name, color, metal=0.0, rough=0.4, emit=None, strength=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if 'Coat Weight' in b.inputs: b.inputs['Coat Weight'].default_value = coat
    if emit is not None:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m

BODY = material('body', (0.09, 0.055, 0.16), 0.3, 0.42, coat=0.6)
TRIM = material('trim', (0.78, 0.55, 0.24), 1.0, 0.3)
DARK = material('dark', (0.02, 0.016, 0.03), 0.4, 0.5)
CHROME = material('chrome', (0.86, 0.84, 0.9), 1.0, 0.16)
SCREEN = material('visor', (0, 0, 0), 0, 0.1)
LAMP = material('lamp', (0.05, 0.03, 0.01), 0, 0.5, emit=(1.0, 0.72, 0.3), strength=5)
BULB = material('bulb', (0.05, 0.03, 0.01), 0, 0.4, emit=(1.0, 0.8, 0.45), strength=5)
root = bpy.data.objects.new('slotbot', None)
scene.collection.objects.link(root)
cutters = []

def own(o, mat, smooth=True, parent=None):
    if mat is not None: o.data.materials.append(mat)
    p = parent or root
    o.parent = p
    if parent is not None:
        o.matrix_parent_inverse = parent.matrix_world.inverted()
    if smooth:
        for poly in o.data.polygons: poly.use_smooth = True
    return o

def box(name, size, at, mat, bevel=0.0, segs=4, rot=(0, 0, 0), parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at, rotation=rot)
    o = bpy.context.active_object; o.name = name
    for v in o.data.vertices: v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
    if bevel:
        m = o.modifiers.new('bevel', 'BEVEL'); m.width = bevel; m.segments = segs; m.limit_method = 'ANGLE'
    return own(o, mat, parent=parent)

def cyl(name, r, depth, at, rot, mat, verts=64, bevel=0.0, parent=None):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=verts, location=at, rotation=rot)
    o = bpy.context.active_object; o.name = name
    if bevel:
        m = o.modifiers.new('bevel', 'BEVEL'); m.width = bevel; m.segments = 3; m.limit_method = 'ANGLE'
    return own(o, mat, parent=parent)

def sphere(name, r, at, mat, parent=None, segs=32):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=segs, ring_count=segs // 2, location=at)
    o = bpy.context.active_object; o.name = name
    return own(o, mat, parent=parent)

def cut(target, name, size, at):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    c = bpy.context.active_object; c.name = name
    for v in c.data.vertices: v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
    c.hide_render = True; cutters.append(c)
    m = target.modifiers.new(name, 'BOOLEAN'); m.operation = 'DIFFERENCE'; m.object = c; m.solver = 'EXACT'
    target.modifiers.move(len(target.modifiers) - 1, 0)

def empty(name, at, parent=None, **props):
    e = bpy.data.objects.new(name, None); scene.collection.objects.link(e); e.location = at; e.parent = parent or root
    for k, v in props.items(): e[k] = v
    return e

# In the page: x right, y up (here z), z toward you (here -y). Helper: page coords -> Blender.
P = lambda x, y, z: (x, -z, y)

# ---- the head: housing, the screen in a shallow recess, bezel, ears, antenna
head = box('head', (22.0, 14.0, 17.5), P(0, 0.4, -7.0), BODY, bevel=2.2, segs=8)
cut(head, 'visor_hole', (16.3, 2.0, 13.2), P(0, 0, 0))
bpy.ops.mesh.primitive_grid_add(x_subdivisions=8, y_subdivisions=8, size=1)
vis = bpy.context.active_object; vis.name = 'visor'
for v in vis.data.vertices:
    x, z = v.co.x * 15.5, v.co.y * 12.4
    v.co.x, v.co.y, v.co.z = x, 0.4, z          # page z = -0.4
own(vis, SCREEN)
empty('visor_c', P(0, 0, -0.4), width=15.5, height=12.4)
for nm, size, at in (('bezel_t', (16.9, 0.7, 0.55), P(0, 6.75, 0.05)), ('bezel_b', (16.9, 0.7, 0.55), P(0, -6.75, 0.05)),
                     ('bezel_l', (0.55, 0.7, 13.9), P(-8.2, 0, 0.05)), ('bezel_r', (0.55, 0.7, 13.9), P(8.2, 0, 0.05))):
    box(nm, size, at, TRIM, bevel=0.18)
for sx in (-1, 1):
    cyl(f'ear_{sx}', 2.6, 1.4, P(sx * 11.4, 1.2, -6.0), (0, math.pi / 2, 0), DARK, bevel=0.2)
    cyl(f'ear_ring_{sx}', 2.75, 0.5, P(sx * 12.1, 1.2, -6.0), (0, math.pi / 2, 0), TRIM, bevel=0.12)
    cyl(f'ear_grill_{sx}', 1.6, 0.3, P(sx * 12.3, 1.2, -6.0), (0, math.pi / 2, 0), DARK)
cyl('antenna', 0.16, 3.0, P(-8.0, 13.6, -8.0), (0, 0, 0), TRIM)
sphere('bulb', 0.55, P(-8.0, 15.3, -8.0), LAMP)

# ---- the crown on top: a row of bulbs round a plate (the page writes on 'crown_label' and runs the bulbs)
box('crown', (17.0, 4.0, 3.6), P(0, 10.9, -2.8), BODY, bevel=1.1, segs=6)
box('crown_plate', (12.4, 0.14, 2.0), P(0, 10.9, -0.78), DARK, bevel=0.1)
empty('crown_label', P(0, 10.9, -0.68), width=12.0, height=1.8)
N = 13
for i in range(N):
    x = -7.2 + 14.4 * i / (N - 1)
    sphere(f'bulbm_{i:02d}', 0.3, P(x, 12.45, -0.9), BULB, segs=16)
for sx in (-1, 1):
    for k in range(2):
        sphere(f'bulbm_s{sx}_{k}', 0.3, P(sx * 7.75, 11.6 - k * 1.25, -0.9), BULB, segs=16)

# ---- the belly: the reel window, brass frame, a lamp each side; a brass waist under the head
box('waist', (20.6, 12.6, 0.6), P(0, -8.75, -5.6), TRIM, bevel=0.2)
belly = box('belly', (21.0, 12.0, 12.4), P(0, -15.25, -5.6), BODY, bevel=1.6, segs=6)
cut(belly, 'reel_cut', (14.6, 8.0, 6.6), P(0, -14.0, -3.6))
for nm, size, at in (('reelf_t', (15.6, 0.7, 0.55), P(0, -10.45, 0.55)), ('reelf_b', (15.6, 0.7, 0.55), P(0, -17.55, 0.55)),
                     ('reelf_l', (0.55, 0.7, 7.6), P(-7.55, -14.0, 0.55)), ('reelf_r', (0.55, 0.7, 7.6), P(7.55, -14.0, 0.55))):
    box(nm, size, at, TRIM, bevel=0.16)
for sx in (-1, 1):
    box(f'reel_div_{sx}', (0.22, 7.6, 6.6), P(sx * 2.42, -14.0, -3.9), DARK)
    cyl(f'reel_lamp_{sx}', 0.62, 0.4, P(sx * 9.1, -14.0, 0.5), (math.pi / 2, 0, 0), LAMP)
    cyl(f'reel_lamp_ring_{sx}', 0.82, 0.3, P(sx * 9.1, -14.0, 0.42), (math.pi / 2, 0, 0), TRIM, bevel=0.06)
empty('reels', P(0, -14.0, -3.5), radius=3.6, width=4.5, step=4.84)

# ---- the deck: the coin slot in its top, two buttons, INSERT COIN on its front
DECK_TOP = -20.6
box('deck', (20.6, 4.8, 1.8), P(0, DECK_TOP - 0.9, 1.6), BODY, bevel=0.45)
deck = bpy.data.objects['deck']
cut(deck, 'slot_cut', (3.4, 0.5, 4.0), P(0, DECK_TOP, 1.9))
box('slot_rim_f', (3.8, 0.12, 0.14), P(0, DECK_TOP + 0.04, 2.23), TRIM)
box('slot_rim_b', (3.8, 0.12, 0.14), P(0, DECK_TOP + 0.04, 1.57), TRIM)
box('slot_rim_l', (0.14, 0.78, 0.14), P(-1.83, DECK_TOP + 0.04, 1.9), TRIM)
box('slot_rim_r', (0.14, 0.78, 0.14), P(1.83, DECK_TOP + 0.04, 1.9), TRIM)
empty('slot', P(0, DECK_TOP, 1.9), length=3.4, width=0.5)
for sx in (-1, 1):
    cyl(f'btn_ring_{sx}', 1.0, 0.2, P(sx * 6.4, DECK_TOP + 0.08, 1.9), (0, 0, 0), TRIM, bevel=0.05)
    cyl(f'btn_{sx}', 0.78, 0.36, P(sx * 6.4, DECK_TOP + 0.2, 1.9), (0, 0, 0), LAMP, bevel=0.08)
box('coin_plate', (5.6, 0.12, 1.0), P(0, DECK_TOP - 0.95, 4.02), DARK, bevel=0.08)
empty('coin_label', P(0, DECK_TOP - 0.95, 4.1), width=5.4, height=0.9)

# ---- the lower body: the payout tray; a plinth
lower = box('lower', (19.6, 11.0, 9.6), P(0, -27.2, -5.0), BODY, bevel=1.4, segs=6)
cut(lower, 'tray_cut', (9.0, 4.0, 2.8), P(0, -27.6, 0.6))
box('tray_lip', (9.8, 0.5, 0.4), P(0, -29.0, 0.75), TRIM, bevel=0.12)
box('tray_floor', (9.0, 2.0, 0.2), P(0, -28.95, -0.2), TRIM)
box('plinth', (21.6, 12.6, 2.4), P(0, -33.1, -5.0), DARK, bevel=0.6)

# ---- its arm: the lever on its right, turning about x on the pivot
cyl('lever_hub', 1.7, 1.8, P(11.4, -14.0, -5.0), (0, math.pi / 2, 0), TRIM, bevel=0.15)
cyl('lever_hub_cap', 1.1, 0.5, P(12.45, -14.0, -5.0), (0, math.pi / 2, 0), DARK, bevel=0.08)
pivot = empty('lever_pivot', P(13.0, -14.0, -5.0))
bpy.context.view_layer.update()
cyl('lever_rod', 0.42, 9.6, P(13.0, -9.2, -5.0), (0, 0, 0), CHROME, verts=32, parent=pivot)
cyl('lever_collar', 0.62, 0.9, P(13.0, -13.1, -5.0), (0, 0, 0), TRIM, verts=32, bevel=0.08, parent=pivot)
sphere('lever_knob', 1.45, P(13.0, -3.6, -5.0), TRIM, parent=pivot)
bpy.ops.mesh.primitive_torus_add(major_radius=1.35, minor_radius=0.18, location=P(13.0, -3.6, -5.0))
t = bpy.context.active_object; t.name = 'lever_knob_ring'; own(t, DARK, parent=pivot)

if PREVIEW:
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam)
    cam.location = P(26, -8, 78); cam.rotation_euler = (math.radians(90), 0, math.radians(18)); scene.camera = cam; cam.data.lens = 50
    for nm, loc, power, col in (('key', P(-30, 25, 40), 160000, (1, 0.95, 0.9)), ('rim', P(35, 15, -20), 120000, (0.6, 0.45, 1.0)), ('fill', P(0, -20, 40), 40000, (1, 0.8, 0.6))):
        l = bpy.data.objects.new(nm, bpy.data.lights.new(nm, 'POINT')); l.data.energy = power; l.data.color = col; l.location = loc; scene.collection.objects.link(l)
    world = bpy.data.worlds.new('w'); world.use_nodes = True; world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.01, 0.008, 0.015, 1); scene.world = world
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else ('BLENDER_EEVEE' if 'BLENDER_EEVEE' in engines else 'CYCLES')
    scene.render.resolution_x, scene.render.resolution_y = 900, 1300
    scene.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)
    for nm in ('cam', 'key', 'rim', 'fill'):
        bpy.data.objects.remove(bpy.data.objects[nm])

bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    o.select_set(o not in cutters)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_cameras=False, export_lights=False, export_extras=True)
print('EXPORTED', OUT)
