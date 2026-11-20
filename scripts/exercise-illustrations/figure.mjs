// Renders a simple side-view figure (man in a long-sleeved shirt and long trousers) as SVG.
// Angles are in degrees. Limbs: 0 = pointing straight down, +90 = pointing forward (right), 180 = up.
// Torso: 0 = upright, +90 = leaning fully forward (head to the right), -90 = lying with head to the left.

const D = Math.PI / 180
const down = (a) => [Math.sin(a * D), Math.cos(a * D)]
const up = (a) => [Math.sin(a * D), -Math.cos(a * D)]
const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k]

export const W = 240
export const H = 200
const GROUND = 182
const LEN = { torso: 50, neck: 7, head: 9, ua: 25, fa: 24, th: 37, sh: 37, foot: 11 }
const C = {
  skin: "#C9976F", hair: "#2B1D14",
  shirt: "#2F6DB5", shirtFar: "#22528A",
  pants: "#334155", pantsFar: "#1E293B",
  shoe: "#0F172A", metal: "#6B7280", metalDark: "#374151", plate: "#9CA3AF",
  wood: "#B7895A", ground: "#CBD5E1", accent: "#C2410C", band: "#DC2626", water: "#7DD3FC",
}

export const pose = (o = {}) => ({
  t: 0, a1u: 0, a1f: 0, a2u: 0, a2f: 0, l1k: 0, l1s: 0, l2k: 0, l2s: 0, ft1: 90, ft2: 90,
  raise: 0, gx: 0, eq: [], ...o,
})

function joints(p) {
  const hip = [0, 0]
  const neck = add(hip, up(p.t), LEN.torso)
  const sho = add(neck, up(p.t), -4)
  const head = add(neck, up(p.t + (p.hd ?? 0)), LEN.neck + LEN.head)
  const e1 = add(sho, down(p.a1u), LEN.ua), h1 = add(e1, down(p.a1f), LEN.fa)
  const e2 = add(sho, down(p.a2u), LEN.ua), h2 = add(e2, down(p.a2f), LEN.fa)
  const k1 = add(hip, down(p.l1k), LEN.th), a1 = add(k1, down(p.l1s), LEN.sh), t1 = add(a1, down(p.ft1), LEN.foot)
  const k2 = add(hip, down(p.l2k), LEN.th), a2 = add(k2, down(p.l2s), LEN.sh), t2 = add(a2, down(p.ft2), LEN.foot)
  return { hip, neck, sho, head, e1, h1, e2, h2, k1, a1, t1, k2, a2, t2 }
}

function place(p) {
  const j = joints(p)
  const pad = { a1: 4, a2: 4, t1: 4, t2: 4, k1: 6, k2: 6, hip: 9, neck: 9, head: 9, h1: 4, h2: 4, e1: 5, e2: 5 }
  const lowest = Math.max(...Object.entries(pad).map(([k, v]) => j[k][1] + v))
  const xs = Object.keys(pad).map((k) => j[k][0])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  // `hang` pins the hands at that y (pull-ups, hanging, dips); otherwise the lowest point touches the ground.
  const dx = W / 2 - cx + p.gx, dy = p.hang !== undefined ? p.hang - j.h1[1] : GROUND - lowest - p.raise
  for (const k of Object.keys(j)) j[k] = [j[k][0] + dx, j[k][1] + dy]
  return j
}

const f = (n) => Math.round(n * 10) / 10
const line = (a, b, color, w) => `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`
const circle = (c, r, fill, extra = "") => `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${r}" fill="${fill}" ${extra}/>`
const rect = (x, y, w, h, fill, extra = "") => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}" ${extra}/>`

