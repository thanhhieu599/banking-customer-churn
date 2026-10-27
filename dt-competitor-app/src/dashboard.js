
// ---------- Dashboard tổng hợp ----------
// Một màn hình điều hành: scorecard theo mục tiêu, chỉ số sức khoẻ cạnh tranh, heatmap CPM,
// xếp hạng mức nguy hiểm đối thủ, mật độ cạnh tranh theo nhóm hàng, dự báo doanh thu luỹ kế, cảnh báo.

function simulatePaths(p, n = 1200) {
  const wl = wlCalc(); const k0 = 10;
  const a = Math.max(0.5, p.priorWin * k0 + wl.won), b = Math.max(0.5, (1 - p.priorWin) * k0 + (wl.dec - wl.won));
  const sig = Math.sqrt(Math.log(1 + p.cv * p.cv)), mu = Math.log(Math.max(1, p.avgDeal)) - sig * sig / 2;
  const M = p.months; const cols = Array.from({ length: M }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    const wr = betaS(a, b); const shock = 1 + 0.08 * randn(); let tot = 0;
    for (let m = 0; m < M; m++) {
      tot += p.baseMonthly * shock * Math.max(0, 1 + p.baseCv * randn());
      const k = poisson(p.rfq);
      for (let q = 0; q < k; q++) if (Math.random() < wr) tot += Math.exp(mu + sig * randn());
      cols[m][i] = tot;
    }
  }
  return cols.map((c) => { c.sort(); const q = (x) => c[Math.min(n - 1, Math.floor(x * n))]; return { p10: q(0.1), p50: q(0.5), p90: q(0.9) }; });
}

function threatIndex() {
  const cp = cpmCalc(), mx = matrixCalc(), wl = wlCalc();
  const maxS = Math.max(...cp.scores, 0.01);
  return S.competitors.filter((c) => !isUs(c.name)).map((c) => {
    const j = cp.comps.findIndex((x) => sameName(x, c.name));
    const cpm = j >= 0 ? cp.scores[j] : null;
    const ov = mx.overlapOf(c.name);
    const tv = threatVal(c.threat);
    const lost = wl.byComp.find((x) => sameName(x.k, c.name));
    const logs = S.log.filter((l) => !l.example && sameName(l.comp, c.name)).length;
    // 0–100: sức mạnh CPM 35%, chồng lấn 25%, đánh giá đe doạ 25%, deal đã thua 10%, động thái gần đây 5%
    const parts = [
      [0.35, cpm != null ? cpm / maxS : null],
      [0.25, ov],
      [0.25, tv != null ? tv / 3 : null],
      [0.10, lost ? Math.min(1, lost.n / 3) : 0],
      [0.05, Math.min(1, logs / 3)],
    ].filter(([, v]) => v != null);
    const wsum = sum(parts.map(([w]) => w));
    const idx = wsum ? sum(parts.map(([w, v]) => w * v)) / wsum * 100 : 0;
    return { name: c.name, type: c.type, idx, cpm, ov, tv, threat: c.threat, lost: lost ? lost.n : 0, logs, partial: wsum < 0.95 };
  }).sort((a, b) => b.idx - a.idx);
}

function healthIndex() {
  const cp = cpmCalc(), wl = wlCalc(), ai = aiCalc(), s = S.settings;
  const pr = priceRows().map(priceRow).filter((c) => c.margin != null);
  const lead = cp.leader >= 0 ? Math.max(cp.scores[cp.leader], cp.us) : cp.us || 1;
  const comps = [
    { k: 'Vị thế CPM', w: 0.3, v: lead ? cp.us / lead : null, note: `${fmtN(cp.us, 2)} / ${fmtN(lead, 2)} của bên dẫn đầu` },
    { k: 'Tỷ lệ thắng', w: 0.25, v: wl.dec ? Math.min(1, wl.rate / Math.max(0.05, s.priorWin * 1.6)) : null, note: wl.dec ? `${fmtP(wl.rate)} thực tế` : 'chưa có deal thật' },
    { k: 'AI Share of Voice', w: 0.15, v: ai.us && ai.us.n ? Math.min(1, ai.us.sov / s.targetSov) : null, note: ai.us && ai.us.n ? `${fmtP(ai.us.sov)} / mục tiêu ${fmtP(s.targetSov)}` : 'chưa chấm' },
    { k: 'Sức khoẻ biên giá', w: 0.15, v: pr.length ? pr.filter((c) => !c.lowMargin).length / pr.length : null, note: pr.length ? `${pr.filter((c) => !c.lowMargin).length}/${pr.length} SKU đạt biên` : 'chưa có giá' },
  ];
  const known = comps.filter((c) => c.v != null); const wk = sum(known.map((c) => c.w));
  const score = wk ? sum(known.map((c) => c.w * c.v)) / wk * 100 : null;
  return { score, comps, coverage: sum(known.map((c) => c.w)) / sum(comps.map((c) => c.w)) };
}

