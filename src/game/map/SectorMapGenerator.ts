import type { SectorHazardId } from '../../config/weapons';
import type {
  SectorAtmosphereProfile,
  SectorBiomeId,
  SectorBiomePalette,
  SectorMapProp,
  SectorMapPropKind,
  SectorMapState,
} from '../types';

interface BiomeConfig {
  id: SectorBiomeId;
  nameVi: string;
  nameEn: string;
  palette: SectorBiomePalette;
  propColors: readonly number[];
}

export const SECTOR_BIOMES: readonly BiomeConfig[] = [
  {
    id: 'azure_rift',
    nameVi: 'Vực Tinh Vân Xanh',
    nameEn: 'Azure Rift Nebula',
    palette: {
      nebulaHex: 0xa0b8e8,
      nebulaTintHex: 0x1f6aa8,
      gridHex: 0x38c8ff,
      starHex: 0x99ddff,
      planetA: [0x09162e, 0x184366, 0x357a99, 0x4ad8ff],
      planetB: [0x1f0d1c, 0x522130, 0xb86634, 0xff9f44],
    },
    propColors: [0x3b4d6b, 0x38e8ff, 0x4a6b94, 0x67e8f9],
  },
  {
    id: 'crimson_forge',
    nameVi: 'Lò Phản Ứng Đỏ Rực',
    nameEn: 'Crimson Forge Expanse',
    palette: {
      nebulaHex: 0xc2959d,
      nebulaTintHex: 0x9c2838,
      gridHex: 0xff6b4a,
      starHex: 0xffbb99,
      planetA: [0x260910, 0x631926, 0xb53c3c, 0xff7b4a],
      planetB: [0x1a131f, 0x422b45, 0x7a5068, 0xffb86c],
    },
    propColors: [0x59373f, 0xff6b4a, 0x734b44, 0xffaa44],
  },
  {
    id: 'emerald_veil',
    nameVi: 'Màn Sương Lục Bảo',
    nameEn: 'Emerald Ion Veil',
    palette: {
      nebulaHex: 0x92c4b4,
      nebulaTintHex: 0x197a5b,
      gridHex: 0x34d399,
      starHex: 0xa7f3d0,
      planetA: [0x07241e, 0x115244, 0x228f6e, 0x34d399],
      planetB: [0x121d2b, 0x263f57, 0x48768f, 0x5eead4],
    },
    propColors: [0x345950, 0x34d399, 0x4b756a, 0x5eead4],
  },
  {
    id: 'violet_abyss',
    nameVi: 'Vực Hư Không Tím',
    nameEn: 'Violet Void Abyss',
    palette: {
      nebulaHex: 0xb6a3d8,
      nebulaTintHex: 0x5b2894,
      gridHex: 0xc084fc,
      starHex: 0xe9d5ff,
      planetA: [0x170a2e, 0x3b1870, 0x7136b5, 0xc084fc],
      planetB: [0x0d1b2a, 0x1e3a5f, 0x3b6e9c, 0x38bdf8],
    },
    propColors: [0x473866, 0xc084fc, 0x5d4a82, 0x38e8ff],
  },
  {
    id: 'amber_frontier',
    nameVi: 'Biên Giới Hổ Phách',
    nameEn: 'Amber Solar Frontier',
    palette: {
      nebulaHex: 0xd0ba98,
      nebulaTintHex: 0x965f17,
      gridHex: 0xffb833,
      starHex: 0xfef08a,
      planetA: [0x261708, 0x5e3811, 0xa86c22, 0xfbbf24],
      planetB: [0x121b26, 0x23384f, 0x42668a, 0x7dd3fc],
    },
    propColors: [0x5c4c38, 0xfbbf24, 0x78634a, 0xf97316],
  },
];

const BIOME_BY_ID: Record<SectorBiomeId, BiomeConfig> = SECTOR_BIOMES.reduce(
  (acc, b) => {
    acc[b.id] = b;
    return acc;
  },
  {} as Record<SectorBiomeId, BiomeConfig>
);

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted<T>(rng: () => number, items: readonly { value: T; weight: number }[]): T {
  let total = 0;
  for (const it of items) total += it.weight;
  let roll = rng() * total;
  for (const it of items) {
    roll -= it.weight;
    if (roll <= 0) return it.value;
  }
  return items[items.length - 1].value;
}

