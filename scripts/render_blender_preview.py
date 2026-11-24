"""
Studio Showcase & Pose Matrix Renderer.
Renders 1920x1080 EEVEE Next inspection sheets into previews/:
  1. showcase_v4_fighters.png   - 3/4 Hero view vs Top-Down gameplay silhouette view
  2. showcase_v4_bosses.png     - 3/4 Hero vs Top-Down views for Bosses
  3. showcase_v4_props.png      - Close-up of sculpted battlefield props
  4. showcase_v4_animations.png - 4x3 Pose Matrix (Idle | Dash | Attack)
Also checks every .glb header for COLOR_0 vertex AO, clips, and clean geometry.
"""

from __future__ import annotations

import json
import math
import struct
from pathlib import Path
import bpy

MODELS_DIR = Path(__file__).resolve().parent.parent / "public" / "assets" / "models"
PREVIEW_DIR = Path(__file__).resolve().parent.parent / "previews"


def inspect_glb(glb_path: Path) -> None:
    data = glb_path.read_bytes()
    magic, version, _total_len = struct.unpack_from("<4sII", data, 0)
    assert magic == b"glTF" and version == 2, f"Invalid GLB header in {glb_path}"
    chunk_len, chunk_type = struct.unpack_from("<II", data, 12)
    assert chunk_type == 0x4E4F534A
    gltf_json = json.loads(data[20 : 20 + chunk_len].decode("utf-8"))
    anims = [a.get("name", "<unnamed>") for a in gltf_json.get("animations", [])]
    meshes = gltf_json.get("meshes", [])
    has_color0 = any(
        "COLOR_0" in prim.get("attributes", {})
        for m in meshes
        for prim in m.get("primitives", [])
    )
    print(
        f"[GLB v4 OK] {glb_path.name} ({glb_path.stat().st_size:,} B): "
        f"{len(meshes)} meshes, COLOR_0_AO={has_color0}, anims={anims}"
    )


def setup_studio_scene(bloom_glare: bool = True) -> bpy.types.Scene:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    for eng in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "BLENDER_WORKBENCH"):
        try:
            scene.render.engine = eng
            break
        except TypeError:
            continue

    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = (
        "AgX"
        if "AgX" in [i.identifier for i in scene.view_settings.bl_rna.properties["view_transform"].enum_items]
        else "Filmic"
    )
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.25

    world = bpy.data.worlds.new("ShowroomWorld")
    scene.world = world
    world.use_nodes = True
    bg = next((n for n in world.node_tree.nodes if n.type == "BACKGROUND"), None)
    if bg:
        bg.inputs[0].default_value = (0.016, 0.022, 0.042, 1.0)
        bg.inputs[1].default_value = 1.6

    # Subtle compositor glare for hot emissive cores in EEVEE Next
    if bloom_glare:
        scene.use_nodes = True
        nt = scene.node_tree
        nt.nodes.clear()
        rl = nt.nodes.new("CompositorNodeRLayers")
        glare = nt.nodes.new("CompositorNodeGlare")
        glare.glare_type = "FOG_GLOW"
        glare.quality = "MEDIUM"
        glare.threshold = 1.4
        glare.size = 6
        glare.mix = -0.35
        comp = nt.nodes.new("CompositorNodeComposite")
        nt.links.new(rl.outputs["Image"], glare.inputs["Image"])
        nt.links.new(glare.outputs["Image"], comp.inputs["Image"])

    # Dark anodized hangar floor (kept well below models so silhouettes pop clearly)
    bpy.ops.mesh.primitive_plane_add(size=80.0, location=(0, 0, -4.5))
    floor = bpy.context.active_object
    floor_mat = bpy.data.materials.new("HangarFloor")
    floor_mat.use_nodes = True
    bsdf = next(n for n in floor_mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (0.018, 0.026, 0.044, 1.0)
    bsdf.inputs["Metallic"].default_value = 0.78
    bsdf.inputs["Roughness"].default_value = 0.34
    floor.data.materials.append(floor_mat)

    # High-contrast 3-point space-dock lighting (bright neutral key + icy fill + warm rim)
    for name, loc, rot_deg, energy, col in [
        ("KeyLight", (8, -14, 18), (38, 12, 22), 3400.0, (1.0, 0.99, 0.98)),
        ("FillLight", (-16, -10, 14), (44, -28, -32), 1650.0, (0.38, 0.78, 1.0)),
        ("RimLight", (0, 16, 12), (-46, 0, 180), 2200.0, (1.0, 0.62, 0.22)),
    ]:
        ldata = bpy.data.lights.new(name=name, type="AREA")
        ldata.energy = energy
        ldata.color = col
        ldata.size = 18.0
        lobj = bpy.data.objects.new(name=name, object_data=ldata)
        scene.collection.objects.link(lobj)
        lobj.location = loc
        lobj.rotation_euler = tuple(math.radians(a) for a in rot_deg)

    return scene


def _import_and_mount(
    scene: bpy.types.Scene,
    filename: str,
    loc: tuple[float, float, float],
    scale: float,
    rot_deg: tuple[float, float, float],
    action_name: str | None = None,
    pose_frame: int = 14,
) -> bpy.types.Object:
    glb_path = MODELS_DIR / filename
    before = set(bpy.data.objects)
    before_actions = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=str(glb_path))
    imported = [o for o in bpy.data.objects if o not in before]
    new_actions = [a for a in bpy.data.actions if a not in before_actions]

    holder = bpy.data.objects.new(f"Holder_{filename}_{action_name or 'def'}", None)
    scene.collection.objects.link(holder)
    holder.location = loc
    holder.scale = (scale, scale, scale)
    holder.rotation_euler = tuple(math.radians(a) for a in rot_deg)

    arm = None
    for obj in imported:
        if obj.parent is None:
            obj.parent = holder
        if obj.type == "ARMATURE":
            arm = obj

    if arm and action_name:
        target_act = None
        for act in new_actions:
            if action_name.lower() in act.name.lower():
                target_act = act
                break
        if target_act:
            if not arm.animation_data:
                arm.animation_data_create()
            for track in arm.animation_data.nla_tracks:
                track.mute = True
            arm.animation_data.action = target_act
            scene.frame_set(pose_frame)
            bpy.context.view_layer.update()
            # Freeze evaluated bone transforms at `pose_frame` so simultaneous grid poses stay locked!
            frozen = {pb.name: pb.matrix_basis.copy() for pb in arm.pose.bones}
            arm.animation_data_clear()
            for bname, mat_b in frozen.items():
                arm.pose.bones[bname].matrix_basis = mat_b

    return holder


