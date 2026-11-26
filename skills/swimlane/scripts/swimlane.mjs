#!/usr/bin/env node
// swimlane.mjs — 단계별 절차 스윔레인을 의존성 없는 단일 HTML(+선택 PNG)로 그린다.
// 사용: node swimlane.mjs <spec.json> [--out <path-without-ext>] [--png] [--check] [--no-open]
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile, execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const specPath = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--out");
if (!specPath || !existsSync(specPath)) { console.error("사용: node swimlane.mjs <spec.json> [--out p] [--png] [--check] [--no-open]"); process.exit(2); }

const spec = JSON.parse(readFileSync(specPath, "utf8"));
const KINDS = ["normal", "external", "db", "async", "warn", "manual"];
const errs = [];
const laneIds = new Set((spec.lanes || []).map((l) => l.id));
if (!spec.title) errs.push("title 없음");
if (!spec.lanes?.length) errs.push("lanes 비어 있음");
let n = 0;
for (const [pi, ph] of (spec.phases || []).entries()) {
  if (!ph.name) errs.push(`phases[${pi}].name 없음`);
  for (const [si, st] of (ph.steps || []).entries()) {
    n++;
    if (!laneIds.has(st.lane)) errs.push(`phase ${pi} step ${si}: lane "${st.lane}" 이 lanes에 없음`);
    if (!st.title) errs.push(`phase ${pi} step ${si}: title 없음`);
    if (st.kind && !KINDS.includes(st.kind)) errs.push(`phase ${pi} step ${si}: kind "${st.kind}" (가능: ${KINDS.join(",")})`);
    for (const t of [].concat(st.next || [])) if (typeof t !== "number") errs.push(`phase ${pi} step ${si}: next는 단계 번호(숫자)`);
  }
}
if (!n) errs.push("단계가 하나도 없음");
if (errs.length) { console.error("검사 실패:\n- " + errs.join("\n- ")); process.exit(1); }
if (flag("--check")) { console.log(`OK: 레인 ${spec.lanes.length}, Phase ${spec.phases.length}, 단계 ${n}`); process.exit(0); }

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const L = spec.lanes.length;
let num = 0, row = 0;
const rows = [];
for (const ph of spec.phases) {
  rows.push(`<div class="phase" style="grid-row:${++row};grid-column:1/${L + 1}">${esc(ph.name)}${ph.note ? `<span>${esc(ph.note)}</span>` : ""}</div>`);
  for (const st of ph.steps) {
    num++;
    const col = spec.lanes.findIndex((l) => l.id === st.lane) + 1;
    const lines = (st.lines || []).map((x) => `<div class="ln">${esc(x)}</div>`).join("");
    const nx = st.next !== undefined ? ` data-next="${[].concat(st.next).join(",")}"` : "";
    rows.push(`<div class="cell" style="grid-row:${++row};grid-column:${col}"><div class="card k-${st.kind || "normal"}" id="s${num}"${nx}${st.seq === false ? ' data-noseq="1"' : ""}>
<div class="hd"><b>${num}</b>${esc(st.title)}</div>${lines}${st.note ? `<div class="nt">⚠ ${esc(st.note)}</div>` : ""}</div></div>`);
  }
}
const legend = [["normal", "내부 처리"], ["external", "외부 시스템"], ["db", "저장소"], ["async", "비동기·배치"], ["warn", "위험·확인 필요"], ["manual", "사람 조작"]]
  .map(([k, t]) => `<span class="lg"><i class="card k-${k}"></i>${t}</span>`).join("");

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(spec.title)}</title><style>
:root{--bg:#fbfaf3;--ink:#22252b;--mut:#6b6f78;--line:#5a5f6a;--lane:#2b2f36;--laneInk:#fff;--ph:#f4e7a1;--phInk:#6b5a00;--grid:#e6e3d6;
--n:#f7f3fa;--nB:#8d7aa8;--e:#fbf4e4;--eB:#c99b3c;--d:#eef2f6;--dB:#7b8ea3;--a:#fbf1e6;--aB:#d08a3e;--w:#fdecec;--wB:#cf4a4a;--m:#ecf6ee;--mB:#5c9b6b}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#17191d;--ink:#e7e8ea;--mut:#a3a7ae;--line:#9aa0aa;--lane:#3a404a;--ph:#4a4220;--phInk:#f1dc7a;--grid:#2a2d33;
--n:#262230;--e:#2d2717;--d:#1f262e;--a:#2e2318;--w:#341c1c;--m:#1b2a1f}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:13px/1.45 -apple-system,"Apple SD Gothic Neo","Pretendard",sans-serif}
.wrap{padding:20px 16px;min-width:${L * 220}px}h1{font-size:18px;margin:0 0 2px}.sub{color:var(--mut);margin-bottom:10px}
.legend{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:12px;color:var(--mut);font-size:12px}.lg{display:flex;align-items:center;gap:5px}.lg i{display:inline-block;width:16px;height:11px;padding:0;border-radius:3px}
.board{position:relative;display:grid;grid-template-columns:repeat(${L},1fr);column-gap:18px;row-gap:22px;
background:repeating-linear-gradient(90deg,transparent 0 calc((100% - ${(L - 1) * 18}px)/${L}),transparent 0)}
.lanes{position:sticky;top:0;z-index:3;display:grid;grid-template-columns:repeat(${L},1fr);column-gap:18px;background:var(--bg);padding-bottom:8px}
.lh{background:var(--lane);color:var(--laneInk);text-align:center;font-weight:700;padding:7px 6px;border-radius:4px;font-size:12px}
.lh small{display:block;font-weight:400;opacity:.75}
.phase{background:var(--ph);color:var(--phInk);font-weight:700;padding:5px 10px;border-radius:3px;font-size:12px;position:relative;z-index:1}.phase span{font-weight:400;margin-left:8px}
.cell{position:relative;z-index:2}.card{border:1.5px solid;border-radius:6px;padding:7px 9px;max-width:100%}
.hd{font-weight:700;display:flex;gap:6px;align-items:flex-start}.hd b{flex:none;width:19px;height:19px;border-radius:50%;background:var(--lane);color:#fff;font-size:11px;display:grid;place-items:center}
.ln{font:11.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--mut);margin-left:25px;white-space:pre-wrap;word-break:break-all}
.nt{margin:3px 0 0 25px;color:var(--wB);font-size:11.5px}
.k-normal{background:var(--n);border-color:var(--nB)}.k-external{background:var(--e);border-color:var(--eB);border-style:dashed}
.k-db{background:var(--d);border-color:var(--dB)}.k-async{background:var(--a);border-color:var(--aB);border-style:dashed}
.k-warn{background:var(--w);border-color:var(--wB)}.k-manual{background:var(--m);border-color:var(--mB)}
.k-external .hd b,.k-async .hd b{background:var(--aB)}.k-warn .hd b{background:var(--wB)}
svg.links{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;overflow:visible}
svg.links path{fill:none;stroke:var(--line);stroke-width:1.3}
</style></head><body><div class="wrap">
<h1>${esc(spec.title)}</h1>${spec.subtitle ? `<div class="sub">${esc(spec.subtitle)}</div>` : ""}<div class="legend">${legend}</div>
<div class="lanes">${spec.lanes.map((l) => `<div class="lh">${esc(l.name)}${l.sub ? `<small>${esc(l.sub)}</small>` : ""}</div>`).join("")}</div>
<div class="board" id="board">${rows.join("\n")}<svg class="links" id="links"><defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="currentColor" style="stroke:none;fill:var(--line)"/></marker></defs></svg></div>
</div><script>
function draw(){const b=document.getElementById("board"),svg=document.getElementById("links"),R=b.getBoundingClientRect();
svg.querySelectorAll("path.l").forEach(p=>p.remove());const cards=[...b.querySelectorAll(".card")];
const box=c=>{const r=c.getBoundingClientRect();return{x:r.left-R.left,y:r.top-R.top,w:r.width,h:r.height}};
const link=(a,c)=>{const A=box(a),C=box(c);const x1=A.x+A.w/2,y1=A.y+A.h,x2=C.x+C.w/2,y2=C.y;let d;
if(Math.abs(x1-x2)<2)d="M"+x1+" "+y1+"V"+(y2-2);else{const my=y1+Math.max(8,Math.min(14,(y2-y1)/2));d="M"+x1+" "+y1+"V"+my+"H"+x2+"V"+(y2-2);}
const p=document.createElementNS("http://www.w3.org/2000/svg","path");p.setAttribute("d",d);p.setAttribute("class","l");p.setAttribute("marker-end","url(#ar)");svg.appendChild(p)};
cards.forEach((c,i)=>{const nx=c.dataset.next;if(nx!==undefined){nx.split(",").filter(Boolean).forEach(k=>{const t=document.getElementById("s"+k);if(t)link(c,t)})}
else if(i+1<cards.length&&!cards[i+1].dataset.noseq)link(c,cards[i+1])})}
addEventListener("load",draw);addEventListener("resize",draw);
</script></body></html>`;

const outBase = opt("--out") ? resolve(opt("--out")) : resolve(specPath.replace(/\.json$/, ""));
writeFileSync(`${outBase}.html`, html);
console.log(`HTML: ${outBase}.html`);
if (flag("--png")) {
  const chrome = [process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/microsoft-edge",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].filter(Boolean).find(existsSync);
  if (!chrome) { console.error("Chrome/Chromium/Edge를 찾지 못해 PNG는 건너뜀 (HTML은 생성됨). CHROME_PATH 환경변수로 지정 가능."); }
  else {
    const h = 230 + n * 105 + spec.phases.length * 45, w = Math.max(1400, L * 260);
    const profile = mkdtempSync(join(tmpdir(), "swimlane-chrome-"));
    try {
      execFileSync(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${profile}`, "--hide-scrollbars", "--force-device-scale-factor=2", `--window-size=${w},${h}`, "--virtual-time-budget=2000", `--screenshot=${outBase}.png`, pathToFileURL(`${outBase}.html`).href], { stdio: "ignore", timeout: 60000 });
      console.log(`PNG: ${outBase}.png`);
    } catch (e) {
      console.error(`PNG 생성 실패(HTML은 생성됨): ${e.message.split("\n")[0]}`);
      process.exitCode = 3;
    } finally { try { rmSync(profile, { recursive: true, force: true }); } catch {} }
  }
}
if (!flag("--no-open") && !flag("--png")) {
  const [cmd, a] = process.platform === "darwin" ? ["open", []] : process.platform === "win32" ? ["cmd", ["/c", "start", ""]] : ["xdg-open", []];
  execFile(cmd, [...a, `${outBase}.html`], () => {});
}
