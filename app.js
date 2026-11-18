/* AI lunch · the app: a stage for the laptop, and a phone view for everyone else. */
(function () {
  'use strict';
  var C = window.CONTENT, T = window.TEK || {}, L = window.Live;
  var STEPS = C.STEPS, CARDS = {}, QBY = {};
  C.CARDS.forEach(function (c) { CARDS[c.id] = c; });
  C.QUADRANTS.forEach(function (q) { QBY[q.id] = q; });
  var LETTERS = ['A', 'B', 'C', 'D'];
  var RUSTIG = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ================= small helpers ================= */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function tek(name) { return T[name] || ''; }
  function idx(id) { for (var i = 0; i < STEPS.length; i++) if (STEPS[i].id === id) return i; return -1; }
  function fmt(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function parse(v, d) { try { var x = JSON.parse(v); return x == null ? d : x; } catch (e) { return d; } }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  var toastTimer;
  function toast(t) { var e = $('toast'); e.textContent = t; e.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { e.hidden = true; }, 2600); }
  function copy(text, ok) {
    function fallback() {
      var a = document.createElement('textarea'); a.value = text; a.style.position = 'fixed'; a.style.opacity = '0'; document.body.appendChild(a); a.select();
      try { document.execCommand('copy'); toast(ok || 'Copied'); } catch (e) { toast('Copying did not work here'); }
      document.body.removeChild(a);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast(ok || 'Copied'); }, fallback);
    else fallback();
  }
  function download(name, text) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function qrSvg(text) {
    try {
      var q = window.qrcode(0, 'M'); q.addData(text); q.make();
      var n = q.getModuleCount(), d = '';
      for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (q.isDark(y, x)) d += 'M' + x + ' ' + y + 'h1v1h-1z';
      return '<svg viewBox="-2 -2 ' + (n + 4) + ' ' + (n + 4) + '" role="img" aria-label="QR code to join" shape-rendering="crispEdges"><rect x="-2" y="-2" width="' + (n + 4) + '" height="' + (n + 4) + '" fill="#fff"/><path d="' + d + '" fill="#1D2B2A"/></svg>';
    } catch (e) { return ''; }
  }
  function joinUrl(code) { return location.origin + location.pathname + '#j-' + code; }
  function ring(cls) {
    return '<svg class="ring ' + (cls || '') + '" viewBox="0 0 36 36" aria-hidden="true"><circle class="track" cx="18" cy="18" r="15"/>' +
      '<circle class="arc" cx="18" cy="18" r="15" pathLength="100" transform="rotate(-90 18 18)" style="stroke-dashoffset:100"/>' +
      '<line class="hand" x1="18" y1="18" x2="18" y2="7"/><circle class="hub" cx="18" cy="18" r="1.4"/></svg>';
  }
  function setRing(root, part, turned) {
    var a = root.querySelector('.arc'), h = root.querySelector('.hand');
    if (a) a.style.strokeDashoffset = String(100 - Math.max(0, Math.min(1, part)) * 100);
    if (h) h.style.transform = 'rotate(' + turned + 'deg)';
  }
  function confetti() {
    if (RUSTIG) return;
    var c = document.createElement('div'), cols = ['#00A99D', '#E07B2E', '#7E5BB5', '#2F6FAE', '#B38609'];
    c.className = 'confetti';
    for (var i = 0; i < 40; i++) {
      var p = document.createElement('i');
      p.style.left = Math.random() * 100 + '%'; p.style.background = cols[i % cols.length];
      p.style.animationDelay = Math.random() * .5 + 's'; p.style.transform = 'rotate(' + Math.round(Math.random() * 360) + 'deg)';
      c.appendChild(p);
    }
    document.body.appendChild(c); setTimeout(function () { c.remove(); }, 3200);
  }
  function flash(e) { if (!e || RUSTIG) return; e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); }
  function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  function bars(rows, total, opts) {
    opts = opts || {};
    var h = '<div class="bars' + (opts.reveal ? ' reveal' : '') + '">', best = 0;
    rows.forEach(function (r) { if (r.n > best) best = r.n; });
    rows.forEach(function (r) {
      var pct = total ? Math.round(r.n / total * 100) : 0;
      h += '<div class="bar' + (r.n && r.n === best ? ' best' : '') + '" style="--c:' + (r.col || 'var(--teal)') + '"><span class="lbl">' + (r.pre || '') + '<span>' + esc(r.label) + '</span></span>' +
        '<span class="n">' + (opts.pct ? pct + '%' : r.n) + '</span><span class="track"><i style="width:' + (r.n ? Math.max(2, opts.pct ? (total ? r.n / total * 100 : 0) : r.n / Math.max(best, 1) * 100) : 0) + '%"></i></span></div>';
    });
    return h + '</div>';
  }
  function seats(n, total, popLast) {
    var h = '<div class="seats" aria-hidden="true">', max = Math.max(total, n);
    for (var i = 0; i < max && i < 40; i++) h += '<i class="' + (i < n ? 'on' : '') + (popLast && i === n - 1 ? ' pop' : '') + '"></i>';
    return h + '</div>';
  }

  /* ================= reading the room ================= */
  function normWord(s) {
    return String(s || '').replace(/\s+/g, ' ').trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').slice(0, 40);
  }
  function quadOf(x, y) { return (y >= 50 ? (x >= 50 ? 'pi' : 'be') : (x >= 50 ? 'te' : 'gu')); }
  function points() {
    var by = {};
    L.items(idx('matrix'), 'xy').forEach(function (it) {
      var p = it.v.split(','), x = +p[0], y = +p[1];
      if (isFinite(x) && isFinite(y)) by[it.c] = { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)), c: it.c, mine: it.mine };
    });
    return by;
  }
  function wordList(colourByQuad) {
    var map = {}, pts = colourByQuad ? points() : null;
    L.items(idx('words'), 'w').forEach(function (it) {
      var t = normWord(it.v), k = t.toLowerCase(); if (!k) return;
      var w = map[k] || (map[k] = { key: k, text: t, count: 0, ids: [], who: {}, q: {} });
      w.count++; w.ids.push(it.id); w.who[it.c] = 1;
      if (pts && pts[it.c]) { var q = quadOf(pts[it.c].x, pts[it.c].y); w.q[q] = (w.q[q] || 0) + 1; }
    });
    var list = Object.keys(map).map(function (k) { return map[k]; });
    list.sort(function (a, b) { return b.count - a.count || (a.key < b.key ? -1 : 1); });
    list.forEach(function (w, i) {
      if (colourByQuad) {
        var best = null; Object.keys(w.q).forEach(function (q) { if (!best || w.q[q] > w.q[best]) best = q; });
        w.col = best ? QBY[best].col : 'var(--soft)';
      } else w.col = i < 3 ? 'var(--teal-ink)' : (i % 3 === 0 ? 'var(--teal)' : 'var(--ink)');
    });
    return list;
  }
  function wordsOf(c) {
    var seen = {};
    return L.items(idx('words'), 'w').filter(function (it) { return it.c === c; }).map(function (it) { return normWord(it.v); })
      .filter(function (w) { var k = w.toLowerCase(); if (!w || seen[k]) return false; seen[k] = 1; return true; });
  }
  function cardAt(i) { var v = L.hostValue(i, 'pick'); return CARDS[v] || CARDS[STEPS[i].card]; }
  function votesAt(i, card) {
    var out = { counts: [0, 0, 0, 0], total: 0, by: {} };
    L.items(i, 'vote').forEach(function (it) {
      var p = it.v.split(':'); if (p[0] !== card.id) return;
      var k = +p[1]; if (!(k >= 0 && k < card.opts.length)) return;
      out.counts[k]++; out.total++; out.by[it.c] = k;
    });
    return out;
  }
  function reasonsAt(i, card) {
    return L.items(i, 'why').map(function (it) { var o = parse(it.v, null); return o && o.c === card.id && o.t ? { id: it.id, c: it.c, t: o.t, mine: it.mine } : null; }).filter(Boolean);
  }
  function groupInfo() {
    var g = parse(L.hostValue(idx('groups'), 'groups'), null);
    return g && g.m ? g : { n: 0, m: {} };
  }
  function groupOf(c) { var g = groupInfo(); return g.m[c] == null ? -1 : g.m[c]; }
  function ideas() {
    return L.items(idx('ideas'), 'idea').map(function (it) {
      var o = parse(it.v, null); if (!o || !o.t) return null;
      return { id: it.id, g: +o.g, t: o.t, w: o.w || '', mine: it.mine, c: it.c };
    }).filter(Boolean);
  }
  function dotTally() {
    var t = {}, voters = 0;
    L.items(idx('rank'), 'dots').forEach(function (it) {
      var l = parse(it.v, []); if (!l.length) return; voters++;
      l.slice(0, 3).forEach(function (id) { t[id] = (t[id] || 0) + 1; });
    });
    return { t: t, voters: voters };
  }
  function ranked() {
    var d = dotTally(), list = ideas().map(function (x) { x.dots = d.t[x.id] || 0; return x; });
    list.sort(function (a, b) { return b.dots - a.dots || a.t.localeCompare(b.t); });
    return { list: list, voters: d.voters };
  }
  function gName(g) { return g >= 0 && C.GROUPS[g] ? C.GROUPS[g][0] : 'No group yet'; }
  function gCol(g) { return g >= 0 && C.GROUPS[g] ? C.GROUPS[g][1] : '#7A8C8A'; }
  function respondents(i, kinds) {
    var who = {};
    kinds.forEach(function (k) { L.items(i, k).forEach(function (it) { who[it.c] = 1; }); });
    return Object.keys(who).length;
  }
  function maxLevel(st) {
    return { words: 1, matrix: 1, using: 1, card: 2, ideas: 1, rank: 1, close: 1 }[st.type] || 0;
  }

  /* ================= word cloud ================= */
  var mctx = null;
  function measure(text) {
    mctx = mctx || document.createElement('canvas').getContext('2d');
    mctx.font = '600 100px "Zilla Slab", Georgia, serif';
    return mctx.measureText(text).width / 100;
  }
  function layoutCloud(list) {
    var W = 1000, H = 560, placed = [], out = [];
    if (!list.length) return out;
    var n = list.length, max = list[0].count;
    var hi = n <= 3 ? 130 : n <= 8 ? 104 : n <= 20 ? 86 : n <= 40 ? 70 : 58, lo = n > 45 ? 18 : n > 25 ? 22 : 28;
    if (max === 1) hi = Math.min(hi, n <= 6 ? 76 : 48);
    function free(r) {
      if (r.x < 0 || r.y < 0 || r.x + r.w > W || r.y + r.h > H) return false;
      for (var i = 0; i < placed.length; i++) { var p = placed[i]; if (r.x < p.x + p.w && r.x + r.w > p.x && r.y < p.y + p.h && r.y + r.h > p.y) return false; }
      return true;
    }
    list.forEach(function (w, i) {
      var fs = lo + (hi - lo) * Math.sqrt(w.count / max);
      for (var k = 0; k < 5; k++) {
        var ww = measure(w.text) * fs + 14, hh = fs * 1.02 + 8, start = (i * 2.39996) % (2 * Math.PI);
        for (var t = 0; t < 3200; t++) {
          var th = t * 0.1, r = 2.6 * th, x = W / 2 + r * Math.cos(th + start) * 1.75, y = H / 2 + r * Math.sin(th + start);
          var rect = { x: x - ww / 2, y: y - hh / 2, w: ww, h: hh };
          if (free(rect)) { placed.push(rect); out.push({ w: w, x: x, y: y, fs: fs, i: i }); return; }
          if (r > 1100) break;
        }
        fs *= 0.8;
      }
    });
    return out;
  }
  function renderCloud(box, list, opts) {
    opts = opts || {};
    var pos = layoutCloud(list), seen = {};
    if (!pos.length) { box.innerHTML = '<div class="empty">' + esc(opts.empty || 'No words yet') + '</div>'; return; }
    var e = box.querySelector('.empty'); if (e) e.remove();
    var spans = {};
    Array.prototype.forEach.call(box.querySelectorAll('span[data-k]'), function (s) { spans[s.getAttribute('data-k')] = s; });
    pos.forEach(function (p) {
      var k = p.w.key, s = spans[k];
      if (!s) {
        s = document.createElement('span'); s.setAttribute('data-k', k); s.style.setProperty('--i', p.i);
        if (opts.host) { s.className = 'host'; s.title = 'Click twice to remove this word'; }
        box.appendChild(s);
      }
      s.textContent = p.w.text;
      s.style.left = (p.x / 10) + '%'; s.style.top = (p.y / 5.6) + '%';
      s.style.fontSize = 'calc(' + p.fs.toFixed(1) + ' * 0.1cqw)';
      s.style.setProperty('--c', p.w.col);
      s.setAttribute('aria-label', p.w.text + ', ' + plural(p.w.count, 'time', 'times'));
      seen[k] = 1;
    });
    Object.keys(spans).forEach(function (k) { if (!seen[k]) spans[k].remove(); });
  }

  /* ================= the matrix ================= */
  function plane(opts) {
    opts = opts || {};
    var h = '<svg class="plane" viewBox="0 0 100 100" role="img" aria-label="' + esc(opts.label || 'Map: conservative to innovative, pessimistic to optimistic') + '">';
    C.QUADRANTS.forEach(function (q) {
      h += '<rect class="q" x="' + (q.x * 50) + '" y="' + ((1 - q.y) * 50) + '" width="50" height="50" fill="' + q.col + '"/>';
      var tx = q.x ? 97 : 3, ty = q.y ? 6 : 96.5;
      h += '<text class="qn" x="' + tx + '" y="' + ty + '" text-anchor="' + (q.x ? 'end' : 'start') + '" fill="' + q.col + '">' + esc(q.name) + '</text>';
    });
    h += '<path class="axis" d="M50 0 V100 M0 50 H100"/><rect class="frame" x=".25" y=".25" width="99.5" height="99.5"/>';
    var pts = opts.points || [];
    if (opts.room && pts.length > 1) {
      var mx = 0, my = 0; pts.forEach(function (p) { mx += p.x; my += p.y; }); mx /= pts.length; my /= pts.length;
      h += '<g class="room"><circle cx="' + mx.toFixed(1) + '" cy="' + (100 - my).toFixed(1) + '" r="4.2"/><path d="M' + (mx - 6).toFixed(1) + ' ' + (100 - my).toFixed(1) + ' h12 M' + mx.toFixed(1) + ' ' + (94 - my).toFixed(1) + ' v12"/></g>';
    }
    pts.forEach(function (p) {
      var q = QBY[quadOf(p.x, p.y)], cy = 100 - p.y;
      h += '<circle class="pt' + (p.mine ? ' me' : '') + (opts.fresh && opts.fresh[p.c] ? ' new' : '') + '" cx="' + p.x.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (p.mine ? 2.9 : 1.9) + '" fill="' + q.col + '"/>';
      if (opts.words && p.words && p.words.length) {
        var right = p.x > 66, t = p.words.slice(0, 3).join(' · ');
        h += '<text class="wl" x="' + (right ? p.x - 2.8 : p.x + 2.8).toFixed(1) + '" y="' + (cy + .9).toFixed(1) + '" text-anchor="' + (right ? 'end' : 'start') + '">' + esc(t) + '</text>';
      }
    });
    if (opts.pad) h += '<circle class="pt me" id="padpt" cx="' + (opts.pad.x == null ? -10 : opts.pad.x) + '" cy="' + (opts.pad.y == null ? -10 : 100 - opts.pad.y) + '" r="3.6" fill="var(--teal)"/>';
    return h + '</svg>';
  }
  function matrixHTML(inner) {
    var A = C.AXES;
    return '<div class="mx"><span></span><div class="ax t"><b>' + esc(A.top[0]) + '</b>' + esc(A.top[1]) + '</div><span></span>' +
      '<div class="ax l"><b>' + esc(A.left[0]) + '</b>' + esc(A.left[1]) + '</div>' + inner +
      '<div class="ax r"><b>' + esc(A.right[0]) + '</b>' + esc(A.right[1]) + '</div>' +
      '<span></span><div class="ax b"><b>' + esc(A.bottom[0]) + '</b>' + esc(A.bottom[1]) + '</div><span></span></div>';
  }
  function legendHTML(pts) {
    var n = {}; pts.forEach(function (p) { var q = quadOf(p.x, p.y); n[q] = (n[q] || 0) + 1; });
    var h = '<div class="legend reveal">';
    ['pi', 'te', 'be', 'gu'].forEach(function (id) {
      var q = QBY[id];
      h += '<div class="lq" style="--q:' + q.col + '">' + tek(q.tek) + '<div><b>' + esc(q.name) + '</b><span>' + esc(q.line) + '</span></div><span class="n">' + (n[id] || 0) + '</span></div>';
    });
    return h + '</div>';
  }

  /* ================= summary for the host ================= */
  function summary() {
    var s = L.session(), out = [], d = new Date();
    out.push('# AI & Ethics lunch — summary', '');
    out.push(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + ' · ' + plural(L.people(), 'participant', 'participants') + ' · answers are anonymous', '');
    var wl = wordList(false);
    out.push('## AI in one word', wl.length ? wl.slice(0, 40).map(function (w) { return w.text + (w.count > 1 ? ' (' + w.count + ')' : ''); }).join(', ') : '_No words_', '');
    var pts = Object.keys(points()).map(function (k) { return points()[k]; }), qn = {};
    pts.forEach(function (p) { var q = quadOf(p.x, p.y); qn[q] = (qn[q] || 0) + 1; });
    out.push('## Where we stand', ['pi', 'te', 'be', 'gu'].map(function (id) { return QBY[id].name + ': ' + (qn[id] || 0); }).join(' · '), '');
    var iu = idx('using'), uses = [0, 0, 0, 0, 0, 0, 0, 0], tools = [0, 0, 0, 0, 0, 0, 0, 0];
    L.items(iu, 'use').forEach(function (it) { parse(it.v, []).forEach(function (k) { if (uses[k] != null) uses[k]++; }); });
    L.items(iu, 'tool').forEach(function (it) { parse(it.v, []).forEach(function (k) { if (tools[k] != null) tools[k]++; }); });
    out.push('## What we already use (' + respondents(iu, ['use', 'tool']) + ' answered)');
    C.USES.forEach(function (u, k) { out.push('- ' + u + ': ' + uses[k]); });
    out.push('', 'Tools: ' + C.TOOLS.map(function (t, k) { return t + ' ' + tools[k]; }).join(' · '));
    L.items(iu, 'usetext').forEach(function (it) { if (it.v.trim()) out.push('> ' + it.v.trim().replace(/\n/g, ' ')); });
    out.push('');
    STEPS.forEach(function (st, i) {
      if (st.type !== 'card') return;
      var card = cardAt(i), v = votesAt(i, card);
      if (!v.total && !L.level(i)) return;
      out.push('## ' + C.PACKS[card.pack].name + ' — ' + card.id.toUpperCase() + ': ' + card.tag, card.title, '');
      card.opts.forEach(function (o, k) { out.push('- ' + LETTERS[k] + ' (' + v.counts[k] + ') ' + o + (card.ans === k ? ' ← answer' : '')); });
      var rs = reasonsAt(i, card);
      if (rs.length) { out.push('', 'Why people chose what they chose:'); rs.forEach(function (r) { var k = v.by[r.c]; out.push('- ' + (k != null ? '(' + LETTERS[k] + ') ' : '') + r.t.replace(/\n+/g, ' ')); }); }
      var ag = parse(L.hostValue(i, 'agreed'), null);
      if (ag && ag.c === card.id && ag.t) out.push('', '**What we agreed:** ' + ag.t);
      out.push('');
    });
    var r = ranked();
    out.push('## AI tool ideas, ranked (' + plural(r.voters, 'person', 'people') + ' voted)');
    if (!r.list.length) out.push('_No ideas_');
    r.list.forEach(function (x, k) { out.push((k + 1) + '. **' + x.t + '** — ' + plural(x.dots, 'dot', 'dots') + ' · group ' + gName(x.g) + (x.w ? '\n   ' + x.w.replace(/\n+/g, ' ') : '')); });
    out.push('');
    var ic = idx('close'), fu = { yes: 0, maybe: 0, no: 0 }, tp = C.TOPICS.map(function () { return 0; });
    L.items(ic, 'fu').forEach(function (it) { if (fu[it.v] != null) fu[it.v]++; });
    L.items(ic, 'topic').forEach(function (it) { parse(it.v, []).forEach(function (k) { if (tp[k] != null) tp[k]++; }); });
    out.push('## Follow-up', 'Worth a follow-up session? Yes ' + fu.yes + ' · Maybe ' + fu.maybe + ' · No ' + fu.no, '');
    C.TOPICS.forEach(function (t, k) { out.push('- ' + t + ': ' + tp[k]); });
    out.push('', '_Session code ' + L.showCode(s ? s.code : '') + '. Nothing was stored on a server; this summary was made on the host laptop._');
    return out.join('\n');
  }
  function keepSummary() { try { localStorage.setItem('lunch.summary', summary()); } catch (e) {} }

  /* =====================================================================
     STAGE (host)
     ===================================================================== */
  var H = { i: 0, clock: { step: -1, t: 0, p: 0 }, refresh: null, endSure: false, spot: -1, lastPeople: 0, fresh: {} };

  function stageTick() {
    var st = STEPS[H.i], b = $('s-clock'), c = H.clock;
    if (c.step !== H.i) { c.step = H.i; c.t = Date.now(); c.p = 0; }
    var used = ((c.p || Date.now()) - c.t) / 1000, total = st.min * 60, left = total - used;
    if (!b.firstChild) b.innerHTML = ring() + '<span></span>';
    b.lastChild.textContent = left >= 0 ? fmt(left) : '+' + fmt(-left);
    b.classList.toggle('over', left < 0);
    b.setAttribute('aria-pressed', String(!!c.p));
    setRing(b, used / total, used * 6);
    if (H.ideasClock) H.ideasClock();
  }
  function stageBar() {
    var h = '';
    STEPS.forEach(function (st, i) {
      h += '<button type="button" class="' + (i < H.i ? 'done ' : '') + (i === H.i ? 'now ' : '') + (st.opt ? 'is-opt' : '') + '" title="' + esc((i + 1) + '. ' + st.title + (st.opt ? ' (optional)' : '')) + '" data-go="' + i + '" aria-label="Step ' + (i + 1) + ': ' + esc(st.title) + '"></button>';
    });
    $('s-steps').innerHTML = h;
    var s = L.session();
    $('s-join').innerHTML = s ? '<div class="t">Join at the QR code<b>' + esc(L.showCode(s.code)) + '</b></div>' + qrSvg(joinUrl(s.code)) : '';
    $('s-join').hidden = H.i === 0;
    $('s-pos').textContent = 'Step ' + (H.i + 1) + ' of ' + STEPS.length + (STEPS[H.i].opt ? ' · optional' : '');
  }
  function nextLabel() {
    var st = STEPS[H.i], lv = L.level(H.i), mx = maxLevel(st);
    if (lv < mx) {
      if (st.type === 'card') return lv === 0 ? 'Show the votes' : (C.PACKS[st.pack] && st.pack === 'q' ? 'Show the answer' : 'Show the takeaway');
      return { words: 'Show the cloud', matrix: 'Show the map', using: 'Show the results', ideas: 'Show all ideas', rank: 'Show the ranking', close: 'Show the results' }[st.type];
    }
    return H.i < STEPS.length - 1 ? 'Next: ' + STEPS[H.i + 1].title : 'This is the last step';
  }
  function stageFoot() {
    var n = $('s-next'), lbl = nextLabel(), last = H.i >= STEPS.length - 1 && L.level(H.i) >= maxLevel(STEPS[H.i]);
    n.textContent = lbl + (last ? '' : ' →'); n.disabled = last;
    $('s-prev').disabled = H.i === 0;
    $('s-skip').hidden = !(L.level(H.i) < maxLevel(STEPS[H.i]) && H.i < STEPS.length - 1);
    $('s-skip').title = H.i < STEPS.length - 1 ? 'Go to: ' + STEPS[H.i + 1].title : '';
    var st = L.status();
    $('s-chan').innerHTML = '<span class="dot ' + (st.up === st.of ? 'ok' : st.up ? 'warn' : 'bad') + '"></span>' + st.up + '/' + st.of + ' relays';
  }
  function advance() {
    var st = STEPS[H.i], lv = L.level(H.i);
    if (lv < maxLevel(st)) { L.reveal(H.i, lv + 1); afterReveal(st, lv + 1); stageFoot(); return; }
    go(H.i + 1);
  }
  function afterReveal(st, lv) {
    flash($('s-main').querySelector('.visual'));
    if (st.type === 'rank' || st.type === 'close') confetti();
    if (st.type === 'card' && st.pack === 'q' && lv === 2) {
      var card = cardAt(H.i), v = votesAt(H.i, card);
      if (v.total && v.counts[card.ans] / v.total >= .7) confetti();
    }
    if (st.type === 'words') confetti();
    renderStage(true);
  }
  function go(i) {
    if (i < 0 || i >= STEPS.length) return;
    H.i = i; H.spot = -1; H.endSure = false;
    L.setStep(i);
    var st = STEPS[i];
    if (st.type === 'card' && !L.hostValue(i, 'pick')) L.put(i, 'pick', st.card);
    if (st.type === 'groups' && !groupInfo().n) makeGroups(defaultGroups());
    renderStage(false);
    try { history.replaceState(null, '', '#host'); } catch (e) {}
  }
  function defaultGroups() { return Math.max(1, Math.min(8, Math.round(L.people() / 4) || 1)); }
  function makeGroups(n) {
    var ids = L.participants().slice();
    for (var k = ids.length - 1; k > 0; k--) { var j = Math.floor(Math.random() * (k + 1)), t = ids[k]; ids[k] = ids[j]; ids[j] = t; }
    var m = {}; ids.forEach(function (id, k) { m[id] = k % n; });
    L.put(idx('groups'), 'groups', JSON.stringify({ n: n, m: m }));
  }
  function placeNewcomers() {
    var gi = groupInfo(); if (!gi.n || H.i < idx('groups')) return;
    var size = []; for (var k = 0; k < gi.n; k++) size.push(0);
    Object.keys(gi.m).forEach(function (id) { size[gi.m[id]]++; });
    var changed = false;
    L.participants().forEach(function (id) {
      if (gi.m[id] != null) return;
      var best = 0; for (var k = 1; k < gi.n; k++) if (size[k] < size[best]) best = k;
      gi.m[id] = best; size[best]++; changed = true;
    });
    if (changed) L.put(idx('groups'), 'groups', JSON.stringify(gi));
  }

  function lead(st, extra) {
    return '<section class="lead enter"><span class="lab">' + esc(st.label) + (st.opt ? ' · optional' : '') + '</span><h1>' + esc(st.title) + '</h1>' +
      (st.prompt ? '<p class="prompt">' + esc(st.prompt) + '</p>' : '') + (extra || '') + '<div id="s-counter"></div>' + (st.tek ? tek(st.tek) : '') + '</section>';
  }
  function counterHTML(n, what, i) {
    var p = L.people();
    return '<div class="counter"><span class="big">' + n + '</span><span class="sub">' + esc(what) + '</span>' + seats(Math.min(respondentsCache(i), p), p) + '<span class="sub">' + respondentsCache(i) + ' of ' + p + ' have answered</span></div>';
  }
  var respondentsCache = function () { return 0; };

  function renderStage(keepScroll) {
    var st = STEPS[H.i], main = $('s-main'), i = H.i, lv = L.level(i);
    H.refresh = null; H.ideasClock = null;
    stageBar(); stageFoot();
    var h = '';
    switch (st.type) {
      case 'welcome': {
        var s = L.session();
        h = '<section class="lead enter"><span class="lab">' + esc(st.label) + '</span><h1>' + esc(st.title) + '</h1><p class="prompt">' + esc(st.prompt) + '</p><ul>' +
          st.rules.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>' + tek(st.tek) + '</section>' +
          '<section class="visual"><div class="welcome"><div class="ask"><span class="lab">How the session runs</span><div class="agenda" id="s-agenda"></div></div>' +
          '<div class="joinbig"><div class="bigqr">' + qrSvg(joinUrl(s.code)) + '</div><span class="lab">or go to</span><span class="url">' + esc(joinUrl(s.code).replace(/^https?:\/\//, '').replace(/#.*$/, '')) + '</span><span class="lab">and enter</span><span class="code">' + esc(L.showCode(s.code)) + '</span></div></div>' +
          '<div id="s-joined"></div></section>';
        main.innerHTML = h;
        var ag = '', t = 0;
        STEPS.forEach(function (x, k) { ag += '<button type="button" class="' + (x.opt ? 'is-opt' : '') + '" data-go="' + k + '"><span>' + x.min + ' min' + (x.opt ? ' · optional' : '') + '</span><b>' + esc(x.title) + '</b></button>'; t += x.min; });
        $('s-agenda').innerHTML = ag;
        var total = 0, core = 0; STEPS.forEach(function (x) { total += x.min; if (!x.opt) core += x.min; });
        H.refresh = function () {
          var p = L.people(), pop = p > H.lastPeople; H.lastPeople = p;
          $('s-joined').innerHTML = '<div class="counter"><span class="big">' + p + '</span><span class="sub">' + (p === 1 ? 'person has joined' : 'people have joined') + ' · about ' + total + ' minutes, ' + core + ' without the optional steps</span>' + seats(p, Math.max(p, 22), pop) + '</div>';
        };
        break;
      }
      case 'words': {
        main.innerHTML = lead(st) + '<section class="visual center"><div id="s-vis"></div></section>';
        H.refresh = function (reveal) {
          var list = wordList(false), n = 0, who = {};
          L.items(i, 'w').forEach(function (it) { n++; who[it.c] = 1; });
          respondentsCache = function () { return Object.keys(who).length; };
          $('s-counter').innerHTML = counterHTML(n, n === 1 ? 'word so far' : 'words so far', i);
          var vis = $('s-vis');
          if (!L.level(i)) { vis.innerHTML = '<div class="waiting"><span class="big">' + list.length + '</span><span>different words are waiting in the cloud</span></div>'; return; }
          var box = vis.querySelector('.cloud');
          if (!box) { vis.innerHTML = '<div class="cloud' + (reveal ? ' reveal' : '') + '" id="s-cloud"></div>'; box = vis.querySelector('.cloud'); }
          renderCloud(box, list, { host: true, empty: 'No words yet' });
        };
        break;
      }
      case 'matrix': {
        main.innerHTML = lead(st) + '<section class="visual"><div class="split wide"><div id="s-plane"></div><div id="s-legend"></div></div></section>';
        H.refresh = function () {
          var by = points(), pts = Object.keys(by).map(function (k) { return by[k]; });
          respondentsCache = function () { return pts.length; };
          $('s-counter').innerHTML = counterHTML(pts.length, pts.length === 1 ? 'person on the map' : 'people on the map', i);
          var shown = L.level(i) > 0, fresh = {};
          pts.forEach(function (p) { if (!H.fresh[p.c]) fresh[p.c] = 1; H.fresh[p.c] = 1; });
          $('s-plane').innerHTML = matrixHTML(plane({ points: shown ? pts : [], fresh: fresh }));
          $('s-legend').innerHTML = shown ? legendHTML(pts) : '<div class="waiting"><span>The dots appear when you show the map.</span></div>';
        };
        break;
      }
      case 'patterns': {
        main.innerHTML = '<section class="lead enter"><span class="lab">' + esc(st.label) + '</span><h1>' + esc(st.title) + '</h1><p class="prompt">' + esc(st.prompt) + '</p><div class="ask">' +
          st.ask.map(function (a) { return '<p>' + esc(a) + '</p>'; }).join('') + '</div>' + tek(st.tek) + '</section>' +
          '<section class="visual"><div class="patterns"><div id="s-plane"></div><div><div class="cloud" id="s-cloud"></div><div id="s-legend"></div></div></div></section>';
        H.refresh = function () {
          var by = points(), pts = Object.keys(by).map(function (k) { var p = by[k]; p.words = wordsOf(p.c); return p; });
          $('s-plane').innerHTML = matrixHTML(plane({ points: pts, words: true, room: true }));
          renderCloud($('s-cloud'), wordList(true), { empty: 'No words yet' });
          var n = {}; pts.forEach(function (p) { var q = quadOf(p.x, p.y); n[q] = (n[q] || 0) + 1; });
          $('s-legend').innerHTML = '<div class="chips">' + ['pi', 'te', 'be', 'gu'].map(function (id) {
            return '<span class="chip" style="border-color:' + QBY[id].col + ';color:' + QBY[id].col + '"><b>' + (n[id] || 0) + '</b>' + esc(QBY[id].name) + '</span>';
          }).join('') + '<span class="chip"><svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>The room’s centre</span></div>' +
          '<p class="note" style="margin-top:.5rem">Words take the colour of the corner where most of the people who chose them stand.</p>';
        };
        break;
      }
      case 'using': {
        main.innerHTML = lead(st) + '<section class="visual"><div id="s-vis"></div></section>';
        H.refresh = function () {
          var n = respondents(i, ['use', 'tool', 'usetext']);
          respondentsCache = function () { return n; };
          $('s-counter').innerHTML = counterHTML(n, n === 1 ? 'person answered' : 'people answered', i);
          if (!L.level(i)) { $('s-vis').innerHTML = '<div class="waiting"><span class="big">' + n + '</span><span>answers are in. Show the results when most people are done.</span></div>'; return; }
          var uses = C.USES.map(function () { return 0; }), tools = C.TOOLS.map(function () { return 0; });
          L.items(i, 'use').forEach(function (it) { parse(it.v, []).forEach(function (k) { if (uses[k] != null) uses[k]++; }); });
          L.items(i, 'tool').forEach(function (it) { parse(it.v, []).forEach(function (k) { if (tools[k] != null) tools[k]++; }); });
          var quotes = L.items(i, 'usetext').filter(function (it) { return it.v.trim(); });
          $('s-vis').innerHTML = '<div class="split"><div class="ask"><span class="lab">What for</span>' + bars(C.USES.map(function (u, k) { return { label: u, n: uses[k] }; }), n, { pct: false }) + '</div>' +
            '<div class="ask"><span class="lab">Which tools</span>' + bars(C.TOOLS.map(function (u, k) { return { label: u, n: tools[k] }; }), n, { pct: false }) + '</div></div>' +
            (quotes.length ? '<span class="lab">Worth sharing</span><div class="reasons">' + quotes.map(function (q) { return '<div class="reason"><span>' + esc(q.v) + '</span>' + xBtn(q.id) + '</div>'; }).join('') + '</div>' : '');
        };
        break;
      }
      case 'card': {
        var pack = C.PACKS[st.pack];
        main.innerHTML = '<section class="lead enter"><span class="lab">' + esc(st.label) + (st.opt ? ' · optional' : '') + '</span><h1>' + esc(st.title) + '</h1><p class="prompt">' + esc(pack.count) + '</p>' +
          '<div class="ask"><span class="lab">Pick a card</span><div class="picker" id="s-picker"></div></div><div id="s-counter"></div>' + tek(st.tek) + '</section>' +
          '<section class="visual"><div id="s-card"></div><div id="s-after"></div></section>';
        H.refresh = function (reveal) {
          var card = cardAt(i), v = votesAt(i, card), lvl = L.level(i), quiz = card.pack === 'q';
          respondentsCache = function () { return v.total; };
          $('s-picker').innerHTML = C.CARDS.filter(function (c) { return c.pack === st.pack; }).map(function (c) {
            return '<button type="button" data-pick="' + c.id + '" aria-pressed="' + (c.id === card.id) + '" title="' + esc(c.tag) + '">' + c.id.toUpperCase() + '</button>';
          }).join('');
          $('s-counter').innerHTML = counterHTML(v.total, v.total === 1 ? 'vote so far' : 'votes so far', i);
          var h2 = '<article class="bigcard"><div class="head"><span>' + esc(pack.name) + ' · ' + esc(card.tag) + '</span><span>' + card.id.toUpperCase() + '</span></div><div class="body"><h2>' + esc(card.title) + '</h2><div class="opts' + (reveal && lvl === 1 ? ' reveal' : '') + '">';
          card.opts.forEach(function (o, k) { h2 += optHTML(card, k, v, lvl, false); });
          h2 += '</div></div></article>';
          $('s-card').innerHTML = h2;
          var a = '';
          if (lvl >= 2) {
            a += '<div class="take' + (reveal ? ' enter' : '') + '"><span class="lab">' + (quiz ? 'Answer ' + LETTERS[card.ans] : 'What tends to matter') + '</span><p>' + esc(quiz ? card.expl : card.take) + '</p><p class="tip">' + esc(card.tip) + '</p></div>';
          }
          if (lvl >= 1 && !quiz) {
            var rs = reasonsAt(i, card);
            a += '<span class="lab">' + (rs.length ? 'Why people chose what they chose' : 'No reasons written yet') + '</span>';
            if (rs.length) a += '<div class="reasons">' + rs.map(function (r) { var k = v.by[r.c]; return '<div class="reason">' + (k != null ? '<b>' + LETTERS[k] + '</b>' : '') + '<span>' + esc(r.t) + '</span>' + xBtn(r.id) + '</div>'; }).join('') + '</div>';
          }
          if (lvl >= 2 && !quiz) {
            var ag = parse(L.hostValue(i, 'agreed'), null), cur = ag && ag.c === card.id ? ag.t : '';
            var inp = $('s-agreed');
            if (inp && inp.getAttribute('data-c') === card.id && document.activeElement === inp) cur = inp.value;
            a += '<form class="agreed" id="s-agreedform"><input type="text" id="s-agreed" data-c="' + card.id + '" placeholder="What we agreed (optional, goes into the summary)" value="' + esc(cur) + '"><button class="btn" type="submit">Save</button></form>';
          }
          $('s-main').querySelector('.visual').classList.toggle('duo', lvl >= 1 && !quiz);
          var after = $('s-after'), hadFocus = document.activeElement && document.activeElement.id === 's-agreed';
          after.innerHTML = a;
          if (hadFocus) { var f = $('s-agreed'); f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
        };
        break;
      }
      case 'groups': {
        main.innerHTML = lead(st, '<div class="gcount"><button class="btn" type="button" id="g-min" aria-label="Fewer groups">−</button><output id="g-n"></output><button class="btn" type="button" id="g-plus" aria-label="More groups">+</button><button class="btn" type="button" id="g-shuffle">Shuffle</button></div>') +
          '<section class="visual"><div class="groupsgrid reveal" id="s-groups"></div></section>';
        H.refresh = function () {
          placeNewcomers();
          var gi = groupInfo(), size = [];
          for (var k = 0; k < gi.n; k++) size.push(0);
          Object.keys(gi.m).forEach(function (id) { if (size[gi.m[id]] != null) size[gi.m[id]]++; });
          $('g-n').textContent = gi.n + ' groups';
          $('s-groups').innerHTML = size.map(function (n, k) { return '<div class="gbox" style="--g:' + gCol(k) + '"><b>' + esc(gName(k)) + '</b>' + seats(n, n) + '<span>' + plural(n, 'person', 'people') + '</span></div>'; }).join('');
          respondentsCache = function () { return 0; };
          $('s-counter').innerHTML = '<p class="note">' + plural(L.people(), 'person', 'people') + ' in the session. Latecomers join the smallest group automatically.</p>';
        };
        break;
      }
      case 'ideas': {
        main.innerHTML = lead(st) +
          '<section class="visual"><div class="bigclock" id="s-bigclock"><div class="face">' + ring() + '<output>' + fmt(st.clock) + '</output></div><div class="chips"><button class="btn main" type="button" id="c-start">Start ' + (st.clock / 60) + ' minutes</button><button class="btn" type="button" id="c-more">+1 min</button></div></div><div id="s-vis"></div></section>';
        H.ideasClock = function () {
          var end = +L.hostValue(i, 'clock') || 0, box = $('s-bigclock'); if (!box) return;
          var left = end ? (end - Date.now()) / 1000 : st.clock, dur = st.clock;
          if (end && left <= 0) left = 0;
          box.querySelector('output').textContent = end && left <= 0 ? 'time!' : fmt(left);
          setRing(box, end ? 1 - left / dur : 0, end ? (dur - left) * 6 : 0);
          box.classList.toggle('low', !!end && left > 0 && left <= 60);
          if (end && left <= 0 && !H.rang) { H.rang = true; box.classList.add('done'); flash($('s-main').querySelector('.visual')); }
          if (!end || left > 0) { H.rang = false; box.classList.remove('done'); }
          $('c-start').textContent = end && left > 0 ? 'Stop the clock' : (end ? 'Restart' : 'Start ' + (st.clock / 60) + ' minutes');
        };
        H.refresh = function () {
          var list = ideas(), per = {};
          list.forEach(function (x) { per[x.g] = (per[x.g] || 0) + 1; });
          var n = respondents(i, ['idea']); respondentsCache = function () { return n; };
          $('s-counter').innerHTML = '<div class="counter"><span class="big">' + list.length + '</span><span class="sub">' + (list.length === 1 ? 'idea so far' : 'ideas so far') + '</span></div>';
          var gi = groupInfo();
          if (!L.level(i)) {
            var h3 = '<div class="sparks"><span class="lab">Stuck? Ask each other</span><div class="ask">' + C.SPARKS.map(function (a) { return '<p>' + esc(a) + '</p>'; }).join('') + '</div></div><div class="groupsgrid">';
            for (var k = 0; k < Math.max(gi.n, 1); k++) h3 += '<div class="gbox" style="--g:' + gCol(gi.n ? k : -1) + '"><b>' + esc(gi.n ? gName(k) : 'Ideas') + '</b><span class="big" style="font-family:var(--slab);font-size:2.5rem;font-weight:700">' + (per[gi.n ? k : -1] || 0) + '</span><span>ideas</span></div>';
            $('s-vis').innerHTML = h3 + '</div>';
          } else $('s-vis').innerHTML = boardHTML(list, gi, true);
          H.ideasClock();
        };
        break;
      }
      case 'pitch': {
        main.innerHTML = lead(st) + '<section class="visual"><div id="s-vis"></div></section>';
        H.refresh = function () {
          $('s-counter').innerHTML = '<p class="note">Click a group to put it in the spotlight while it pitches.</p>';
          $('s-vis').innerHTML = boardHTML(ideas(), groupInfo(), true);
        };
        break;
      }
      case 'rank': {
        main.innerHTML = lead(st) + '<section class="visual"><div id="s-vis"></div></section>';
        H.refresh = function (reveal) {
          var r = ranked(); respondentsCache = function () { return r.voters; };
          $('s-counter').innerHTML = counterHTML(r.voters, r.voters === 1 ? 'person has voted' : 'people have voted', i);
          if (!L.level(i)) { $('s-vis').innerHTML = '<div class="waiting"><span class="big">' + r.voters + '</span><span>' + plural(r.list.length, 'idea', 'ideas') + ' on the ballot</span></div>'; return; }
          var top = r.list.slice(0, 3), order = [1, 0, 2], hts = ['9rem', '6.5rem', '4.5rem'];
          var p = '<div class="podium' + (reveal ? ' reveal' : '') + '">';
          order.forEach(function (k) { var x = top[k]; if (!x) { p += '<div></div>'; return; } p += '<div class="pod"><b>' + esc(x.t) + '</b><span>' + esc(gName(x.g)) + ' · ' + plural(x.dots, 'dot', 'dots') + '</span><div class="blk" style="--g:' + gCol(x.g) + ';height:' + hts[k] + '">' + (k + 1) + '</div></div>'; });
          p += '</div>';
          var rest = r.list.map(function (x, k) { return { pre: '<b>' + (k + 1) + '.</b>', label: x.t + ' — ' + gName(x.g), n: x.dots, col: gCol(x.g) }; });
          $('s-vis').innerHTML = p + '<span class="lab">All ideas</span>' + bars(rest, 0, {});
        };
        break;
      }
      case 'close': {
        main.innerHTML = lead(st, '<div class="chips"><button class="btn main" type="button" id="sum-copy">Copy summary</button><button class="btn" type="button" id="sum-dl">Download summary</button></div><p class="note">The summary has every answer, anonymous, ready for the follow-up mail.</p>') +
          '<section class="visual"><div id="s-vis"></div></section>';
        H.refresh = function () {
          var n = respondents(i, ['fu', 'topic']); respondentsCache = function () { return n; };
          $('s-counter').innerHTML = counterHTML(n, n === 1 ? 'person answered' : 'people answered', i);
          var wl = wordList(false), r = ranked(), pts = Object.keys(points()), qn = {};
          pts.forEach(function (c) { var p = points()[c]; var q = quadOf(p.x, p.y); qn[q] = (qn[q] || 0) + 1; });
          var bigQ = null; Object.keys(qn).forEach(function (q) { if (!bigQ || qn[q] > qn[bigQ]) bigQ = q; });
          var h4 = '<div class="stats reveal"><div class="stat"><b>' + L.people() + '</b><span>people took part</span></div><div class="stat"><b class="txt">' + (wl[0] ? esc(wl[0].text) : '—') + '</b><span>most-used word for AI</span></div>' +
            '<div class="stat"><b class="txt">' + (bigQ ? esc(QBY[bigQ].name) : '—') + '</b><span>the biggest corner</span></div><div class="stat"><b>' + r.list.length + '</b><span>tool ideas</span></div></div>';
          if (r.list.length) h4 += '<span class="lab">Top ideas</span><ol class="ask">' + r.list.slice(0, 3).map(function (x) { return '<p>' + esc(x.t) + ' <span class="soft small">· ' + plural(x.dots, 'dot', 'dots') + '</span></p>'; }).join('') + '</ol>';
          if (L.level(i)) {
            var fu = { yes: 0, maybe: 0, no: 0 }, tp = C.TOPICS.map(function () { return 0; });
            L.items(i, 'fu').forEach(function (it) { if (fu[it.v] != null) fu[it.v]++; });
            L.items(i, 'topic').forEach(function (it) { parse(it.v, []).forEach(function (k) { if (tp[k] != null) tp[k]++; }); });
            h4 += '<div class="split"><div class="ask"><span class="lab">A follow-up session?</span>' + bars([{ label: 'Yes', n: fu.yes }, { label: 'Maybe', n: fu.maybe }, { label: 'No', n: fu.no, col: 'var(--soft)' }], 0, {}) + '</div>' +
              '<div class="ask"><span class="lab">About what?</span>' + bars(C.TOPICS.map(function (t, k) { return { label: t, n: tp[k] }; }), 0, {}) + '</div></div>';
          }
          $('s-vis').innerHTML = h4;
          keepSummary();
        };
        break;
      }
    }
    if (H.refresh) H.refresh(!!keepScroll);
    stageTick();
  }
  function optHTML(card, k, v, lvl, phone, myv) {
    var quiz = card.pack === 'q', right = quiz && lvl >= 2 && card.ans === k, wrong = quiz && lvl >= 2 && card.ans !== k;
    var pct = v.total ? Math.round(v.counts[k] / v.total * 100) : 0, res = lvl >= 1;
    var cls = 'opt' + (res ? ' res' : '') + (right ? ' right' : '') + (wrong ? ' wrong' : '');
    var inner = (res ? '<i class="fill" style="width:' + pct + '%"></i>' : '') + '<b>' + LETTERS[k] + '</b><span>' + esc(card.opts[k]) + '</span>' +
      (res ? '<em>' + pct + '%<small>' + v.counts[k] + '</small></em>' : '');
    return phone ? '<button type="button" class="' + cls + '" data-vote="' + k + '" aria-pressed="' + (myv === k) + '">' + inner + '</button>'
                 : '<div class="' + cls + '" aria-pressed="' + right + '">' + inner + '</div>';
  }
  function xBtn(id) { return '<button class="x" type="button" data-x="' + esc(id) + '" title="Remove (click twice)" aria-label="Remove">×</button>'; }
  function boardHTML(list, gi, host) {
    var cols = {}, order = [];
    list.forEach(function (x) { if (!cols[x.g]) { cols[x.g] = []; order.push(x.g); } cols[x.g].push(x); });
    order.sort(function (a, b) { return a - b; });
    if (!order.length) return '<div class="waiting"><span>No ideas yet.</span></div>';
    return '<div class="board reveal">' + order.map(function (g) {
      return '<div class="col' + (H.spot === g && host ? ' spot' : '') + '" style="--g:' + gCol(g) + '"><h3 ' + (host ? 'data-spot="' + g + '" role="button" tabindex="0"' : '') + '>' + esc(gName(g)) + '<span class="soft small">' + cols[g].length + '</span></h3>' +
        cols[g].map(function (x) { return '<div class="idea"><div><b>' + esc(x.t) + '</b>' + (x.w ? '<span>' + esc(x.w) + '</span>' : '') + '</div>' + (host ? xBtn(x.id) : '') + '</div>'; }).join('') + '</div>';
    }).join('') + '</div>';
  }

  var refreshQueued = false;
  function stageRefresh() {
    if (refreshQueued) return; refreshQueued = true;
    setTimeout(function () { refreshQueued = false; if (H.refresh) H.refresh(false); stageFoot(); }, 120);
  }
  function startStage() {
    $('landing').hidden = true; $('phone').hidden = true; $('stage').hidden = false;
    document.documentElement.classList.add('host');
    $('s-mark').innerHTML = tek('mark');
    var s = L.session(); H.i = s.step || 0; H.lastPeople = L.people();
    renderStage(false); L.setStep(H.i);
    setInterval(stageTick, 500);
  }
  // stage events
  document.addEventListener('click', function (e) {
    if ($('stage').hidden) return;
    var t = e.target.closest('[data-go]'); if (t) { go(+t.getAttribute('data-go')); return; }
    t = e.target.closest('[data-pick]');
    if (t) { L.put(H.i, 'pick', t.getAttribute('data-pick')); if (L.level(H.i)) L.reveal(H.i, 0); renderStage(false); return; }
    t = e.target.closest('[data-x]');
    if (t) { if (t.classList.contains('sure')) L.remove(t.getAttribute('data-x')); else { t.classList.add('sure'); t.textContent = 'remove?'; setTimeout(function () { if (t.isConnected) { t.classList.remove('sure'); t.textContent = '×'; } }, 3000); } return; }
    t = e.target.closest('[data-spot]');
    if (t) { var g = +t.getAttribute('data-spot'); H.spot = H.spot === g ? -1 : g; H.refresh && H.refresh(); return; }
    t = e.target.closest('.cloud span.host');
    if (t) {
      if (t.classList.contains('sure')) { var k = t.getAttribute('data-k'); wordList(false).forEach(function (w) { if (w.key === k) w.ids.forEach(L.remove); }); }
      else { t.classList.add('sure'); setTimeout(function () { if (t.isConnected) t.classList.remove('sure'); }, 3000); }
      return;
    }
    switch (e.target.id) {
      case 'g-min': makeGroups(Math.max(1, groupInfo().n - 1)); break;
      case 'g-plus': makeGroups(Math.min(8, groupInfo().n + 1)); break;
      case 'g-shuffle': makeGroups(groupInfo().n || defaultGroups()); toast('New groups'); break;
      case 'c-start': {
        var i = H.i, end = +L.hostValue(i, 'clock') || 0;
        L.put(i, 'clock', end && end > Date.now() ? '0' : String(Date.now() + STEPS[i].clock * 1000)); break;
      }
      case 'c-more': {
        var j = H.i, e2 = +L.hostValue(j, 'clock') || 0;
        L.put(j, 'clock', String((e2 > Date.now() ? e2 : Date.now()) + 60000)); break;
      }
      case 'sum-copy': copy(summary(), 'Summary copied'); break;
      case 'sum-dl': download('ai-lunch-summary.md', summary()); break;
    }
  });
  document.addEventListener('submit', function (e) {
    if (e.target.id !== 's-agreedform') return;
    e.preventDefault();
    var inp = $('s-agreed'); L.put(H.i, 'agreed', JSON.stringify({ c: inp.getAttribute('data-c'), t: inp.value.trim() })); inp.blur(); toast('Saved for the summary');
  });
  $('s-next').addEventListener('click', advance);
  $('s-prev').addEventListener('click', function () { go(H.i - 1); });
  $('s-skip').addEventListener('click', function () { go(H.i + 1); });
  $('s-clock').addEventListener('click', function () {
    var c = H.clock; if (c.p) { c.t += Date.now() - c.p; c.p = 0; } else c.p = Date.now(); stageTick();
  });
  $('s-full').addEventListener('click', function () {
    if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
  });
  $('s-chan').addEventListener('click', function () {
    var st = L.status(); toast(st.names.map(function (n) { return (n.up ? '● ' : '○ ') + n.name; }).join('   '));
  });
  $('s-end').addEventListener('click', function () {
    var b = $('s-end');
    if (!H.endSure) { H.endSure = true; b.textContent = 'Sure? Click again'; setTimeout(function () { H.endSure = false; b.textContent = 'End session'; }, 4000); return; }
    keepSummary(); L.stop(); toast('Session ended');
  });
  document.addEventListener('keydown', function (e) {
    if ($('stage').hidden || e.altKey || e.ctrlKey || e.metaKey) return;
    var tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea') return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); if (!$('s-next').disabled) advance(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(H.i - 1); }
    else if (e.key === 'f' || e.key === 'F') $('s-full').click();
  });

  /* =====================================================================
     PHONE (participant)
     ===================================================================== */
  var P = { i: -1, refresh: null, words: '', why: {}, pad: null, ideaG: null };
  function pStatus() {
    var st = L.status(), s = L.session(), b = $('p-status');
    var cls = !s ? 'bad' : st.up ? (st.waiting ? 'warn' : 'ok') : 'bad';
    var txt = !s ? 'Not connected' : !st.up ? 'Reconnecting…' : st.waiting ? 'Waiting for the host' : 'Connected';
    b.innerHTML = '<span class="dot ' + cls + '"></span><span>' + txt + '</span>';
  }
  function pRender() {
    var s = L.session(), main = $('pmain');
    if (!s) return;
    var i = s.step || 0, st = STEPS[i];
    P.i = i; P.refresh = null;
    $('p-bar').style.width = Math.round((i + 1) / STEPS.length * 100) + '%';
    if (!s.gotState) {
      main.innerHTML = '<section class="card pcard enter"><span class="lab">Joining</span><h2>' + (s.waiting ? 'Waiting for the host' : 'Connecting…') + '</h2><p class="soft">' +
        (s.waiting ? 'The session hasn’t started yet, or the host is reconnecting. Keep this page open; it will continue by itself.' : 'One moment.') + '</p>' + tek('welcome') + '</section>';
      return;
    }
    var head = '<span class="lab">' + esc(st.label) + ' · ' + (i + 1) + '/' + STEPS.length + '</span>';
    var h = '';
    switch (st.type) {
      case 'welcome':
        main.innerHTML = '<section class="card pcard enter">' + head + '<h2>You’re in.</h2><p>Keep eating; the host will move us along. Everything you send is anonymous.</p>' + tek('welcome') +
          '<ul class="small" style="margin:0;padding-left:1.1rem;display:flex;flex-direction:column;gap:.375rem">' + st.rules.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></section>';
        break;
      case 'words':
        main.innerHTML = '<section class="card pcard enter">' + head + '<h2>' + esc(st.title) + '</h2><p>' + esc(st.prompt) + '</p>' +
          '<form class="row" id="p-wordform" autocomplete="off"><input type="text" id="p-word" placeholder="A word, or a few" aria-label="Your word" maxlength="60" enterkeyhint="send"><button class="btn main" type="submit">Add</button></form>' +
          '<div class="mywords" id="p-mywords"></div><p class="note" id="p-wordnote"></p></section><div id="p-after"></div>';
        P.refresh = function (reveal) {
          var mine = L.mine(i, 'w');
          $('p-mywords').innerHTML = mine.map(function (x) { return '<span class="chip">' + esc(x.v) + '<button type="button" data-del="' + esc(x.id) + '" aria-label="Remove ' + esc(x.v) + '">×</button></span>'; }).join('');
          $('p-wordnote').textContent = mine.length ? (mine.length >= 5 ? 'That’s five. Remove one to add another.' : 'Sent. Add more if you like, up to five.') : '';
          var a = $('p-after');
          if (L.level(i)) {
            if (!a.querySelector('.cloud')) a.innerHTML = '<section class="card pcard"><span class="lab">The room</span><div class="cloud' + (reveal ? ' reveal' : '') + '"></div></section>';
            renderCloud(a.querySelector('.cloud'), wordList(false), {});
          } else a.innerHTML = '';
        };
        break;
      case 'matrix': {
        var my = points()[s.me];
        P.pad = my ? { x: my.x, y: my.y } : null;
        main.innerHTML = '<section class="card pcard enter">' + head + '<h2>' + esc(st.title) + '</h2><p>' + esc(st.prompt) + '</p><div id="p-pad"></div>' +
          '<button class="btn main wide" type="button" id="p-place"' + (P.pad ? '' : ' disabled') + '>' + (my ? 'Move me here' : 'Place me here') + '</button><p class="sent" id="p-placed"></p></section><div id="p-after"></div>';
        $('p-pad').innerHTML = matrixHTML(plane({ pad: P.pad || {}, label: 'Tap to place yourself' }));
        bindPad();
        P.refresh = function (reveal) {
          var m = points()[s.me];
          $('p-placed').textContent = m ? 'You’re on the map as one of the ' + QBY[quadOf(m.x, m.y)].name.toLowerCase() + '. You can still move.' : '';
          var a = $('p-after');
          if (L.level(i)) {
            var by = points(), pts = Object.keys(by).map(function (k) { return by[k]; });
            a.innerHTML = '<section class="card pcard' + (reveal ? ' enter' : '') + '"><span class="lab">The room</span>' + matrixHTML(plane({ points: pts })) + '</section>';
          } else a.innerHTML = '';
        };
        break;
      }
      case 'patterns':
        main.innerHTML = '<section class="card pcard enter">' + head + '<h2>' + esc(st.title) + '</h2><div id="p-me"></div><div id="p-map"></div><div class="ask">' + st.ask.map(function (a) { return '<p class="small" style="font-size:1rem">' + esc(a) + '</p>'; }).join('') + '</div></section>';
        P.refresh = function () {
          var by = points(), pts = Object.keys(by).map(function (k) { return by[k]; }), m = by[s.me];
          $('p-map').innerHTML = matrixHTML(plane({ points: pts, room: true }));
          if (m) { var q = QBY[quadOf(m.x, m.y)]; $('p-me').innerHTML = '<div class="mine-corner" style="--q:' + q.col + '">' + tek(q.tek) + '<div><span class="lab">Your corner</span><h3 style="color:' + q.col + '">' + esc(q.name) + '</h3><p class="small soft">' + esc(q.line) + '. The bigger dot is you.</p></div></div>'; }
          else $('p-me').innerHTML = '<p class="note">You didn’t place yourself on the map, so you’re watching from the side. That’s fine.</p>';
        };
        break;
      case 'using': {
        main.innerHTML = '<section class="card pcard enter">' + head + '<h2>' + esc(st.title) + '</h2><p>' + esc(st.prompt) + '</p><span class="lab">What for</span><div class="chips" id="p-uses"></div>' +
          '<span class="lab">Which tools</span><div class="chips" id="p-tools"></div><label class="lab" for="p-usetext">One thing that worked well, or didn’t (optional)</label><textarea id="p-usetext" placeholder="As long as you like"></textarea><button class="btn" type="button" id="p-usesend">Send</button><p class="sent" id="p-usenote"></p></section><div id="p-after"></div>';
        var mu = parse((L.mine(i, 'use')[0] || {}).v, []), mt = parse((L.mine(i, 'tool')[0] || {}).v, []), mx2 = L.mine(i, 'usetext')[0];
        $('p-uses').innerHTML = C.USES.map(function (u, k) { return '<button type="button" class="chip" data-use="' + k + '" aria-pressed="' + (mu.indexOf(k) >= 0) + '">' + esc(u) + '</button>'; }).join('');
        $('p-tools').innerHTML = C.TOOLS.map(function (u, k) { return '<button type="button" class="chip" data-tool="' + k + '" aria-pressed="' + (mt.indexOf(k) >= 0) + '">' + esc(u) + '</button>'; }).join('');
        if (mx2) $('p-usetext').value = mx2.v;
        P.refresh = function (reveal) {
          var a = $('p-after'), n = respondents(i, ['use', 'tool', 'usetext']);
          if (!L.level(i)) { a.innerHTML = ''; return; }
          var uses = C.USES.map(function () { return 0; });
          L.items(i, 'use').forEach(function (it) { parse(it.v, []).forEach(function (k) { if (uses[k] != null) uses[k]++; }); });
          a.innerHTML = '<section class="card pcard' + (reveal ? ' enter' : '') + '"><span class="lab">The room · ' + plural(n, 'answer', 'answers') + '</span>' + bars(C.USES.map(function (u, k) { return { label: u, n: uses[k] }; }), 0, {}) + '</section>';
        };
        break;
      }
      case 'card': {
        main.innerHTML = '<div id="p-card"></div><div id="p-why"></div><div id="p-after"></div>';
        P.card = null;
        P.refresh = function (reveal) {
          var card = cardAt(i), quiz = card.pack === 'q', lvl = L.level(i), v = votesAt(i, card), myv = v.by[s.me];
          var ch = '<section class="card pcard' + (P.card !== card.id ? ' enter' : '') + '"><span class="lab">' + esc(C.PACKS[card.pack].name) + ' · ' + esc(card.tag) + '</span><h2>' + esc(card.title) + '</h2><div class="opts">';
          card.opts.forEach(function (o, k) { ch += optHTML(card, k, v, lvl, true, myv); });
          ch += '</div><p class="sent">' + (myv != null ? (lvl ? 'You chose ' + LETTERS[myv] + '.' : 'Locked in: ' + LETTERS[myv] + '. You can still change.') : (lvl ? 'Votes are in.' : 'Tap the letter closest to what you think.')) + '</p></section>';
          $('p-card').innerHTML = ch;
          if (P.card !== card.id) {
            P.card = card.id;
            var whyBox = $('p-why');
            if (!quiz) {
              var mine = reasonsAt(i, card).filter(function (r) { return r.mine; })[0];
              whyBox.innerHTML = '<section class="card pcard"><label class="lab" for="p-whytext">Why? (optional, anonymous)</label><textarea id="p-whytext" placeholder="Write as much as you like">' + esc(mine ? mine.t : '') + '</textarea><button class="btn" type="button" id="p-whysend">Send</button><p class="sent" id="p-whynote">' + (mine ? 'Sent. Edit and send again to replace it.' : '') + '</p></section>';
            } else whyBox.innerHTML = '';
          }
          var a = '';
          if (lvl >= 2) a = '<section class="card pcard' + (reveal ? ' enter' : '') + '"><div class="take"><span class="lab">' + (quiz ? 'Answer ' + LETTERS[card.ans] : 'What tends to matter') + '</span><p>' + esc(quiz ? card.expl : card.take) + '</p><p class="tip">' + esc(card.tip) + '</p></div></section>';
          $('p-after').innerHTML = a;
        };
        break;
      }
      case 'groups':
        main.innerHTML = '<div id="p-group"></div><p class="note" style="text-align:center">' + esc(st.prompt) + '</p>';
        P.refresh = function () {
          var g = groupOf(s.me);
          $('p-group').innerHTML = g < 0 ? '<section class="card pcard"><h2>Groups are being made…</h2>' + tek('groups') + '</section>' :
            '<div class="groupcard enter" style="--g:' + gCol(g) + '"><span>You’re in group</span><b>' + esc(gName(g)) + '</b><span>Find the others with this colour</span></div>';
          if (g >= 0 && P.ideaG !== g) { P.ideaG = g; buzz([40, 60, 40]); }
        };
        break;
      case 'ideas': {
        main.innerHTML = '<section class="card pcard enter" id="p-ideacard">' + head + '<div id="p-gtag"></div><h2>' + esc(st.title) + '</h2><p>' + esc(st.prompt) + '</p>' +
          '<div class="bigclock" id="p-clock" hidden><div class="face" style="width:5rem;height:5rem">' + ring() + '<output style="bottom:.6rem;font-size:.95rem"></output></div><span class="note">Time left for your group</span></div>' +
          '<form class="ideaform" id="p-ideaform" autocomplete="off"><label class="lab" for="p-ideat">Name your tool</label><input type="text" id="p-ideat" placeholder="e.g. a PBC chaser" maxlength="200">' +
          '<label class="lab" for="p-ideaw">What problem does it solve?</label><textarea id="p-ideaw" placeholder="Write as much as you like"></textarea><button class="btn main" type="submit">Add idea</button></form>' +
          '<details><summary class="note">Stuck? Four questions</summary><ul class="small">' + C.SPARKS.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></details></section><div id="p-list"></div>';
        P.refresh = function () {
          var g = groupOf(s.me), list = ideas();
          $('p-gtag').innerHTML = '<span class="gtag" style="--g:' + gCol(g) + '">' + esc(g >= 0 ? 'Group ' + gName(g) : 'No group yet') + '</span>';
          var ownGroup = list.filter(function (x) { return x.g === g || x.mine; });
          var showAll = L.level(i) > 0;
          var shown = showAll ? list : ownGroup;
          $('p-list').innerHTML = shown.length ? '<section class="card pcard"><span class="lab">' + (showAll ? 'All ideas' : 'Your group’s ideas') + '</span>' + shown.map(function (x) {
            return '<div class="idea"><div><b>' + esc(x.t) + '</b>' + (x.w ? '<span>' + esc(x.w) + '</span>' : '') + '</div>' + (x.mine ? '<button class="x" type="button" data-del="' + esc(x.id) + '" aria-label="Remove">×</button>' : '') + '</div>';
          }).join('') + '</section>' : '';
          pClock();
        };
        break;
      }
      case 'pitch':
        main.innerHTML = '<section class="card pcard enter">' + head + '<h2>' + esc(st.title) + '</h2><p>' + esc(st.prompt) + '</p></section><div id="p-list"></div>';
        P.refresh = function () { $('p-list').innerHTML = boardHTML(ideas(), groupInfo(), false); };
        break;
      case 'rank':
        main.innerHTML = '<section class="card pcard enter">' + head + '<h2>' + esc(st.title) + '</h2><p>' + esc(st.prompt) + '</p><div class="dotsleft" id="p-dots"></div></section><div class="opts" id="p-ballot"></div><div id="p-after"></div>';
        P.refresh = function (reveal) {
          var mine = parse((L.mine(i, 'dots')[0] || {}).v, []), list = ideas(), lvl = L.level(i);
          var d = ''; for (var k = 0; k < 3; k++) d += '<i class="' + (k < mine.length ? 'full' : '') + '"></i>';
          $('p-dots').innerHTML = d + '<span>' + (3 - mine.length) + ' left</span>';
          if (lvl) {
            var r = ranked();
            $('p-ballot').innerHTML = '';
            $('p-after').innerHTML = '<section class="card pcard' + (reveal ? ' enter' : '') + '"><span class="lab">The ranking</span>' + bars(r.list.map(function (x, k) { return { pre: '<b>' + (k + 1) + '.</b>', label: x.t, n: x.dots, col: gCol(x.g) }; }), 0, {}) + '</section>';
            return;
          }
          $('p-ballot').innerHTML = list.length ? list.map(function (x) {
            var on = mine.indexOf(x.id) >= 0;
            return '<button type="button" class="vote" style="--g:' + gCol(x.g) + '" data-dot="' + esc(x.id) + '" aria-pressed="' + on + '"><span><span class="t">' + esc(x.t) + '</span>' + (x.w ? '<span class="w">' + esc(x.w.length > 140 ? x.w.slice(0, 140) + '…' : x.w) + '</span>' : '') + '</span><span class="pip" aria-hidden="true"></span></button>';
          }).join('') : '<p class="note">No ideas yet.</p>';
          $('p-after').innerHTML = '';
        };
        break;
      case 'close':
        main.innerHTML = '<section class="card pcard enter">' + head + '<h2>' + esc(st.title) + '</h2><p>' + esc(st.prompt) + '</p><span class="lab">Worth a follow-up session?</span><div class="chips" id="p-fu"></div>' +
          '<span class="lab">What should it be about?</span><div class="chips" id="p-topics"></div>' + tek('close') + '</section><div id="p-after"></div>';
        P.refresh = function (reveal) {
          var fu = (L.mine(i, 'fu')[0] || {}).v, tp = parse((L.mine(i, 'topic')[0] || {}).v, []);
          $('p-fu').innerHTML = [['yes', 'Yes'], ['maybe', 'Maybe'], ['no', 'No']].map(function (o) { return '<button type="button" class="chip" data-fu="' + o[0] + '" aria-pressed="' + (fu === o[0]) + '">' + o[1] + '</button>'; }).join('');
          $('p-topics').innerHTML = C.TOPICS.map(function (t, k) { return '<button type="button" class="chip" data-topic="' + k + '" aria-pressed="' + (tp.indexOf(k) >= 0) + '">' + esc(t) + '</button>'; }).join('');
          if (L.level(i)) {
            var f = { yes: 0, maybe: 0, no: 0 }; L.items(i, 'fu').forEach(function (it) { if (f[it.v] != null) f[it.v]++; });
            $('p-after').innerHTML = '<section class="card pcard' + (reveal ? ' enter' : '') + '"><span class="lab">The room</span>' + bars([{ label: 'Yes', n: f.yes }, { label: 'Maybe', n: f.maybe }, { label: 'No', n: f.no, col: 'var(--soft)' }], 0, {}) + '<p>Thank you for joining.</p></section>';
          }
        };
        break;
    }
    if (P.refresh) P.refresh(false);
    window.scrollTo(0, 0);
  }
  function pClock() {
    var i = idx('ideas'), box = $('p-clock'); if (!box) return;
    var end = +L.hostValue(i, 'clock') || 0; box.hidden = !end;
    if (!end) return;
    var dur = STEPS[i].clock, left = Math.max(0, (end - L.hostNow()) / 1000);
    box.querySelector('output').textContent = left > 0 ? fmt(left) : 'time!';
    setRing(box, 1 - left / dur, (dur - left) * 6);
    box.classList.toggle('low', left > 0 && left <= 60);
    if (left <= 0 && !P.rang) { P.rang = true; buzz([80, 60, 80]); flash($('p-ideacard')); }
    if (left > 0) P.rang = false;
  }
  function bindPad() {
    var svg = document.querySelector('#p-pad .plane'); if (!svg) return;
    function at(e) {
      var r = svg.getBoundingClientRect();
      var x = Math.round(Math.max(1, Math.min(99, (e.clientX - r.left) / r.width * 100)));
      var y = Math.round(Math.max(1, Math.min(99, 100 - (e.clientY - r.top) / r.height * 100)));
      P.pad = { x: x, y: y };
      var c = $('padpt'); c.setAttribute('cx', x); c.setAttribute('cy', 100 - y);
      $('p-place').disabled = false;
    }
    var down = false;
    svg.addEventListener('pointerdown', function (e) { down = true; try { svg.setPointerCapture(e.pointerId); } catch (x) {} at(e); });
    svg.addEventListener('pointermove', function (e) { if (down) at(e); });
    svg.addEventListener('pointerup', function () { down = false; });
    svg.addEventListener('pointercancel', function () { down = false; });
    svg.setAttribute('tabindex', '0');
    svg.addEventListener('keydown', function (e) {
      var p = P.pad || { x: 50, y: 50 }, d = e.shiftKey ? 10 : 3;
      if (e.key === 'ArrowLeft') p.x -= d; else if (e.key === 'ArrowRight') p.x += d; else if (e.key === 'ArrowUp') p.y += d; else if (e.key === 'ArrowDown') p.y -= d; else return;
      e.preventDefault(); p.x = Math.max(1, Math.min(99, p.x)); p.y = Math.max(1, Math.min(99, p.y)); P.pad = p;
      var c = $('padpt'); c.setAttribute('cx', p.x); c.setAttribute('cy', 100 - p.y); $('p-place').disabled = false;
    });
  }
  var useTimer = null;
  function sendUses() {
    clearTimeout(useTimer);
    useTimer = setTimeout(function () {
      var i = idx('using'), u = [], t = [];
      document.querySelectorAll('#p-uses [aria-pressed="true"]').forEach(function (b) { u.push(+b.getAttribute('data-use')); });
      document.querySelectorAll('#p-tools [aria-pressed="true"]').forEach(function (b) { t.push(+b.getAttribute('data-tool')); });
      L.put(i, 'use', JSON.stringify(u)); L.put(i, 'tool', JSON.stringify(t));
      var n = $('p-usenote'); if (n) n.textContent = 'Saved.';
    }, 700);
  }
  // phone events
  document.addEventListener('click', function (e) {
    if ($('phone').hidden) return;
    var s = L.session(); if (!s) return;
    var i = s.step, t;
    if ((t = e.target.closest('[data-del]'))) { L.remove(t.getAttribute('data-del')); return; }
    if ((t = e.target.closest('[data-vote]'))) { var card = cardAt(i); L.put(i, 'vote', card.id + ':' + t.getAttribute('data-vote')); buzz(12); return; }
    if ((t = e.target.closest('[data-use]')) || (t = e.target.closest('[data-tool]'))) {
      var on = t.getAttribute('aria-pressed') !== 'true';
      if (t.hasAttribute('data-use')) {
        var none = C.USES.length - 1, k = +t.getAttribute('data-use');
        if (on && k === none) document.querySelectorAll('#p-uses [data-use]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
        if (on && k !== none) { var nb = document.querySelector('#p-uses [data-use="' + none + '"]'); if (nb) nb.setAttribute('aria-pressed', 'false'); }
      }
      t.setAttribute('aria-pressed', String(on)); sendUses(); return;
    }
    if ((t = e.target.closest('[data-dot]'))) {
      var mine = parse((L.mine(i, 'dots')[0] || {}).v, []), id = t.getAttribute('data-dot'), at = mine.indexOf(id);
      if (at >= 0) mine.splice(at, 1); else if (mine.length < 3) mine.push(id); else { toast('You’ve used your three dots. Tap one to take it back.'); return; }
      L.put(i, 'dots', JSON.stringify(mine)); buzz(12); return;
    }
    if ((t = e.target.closest('[data-fu]'))) { L.put(i, 'fu', t.getAttribute('data-fu')); return; }
    if ((t = e.target.closest('[data-topic]'))) {
      var tp = parse((L.mine(i, 'topic')[0] || {}).v, []), kk = +t.getAttribute('data-topic'), a = tp.indexOf(kk);
      if (a >= 0) tp.splice(a, 1); else tp.push(kk);
      L.put(i, 'topic', JSON.stringify(tp)); return;
    }
    switch (e.target.id) {
      case 'p-place': if (P.pad) { L.put(i, 'xy', P.pad.x + ',' + P.pad.y); buzz(15); e.target.textContent = 'Move me here'; } break;
      case 'p-usesend': {
        var v = $('p-usetext').value.trim(); L.put(i, 'usetext', v); sendUses(); $('p-usenote').textContent = v ? 'Sent, anonymously.' : 'Saved.'; break;
      }
      case 'p-whysend': {
        var c2 = cardAt(i), w = $('p-whytext').value.trim();
        if (!w) { var old = reasonsAt(i, c2).filter(function (r) { return r.mine; })[0]; if (old) L.remove(old.id); $('p-whynote').textContent = 'Removed.'; break; }
        L.put(i, 'why', JSON.stringify({ c: c2.id, t: w }), c2.id); $('p-whynote').textContent = 'Sent, anonymously. Edit and send again to replace it.'; break;
      }
      case 'p-status': {
        var st = L.status(); toast(st.names.map(function (n) { return (n.up ? '● ' : '○ ') + n.name; }).join('   ')); break;
      }
    }
  });
  document.addEventListener('submit', function (e) {
    if ($('phone').hidden) return;
    var s = L.session(); if (!s) return;
    var i = s.step;
    if (e.target.id === 'p-wordform') {
      e.preventDefault();
      var inp = $('p-word'), parts = inp.value.split(/[,;\n]+/).map(normWord).filter(Boolean), room = 5 - L.mine(i, 'w').length;
      if (!parts.length) return;
      if (room <= 0) { toast('Five words is the maximum. Remove one first.'); return; }
      parts.slice(0, room).forEach(function (p) { L.add(i, 'w', p); });
      inp.value = ''; buzz(12);
    } else if (e.target.id === 'p-ideaform') {
      e.preventDefault();
      var tt = $('p-ideat').value.trim(), ww = $('p-ideaw').value.trim();
      if (!tt) { $('p-ideat').focus(); toast('Give your tool a name first'); return; }
      L.add(i, 'idea', JSON.stringify({ g: groupOf(s.me), t: tt, w: ww }));
      $('p-ideat').value = ''; $('p-ideaw').value = ''; toast('Idea added'); buzz(15);
    }
  });
  var pQueued = false;
  function phoneRefresh(what) {
    var s = L.session(); if (!s) return;
    if (s.step !== P.i || (what === 'state' && !P.refresh)) { pRender(); return; }
    if (pQueued) return; pQueued = true;
    setTimeout(function () { pQueued = false; if (P.refresh) P.refresh(what === 'show'); }, 100);
  }
  function startPhone(code) {
    $('landing').hidden = true; $('stage').hidden = true; $('phone').hidden = false;
    $('p-mark').innerHTML = tek('mark');
    $('pmain').innerHTML = '<section class="card pcard"><h2>Connecting…</h2></section>';
    L.join(code).then(function () { pStatus(); pRender(); }, function () {
      showLanding(); $('joinmsg').textContent = 'That code doesn’t look right, or this browser can’t join. Try typing it again.';
    });
    setInterval(pClock, 500);
  }

  /* =====================================================================
     LANDING and routing
     ===================================================================== */
  function showLanding() {
    $('landing').hidden = false; $('stage').hidden = true; $('phone').hidden = true;
    document.documentElement.classList.remove('host');
    $('l-tek').innerHTML = tek('welcome');
    var sv = L.saved(), r = $('resume');
    if (sv) {
      r.hidden = false;
      r.innerHTML = '<p class="small">There is a session on this laptop from ' + new Date(sv.started).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', code <b>' + esc(L.showCode(sv.code)) + '</b>.</p><button class="btn wide" type="button" id="hostresume">Resume that session</button>';
      $('hoststart').textContent = 'Start a new session instead';
    } else { r.hidden = true; $('hoststart').textContent = 'Start a new session'; }
    var last = null; try { last = localStorage.getItem('lunch.summary'); } catch (e) {}
    if (last && !$('lastsum')) {
      var b = document.createElement('button'); b.className = 'btn quiet'; b.type = 'button'; b.id = 'lastsum'; b.textContent = 'Download the summary of the last session';
      b.addEventListener('click', function () { download('ai-lunch-summary.md', last); });
      $('hoststart').parentNode.appendChild(b);
    }
  }
  function hostGo(restore) {
    L.start(restore || null).then(function () {
      try { history.replaceState(null, '', '#host'); } catch (e) {}
      startStage();
    }, function () { toast('This browser can’t run a live session.'); });
  }
  $('hoststart').addEventListener('click', function () { L.forget(); try { localStorage.removeItem('lunch.summary'); } catch (e) {} hostGo(null); });
  document.addEventListener('click', function (e) { if (e.target.id === 'hostresume') hostGo(L.saved()); });
  $('joinform').addEventListener('submit', function (e) {
    e.preventDefault();
    var c = L.normCode($('joincode').value);
    if (!c) { $('joinmsg').textContent = 'A code has eight letters and numbers, like ABCD-EFGH.'; return; }
    location.hash = 'j-' + c;
  });
  $('joincode').addEventListener('input', function () {
    var v = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    this.value = v.length > 4 ? v.slice(0, 4) + '-' + v.slice(4) : v;
  });

  L.on(function (what) {
    if (what === 'ended') {
      if (!$('stage').hidden) { showLanding(); return; }
      if (!$('phone').hidden) {
        $('pmain').innerHTML = '<section class="card pcard enter"><span class="lab">The end</span><h2>Thanks for joining!</h2><p>The host has closed the session. You can close this page.</p>' + tek('close') + '</section>';
        pStatus();
      }
      return;
    }
    if (!$('stage').hidden) {
      if (what === 'people' && STEPS[H.i].type === 'groups') placeNewcomers();
      stageRefresh();
    } else if (!$('phone').hidden) {
      pStatus();
      if (what !== 'status' || !L.session().gotState) phoneRefresh(what);
    }
  });

  function route() {
    var h = (location.hash || '').replace(/^#/, '');
    var m = /^j-([A-Za-z0-9-]{8,9})$/.exec(h);
    if (m) {
      var c = L.normCode(m[1]); var s = L.session();
      if (s && s.code === c && !s.host) return;
      if (c) { startPhone(c); return; }
    }
    if (h === 'host') {
      var s2 = L.session(); if (s2 && s2.host) return;
      var sv = L.saved(); if (sv) { hostGo(sv); return; }
    }
    showLanding();
  }
  window.addEventListener('hashchange', route);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (H.refresh) H.refresh(false); if (P.refresh) P.refresh(false); });
  route();
})();