// Equipment. `at` names a joint (h1, h2, sho, hip, k1, a1, …) or is an absolute [x, y]; dx/dy offset it.
function equipment(e, j) {
  const at = (key = e.at) => {
    const base = Array.isArray(key) ? key : j[key]
    return [base[0] + (e.dx ?? 0), base[1] + (e.dy ?? 0)]
  }
  const p = e.at !== undefined ? at() : null
  const X = (v) => j.hip[0] + v, Y = (h) => GROUND - h
  switch (e.type) {
    case "plate": return circle(p, e.r ?? 16, C.plate, `stroke="${C.metalDark}" stroke-width="2"`) + circle(p, 3, C.metalDark)
    case "db": return circle(p, e.r ?? 6, C.metalDark)
    case "kb": return `<path d="M ${f(p[0] - 5)} ${f(p[1])} q 5 -9 10 0" stroke="${C.metalDark}" stroke-width="3" fill="none"/>` + circle([p[0], p[1] + 8], 8, C.metalDark)
    case "ball": return circle(p, e.r ?? 10, e.color ?? C.accent)
    case "bar": return line(at(e.from), at(e.to), C.metalDark, 4)
    case "hbar": return line([p[0] - 26, p[1]], [p[0] + 26, p[1]], C.metalDark, 5) + line([p[0] + (e.postAt ?? -26), p[1]], [p[0] + (e.postAt ?? -26), GROUND], C.metal, 5)
    case "trapbar": return line([p[0] - 22, p[1]], [p[0] + 22, p[1]], C.metalDark, 4) + circle([p[0], p[1]], 15, C.plate, `stroke="${C.metalDark}" stroke-width="2"`)
    case "bench": {
      const y = p[1], x0 = p[0] - (e.w ?? 70) / 2
      return rect(x0, y, e.w ?? 70, 7, C.metalDark, 'rx="2"') + line([x0 + 8, y + 7], [x0 + 8, GROUND], C.metal, 4) + line([x0 + (e.w ?? 70) - 8, y + 7], [x0 + (e.w ?? 70) - 8, GROUND], C.metal, 4)
    }
    case "incline": return `<path d="M ${f(X(e.x0))} ${f(Y(e.h0))} L ${f(X(e.x1))} ${f(Y(e.h1))}" stroke="${C.metalDark}" stroke-width="7" stroke-linecap="round"/>` + line([X(e.x0), Y(e.h0)], [X(e.x0), GROUND], C.metal, 4) + line([X(e.x1), Y(e.h1)], [X(e.x1), GROUND], C.metal, 4)
    case "box": return rect(X(e.x), GROUND - e.h, e.w ?? 44, e.h, C.wood, `stroke="#8B6239" stroke-width="2" rx="2"`)
    case "wall": return rect(X(e.x), 20, 10, GROUND - 20, "#E2E8F0", `stroke="${C.ground}"`)
    case "post": return line([X(e.x), GROUND], [X(e.x), Y(e.top)], C.metal, 5) + (e.barTo !== undefined ? line([X(e.x), Y(e.top)], [X(e.barTo), Y(e.top)], C.metalDark, 4) : "")
    case "cable": {
      const col = X(e.x)
      return rect(col - 6, 24, 12, GROUND - 24, C.metal, 'rx="2"') + line(p, [col, e.y !== undefined ? Y(e.y) : p[1]], "#111827", 1.5) + circle([col, e.y !== undefined ? Y(e.y) : p[1]], 3, C.metalDark)
    }
    case "rope": return line(p, at(e.to), e.color ?? "#111827", e.w ?? 1.5)
    case "band": return line(p, at(e.to), C.band, 2.5)
    case "landmine": return line(p, [X(e.pivot), GROUND - 2], C.metalDark, 4) + circle(p, 11, C.plate, `stroke="${C.metalDark}" stroke-width="2"`) + circle([X(e.pivot), GROUND - 2], 4, C.metalDark)
    case "sled": return `<path d="M ${f(p[0])} ${f(p[1])} L ${f(p[0] + 10)} ${f(GROUND - 12)} L ${f(p[0] + 48)} ${f(GROUND - 12)}" stroke="${C.metalDark}" stroke-width="4" fill="none"/>` + rect(p[0] + 4, GROUND - 12, 48, 6, C.metalDark) + circle([p[0] + 30, GROUND - 22], 11, C.plate, `stroke="${C.metalDark}" stroke-width="2"`)
    case "cones": return (e.xs ?? []).map((v) => X(v)).map((x) => `<path d="M ${x - 5} ${GROUND} L ${x} ${GROUND - 12} L ${x + 5} ${GROUND} Z" fill="${C.accent}"/>`).join("")
    case "ladder": return line([X(e.x0), GROUND + 2], [X(e.x1), GROUND + 2], "#EAB308", 2) + Array.from({ length: Math.floor((e.x1 - e.x0) / 18) + 1 }, (_, i) => line([X(e.x0) + i * 18, GROUND - 1], [X(e.x0) + i * 18, GROUND + 4], "#EAB308", 2)).join("")
    case "bike": return circle([X(e.x), GROUND - 16], 16, "none", `stroke="${C.metalDark}" stroke-width="4"`) + line([X(e.x), GROUND - 16], [X(e.seatX), Y(e.seatY)], C.metalDark, 4) + line([X(e.x), GROUND - 16], [X(e.barX), Y(e.barY)], C.metalDark, 4) + rect(X(e.seatX) - 9, Y(e.seatY) - 3, 18, 5, C.metalDark, 'rx="2"') + circle([X(e.x), GROUND - 16], 5, C.metal)
    case "rower": return rect(X(e.x0), GROUND - 10, e.x1 - e.x0, 6, C.metalDark, 'rx="3"') + circle([X(e.x1), GROUND - 18], 14, C.metal) + rect(X(e.seatX) - 9, GROUND - 16, 18, 6, C.metalDark, 'rx="2"')
    case "skierg": return rect(X(e.x) - 6, 18, 12, GROUND - 18, C.metal, 'rx="3"') + line([X(e.x), 26], p, "#111827", 1.5)
    case "legpress": { const seat = [j.hip[0] + 2, j.hip[1] + 9]; return `<path d="M ${f(seat[0])} ${f(seat[1])} L ${f(seat[0] - 34)} ${f(seat[1] - 40)}" stroke="${C.metalDark}" stroke-width="7" stroke-linecap="round"/>` + rect(seat[0] - 6, seat[1], 10, GROUND - seat[1], C.metal) + rect(p[0] - 2, p[1] - 22, 7, 34, C.metalDark, 'rx="2"') + line([p[0] + 5, p[1] - 4], [p[0] + 34, GROUND - 4], C.metal, 5) }
    case "ghd": return rect(p[0] - 10, p[1], 26, 9, C.metalDark, 'rx="4"') + line([p[0] + 3, p[1] + 9], [p[0] + 3, GROUND], C.metal, 5)
    case "water": return rect(0, 96, W, GROUND - 96, C.water, 'opacity="0.45"') + `<path d="M0 96 q 15 -6 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0" stroke="#38BDF8" stroke-width="2" fill="none"/>`
    case "slope": return `<path d="M 0 ${GROUND - 30} L ${W} ${GROUND}" stroke="${C.ground}" stroke-width="4"/>`
    default: throw new Error(`unknown equipment ${e.type}`)
  }
}

