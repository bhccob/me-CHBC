# LAB ONLY (throwaway). The colossus, round 45: a robot face you can read. A smooth black helmet with a sculpted
# faceplate in front (brow ridge, inset eye sockets, a nose bridge, cheekbones, a muzzle and chin): two glowing eyes in
# the sockets (the meshes 'eye_l' / 'eye_r', drawn by the page as LED eyes) and the MOUTH is the coin slot: a horizontal
# slit with gold lips, light deep inside (empty 'slot' at its opening). Four pips under the lip count the coins. Violet
# seams, fins at the sides and a halo behind. Original design, in the spirit of a modern armoured helmet. Exports glTF:
#   blender --background --factory-startup --python tools/lab/blender/head3.py -- <out.glb> [preview.png]
# Blender is Z up with the face looking along -Y; in the page that is Y up, the face looking along +Z.
import bpy, sys, math

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'head3.glb'
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
EYE = material('eye', (0.0, 0.0, 0.0), 0.0, 0.1)
MASK = material('mask', (0.07, 0.065, 0.085), 1.0, 0.2, coat=1.0)

def gauss(d2, s): return math.exp(-d2 / s)

# ---- the helmet: a superellipsoid, its front pressed flat and back so the faceplate stands in front of it
bpy.ops.mesh.primitive_uv_sphere_add(segments=128, ring_count=64, radius=1)
shell = bpy.context.active_object
shell.name = 'shell'
P = 3.2
for v in shell.data.vertices:
    n = v.co.normalized()
    k = (abs(n.x) ** P + abs(n.y) ** P + abs(n.z) ** P) ** (-1 / P)
    x, y, z = n.x * k * 3.75, n.y * k * 3.4, n.z * k * 4.1
    if y < -2.6: y = -2.6 + (y + 2.6) * 0.1
    if z < 0: x *= 1 - 0.16 * (-z / 4.1); y = y * (1 - 0.08 * (-z / 4.1))
    if z > 3.2: z = 3.2 + (z - 3.2) * 0.75
    v.co.x, v.co.y, v.co.z = x, y, z
shell.data.materials.append(SHELL)
shell.parent = head
for p in shell.data.polygons: p.use_smooth = True

# ---- the faceplate: wide at the brow, narrowing to the chin; sculpted by a few soft shapes
FY, ZT, ZB = -3.2, 2.55, -2.95
EX, EZ = 1.22, 0.72          # eye centres (x = +-EX)
MZ = -1.38                   # the mouth
def halfw(z):
    t = (z - ZB) / (ZT - ZB)
    return 1.35 + 1.55 * (1 - (1 - min(1, t / 0.62)) ** 2) - 0.12 * max(0, t - 0.85) / 0.15
bpy.ops.mesh.primitive_grid_add(x_subdivisions=90, y_subdivisions=110, size=1)
mask = bpy.context.active_object
mask.name = 'mask'
for v in mask.data.vertices:
    z = ZB + (v.co.y + 0.5) * (ZT - ZB)
    x = v.co.x * 2 * halfw(z)
    y = FY + (7 - math.sqrt(49 - x * x)) + 0.045 * (z - 0.3) ** 2
    ax = abs(x)
    y -= 0.2 * gauss((z - 1.42) ** 2, 0.045) * (1 if ax < 2.4 else 0.5)          # brow ridge
    y += 0.24 * gauss((ax - EX) ** 2 / 0.42 + (z - EZ) ** 2 / 0.1, 1)            # eye sockets
    y -= 0.13 * gauss(x * x, 0.035) * (1 if -0.5 < z < 1.2 else 0.3)              # nose bridge
    y -= 0.13 * gauss((ax - 1.65) ** 2 / 0.3 + (z + 0.25) ** 2 / 0.2, 1)          # cheekbones
    y -= 0.14 * gauss(x * x / 1.3 + (z - MZ) ** 2 / 0.35, 1)                     # muzzle
    y -= 0.1 * gauss(x * x / 0.6 + (z + 2.45) ** 2 / 0.15, 1)                    # chin
    v.co.x, v.co.y, v.co.z = x, y, z
mask.data.materials.append(MASK)
mask.parent = head
for p in mask.data.polygons: p.use_smooth = True
m = mask.modifiers.new('solid', 'SOLIDIFY'); m.thickness = 0.28; m.offset = -1.0
cutters = []
def cutter(name, size, at, cyl_=False):
    if cyl_:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.5, depth=1, vertices=64)
        c = bpy.context.active_object
        for vv in c.data.vertices: vv.co.x, vv.co.y, vv.co.z = vv.co.x * size[0], vv.co.y * size[1], vv.co.z * size[2]
        c.rotation_euler = (math.pi / 2, 0, 0)   # its axis along Y, through the plate (scaled, not mirrored)
    else:
        c = box(name, size, at=at, mat=HIDE)
    c.name = name; c.location = at; c.hide_render = True; c.display_type = 'WIRE'
    cutters.append(c)
    return c
def cut_with(target, c):
    mm = target.modifiers.new(f'cut_{c.name}', 'BOOLEAN'); mm.operation = 'DIFFERENCE'; mm.object = c; mm.solver = 'EXACT'
# The eye openings: wide ovals.
for sx, nm in ((-1, 'l'), (1, 'r')):
    cut_with(mask, cutter(f'eye_cut_{nm}', (1.62, 0.68, 2.0), at=(sx * EX, FY, EZ), cyl_=True))
