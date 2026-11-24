"""
Combat Drone & Hades-Style Warp Gate Asset Builder.
Builds, bakes BVH AO, rigs, animates ('Idle'), and exports into public/assets/models/:
  1. prop_combat_drone.glb (Autonomous twin-wing hexagonal scout drone)
  2. obj_room_portal.glb   (Octagonal warp gate for picking your next room)

Run headless in Blender 4.2+:
  blender --background --python scripts/build_v19_assets.py
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import blender_sculpt_lib as lib  # noqa: E402
import bpy  # noqa: E402


# 1. Autonomous Combat Drone (prop_combat_drone.glb, +X forward, +Z up)
def build_prop_combat_drone() -> None:
    lib.reset_scene()
    ceramic = lib.make_material(
        "DroneCeramic", (0.86, 0.91, 0.97), metallic=0.18, roughness=0.22, use_ao_vc=True
    )
    frame = lib.make_material(
        "DroneFrame", (0.14, 0.18, 0.25), metallic=0.86, roughness=0.28, brushed=True, use_ao_vc=True
    )
    accent = lib.make_material(
        "DroneGoldAccent", (0.94, 0.62, 0.14), metallic=0.72, roughness=0.22, use_ao_vc=True
    )
    cyan_core = lib.make_material(
        "DroneOpticCyan",
        (0.28, 0.96, 1.0),
        metallic=0.0,
        roughness=0.08,
        emission_color=(0.18, 0.92, 1.0),
        emission_strength=4.6,
        use_ao_vc=False,
    )

    body: list[bpy.types.Object] = []

    # Hexagonal armored core pod
    core_hull = lib.create_geo(
        "Drone_HexCore",
        "cylinder",
        ceramic,
        location=(0.0, 0.0, 0.0),
        vertices=6,
        radius=0.46,
        depth=0.28,
        bevel=0.015,
        bevel_segments=1,
    )
    # Recessed lower gunmetal chassis ring
    sub_plate = lib.create_geo(
        "Drone_SubChassis",
        "cylinder",
        frame,
        location=(-0.03, 0.0, -0.10),
        vertices=6,
        radius=0.50,
        depth=0.14,
        bevel=0.01,
        bevel_segments=1,
    )
    # Forward glowing targeting optic lens (+X nose)
    optic_bezel = lib.create_geo(
        "Drone_OpticBezel",
        "cylinder",
        frame,
        location=(0.42, 0.0, 0.02),
        rotation_deg=(0, 90, 0),
        vertices=12,
        radius=0.18,
        depth=0.20,
        bevel=0.01,
        bevel_segments=1,
    )
    optic_lens = lib.create_geo(
        "Drone_OpticCore",
        "sphere",
        cyan_core,
        location=(0.50, 0.0, 0.02),
        segments=14,
        rings=10,
        radius=0.13,
        bevel=0.0,
    )
    # Dorsal collar + rear micro thruster bell
    dorsal_crown = lib.create_geo(
        "Drone_DorsalPlate",
        "cylinder",
        accent,
        location=(-0.02, 0.0, 0.17),
        vertices=6,
        radius=0.28,
        depth=0.08,
        bevel=0.008,
        bevel_segments=1,
    )
    thruster_shroud = lib.create_geo(
        "Drone_ThrusterShroud",
        "cylinder",
        frame,
        location=(-0.48, 0.0, 0.0),
        rotation_deg=(0, 90, 0),
        vertices=10,
        radius=0.16,
        depth=0.22,
        bevel=0.01,
        bevel_segments=1,
    )
    thruster_plume = lib.create_geo(
        "Drone_ThrusterCore",
        "cone",
        cyan_core,
        location=(-0.62, 0.0, 0.0),
        rotation_deg=(0, -90, 0),
        vertices=10,
        radius1=0.12,
        radius2=0.03,
        depth=0.24,
        bevel=0.0,
    )
    body.extend(
        [core_hull, sub_plate, optic_bezel, optic_lens, dorsal_crown, thruster_shroud, thruster_plume]
    )

    # Twin swept stabilizer wings & precision rail barrels (+-Y lateral)
    for side, tag in ((-1.0, "L"), (1.0, "R")):
        wing = lib.build_beveled_armor_plate(
            f"Drone_Wing_{tag}",
            [
                (0.24, side * 0.34),
                (-0.22, side * 0.94),
                (-0.48, side * 0.88),
                (-0.34, side * 0.32),
            ],
            z_bottom=-0.05,
            z_top=0.06,
            mat=ceramic,
            top_inset=0.84,
            tilt_deg=(side * 8.0, 0.0, 0.0),
            bevel=0.008,
            bevel_segments=1,
        )
        wing_tip = lib.create_geo(
            f"Drone_WingFin_{tag}",
            "cube",
            accent,
            location=(-0.32, side * 0.90, 0.11),
            rotation_deg=(side * 14.0, 0.0, side * -12.0),
            scale=(0.30, 0.06, 0.24),
            bevel=0.006,
            bevel_segments=1,
        )
        pod_barrel = lib.create_geo(
            f"Drone_Barrel_{tag}",
            "cylinder",
            frame,
            location=(0.24, side * 0.48, -0.04),
            rotation_deg=(0, 90, 0),
            vertices=10,
            radius=0.075,
            depth=0.58,
            bevel=0.006,
            bevel_segments=1,
        )
        muzzle_ring = lib.create_geo(
            f"Drone_MuzzleGlow_{tag}",
            "cylinder",
            cyan_core,
            location=(0.54, side * 0.48, -0.04),
            rotation_deg=(0, 90, 0),
            vertices=10,
            radius=0.06,
            depth=0.08,
            bevel=0.0,
        )
        body.extend([wing, wing_tip, pod_barrel, muzzle_ring])

    # Rotating dorsal gyro halo ring
    gyro_parts = lib.build_precision_ring_assembly(
        "Drone_GyroHalo", (0.0, 0.0, 0.24), 0.38, 0.025, 14, frame, accent, cyan_core, clamp_count=3
    )

    lib.bake_model_vertex_ao([*body, *gyro_parts], ao_samples=10, ao_radius=0.65)

    rig = lib.create_rig(
        "CombatDroneRig",
        {
            "Root": ((0, 0, 0), (0, 0.4, 0), None),
            "GyroRing": ((0, 0, 0.24), (0, 0.3, 0.24), "Root"),
        },
    )
    lib.parent_to_bone(body, rig, "Root")
    lib.parent_to_bone(gyro_parts, rig, "GyroRing")

    lib.start_action(rig, "Idle")
    for f, deg, bob in [(1, 0.0, 0.0), (24, 180.0, 0.08), (48, 360.0, 0.0)]:
        lib.key_bone(rig, "Root", f, loc=(0.0, 0.0, bob))
        lib.key_bone(rig, "GyroRing", f, rot_deg=(0.0, 0.0, deg))
    lib.finalize_action_to_nla(rig, "Idle")
    lib.export_glb("prop_combat_drone.glb")


# 2. Hades-Style Warp Room Gate (obj_room_portal.glb)
def build_obj_room_portal() -> None:
    lib.reset_scene()
    obsidian = lib.make_material(
        "PortalObsidian", (0.10, 0.13, 0.20), metallic=0.72, roughness=0.28, brushed=True, use_ao_vc=True
    )
    steel = lib.make_material(
        "PortalSteel", (0.26, 0.31, 0.40), metallic=0.88, roughness=0.24, brushed=True, use_ao_vc=True
    )
    gold = lib.make_material(
        "PortalGold", (0.94, 0.68, 0.20), metallic=0.84, roughness=0.22, use_ao_vc=True
    )
    warp_glow = lib.make_material(
        "PortalWarpCyan",
        (0.28, 0.96, 1.0),
        metallic=0.0,
        roughness=0.08,
        emission_color=(0.20, 0.90, 1.0),
        emission_strength=4.8,
        use_ao_vc=False,
    )

    body: list[bpy.types.Object] = []

    # Outer octagonal monolith base & gate ring
    outer_ring = lib.build_precision_ring_assembly(
        "Portal_OuterGate", (0, 0, 0.12), 1.32, 0.09, 16, obsidian, steel, warp_glow, clamp_count=4
    )
    body.extend(outer_ring)

    # 4 Anchored Warp Pylons with glowing energy cores
    for i in range(4):
        ang = math.radians(45 + i * 90)
        ca, sa = math.cos(ang), math.sin(ang)
        pylon = lib.create_geo(
            f"Portal_Pylon_{i}",
            "cube",
            obsidian,
            location=(ca * 1.46, sa * 1.46, 0.12),
            rotation_deg=(0, 0, 45 + i * 90),
            scale=(0.34, 0.28, 0.92),
            bevel=0.02,
            bevel_segments=1,
        )
        cap = lib.create_geo(
            f"Portal_PylonCap_{i}",
            "cube",
            gold,
            location=(ca * 1.46, sa * 1.46, 0.62),
            rotation_deg=(0, 0, 45 + i * 90),
            scale=(0.38, 0.32, 0.14),
            bevel=0.012,
            bevel_segments=1,
        )
        emitter = lib.create_geo(
            f"Portal_PylonCrystal_{i}",
            "cylinder",
            warp_glow,
            location=(ca * 1.18, sa * 1.18, 0.12),
            vertices=6,
            radius=0.11,
            depth=0.58,
            bevel=0.0,
        )
        body.extend([pylon, cap, emitter])

    # Rotating inner chevron stator & glowing iris disc
    inner_rotor: list[bpy.types.Object] = []
    inner_ring = lib.build_precision_ring_assembly(
        "Portal_InnerRotor", (0, 0, 0.12), 0.92, 0.055, 16, steel, gold, warp_glow, clamp_count=6
    )
    inner_rotor.extend(inner_ring)

    for i in range(6):
        ang = math.radians(i * 60)
        chev = lib.create_geo(
            f"Portal_Chevron_{i}",
            "cone",
            warp_glow,
            location=(math.cos(ang) * 0.72, math.sin(ang) * 0.72, 0.12),
            rotation_deg=(0, -90, i * 60),
            vertices=4,
            radius1=0.14,
            radius2=0.03,
            depth=0.26,
            bevel=0.0,
        )
        inner_rotor.append(chev)

    iris = lib.create_geo(
        "Portal_CenterIris",
        "cylinder",
        warp_glow,
        location=(0, 0, 0.12),
        vertices=16,
        radius=0.38,
        depth=0.06,
        bevel=0.0,
    )
    inner_rotor.append(iris)

    lib.bake_model_vertex_ao([*body, *inner_rotor], ao_samples=10, ao_radius=0.85)

    rig = lib.create_rig(
        "RoomPortalRig",
        {
            "Root": ((0, 0, 0), (0, 0.5, 0), None),
            "InnerRotor": ((0, 0, 0.12), (0, 0.4, 0.12), "Root"),
        },
    )
    lib.parent_to_bone(body, rig, "Root")
    lib.parent_to_bone(inner_rotor, rig, "InnerRotor")

    lib.start_action(rig, "Idle")
    for f, deg, sc in [(1, 0.0, 1.0), (24, 180.0, 1.06), (48, 360.0, 1.0)]:
        lib.key_bone(rig, "Root", f, scale=(sc, sc, 1.0))
        lib.key_bone(rig, "InnerRotor", f, rot_deg=(0.0, 0.0, deg))
    lib.finalize_action_to_nla(rig, "Idle")
    lib.export_glb("obj_room_portal.glb")


def main() -> None:
    build_prop_combat_drone()
    build_obj_room_portal()
    print("[v19 ASSETS] Exported prop_combat_drone.glb & obj_room_portal.glb cleanly.")


if __name__ == "__main__":
    main()
