/**
 * Deterministic SVG “logos” for categories/channels without uploaded images.
 * Hue is derived only from category id so all channels under the same category match.
 */

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hueFromSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 360;
}

function categoryHueKey(categoryId: string | null): string {
  return categoryId ?? '__uncategorized__';
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * Fallback logo for a channel: shows category name, same background tint for all channels in that category.
 */
export function channelCategoryBadgeDataUrl(categoryLabel: string, categoryId: string | null, size = 64): string {
  const h = hueFromSeed(categoryHueKey(categoryId));
  const label = truncate(categoryLabel || '?', 38);
  /** Subtle single-hue fill (not rainbow per row). */
  const fill = `hsl(${h}, 72%, 46%)`;
  const fillEdge = `hsl(${h}, 78%, 32%)`;
  const fs = label.length > 26 ? 7 : label.length > 18 ? 8.5 : 10.5;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${fill}"/>
      <stop offset="100%" stop-color="${fillEdge}"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="13" fill="url(#g)"/>
  <text x="32" y="36" text-anchor="middle" fill="rgba(255,255,255,.98)" font-family="system-ui,-apple-system,sans-serif" font-size="${fs}" font-weight="700" stroke="rgba(0,0,0,.45)" stroke-width="1.25" paint-order="stroke fill">${escXml(label)}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Category group header without custom upload. */
export function categoryHeaderBadgeDataUrl(name: string, categoryId: string, size = 64): string {
  const idForHue = categoryId === 'uncategorized' ? null : categoryId;
  return channelCategoryBadgeDataUrl(name, idForHue, size);
}

function parseHexColor(hex: string | null | undefined): { h: number; s: number; l: number } | null {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/** Deterministic team badge when no custom logo is uploaded. */
export function teamBadgeDataUrl(
  teamName: string,
  teamId: string,
  teamColor?: string | null,
  size = 64,
): string {
  const parsed = parseHexColor(teamColor);
  const h = parsed?.h ?? hueFromSeed(teamId);
  const fill = parsed ? `hsl(${h}, ${Math.min(78, (parsed.s || 50) + 18)}%, ${Math.min(52, (parsed.l || 45) + 4)}%)` : `hsl(${h}, 72%, 46%)`;
  const fillEdge = parsed ? `hsl(${h}, ${Math.min(85, (parsed.s || 50) + 22)}%, ${Math.max(28, (parsed.l || 45) - 12)}%)` : `hsl(${h}, 78%, 32%)`;
  const label = truncate(teamName || '?', 12);
  const fs = label.length > 9 ? 8 : label.length > 6 ? 9.5 : 11;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${fill}"/>
      <stop offset="100%" stop-color="${fillEdge}"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="13" fill="url(#g)"/>
  <text x="32" y="38" text-anchor="middle" fill="rgba(255,255,255,.98)" font-family="system-ui,-apple-system,sans-serif" font-size="${fs}" font-weight="700" stroke="rgba(0,0,0,.45)" stroke-width="1.25" paint-order="stroke fill">${escXml(label)}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function teamLogoSrc(team: { id: string; name: string; color: string; logoUrl?: string | null }): string {
  return team.logoUrl ?? teamBadgeDataUrl(team.name, team.id, team.color);
}