function buildAtmosphereProfile(hazardId: SectorHazardId, biome: BiomeConfig): SectorAtmosphereProfile {
  switch (hazardId) {
    case 'solar_storm':
      return {
        smokePrimaryHex: 0xff7b29,
        smokeSecondaryHex: 0x6b1d0c,
        smokeOpacity: 0.42,
        smokeSpeedX: 0.48,
        smokeSpeedZ: 0.92,
        smokeScale: 0.042,
        particleKind: 'ember',
        particleHex: 0xffaa33,
        particleAltHex: 0xff5511,
        particleSize: 0.78,
        particleOpacity: 0.85,
        particleDriftX: 1.8,
        particleDriftZ: 5.4,
        fogHex: 0x160a06,
        fogDensity: 0.0025,
        hemiSkyHex: 0xffcf9e,
        rimLightHex: 0xff7a22,
        meteoriteDensity: 1.25,
      };
    case 'radiation_zone':
      return {
        smokePrimaryHex: 0x84cc16,
        smokeSecondaryHex: 0x5c141d,
        smokeOpacity: 0.46,
        smokeSpeedX: -0.32,
        smokeSpeedZ: 0.56,
        smokeScale: 0.048,
        particleKind: 'ash',
        particleHex: 0xa3e635,
        particleAltHex: 0xf87171,
        particleSize: 0.68,
        particleOpacity: 0.62,
        particleDriftX: -1.1,
        particleDriftZ: 3.1,
        fogHex: 0x0c140a,
        fogDensity: 0.0028,
        hemiSkyHex: 0xbef299,
        rimLightHex: 0xd9463e,
        meteoriteDensity: 1.05,
      };
    case 'magnetic_nebula':
      return {
        smokePrimaryHex: 0xa855f7,
        smokeSecondaryHex: 0x0e4f6e,
        smokeOpacity: 0.44,
        smokeSpeedX: 0.62,
        smokeSpeedZ: -0.44,
        smokeScale: 0.038,
        particleKind: 'ion',
        particleHex: 0xd8b4fe,
        particleAltHex: 0x38e8ff,
        particleSize: 0.74,
        particleOpacity: 0.88,
        particleDriftX: 2.6,
        particleDriftZ: -2.2,
        fogHex: 0x0d081a,
        fogDensity: 0.0024,
        hemiSkyHex: 0xd0c4ff,
        rimLightHex: 0xa855f7,
        meteoriteDensity: 0.95,
      };
    default:
      return {
        smokePrimaryHex: biome.palette.nebulaTintHex,
        smokeSecondaryHex: 0x0a1830,
        smokeOpacity: 0.3,
        smokeSpeedX: 0.24,
        smokeSpeedZ: 0.42,
        smokeScale: 0.036,
        particleKind: 'dust',
        particleHex: biome.palette.starHex,
        particleAltHex: biome.palette.gridHex,
        particleSize: 0.58,
        particleOpacity: 0.66,
        particleDriftX: 0.85,
        particleDriftZ: 2.35,
        fogHex: 0x040814,
        fogDensity: 0.0017,
        hemiSkyHex: 0xaad4ff,
        rimLightHex: 0xff8c2a,
        meteoriteDensity: 1.0,
      };
  }
}

function isSeparatedFrom(
  x: number,
  y: number,
  list: readonly { x: number; y: number }[],
  minDist: number
): boolean {
  const minDistSq = minDist * minDist;
  for (const pt of list) {
    const dx = x - pt.x;
    const dy = y - pt.y;
    if (dx * dx + dy * dy < minDistSq) return false;
  }
  return true;
}

