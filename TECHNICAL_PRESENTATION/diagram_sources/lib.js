// Shared SVG drawing helpers for the CampusOS technical presentation.
// Pure Node.js (no dependencies). Every diagram is hand-specified in diagrams.js.
'use strict';

const META = { commit: '4f2ced5', date: '2026-11-05' };

const C = {
  fe:   { s: '#2563EB', f: '#EFF6FF', t: '#1E3A8A' },  // frontend
  be:   { s: '#7C3AED', f: '#F5F3FF', t: '#4C1D95' },  // backend
  db:   { s: '#059669', f: '#ECFDF5', t: '#064E3B' },  // data
  ext:  { s: '#D97706', f: '#FFFBEB', t: '#78350F' },  // external services
  warn: { s: '#DC2626', f: '#FEF2F2', t: '#7F1D1D' },  // mock / gap / risk
  gray: { s: '#64748B', f: '#F8FAFC', t: '#1E293B' },  // neutral / legacy
  ok:   { s: '#16A34A', f: '#F0FDF4', t: '#14532D' },
  part: { s: '#CA8A04', f: '#FEFCE8', t: '#713F12' },
  infra:{ s: '#0891B2', f: '#ECFEFF', t: '#164E63' },
};

const FONT = "'Segoe UI', 'Inter', 'Helvetica Neue', Arial, sans-serif";
const MONO = "'Cascadia Code', Consolas, 'Courier New', monospace";

function esc(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function text(x, y, s, o = {}) {
  const { size = 13, weight = 400, color = '#334155', anchor = 'start', font = FONT, italic = false } = o;
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}"${italic ? ' font-style="italic"' : ''}>${esc(s)}</text>`;
}

function pill(x, y, label, c = 'warn', o = {}) {
  const k = C[c];
  const size = o.size || 10;
  const w = Math.round(label.length * size * 0.62 + 14);
  const h = size + 8;
  const ax = o.anchor === 'end' ? x - w : x;
  return `<g><rect x="${ax}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${k.s}"/>` +
    text(ax + w / 2, y + h - 5, label, { size, weight: 700, color: '#fff', anchor: 'middle' }) + `</g>`;
}

// Rounded box with title, optional body lines and optional status tag.
function box(o) {
  const { x, y, w, h, title, lines = [], c = 'be', tag, tagC = 'warn', dashed = false, ts = 15, ls = 12.5, align = 'left', mono = false, fill } = o;
  const k = C[c];
  let s = `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${fill || k.f}" stroke="${k.s}" stroke-width="1.8"${dashed ? ' stroke-dasharray="7 5"' : ''} filter="url(#sh)"/>`;
  s += `<rect x="${x}" y="${y}" width="6" height="${h}" rx="3" fill="${k.s}"/>`;
  const cx = align === 'center' ? x + w / 2 : x + 18;
  const anchor = align === 'center' ? 'middle' : 'start';
  let ty = y + 24;
  if (title) { s += text(cx, ty, title, { size: ts, weight: 700, color: k.t, anchor }); ty += ls + 9; }
  for (const l of lines) {
    s += text(cx, ty, l, { size: ls, color: '#334155', anchor, font: mono ? MONO : FONT });
    ty += ls + 6;
  }
  if (tag) s += pill(x + w - 8, y - 9, tag, tagC, { anchor: 'end' });
  return s + '</g>';
}

function group(o) {
  const { x, y, w, h, label, c = 'gray', sub } = o;
  const k = C[c];
  let s = `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${k.f}" fill-opacity="0.45" stroke="${k.s}" stroke-width="1.4" stroke-dasharray="4 4"/>`;
  s += text(x + 16, y + 24, label.toUpperCase(), { size: 12.5, weight: 800, color: k.s });
  if (sub) s += text(x + 16, y + 41, sub, { size: 11, color: '#64748B', italic: true });
  return s + '</g>';
}

// Polyline arrow. pts = [[x,y],...]. Label placed at lx,ly (or midpoint of first segment).
function arrow(pts, o = {}) {
  const { label, c = 'gray', dashed = false, both = false, lx, ly, ls = 11.5, w = 1.7, lbg = true } = o;
  const k = C[c];
  const d = 'M' + pts.map(p => p.join(',')).join(' L');
  let s = `<path d="${d}" fill="none" stroke="${k.s}" stroke-width="${w}"${dashed ? ' stroke-dasharray="6 4"' : ''} marker-end="url(#ah-${c})"${both ? ` marker-start="url(#as-${c})"` : ''}/>`;
  if (label) {
    const mx = lx !== undefined ? lx : (pts[0][0] + pts[1][0]) / 2;
    const my = ly !== undefined ? ly : (pts[0][1] + pts[1][1]) / 2;
    const lines = Array.isArray(label) ? label : [label];
    const maxLen = Math.max(...lines.map(l => l.length));
    const bw = maxLen * ls * 0.56 + 12, bh = lines.length * (ls + 4) + 6;
    if (lbg) s += `<rect x="${mx - bw / 2}" y="${my - bh / 2}" width="${bw}" height="${bh}" rx="4" fill="#fff" fill-opacity="0.95" stroke="${k.s}" stroke-opacity="0.35"/>`;
    lines.forEach((l, i) => {
      s += text(mx, my - bh / 2 + 3 + (i + 1) * (ls + 4) - 3, l, { size: ls, color: k.t, anchor: 'middle', weight: 600 });
    });
  }
  return s;
}