function alertsList() {
  const out = []; const cp = cpmCalc(), wl = wlCalc(), ai = aiCalc(), s = S.settings;
  if (cp.ksf.length && Math.abs(cp.wsum - 1) > 0.001) out.push(['hi', 'Tổng trọng số CPM = ' + fmtP(cp.wsum, 1), 'Phải bằng 100%, điểm CPM đang sai lệch.', 'cpm']);
  const low = priceRows().filter((r) => priceRow(r).lowMargin);
  if (low.length) out.push(['hi', `${low.length} SKU biên dưới ${fmtP(s.margin)}`, low.slice(0, 3).map((r) => r.sku).join('; '), 'gia']);
  const old = wl.pipeline.filter((r) => r.date && (Date.now() - new Date(r.date).getTime()) / 864e5 > 14);
  if (old.length) out.push(['md', `${old.length} deal chờ kết quả quá 14 ngày`, 'Hỏi Purchasing kết quả và lý do, cập nhật Win-Loss.', 'winloss']);
  if (cp.leader >= 0 && cp.scores[cp.leader] > cp.us) out.push(['md', `${shortName(cp.comps[cp.leader])} dẫn CPM hơn D&T ${fmtN(cp.scores[cp.leader] - cp.us, 2)} điểm`, 'Xem kịch bản nâng điểm ở tầng Dự đoán.', null]);
  if (ai.us && ai.us.n && ai.us.sov < s.targetSov) out.push(['md', `AI Share of Voice ${fmtP(ai.us.sov)} dưới mục tiêu ${fmtP(s.targetSov)}`, ai.missed.length ? `${ai.missed.length} câu trả lời AI nhắc đối thủ mà bỏ qua D&T.` : '', 'ai']);
  const hiLog = S.log.filter((l) => !l.example && norm(l.impact).startsWith('cao') && !norm(l.status).startsWith('xong'));
  if (hiLog.length) out.push(['hi', `${hiLog.length} động thái đối thủ tác động cao chưa xử lý`, hiLog.slice(0, 2).map((l) => `${l.comp}: ${l.desc}`).join(' · '), 'nhatky']);
  const due = S.insights.filter((r) => r.due && /^\d{4}-\d{2}-\d{2}$/.test(r.due) && r.due < today() && r.status !== 'Xong');
  if (due.length) out.push(['hi', `${due.length} hành động quá hạn`, due.slice(0, 2).map((r) => r.insight).join(' · '), 'insight']);
  if (!wl.dec) out.push(['md', 'Chưa có deal Win-Loss thật', 'Tỷ lệ thắng và dự báo đang chạy bằng giả định.', 'winloss']);
  if (!ai.scored) out.push(['lo', 'Chưa đo AI Citation tháng này', 'Chạy bộ 15 prompt trên 4 nền tảng AI.', 'ai']);
  return out;
}

