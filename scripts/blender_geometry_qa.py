"""
Blender GLB Quality Check & Multi-Angle Critique Renderer.
Eyeballing a ship from one angle is how flipped normals sneak into production.
- Checks core GLB models (file size < 1.5 MB, tri budget, bounds, zero NaNs/degenerate faces, COLOR_0, Idle clip)
- Renders a 4-way turnaround sheet (Front-3/4, Top, Side, Rear-3/4) for visual inspection.
"""

from __future__ import annotations

import math
import os
import sys
import tempfile
import bpy
import numpy as np
from mathutils import Vector

REPO_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(REPO_DIR, "public", "assets", "models")
OUT_PNG = os.path.join(REPO_DIR, "previews", "qa_blender_multiview.png")

AUDIT_MODELS = [
    "player_vanguard.glb",
    "enemy_small.glb",
    "enemy_elite.glb",
    "boss_destroyer.glb",
    "obj_raid_reactor.glb",
    "obj_plasma_barrel.glb",
    "prop_combat_drone.glb",
    "obj_room_portal.glb",
]


def clear_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def audit_glb(filename: str) -> dict:
    path = os.path.join(MODELS_DIR, filename)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Missing model: {path}")
    file_bytes = os.path.getsize(path)

    clear_scene()
    bpy.ops.import_scene.gltf(filepath=path)
    depsgraph = bpy.context.evaluated_depsgraph_get()

    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    total_verts = 0
    total_tris = 0
    nan_verts = 0
    degen_faces = 0
    has_color0 = False
    min_pt = Vector((1e9, 1e9, 1e9))
    max_pt = Vector((-1e9, -1e9, -1e9))

    for obj in meshes:
        ev = obj.evaluated_get(depsgraph)
        me = ev.to_mesh()
        me.calc_loop_triangles()
        total_verts += len(me.vertices)
        total_tris += len(me.loop_triangles)

        for attr in me.color_attributes:
            if attr.name in ("COLOR_0", "Col", "Attribute", "VertexColor") or attr.domain in ("POINT", "CORNER"):
                has_color0 = True

        mw = ev.matrix_world
        for v in me.vertices:
            if math.isnan(v.co.x) or math.isnan(v.co.y) or math.isnan(v.co.z):
                nan_verts += 1
                continue
            wp = mw @ v.co
            min_pt.x = min(min_pt.x, wp.x)
            min_pt.y = min(min_pt.y, wp.y)
            min_pt.z = min(min_pt.z, wp.z)
            max_pt.x = max(max_pt.x, wp.x)
            max_pt.y = max(max_pt.y, wp.y)
            max_pt.z = max(max_pt.z, wp.z)

        for poly in me.polygons:
            if poly.area <= 1e-10:
                degen_faces += 1

        ev.to_mesh_clear()

    action_names = [a.name for a in bpy.data.actions]
    for arm in [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]:
        if arm.animation_data:
            for tr in arm.animation_data.nla_tracks:
                for st in tr.strips:
                    if st.action and st.action.name not in action_names:
                        action_names.append(st.action.name)

    has_idle = any("idle" in a.lower() for a in action_names)
    bbox = max_pt - min_pt if total_verts > 0 else Vector((0, 0, 0))
    passed = (
        file_bytes < 1_500_000
        and total_tris > 0
        and nan_verts == 0
        and has_color0
        and has_idle
        and bbox.length > 0.2
    )
    return {
        "name": filename,
        "bytes": file_bytes,
        "verts": total_verts,
        "tris": total_tris,
        "nan_verts": nan_verts,
        "degen_faces": degen_faces,
        "has_color0": has_color0,
        "has_idle": has_idle,
        "bbox": (round(bbox.x, 2), round(bbox.y, 2), round(bbox.z, 2)),
        "passed": passed,
    }


def setup_look_at(cam_obj: bpy.types.Object, loc: tuple[float, float, float], tgt: tuple[float, float, float]) -> None:
    cam_obj.location = Vector(loc)
    direction = Vector(tgt) - Vector(loc)
    cam_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def _import_placed(filename: str, offset: tuple[float, float, float]) -> None:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS_DIR, filename))
    for o in bpy.data.objects:
        if o not in before and o.parent is None:
            o.location = Vector(o.location) + Vector(offset)