export function render(p) {
  const j = place(p)
  const back = p.eq.filter((e) => e.back).map((e) => equipment(e, j)).join("")
  const front = p.eq.filter((e) => !e.back).map((e) => equipment(e, j)).join("")
  const limb = (a, b, c, color, w1, w2) => line(a, b, color, w1) + line(b, c, color, w2)
  const foot = (a, t) => line(a, t, C.shoe, 6)
  const hand = (h) => circle(h, 3.6, C.skin)
  const hair = (() => {
    const ang = p.t + (p.hd ?? 0)
    return `<g transform="translate(${f(j.head[0])} ${f(j.head[1])}) rotate(${f(ang)})"><path d="M -9.2 1 A 9.2 9.2 0 0 1 7.5 -5.5 L 3 -2 L -3 -1 Z" fill="${C.hair}"/></g>`
  })()
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 2}" height="${H * 2}">` +
    rect(0, 0, W, H, "#F8FAFC") + line([0, GROUND + 1], [W, GROUND + 1], C.ground, 3) +
    back +
    limb(j.sho, j.e2, j.h2, C.shirtFar, 9, 8) + hand(j.h2) +
    limb(j.hip, j.k2, j.a2, C.pantsFar, 13, 11) + foot(j.a2, j.t2) +
    line(j.hip, j.neck, C.shirt, 19) + circle(j.hip, 9, C.pants) + line(j.neck, j.head, C.skin, 7) +
    circle(j.head, LEN.head, C.skin) + hair +
    limb(j.hip, j.k1, j.a1, C.pants, 13, 11) + foot(j.a1, j.t1) +
    limb(j.sho, j.e1, j.h1, C.shirt, 9, 8) + hand(j.h1) +
    front + `</svg>`
}
