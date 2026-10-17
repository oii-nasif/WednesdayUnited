import { useId, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { useBallDesign, type BallDesign } from "@/lib/ball-design";

// Ball artwork is drawn on a real sphere: shapes are built in 3D, turned toward the viewer and projected,
// so panels bulge naturally. Everything is computed once at module load.
type V3 = [number, number, number];
const PHI = (1 + Math.sqrt(5)) / 2;
const R = 47;
const norm = (v: V3): V3 => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mix = (a: V3, b: V3, t: number): V3 => norm([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
const cyclic = ([a, b, c]: V3): V3[] => [[a, b, c], [b, c, a], [c, a, b]];
const uniq = (vs: V3[]) => vs.filter((v, i) => vs.findIndex((w) => w.every((x, k) => Math.abs(x - v[k]!) < 1e-9)) === i);
const signs = (p: V3): V3[] => uniq([1, -1].flatMap((sx) => [1, -1].flatMap((sy) => [1, -1].map((sz) => [p[0] * sx, p[1] * sy, p[2] * sz] as V3))));
const family = (...seeds: V3[]) => uniq(seeds.flatMap((p) => cyclic(p).flatMap(signs)));
const centroid = (pts: V3[]) => norm(pts.reduce<V3>((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]));

function rodrigues(v: V3, k: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a), kv = cross(k, v), kd = dot(k, v);
  return [v[0] * c + kv[0] * s + k[0] * kd * (1 - c), v[1] * c + kv[1] * s + k[1] * kd * (1 - c), v[2] * c + kv[2] * s + k[2] * kd * (1 - c)];
}
// Turn one pentagon toward the viewer, then tilt slightly so the ball reads as round rather than flat.
const FRONT = norm([0, 1, PHI]);
const AXIS = norm(cross(FRONT, [0, 0, 1]));
const ANGLE = Math.acos(dot(FRONT, [0, 0, 1]));
const turn = (v: V3) => rodrigues(rodrigues(rodrigues(v, AXIS, ANGLE), [1, 0, 0], -0.32), [0, 1, 0], 0.22);

// Project a closed loop of sphere points; anything behind the horizon is pinned to the rim.
function path(loop: V3[]) {
  const pts = loop.map(turn);
  if (centroid(pts)[2] < -0.45) return "";
  return `M${pts.map((p) => {
    if (p[2] < 0) { const l = Math.hypot(p[0], p[1]); p = [p[0] / l, p[1] / l, 0]; }
    return `${(p[0] * R).toFixed(2)} ${(-p[1] * R).toFixed(2)}`;
  }).join("L")}Z`;
}
// Subdivide polygon edges along the sphere so straight edges become curved seams.
const curved = (poly: V3[], steps = 4) => poly.flatMap((a, i) => Array.from({ length: steps }, (_, t) => mix(a, poly[(i + 1) % poly.length]!, t / steps)));
function circle(centre: V3, radius: number, n = 40): V3[] {
  const u = norm(cross(centre, Math.abs(centre[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
  const w = cross(centre, u);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const d: V3 = [u[0] * Math.cos(a) + w[0] * Math.sin(a), u[1] * Math.cos(a) + w[1] * Math.sin(a), u[2] * Math.cos(a) + w[2] * Math.sin(a)];
    return norm([centre[0] * Math.cos(radius) + d[0] * Math.sin(radius), centre[1] * Math.cos(radius) + d[1] * Math.sin(radius), centre[2] * Math.cos(radius) + d[2] * Math.sin(radius)]);
  });
}

// Truncated icosahedron: 12 pentagons around the icosahedron vertices, 20 hexagons around its faces.
const VERTS = family([0, 1, 3 * PHI], [1, 2 + PHI, 2 * PHI], [PHI, 2, 2 * PHI + 1]).map(norm);
function face(dir: V3, n: number): V3[] {
  const d = norm(dir);
  const u = norm(cross(d, Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
  const w = cross(d, u);
  return VERTS.map((v) => [dot(v, d), v] as const).sort((a, b) => b[0] - a[0]).slice(0, n).map(([, v]) => v)
    .sort((a, b) => Math.atan2(dot(a, w), dot(a, u)) - Math.atan2(dot(b, w), dot(b, u)));
}
const ICO = family([0, 1, PHI]).map(norm);
const PENTAGONS = ICO.map((d) => face(d, 5));
const HEXAGONS = [...signs([1, 1, 1]), ...family([0, PHI, 1 / PHI])].map((d) => face(d, 6));
// Icosahedron faces: triples of mutually adjacent vertices (neighbours sit ~63° apart).
const TRIANGLES: V3[][] = [];
ICO.forEach((a, i) => ICO.forEach((b, j) => ICO.forEach((c, k) => {
  const near = (p: V3, q: V3) => dot(p, q) > 0.4;
  if (i < j && j < k && near(a, b) && near(b, c) && near(a, c)) TRIANGLES.push([a, b, c]);
})));

// Picks which corner of a Rihla panel carries the wing, rotating through the three so the pattern swirls.
function corner([a, b, c]: V3[], i: number) {
  const [p, q, r] = ([[a, b, c], [b, c, a], [c, a, b]] as V3[][])[i % 3]!;
  return { p: p!, q: q!, r: r!, m: centroid([a!, b!, c!]) };
}

type Layer = { d: string; fill: string; stroke?: string; width?: number; evenodd?: boolean };
const BLUE = "oklch(0.45 0.19 262)";
const NAVY = "oklch(0.24 0.07 264)";
const ORANGE = "oklch(0.7 0.19 48)";

const ART: Record<BallDesign, { base: string; rim: string; layers: Layer[] }> = {
  classic: {
    base: "#fbfbfa",
    rim: "#171b26",
    layers: [
      { d: HEXAGONS.map((h) => path(curved(h))).join(""), fill: "#fbfbfa", stroke: "#8b93a3", width: 1.3 },
      { d: PENTAGONS.map((p) => path(curved(p))).join(""), fill: "#171b26", stroke: "#8b93a3", width: 1.3 },
    ],
  },
  // Tango: a bold ring around every pentagon centre, with a thin orange inner ring.
  tango: {
    base: "#fdfdfc",
    rim: NAVY,
    layers: [
      { d: ICO.map((c) => path(circle(c, 0.47)) + path(circle(c, 0.37).reverse())).join(""), fill: BLUE, evenodd: true },
      { d: ICO.map((c) => path(circle(c, 0.33)) + path(circle(c, 0.3).reverse())).join(""), fill: ORANGE, evenodd: true },
      { d: HEXAGONS.map((h) => path(curved(h))).join(""), fill: "none", stroke: "#c9ced8", width: 0.8 },
    ],
  },
  // Rihla: 20 curved triangular panels, each with a bold navy wing at one corner and an orange speed stripe beside it.
  rihla: {
    base: "#fdfdfc",
    rim: NAVY,
    layers: [
      { d: TRIANGLES.map((t, i) => { const { p, q, r, m } = corner(t, i); return path(curved([mix(p, m, 0.06), mix(p, q, 0.5), m, mix(p, r, 0.5)], 6)); }).join(""), fill: NAVY },
      { d: TRIANGLES.map((t, i) => { const { p, q, m } = corner(t, i); const e = mix(p, q, 0.5); return path(curved([mix(e, q, 0.14), mix(m, q, 0.14), mix(m, q, 0.3), mix(e, q, 0.3)], 6)); }).join(""), fill: ORANGE },
      { d: TRIANGLES.map((t) => path(curved(t, 10))).join(""), fill: "none", stroke: "#b4bccb", width: 1 },
    ],
  },
};

export function Football({ className, style, design }: { className?: string; style?: CSSProperties; design?: BallDesign }) {
  const id = useId();
  const chosen = useBallDesign();
  const art = ART[design ?? chosen];
  return (
    <svg viewBox="-50 -50 100 100" aria-hidden="true" className={cn("size-10", className)} style={style}>
      <defs>
        <clipPath id={`${id}c`}><circle r={R} /></clipPath>
        <radialGradient id={`${id}h`} cx="34%" cy="28%" r="70%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="35%" stopColor="#fff" stopOpacity="0.12" />
          <stop offset="70%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.42" />
        </radialGradient>
      </defs>
      <g clipPath={`url(#${id}c)`} strokeLinejoin="round">
        <circle r={R} fill={art.base} />
        {art.layers.map((l, i) => <path key={i} d={l.d} fill={l.fill} fillRule={l.evenodd ? "evenodd" : "nonzero"} stroke={l.stroke} strokeWidth={l.width} />)}
        <circle r={R} fill={`url(#${id}h)`} />
      </g>
      <circle r={R} fill="none" stroke={art.rim} strokeOpacity="0.75" strokeWidth="1.4" />
    </svg>
  );
}

export function BallLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-1 py-16">
      <Football className="ball-bounce size-12" />
      <span className="ball-bounce-shadow h-2 w-10 rounded-full bg-foreground/15" />
      <span className="mt-3 text-sm text-muted-foreground">{label}…</span>
    </div>
  );
}
