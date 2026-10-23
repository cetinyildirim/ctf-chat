/** Renders a report onto A4 pages and downloads a PDF. Text and charts are drawn by the browser, so Turkish characters stay intact. */

export type PdfBlock =
  | { kind: 'title' | 'meta' | 'h2' | 'h3' | 'p' | 'bullet'; text: string }
  | { kind: 'qhead'; label: string; text: string }
  | { kind: 'chart'; items: { label: string; value: number }[] }
  | { kind: 'answers'; text: string };

const PAGE_W = 1240;
const PAGE_H = 1754;
const MARGIN = 80;
const CONTENT_W = PAGE_W - MARGIN * 2;
const A4_W = 595.28;
const A4_H = 841.89;
const FONT = '"Segoe UI", "Noto Sans", "DejaVu Sans", sans-serif';
const COLORS = ['#0891b2', '#7c3aed', '#059669', '#d97706', '#e11d48', '#475569', '#0284c7', '#9333ea'];

type TextStyle = { font: string; color: string; line: number; before: number; after: number; bullet: boolean };

type Op =
  | { op: 'fill'; x: number; y: number; w: number; h: number; color: string }
  | { op: 'text'; text: string; font: string; color: string; x: number; y: number }
  | { op: 'chart'; x: number; y: number; w: number; h: number; items: { label: string; value: number }[] };

export async function downloadTextPdf(filename: string, blocks: PdfBlock[]): Promise<void> {
  if (document.fonts?.ready) await document.fonts.ready;
  const pages = layoutPages(blocks);
  const jpegs: Uint8Array[] = [];
  for (let i = 0; i < pages.length; i++) {
    jpegs.push(await paintPage(pages[i]!, i + 1, pages.length));
  }
  const blob = buildPdf(jpegs);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function layoutPages(blocks: PdfBlock[]): Op[][] {
  const ctx = measureContext();
  const pages: Op[][] = [[]];
  let y = MARGIN;
  const maxY = PAGE_H - MARGIN - 24;

  const newPage = () => {
    pages.push([]);
    y = MARGIN;
  };
  const page = () => pages[pages.length - 1]!;
  const ensure = (height: number) => {
    if (page().length > 0 && y + height > maxY) newPage();
  };

  blocks.forEach((block, index) => {
    if (block.kind === 'qhead') {
      const next = blocks[index + 1];
      const headH = questionHeight(ctx, block.text);
      const chartH = next?.kind === 'chart' ? chartHeight(next.items) + 20 : 0;
      ensure(Math.min(headH + chartH, maxY - MARGIN));
      paintQuestion(page(), ctx, block.label, block.text, y);
      y += headH + 20;
      return;
    }
    if (block.kind === 'chart') {
      const h = chartHeight(block.items);
      ensure(h);
      page().push({ op: 'chart', x: MARGIN, y, w: CONTENT_W, h, items: block.items });
      y += h + 20;
      return;
    }
    if (block.kind === 'answers') {
      const lines = wrappedLines(ctx, block.text, `400 18px ${FONT}`, CONTENT_W - 48);
      let start = 0;
      while (start < lines.length) {
        if (page().length > 0 && y + 52 > maxY) newPage();
        const room = Math.max(1, Math.floor((maxY - y - 16) / 28));
        const slice = lines.slice(start, start + room);
        const boxH = 16 + slice.length * 28;
        page().push({ op: 'fill', x: MARGIN, y, w: CONTENT_W, h: boxH, color: '#f8fafc' });
        page().push({ op: 'fill', x: MARGIN, y, w: 6, h: boxH, color: '#cbd5e1' });
        slice.forEach((line, lineIndex) => {
          page().push({
            op: 'text',
            text: line,
            font: `400 18px ${FONT}`,
            color: '#1e293b',
            x: MARGIN + 24,
            y: y + 8 + lineIndex * 28,
          });
        });
        y += boxH + 16;
        start += slice.length;
        if (start < lines.length) newPage();
      }
      return;
    }

    const style = styleOf(block.kind);
    ctx.font = style.font;
    const lines = wrap(ctx, block.text, CONTENT_W - (style.bullet ? 28 : 0));
    lines.forEach((line, lineIndex) => {
      const gapBefore = lineIndex === 0 ? style.before : 0;
      ensure(gapBefore + style.line);
      y += gapBefore;
      if (style.bullet) {
        page().push({ op: 'fill', x: MARGIN + 6, y: y + style.line / 2 - 3, w: 7, h: 7, color: style.color });
      }
      page().push({
        op: 'text',
        text: line,
        font: style.font,
        color: style.color,
        x: MARGIN + (style.bullet ? 28 : 0),
        y,
      });
      y += style.line + (lineIndex === lines.length - 1 ? style.after : 0);
    });
  });

  return pages.filter((items, index) => items.length > 0 || index === 0);
}

function questionHeight(ctx: CanvasRenderingContext2D, text: string): number {
  ctx.font = `700 22px ${FONT}`;
  const lines = wrap(ctx, text, CONTENT_W - 48);
  return 22 + 28 + lines.length * 30 + 18;
}

function paintQuestion(items: Op[], ctx: CanvasRenderingContext2D, label: string, text: string, y: number) {
  const h = questionHeight(ctx, text);
  items.push({ op: 'fill', x: MARGIN, y, w: CONTENT_W, h, color: '#ecfeff' });
  items.push({ op: 'fill', x: MARGIN, y, w: 8, h, color: '#0891b2' });
  items.push({ op: 'text', text: label, font: `700 15px ${FONT}`, color: '#0e7490', x: MARGIN + 28, y: y + 16 });
  ctx.font = `700 22px ${FONT}`;
  const lines = wrap(ctx, text, CONTENT_W - 48);
  lines.forEach((line, i) => {
    items.push({
      op: 'text',
      text: line,
      font: `700 22px ${FONT}`,
      color: '#0f172a',
      x: MARGIN + 28,
      y: y + 42 + i * 30,
    });
  });
}

function chartHeight(items: { label: string; value: number }[]): number {
  return Math.max(300, items.length * 42 + 28);
}

function wrappedLines(ctx: CanvasRenderingContext2D, text: string, font: string, width: number): string[] {
  ctx.font = font;
  const lines: string[] = [];
  for (const row of text.split('\n')) {
    const trimmed = row.trim();
    if (!trimmed) continue;
    lines.push(...wrap(ctx, trimmed, width));
  }
  return lines.length ? lines : [''];
}

function measureContext(): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  return ctx;
}

