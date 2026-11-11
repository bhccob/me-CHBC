# LAB ONLY (throwaway). The colossus, round 44: a digital machine-head. A smooth black helmet whose face is one big
# curved screen (the page draws a dot-matrix face on the mesh 'screen'), set in a glossy face plate; under it a jaw with
# ONE coin slot in its top (empty 'slot' marks the opening; the coins drop in face-on, edge first), four pips on the
# jaw's front that light per coin, a crest with a light seam, fins at the sides and a halo above. Exports glTF:
#   blender --background --factory-startup --python tools/lab/blender/head2.py -- <out.glb> [preview.png]
# Blender is Z up with the face looking along -Y; in the page that is Y up, the face looking along +Z.
import bpy, sys, math

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'head2.glb'
PREVIEW = argv[1] if len(argv) > 1 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def material(name, color, metal, rough, emit=None, strength=0.0, coat=0.0):
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

SHELL = material('shell', (0.03, 0.027, 0.036), 0.7, 0.16, coat=1.0)
PLATE = material('plate', (0.012, 0.011, 0.016), 0.2, 0.05, coat=1.0)
TRIM = material('trim', (0.16, 0.15, 0.19), 1.0, 0.22, coat=1.0)
SEAM = material('seam', (0.02, 0.01, 0.03), 0.0, 0.5, emit=(0.62, 0.42, 1.0), strength=4.0)
RIM = material('rim', (0.05, 0.03, 0.01), 0.0, 0.5, emit=(1.0, 0.7, 0.25), strength=5.0)
SLOTGLOW = material('slotglow', (0.05, 0.03, 0.01), 0.0, 0.5, emit=(1.0, 0.7, 0.25), strength=8.0)
PIP = material('pip', (0.02, 0.02, 0.02), 0.0, 0.5, emit=(1.0, 0.7, 0.25), strength=1.0)
SCREEN = material('screen', (0.0, 0.0, 0.0), 0.0, 0.1)
HIDE = material('hide', (0, 0, 0), 0, 1)
cutters = []

def mods(o, bevel=0.0, segs=3, subsurf=0, bend=0.0, bend_axis='Z', taper=0.0, taper_axis='Z'):
    if bevel > 0:
        m = o.modifiers.new('bevel', 'BEVEL'); m.width = bevel; m.segments = segs; m.limit_method = 'ANGLE'
    if taper:
        m = o.modifiers.new('taper', 'SIMPLE_DEFORM'); m.deform_method = 'TAPER'; m.factor = taper; m.deform_axis = taper_axis
    if bend:
        m = o.modifiers.new('bend', 'SIMPLE_DEFORM'); m.deform_method = 'BEND'; m.angle = bend; m.deform_axis = bend_axis
    if subsurf:
        m = o.modifiers.new('smooth', 'SUBSURF'); m.levels = subsurf; m.render_levels = subsurf
    for p in o.data.polygons: p.use_smooth = True

def box(name, size, at=(0, 0, 0), rot=(0, 0, 0), mat=SHELL, parent=None, cuts=0, **kw):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.name = name
    if cuts:
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.subdivide(number_cuts=cuts); bpy.ops.object.mode_set(mode='OBJECT')
    for v in o.data.vertices:
        v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
    o.location = at
    o.rotation_euler = rot
    o.data.materials.append(mat)
    if parent: o.parent = parent
    mods(o, **kw)
    return o

def cut(target, name, size, at, rot=(0, 0, 0)):
    c = box(name, size, at=at, rot=rot, mat=HIDE)
    c.display_type = 'WIRE'
    c.hide_render = True
    cutters.append(c)
    m = target.modifiers.new(f'cut_{name}', 'BOOLEAN'); m.operation = 'DIFFERENCE'; m.object = c; m.solver = 'EXACT'
    target.modifiers.move(len(target.modifiers) - 1, 0)
    return c