function defs() {
  let m = '';
  for (const [n, k] of Object.entries(C)) {
    m += `<marker id="ah-${n}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${k.s}"/></marker>`;
    m += `<marker id="as-${n}" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M10,0 L0,5 L10,10 z" fill="${k.s}"/></marker>`;
  }
  return `<defs>${m}<filter id="sh" x="-5%" y="-5%" width="110%" height="120%"><feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="#0F172A" flood-opacity="0.10"/></filter></defs>`;
}

// Legend items: [[colorKey,label,dashed?], ...]
function legend(x, y, items) {
  let s = '', cx = x;
  for (const [c, l, d] of items) {
    const k = C[c];
    s += `<rect x="${cx}" y="${y}" width="16" height="12" rx="3" fill="${k.f}" stroke="${k.s}" stroke-width="1.6"${d ? ' stroke-dasharray="3 2"' : ''}/>`;
    s += text(cx + 22, y + 11, l, { size: 11.5, color: '#475569' });
    cx += 22 + l.length * 6.3 + 26;
  }
  return s;
}

function doc(w, h, title, subtitle, body, o = {}) {
  const head = `<rect width="${w}" height="${h}" fill="#FFFFFF"/>` +
    `<rect width="${w}" height="74" fill="#0F172A"/>` +
    `<rect y="74" width="${w}" height="3" fill="#7C3AED"/>` +
    text(36, 38, title, { size: 24, weight: 700, color: '#FFFFFF' }) +
    text(36, 60, subtitle, { size: 13, color: '#CBD5E1' }) +
    text(w - 36, 38, 'CampusOS · Campus Intelligence', { size: 13, weight: 600, color: '#A5B4FC', anchor: 'end' }) +
    text(w - 36, 60, o.badge || 'AS-BUILT', { size: 12, weight: 700, color: '#FBBF24', anchor: 'end' });
  const foot = `<line x1="36" y1="${h - 34}" x2="${w - 36}" y2="${h - 34}" stroke="#E2E8F0"/>` +
    text(36, h - 14, `Verified against repository source @ commit ${META.commit} · generated ${META.date} · ${o.foot || 'Represents implemented code only; unverifiable items are explicitly labelled.'}`, { size: 11, color: '#94A3B8' }) +
    (o.legend ? text(36, h - 50, 'LEGEND', { size: 11, weight: 800, color: '#64748B' }) + legend(110, h - 60, o.legend) : '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs()}${head}${body}${foot}</svg>`;
}

// Generic table renderer. cols = [{label,w}], rows = [[cell...]], cell may be {t, c (pill color)}
function table(x, y, cols, rows, o = {}) {
  const rh = o.rh || 30, hh = o.hh || 34, fs = o.fs || 12.5;
  const W = cols.reduce((a, c) => a + c.w, 0);
  let s = `<rect x="${x}" y="${y}" width="${W}" height="${hh}" rx="6" fill="#1E293B"/>`;
  let cx = x;
  for (const c of cols) { s += text(cx + 12, y + hh / 2 + 5, c.label, { size: fs, weight: 700, color: '#fff' }); cx += c.w; }
  rows.forEach((r, i) => {
    const ry = y + hh + i * rh;
    if (r.section) {
      s += `<rect x="${x}" y="${ry}" width="${W}" height="${rh}" fill="#E2E8F0"/>`;
      s += text(x + 12, ry + rh / 2 + 5, r.section, { size: fs, weight: 800, color: '#334155' });
      return;
    }
    s += `<rect x="${x}" y="${ry}" width="${W}" height="${rh}" fill="${i % 2 ? '#F8FAFC' : '#FFFFFF'}"/>`;
    s += `<line x1="${x}" y1="${ry + rh}" x2="${x + W}" y2="${ry + rh}" stroke="#E2E8F0"/>`;
    let cx2 = x;
    r.forEach((cell, j) => {
      if (cell && typeof cell === 'object' && cell.c) s += pill(cx2 + 10, ry + (rh - (fs + 6)) / 2, cell.t, cell.c, { size: fs - 2.5 });
      else s += text(cx2 + 12, ry + rh / 2 + 5, cell == null ? '' : cell, { size: fs, color: '#1E293B', weight: j === 0 ? 600 : 400, font: (cols[j].mono ? MONO : FONT) });
      cx2 += cols[j].w;
    });
  });
  return s;
}

// Sequence diagram renderer.
// parts: [{id,label,sub,c}], steps: [{f,t,l,ret?,note?,frame?}]
function sequence(w, title, subtitle, parts, steps, o = {}) {
  const top = 110, pw = 190, ph = 54;
  const gap = (w - 80 - pw) / (parts.length - 1);
  const X = {}; parts.forEach((p, i) => X[p.id] = 40 + pw / 2 + i * gap);
  const stepH = o.stepH || 44;
  let y = top + ph + 34;
  let body = '';
  const rows = [];
  for (const st of steps) {
    if (st.frame) { rows.push({ y, st }); y += 30; continue; }
    if (st.endframe) { rows.push({ y, st }); y += 18; continue; }
    rows.push({ y, st }); y += st.note ? (st.nh || 40) + 10 : stepH;
  }
  const H = y + 70;
  // lifelines
  parts.forEach(p => {
    const k = C[p.c];
    body += `<line x1="${X[p.id]}" y1="${top + ph}" x2="${X[p.id]}" y2="${H - 60}" stroke="${k.s}" stroke-opacity="0.45" stroke-width="1.5" stroke-dasharray="5 5"/>`;
  });
  parts.forEach(p => {
    body += box({ x: X[p.id] - pw / 2, y: top, w: pw, h: ph, title: p.label, lines: p.sub ? [p.sub] : [], c: p.c, align: 'center', ts: 14, ls: 11 });
  });
  // frames
  const open = [];
  for (const { y: ry, st } of rows) {
    if (st.frame) { open.push({ y: ry, st }); continue; }
    if (st.endframe) {
      const f = open.pop(); const k = C[f.st.c || 'gray'];
      body = `<rect x="30" y="${f.y}" width="${w - 60}" height="${ry - f.y}" rx="8" fill="${k.f}" fill-opacity="0.35" stroke="${k.s}" stroke-dasharray="5 4"/>` +
        `<rect x="30" y="${f.y}" width="${f.st.frame.length * 7.2 + 20}" height="22" rx="6" fill="${k.s}"/>` +
        text(40, f.y + 15, f.st.frame, { size: 11.5, weight: 700, color: '#fff' }) + body;
      continue;
    }
    if (st.note) {
      const x1 = X[st.f], x2 = st.t ? X[st.t] : x1;
      const nx = Math.min(x1, x2) - 90, nw = Math.abs(x2 - x1) + 180;
      const k = C[st.c || 'part'];
      const lines = Array.isArray(st.note) ? st.note : [st.note];
      const nh = st.nh || 40;
      body += `<rect x="${nx}" y="${ry}" width="${nw}" height="${nh}" rx="6" fill="${k.f}" stroke="${k.s}"/>`;
      lines.forEach((l, i) => body += text(nx + nw / 2, ry + 17 + i * 16, l, { size: 11.5, color: k.t, anchor: 'middle', weight: 600 }));
      continue;
    }
    const k = C[st.c || (st.ret ? 'gray' : 'be')];
    const x1 = X[st.f], x2 = X[st.t];
    if (st.f === st.t) {
      body += `<path d="M${x1},${ry} h46 v18 h-42" fill="none" stroke="${k.s}" stroke-width="1.6" marker-end="url(#ah-${st.c || 'be'})"/>`;
      body += text(x1 + 54, ry + 13, st.l, { size: 12, color: '#1E293B' });
      continue;
    }
    body += `<line x1="${x1}" y1="${ry}" x2="${x2 + (x2 > x1 ? -2 : 2)}" y2="${ry}" stroke="${k.s}" stroke-width="1.6"${st.ret ? ' stroke-dasharray="6 4"' : ''} marker-end="url(#ah-${st.c || (st.ret ? 'gray' : 'be')})"/>`;
    const labelText = st.n ? `[${st.n}]  ${st.l}` : st.l;
    body += text((x1 + x2) / 2, ry - 7, labelText, { size: 12, color: st.ret ? '#475569' : '#1E293B', anchor: 'middle', weight: st.ret ? 400 : 600 });
  }
  return doc(w, H, title, subtitle, body, { legend: o.legend, legendW: o.legendW, foot: o.foot });
}

module.exports = { C, META, esc, text, pill, box, group, arrow, legend, doc, table, sequence, MONO, FONT };
