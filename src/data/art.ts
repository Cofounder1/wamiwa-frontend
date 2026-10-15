/** Deterministic generative portraits for agents (data-URI SVG). */
const palettes = [
  ['#0b3658', '#4e9ad9', '#bfe0ff'],
  ['#2a1a4a', '#9a6ad9', '#f0d8ff'],
  ['#3a2410', '#c97323', '#ffe0b8'],
  ['#0e3434', '#42b3b1', '#c9f2ee'],
  ['#3a0f1a', '#d9586e', '#ffd3db'],
  ['#1a2a10', '#7aa63a', '#e3f5c8'],
  ['#101a3a', '#5a6ee0', '#d8deff'],
  ['#2a2a2a', '#e0b23a', '#fff1c8'],
]

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export function agentArt(seed: string, paletteIndex?: number) {
  const h = hash(seed)
  const [bg, mid, light] = palettes[paletteIndex ?? h % palettes.length]
  const r = (n: number, mod: number) => ((h >> n) & 0xff) % mod
  const eyes = r(3, 3)
  const shape = r(7, 3)
  const head =
    shape === 0
      ? `<rect x="24" y="26" width="52" height="48" rx="18" fill="${mid}"/>`
      : shape === 1
        ? `<circle cx="50" cy="50" r="27" fill="${mid}"/>`
        : `<path d="M50 22 76 37v26L50 78 24 63V37z" fill="${mid}"/>`
  const eye =
    eyes === 0
      ? `<circle cx="40" cy="48" r="5" fill="${light}"/><circle cx="60" cy="48" r="5" fill="${light}"/>`
      : eyes === 1
        ? `<rect x="34" y="45" width="32" height="7" rx="3.5" fill="${light}"/>`
        : `<circle cx="50" cy="48" r="8" fill="${light}"/><circle cx="50" cy="48" r="3" fill="${bg}"/>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="g" cx="30%" cy="20%" r="90%"><stop offset="0" stop-color="${mid}" stop-opacity=".55"/><stop offset="1" stop-color="${bg}"/></radialGradient></defs><rect width="100" height="100" fill="url(#g)"/><circle cx="${20 + r(11, 60)}" cy="${15 + r(13, 20)}" r="${18 + r(17, 14)}" fill="${light}" opacity=".12"/>${head}${eye}<rect x="42" y="61" width="16" height="3" rx="1.5" fill="${bg}" opacity=".55"/><line x1="50" y1="22" x2="50" y2="${shape === 2 ? 14 : 16}" stroke="${mid}" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="13" r="3.5" fill="${light}"/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export const unsplash = (id: string, w = 600, h?: number) =>
  `https://images.unsplash.com/photo-${id}?w=${w}${h ? `&h=${h}` : ''}&fit=crop&auto=format&q=70`