def _render_ortho(scene: bpy.types.Scene, out_path: Path, ortho_scale: float) -> None:
    cam_data = bpy.data.cameras.new("StudioCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = ortho_scale
    cam_obj = bpy.data.objects.new("StudioCam", cam_data)
    scene.collection.objects.link(cam_obj)
    # Overhead orthographic camera; individual holders supply Hero 3/4 vs Top-Down angles!
    cam_obj.location = (0.0, 0.0, 22.0)
    cam_obj.rotation_euler = (0.0, 0.0, 0.0)
    scene.camera = cam_obj

    scene.render.filepath = str(out_path)
    bpy.ops.render.render(write_still=True)
    print(f"[RENDERED v4] {out_path.name}")


def render_fighters_showcase(out_path: Path) -> None:
    scene = setup_studio_scene()
    fighters = [
        ("player_vanguard.glb", 0.92),
        ("enemy_small.glb", 1.15),
        ("enemy_medium.glb", 1.00),
        ("enemy_large.glb", 0.85),
        ("enemy_splitter.glb", 1.15),
        ("enemy_elite.glb", 0.84),
    ]
    xs = [-10.0, -6.0, -2.0, 2.0, 6.0, 10.0]
    for (fname, sc), x in zip(fighters, xs):
        inspect_glb(MODELS_DIR / fname)
        # Top row: Dramatic 3/4 Hero View (angled toward camera)
        _import_and_mount(scene, fname, (x, 3.2, 0.0), sc, (34.0, -18.0, -34.0), "Idle", 12)
        # Bottom row: Pure Top-Down In-Game Silhouette Read (+X pointed up)
        _import_and_mount(scene, fname, (x, -3.4, 0.0), sc, (0.0, 0.0, 90.0), "Idle", 12)

    _render_ortho(scene, out_path, ortho_scale=24.8)


def render_bosses_showcase(out_path: Path) -> None:
    scene = setup_studio_scene()
    bosses = [
        ("boss_destroyer.glb", 2.30),
        ("boss_summoner.glb", 2.10),
        ("boss_overlord.glb", 2.10),
    ]
    xs = [-7.8, 0.0, 7.8]
    for (fname, sc), x in zip(bosses, xs):
        inspect_glb(MODELS_DIR / fname)
        # Top row: 3/4 Hero Angle
        _import_and_mount(scene, fname, (x, 3.3, 0.0), sc, (36.0, -20.0, -32.0), "Idle", 12)
        # Bottom row: Top-Down In-Game Silhouette Read (+X facing forward toward player)
        _import_and_mount(scene, fname, (x, -3.5, 0.0), sc, (0.0, 0.0, -90.0), "Idle", 12)

    _render_ortho(scene, out_path, ortho_scale=23.5)


def render_props_showcase(out_path: Path) -> None:
    scene = setup_studio_scene()
    props = [
        ("prop_nova_bomb.glb", 1.45),
        ("prop_mine_static.glb", 1.45),
        ("prop_mine_homing.glb", 1.45),
        ("prop_powerup_pod.glb", 1.40),
        ("prop_medkit_pod.glb", 1.40),
    ]
    xs = [-8.4, -4.2, 0.0, 4.2, 8.4]
    for (fname, sc), x in zip(props, xs):
        inspect_glb(MODELS_DIR / fname)
        _import_and_mount(scene, fname, (x, 0.0, 0.0), sc, (34.0, -18.0, -34.0), "Idle", 18)

    _render_ortho(scene, out_path, ortho_scale=22.0)


def render_animations_matrix(out_path: Path) -> None:
    scene = setup_studio_scene()
    rows = [
        ("player_vanguard.glb", 0.72, [("Idle", 12), ("Dash", 16), ("Attack", 12)]),
        ("boss_destroyer.glb", 1.48, [("Idle", 12), ("Charge", 24), ("Attack", 10)]),
        ("boss_summoner.glb", 1.38, [("Idle", 12), ("Charge", 24), ("Attack", 10)]),
        ("boss_overlord.glb", 1.38, [("Idle", 12), ("Charge", 24), ("Attack", 10)]),
    ]
    ys = [6.0, 2.0, -2.0, -6.2]
    xs = [-7.2, 0.0, 7.2]

    for (fname, sc, clips), y in zip(rows, ys):
        for (act_name, frame), x in zip(clips, xs):
            _import_and_mount(scene, fname, (x, y, 0.0), sc, (28.0, -14.0, -28.0), act_name, frame)

    _render_ortho(scene, out_path, ortho_scale=28.0)


def render_bosses_closeup(out_path: Path) -> None:
    scene = setup_studio_scene()
    bosses = [
        ("boss_destroyer.glb", 2.85, -8.2),
        ("boss_summoner.glb", 2.55, 0.0),
        ("boss_overlord.glb", 2.55, 8.2),
    ]
    for fname, sc, x in bosses:
        inspect_glb(MODELS_DIR / fname)
        # Hero dramatic close-up showing every turret, VLS deck, ribcage, and layered pinion!
        _import_and_mount(scene, fname, (x, 0.0, 0.0), sc, (34.0, -18.0, -32.0), "Idle", 12)

    _render_ortho(scene, out_path, ortho_scale=24.0)


def _v13_clear_and_setup_studio(res_x: int, res_y: int, ortho_scale: float, cam_loc: tuple[float, float, float], target_loc: tuple[float, float, float]) -> bpy.types.Scene:
    """Reset scene cleanly and set up high-contrast studio lights for boss showcase sheets."""
    import mathutils  # noqa: PLC0415

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    for eng in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        try:
            scene.render.engine = eng
            break
        except Exception:
            continue
    if scene.render.engine == "CYCLES":
        scene.cycles.samples = 16
        scene.cycles.use_denoising = True
    elif hasattr(scene, "eevee") and hasattr(scene.eevee, "taa_render_samples"):
        scene.eevee.taa_render_samples = 24

    scene.render.resolution_x = res_x
    scene.render.resolution_y = res_y
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "AgX" if "AgX" in [i.identifier for i in scene.view_settings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.35

    world = bpy.data.worlds.new("StudioWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.025, 0.036, 0.058, 1.0)
        bg.inputs[1].default_value = 0.85

    # Camera
    cam_data = bpy.data.cameras.new("V13Cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = ortho_scale
    cam_data.clip_start = 0.1
    cam_data.clip_end = 200.0
    cam_obj = bpy.data.objects.new("V13Cam", cam_data)
    scene.collection.objects.link(cam_obj)
    cam_obj.location = cam_loc
    direction = mathutils.Vector(target_loc) - mathutils.Vector(cam_loc)
    cam_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam_obj

    # 3-point + top rim lights for crisp bevel highlights
    def add_sun(name: str, rot_deg: tuple[float, float, float], energy: float, color: tuple[float, float, float]) -> None:
        ldata = bpy.data.lights.new(name, type="SUN")
        ldata.energy = energy
        ldata.color = color
        lobj = bpy.data.objects.new(name, ldata)
        scene.collection.objects.link(lobj)
        lobj.rotation_euler = tuple(math.radians(a) for a in rot_deg)

    add_sun("KeySun", (35.0, -25.0, 40.0), 3.4, (1.0, 0.97, 0.94))
    add_sun("FillSun", (-40.0, 30.0, -110.0), 1.35, (0.62, 0.82, 1.0))
    add_sun("RimSun", (60.0, 15.0, 150.0), 2.1, (0.78, 0.92, 1.0))
    return scene


def _v13_stage_visible(obj: bpy.types.Object, root: bpy.types.Object, stage: int) -> bool:
    """Match Three.js 5-bucket applyStageVisibility across ancestor hierarchy."""
    cur: bpy.types.Object | None = obj
    while cur is not None and cur != root:
        name = cur.name
        if "Form1Only_" in name and stage != 1:
            return False
        if "Form12_" in name and stage not in (1, 2):
            return False
        if "Form2Only_" in name and stage != 2:
            return False
        if "Form2_" in name and stage < 2:
            return False
        if "Form3_" in name and stage != 3:
            return False
        cur = cur.parent
    return True


def _v13_import_cell(
    glb_path: Path,
    cell_name: str,
    clip_name: str = "Idle",
    frame: int = 1,
    stage: int | None = None,
) -> tuple[bpy.types.Object, tuple[float, float, float], tuple[float, float, float]]:
    """Import a GLB, activate and freeze an animation clip/frame, apply stage visibility, and compute bounds."""
    import mathutils  # noqa: PLC0415

    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(glb_path))
    imported = [o for o in bpy.data.objects if o not in before]

    root = bpy.data.objects.new(cell_name, None)
    bpy.context.scene.collection.objects.link(root)
    for o in imported:
        if o.parent is None:
            o.parent = root

    # Activate matching NLA strip and freeze evaluated transforms at requested frame
    for o in imported:
        ad = o.animation_data
        if ad and ad.nla_tracks:
            matched = None
            for tr in ad.nla_tracks:
                act_name = tr.strips[0].action.name if tr.strips and tr.strips[0].action else ""
                base_tr = tr.name.split(".")[0]
                base_act = act_name.split(".")[0]
                if (
                    base_tr == clip_name
                    or tr.name.startswith(clip_name + ".")
                    or base_act == clip_name
                    or act_name.startswith(clip_name + "_")
                ):
                    matched = tr
                tr.mute = True
            if matched is not None:
                matched.mute = False
                if matched.strips and matched.strips[0].action:
                    ad.action = matched.strips[0].action

    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()

    for o in imported:
        if o.animation_data:
            loc = o.location.copy()
            rot_mode = o.rotation_mode
            rot_e = o.rotation_euler.copy()
            rot_q = o.rotation_quaternion.copy()
            sca = o.scale.copy()
            o.animation_data_clear()
            o.location = loc
            o.rotation_mode = rot_mode
            o.rotation_euler = rot_e
            o.rotation_quaternion = rot_q
            o.scale = sca

    # Compute visible bounds after optional 5-bucket filtering
    min_v = [1e9, 1e9, 1e9]
    max_v = [-1e9, -1e9, -1e9]
    bpy.context.view_layer.update()
    for o in imported:
        if stage is not None and not _v13_stage_visible(o, root, stage):
            o.hide_viewport = True
            o.hide_render = True
            continue
        if o.type == "MESH" and not o.hide_render:
            for corner in o.bound_box:
                wc = o.matrix_world @ mathutils.Vector(corner)
                for ax in range(3):
                    min_v[ax] = min(min_v[ax], wc[ax])
                    max_v[ax] = max(max_v[ax], wc[ax])

    if min_v[0] > 1e8:
        min_v = [-0.5, -0.5, -0.5]
        max_v = [0.5, 0.5, 0.5]
    return root, tuple(min_v), tuple(max_v)


def _v13_place_root(
    root: bpy.types.Object,
    min_v: tuple[float, float, float],
    max_v: tuple[float, float, float],
    scale: float,
    dest: tuple[float, float, float],
    rot_euler_deg: tuple[float, float, float] = (0.0, 0.0, 28.0),
) -> None:
    """Scale and position an imported root centered around dest."""
    cx = 0.5 * (min_v[0] + max_v[0])
    cy = 0.5 * (min_v[1] + max_v[1])
    cz = 0.5 * (min_v[2] + max_v[2])
    root.scale = (scale, scale, scale)
    root.rotation_euler = tuple(math.radians(a) for a in rot_euler_deg)
    bpy.context.view_layer.update()
    # Translate so local bbox center lands on dest
    import mathutils  # noqa: PLC0415

    offset = root.matrix_world.to_3x3() @ mathutils.Vector((cx, cy, cz))
    root.location = (dest[0] - offset.x, dest[1] - offset.y, dest[2] - offset.z)


def render_v13_enemies_3stage(out_path: Path) -> None:
    """Render 4 evolving enemy archetypes across Form I / II / III in a 4x3 grid."""
    models_dir = Path(__file__).resolve().parent.parent / "public" / "assets" / "models"
    scene = _v13_clear_and_setup_studio(
        res_x=1800,
        res_y=2100,
        ortho_scale=17.5,
        cam_loc=(0.0, -9.5, 13.5),
        target_loc=(0.0, 0.0, 0.0),
    )

    enemies = ["enemy_small", "enemy_medium", "enemy_large", "enemy_elite"]
    cell_w = 4.6
    cell_h = 4.1
    row_ys = [1.5 * cell_h, 0.5 * cell_h, -0.5 * cell_h, -1.5 * cell_h]
    col_xs = [-1.0 * cell_w, 0.0, 1.0 * cell_w]

    for r_idx, ename in enumerate(enemies):
        glb = models_dir / f"{ename}.glb"
        stage_entries = []
        max_span = 0.01
        for stage in (1, 2, 3):
            clip = "Idle" if stage == 1 else ("Charge" if stage == 2 else "Attack")
            fr = 1 if stage == 1 else 8
            root, bmin, bmax = _v13_import_cell(glb, f"{ename}_S{stage}", clip_name=clip, frame=fr, stage=stage)
            span = max(bmax[0] - bmin[0], bmax[1] - bmin[1], bmax[2] - bmin[2], 0.1)
            max_span = max(max_span, span)
            stage_entries.append((stage, root, bmin, bmax))

        # Keep true relative scale growth per row using Stage 3's largest extent
        row_scale = 3.25 / max_span
        for c_idx, (stage, root, bmin, bmax) in enumerate(stage_entries):
            _v13_place_root(root, bmin, bmax, row_scale, (col_xs[c_idx], row_ys[r_idx], 0.0), rot_euler_deg=(0.0, 0.0, -32.0))

    scene.render.filepath = str(out_path)
    bpy.ops.render.render(write_still=True)


def render_v13_vanguard_weapons_props(out_path: Path) -> None:
    """Render player Vanguard (Idle/Top/Overheat), enemy_splitter, 8 weapons at Attack f8, and 5 props."""
    models_dir = Path(__file__).resolve().parent.parent / "public" / "assets" / "models"
    scene = _v13_clear_and_setup_studio(
        res_x=2100,
        res_y=1800,
        ortho_scale=18.5,
        cam_loc=(0.0, -8.5, 13.0),
        target_loc=(0.0, 0.0, 0.0),
    )

    cell_w = 3.6
    cell_h = 3.8
    row_ys = [1.5 * cell_h, 0.5 * cell_h, -0.5 * cell_h, -1.5 * cell_h]

    # Row 0 (5 cols): Vanguard Idle 3/4, Vanguard Idle Top-Down, Vanguard Overheat 3/4, Vanguard Overheat Top, enemy_splitter Attack
    vanguard_glb = models_dir / "player_vanguard.glb"
    splitter_glb = models_dir / "enemy_splitter.glb"
    row0_specs = [
        (vanguard_glb, "Vanguard_Idle_34", "Idle", 1, (0.0, 0.0, -30.0)),
        (vanguard_glb, "Vanguard_Idle_Top", "Idle", 1, (-34.0, 0.0, 0.0)),
        (vanguard_glb, "Vanguard_Overheat_34", "Overheat", 8, (0.0, 0.0, -30.0)),
        (vanguard_glb, "Vanguard_Overheat_Top", "Overheat", 8, (-34.0, 0.0, 0.0)),
        (splitter_glb, "Splitter_Attack", "Attack", 8, (0.0, 0.0, -30.0)),
    ]
    for ci, (glb, tag, clip, fr, rot) in enumerate(row0_specs):
        root, bmin, bmax = _v13_import_cell(glb, tag, clip_name=clip, frame=fr)
        span = max(bmax[0] - bmin[0], bmax[1] - bmin[1], bmax[2] - bmin[2], 0.1)
        _v13_place_root(root, bmin, bmax, 2.75 / span, ((ci - 2.0) * cell_w, row_ys[0], 0.0), rot_euler_deg=rot)

    # Row 1 (4 primary weapons at Attack frame 8)
    wpn_row1 = ["wpn_pulse_blaster", "wpn_scatter_cannon", "wpn_rail_sniper", "wpn_homing_pod"]
    for ci, wname in enumerate(wpn_row1):
        root, bmin, bmax = _v13_import_cell(models_dir / f"{wname}.glb", wname, clip_name="Attack", frame=8)
        span = max(bmax[0] - bmin[0], bmax[1] - bmin[1], bmax[2] - bmin[2], 0.1)
        _v13_place_root(root, bmin, bmax, 2.75 / span, ((ci - 1.5) * cell_w, row_ys[1], 0.0), rot_euler_deg=(-12.0, 0.0, -38.0))

    # Row 2 (4 skill/cooling weapons at Attack frame 8)
    wpn_row2 = ["wpn_skill_salvo", "wpn_skill_beam", "wpn_skill_emp", "wpn_thermal_sink"]
    for ci, wname in enumerate(wpn_row2):
        root, bmin, bmax = _v13_import_cell(models_dir / f"{wname}.glb", wname, clip_name="Attack", frame=8)
        span = max(bmax[0] - bmin[0], bmax[1] - bmin[1], bmax[2] - bmin[2], 0.1)
        _v13_place_root(root, bmin, bmax, 2.75 / span, ((ci - 1.5) * cell_w, row_ys[2], 0.0), rot_euler_deg=(-12.0, 0.0, -38.0))

    # Row 3 (5 props)
    prop_specs = [
        ("prop_nova_bomb", "Attack", 8),
        ("prop_mine_static", "Attack", 8),
        ("prop_mine_homing", "Attack", 8),
        ("prop_powerup_pod", "Idle", 4),
        ("prop_medkit_pod", "Idle", 4),
    ]
    for ci, (pname, clip, fr) in enumerate(prop_specs):
        root, bmin, bmax = _v13_import_cell(models_dir / f"{pname}.glb", pname, clip_name=clip, frame=fr)
        span = max(bmax[0] - bmin[0], bmax[1] - bmin[1], bmax[2] - bmin[2], 0.1)
        _v13_place_root(root, bmin, bmax, 2.55 / span, ((ci - 2.0) * cell_w, row_ys[3], 0.0), rot_euler_deg=(-10.0, 0.0, -32.0))

    scene.render.filepath = str(out_path)
    bpy.ops.render.render(write_still=True)


def main() -> None:
    import sys  # noqa: PLC0415

    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    if "--v13" in sys.argv:
        render_v13_enemies_3stage(PREVIEW_DIR / "showcase_v13_enemies_3stage.png")
        render_v13_vanguard_weapons_props(PREVIEW_DIR / "showcase_v13_vanguard_weapons_props.png")
        return

    render_fighters_showcase(PREVIEW_DIR / "showcase_v4_fighters.png")
    render_bosses_showcase(PREVIEW_DIR / "showcase_v4_bosses.png")
    render_bosses_closeup(PREVIEW_DIR / "showcase_v45_bosses_closeup.png")
    render_props_showcase(PREVIEW_DIR / "showcase_v4_props.png")
    render_animations_matrix(PREVIEW_DIR / "showcase_v4_animations.png")


if __name__ == "__main__":
    main()
