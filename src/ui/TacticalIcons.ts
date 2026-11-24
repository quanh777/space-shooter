// Hand-drawn 16x16 SVG icons built via createElementNS so the UI needs zero emoji hacks and zero innerHTML risks.

export type UiIconId =
  | 'star'
  | 'lock'
  | 'unlock'
  | 'warn'
  | 'check'
  | 'arrowRight'
  | 'arrowLeft'
  | 'arrowUp'
  | 'arrowDown'
  | 'chevronRight'
  | 'play'
  | 'diamond'
  | 'plus'
  | 'heart'
  | 'spark'
  | 'bolt'
  | 'hex'
  | 'twin'
  | 'spread'
  | 'pierce'
  | 'nova'
  | 'target'
  | 'coin'
  | 'snow'
  | 'shield';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string>
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  return el;
}

// Spits out a clean 16x16 SVG icon inheriting text color.
export function createUiIcon(id: UiIconId, className = 'ui-svg-icon'): SVGSVGElement {
  const svg = svgEl('svg', {
    viewBox: '0 0 16 16',
    fill: 'none',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  });
  svg.setAttribute('class', className);

  switch (id) {
    case 'star':
      svg.appendChild(
        svgEl('polygon', {
          points: '8,1.5 9.95,5.5 14.35,6.1 11.15,9.2 11.9,13.6 8,11.5 4.1,13.6 4.85,9.2 1.65,6.1 6.05,5.5',
          fill: 'currentColor',
          stroke: 'currentColor',
          'stroke-width': '0.9',
        })
      );
      break;

    case 'lock':
      svg.append(
        svgEl('rect', { x: '3', y: '7', width: '10', height: '7', rx: '1.5', stroke: 'currentColor', 'stroke-width': '1.6' }),
        svgEl('path', { d: 'M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2', stroke: 'currentColor', 'stroke-width': '1.6' }),
        svgEl('circle', { cx: '8', cy: '10.5', r: '1', fill: 'currentColor' })
      );
      break;

    case 'unlock':
      svg.append(
        svgEl('rect', { x: '3', y: '7', width: '10', height: '7', rx: '1.5', stroke: 'currentColor', 'stroke-width': '1.6' }),
        svgEl('path', { d: 'M5.2 7V5a2.8 2.8 0 0 1 5.3-1.2', stroke: 'currentColor', 'stroke-width': '1.6' }),
        svgEl('circle', { cx: '8', cy: '10.5', r: '1', fill: 'currentColor' })
      );
      break;

    case 'warn':
      svg.append(
        svgEl('polygon', { points: '8,2 14.5,13.5 1.5,13.5', stroke: 'currentColor', 'stroke-width': '1.6' }),
        svgEl('line', { x1: '8', y1: '6', x2: '8', y2: '9.6', stroke: 'currentColor', 'stroke-width': '1.7' }),
        svgEl('circle', { cx: '8', cy: '11.6', r: '0.8', fill: 'currentColor' })
      );
      break;

    case 'check':
      svg.appendChild(
        svgEl('polyline', { points: '3,8.5 6.5,12 13,4.5', stroke: 'currentColor', 'stroke-width': '1.9' })
      );
      break;

    case 'arrowRight':
      svg.appendChild(
        svgEl('path', { d: 'M2.5 8h10.5M9 4l4 4-4 4', stroke: 'currentColor', 'stroke-width': '1.7' })
      );
      break;

    case 'arrowLeft':
      svg.appendChild(
        svgEl('path', { d: 'M13.5 8H3M7 4L3 8l4 4', stroke: 'currentColor', 'stroke-width': '1.7' })
      );
      break;

    case 'arrowUp':
      svg.appendChild(
        svgEl('path', { d: 'M8 13.5V3M4 7l4-4 4 4', stroke: 'currentColor', 'stroke-width': '1.7' })
      );
      break;

    case 'arrowDown':
      svg.appendChild(
        svgEl('path', { d: 'M8 2.5V13M4 9l4 4 4-4', stroke: 'currentColor', 'stroke-width': '1.7' })
      );
      break;

    case 'chevronRight':
      svg.appendChild(
        svgEl('polygon', {
          points: '3,2.5 13.5,8 3,13.5 5.8,8',
          fill: 'currentColor',
          stroke: 'currentColor',
          'stroke-width': '0.9',
        })
      );
      break;

    case 'play':
      svg.appendChild(
        svgEl('polygon', { points: '4,2.8 13,8 4,13.2', fill: 'currentColor' })
      );
      break;

    case 'diamond':
      svg.append(
        svgEl('polygon', { points: '8,1.8 14.2,8 8,14.2 1.8,8', stroke: 'currentColor', 'stroke-width': '1.5' }),
        svgEl('polygon', { points: '8,5.2 10.8,8 8,10.8 5.2,8', fill: 'currentColor' })
      );
      break;

    case 'plus':
      svg.appendChild(
        svgEl('path', { d: 'M8 3v10M3 8h10', stroke: 'currentColor', 'stroke-width': '1.8' })
      );
      break;

    case 'heart':
      svg.appendChild(
        svgEl('path', {
          d: 'M8 13.5S2.4 9.7 2.4 5.8A3 3 0 0 1 8 4.1a3 3 0 0 1 5.6 1.7c0 3.9-5.6 7.7-5.6 7.7z',
          stroke: 'currentColor',
          'stroke-width': '1.5',
        })
      );
      break;

    case 'spark':
      svg.appendChild(
        svgEl('polygon', {
          points: '8,1.5 9.6,6.4 14.5,8 9.6,9.6 8,14.5 6.4,9.6 1.5,8 6.4,6.4',
          stroke: 'currentColor',
          'stroke-width': '1.3',
        })
      );
      break;

    case 'bolt':
      svg.appendChild(
        svgEl('polygon', {
          points: '9.2,1.5 3.6,8.8 7.8,8.8 6.8,14.5 12.4,7.2 8.2,7.2',
          fill: 'currentColor',
        })
      );
      break;

    case 'hex':
      svg.appendChild(
        svgEl('polygon', {
          points: '8,1.8 13.4,4.9 13.4,11.1 8,14.2 2.6,11.1 2.6,4.9',
          stroke: 'currentColor',
          'stroke-width': '1.5',
        })
      );
      break;

    case 'twin':
      svg.appendChild(
        svgEl('path', { d: 'M5.5 2.5v11M10.5 2.5v11', stroke: 'currentColor', 'stroke-width': '1.8' })
      );
      break;

    case 'spread':
      svg.appendChild(
        svgEl('path', {
          d: 'M8 13V3.5M8 13L3.2 4.8M8 13l4.8-8.2',
          stroke: 'currentColor',
          'stroke-width': '1.6',
        })
      );
      break;

    case 'pierce':
      svg.appendChild(
        svgEl('path', {
          d: 'M2 8h11.5M9.5 4.2L13.8 8l-4.3 3.8M5.5 5v6',
          stroke: 'currentColor',
          'stroke-width': '1.5',
        })
      );
      break;

    case 'nova':
      svg.append(
        svgEl('circle', { cx: '8', cy: '8', r: '2.4', fill: 'currentColor' }),
        svgEl('path', {
          d: 'M8 1.5v2.2M8 12.3v2.2M1.5 8h2.2M12.3 8h2.2M3.4 3.4l1.6 1.6M11 11l1.6 1.6M12.6 3.4L11 5M5 11l-1.6 1.6',
          stroke: 'currentColor',
          'stroke-width': '1.4',
        })
      );
      break;

    case 'target':
      svg.append(
        svgEl('circle', { cx: '8', cy: '8', r: '5.6', stroke: 'currentColor', 'stroke-width': '1.5' }),
        svgEl('circle', { cx: '8', cy: '8', r: '1.8', fill: 'currentColor' })
      );
      break;

    case 'coin':
      svg.append(
        svgEl('circle', { cx: '8', cy: '8', r: '5.8', stroke: 'currentColor', 'stroke-width': '1.5' }),
        svgEl('path', { d: 'M8 4.4v7.2M9.6 6H7.1a1.2 1.2 0 0 0 0 2.4h1.8a1.2 1.2 0 0 1 0 2.4H6.4', stroke: 'currentColor', 'stroke-width': '1.3' })
      );
      break;

    case 'snow':
      svg.appendChild(
        svgEl('path', {
          d: 'M8 2v12M2.8 5l10.4 6M13.2 5L2.8 11',
          stroke: 'currentColor',
          'stroke-width': '1.5',
        })
      );
      break;

    case 'shield':
      svg.appendChild(
        svgEl('path', {
          d: 'M8 1.8L13 4v4.2c0 3-2.1 5.1-5 6-2.9-.9-5-3-5-6V4l5-2.2z',
          stroke: 'currentColor',
          'stroke-width': '1.5',
        })
      );
      break;
  }

  return svg;
}

// Renders 1-3 tier stars without using Unicode star glyphs that look crooked on Windows fonts.
export function createTierStarsEl(tier: number, className = '', suffix = ''): HTMLSpanElement {
  const clamped = Math.max(0, Math.min(3, Math.round(tier)));
  const wrap = document.createElement('span');
  wrap.className = className ? `tier-stars-wrap ${className}` : 'tier-stars-wrap';
  for (let i = 0; i < clamped; i++) {
    wrap.appendChild(createUiIcon('star', 'ui-svg-icon ui-star-icon'));
  }
  if (suffix) {
    wrap.appendChild(document.createTextNode(suffix));
  }
  return wrap;
}

// Safe icon + label setter (replaces textContent cleanly without touching innerHTML).
export function setIconText(
  el: HTMLElement,
  icon: UiIconId,
  text: string,
  iconAfter = false,
  iconClass = 'ui-svg-icon'
): void {
  el.textContent = '';
  el.classList.add('ui-inline-flex');
  const svg = createUiIcon(icon, iconClass);
  const txt = document.createTextNode(text);
  if (iconAfter) {
    el.append(txt, svg);
  } else {
    el.append(svg, txt);
  }
}
