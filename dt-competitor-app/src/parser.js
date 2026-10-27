// Đọc file Excel mẫu "Phan_tich_doi_thu_DT.xlsx" (SheetJS) thành dữ liệu cho app.
// Dò theo dòng tiêu đề nên vẫn chạy khi anh chèn thêm dòng/cột ghi chú.
function dtNorm(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();
}
function dtCell(v) {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'string') return v.trim();
  return v;
}
function dtNum(v) {
  if (v === '' || v == null) return null;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[^\d.\-]/g, ''));
  return isFinite(n) && String(v).trim() !== '' ? n : null;
}
function dtYN(v) { const s = dtNorm(v); return s === 'y' || s === 'yes' || s === 'co' || s === '1' ? 'Y' : (s === 'n' || s === 'no' || s === 'khong' || s === '0' ? 'N' : ''); }

function parseDTWorkbook(XLSX, wb) {
  const sheet = (key) => {
    const name = wb.SheetNames.find(n => dtNorm(n).replace(/[^a-z]/g, '') === key.replace(/[^a-z]/g, ''))
      || wb.SheetNames.find(n => dtNorm(n).includes(key));
    if (!name) return null;
    return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: true, blankrows: true });
  };
  const hdr = (rows, test) => rows ? rows.findIndex(r => r && test(dtNorm(r[0]), r)) : -1;
  const out = {}; const found = [];

  // 1. Danh sách đối thủ
  let R = sheet('danh sach doi thu'); let h = hdr(R, c => c === 'id');
  if (h >= 0) {
    out.competitors = [];
    for (let i = h + 1; i < R.length; i++) {
      const r = R[i] || []; if (!r[1]) continue;
      out.competitors.push({ id: dtCell(r[0]), name: dtCell(r[1]), web: dtCell(r[2]), type: dtCell(r[3]), overlap: dtCell(r[4]),
        region: dtCell(r[5]), year: dtCell(r[6]), model: dtCell(r[7]), usp: dtCell(r[8]), threat: dtCell(r[9]), why: dtCell(r[10]), source: dtCell(r[11]) });
    }
    found.push('Danh sách đối thủ');
  }

  // 2. Ma trận sản phẩm
  R = sheet('ma tran san pham'); h = hdr(R, (c, r) => c === 'doi thu' && r.length > 5);
  if (h >= 0) {
    const head = R[h]; let end = head.findIndex((x, j) => j > 0 && dtNorm(x).startsWith('so nganh'));
    if (end < 0) end = head.length;
    const cats = head.slice(1, end).map(dtCell);
    const rows = [];
    for (let i = h + 1; i < R.length; i++) {
      const r = R[i] || []; const n = dtNorm(r[0]);
      if (!n || n.startsWith('ghi chu')) { if (n.startsWith('ghi chu')) break; continue; }
      rows.push({ name: dtCell(r[0]), v: cats.map((_, j) => { const x = dtCell(r[j + 1]); return ['●', '◐', '○', '?'].includes(x) ? x : (x ? String(x) : '?'); }) });
    }
    out.matrix = { cats, rows }; found.push('Ma trận sản phẩm');
  }

  // 3. CPM
  R = sheet('cpm cham diem'); h = hdr(R, c => c.startsWith('yeu to'));
  if (h >= 0) {
    const head = R[h]; let end = head.findIndex((x, j) => j > 1 && dtNorm(x).startsWith('doi thu tot'));
    if (end < 0) end = head.length;
    const comps = head.slice(2, end).map(dtCell);
    const noteCol = head.findIndex(x => dtNorm(x).startsWith('can cu'));
    const ksf = [];
    for (let i = h + 1; i < R.length; i++) {
      const r = R[i] || []; const n = dtNorm(r[0]);
      if (!n) continue; if (n.startsWith('kiem tra') || n.startsWith('diem co')) break;
      ksf.push({ name: dtCell(r[0]), w: dtNum(r[1]) || 0, s: comps.map((_, j) => dtNum(r[j + 2]) || 0), note: noteCol >= 0 ? dtCell(r[noteCol]) : '' });
    }
    out.cpm = { comps, ksf }; found.push('CPM');
  }

  // 4. Giá benchmark
  R = sheet('gia benchmark'); h = hdr(R, c => c === 'nhom');
  if (h >= 0) {
    out.prices = [];
    for (let i = h + 1; i < R.length; i++) {
      const r = R[i] || []; const n = dtNorm(r[0]);
      if (n.startsWith('cach doc')) break; if (!r[1]) continue;
      const ex = n === 'vi du';
      out.prices.push({ grp: ex ? '' : dtCell(r[0]), sku: dtCell(r[1]), std: dtCell(r[2]), unit: dtCell(r[3]), p: dtNum(r[4]), cost: dtNum(r[5]),
        c1: dtNum(r[7]), c2: dtNum(r[8]), c3: dtNum(r[9]), lt: dtNum(r[14]), src: dtCell(r[15]), example: ex });
    }
    found.push('Giá benchmark');
  }

  // 5. Digital-SEO
  R = sheet('digital-seo') || sheet('digital seo'); h = hdr(R, (c, r) => c === 'doi thu' && dtNorm(r[1]) === 'domain');
  if (h >= 0) {
    out.seo = [];
    for (let i = h + 1; i < R.length; i++) {
      const r = R[i] || []; if (!r[0]) continue; const ex = dtNorm(r[0]).startsWith('vi du');
      out.seo.push({ name: dtCell(r[0]), domain: dtCell(r[1]), dr: dtNum(r[2]), traffic: dtNum(r[3]), kw: dtNum(r[4]), top5: dtCell(r[5]),
        blogs: dtNum(r[6]), newpm: dtNum(r[7]), std: dtYN(r[8]), faq: dtYN(r[9]), en: dtYN(r[10]), ads: dtYN(r[11]), zalo: dtYN(r[12]),
        li: dtYN(r[13]), catalog: dtYN(r[14]), fb: dtNum(r[15]), note: dtCell(r[17]), example: ex });
    }
    found.push('Digital-SEO');
  }

  // 6. AI Citation
  R = sheet('ai citation'); h = hdr(R, (c, r) => c === '#' && dtNorm(r[1]).startsWith('prompt'));
  if (h >= 0) {
    const head = R[h]; let end = head.findIndex((x, j) => j > 3 && dtNorm(x).startsWith('nguon'));
    if (end < 0) end = head.length;
    const brands = head.slice(4, end).map(dtCell);
    const rows = [];
    for (let i = h + 1; i < R.length; i++) {
      const r = R[i] || []; const p = dtNorm(r[1]);
      if (p.startsWith('ai share') || p.startsWith('so cau')) break; if (!r[1]) continue;
      rows.push({ n: dtCell(r[0]), prompt: dtCell(r[1]), platform: dtCell(r[2]), date: dtCell(r[3]),
        v: brands.map((_, j) => { const x = dtNum(r[j + 4]); return x === 1 ? 1 : (x === 0 ? 0 : null); }), url: dtCell(r[end]), note: dtCell(r[end + 1]) });
    }
    out.ai = { brands, rows }; found.push('AI Citation');
  }

  // 7. Win-Loss
  R = sheet('win-loss') || sheet('win loss'); h = hdr(R, (c, r) => c === 'ngay' && dtNorm(r[1]).startsWith('khach'));
  if (h >= 0) {
    out.winloss = [];
    for (let i = h + 1; i < R.length; i++) {
      const r = R[i] || []; if (!r[1]) continue; const ex = dtNorm(r[0]) === 'vi du';
      out.winloss.push({ date: ex ? '' : dtCell(r[0]), customer: dtCell(r[1]), industry: dtCell(r[2]), form: dtCell(r[3]), product: dtCell(r[4]),
        owner: dtCell(r[5]), value: dtNum(r[6]), result: dtCell(r[7]), winner: dtCell(r[8]), gap: dtNum(r[9]), reason: dtCell(r[10]), lesson: dtCell(r[11]), example: ex });
    }
    found.push('Win-Loss');
  }

  // 8. SWOT + Insight
  R = sheet('swot-insight') || sheet('swot');
  if (R) {
    const split = (t) => String(t || '').split(/\n/).map(x => x.replace(/^[\s•\-–]+/, '').trim()).filter(Boolean);
    const s = hdr(R, c => c.startsWith('diem manh')); const o = hdr(R, c => c.startsWith('co hoi'));
    if (s >= 0 && o >= 0) {
      const w = R[s].findIndex((x, j) => j > 0 && dtNorm(x).startsWith('diem yeu'));
      const t = R[o].findIndex((x, j) => j > 0 && dtNorm(x).startsWith('thach thuc'));
      out.swot = { S: split(R[s + 1][0]), W: split(R[s + 1][w]), O: split(R[o + 1][0]), T: split(R[o + 1][t]) };
    }
    h = hdr(R, (c, r) => c === '#' && dtNorm(r[1]) === 'insight');
    if (h >= 0) {
      out.insights = [];
      for (let i = h + 1; i < R.length; i++) {
        const r = R[i] || []; if (!r[1]) continue;
        out.insights.push({ n: dtCell(r[0]), insight: dtCell(r[1]), evidence: dtCell(r[2]), implication: dtCell(r[3]), action: dtCell(r[4]), kpi: dtCell(r[5]),
          i: dtNum(r[6]) || 3, c: dtNum(r[7]) || 3, e: dtNum(r[8]) || 3, owner: dtCell(r[10]), due: dtCell(r[11]), status: 'Chưa làm' });
      }
    }
    found.push('SWOT-Insight');
  }

  // 9. Nhật ký
  R = sheet('nhat ky theo doi'); h = hdr(R, (c, r) => c === 'ngay' && dtNorm(r[1]) === 'doi thu');
  if (h >= 0) {
    out.log = [];
    for (let i = h + 1; i < R.length; i++) {
      const r = R[i] || []; if (!r[1]) continue; const ex = dtNorm(r[0]) === 'vi du';
      out.log.push({ date: ex ? '' : dtCell(r[0]), comp: dtCell(r[1]), kind: dtCell(r[2]), desc: dtCell(r[3]), src: dtCell(r[4]), impact: dtCell(r[5]),
        response: dtCell(r[6]), owner: dtCell(r[7]), status: dtCell(r[8]), example: ex });
    }
    found.push('Nhật ký');
  }
  return { data: out, found };
}
if (typeof module !== 'undefined') module.exports = { parseDTWorkbook };
