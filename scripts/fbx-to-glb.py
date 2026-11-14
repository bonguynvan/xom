# A rigged FBX character (a Mixamo download, a Renderpeople scan: big textures, 30-100 MB) made into a small
# .glb the page can load: the skinned meshes and their skeleton in the rest pose, metres, only the colour
# texture of each material, scaled down, no clips (every rig plays the ones in public/models/clips.glb, see
# public/js/3d/retarget.js). Needs Blender (5.x); run it in the background:
#   blender -b --factory-startup --python scripts/fbx-to-glb.py -- character.fbx public/models/remy.glb 512 Eyelashes
# then, as for any model:  node scripts/unpack-glb.js public/models/remy.glb
import os
import struct
import sys
import tempfile

import bpy
import numpy as np

src, out, size, *drop = sys.argv[sys.argv.index('--') + 1:]  # `drop`: names of meshes to leave out (eyelashes, say)
size = int(size)

bpy.ops.wm.read_factory_settings(use_empty=True)
with open(src, 'rb') as f:
    version = struct.unpack('<I', f.read(27)[23:27])[0]
if version >= 7100:
    bpy.ops.import_scene.fbx(filepath=src, use_anim=False, ignore_leaf_bones=True, automatic_bone_orientation=False)
else:  # FBX 6: only the newer importer reads it
    bpy.ops.wm.fbx_import(filepath=src, use_anim=False, ignore_leaf_bones=True)

# whatever stands above the armature carries the centimetres and the axes: keep what it did, then drop it
bpy.context.view_layer.update()
armature = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
world = armature.matrix_world.copy()
armature.parent = None
armature.matrix_world = world
bpy.context.view_layer.update()
for o in list(bpy.data.objects):
    if o.type == 'MESH' and o.parent is not armature:
        world = o.matrix_world.copy()
        o.parent = armature
        o.matrix_world = world
for o in list(bpy.data.objects):
    if o.type not in ('ARMATURE', 'MESH') or o.name in drop:
        bpy.data.objects.remove(o, do_unlink=True)

# bone names without the file's own prefix (rp_nathan_animated_003_walking_hip -> hip)
prefix = os.path.commonprefix([b.name for b in armature.data.bones])
prefix = prefix[:prefix.rfind('_') + 1]
armature.name = 'Armature'
for b in armature.data.bones:
    b.name = b.name[len(prefix):]
for o in bpy.data.objects:
    if o.animation_data:
        o.animation_data_clear()
for pb in armature.pose.bones:  # the rest pose, whatever frame the file was saved on
    pb.location = (0, 0, 0)
    pb.rotation_quaternion = (1, 0, 0, 0)
    pb.rotation_euler = (0, 0, 0)
    pb.scale = (1, 1, 1)

# each material: its colour picture scaled down (with its alpha if the material is cut out), nothing else
work = tempfile.mkdtemp()
small = {}


def shrunk(image, mask):
    """`image` no larger than `size`, as a file: a JPEG, or a PNG whose alpha is the `mask` image when there is one."""
    alpha = mask is not None
    key = (image.name, mask.name if alpha else None)
    if key not in small:
        k = min(1, size / max(image.size[0], image.size[1], 1))
        w, h = max(1, round(image.size[0] * k)), max(1, round(image.size[1] * k))
        image.scale(w, h)
        if alpha and mask != image:  # the opacity is a picture of its own: it becomes the colour picture's alpha
            mask.scale(w, h)
            rgba = np.empty(w * h * 4, dtype=np.float32)
            grey = np.empty(w * h * 4, dtype=np.float32)
            image.pixels.foreach_get(rgba)
            mask.pixels.foreach_get(grey)
            rgba[3::4] = grey[0::4]
            image.pixels.foreach_set(rgba)
        path = os.path.join(work, f'{len(small)}.{"png" if alpha else "jpg"}')
        image.filepath_raw = path
        image.file_format = 'PNG' if alpha else 'JPEG'
        image.save()
        small[key] = bpy.data.images.load(path)
    return small[key]


def picture(socket):
    """The image texture node feeding this socket, through whatever stands between."""
    for link in socket.links:
        node = link.from_node
        if node.type == 'TEX_IMAGE' and node.image:
            return node
        for inner in node.inputs:
            found = picture(inner)
            if found:
                return found
    return None


bpy.context.scene.render.image_settings.quality = 85
for m in bpy.data.materials:
    if not m.node_tree:
        continue
    tree = m.node_tree
    bsdf = next((n for n in tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not bsdf:
        continue
    colour = picture(bsdf.inputs['Base Color'])
    cut = picture(bsdf.inputs['Alpha'])
    mask = cut.image if cut and colour else None
    for socket in bsdf.inputs:
        for link in list(socket.links):
            tree.links.remove(link)
    for n in list(tree.nodes):
        if n not in (bsdf, colour) and n.type != 'OUTPUT_MATERIAL':
            tree.nodes.remove(n)
    bsdf.inputs['Metallic'].default_value = 0
    bsdf.inputs['Roughness'].default_value = 0.85
    bsdf.inputs['Alpha'].default_value = 1
    if colour:
        colour.image = shrunk(colour.image, mask)
        tree.links.new(colour.outputs['Color'], bsdf.inputs['Base Color'])
        if mask:
            tree.links.new(colour.outputs['Alpha'], bsdf.inputs['Alpha'])
    print('MATERIAL', m.name, colour.image.name if colour else None, 'alpha' if mask else '')

for o in bpy.data.objects:
    if o.type == 'MESH':
        print('MESH', o.name, len(o.data.loop_triangles) or sum(len(p.vertices) - 2 for p in o.data.polygons), [s.material.name for s in o.material_slots if s.material])
print('BONES', len(armature.data.bones), 'HEIGHT', round(max((o.matrix_world @ v.co).z for o in bpy.data.objects if o.type == 'MESH' for v in o.data.vertices), 3))

bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='AUTO', export_image_quality=85,
                          export_animations=False, export_skins=True, export_yup=True, export_apply=False,
                          export_tangents=False, export_morph=False, export_cameras=False, export_lights=False)
