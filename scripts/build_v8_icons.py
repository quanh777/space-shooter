"""
256x256 Dark-Metallic Item Icon Pipeline.
Produces all 18 item PNGs in `public/assets/icons/`:
  - 12 icons sliced and trimmed cleanly from 2x2 source sheets
  - 6 icons studio-rendered via Blender 4.2 EEVEE Next over flat dark navy (#070d1a)
    so hand-rendered pieces match the illustrated icon set
  - Plus a 6x3 contact sheet for a quick sanity glance.

Usage:
  blender --background --python-exit-code 1 --python scripts/build_v8_icons.py
"""

import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
ICONS_DIR = PROJECT_ROOT / "public" / "assets" / "icons"
MODELS_DIR = PROJECT_ROOT / "public" / "assets" / "models"
SOURCE_SHEETS_DIR = PROJECT_ROOT / "previews" / "icon_sheets"
PREVIEW_DIR = PROJECT_ROOT / "previews"

if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import blender_sculpt_lib as lib
import render_blender_preview as rbp


def _slice_2x2_sheet(sheet_path: Path, mapping: dict[str, str]) -> None:
    """Slices a 2x2 source icon sheet (TL/TR/BL/BR) into crisp 256x256 PNGs."""
    img = bpy.data.images.load(str(sheet_path))
    w, h = img.size[0], img.size[1]
    arr = np.array(img.pixels[:], dtype=np.float32).reshape((h, w, 4))

    # In Blender image coordinates Y=0 is bottom row, Y=h-1 is top row.
    # Trim ~3.5% inside quadrant edges to discard any center cross line.
    pad_x = int(w * 0.032)
    pad_y = int(h * 0.032)
    mid_x = w // 2
    mid_y = h // 2

    quads = {
        "TL": arr[mid_y + pad_y : h - pad_y // 2, pad_x // 2 : mid_x - pad_x],
        "TR": arr[mid_y + pad_y : h - pad_y // 2, mid_x + pad_x : w - pad_x // 2],
        "BL": arr[pad_y // 2 : mid_y - pad_y, pad_x // 2 : mid_x - pad_x],
        "BR": arr[pad_y // 2 : mid_y - pad_y, mid_x + pad_x : w - pad_x // 2],
    }

    for quad_key, out_name in mapping.items():
        sub = quads[quad_key]
        sh, sw = sub.shape[0], sub.shape[1]
        out_img = bpy.data.images.new(out_name, width=sw, height=sh, alpha=True)
        out_img.pixels.foreach_set(sub.ravel())
        out_img.scale(256, 256)
        out_img.filepath_raw = str(ICONS_DIR / out_name)
        out_img.file_format = "PNG"
        out_img.save()
        bpy.data.images.remove(out_img)
        print(f"[SLICED ICON] {out_name} (256x256)")

    bpy.data.images.remove(img)


def _setup_icon_studio() -> bpy.types.Scene:
    scene = rbp.setup_studio_scene(bloom_glare=True)
    # Hide hangar floor and composite over a flat #070d1a backdrop
    for obj in list(bpy.data.objects):
        if obj.type == "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)

    scene.render.film_transparent = True
    if scene.world and scene.world.use_nodes:
        bg = next((n for n in scene.world.node_tree.nodes if n.type == "BACKGROUND"), None)
        if bg:
            bg.inputs[0].default_value = (0.001, 0.002, 0.006, 1.0)
            bg.inputs[1].default_value = 0.6

    # Composite rendered transparent asset + glare over exact flat #070d1a sRGB background
    scene.use_nodes = True
    nt = scene.node_tree
    nt.nodes.clear()
    rl = nt.nodes.new("CompositorNodeRLayers")
    glare = nt.nodes.new("CompositorNodeGlare")
    glare.glare_type = "FOG_GLOW"
    glare.quality = "MEDIUM"
    glare.threshold = 1.25
    glare.size = 6
    glare.mix = -0.25

    bg_col = nt.nodes.new("CompositorNodeRGB")
    bg_col.outputs[0].default_value = (0.0020, 0.0042, 0.0110, 1.0)
    alpha_over = nt.nodes.new("CompositorNodeAlphaOver")
    comp = nt.nodes.new("CompositorNodeComposite")

    nt.links.new(rl.outputs["Image"], glare.inputs["Image"])
    nt.links.new(bg_col.outputs["RGBA"], alpha_over.inputs[1])
    nt.links.new(glare.outputs["Image"], alpha_over.inputs[2])
    nt.links.new(alpha_over.outputs["Image"], comp.inputs["Image"])

    scene.render.resolution_x = 256
    scene.render.resolution_y = 256
    scene.render.resolution_percentage = 100
    scene.view_settings.exposure = 0.55
    return scene


def _build_bounty_chip_scene() -> None:
    """Sculpts a metallic gold & navy Cyber-Credit Bounty Chip for `core_greed.png`."""
    pal = lib.make_faction_palette()
    gold = pal["s_gold"]
    navy = pal["p_navy"]
    amber = lib.make_material(
        "GreedAmberTrace",
        (1.0, 0.72, 0.14),
        metallic=0.0,
        roughness=0.1,
        emission_color=(1.0, 0.68, 0.12),
        emission_strength=4.5,
        use_ao_vc=False,
    )

    body = lib.build_beveled_armor_plate(
        "Chip_Body",
        [(-0.78, -0.58), (0.58, -0.58), (0.78, -0.38), (0.78, 0.58), (-0.58, 0.58), (-0.78, 0.38)],
        z_bottom=-0.16,
        z_top=0.16,
        mat=navy,
        top_inset=0.88,
        bevel=0.025,
    )
    rim = lib.build_beveled_armor_plate(
        "Chip_GoldRim",
        [(-0.62, -0.44), (0.46, -0.44), (0.62, -0.28), (0.62, 0.44), (-0.46, 0.44), (-0.62, 0.28)],
        z_bottom=0.14,
        z_top=0.22,
        mat=gold,
        top_inset=0.86,
        bevel=0.015,
    )
    coin = lib.create_geo(
        "Chip_CoreCoin", "cylinder", gold,
        location=(0.0, 0.0, 0.24), scale=(0.44, 0.44, 0.10), bevel=0.015, subsurf=1,
    )
    glow_ring = lib.create_geo(
        "Chip_GlowCircuit", "cylinder", amber,
        location=(0.0, 0.0, 0.295), scale=(0.24, 0.24, 0.04), bevel=0.0,
    )
    for i in range(4):
        sx = -0.38 + i * 0.25
        lib.create_geo(
            f"Chip_PinTop_{i}", "cube", gold,
            location=(sx, 0.60, 0.0), scale=(0.12, 0.16, 0.10), bevel=0.008,
        )
        lib.create_geo(
            f"Chip_PinBot_{i}", "cube", gold,
            location=(sx, -0.60, 0.0), scale=(0.12, 0.16, 0.10), bevel=0.008,
        )
    lib.bake_model_vertex_ao([o for o in bpy.data.objects if o.type == "MESH"], ao_samples=12, ao_radius=0.8)


def _render_model_icon(glb_name: str | None, out_name: str, rot_deg: tuple[float, float, float], ortho_scale: float, action: str | None = "Attack", frame: int = 8) -> None:
    scene = _setup_icon_studio()
    if glb_name is not None:
        rbp._import_and_mount(scene, glb_name, (0.0, 0.0, 0.0), 1.0, rot_deg, action, frame)
    else:
        _build_bounty_chip_scene()
        holder = bpy.data.objects.new("ChipHolder", None)
        scene.collection.objects.link(holder)
        for o in list(bpy.data.objects):
            if o.type == "MESH" and o.parent is None:
                o.parent = holder
        holder.rotation_euler = tuple(math.radians(a) for a in rot_deg)

    cam_data = bpy.data.cameras.new("IconCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = ortho_scale
    cam_obj = bpy.data.objects.new("IconCam", cam_data)
    scene.collection.objects.link(cam_obj)
    cam_obj.location = (0.0, 0.0, 14.0)
    cam_obj.rotation_euler = (0.0, 0.0, 0.0)
    scene.camera = cam_obj

    out_path = ICONS_DIR / out_name
    scene.render.filepath = str(out_path)
    bpy.ops.render.render(write_still=True)
    print(f"[RENDERED ICON] {out_name} (256x256)")


def _build_contact_sheet(out_path: Path) -> None:
    icon_names = [
        "pulse_blaster.png", "scatter_cannon.png", "rail_sniper.png",
        "homing_pod.png", "thermal_sink.png", "skill_salvo.png",
        "skill_beam.png", "skill_emp.png", "core_health.png",
        "core_max_health.png", "core_shield.png", "core_regen.png",
        "core_energy.png", "core_speed.png", "core_dash.png",
        "core_luck.png", "core_magnet.png", "core_greed.png",
    ]
    cols, rows = 6, 3
    tile = 256
    canvas = np.zeros((rows * tile, cols * tile, 4), dtype=np.float32)
    for idx, fname in enumerate(icon_names):
        r = idx // cols
        c = idx % cols
        # Place row 0 at TOP of contact sheet (Blender image Y=rows-1-r)
        y0 = (rows - 1 - r) * tile
        x0 = c * tile
        img = bpy.data.images.load(str(ICONS_DIR / fname))
        arr = np.array(img.pixels[:], dtype=np.float32).reshape((tile, tile, 4))
        canvas[y0 : y0 + tile, x0 : x0 + tile] = arr
        bpy.data.images.remove(img)

    sheet = bpy.data.images.new("ContactSheet", width=cols * tile, height=rows * tile, alpha=True)
    sheet.pixels.foreach_set(canvas.ravel())
    sheet.filepath_raw = str(out_path)
    sheet.file_format = "PNG"
    sheet.save()
    bpy.data.images.remove(sheet)
    print(f"[CONTACT SHEET SAVED] {out_path}")


def main() -> None:
    ICONS_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Slice 12 icons from 2x2 source sheets when available
    sheet_specs = [
        (
            "icon_sheet_weapons.jpg",
            {
                "TL": "pulse_blaster.png",
                "TR": "scatter_cannon.png",
                "BL": "rail_sniper.png",
                "BR": "homing_pod.png",
            },
        ),
        (
            "icon_sheet_core_defense.jpg",
            {
                "TL": "core_max_health.png",
                "TR": "core_shield.png",
                "BL": "core_regen.png",
                "BR": "core_energy.png",
            },
        ),
        (
            "icon_sheet_core_mobility.jpg",
            {
                "TL": "core_speed.png",
                "TR": "core_dash.png",
                "BL": "core_luck.png",
                "BR": "core_magnet.png",
            },
        ),
    ]
    for sheet_name, mapping in sheet_specs:
        sheet_path = SOURCE_SHEETS_DIR / sheet_name
        if sheet_path.exists():
            _slice_2x2_sheet(sheet_path, mapping)

    # 2. Studio-render remaining 6 icons cleanly in matching dark-navy 3/4 EEVEE lighting
    _render_model_icon("wpn_skill_salvo.glb", "skill_salvo.png", (38.0, -18.0, -34.0), 2.55, "Attack", 10)
    _render_model_icon("wpn_skill_beam.glb", "skill_beam.png", (36.0, -18.0, -36.0), 3.15, "Attack", 10)
    _render_model_icon("wpn_skill_emp.glb", "skill_emp.png", (42.0, -14.0, -30.0), 2.50, "Attack", 10)
    _render_model_icon("wpn_thermal_sink.glb", "thermal_sink.png", (36.0, -16.0, -34.0), 2.45, "Attack", 10)
    _render_model_icon("prop_medkit_pod.glb", "core_health.png", (38.0, -16.0, -32.0), 2.75, "Idle", 12)
    _render_model_icon(None, "core_greed.png", (42.0, -18.0, -28.0), 2.25, None, 1)

    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    _build_contact_sheet(PREVIEW_DIR / "showcase_v8_icons.png")
    print("=== ALL 18 ITEM PNG ICONS READY IN public/assets/icons/ ===")


if __name__ == "__main__":
    main()
