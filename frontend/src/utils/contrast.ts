/**
 * Utility to compute WCAG AA contrast ratios and check accessibility of color combinations.
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Parses HSL color string components (e.g. "220 90% 56%") into numeric values.
 */
export function parseHslString(hslStr: string): { h: number; s: number; l: number } {
  const parts = hslStr.trim().split(/\s+/);
  if (parts.length === 3) {
    const h = parseFloat(parts[0]);
    const s = parseFloat(parts[1].replace('%', ''));
    const l = parseFloat(parts[2].replace('%', ''));
    return { h, s, l };
  }
  // Fallback default
  return { h: 0, s: 0, l: 0 };
}

/**
 * Converts HSL values to RGB (components in 0-255).
 */
export function hslToRgb(h: number, s: number, l: number): RGB {
  h = h / 360;
  s = s / 100;
  l = l / 100;

  let r = l;
  let g = l;
  let b = l;

  if (s !== 0) {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Computes relative luminance from RGB components.
 * Formula: https://www.w3.org/TR/WCAG20-TECHS/G18.html
 */
export function getLuminance(rgb: RGB): number {
  const a = [rgb.r, rgb.g, rgb.b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/**
 * Calculates the contrast ratio between two HSL color strings.
 */
export function getContrastRatio(hslColor1: string, hslColor2: string): number {
  const c1 = parseHslString(hslColor1);
  const c2 = parseHslString(hslColor2);

  const rgb1 = hslToRgb(c1.h, c1.s, c1.l);
  const rgb2 = hslToRgb(c2.h, c2.s, c2.l);

  const l1 = getLuminance(rgb1);
  const l2 = getLuminance(rgb2);

  const brighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (brighter + 0.05) / (darker + 0.05);
}

/**
 * Checks if contrast meets WCAG AA criteria (4.5 for normal text, 3.0 for large text).
 */
export function checkContrastAA(hslColor1: string, hslColor2: string, largeText = false): {
  ratio: number;
  pass: boolean;
} {
  const ratio = getContrastRatio(hslColor1, hslColor2);
  const threshold = largeText ? 3.0 : 4.5;
  return {
    ratio,
    pass: ratio >= threshold,
  };
}

/**
 * Given a background color, returns whether white or black text has better contrast.
 * Returns either "0 0% 100%" (white) or "0 0% 0%" (black).
 */
export function getOptimalTextColor(bgHsl: string): string {
  const whiteHsl = "0 0% 100%";
  const blackHsl = "0 0% 0%";

  const whiteContrast = getContrastRatio(bgHsl, whiteHsl);
  const blackContrast = getContrastRatio(bgHsl, blackHsl);

  return whiteContrast >= blackContrast ? whiteHsl : blackHsl;
}

/**
 * Converts a hex color string (e.g., "#3b82f6") into raw HSL space string components ("220 90% 56%").
 */
export function hexToHsl(hex: string): string {
  // Strip # if present
  hex = hex.replace(/^#/, '');
  
  // Handle shorthand e.g. "FFF"
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }

  let r = parseInt(hex.substring(0, 2), 16) / 255;
  let g = parseInt(hex.substring(2, 4), 16) / 255;
  let b = parseInt(hex.substring(4, 6), 16) / 255;

  let max = Math.max(r, g, b);
  let min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;

  if (max !== min) {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Converts a raw HSL space string components ("220 90% 56%") into a hex color string (e.g., "#3b82f6").
 */
export function hslToHex(hslStr: string): string {
  const parts = hslStr.trim().split(/\s+/);
  if (parts.length !== 3) return '#000000';
  let h = parseFloat(parts[0]);
  let s = parseFloat(parts[1].replace('%', '')) / 100;
  let l = parseFloat(parts[2].replace('%', '')) / 100;

  let r = l;
  let g = l;
  let b = l;

  if (s !== 0) {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h / 360 + 1 / 3);
    g = hue2rgb(p, q, h / 360);
    b = hue2rgb(p, q, h / 360 - 1 / 3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