# The mouth: one slit right through, where the coins go.
SLW, SLH = 1.55, 0.24
cut_with(mask, cutter('mouth_cut', (SLW, 3.0, SLH), at=(0, FY - 0.5, MZ)))
cut_with(shell, cutter('mouth_cut_shell', (SLW, 3.0, SLH), at=(0, -2.4, MZ)))
m = mask.modifiers.new('bevel', 'BEVEL'); m.width = 0.03; m.segments = 3; m.limit_method = 'ANGLE'

# ---- the eyes: LED panels set back in the sockets (the page draws them)
for sx, nm in ((-1, 'l'), (1, 'r')):
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=16, y_subdivisions=8, size=1)
    e = bpy.context.active_object
    e.name = f'eye_{nm}'
    for v in e.data.vertices:
        x, z = v.co.x * 1.85, v.co.y * 0.86
        v.co.x, v.co.y, v.co.z = sx * EX + x, FY + 0.48 + 0.03 * x * x, EZ + z
    e.data.materials.append(EYE)
    e.parent = head

# ---- the mouth: gold lips, light deep inside, the opening marked for the page
mz_y = FY - 0.3
for nm, dz in (('lip_top', SLH / 2 + 0.035), ('lip_bot', -SLH / 2 - 0.035)):
    box(nm, (SLW + 0.22, 0.12, 0.05), at=(0, mz_y + 0.02, MZ + dz), mat=RIM, parent=head, bevel=0.018, segs=3)
for sx in (-1, 1):
    box(f'lip_end_{sx}', (0.05, 0.12, SLH + 0.12), at=(sx * (SLW / 2 + 0.11), mz_y + 0.02, MZ), mat=RIM, parent=head, bevel=0.018, segs=3)
box('slot_glow', (SLW * 0.9, 0.04, SLH * 0.7), at=(0, -1.5, MZ), mat=SLOTGLOW, parent=head)
empty('slot', (0, mz_y, MZ), head, width=SLW, height=SLH)
for i in range(4):
    box(f'pip_{i}', (0.12, 0.05, 0.05), at=(-0.27 + i * 0.18, mz_y + 0.06, MZ - 0.42), mat=PIP, parent=head)

# ---- seams: from the outer eye corners down the cheeks, and one up the forehead
for sx in (-1, 1):
    box(f'cheek_seam_{sx}', (0.035, 0.05, 1.55), at=(sx * 2.05, FY + 0.32, -0.55), rot=(0, sx * 0.32, 0), mat=SEAM, parent=head)
box('brow_seam', (0.035, 0.05, 0.75), at=(0, FY + 0.12, 2.1), mat=SEAM, parent=head)
empty('face', (0, FY, 0.0), head)

# ---- fins and a halo
for sx in (-1, 1):
    cyl(f'fin_{sx}', 1.25, 0.5, at=(sx * 3.7, 0.3, 0.7), rot=(0, math.pi / 2, 0), mat=TRIM, parent=head, bevel=0.08)
    torus(f'fin_ring_{sx}', 0.95, 0.045, at=(sx * 3.97, 0.3, 0.7), rot=(0, math.pi / 2, 0), parent=head)
    cyl(f'fin_core_{sx}', 0.42, 0.12, at=(sx * 3.97, 0.3, 0.7), rot=(0, math.pi / 2, 0), mat=SEAM, parent=head)
torus('halo', 5.4, 0.06, at=(0, 2.4, 0.9), rot=(math.pi / 2, 0, 0), parent=head)
torus('halo_2', 5.75, 0.02, at=(0, 2.6, 0.9), rot=(math.pi / 2, 0, 0), parent=head)

if PREVIEW:
    glow_prev = material('eye_prev', (0, 0, 0), 0, 0.5, emit=(1.0, 0.85, 0.6), strength=4.0)
    for nm in ('l', 'r'):
        bpy.data.objects[f'eye_{nm}'].data.materials[0] = glow_prev
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam)
    cam.location = (4.5, -19, -0.5); cam.rotation_euler = (math.radians(92), 0, math.radians(13)); scene.camera = cam; cam.data.lens = 45
    for nm, loc, power, col in (('key', (-7, -11, 9), 3500, (0.9, 0.9, 1)), ('rim', (9, 6, 6), 6000, (0.6, 0.45, 1.0)), ('under', (0, -9, -5), 900, (1, 0.8, 0.5))):
        l = bpy.data.objects.new(nm, bpy.data.lights.new(nm, 'POINT')); l.data.energy = power; l.data.color = col; l.location = loc; scene.collection.objects.link(l)
    world = bpy.data.worlds.new('w'); world.use_nodes = True; world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.01, 0.008, 0.015, 1); scene.world = world
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else ('BLENDER_EEVEE' if 'BLENDER_EEVEE' in engines else 'CYCLES')
    scene.render.resolution_x, scene.render.resolution_y = 1000, 1000
    scene.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)
    for nm in ('l', 'r'):
        bpy.data.objects[f'eye_{nm}'].data.materials[0] = EYE
    for nm in ('cam', 'key', 'rim', 'under'):
        bpy.data.objects.remove(bpy.data.objects[nm])

bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    o.select_set(o not in cutters)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_cameras=False, export_lights=False, export_extras=True)
print('EXPORTED', OUT)