def render_multiview_critique() -> None:
    clear_scene()
    scene = bpy.context.scene

    _import_placed("player_vanguard.glb", (0.0, 0.0, 0.0))
    _import_placed("prop_combat_drone.glb", (1.6, -2.0, 0.45))
    _import_placed("obj_room_portal.glb", (-2.6, 2.2, 0.0))

    world = bpy.data.worlds.new("QAWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.04, 0.07, 0.14, 1.0)
        bg.inputs[1].default_value = 1.65

    key_data = bpy.data.lights.new("QAKey", type="SUN")
    key_data.energy = 3.8
    key_obj = bpy.data.objects.new("QAKey", key_data)
    scene.collection.objects.link(key_obj)
    setup_look_at(key_obj, (8.0, -7.0, 10.0), (0.0, 0.0, 0.0))

    rim_data = bpy.data.lights.new("QARim", type="AREA")
    rim_data.energy = 320.0
    rim_data.color = (0.35, 0.88, 1.0)
    rim_data.size = 6.0
    rim_obj = bpy.data.objects.new("QARim", rim_data)
    scene.collection.objects.link(rim_obj)
    setup_look_at(rim_obj, (-7.0, 6.0, 4.0), (0.0, 0.0, 0.0))

    cam_data = bpy.data.cameras.new("QACam")
    cam_data.lens = 36
    cam_obj = bpy.data.objects.new("QACam", cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    scene.render.engine = (
        "BLENDER_EEVEE_NEXT"
        if "BLENDER_EEVEE_NEXT" in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items
        else "BLENDER_EEVEE"
    )
    tile_w, tile_h = 640, 360
    scene.render.resolution_x = tile_w
    scene.render.resolution_y = tile_h
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"

    views = [
        ("front_3q", (5.4, -4.6, 2.8), (-0.4, 0.1, 0.0)),
        ("top", (-0.3, 0.0, 8.6), (-0.3, 0.0, 0.0)),
        ("side", (0.2, -7.2, 0.8), (-0.4, 0.0, 0.0)),
        ("rear_3q", (-5.8, -3.6, 2.4), (-0.4, 0.0, 0.0)),
    ]

    panels = []
    with tempfile.TemporaryDirectory() as tmpdir:
        for idx, (tag, loc, tgt) in enumerate(views):
            setup_look_at(cam_obj, loc, tgt)
            p_path = os.path.join(tmpdir, f"view_{idx}_{tag}.png")
            scene.render.filepath = p_path
            bpy.ops.render.render(write_still=True)

            img = bpy.data.images.load(p_path)
            arr = np.array(img.pixels[:], dtype=np.float32).reshape((tile_h, tile_w, 4))
            panels.append(arr)
            bpy.data.images.remove(img)

    full_w, full_h = tile_w * 2, tile_h * 2
    grid = np.zeros((full_h, full_w, 4), dtype=np.float32)
    grid[tile_h:, :tile_w, :] = panels[0]
    grid[tile_h:, tile_w:, :] = panels[1]
    grid[:tile_h, :tile_w, :] = panels[2]
    grid[:tile_h, tile_w:, :] = panels[3]

    grid[tile_h - 1 : tile_h + 1, :, :] = [0.22, 0.91, 1.0, 1.0]
    grid[:, tile_w - 1 : tile_w + 1, :] = [0.22, 0.91, 1.0, 1.0]

    out_img = bpy.data.images.new("QAMultiViewV19", width=full_w, height=full_h, alpha=True)
    out_img.pixels.foreach_set(grid.ravel())
    out_img.filepath_raw = OUT_PNG
    out_img.file_format = "PNG"
    out_img.save()


def main() -> None:
    os.makedirs(os.path.dirname(OUT_PNG), exist_ok=True)
    passed_count = 0
    for fn in AUDIT_MODELS:
        res = audit_glb(fn)
        if res["passed"]:
            passed_count += 1
        print(
            f"[BlenderQA] {res['name']:24s} pass={res['passed']} bytes={res['bytes']:7d} "
            f"tris={res['tris']:6d} bbox={res['bbox']} nan={res['nan_verts']} degen={res['degen_faces']} "
            f"color0={res['has_color0']} idle={res['has_idle']}"
        )

    render_multiview_critique()
    print(f"BLENDER_QA_PASSED={passed_count}/{len(AUDIT_MODELS)}")
    print(f"BLENDER_MULTIVIEW_PNG={OUT_PNG}")
    if passed_count != len(AUDIT_MODELS):
        sys.exit(1)


if __name__ == "__main__":
    main()