function viewDashboard() {
  const cp = cpmCalc(), wl = wlCalc(), ai = aiCalc(), mx = matrixCalc(), s = S.settings;
  const sim = simulate(s, 2000); const hi = healthIndex(); const ti = threatIndex(); const al = alertsList();
  const pr = priceRows().map((r) => ({ r, c: priceRow(r) }));
  const margins = pr.map((x) => x.c.margin).filter((x) => x != null);
  const avgMargin = margins.length ? sum(margins) / margins.length : null;
  const doneIns = S.insights.filter((r) => r.status === 'Xong').length;
  const st = (ok, warn) => ok ? '<span class="pill lo">Đạt</span>' : warn ? '<span class="pill md">Theo dõi</span>' : '<span class="pill hi">Chưa đạt</span>';
  const na = '<span class="pill">Chưa có dữ liệu</span>';
  const sc = [
    ['Điểm CPM D&T', fmtN(cp.us, 2), `Hạng ${cp.usRank}/${cp.comps.length} · mục tiêu hạng 1`, st(cp.usRank === 1, cp.usRank === 2)],
    ['Tỷ lệ thắng (số deal)', wl.dec ? fmtP(wl.rate) : '—', `${wl.won}/${wl.dec} deal · mục tiêu ≥ ${fmtP(Math.max(0.3, s.priorWin))}`, wl.dec ? st(wl.rate >= Math.max(0.3, s.priorWin), wl.rate >= s.priorWin * 0.8) : na],
    ['Tỷ lệ thắng (giá trị)', wl.dec ? fmtP(wl.rateVal) : '—', 'trọng tâm đơn 20–500 tr', wl.dec ? st(wl.rateVal >= 0.3, wl.rateVal >= 0.2) : na],
    ['Pipeline đang mở', fmtN(wl.pipeVal) + ' tr', `${wl.pipeline.length} deal chờ kết quả`, wl.pipeline.length ? st(wl.pipeVal >= s.avgDeal * 10, wl.pipeVal >= s.avgDeal * 4) : na],
    ['AI Share of Voice', ai.us && ai.us.n ? fmtP(ai.us.sov) : '—', `mục tiêu ${fmtP(s.targetSov)} · ${ai.scored} câu đã chấm`, ai.us && ai.us.n ? st(ai.us.sov >= s.targetSov, ai.us.sov >= s.targetSov / 2) : na],
    ['Biên LN TB (SKU có giá)', avgMargin != null ? fmtP(avgMargin, 1) : '—', `mục tiêu ${fmtP(s.margin)} · ${margins.length} SKU`, avgMargin != null ? st(avgMargin >= s.margin, avgMargin >= s.margin - 0.03) : na],
    ['Xác suất đạt ' + fmtTy(s.target, 0), fmtP(sim.pHit), `P50 ${fmtTy(sim.p50)} · theo giả định`, st(sim.pHit >= 0.7, sim.pHit >= 0.4)],
    ['Hành động hoàn thành', `${doneIns}/${S.insights.length}`, `${S.insights.filter((r) => r.status === 'Đang làm').length} đang làm`, st(S.insights.length && doneIns / S.insights.length >= 0.5, doneIns > 0)],
  ];
  const t = tok();
  const tentative = hi.coverage < 0.5;
  const hc = hi.score == null || tentative ? t.muted : hi.score >= 70 ? t.good : hi.score >= 50 ? t.warn : t.bad;
  const heat = (v) => { const x = +v || 0; return x >= 4 ? 'var(--good-soft)' : x >= 3 ? 'color-mix(in srgb, var(--good-soft) 45%, var(--surface))' : x >= 2 ? 'var(--warn-soft)' : 'var(--bad-soft)'; };
  const heatC = (v) => { const x = +v || 0; return x >= 3 ? 'var(--good)' : x >= 2 ? 'var(--warn)' : 'var(--bad)'; };
  const recent = S.log.filter((l) => !l.example).slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6);
  const months = {};
  wl.rows.forEach((r) => { if (!r.date) return; const m = String(r.date).slice(0, 7); months[m] = months[m] || { n: 0, won: 0, lost: 0, val: 0 }; months[m].n++; months[m].val += +r.value || 0; if (isWin(r)) months[m].won++; if (isLoss(r)) months[m].lost++; });
  UI._wlMonths = months;

  return head('Dashboard tổng hợp · ' + today(), 'Toàn cảnh cạnh tranh của D&T', 'Một màn hình cho CEO: chỉ số so với mục tiêu, sức khoẻ cạnh tranh, đối thủ nguy hiểm nhất, dự báo doanh thu và các cảnh báo cần xử lý. Tự cập nhật theo dữ liệu nhập.') +
    `<div class="dash-score">${sc.map(([l, v, sub, pill]) => `<div class="kpi"><div class="k-l">${esc(l)}</div><div class="k-v">${v}</div><div class="k-s">${esc(sub)}</div><div>${pill}</div></div>`).join('')}</div>` +
    `<div class="grid dash-3">
      ${panel('Chỉ số sức khoẻ cạnh tranh', '0–100 · tổng hợp có trọng số', `<div class="gauge"><div class="g-v" style="color:${hc}">${hi.score == null ? '—' : fmtN(hi.score)}</div><div class="g-l">${hi.score == null ? 'Chưa đủ dữ liệu' : tentative ? '<b>Tạm tính</b>, chưa đủ dữ liệu để kết luận' : hi.score >= 70 ? 'Vị thế tốt' : hi.score >= 50 ? 'Cạnh tranh ngang ngửa' : 'Đang yếu thế'} · dữ liệu phủ ${fmtP(hi.coverage)} trọng số</div></div>
        <div class="bars">${hi.comps.map((c) => `<div class="bar-row"><span class="bl" title="${esc(c.note)}">${esc(c.k)} <span class="muted">(${fmtP(c.w)})</span></span><div class="bt"><div class="bf${c.v != null && c.v < 0.6 ? ' acc' : ''}" style="width:${c.v == null ? 0 : (c.v * 100).toFixed(0)}%"></div></div><span class="num" style="text-align:right">${c.v == null ? '—' : fmtN(c.v * 100)}</span></div>`).join('')}</div>
        <p class="note">Thành phần chưa có dữ liệu được bỏ khỏi phép tính, nên chỉ số sẽ thay đổi khi anh nhập Win-Loss, giá và AI Citation.</p>`)}
      ${panel('D&T so với thị trường', 'Điểm 1–4 theo tiêu chí mua hàng FDI', box('dRadar', 'Radar D&T, trung bình thị trường và bên dẫn đầu', 'tall'))}
      ${panel('Cảnh báo cần xử lý', `${al.filter((a) => a[0] === 'hi').length} mức cao`, al.length ? `<div class="recs">${al.map(([lv, ti2, d, tab]) => `<div class="rec ${lv === 'hi' ? 'p1' : lv === 'md' ? 'p2' : 'p3'}"><div class="sev"></div><div><div class="r-t">${esc(ti2)}</div>${d ? `<div class="r-w">${esc(d)}</div>` : ''}${tab ? `<div class="r-meta">${goData(tab, 'Xử lý')}</div>` : ''}</div></div>`).join('')}</div>` : emptyBox('Không có cảnh báo', 'Mọi chỉ số đang trong ngưỡng.'))}
    </div>` +
    `<div class="grid g-wide">
      ${panel('Dự báo doanh thu luỹ kế', `Vùng P10–P90 · mục tiêu ${fmtTy(s.target, 0)}/năm`, box('dFan', 'Dự báo doanh thu luỹ kế theo tháng', 'tall') + `<p class="note">Đường đứt = tiến độ cần đạt đều mỗi tháng. Giả định: ${fmtN(s.baseMonthly)} tr/tháng định kỳ, ${s.rfq} RFQ/tháng × ${fmtN(s.avgDeal)} tr, tỷ lệ thắng ${fmtP(sim.winMean)}. Chỉnh ở tầng Dự đoán.</p>`)}
      ${panel('Đối thủ nguy hiểm nhất', 'Chỉ số đe doạ 0–100', `<div class="bars">${ti.slice(0, 10).map((x) => `<div class="bar-row"><span class="bl" title="${esc(x.name)}">${esc(shortName(x.name))}</span><div class="bt"><div class="bf${x.idx >= 70 ? ' acc' : ''}" style="width:${x.idx.toFixed(0)}%"></div></div><span class="num" style="text-align:right">${fmtN(x.idx)}${x.partial ? '*' : ''}</span></div>`).join('')}</div>
        <p class="note">Tổng hợp: sức mạnh CPM 35%, chồng lấn danh mục 25%, mức đe doạ đánh giá 25%, số deal đã thua 10%, động thái gần đây 5%. * = thiếu điểm CPM, tính trên phần có dữ liệu.</p>`)}
    </div>` +
    panel('Heatmap CPM: ai mạnh ở đâu', 'Xanh = mạnh · đỏ = yếu · cột D&T tô đậm', `<div class="tbl-wrap"><table class="heat"><thead><tr><th>Tiêu chí</th><th class="n">Trọng số</th>${cp.comps.map((c, j) => `<th class="n${j === cp.usIdx ? ' usc' : ''}">${esc(shortName(c))}</th>`).join('')}<th class="n">Gap</th></tr></thead><tbody>
      ${cp.ksf.map((k, i) => `<tr><td>${esc(k.name.split('(')[0].trim())}</td><td class="n">${fmtP(+k.w)}</td>${k.s.map((v, j) => `<td class="n hc${j === cp.usIdx ? ' usc' : ''}" style="background:${heat(v)};color:${heatC(v)}">${v}</td>`).join('')}<td class="n" style="color:${cp.gaps[i].gap < 0 ? 'var(--bad)' : cp.gaps[i].gap > 0 ? 'var(--good)' : 'var(--muted)'}">${cp.gaps[i].gap > 0 ? '+' : ''}${cp.gaps[i].gap}</td></tr>`).join('')}
      <tr class="tot"><td><b>Điểm có trọng số</b></td><td class="n">${fmtP(cp.wsum)}</td>${cp.scores.map((x, j) => `<td class="n${j === cp.usIdx ? ' usc' : ''}"><b>${fmtN(x, 2)}</b></td>`).join('')}<td></td></tr>
      <tr><td class="muted">Xếp hạng</td><td></td>${cp.comps.map((_, j) => `<td class="n muted${j === cp.usIdx ? ' usc' : ''}">#${cp.rankOf(j)}</td>`).join('')}<td></td></tr>
    </tbody></table></div>`) +
    `<div class="grid g2">
      ${panel('Mật độ cạnh tranh theo nhóm hàng', 'Số đối thủ mạnh / mỏng / không có / chưa rõ', box('dDensity', 'Mật độ cạnh tranh theo nhóm hàng', 'tall'))}
      ${panel('Định vị giá', `${pr.filter((x) => x.c.pos).length}/${pr.length} SKU đủ dữ liệu`, pr.some((x) => x.c.pos) ? box('dPricePos', 'Phân bố vị thế giá', 'tall') : emptyBox('Chưa có giá đối thủ', 'Nhập giá D&T, giá vốn và ít nhất 1 giá đối thủ cho mỗi SKU.', goData('gia', 'Nhập giá')))}
    </div>` +
    `<div class="grid g3">
      ${panel('Win-Loss theo tháng', '', Object.keys(months).length ? box('dWlTrend', 'Số deal thắng thua theo tháng') : emptyBox('Chưa có deal có ngày', 'Nhập deal kèm ngày để xem xu hướng.', goData('winloss', 'Nhập deal')))}
      ${panel('AI Share of Voice theo nền tảng', '', ai.scored ? box('dAiPf', 'AI Share of Voice D&T theo nền tảng') : emptyBox('Chưa chấm AI Citation', 'Mỗi tháng hỏi 15 prompt trên ChatGPT, Gemini, Perplexity, AI Overview.', goData('ai', 'Chấm AI')))}
      ${panel('Tiến độ hành động', `${S.insights.length} insight`, box('dIns', 'Trạng thái các hành động'))}
    </div>` +
    `<div class="grid g2">
      ${panel('Phân bố đối thủ', `${ti.length} đơn vị`, box('dMix', 'Phân bố đối thủ theo loại'))}
      ${panel('Động thái đối thủ gần đây', 'Từ Nhật ký theo dõi', recent.length ? `<div class="tbl-wrap"><table><thead><tr><th>Ngày</th><th>Đối thủ</th><th>Thay đổi</th><th>Tác động</th></tr></thead><tbody>${recent.map((l) => `<tr><td class="n">${esc(l.date)}</td><td>${esc(l.comp)}</td><td>${esc(l.kind)}: ${esc(l.desc)}</td><td>${threatPill(l.impact)}</td></tr>`).join('')}</tbody></table></div>` : emptyBox('Chưa ghi động thái nào', 'Ghi mọi thay đổi quan sát được: giá, sản phẩm mới, chiến dịch, nhân sự, thắng thầu, SEO.', goData('nhatky', 'Ghi nhật ký')))}
    </div>`;
}

function chartsDashboard() {
  const t = tok(); const cp = cpmCalc(); const s = S.settings;
  const others = cp.comps.map((_, j) => j).filter((j) => j !== cp.usIdx);
  mkChart('dRadar', { type: 'radar', data: { labels: cp.ksf.map((k) => wrapLabel(k.name.split('(')[0].split('/')[0].trim(), 16)), datasets: [
    { label: 'D&T', data: cp.ksf.map((k) => +k.s[cp.usIdx]), borderColor: t.brand, backgroundColor: alpha(t.brand, 0.18), pointBackgroundColor: t.brand },
    { label: 'TB thị trường', data: cp.ksf.map((k) => +(sum(others.map((j) => +k.s[j])) / (others.length || 1)).toFixed(2)), borderColor: t.grey, backgroundColor: 'transparent', borderDash: [4, 3], pointRadius: 2 },
    ...(cp.leader >= 0 ? [{ label: shortName(cp.comps[cp.leader]), data: cp.ksf.map((k) => +k.s[cp.leader]), borderColor: t.accent, backgroundColor: 'transparent', pointBackgroundColor: t.accent }] : [])] },
    options: { plugins: { legend: { position: 'bottom' } }, scales: { r: { min: 0, max: 4, ticks: { stepSize: 1, backdropColor: 'transparent' }, grid: { color: t.line }, angleLines: { color: t.line }, pointLabels: { font: { size: 10 }, color: t.muted } } } } });

  const fan = simulatePaths(s, 1200); const labels = fan.map((_, m) => 'T' + (m + 1));
  mkChart('dFan', { type: 'line', data: { labels, datasets: [
    { label: 'P90', data: fan.map((x) => +(x.p90 / 1000).toFixed(2)), borderColor: 'transparent', backgroundColor: alpha(t.brand, 0.15), fill: '+1', pointRadius: 0 },
    { label: 'P10', data: fan.map((x) => +(x.p10 / 1000).toFixed(2)), borderColor: 'transparent', backgroundColor: 'transparent', pointRadius: 0 },
    { label: 'Trung vị (P50)', data: fan.map((x) => +(x.p50 / 1000).toFixed(2)), borderColor: t.brand, backgroundColor: t.brand, pointRadius: 2, tension: 0.2 },
    { label: 'Tiến độ mục tiêu', data: fan.map((_, m) => +(s.target * (m + 1) / s.months / 1000).toFixed(2)), borderColor: t.accent, borderDash: [6, 4], pointRadius: 0 }] },
    options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { filter: (i) => i.text !== 'P10' } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmtN(c.raw, 1)} tỷ` } } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'Tỷ VNĐ luỹ kế' }, grid: { color: t.line } }, x: { grid: { display: false } } } } });

  const mx = matrixCalc(); const others2 = mx.rows.filter((r) => r !== mx.usRow);
  const cnt = (sym) => mx.cats.map((_, j) => others2.filter((r) => r.v[j] === sym).length);
  mkChart('dDensity', { type: 'bar', data: { labels: mx.cats, datasets: [
    { label: 'Mạnh ●', data: cnt('●'), backgroundColor: t.bad, borderRadius: 2 },
    { label: 'Mỏng ◐', data: cnt('◐'), backgroundColor: t.warn, borderRadius: 2 },
    { label: 'Không có ○', data: cnt('○'), backgroundColor: alpha(t.good, 0.7), borderRadius: 2 },
    { label: 'Chưa rõ ?', data: cnt('?'), backgroundColor: alpha(t.grey, 0.45), borderRadius: 2 }] },
    options: { indexAxis: 'y', plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { afterTitle: (c) => { const u = mx.usRow ? mx.usRow.v[c[0].dataIndex] : ''; return 'D&T: ' + u; } } } }, scales: { x: { stacked: true, ticks: { precision: 0 }, grid: { color: t.line } }, y: { stacked: true, grid: { display: false }, ticks: { autoSkip: false, font: { size: 11 } } } } } });

  const pr = priceRows().map(priceRow).filter((c) => c.pos);
  if (pr.length) {
    const cats = ['Thấp hơn TT', 'Ngang thị trường', 'Cao hơn TT >5%'];
    mkChart('dPricePos', { type: 'doughnut', data: { labels: cats, datasets: [{ data: cats.map((c) => pr.filter((x) => x.pos === c).length), backgroundColor: [t.good, t.brand, t.bad], borderColor: t.surface }] }, options: { cutout: '62%', plugins: { legend: { position: 'bottom' } } } });
  }
  const months = UI._wlMonths || {}; const ms = Object.keys(months).sort();
  if (ms.length) mkChart('dWlTrend', { type: 'bar', data: { labels: ms, datasets: [
    { label: 'Thắng', data: ms.map((m) => months[m].won), backgroundColor: t.good, borderRadius: 2, stack: 'a' },
    { label: 'Thua', data: ms.map((m) => months[m].lost), backgroundColor: t.bad, borderRadius: 2, stack: 'a' },
    { label: 'Đang chờ', data: ms.map((m) => months[m].n - months[m].won - months[m].lost), backgroundColor: alpha(t.grey, 0.5), borderRadius: 2, stack: 'a' }] },
    options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { stacked: true, ticks: { precision: 0 }, grid: { color: t.line } }, x: { stacked: true, grid: { display: false } } } } });
  const ai = aiCalc();
  if (ai.scored && ai.usJ >= 0) {
    const pf = {}; S.ai.rows.forEach((r) => { const v = r.v[ai.usJ]; if (v !== 0 && v !== 1) return; const k = r.platform || 'Chưa ghi'; pf[k] = pf[k] || { n: 0, hit: 0 }; pf[k].n++; pf[k].hit += v; });
    const ks = Object.keys(pf);
    mkChart('dAiPf', { type: 'bar', data: { labels: ks, datasets: [{ data: ks.map((k) => +(pf[k].hit / pf[k].n * 100).toFixed(0)), backgroundColor: t.brand, borderRadius: 3 }] }, options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.raw}% (${pf[ks[c.dataIndex]].hit}/${pf[ks[c.dataIndex]].n})` } } }, scales: { y: { max: 100, ticks: { callback: (v) => v + '%' }, grid: { color: t.line } }, x: { grid: { display: false } } } } });
  }
  const stt = ['Chưa làm', 'Đang làm', 'Xong', 'Tạm dừng'];
  mkChart('dIns', { type: 'doughnut', data: { labels: stt, datasets: [{ data: stt.map((x) => S.insights.filter((r) => (r.status || 'Chưa làm') === x).length), backgroundColor: [alpha(t.grey, 0.5), t.accent, t.good, t.bad], borderColor: t.surface }] }, options: { cutout: '62%', plugins: { legend: { position: 'bottom' } } } });
  const comps = S.competitors.filter((c) => !isUs(c.name)); const types = [...new Set(comps.map((c) => c.type || '—'))];
  const pal = [t.brand, t.accent, t.bad, t.good, t.warn, t.grey, alpha(t.brand, 0.5), alpha(t.accent, 0.5)];
  mkChart('dMix', { type: 'doughnut', data: { labels: types, datasets: [{ data: types.map((x) => comps.filter((c) => (c.type || '—') === x).length), backgroundColor: types.map((_, i) => pal[i % pal.length]), borderColor: t.surface }] }, options: { cutout: '58%', plugins: { legend: { position: 'right' } } } });
}