def cyl(name, r, depth, at, rot=(math.pi / 2, 0, 0), mat=TRIM, parent=None, verts=64, **kw):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=verts, location=at, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(mat)
    if parent: o.parent = parent
    mods(o, **kw)
    return o

def torus(name, R, r, at, rot=(0, 0, 0), mat=SEAM, parent=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=180, minor_segments=12, location=at, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(mat)
    if parent: o.parent = parent
    for p in o.data.polygons: p.use_smooth = True
    return o

def empty(name, at, parent, **props):
    e = bpy.data.objects.new(name, None)
    scene.collection.objects.link(e)
    e.location = at
    e.parent = parent
    for k, v in props.items(): e[k] = v
    return e

def curved_panel(name, w, h, at, bend, mat, parent, nx=48, ny=24, thick=0.0):
    """A plane with clean 0..1 UVs, stood up to face -Y and bent round the vertical, its sides going back."""
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=nx, y_subdivisions=ny, size=1)
    o = bpy.context.active_object
    o.name = name
    for v in o.data.vertices:
        x, y = v.co.x * w, v.co.y * h
        a = x / (w / 2) * bend / 2          # angle along the arc
        R = (w / 2) / (bend / 2)
        v.co.x = math.sin(a) * R
        v.co.y = R - math.cos(a) * R        # sides go back (+Y)
        v.co.z = y
    # The grid faced +Z; mapping its y to z turns that to -Y, toward the viewer, winding and all.
    o.location = at
    o.data.materials.append(mat)
    o.parent = parent
    for p in o.data.polygons: p.use_smooth = True
    if thick:
        m = o.modifiers.new('solid', 'SOLIDIFY'); m.thickness = thick; m.offset = -1.0
        m = o.modifiers.new('bevel', 'BEVEL'); m.width = 0.06; m.segments = 3; m.limit_method = 'ANGLE'
    return o

head = bpy.data.objects.new('head', None)
scene.collection.objects.link(head)

# ---- the helmet: one smooth shape, broad at the brow, a flat face, narrowing to the jaw
bpy.ops.mesh.primitive_uv_sphere_add(segments=128, ring_count=64, radius=1)
shell = bpy.context.active_object
shell.name = 'shell'
P = 3.2  # a superellipsoid: between a sphere and a rounded box
for v in shell.data.vertices:
    n = v.co.normalized()
    k = (abs(n.x) ** P + abs(n.y) ** P + abs(n.z) ** P) ** (-1 / P)
    x, y, z = n.x * k * 3.75, n.y * k * 3.4, n.z * k * 4.1
    if y < -2.95: y = -2.95 + (y + 2.95) * 0.25                  # a flat face
    if z < 0: x *= 1 - 0.16 * (-z / 4.1); y = y * (1 - 0.08 * (-z / 4.1))  # narrower toward the jaw
    if z > 3.2: z = 3.2 + (z - 3.2) * 0.75                       # a flatter crown
    v.co.x, v.co.y, v.co.z = x, y, z
shell.data.materials.append(SHELL)
shell.parent = head
for p in shell.data.polygons: p.use_smooth = True

# ---- the face: a glossy black plate, the screen set in it, a fine light round it
SW, SH, SB = 5.3, 3.1, 0.62
FZ, FY = 0.9, -3.14
curved_panel('faceplate', SW + 0.66, SH + 0.6, at=(0, FY + 0.02, FZ), bend=SB, mat=PLATE, parent=head, thick=0.4)
curved_panel('screen', SW, SH, at=(0, FY - 0.01, FZ), bend=SB * SW / (SW + 0.66), mat=SCREEN, parent=head)
empty('display', (0, FY - 0.01, FZ), head, width=SW, height=SH)
for i, (zz, ww) in enumerate(((FZ + SH / 2 + 0.5, SW * 0.78), (FZ - SH / 2 - 0.5, SW * 0.5))):
    curved_panel(f'face_light_{i}', ww, 0.035, at=(0, FY + 0.12, zz), bend=SB * ww / (SW + 0.66), mat=SEAM, parent=head, nx=32, ny=1)

