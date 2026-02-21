let waveTransition = { active: false, frame: 0, maxFrames: 150, wave: 0 };

function showWaveTransition(waveNum) {
    waveTransition = { active: true, frame: 0, maxFrames: 150, wave: waveNum };
}

function isTransitionActive() {
    return waveTransition.active;
}

function updateWaveTransition() {
    if (!waveTransition.active) return;
    waveTransition.frame++;
    if (waveTransition.frame >= waveTransition.maxFrames) {
        waveTransition.active = false;
    }
}

function drawWaveTransition() {
    if (!waveTransition.active) return;

    const f = waveTransition.frame;
    const isBoss = waveTransition.wave % 5 === 0;
    const maxF = waveTransition.maxFrames;

    let alpha;
    if (f < 30) alpha = f / 30;
    else if (f >= maxF - 30) alpha = (maxF - f) / 30;
    else alpha = 1;
    alpha = alpha * alpha * (3 - 2 * alpha);

    const barH = 60 * alpha;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, barH);
    ctx.fillRect(0, H - barH, W, barH);

    ctx.fillStyle = `rgba(0,0,0,${alpha * 0.7})`;
    ctx.fillRect(0, 0, W, H);

    if (isBoss && f < 60 && f % 10 < 5) {
        ctx.fillStyle = `rgba(255,0,0,${alpha * 0.15})`;
        ctx.fillRect(0, 0, W, H);
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';

    const mainText = isBoss ? `BOSS WAVE ${waveTransition.wave}` : `WAVE ${waveTransition.wave}`;
    const mainColor = isBoss ? '#ff3333' : '#aabbff';
    const glowColor = isBoss ? '#ff0000' : '#4466ff';

    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 30;
    ctx.font = 'bold 72px Arial';
    ctx.fillStyle = mainColor;
    ctx.fillText(mainText, W / 2, H / 2 - 20);
    ctx.shadowBlur = 0;

    const lang = typeof getLang === 'function' ? getLang() : { getReady: 'Sẵn sàng!', prepareForBattle: 'Chuẩn bị chiến đấu!' };
    const subText = isBoss ? lang.prepareForBattle : lang.getReady;
    ctx.font = 'bold 28px Arial';
    ctx.fillStyle = isBoss ? 'rgba(255,120,120,0.8)' : 'rgba(200,210,255,0.7)';
    ctx.fillText(subText, W / 2, H / 2 + 25);

    const lineW = 200 * alpha;
    ctx.strokeStyle = isBoss ? 'rgba(255,60,60,0.5)' : 'rgba(100,140,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2 - lineW, H / 2 + 40);
    ctx.lineTo(W / 2 + lineW, H / 2 + 40);
    ctx.stroke();

    if (Math.random() < 0.4) {
        const color = isBoss ? '#ff4444' : '#6688ff';
        particles.push(new Particle(Math.random() * W, Math.random() * H, color, 1.5, 3, 25));
    }

    ctx.restore();
}
