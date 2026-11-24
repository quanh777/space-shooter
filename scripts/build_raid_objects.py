"""
Arena Obstacles & Raid Objectives Asset Builder.
Sculpts, bakes BVH AO, rigs, animates ('Idle'), and exports 5 prop .glb models into
public/assets/models/:
  1. obj_asteroid_ore.glb   (Destructible basalt rock laced with shiny gold veins)
  2. obj_plasma_barrel.glb  (Explosive red drum practically begging to be shot)
  3. obj_raid_reactor.glb   (Armored Sector Reactor objective)
  4. obj_raid_vault.glb     (Encrypted orbital black-box vault)
  5. obj_raid_convoy.glb    (Armored gold-ore cargo freighter)

Run headless in Blender 4.2+:
  blender --background --python scripts/build_raid_objects.py -- --showcase <out.png>
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import blender_sculpt_lib as lib  # noqa: E402
import bmesh  # noqa: E402
import bpy  # noqa: E402
import mathutils  # noqa: E402


def _make_faceted_ore_rock(
    name: str,
    radius: float,
    mat: bpy.types.Material,
    subdivisions: int = 2,
    seed_offset: float = 0.0,
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(name + "_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)

    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=radius)
    for v in bm.verts:
        p = v.co
        ridge = (
            math.sin(p.x * 2.9 + seed_offset) * math.cos(p.z * 3.4) * 0.24
            + math.cos(p.y * 3.1 - p.x * 2.2 + seed_offset * 0.7) * 0.16
        )
        disp = max(0.58, 1.0 + ridge)
        v.co.x *= disp * 1.12
        v.co.y *= disp * 0.96
        v.co.z *= disp * 0.82
    bm.to_mesh(mesh)
    bm.free()

    for poly in mesh.polygons:
        poly.use_smooth = False
    obj.data.materials.append(mat)
    return obj


# 1. Destructible Ore Asteroid (obj_asteroid_ore.glb)
def build_obj_asteroid_ore() -> None:
    lib.reset_scene()
    rock_mat = lib.make_material("BasaltRock", (0.14, 0.17, 0.22), metallic=0.14, roughness=0.86, brushed=True, use_ao_vc=True)
    slate_mat = lib.make_material("BasaltCrust", (0.23, 0.27, 0.34), metallic=0.22, roughness=0.72, use_ao_vc=True)
    ore_amber = lib.make_material(
        "OreAmberGlow", (1.0, 0.68, 0.20), metallic=0.15, roughness=0.20,
        emission_color=(1.0, 0.56, 0.10), emission_strength=3.6, use_ao_vc=False,
    )
    ore_cyan = lib.make_material(
        "OreCyanGlow", (0.28, 0.94, 1.0), metallic=0.15, roughness=0.20,
        emission_color=(0.18, 0.88, 1.0), emission_strength=3.4, use_ao_vc=False,
    )

    core = _make_faceted_ore_rock("Asteroid_Core", 0.98, rock_mat, subdivisions=2, seed_offset=0.4)
    belt_crust = _make_faceted_ore_rock("Asteroid_Ridge", 0.72, slate_mat, subdivisions=1, seed_offset=2.1)
    belt_crust.location = (0.22, -0.18, 0.12)

    body: list[bpy.types.Object] = [core, belt_crust]
    spire_dirs = [
        (0.68, 0.42, 0.28, (35, -42, 18), ore_amber, 1.05),
        (-0.66, 0.48, 0.22, (-28, 48, 110), ore_cyan, 0.95),
        (0.18, -0.74, 0.24, (52, 12, -84), ore_amber, 0.92),
        (-0.34, -0.46, 0.58, (-18, -32, 220), ore_cyan, 0.86),
    ]
    for i, (x, y, z, rot, mat, sc) in enumerate(spire_dirs):
        crystal = lib.create_geo(
            f"Asteroid_Crystal_{i}", "cone", mat,
            location=(x, y, z), rotation_deg=rot, vertices=6, radius1=0.22 * sc, radius2=0.0, depth=0.68 * sc, bevel=0.0,
        )
        body.append(crystal)

    chips: list[bpy.types.Object] = []
    for i in range(3):
        ang = (i / 3.0) * math.tau
        chip = _make_faceted_ore_rock(f"Asteroid_Chip_{i}", 0.16, slate_mat, subdivisions=1, seed_offset=i * 1.9)
        chip.location = (math.cos(ang) * 1.28, math.sin(ang) * 1.28, 0.12 if i % 2 == 0 else -0.10)
        chips.append(chip)

    lib.bake_model_vertex_ao([*body, *chips], ao_samples=10, ao_radius=0.75)

    rig = lib.create_rig(
        "AsteroidOreRig",
        {
            "Root": ((0, 0, 0), (0, 0.5, 0), None),
            "OrbitRing": ((0, 0, 0), (0, 0.4, 0), "Root"),
        },
    )
    lib.parent_to_bone(body, rig, "Root")
    lib.parent_to_bone(chips, rig, "OrbitRing")

    lib.start_action(rig, "Idle")
    for f, deg, bob in [(1, 0.0, 0.0), (24, 180.0, 0.05), (48, 360.0, 0.0)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, bob))
        lib.key_bone(rig, "OrbitRing", f, rot_deg=(0, 0, deg))
    lib.finalize_action_to_nla(rig, "Idle")
    lib.export_glb("obj_asteroid_ore.glb")


# 2. Explosive Plasma Barrel (obj_plasma_barrel.glb)
def build_obj_plasma_barrel() -> None:
    lib.reset_scene()
    steel = lib.make_material("BarrelSteel", (0.16, 0.19, 0.25), metallic=0.86, roughness=0.30, brushed=True, use_ao_vc=True)
    hazard = lib.make_material("BarrelHazard", (0.96, 0.42, 0.06), metallic=0.28, roughness=0.28, use_ao_vc=True)
    plasma = lib.make_material(
        "BarrelPlasmaCore", (1.0, 0.36, 0.10), metallic=0.0, roughness=0.10,
        emission_color=(1.0, 0.30, 0.06), emission_strength=4.5, use_ao_vc=False,
    )

    body: list[bpy.types.Object] = []
    # Top & bottom octagonal armored caps
    for idx, z in enumerate((-0.66, 0.66)):
        cap = lib.create_geo(
            f"Barrel_Cap_{idx}", "cylinder", steel,
            location=(0, 0, z), vertices=8, radius=0.66, depth=0.22, bevel=0.02, bevel_segments=1,
        )
        band = lib.create_geo(
            f"Barrel_Band_{idx}", "cylinder", hazard,
            location=(0, 0, z * 0.78), vertices=8, radius=0.69, depth=0.09, bevel=0.01, bevel_segments=1,
        )
        body.extend([cap, band])

    # Volatile Plasma Column Core
    core = lib.create_geo(
        "Barrel_PlasmaColumn", "cylinder", plasma,
        location=(0, 0, 0), vertices=14, radius=0.42, depth=1.18, bevel=0.0,
    )
    body.append(core)

    # 4 External containment cage pillars
    for i in range(4):
        ang = math.radians(45 + i * 90)
        pillar = lib.create_geo(
            f"Barrel_CagePillar_{i}", "cube", steel,
            location=(math.cos(ang) * 0.62, math.sin(ang) * 0.62, 0.0),
            rotation_deg=(0, 0, 45 + i * 90),
            scale=(0.14, 0.16, 1.32), bevel=0.01, bevel_segments=1,
        )
        body.append(pillar)

    ring_top = lib.build_precision_ring_assembly(
        "Barrel_LockRingTop", (0, 0, 0.24), 0.76, 0.045, 16, steel, hazard, plasma, clamp_count=4
    )
    ring_bot = lib.build_precision_ring_assembly(
        "Barrel_LockRingBot", (0, 0, -0.24), 0.76, 0.045, 16, steel, hazard, plasma, clamp_count=4
    )

    lib.bake_model_vertex_ao([*body, *ring_top, *ring_bot], ao_samples=10, ao_radius=0.70)

    rig = lib.create_rig(
        "PlasmaBarrelRig",
        {
            "Root": ((0, 0, 0), (0, 0.5, 0), None),
            "CageTop": ((0, 0, 0.24), (0, 0.4, 0.24), "Root"),
            "CageBot": ((0, 0, -0.24), (0, 0.4, -0.24), "Root"),
        },
    )
    lib.parent_to_bone(body, rig, "Root")
    lib.parent_to_bone(ring_top, rig, "CageTop")
    lib.parent_to_bone(ring_bot, rig, "CageBot")

    lib.start_action(rig, "Idle")
    for f, deg, sc in [(1, 0.0, 1.0), (24, 180.0, 1.04), (48, 360.0, 1.0)]:
        lib.key_bone(rig, "Root", f, scale=(sc, sc, 1.0))
        lib.key_bone(rig, "CageTop", f, rot_deg=(0, 0, deg))
        lib.key_bone(rig, "CageBot", f, rot_deg=(0, 0, -deg))
    lib.finalize_action_to_nla(rig, "Idle")
    lib.export_glb("obj_plasma_barrel.glb")


# 3. Sector Reactor Objective (obj_raid_reactor.glb)
def build_obj_raid_reactor() -> None:
    lib.reset_scene()
    armor = lib.make_material("ReactorArmor", (0.14, 0.16, 0.22), metallic=0.62, roughness=0.30, brushed=True, use_ao_vc=True)
    crimson = lib.make_material("ReactorCrimson", (0.76, 0.14, 0.18), metallic=0.35, roughness=0.25, use_ao_vc=True)
    frame = lib.make_material("ReactorFrame", (0.24, 0.28, 0.34), metallic=0.88, roughness=0.28, use_ao_vc=True)
    core_glow = lib.make_material(
        "ReactorPlasma", (1.0, 0.26, 0.16), metallic=0.0, roughness=0.08,
        emission_color=(1.0, 0.22, 0.12), emission_strength=4.8, use_ao_vc=False,
    )

    body: list[bpy.types.Object] = []
    base = lib.create_geo(
        "Reactor_HexBase", "cylinder", armor,
        location=(0, 0, -0.58), vertices=6, radius=1.22, depth=0.38, bevel=0.04, bevel_segments=1,
    )
    top_crown = lib.create_geo(
        "Reactor_CrownRing", "cylinder", frame,
        location=(0, 0, 0.84), vertices=6, radius=0.72, depth=0.28, bevel=0.02, bevel_segments=1,
    )
    spire = lib.create_geo(
        "Reactor_Spire", "cone", core_glow,
        location=(0, 0, 1.24), vertices=6, radius1=0.26, radius2=0.0, depth=0.66, bevel=0.0,
    )
    column = lib.create_geo(
        "Reactor_EnergyColumn", "cylinder", core_glow,
        location=(0, 0, 0.14), vertices=14, radius=0.46, depth=1.36, bevel=0.0,
    )
    body.extend([base, top_crown, spire, column])

    # 3 Radial Cooling Buttresses
    for i in range(3):
        ang = math.radians(i * 120)
        ca, sa = math.cos(ang), math.sin(ang)
        leg = lib.create_geo(
            f"Reactor_Buttress_{i}", "cube", crimson,
            location=(ca * 0.94, sa * 0.94, -0.18), rotation_deg=(0, -18, i * 120),
            scale=(0.74, 0.36, 0.72), bevel=0.02, bevel_segments=1,
        )
        rib = lib.create_geo(
            f"Reactor_ClampRib_{i}", "cube", frame,
            location=(ca * 0.88, sa * 0.88, 0.34), rotation_deg=(0, 0, i * 120),
            scale=(0.56, 0.22, 0.34), bevel=0.015, bevel_segments=1,
        )
        body.extend([leg, rib])

    body.extend(
        lib.build_precision_ring_assembly(
            "Reactor_InnerCollar", (0, 0, 0.16), 0.74, 0.05, 16, frame, crimson, core_glow, clamp_count=3
        )
    )

    rotor_shields: list[bpy.types.Object] = []
    for i in range(3):
        ang = math.radians(60 + i * 120)
        plate = lib.create_geo(
            f"Reactor_RotorFin_{i}", "cube", armor,
            location=(math.cos(ang) * 1.18, math.sin(ang) * 1.18, 0.28),
            rotation_deg=(0, 0, 60 + i * 120),
            scale=(0.16, 0.76, 0.92), bevel=0.015, bevel_segments=1,
        )
        trim = lib.create_geo(
            f"Reactor_RotorTrim_{i}", "cube", core_glow,
            location=(math.cos(ang) * 1.24, math.sin(ang) * 1.24, 0.28),
            rotation_deg=(0, 0, 60 + i * 120),
            scale=(0.06, 0.42, 0.62), bevel=0.0,
        )
        rotor_shields.extend([plate, trim])

    lib.bake_model_vertex_ao([*body, *rotor_shields], ao_samples=10, ao_radius=0.85)

    rig = lib.create_rig(
        "RaidReactorRig",
        {
            "Root": ((0, 0, 0), (0, 0.5, 0), None),
            "ShieldRotor": ((0, 0, 0.28), (0, 0.5, 0.28), "Root"),
        },
    )
    lib.parent_to_bone(body, rig, "Root")
    lib.parent_to_bone(rotor_shields, rig, "ShieldRotor")

    lib.start_action(rig, "Idle")
    for f, deg, z_b in [(1, 0.0, 0.0), (24, 180.0, 0.04), (48, 360.0, 0.0)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, z_b))
        lib.key_bone(rig, "ShieldRotor", f, rot_deg=(0, 0, deg))
    lib.finalize_action_to_nla(rig, "Idle")
    lib.export_glb("obj_raid_reactor.glb")


# 4. Encrypted Data Vault Objective (obj_raid_vault.glb)
def build_obj_raid_vault() -> None:
    lib.reset_scene()
    hull = lib.make_material("VaultArmor", (0.12, 0.18, 0.28), metallic=0.58, roughness=0.28, brushed=True, use_ao_vc=True)
    gold = lib.make_material("VaultGoldClamp", (0.92, 0.70, 0.22), metallic=0.82, roughness=0.22, use_ao_vc=True)
    frame = lib.make_material("VaultFrame", (0.20, 0.24, 0.30), metallic=0.88, roughness=0.30, use_ao_vc=True)
    cyan = lib.make_material(
        "VaultCyanCore", (0.22, 0.94, 1.0), metallic=0.0, roughness=0.08,
        emission_color=(0.14, 0.92, 1.0), emission_strength=4.6, use_ao_vc=False,
    )

    body: list[bpy.types.Object] = []
    main_box = lib.create_geo(
        "Vault_OctaBody", "cylinder", hull,
        location=(0, 0, -0.08), vertices=8, radius=0.98, depth=0.78, bevel=0.05, bevel_segments=1,
    )
    lower_skirt = lib.create_geo(
        "Vault_Skirt", "cylinder", frame,
        location=(0, 0, -0.48), vertices=8, radius=1.14, depth=0.20, bevel=0.03, bevel_segments=1,
    )
    beacon_orb = lib.create_geo(
        "Vault_HoloCore", "ico", cyan,
        location=(0, 0, 0.56), subdivisions=2, radius=0.34, bevel=0.0,
    )
    body.extend([main_box, lower_skirt, beacon_orb])

    for i in range(4):
        ang = math.radians(45 + i * 90)
        clamp = lib.create_geo(
            f"Vault_CornerClamp_{i}", "cube", gold,
            location=(math.cos(ang) * 0.94, math.sin(ang) * 0.94, -0.04),
            rotation_deg=(0, 0, 45 + i * 90),
            scale=(0.30, 0.22, 0.72), bevel=0.02, bevel_segments=1,
        )
        strip = lib.create_geo(
            f"Vault_DataStrip_{i}", "cube", cyan,
            location=(math.cos(ang + 0.78) * 0.96, math.sin(ang + 0.78) * 0.96, -0.02),
            rotation_deg=(0, 0, i * 90),
            scale=(0.06, 0.36, 0.14), bevel=0.0,
        )
        body.extend([clamp, strip])

    halo = lib.build_precision_ring_assembly(
        "Vault_UpperHalo", (0, 0, 0.42), 0.78, 0.042, 16, frame, gold, cyan, clamp_count=4
    )
    body.extend(halo)

    scanner_parts: list[bpy.types.Object] = []
    dish_arm = lib.create_geo(
        "Vault_ScannerArm", "cube", frame,
        location=(0, 0, 0.94), scale=(0.95, 0.14, 0.10), bevel=0.01, bevel_segments=1,
    )
    for sx in (-0.45, 0.45):
        emitter = lib.create_geo(
            f"Vault_ScannerTip_{sx:.1f}", "cube", cyan,
            location=(sx, 0, 0.98), scale=(0.14, 0.22, 0.14), bevel=0.0,
        )
        scanner_parts.append(emitter)
    scanner_parts.append(dish_arm)

    lib.bake_model_vertex_ao([*body, *scanner_parts], ao_samples=10, ao_radius=0.80)

    rig = lib.create_rig(
        "RaidVaultRig",
        {
            "Root": ((0, 0, 0), (0, 0.5, 0), None),
            "ScannerHead": ((0, 0, 0.94), (0, 0.4, 0.94), "Root"),
        },
    )
    lib.parent_to_bone(body, rig, "Root")
    lib.parent_to_bone(scanner_parts, rig, "ScannerHead")

    lib.start_action(rig, "Idle")
    for f, deg, bob in [(1, 0.0, 0.0), (24, 180.0, 0.06), (48, 360.0, 0.0)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, bob))
        lib.key_bone(rig, "ScannerHead", f, rot_deg=(0, 0, deg))
    lib.finalize_action_to_nla(rig, "Idle")
    lib.export_glb("obj_raid_vault.glb")


# 5. Armored Gold-Ore Cargo Freighter (obj_raid_convoy.glb)
def build_obj_raid_convoy() -> None:
    lib.reset_scene()
    hull = lib.make_material("ConvoyHull", (0.24, 0.28, 0.34), metallic=0.66, roughness=0.34, brushed=True, use_ao_vc=True)
    brass = lib.make_material("ConvoyGoldArmor", (0.94, 0.72, 0.24), metallic=0.72, roughness=0.26, use_ao_vc=True)
    frame = lib.make_material("ConvoyFrame", (0.12, 0.14, 0.18), metallic=0.88, roughness=0.32, use_ao_vc=True)
    glow = lib.make_material(
        "ConvoyGoldGlow", (1.0, 0.78, 0.22), metallic=0.0, roughness=0.10,
        emission_color=(1.0, 0.68, 0.14), emission_strength=4.2, use_ao_vc=False,
    )

    hull_spine = lib.build_lofted_hull(
        "Convoy_MainSpine",
        [
            (-1.55, lib.jet_profile(0.46, 0.34, -0.26, deck_w=0.45)),
            (-0.65, lib.jet_profile(0.56, 0.40, -0.32, deck_w=0.42)),
            (0.65,  lib.jet_profile(0.54, 0.38, -0.30, deck_w=0.42)),
            (1.42,  lib.jet_profile(0.42, 0.32, -0.24, deck_w=0.45)),
            (1.74,  lib.jet_profile(0.24, 0.20, -0.14, deck_w=0.50)),
        ],
        hull, crease_indices={2, 7}, subsurf=1, bevel_segments=1,
    )
    bridge = lib.create_geo(
        "Convoy_BridgeTower", "cube", brass,
        location=(0.98, 0.0, 0.42), scale=(0.68, 0.54, 0.34), bevel=0.025, bevel_segments=1,
    )
    visor = lib.create_geo(
        "Convoy_BridgeVisor", "cube", glow,
        location=(1.32, 0.0, 0.44), scale=(0.06, 0.42, 0.12), bevel=0.0,
    )
    body: list[bpy.types.Object] = [hull_spine, bridge, visor]

    # 4 External Golden Cargo Ore Containers flanking Port/Starboard
    for cx in (-0.52, 0.28):
        rack = lib.create_geo(
            f"Convoy_RackBeam_{cx:.2f}", "cube", frame,
            location=(cx, 0.0, 0.02), scale=(0.24, 1.88, 0.18), bevel=0.01, bevel_segments=1,
        )
        body.append(rack)
        for sign, side in ((1, "L"), (-1, "R")):
            pod = lib.create_geo(
                f"Convoy_CargoPod_{cx:.2f}_{side}", "cylinder", brass,
                location=(cx, 0.86 * sign, 0.02), rotation_deg=(0, 90, 0),
                vertices=8, radius=0.30, depth=0.62, bevel=0.02, bevel_segments=1,
            )
            strip = lib.create_geo(
                f"Convoy_CargoCore_{cx:.2f}_{side}", "cube", glow,
                location=(cx, 0.86 * sign, 0.26), scale=(0.44, 0.14, 0.08), bevel=0.0,
            )
            body.extend([pod, strip])

    # Twin Dorsal Stabilizers
    for sign, side in ((1, "L"), (-1, "R")):
        fin = lib.create_geo(
            f"Convoy_TailFin_{side}", "cube", brass,
            location=(-1.28, 0.38 * sign, 0.46), rotation_deg=(18 * sign, -12, 0),
            scale=(0.56, 0.08, 0.44), bevel=0.01, bevel_segments=1,
        )
        body.append(fin)

    # 3 Rear Engine Thrusters
    engines: list[bpy.types.Object] = []
    for ey in (-0.32, 0.0, 0.32):
        shroud, petals = lib.build_vector_nozzle(
            f"Convoy_Nozzle_{ey:.2f}", (-1.58, ey, 0.02 if ey == 0 else -0.06),
            radius=0.22 if ey == 0 else 0.16, length=0.44,
            shroud_mat=frame, frame_mat=hull, glow_mat=glow, petals=6,
        )
        engines.extend([*shroud, *petals])

    lib.bake_model_vertex_ao([*body, *engines], ao_samples=10, ao_radius=0.85)

    rig = lib.create_rig(
        "RaidConvoyRig",
        {
            "Root": ((0, 0, 0), (0, 0.5, 0), None),
            "ThrusterBank": ((-1.58, 0, 0), (-1.58, 0.4, 0), "Root"),
        },
    )
    lib.parent_to_bone(body, rig, "Root")
    lib.parent_to_bone(engines, rig, "ThrusterBank")

    lib.start_action(rig, "Idle")
    for f, z_b, roll, n_sc in [(1, 0.0, 0.0, 1.0), (24, 0.08, 2.5, 1.06), (48, 0.0, 0.0, 1.0)]:
        lib.key_bone(rig, "Root", f, loc=(0, 0, z_b), rot_deg=(roll, 0, 0))
        lib.key_bone(rig, "ThrusterBank", f, scale=(n_sc, n_sc, n_sc))
    lib.finalize_action_to_nla(rig, "Idle")
    lib.export_glb("obj_raid_convoy.glb")


# Showcase Sheet Renderer
def render_showcase(out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    lib.reset_scene()
    scene = bpy.context.scene
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        try:
            scene.render.engine = engine
            break
        except Exception:
            continue
    if hasattr(scene, "eevee") and hasattr(scene.eevee, "taa_render_samples"):
        scene.eevee.taa_render_samples = 24

    scene.render.resolution_x = 2000
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.exposure = 0.25

    world = bpy.data.worlds.new("RaidObjectsShowroom")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.022, 0.032, 0.052, 1.0)
        bg.inputs[1].default_value = 1.1

    cam_data = bpy.data.cameras.new("ShowCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 16.5
    cam_obj = bpy.data.objects.new("ShowCam", cam_data)
    scene.collection.objects.link(cam_obj)
    cam_obj.location = (0.0, -7.5, 12.5)
    cam_obj.rotation_euler = (
        mathutils.Vector((0.0, 0.0, 0.0)) - mathutils.Vector(cam_obj.location)
    ).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam_obj

    for name, rot_deg, energy, col in [
        ("Key", (34, -22, 36), 3.6, (1.0, 0.96, 0.92)),
        ("Fill", (-36, 28, -108), 1.4, (0.65, 0.85, 1.0)),
        ("Rim", (54, 18, 148), 2.3, (0.85, 0.92, 1.0)),
    ]:
        ld = bpy.data.lights.new(name, type="SUN")
        ld.energy = energy
        ld.color = col
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.rotation_euler = tuple(math.radians(a) for a in rot_deg)

    slots = [
        ("obj_asteroid_ore.glb", (-6.2, 0.0, 0.0), 1.05),
        ("obj_plasma_barrel.glb", (-3.1, 0.0, 0.0), 1.15),
        ("obj_raid_reactor.glb", (0.0, 0.0, 0.0), 0.92),
        ("obj_raid_vault.glb", (3.1, 0.0, 0.0), 1.02),
        ("obj_raid_convoy.glb", (6.2, 0.0, 0.0), 0.86),
    ]
    for idx, (fname, pos, sc) in enumerate(slots):
        holder = bpy.data.objects.new(f"ShowcaseObj_{idx}", None)
        scene.collection.objects.link(holder)
        holder.location = pos
        holder.scale = (sc, sc, sc)
        holder.rotation_euler = (0.0, 0.0, math.radians(-26.0))
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(lib.OUT_DIR / fname))
        for o in bpy.data.objects:
            if o not in before and o.parent is None:
                o.parent = holder

    scene.render.filepath = str(out_path)
    bpy.ops.render.render(write_still=True)


def main() -> None:
    if "--render-only" not in sys.argv:
        build_obj_asteroid_ore()
        build_obj_plasma_barrel()
        build_obj_raid_reactor()
        build_obj_raid_vault()
        build_obj_raid_convoy()
        print("=== ALL 5 v16 RAID & OBSTACLE .GLB ASSETS EXPORTED ===")

    if "--showcase" in sys.argv:
        idx = sys.argv.index("--showcase")
        if idx + 1 < len(sys.argv):
            render_showcase(Path(sys.argv[idx + 1]))


if __name__ == "__main__":
    main()