# ---- the jaw: a block under the face with one slot in its top; light at the slot's floor; four pips on its front
JZ = FZ - SH / 2 - 1.05
JY = -3.05
jaw = box('jaw', (3.0, 1.5, 1.15), at=(0, JY, JZ), mat=TRIM, parent=head, cuts=3, bevel=0.22, segs=5, taper=-0.25, taper_axis='Z', subsurf=1)
SL, SWD, SD = 1.0, 0.14, 0.95
SY = JY - 0.2
top = JZ + 1.15 / 2
cut(jaw, 'slot_cut', (SL, SWD, SD * 2), at=(0, SY, top))
for nm, size, at in (('slot_rim_f', (SL + 0.14, 0.035, 0.03), (0, SY - SWD / 2 - 0.035, top + 0.005)), ('slot_rim_b', (SL + 0.14, 0.035, 0.03), (0, SY + SWD / 2 + 0.035, top + 0.005)),
                     ('slot_rim_l', (0.035, SWD + 0.14, 0.03), (-SL / 2 - 0.035, SY, top + 0.005)), ('slot_rim_r', (0.035, SWD + 0.14, 0.03), (SL / 2 + 0.035, SY, top + 0.005))):
    box(nm, size, at=at, mat=RIM, parent=head)
box('slot_floor', (SL * 0.96, SWD * 0.9, 0.02), at=(0, SY, top - SD + 0.03), mat=SLOTGLOW, parent=head)
empty('slot', (0, SY, top), head, length=SL, width=SWD, depth=SD)
for i in range(4):
    box(f'pip_{i}', (0.16, 0.04, 0.05), at=(-0.39 + i * 0.26, JY - 0.77, JZ - 0.12), mat=PIP, parent=head)

# ---- crest, fins, halo
for sx in (-1, 1):
    cyl(f'fin_{sx}', 1.25, 0.5, at=(sx * 3.7, 0.3, 0.7), rot=(0, math.pi / 2, 0), mat=TRIM, parent=head, bevel=0.08)
    torus(f'fin_ring_{sx}', 0.95, 0.045, at=(sx * 3.97, 0.3, 0.7), rot=(0, math.pi / 2, 0), parent=head)
    cyl(f'fin_core_{sx}', 0.42, 0.12, at=(sx * 3.97, 0.3, 0.7), rot=(0, math.pi / 2, 0), mat=SEAM, parent=head)
torus('halo', 5.4, 0.06, at=(0, 2.4, 0.9), rot=(math.pi / 2, 0, 0), parent=head)
torus('halo_2', 5.75, 0.02, at=(0, 2.6, 0.9), rot=(math.pi / 2, 0, 0), parent=head)

if PREVIEW:
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam)
    cam.location = (7.5, -19, -1.0); cam.rotation_euler = (math.radians(95), 0, math.radians(21)); scene.camera = cam; cam.data.lens = 40
    for nm, loc, power, col in (('key', (-7, -11, 9), 3000, (0.9, 0.9, 1)), ('rim', (9, 6, 6), 6000, (0.6, 0.45, 1.0)), ('under', (0, -9, -5), 900, (1, 0.8, 0.5))):
        l = bpy.data.objects.new(nm, bpy.data.lights.new(nm, 'POINT')); l.data.energy = power; l.data.color = col; l.location = loc; scene.collection.objects.link(l)
    world = bpy.data.worlds.new('w'); world.use_nodes = True; world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.01, 0.008, 0.015, 1); scene.world = world
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else ('BLENDER_EEVEE' if 'BLENDER_EEVEE' in engines else 'CYCLES')
    scene.render.resolution_x, scene.render.resolution_y = 1000, 1000
    scene.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)
    for nm in ('cam', 'key', 'rim', 'under'):
        bpy.data.objects.remove(bpy.data.objects[nm])

bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    o.select_set(o not in cutters)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_cameras=False, export_lights=False, export_extras=True)
print('EXPORTED', OUT)
