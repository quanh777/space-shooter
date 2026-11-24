// Lightweight 2D space-billiards solver: circle separation, restitution bounce, friction, and black-hole swirl (without dragging in a full physics engine).

export interface ContactBody2D {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  invMass: number;
}

export interface ContactImpulse2DResult {
  collided: boolean;
  impactSpeed: number;
  nx: number;
  ny: number;
}

export function resolveCircleContactImpulse(
  a: ContactBody2D,
  b: ContactBody2D,
  restitution = 0.55,
  friction = 0.25
): ContactImpulse2DResult {
  const totalInvMass = a.invMass + b.invMass;
  if (totalInvMass <= 1e-6) {
    return { collided: false, impactSpeed: 0, nx: 1, ny: 0 };
  }

  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let dist = Math.hypot(dx, dy);
  const minDist = a.radius + b.radius;

  if (dist >= minDist) {
    return { collided: false, impactSpeed: 0, nx: 1, ny: 0 };
  }

  if (dist < 1e-4) {
    dx = 1;
    dy = 0;
    dist = 1;
  }

  const nx = dx / dist;
  const ny = dy / dist;
  const pen = minDist - dist;

  // Split positional un-overlap by inverse mass so tiny scouts bounce off heavy cruisers, not the other way around
  if (a.invMass > 0) {
    a.x -= nx * pen * (a.invMass / totalInvMass);
    a.y -= ny * pen * (a.invMass / totalInvMass);
  }
  if (b.invMass > 0) {
    b.x += nx * pen * (b.invMass / totalInvMass);
    b.y += ny * pen * (b.invMass / totalInvMass);
  }

  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const velAlongNormal = rvx * nx + rvy * ny;
  const impactSpeed = Math.max(0, -velAlongNormal);

  if (velAlongNormal < 0) {
    const jn = (-(1 + restitution) * velAlongNormal) / totalInvMass;
    const impX = jn * nx;
    const impY = jn * ny;
    if (a.invMass > 0) {
      a.vx -= impX * a.invMass;
      a.vy -= impY * a.invMass;
    }
    if (b.invMass > 0) {
      b.vx += impX * b.invMass;
      b.vy += impY * b.invMass;
    }

    // Tangential scuff friction so ships scrape past instead of velcroing together
    const tx = -ny;
    const ty = nx;
    const vt = rvx * tx + rvy * ty;
    const maxFriction = friction * Math.abs(jn);
    const jt = Math.max(-maxFriction, Math.min(maxFriction, -vt / totalInvMass));
    if (a.invMass > 0) {
      a.vx -= jt * tx * a.invMass;
      a.vy -= jt * ty * a.invMass;
    }
    if (b.invMass > 0) {
      b.vx += jt * tx * b.invMass;
      b.vy += jt * ty * b.invMass;
    }
  }

  return { collided: true, impactSpeed, nx, ny };
}

export function applySingularityPull(
  target: { x: number; y: number; vx: number; vy: number },
  cx: number,
  cy: number,
  radius: number,
  pullStrength: number,
  dtSec: number,
  swirlFactor = 0.24
): boolean {
  const dx = cx - target.x;
  const dy = cy - target.y;
  const dist = Math.hypot(dx, dy);
  if (dist > radius || dist < 1e-3) return false;

  const nx = dx / dist;
  const ny = dy / dist;
  const falloff = Math.max(0.2, 1 - dist / Math.max(1, radius));
  const step = Math.min(14, pullStrength * falloff * dtSec);

  // Drag toward the center plus a bit of toilet-bowl orbital spin
  const tx = -ny;
  const ty = nx;
  const deltaX = (nx + tx * swirlFactor) * step;
  const deltaY = (ny + ty * swirlFactor) * step;

  target.x += deltaX;
  target.y += deltaY;
  target.vx = target.vx * 0.88 + deltaX * 0.35;
  target.vy = target.vy * 0.88 + deltaY * 0.35;
  return true;
}

export function applyRamImpulse(
  attackerX: number,
  attackerY: number,
  attackerVx: number,
  attackerVy: number,
  target: { x: number; y: number; vx: number; vy: number; radius: number },
  forceScale = 12
): void {
  let dx = target.x - attackerX;
  let dy = target.y - attackerY;
  const dist = Math.hypot(dx, dy);
  if (dist > 0.01) {
    dx /= dist;
    dy /= dist;
  } else {
    const spd = Math.hypot(attackerVx, attackerVy) || 1;
    dx = attackerVx / spd;
    dy = attackerVy / spd;
  }

  target.vx += dx * forceScale + attackerVx * 0.45;
  target.vy += dy * forceScale + attackerVy * 0.45;
  target.x += dx * Math.min(18, forceScale * 1.1);
  target.y += dy * Math.min(18, forceScale * 1.1);
}
