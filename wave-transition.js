let waveTransition = { active: false, frame: 0, maxFrames: 90, wave: 0 };

function showWaveTransition(waveNum) {
    waveTransition = { active: true, frame: 0, maxFrames: 90, wave: waveNum };
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
    const isBoss = waveTransition.wave > 0 && waveTransition.wave % 5 === 0;
    const maxF = waveTransition.maxFrames;
    const cx = W / 2;
    const cy = H / 2;

    let barSlide = 0;
    if (f < 10) barSlide = f / 10;
    else if (f > maxF - 10) barSlide = (maxF - f) / 10;
    else barSlide = 1;

    const easeSlide = 1 - Math.pow(1 - barSlide, 3);
    const barH = 100 * easeSlide;

    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, W, barH);
    ctx.fillRect(0, H - barH, W, barH);

    ctx.fillStyle = `rgba(0,0,0,${easeSlide * 0.65})`;
    ctx.fillRect(0, 0, W, H);

    if (isBoss && f > 10 && f < maxF - 10) {
        ctx.fillStyle = `rgba(255, 0, 0, ${0.1 + Math.sin(f * 0.5) * 0.1})`;
        ctx.fillRect(0, barH, W, H - barH * 2);
    }

    const impactFrame = 17;

    let textScale = 1;
    let textAlpha = 1;
    let xWAVE = cx - 70;
    let xNum = cx + 90;

    if (isBoss) {
        xWAVE = cx;
        xNum = cx;
    }

    if (f < impactFrame) {
        const flyIn = Math.max(0, (f - 5) / 12);
        const easeFly = flyIn * flyIn * flyIn;

        if (!isBoss) {
            xWAVE = cx - 70 - W * (1 - easeFly);
            xNum = cx + 90 + W * (1 - easeFly);
        } else {
            textScale = 1 + 5 * (1 - easeFly);
            textAlpha = easeFly;
        }
    } else if (f >= impactFrame && f <= maxF - 10) {
        const afterImpact = f - impactFrame;

        textScale = 1.2 - (afterImpact / (maxF - 10 - impactFrame)) * 0.2;

        if (afterImpact < 10) {
            ctx.save();
            ctx.strokeStyle = isBoss ? '#ff0000' : '#00aaff';
            ctx.lineWidth = 15 * (1 - afterImpact / 10);
            ctx.beginPath();
            ctx.arc(cx, cy, 60 + afterImpact * 40, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = isBoss ? `rgba(255,0,0,${0.6 * (1 - afterImpact / 10)})` : `rgba(255,255,255,${0.8 * (1 - afterImpact / 10)})`;
            ctx.fillRect(0, barH, W, H - barH * 2);
            ctx.restore();

            for (let i = 0; i < 3; i++) {
                const color = isBoss ? '#ff4444' : '#6688ff';
                particles.push(new Particle(cx + (Math.random() - 0.5) * 150, cy + (Math.random() - 0.5) * 50, color, 1.5, 3, 20 + Math.random() * 20));
            }
        }
    } else if (f > maxF - 10) {
        const fadeOut = (maxF - f) / 10;
        textAlpha = fadeOut;
        textScale = 1 + (1 - fadeOut) * 0.5;
    }

    if (f >= 5 && textAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, textAlpha);

        const mainColor = isBoss ? '#ff2222' : '#00e5ff';
        const glowColor = isBoss ? '#ff0000' : '#00aaff';

        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 20 + Math.sin(f * 0.2) * 10;
        ctx.fillStyle = mainColor;
        ctx.textAlign = isBoss ? 'center' : 'right';
        ctx.font = '900 75px "Segoe UI", Arial, sans-serif';

        if (!isBoss) {
            ctx.save();
            ctx.translate(xWAVE, cy - 10);
            ctx.scale(textScale, textScale);
            ctx.fillText('WAVE', 0, 0);
            ctx.restore();

            ctx.save();
            ctx.globalAlpha = textAlpha;
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = 20 + Math.sin(f * 0.2) * 10;
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.font = '900 80px "Segoe UI", Arial, sans-serif';
            ctx.translate(xNum - 140, cy - 10);
            ctx.scale(textScale, textScale);
            ctx.fillText(waveTransition.wave, 0, 0);
            ctx.restore();
        } else {
            ctx.save();
            ctx.translate(cx, cy - 10);
            ctx.scale(textScale, textScale);

            if (Math.random() < 0.3) {
                const shiftX = (Math.random() - 0.5) * 15;
                const shiftY = (Math.random() - 0.5) * 15;
                ctx.fillStyle = '#00ffff';
                ctx.fillText(`BOSS WAVE ${waveTransition.wave}`, shiftX, shiftY);
            }
            ctx.fillStyle = mainColor;
            ctx.fillText(`BOSS WAVE ${waveTransition.wave}`, 0, 0);
            ctx.restore();
        }

        if (f >= impactFrame) {
            const afterImpact = f - impactFrame;
            const subAlpha = Math.min(1, afterImpact / 10) * textAlpha;

            const lang = typeof getLang === 'function' ? getLang() : { getReady: 'Sẵn sàng!', prepareForBattle: 'CẢNH BÁO TỐI ĐA' };
            let subText = isBoss ? lang.prepareForBattle : lang.getReady;
            if (waveTransition.wave === 1) subText = lang.tutorialStart || 'Bắt đầu hướng dẫn';

            ctx.save();
            ctx.globalAlpha = Math.max(0, subAlpha);
            ctx.textAlign = 'center';
            ctx.font = 'bold 24px Arial';
            ctx.fillStyle = isBoss ? '#ffaaaa' : '#ccffff';

            let currentX = cx - (subText.length * 9);
            for (let i = 0; i < subText.length; i++) {
                ctx.fillText(subText.charAt(i).toUpperCase(), currentX, cy + 50);
                currentX += 18;
            }

            const lineExt = Math.min(280, afterImpact * 36);
            ctx.strokeStyle = isBoss ? '#ff5555' : '#55aaff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx - lineExt, cy + 70);
            ctx.lineTo(cx + lineExt, cy + 70);
            ctx.stroke();

            ctx.fillStyle = ctx.strokeStyle;
            ctx.fillRect(cx - lineExt - 4, cy + 68, 4, 4);
            ctx.fillRect(cx + lineExt, cy + 68, 4, 4);

            ctx.restore();
        }
        ctx.restore();
    }
}