export function generateSectorMap(
  inputSeed?: number,
  hazardId: SectorHazardId = 'normal'
): SectorMapState {
  const seed =
    inputSeed !== undefined
      ? Math.abs(Math.floor(inputSeed)) || 1
      : Math.floor(Math.random() * 899999 + 100000);
  const rng = mulberry32(seed);

  let biome: BiomeConfig;
  if (hazardId === 'solar_storm') {
    biome = BIOME_BY_ID[rng() < 0.5 ? 'amber_frontier' : 'crimson_forge'];
  } else if (hazardId === 'radiation_zone') {
    biome = BIOME_BY_ID[rng() < 0.5 ? 'emerald_veil' : 'crimson_forge'];
  } else if (hazardId === 'magnetic_nebula') {
    biome = BIOME_BY_ID.violet_abyss;
  } else {
    biome = SECTOR_BIOMES[Math.floor(rng() * SECTOR_BIOMES.length)];
  }

  const atmosphere = buildAtmosphereProfile(hazardId, biome);

  const planetAngle = rng() * Math.PI * 2;
  const planetAOffset = {
    x: Math.cos(planetAngle) * (46 + rng() * 20),
    z: Math.sin(planetAngle) * (28 + rng() * 16),
    scale: 0.86 + rng() * 0.34,
  };
  const planetBOffset = {
    x: -Math.cos(planetAngle + 0.5) * (44 + rng() * 22),
    z: -Math.sin(planetAngle + 0.5) * (24 + rng() * 18),
    scale: 0.8 + rng() * 0.4,
  };

  // Tune prop flavor per sector weather so storms look properly hostile
  const heroWeights: Array<{ value: SectorMapPropKind; weight: number }> =
    hazardId === 'radiation_zone'
      ? [
          { value: 'derelict_hulk', weight: 4.0 },
          { value: 'beacon_spire', weight: 2.5 },
          { value: 'ruin_ring', weight: 2.0 },
          { value: 'crystal', weight: 1.0 },
        ]
      : hazardId === 'magnetic_nebula'
        ? [
            { value: 'crystal', weight: 4.0 },
            { value: 'ruin_ring', weight: 3.0 },
            { value: 'beacon_spire', weight: 1.6 },
            { value: 'derelict_hulk', weight: 1.2 },
          ]
        : hazardId === 'solar_storm'
          ? [
              { value: 'asteroid', weight: 3.0 },
              { value: 'derelict_hulk', weight: 2.2 },
              { value: 'beacon_spire', weight: 1.8 },
              { value: 'ruin_ring', weight: 1.4 },
            ]
          : [
              { value: 'ruin_ring', weight: 2.4 },
              { value: 'derelict_hulk', weight: 2.4 },
              { value: 'beacon_spire', weight: 2.2 },
              { value: 'crystal', weight: 2.2 },
            ];

  const beltWeights: Array<{ value: SectorMapPropKind; weight: number }> =
    hazardId === 'radiation_zone'
      ? [
          { value: 'debris_cluster', weight: 4.0 },
          { value: 'asteroid', weight: 3.2 },
          { value: 'beacon_spire', weight: 0.8 },
        ]
      : hazardId === 'magnetic_nebula'
        ? [
            { value: 'crystal', weight: 3.6 },
            { value: 'asteroid', weight: 3.6 },
            { value: 'debris_cluster', weight: 1.8 },
          ]
        : [
            { value: 'asteroid', weight: 4.4 },
            { value: 'debris_cluster', weight: 2.4 },
            { value: 'crystal', weight: 1.4 },
          ];

  const deepWeights: Array<{ value: SectorMapPropKind; weight: number }> = [
    { value: 'asteroid', weight: 3.5 },
    { value: 'derelict_hulk', weight: 2.2 },
    { value: 'ruin_ring', weight: 1.8 },
    { value: 'crystal', weight: 1.5 },
  ];

  const centerX = 400;
  const centerY = 300;
  const props: SectorMapProp[] = [];
  let nextPropId = 1;

  const pickHex = () => biome.propColors[Math.floor(rng() * biome.propColors.length)];
  const pickAccent = () => (rng() < 0.55 ? atmosphere.particleHex : biome.palette.gridHex);
  const pickVariant = () => (Math.floor(rng() * 3) % 3) as 0 | 1 | 2;

  // Big set-piece landmarks out in the mid-ground, spaced apart so they don't awkwardly cuddle
  const heroCount = 8 + Math.floor(rng() * 3);
  const heroPlaced: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < heroCount; i++) {
    let bestX = centerX;
    let bestY = centerY;
    for (let attempt = 0; attempt < 16; attempt++) {
      const sectorAng = (i / heroCount) * Math.PI * 2 + (rng() - 0.5) * ((Math.PI * 1.4) / heroCount);
      const dist = 340 + rng() * 1420;
      const cx = centerX + Math.cos(sectorAng) * dist;
      const cy = centerY + Math.sin(sectorAng) * dist;
      bestX = cx;
      bestY = cy;
      if (isSeparatedFrom(cx, cy, heroPlaced, 320)) break;
    }
    heroPlaced.push({ x: bestX, y: bestY });
    const kind = pickWeighted(rng, heroWeights);
    const scaleBase =
      kind === 'ruin_ring'
        ? 1.95
        : kind === 'derelict_hulk'
          ? 1.65
          : kind === 'beacon_spire'
            ? 1.35
            : 1.3;
    props.push({
      id: nextPropId++,
      kind,
      x: bestX,
      y: bestY,
      depthY: -(9.5 + rng() * 7.0),
      scale: scaleBase * (0.82 + rng() * 0.65),
      rotSpeed: (rng() - 0.5) * 0.24,
      seedPhase: rng() * Math.PI * 2,
      hex: pickHex(),
      stratum: 'mid',
      variant: pickVariant(),
      accentHex: pickAccent(),
    });
  }

  // Loose asteroid and junk ribbons along two sweeping orbital arcs
  const beltCount = 28 + Math.floor(rng() * 7);
  const beltBandA = 560 + rng() * 260;
  const beltBandB = 1180 + rng() * 420;
  const beltPhaseOffset = rng() * Math.PI * 2;
  const beltPlaced: Array<{ x: number; y: number }> = [...heroPlaced];

  for (let i = 0; i < beltCount; i++) {
    const bandRadius = i % 2 === 0 ? beltBandA : beltBandB;
    let px = centerX;
    let py = centerY;
    for (let attempt = 0; attempt < 12; attempt++) {
      const t = (i / beltCount) * Math.PI * 2 + beltPhaseOffset + (rng() - 0.5) * 0.42;
      const curveWobble = Math.sin(t * 2.0 + beltPhaseOffset) * 145;
      const perpScatter = (rng() - 0.5) * 260;
      const r = Math.max(275, bandRadius + curveWobble + perpScatter);
      const cx = centerX + Math.cos(t) * r;
      const cy = centerY + Math.sin(t) * r;
      px = cx;
      py = cy;
      if (isSeparatedFrom(cx, cy, beltPlaced, 115)) break;
    }
    beltPlaced.push({ x: px, y: py });
    const isNear = rng() < 0.45;
    const kind = pickWeighted(rng, beltWeights);
    const scaleBase = kind === 'debris_cluster' ? 1.15 : kind === 'crystal' ? 0.92 : 0.88;
    props.push({
      id: nextPropId++,
      kind,
      x: px,
      y: py,
      depthY: isNear ? -(3.8 + rng() * 5.0) : -(9.2 + rng() * 5.6),
      scale: scaleBase * (0.68 + rng() * 0.85) * (isNear ? 0.92 : 1.12),
      rotSpeed: (rng() - 0.5) * 0.52,
      seedPhase: rng() * Math.PI * 2,
      hex: pickHex(),
      stratum: isNear ? 'near' : 'mid',
      variant: pickVariant(),
      accentHex: pickAccent(),
    });
  }

  // Far-away silhouettes way under the battle plane for parallax depth
  const deepCount = 22 + Math.floor(rng() * 3);
  for (let i = 0; i < deepCount; i++) {
    const ang = (i / deepCount) * Math.PI * 2 + (rng() - 0.5) * 0.35;
    const dist = 450 + rng() * 1950;
    const kind = pickWeighted(rng, deepWeights);
    props.push({
      id: nextPropId++,
      kind,
      x: centerX + Math.cos(ang) * dist,
      y: centerY + Math.sin(ang) * dist,
      depthY: -(17.5 + rng() * 11.5),
      scale: 1.6 + rng() * 1.6,
      rotSpeed: (rng() - 0.5) * 0.14,
      seedPhase: rng() * Math.PI * 2,
      hex: pickHex(),
      stratum: 'deep',
      variant: pickVariant(),
      accentHex: pickAccent(),
    });
  }

  return {
    seed,
    hazardId,
    biomeId: biome.id,
    nameVi: biome.nameVi,
    nameEn: biome.nameEn,
    palette: biome.palette,
    atmosphere,
    planetAOffset,
    planetBOffset,
    props,
  };
}
