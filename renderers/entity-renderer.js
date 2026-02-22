

function drawParticle(p, ctx) {
    if (p.lt <= 0 || p.sz <= 0.2) return;
    const alpha = Math.min(1, p.lt / p.maxLt);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = p.c;
    ctx.shadowBlur = p.sz * 3;
    ctx.fillStyle = p.c;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.sz * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

function drawBullet(b, ctx) {
    ctx.save();

    b.trail.forEach((p, i) => {
        if (b.trail.length > 1) {
            const t = i / b.trail.length;
            const s = b.r * t * 0.8;
            if (s > 0.3) {
                ctx.globalAlpha = t * 0.6;
                ctx.shadowColor = b.c;
                ctx.shadowBlur = s * 2;
                ctx.fillStyle = b.c;
                ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.fill();
            }
        }
    });
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    ctx.globalAlpha = 0.25;
    ctx.shadowColor = b.c;
    ctx.shadowBlur = 15;
    ctx.fillStyle = b.c;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.globalAlpha = 1;
    if (!b.isEnemy) {
        const angle = Math.atan2(b.dy, b.dx);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(angle);
        ctx.fillStyle = '#88bbff';
        ctx.shadowColor = '#4488ff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(b.r * 1.5, 0);
        ctx.lineTo(0, -b.r * 0.6);
        ctx.lineTo(-b.r, 0);
        ctx.lineTo(0, b.r * 0.6);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ddeeff';
        ctx.beginPath();
        ctx.moveTo(b.r * 0.8, 0);
        ctx.lineTo(0, -b.r * 0.25);
        ctx.lineTo(-b.r * 0.3, 0);
        ctx.lineTo(0, b.r * 0.25);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    } else {
        ctx.shadowColor = b.c;
        ctx.shadowBlur = 8;
        ctx.fillStyle = b.c;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.6, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.35, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
}

function drawEnemy(e, ctx) {
    ctx.save();
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    const t = Date.now();
    const dx = playerX - cx, dy = playerY - cy;
    const faceAngle = Math.atan2(dy, dx);

    let usesOriginal = false;

    ctx.save();
    if (e.isMinion) {
        drawMinion(e, ctx, cx, cy, t, faceAngle);
    } else if (e.type === 'small') {
        drawSmallEnemy(e, ctx, cx, cy, t, faceAngle);
    } else if (e.type === 'medium') {
        usesOriginal = true;
        drawMediumEnemy(e, ctx, cx, cy, t, faceAngle);
    } else if (e.type === 'large') {
        usesOriginal = true;
        drawLargeEnemy(e, ctx, cx, cy, t, faceAngle);
    } else if (e.type === 'elite') {
        usesOriginal = true;
        drawEliteEnemy(e, ctx, cx, cy, t, faceAngle);
    }
    ctx.restore();

    if (!usesOriginal) {

        if (e.flash > 0) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = `rgba(255,255,255,${e.flash * 0.4})`;
            ctx.beginPath(); ctx.arc(cx, cy, e.w / 2 + 3, 0, Math.PI * 2); ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
        }

        if (e.hp < e.maxHp) {
            const barW = e.w + 4;
            const barH = 3;
            const barX = cx - barW / 2;
            const barY = e.y - 6;
            const ratio = Math.max(0, e.hp / e.maxHp);
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(barX, barY, barW, barH);
            ctx.fillStyle = ratio > 0.5 ? '#44ff44' : (ratio > 0.25 ? '#ffaa00' : '#ff3333');
            ctx.fillRect(barX, barY, barW * ratio, barH);
        }
    }

    ctx.restore();
}

function drawMinion(e, ctx, cx, cy, t, faceAngle) {
    const r = e.w / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(e.anim * 0.35);

    ctx.globalAlpha = 0.12;
    ctx.fillStyle = e.canDrop ? '#ffee55' : '#aa55ff';
    ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const bx2 = Math.cos(a) * r, by2 = Math.sin(a) * r;
        ctx.strokeStyle = e.canDrop
            ? `rgba(255,200,0,${0.6 + Math.sin(e.anim * 0.4 + i) * 0.3})`
            : `rgba(200,100,255,${0.6 + Math.sin(e.anim * 0.4 + i) * 0.3})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 2, Math.sin(a) * 2); ctx.lineTo(bx2, by2); ctx.stroke();
        ctx.fillStyle = e.canDrop ? '#ffdd55' : '#dd88ff';
        ctx.beginPath(); ctx.arc(bx2, by2, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    const mGrad = e.canDrop
        ? ctx.createLinearGradient(-r * 0.5, 0, r * 0.5, 0)
        : ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.5);

    if (e.canDrop) {
        const cycle = ((Date.now() + cx) % 1500) / 1500;
        mGrad.addColorStop(0, '#ffcc00');
        if (cycle > 0.1 && cycle < 0.9) {
            mGrad.addColorStop(Math.max(0, cycle - 0.1), '#ffaa00');
            mGrad.addColorStop(cycle, '#ffffff'); 
            mGrad.addColorStop(Math.min(1, cycle + 0.1), '#aa6600');
        } else {
            mGrad.addColorStop(0.5, '#ffaa00');
        }
        mGrad.addColorStop(1, '#aa6600');
    } else {
        mGrad.addColorStop(0, '#ffccff');
        mGrad.addColorStop(0.5, '#aa44dd');
        mGrad.addColorStop(1, '#550088');
    }
    ctx.fillStyle = mGrad;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = e.canDrop ? 'rgba(255,200,50,0.6)' : 'rgba(200,120,255,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(faceAngle);
    if (e.canDrop) {
        ctx.fillStyle = '#ffaa00'; ctx.shadowColor = '#ffff00'; ctx.shadowBlur = 8;
    } else {
        ctx.fillStyle = '#ff44ff'; ctx.shadowColor = '#ff00ff'; ctx.shadowBlur = 8;
    }
    ctx.beginPath(); ctx.arc(r * 0.25, -4, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.25, 4, 2, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.strokeStyle = e.canDrop
        ? `rgba(255,200,50,${0.4 + Math.sin(e.anim * 0.5) * 0.2})`
        : `rgba(200,100,255,${0.4 + Math.sin(e.anim * 0.5) * 0.2})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, r + 2, 0, Math.PI * 2); ctx.stroke();
}

