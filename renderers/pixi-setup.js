// ============================================================
// PIXI.JS SETUP - WebGL Renderer Infrastructure
// This file MUST be loaded BEFORE game.js
// ============================================================

// Offscreen Canvas2D buffer — existing game code draws here
const _offscreenCanvas = document.createElement('canvas');
_offscreenCanvas.width = 800;
_offscreenCanvas.height = 600;
const _offscreenCtx = _offscreenCanvas.getContext('2d');

// Bloom buffer — used for Canvas2D glow post-processing
const _bloomCanvas = document.createElement('canvas');
_bloomCanvas.width = 400;
_bloomCanvas.height = 300;
const _bloomCtx = _bloomCanvas.getContext('2d');

// PixiJS application and references
let pixiApp = null;
let pixiGameSprite = null;
let pixiVfxContainer = null;
let pixiHudContainer = null;
let visibleCanvas = null;

let bloomEnabled = true;

function initPixiRenderer() {
    const originalCanvas = document.getElementById('gameCanvas');

    pixiApp = new PIXI.Application({
        width: 800,
        height: 600,
        backgroundColor: 0x020210,
        resolution: 1,
        antialias: true,
        powerPreference: 'high-performance',
    });

    const pixiCanvas = pixiApp.view;
    pixiCanvas.id = 'gameCanvas';
    if (originalCanvas.className) pixiCanvas.className = originalCanvas.className;

    originalCanvas.parentNode.replaceChild(pixiCanvas, originalCanvas);
    visibleCanvas = pixiCanvas;

    // Layer 1: Game content (Canvas2D rendered as texture)
    const baseTexture = PIXI.BaseTexture.from(_offscreenCanvas, {
        scaleMode: PIXI.SCALE_MODES.LINEAR,
    });
    const gameTexture = new PIXI.Texture(baseTexture);
    pixiGameSprite = new PIXI.Sprite(gameTexture);
    pixiApp.stage.addChild(pixiGameSprite);

    // Layer 2: VFX container
    pixiVfxContainer = new PIXI.Container();
    pixiApp.stage.addChild(pixiVfxContainer);

    // Layer 3: HUD container
    pixiHudContainer = new PIXI.Container();
    pixiApp.stage.addChild(pixiHudContainer);

    console.log('[PixiJS] Renderer initialized — WebGL active');
}

// Canvas2D bloom post-processing: extract bright areas, blur, blend additively
function applyCanvasBloom() {
    if (!bloomEnabled) return;

    // Draw game at half resolution to bloom buffer
    _bloomCtx.clearRect(0, 0, 400, 300);
    _bloomCtx.drawImage(_offscreenCanvas, 0, 0, 400, 300);

    // Extract bright areas by increasing contrast
    _bloomCtx.globalCompositeOperation = 'multiply';
    _bloomCtx.fillStyle = 'rgb(180,180,180)';
    _bloomCtx.fillRect(0, 0, 400, 300);
    _bloomCtx.globalCompositeOperation = 'source-over';

    // Apply blur
    _bloomCtx.filter = 'blur(6px)';
    _bloomCtx.drawImage(_bloomCanvas, 0, 0);
    _bloomCtx.filter = 'blur(4px)';
    _bloomCtx.drawImage(_bloomCanvas, 0, 0);
    _bloomCtx.filter = 'none';

    // Blend bloom back onto game canvas additively
    _offscreenCtx.save();
    _offscreenCtx.globalCompositeOperation = 'lighter';
    _offscreenCtx.globalAlpha = 0.25;
    _offscreenCtx.drawImage(_bloomCanvas, 0, 0, 800, 600);
    _offscreenCtx.globalAlpha = 1;
    _offscreenCtx.globalCompositeOperation = 'source-over';
    _offscreenCtx.restore();
}

// Call this at the END of each game frame to update the PixiJS display
function updatePixiFrame() {
    applyCanvasBloom();
    if (pixiGameSprite && pixiGameSprite.texture) {
        pixiGameSprite.texture.baseTexture.update();
    }
}