async function paintPage(items: Op[], page: number, total: number): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  ctx.fillStyle = '#0891b2';
  ctx.fillRect(MARGIN, 46, CONTENT_W, 4);

  const fills = items.filter((item) => item.op === 'fill');
  const rest = items.filter((item) => item.op !== 'fill');
  for (const item of fills) {
    ctx.fillStyle = item.color;
    ctx.fillRect(item.x, item.y, item.w, item.h);
  }
  for (const item of rest) {
    if (item.op === 'chart') drawChart(ctx, item);
    else if (item.op === 'text') {
      ctx.font = item.font;
      ctx.fillStyle = item.color;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText(item.text, item.x, item.y);
    }
  }

  ctx.fillStyle = '#94a3b8';
  ctx.font = `16px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(`${page} / ${total}`, PAGE_W - MARGIN, PAGE_H - 52);
  ctx.textAlign = 'left';

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('JPEG failed'))), 'image/jpeg', 0.92);
  });
  return new Uint8Array(await blob.arrayBuffer());
}

function drawChart(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; w: number; h: number; items: { label: string; value: number }[] },
) {
  const items = box.items.filter((item) => item.label.trim());
  if (!items.length) return;
  const max = Math.max(...items.map((item) => item.value), 1);
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const gap = 28;
  const leftW = Math.round(box.w * 0.62);
  const rightX = box.x + leftW + gap;
  const rightW = box.w - leftW - gap;

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  roundRect(ctx, box.x, box.y, box.w, box.h, 16);
  ctx.fill();
  ctx.stroke();

  const rowH = Math.min(42, (box.h - 36) / items.length);
  const labelW = 210;
  const barX = box.x + 20 + labelW;
  const barW = Math.max(80, leftW - labelW - 130);
  items.forEach((item, i) => {
    const rowY = box.y + 18 + i * rowH;
    ctx.font = `16px ${FONT}`;
    ctx.fillStyle = '#334155';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(truncate(ctx, item.label, labelW - 8), box.x + 20, rowY + rowH / 2);
    ctx.fillStyle = '#e2e8f0';
    roundRect(ctx, barX, rowY + rowH / 2 - 8, barW, 16, 8);
    ctx.fill();
    const width = Math.max(item.value > 0 ? 8 : 0, (item.value / max) * barW);
    ctx.fillStyle = COLORS[i % COLORS.length]!;
    if (width > 0) {
      roundRect(ctx, barX, rowY + rowH / 2 - 8, width, 16, 8);
      ctx.fill();
    }
    const pct = total > 0 ? Math.round((item.value / total) * 1000) / 10 : 0;
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 15px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`${item.value} · %${pct}`, barX + barW + 10, rowY + rowH / 2);
  });

  const pieItems = items.filter((item) => item.value > 0);
  const cx = rightX + rightW / 2;
  const cy = box.y + Math.min(150, box.h * 0.38);
  const radius = 108;
  if (pieItems.length && total > 0) {
    let angle = -Math.PI / 2;
    pieItems.forEach((item) => {
      const slice = (item.value / total) * Math.PI * 2;
      const colorIndex = items.indexOf(item);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, angle, angle + slice);
      ctx.closePath();
      ctx.fillStyle = COLORS[colorIndex % COLORS.length]!;
      ctx.fill();
      angle += slice;
    });
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `15px ${FONT}`;
  const legendTop = cy + radius + 22;
  pieItems.slice(0, 6).forEach((item, i) => {
    const ly = legendTop + i * 24;
    if (ly > box.y + box.h - 16) return;
    const colorIndex = items.indexOf(item);
    ctx.fillStyle = COLORS[colorIndex % COLORS.length]!;
    ctx.fillRect(rightX + 16, ly - 6, 14, 14);
    ctx.fillStyle = '#334155';
    const pct = Math.round((item.value / total) * 1000) / 10;
    ctx.fillText(truncate(ctx, `${item.label} %${pct}`, rightW - 48), rightX + 38, ly);
  });
  ctx.textBaseline = 'top';
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

function styleOf(kind: 'title' | 'meta' | 'h2' | 'h3' | 'p' | 'bullet'): TextStyle {
  if (kind === 'title') return { font: `700 40px ${FONT}`, color: '#0f172a', line: 52, before: 10, after: 6, bullet: false };
  if (kind === 'meta') return { font: `400 18px ${FONT}`, color: '#64748b', line: 28, before: 4, after: 18, bullet: false };
  if (kind === 'h2') return { font: `700 26px ${FONT}`, color: '#0e7490', line: 36, before: 28, after: 10, bullet: false };
  if (kind === 'h3') return { font: `700 18px ${FONT}`, color: '#334155', line: 26, before: 16, after: 8, bullet: false };
  if (kind === 'bullet') return { font: `400 18px ${FONT}`, color: '#1e293b', line: 28, before: 2, after: 2, bullet: true };
  return { font: `400 18px ${FONT}`, color: '#1e293b', line: 28, before: 4, after: 8, bullet: false };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.trim() ? paragraph.split(/\s+/) : [''];
    let current = '';
    const pushWord = (word: string) => {
      if (ctx.measureText(word).width <= maxWidth) {
        const trial = current ? `${current} ${word}` : word;
        if (ctx.measureText(trial).width <= maxWidth) current = trial;
        else {
          if (current) lines.push(current);
          current = word;
        }
        return;
      }
      if (current) {
        lines.push(current);
        current = '';
      }
      let piece = '';
      for (const ch of word) {
        const trial = piece + ch;
        if (ctx.measureText(trial).width > maxWidth && piece) {
          lines.push(piece);
          piece = ch;
        } else piece = trial;
      }
      current = piece;
    };
    for (const word of words) pushWord(word);
    lines.push(current);
  }
  return lines.length ? lines : [''];
}

function buildPdf(images: Uint8Array[]): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let pos = 0;
  const offsets: number[] = [];

  const pushStr = (s: string) => {
    const b = enc.encode(s);
    chunks.push(b);
    pos += b.length;
  };
  const pushBytes = (b: Uint8Array) => {
    chunks.push(b);
    pos += b.length;
  };
  const startObj = (id: number) => {
    offsets[id] = pos;
    pushStr(`${id} 0 obj\n`);
  };

  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  const n = images.length;
  const pageIds = images.map((_, i) => 3 + i * 3);

  startObj(1);
  pushStr('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  startObj(2);
  pushStr(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${n} >>\nendobj\n`);

  images.forEach((jpeg, i) => {
    const pageId = 3 + i * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const { width, height } = jpegSize(jpeg);
    const content = `q ${A4_W} 0 0 ${A4_H} 0 0 cm /Im0 Do Q\n`;

    startObj(pageId);
    pushStr(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_W} ${A4_H}] /Contents ${contentId} 0 R /Resources << /XObject << /Im0 ${imageId} 0 R >> >> >>\nendobj\n`,
    );

    startObj(contentId);
    pushStr(`<< /Length ${enc.encode(content).length} >>\nstream\n${content}endstream\nendobj\n`);

    startObj(imageId);
    pushStr(
      `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    );
    pushBytes(jpeg);
    pushStr('\nendstream\nendobj\n');
  });

  const objectCount = 3 + n * 3;
  const xrefPos = pos;
  pushStr(`xref\n0 ${objectCount}\n0000000000 65535 f \n`);
  for (let id = 1; id < objectCount; id++) {
    pushStr(`${String(offsets[id] ?? 0).padStart(10, '0')} 00000 n \n`);
  }
  pushStr(`trailer\n<< /Size ${objectCount} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`);

  const merged = new Uint8Array(pos);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return new Blob([merged], { type: 'application/pdf' });
}

function jpegSize(bytes: Uint8Array): { width: number; height: number } {
  let i = 2;
  while (i < bytes.length - 9) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1]!;
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return {
        height: (bytes[i + 5]! << 8) | bytes[i + 6]!,
        width: (bytes[i + 7]! << 8) | bytes[i + 8]!,
      };
    }
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) {
      i += 2;
      continue;
    }
    const len = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (len < 2) break;
    i += 2 + len;
  }
  return { width: PAGE_W, height: PAGE_H };
}