function drawSmallEnemy(e, ctx, cx, cy, t, faceAngle) {
    const hw = e.w / 2, hh = e.h / 2;
    const banking = e.zigzagDir * Math.PI / 8;
    ctx.translate(cx, cy); ctx.rotate(faceAngle + Math.PI / 2 + banking); ctx.translate(-cx, -cy);
    const flap = Math.sin(e.anim * 1.5) * hh * 0.3;

    ctx.globalAlpha = 0.08;
    ctx.fillStyle = e.canDrop ? '#ffee55' : '#ff3322';
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh * 0.7);
    ctx.lineTo(cx - hw * 0.5, cy + hh * 1.5);
    ctx.lineTo(cx + hw * 0.5, cy + hh * 1.5);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;

    const abdGrad = e.canDrop
        ? ctx.createLinearGradient(cx - hw * 0.3, cy + hh * 0.15, cx + hw * 0.3, cy + hh * 0.15)
        : ctx.createRadialGradient(cx, cy + hh * 0.15, 0, cx, cy + hh * 0.15, hh * 0.35);

    if (e.canDrop) {
        const cycle = ((Date.now() + cx) % 1500) / 1500;
        abdGrad.addColorStop(0, '#ffcc00');
        if (cycle > 0.1 && cycle < 0.9) {
            abdGrad.addColorStop(Math.max(0, cycle - 0.1), '#ffaa00');
            abdGrad.addColorStop(cycle, '#ffffff');
            abdGrad.addColorStop(Math.min(1, cycle + 0.1), '#aa6600');
        } else {
            abdGrad.addColorStop(0.5, '#ffaa00');
        }
        abdGrad.addColorStop(1, '#aa6600');
    } else {
        abdGrad.addColorStop(0, '#ff6655');
        abdGrad.addColorStop(1, '#881100');
    }
    ctx.fillStyle = abdGrad;
    ctx.beginPath(); ctx.ellipse(cx, cy + hh * 0.15, hw * 0.3, hh * 0.3, 0, 0, Math.PI * 2); ctx.fill();

    const thxGrad = e.canDrop
        ? ctx.createLinearGradient(cx - hw * 0.25, cy - hh * 0.1, cx + hw * 0.25, cy - hh * 0.1)
        : ctx.createRadialGradient(cx, cy - hh * 0.1, 0, cx, cy - hh * 0.1, hw * 0.25);

    if (e.canDrop) {
        const cycle = ((Date.now() + cx) % 1500) / 1500;
        thxGrad.addColorStop(0, '#ffee00');
        if (cycle > 0.1 && cycle < 0.9) {
            thxGrad.addColorStop(Math.max(0, cycle - 0.1), '#ffcc00');
            thxGrad.addColorStop(cycle, '#ffffff');
            thxGrad.addColorStop(Math.min(1, cycle + 0.1), '#cc8800');
        } else {
            thxGrad.addColorStop(0.5, '#ffcc00');
        }
        thxGrad.addColorStop(1, '#cc8800');
    } else {
        thxGrad.addColorStop(0, '#ff8877');
        thxGrad.addColorStop(1, '#992200');
    }
    ctx.fillStyle = thxGrad;
    ctx.beginPath(); ctx.ellipse(cx, cy - hh * 0.1, hw * 0.25, hh * 0.2, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = e.canDrop ? '#ccaa00' : '#cc3322';
    ctx.beginPath(); ctx.ellipse(cx, cy - hh * 0.4, hw * 0.2, hh * 0.15, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = 'rgba(255,100,80,0.18)';
    ctx.strokeStyle = 'rgba(255,120,100,0.3)'; ctx.lineWidth = 0.5;
    for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + s * hw * 0.15, cy - hh * 0.2);
        ctx.quadraticCurveTo(cx + s * hw * 0.9, cy - hh * 0.4 + flap, cx + s * hw * 0.7, cy + hh * 0.1 + flap);
        ctx.lineTo(cx + s * hw * 0.15, cy); ctx.closePath();
        ctx.fill(); ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx + s * hw * 0.12, cy + hh * 0.05);
        ctx.quadraticCurveTo(cx + s * hw * 0.6, cy + flap * 0.5, cx + s * hw * 0.45, cy + hh * 0.25 + flap * 0.5);
        ctx.lineTo(cx + s * hw * 0.12, cy + hh * 0.2); ctx.closePath();
        ctx.fill(); ctx.stroke();
    }

    ctx.strokeStyle = '#dd4433'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx - hw * 0.08, cy - hh * 0.5);
    ctx.quadraticCurveTo(cx - hw * 0.15, cy - hh * 0.7, cx - hw * 0.05, cy - hh * 0.72); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + hw * 0.08, cy - hh * 0.5);
    ctx.quadraticCurveTo(cx + hw * 0.15, cy - hh * 0.7, cx + hw * 0.05, cy - hh * 0.72); ctx.stroke();

    ctx.fillStyle = '#ffaa88'; ctx.shadowColor = '#ff4422'; ctx.shadowBlur = 3;
    ctx.beginPath(); ctx.arc(cx - hw * 0.1, cy - hh * 0.42, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + hw * 0.1, cy - hh * 0.42, 2, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
}

function drawMediumEnemy(e, ctx, cx, cy, t, faceAngle) {
    e._drawOriginal(ctx, cx, cy, t, faceAngle);
}
function drawLargeEnemy(e, ctx, cx, cy, t, faceAngle) {
    e._drawOriginal(ctx, cx, cy, t, faceAngle);
}
function drawEliteEnemy(e, ctx, cx, cy, t, faceAngle) {
    e._drawOriginal(ctx, cx, cy, t, faceAngle);
}
