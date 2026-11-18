/* AI lunch · live session engine
 *
 * Everyone with the same session code ends up in the same session and sees the room's answers,
 * without names. How it works:
 *  1. The code is the secret. From it we derive an encryption key and a channel name.
 *  2. Every message is encrypted on the device (AES-GCM) and sent through public relay servers.
 *  3. The relays only see a channel name and unreadable text, and pass it on to whoever listens.
 *  4. There is no database. The host's laptop keeps the session; phones get what they need from it.
 *
 * Several relays run side by side (see config.js). Every message goes out on all of them and every
 * device keeps listening on all of them, so the session keeps running when one relay is slow,
 * blocked on the office network, or rate-limited. Duplicates are recognised and dropped.
 */
(function () {
  'use strict';

  var DEFAULT_CHANNELS = [
    { type: 'mqtt', url: 'wss://mqtt.eclipseprojects.io/mqtt' },
    { type: 'mqtt', url: 'wss://broker.emqx.io:8084/mqtt' },
    { type: 'ntfy', url: 'https://ntfy.sh' }
  ];
  var CHANNELS = (window.LUNCH_CONFIG && window.LUNCH_CONFIG.channels) || DEFAULT_CHANNELS;
  // Local testing only: ?channels=mqtt:ws://localhost:9001/mqtt,ntfy:http://localhost:8787
  try {
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      var q = new URLSearchParams(location.search).get('channels');
      if (q) CHANNELS = q.split(',').map(function (s) { var i = s.indexOf(':'); return { type: s.slice(0, i), url: s.slice(i + 1) }; });
    }
  } catch (e) {}

  var ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I, L, O, 0 or 1: easy to misread
  var FRAME = 3900;        // characters per relay message; ntfy accepts up to 4096 bytes
  var STATE_BATCH = 2600;  // characters of items per state message
  // Kinds of input and how long a value may be. Generous on purpose: nobody should hit a limit.
  var KINDS = {
    w: 60, xy: 16, use: 1000, tool: 1000, usetext: 8000, vote: 16, why: 12000,
    idea: 12000, dots: 600, fu: 16, topic: 1000, text: 12000,
    // host only
    pick: 16, groups: 6000, clock: 40, agreed: 6000
  };
  var HOST_ONLY = { pick: 1, groups: 1, clock: 1, agreed: 1 };
  var MAX_ADD = { w: 8, idea: 60, text: 40 };

  var enc = new TextEncoder(), dec = new TextDecoder();
  var S = null, listeners = [];

  function available() {
    return !!(window.crypto && crypto.subtle && window.fetch && (window.WebSocket || window.EventSource) && window.isSecureContext !== false);
  }
  function emit(what) { for (var i = 0; i < listeners.length; i++) { try { listeners[i](what, S); } catch (e) { if (window.console) console.error(e); } } }
  function random(n, chars) {
    var b = new Uint8Array(n * 2), s = '', limit = 256 - (256 % chars.length);
    crypto.getRandomValues(b);
    for (var i = 0; i < b.length && s.length < n; i++) if (b[i] < limit) s += chars[b[i] % chars.length];
    return s.length === n ? s : random(n, chars);
  }
  function newCode() { return random(8, ALPHABET); }
  function normCode(s) {
    s = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (s.length !== 8) return '';
    for (var i = 0; i < s.length; i++) if (ALPHABET.indexOf(s[i]) < 0) return '';
    return s;
  }
  function showCode(c) { return c ? c.slice(0, 4) + '-' + c.slice(4) : ''; }
  function hex(b) { var s = ''; for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16); return s; }
  function b64(b) { var s = ''; for (var i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    var t = atob(s), b = new Uint8Array(t.length); for (var i = 0; i < t.length; i++) b[i] = t.charCodeAt(i); return b;
  }
  function derive(code) {
    return crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveBits']).then(function (base) {
      return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode('ai-lunch/live/v1'), iterations: 150000, hash: 'SHA-256' }, base, 384);
    }).then(function (bits) {
      var b = new Uint8Array(bits);
      return crypto.subtle.importKey('raw', b.slice(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt']).then(function (key) {
        return { key: key, topic: 'jslunch' + hex(b.slice(32, 48)) };
      });
    });
  }
  function seal(key, obj) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, enc.encode(JSON.stringify(obj))).then(function (ct) {
      var c = new Uint8Array(ct), out = new Uint8Array(12 + c.length); out.set(iv); out.set(c, 12); return b64(out);
    });
  }
  function open(key, text) {
    var b = unb64(text);
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, key, b.slice(12)).then(function (pt) { return JSON.parse(dec.decode(pt)); });
  }

  /* =================== relay channels =================== */
  // ntfy: publish with POST, listen with server-sent events.
  function NtfyChannel(url, topic, onFrame, onState) {
    var self = this, es = null, closed = false, retry = null, pause = 0;
    self.name = url.replace(/^https?:\/\//, ''); self.up = false;
    function setUp(v) { if (self.up !== v) { self.up = v; onState(); } }
    function listen() {
      if (closed) return;
      try { es = new EventSource(url + '/' + topic + '/sse'); } catch (e) { return later(); }
      es.onopen = function () { setUp(true); };
      es.onmessage = function (e) {
        var d; try { d = JSON.parse(e.data); } catch (x) { return; }
        if (d && d.event === 'message' && typeof d.message === 'string') onFrame(d.message);
      };
      es.onerror = function () { setUp(false); if (es && es.readyState === 2) later(); };
    }
    function later() { clearTimeout(retry); retry = setTimeout(function () { try { if (es) es.close(); } catch (e) {} listen(); }, 4000 + Math.random() * 3000); }
    self.send = function (frame) {
      if (closed || Date.now() < pause) return Promise.reject(new Error('paused'));
      return fetch(url + '/' + topic + '?cache=no&firebase=no', { method: 'POST', body: frame }).then(function (r) {
        if (r.status === 429) { pause = Date.now() + 30000; throw new Error('rate limited'); }
        if (!r.ok) throw new Error('status ' + r.status);
      });
    };
    self.ready = function () { return self.up && Date.now() >= pause; };
    self.restart = function () { if (closed) return; try { if (es) es.close(); } catch (e) {} setUp(false); listen(); };
    self.close = function () { closed = true; clearTimeout(retry); try { if (es) es.close(); } catch (e) {} self.up = false; };
    listen();
  }

  // MQTT 3.1.1 over a WebSocket: just enough of the protocol to publish and subscribe at QoS 0.
  function MqttChannel(url, topic, onFrame, onState) {
    var self = this, ws = null, closed = false, retry = null, ping = null, wait = null, buf = new Uint8Array(0), tries = 0, lastRx = 0;
    var path = 'jslunch/' + topic;
    self.name = url.replace(/^wss?:\/\//, '').replace(/\/.*$/, ''); self.up = false;
    function setUp(v) { if (self.up !== v) { self.up = v; onState(); } }
    function str(s) { var b = enc.encode(s); return [b.length >> 8, b.length & 255].concat(Array.prototype.slice.call(b)); }
    function packet(type, body) {
      var len = body.length, head = [type];
      do { var d = len % 128; len = Math.floor(len / 128); head.push(len > 0 ? d | 128 : d); } while (len > 0);
      var out = new Uint8Array(head.length + body.length); out.set(head); out.set(body, head.length); return out;
    }
    function raw(p) { try { ws.send(p); return true; } catch (e) { return false; } }
    function connect() {
      if (closed) return;
      try { ws = new WebSocket(url, ['mqtt']); } catch (e) { return later(); }
      ws.binaryType = 'arraybuffer'; buf = new Uint8Array(0);
      var sock = ws;
      wait = setTimeout(function () { if (ws === sock && !self.up) { try { sock.close(); } catch (e) {} } }, 9000);
      ws.onopen = function () {
        var id = 'jsl' + random(12, 'abcdefghijkmnpqrstuvwxyz23456789');
        raw(packet(0x10, [0, 4, 77, 81, 84, 84, 4, 2, 0, 60].concat(str(id))));
      };
      ws.onmessage = function (e) { if (ws === sock) feed(new Uint8Array(e.data)); };
      ws.onclose = function () { if (ws === sock) drop(); };
      ws.onerror = function () { if (ws === sock) { try { sock.close(); } catch (e) {} } };
    }
    function drop() { clearInterval(ping); clearTimeout(wait); setUp(false); ws = null; later(); }
    function later() {
      if (closed) return;
      clearTimeout(retry); tries++;
      retry = setTimeout(connect, Math.min(30000, 1500 * Math.pow(1.7, Math.min(tries, 8))) + Math.random() * 1500);
    }
    function feed(chunk) {
      var b = new Uint8Array(buf.length + chunk.length); b.set(buf); b.set(chunk, buf.length); buf = b;
      while (buf.length >= 2) {
        var mult = 1, len = 0, i = 1, d;
        do { if (i >= buf.length) return; d = buf[i++]; len += (d & 127) * mult; mult *= 128; } while (d & 128);
        if (buf.length < i + len) return;
        handle(buf[0], buf.subarray(i, i + len));
        buf = buf.slice(i + len);
      }
    }
    function handle(h, body) {
      var type = h >> 4; lastRx = Date.now();
      if (type === 2) { // CONNACK
        if (body[1] !== 0) { try { ws.close(); } catch (e) {} return; }
        raw(packet(0x82, [0, 1].concat(str(path), [0])));
      } else if (type === 9) { // SUBACK
        clearTimeout(wait);
        if (body[2] === 0x80) { try { ws.close(); } catch (e) {} return; }
        tries = 0; setUp(true);
        clearInterval(ping); ping = setInterval(function () {
          // no answer to two pings in a row: the connection is dead even if the socket looks open
          if (Date.now() - lastRx > 60000) { try { ws.close(); } catch (e) {} return; }
          raw(new Uint8Array([0xC0, 0]));
        }, 25000);
      } else if (type === 3) { // PUBLISH
        var tl = (body[0] << 8) | body[1], at = 2 + tl;
        if ((h >> 1) & 3) at += 2;
        onFrame(dec.decode(body.subarray(at)));
      }
    }
    self.send = function (frame) {
      if (!self.up || !ws) return Promise.reject(new Error('down'));
      return raw(packet(0x30, str(path).concat(Array.prototype.slice.call(enc.encode(frame))))) ? Promise.resolve() : Promise.reject(new Error('send'));
    };
    self.ready = function () { return self.up; };
    self.restart = function () { if (closed) return; if (ws) { try { ws.close(); } catch (e) {} } else { clearTimeout(retry); connect(); } };
    self.close = function () {
      closed = true; clearTimeout(retry); clearInterval(ping); clearTimeout(wait);
      if (ws) { try { ws.send(new Uint8Array([0xE0, 0])); ws.close(); } catch (e) {} }
      self.up = false;
    };
    connect();
  }

  /* =================== sending and receiving =================== */
  function send(obj) {
    if (!S || !S.key) return;
    var sess = S; obj.c = sess.me; obj.pv = 2;
    sess.chain = sess.chain.then(function () {
      if (S !== sess) return;
      return seal(sess.key, obj).then(function (text) {
        var frames = [];
        if (text.length <= FRAME) frames.push(text);
        else {
          var id = random(10, ALPHABET), n = Math.ceil(text.length / FRAME);
          for (var i = 0; i < n; i++) frames.push('~' + id + '.' + i + '.' + n + '.' + text.slice(i * FRAME, (i + 1) * FRAME));
        }
        frames.forEach(function (f) { sess.seen[f.slice(0, 40)] = Date.now(); out(sess, f, 0); });
      });
    }).catch(function () {});
  }
  // A frame counts as sent when at least one relay accepted it. If none is up, it waits in the outbox.
  function out(sess, frame, attempt) {
    var ready = sess.channels.filter(function (c) { return c.ready(); });
    if (!ready.length) { sess.outbox.push(frame); return; }
    var ok = false, pending = ready.length;
    ready.forEach(function (c) {
      c.send(frame).then(function () { ok = true; }, function () {}).then(function () {
        if (--pending === 0 && !ok && S === sess) {
          if (attempt < 4) setTimeout(function () { out(sess, frame, attempt + 1); }, 1200 * (attempt + 1));
          else { sess.problem = 'send'; emit('status'); }
        }
      });
    });
  }
  function flush(sess) {
    var f = sess.outbox; sess.outbox = [];
    f.forEach(function (x) { out(sess, x, 0); });
  }
  function onFrame(sess, frame) {
    if (S !== sess || typeof frame !== 'string') return;
    var key = frame.slice(0, 40);
    if (sess.seen[key]) return;
    sess.seen[key] = Date.now();
    if (frame.charAt(0) === '~') {
      var p = frame.slice(1).split('.'); if (p.length < 4) return;
      var id = p[0], i = +p[1], n = +p[2], part = p.slice(3).join('.');
      var a = sess.parts[id] || (sess.parts[id] = { n: n, got: {}, count: 0, t: Date.now() });
      if (!a.got[i]) { a.got[i] = part; a.count++; }
      if (a.count < a.n) return;
      var whole = ''; for (var j = 0; j < a.n; j++) whole += a.got[j];
      delete sess.parts[id]; frame = whole;
    }
    open(sess.key, frame).then(function (m) { if (S === sess) handle(m); }).catch(function () {});
  }
  function tidy(sess) {
    var now = Date.now(), k;
    for (k in sess.seen) if (now - sess.seen[k] > 600000) delete sess.seen[k];
    for (k in sess.parts) if (now - sess.parts[k].t > 120000) delete sess.parts[k];
  }

  /* =================== the protocol =================== */
  function know(id) { if (id && !S.who[id]) { S.who[id] = 1; return true; } return false; }
  function people() {
    if (!S) return 0;
    if (S.host) return Object.keys(S.who).filter(function (id) { return id !== S.me; }).length;
    return S.peopleSeen || 0;
  }
  function clockFrom(m) {
    if (S.host || typeof m.now !== 'number') return;
    var skew = m.now - Date.now();
    S.skews.push(skew); if (S.skews.length > 9) S.skews.shift();
    var s = S.skews.slice().sort(function (a, b) { return a - b; }); S.skew = s[Math.floor(s.length / 2)];
    if (m.now > S.hostClock) S.hostClock = m.now;
  }
  function store(it, id) {
    var had = S.items[id];
    if (S.gone[id] || (had && had.n > it.n)) return false;
    if (S.host) it.r = Date.now();
    S.items[id] = it; return true;
  }
  function handle(m) {
    if (!m || m.pv !== 2 || typeof m.c !== 'string') return;
    var mine = (m.c === S.me), fromHost = S.hostId ? m.c === S.hostId : false, changed;
    switch (m.t) {
      case 'hello':
        if (m.h) {
          if (S.host && !mine) return; // a second host on the same code: ignore
          if (!S.hostId) S.hostId = m.c;
          if (!S.host && m.c === S.hostId) setTimeout(function () { hello(); resendMine(); }, 300 + Math.random() * 2500);
          return;
        }
        if (S.host && !mine) {
          if (know(m.c)) emit('people');
          queueState(m.c, +m.since || 0);
        }
        return;
      case 'mine':
        // a participant re-sends its own input, so a host that missed something catches up
        if (!S.host || mine) return;
        if (know(m.c)) emit('people');
        changed = false;
        (m.items || []).forEach(function (a) {
          if (typeof a[0] !== 'string' || a[0].indexOf(m.c + ':') !== 0 || !KINDS[a[2]] || HOST_ONLY[a[2]]) return;
          if (store({ s: a[1] | 0, k: a[2], v: String(a[3] == null ? '' : a[3]).slice(0, KINDS[a[2]]), c: m.c, n: +a[4] || 0 }, a[0])) changed = true;
        });
        if (changed) { emit('in'); save(); }
        return;
      case 'state':
        if (S.host || (S.hostId && m.c !== S.hostId)) return;
        if (!S.hostId) S.hostId = m.c;
        clockFrom(m);
        if (m.full) { S.gotState = true; S.waiting = false; }
        if (typeof m.step === 'number') S.step = m.step;
        if (typeof m.people === 'number') S.peopleSeen = m.people;
        if (m.shown) Object.keys(m.shown).forEach(function (k) { S.shown[k] = m.shown[k]; });
        (m.gone || []).forEach(function (id) { S.gone[id] = 1; delete S.items[id]; });
        (m.items || []).forEach(function (a) { store({ s: a[1], k: a[2], v: a[3], c: a[4], n: a[5] || 0 }, a[0]); });
        emit('state');
        return;
      case 'step':
        if (!fromHost || S.host) return;
        clockFrom(m);
        if (typeof m.people === 'number') S.peopleSeen = m.people;
        if (typeof m.i === 'number') { S.step = m.i; emit('step'); }
        return;
      case 'show':
        if (!fromHost || S.host) return;
        clockFrom(m);
        S.shown[m.s] = m.l | 0; emit('show');
        return;
      case 'in':
        if (typeof m.id !== 'string' || m.id.indexOf(m.c + ':') !== 0 || !KINDS[m.k]) return;
        if (HOST_ONLY[m.k] && !fromHost) return;
        if (fromHost) clockFrom(m);
        var v = String(m.v == null ? '' : m.v).slice(0, KINDS[m.k]);
        changed = store({ s: m.s | 0, k: m.k, v: v, c: m.c, n: +m.n || 0 }, m.id);
        if (S.host && know(m.c)) emit('people');
        if (changed) { emit('in'); if (S.host) save(); }
        return;
      case 'gone':
        if (typeof m.id !== 'string' || (m.id.indexOf(m.c + ':') !== 0 && !fromHost)) return;
        S.gone[m.id] = 1; delete S.items[m.id]; emit('in'); if (S.host) save();
        return;
      case 'end':
        if (!fromHost || S.host) return;
        close(); emit('ended');
        return;
    }
  }
  // The host answers newcomers with the state of the session. Requests that arrive close together
  // are answered in one go; a returning phone only gets what it missed.
  function queueState(who, since) {
    var q = S.pending || (S.pending = { since: Infinity, timer: null });
    q.since = Math.min(q.since, since);
    if (!q.timer) q.timer = setTimeout(function () { var s = q.since; S.pending = null; sendState(s); }, 350);
  }
  function sendState(since) {
    if (!S || !S.host) return;
    var base = { t: 'state', full: 1, step: S.step, people: people(), now: Date.now(), shown: S.shown, gone: Object.keys(S.gone).slice(-300) };
    var all = Object.keys(S.items).filter(function (id) { return (S.items[id].r || 0) >= since; }).map(function (id) {
      var it = S.items[id]; return [id, it.s, it.k, it.v, it.c, it.n];
    });
    var batches = [[]], size = 0;
    all.forEach(function (a) {
      var l = JSON.stringify(a).length + 1;
      if (size + l > STATE_BATCH && batches[batches.length - 1].length) { batches.push([]); size = 0; }
      batches[batches.length - 1].push(a); size += l;
    });
    // the last batch carries the step and reveal state, so a phone never shows a reveal without its data
    batches.forEach(function (items, i) {
      var m = i === batches.length - 1 ? JSON.parse(JSON.stringify(base)) : { t: 'state', now: Date.now() };
      m.items = items; send(m);
    });
  }
  function resendMine() {
    if (!S || S.host) return;
    var list = Object.keys(S.items).filter(function (id) { return S.items[id].c === S.me; }).map(function (id) {
      var it = S.items[id]; return [id, it.s, it.k, it.v, it.n];
    });
    if (list.length) send({ t: 'mine', items: list });
  }
  function hello() {
    if (!S) return;
    var since = (!S.host && S.gotState && S.hostClock) ? S.hostClock - 90000 : 0;
    send({ t: 'hello', h: S.host ? 1 : 0, since: since });
    if (!S.host && !S.gotState) {
      clearTimeout(S.waitTimer);
      S.waitTimer = setTimeout(function () { if (S && !S.gotState) { S.waiting = true; emit('status'); } }, 7000);
    }
  }

  /* =================== host persistence =================== */
  var saveTimer = null;
  function save() {
    if (!S || !S.host) return;
    clearTimeout(saveTimer);
    var sess = S;
    saveTimer = setTimeout(function () {
      saveTimer = null;
      try {
        localStorage.setItem('lunch.host', JSON.stringify({ code: sess.code, me: sess.me, step: sess.step, items: sess.items, shown: sess.shown,
          gone: sess.gone, who: sess.who, started: sess.started, saved: Date.now() }));
      } catch (e) {}
    }, 400);
  }
  // the laptop is closing or reloading: write now instead of waiting for the next quiet moment
  window.addEventListener('pagehide', function () {
    if (!S || !S.host || !saveTimer) return;
    clearTimeout(saveTimer); saveTimer = null;
    try {
      localStorage.setItem('lunch.host', JSON.stringify({ code: S.code, me: S.me, step: S.step, items: S.items, shown: S.shown,
        gone: S.gone, who: S.who, started: S.started, saved: Date.now() }));
    } catch (e) {}
  });
  function saved() {
    try {
      var o = JSON.parse(localStorage.getItem('lunch.host') || 'null');
      if (o && normCode(o.code) && Date.now() - o.saved < 16 * 3600 * 1000) return o;
    } catch (e) {}
    return null;
  }
  function forget() { try { localStorage.removeItem('lunch.host'); } catch (e) {} }

  /* =================== start, join, stop =================== */
  function begin(code, host, restore) {
    close();
    var me = restore ? restore.me : null;
    if (!host) { try { me = localStorage.getItem('lunch.me.' + code); } catch (e) {} }
    if (!me) me = random(10, ALPHABET);
    if (!host) { try { localStorage.setItem('lunch.me.' + code, me); } catch (e) {} }
    var sess = S = {
      code: code, host: !!host, me: me, hostId: host ? me : '', key: null, topic: '', channels: [],
      chain: Promise.resolve(), outbox: [], seen: {}, parts: {}, step: 0, items: {}, shown: {}, who: {}, gone: {},
      gotState: !!host, waiting: false, hostClock: 0, skew: 0, skews: [], peopleSeen: 0, wasOnline: false,
      started: Date.now(), problem: null
    };
    if (restore) {
      sess.step = restore.step || 0; sess.items = restore.items || {}; sess.shown = restore.shown || {};
      sess.gone = restore.gone || {}; sess.who = restore.who || {}; sess.started = restore.started || Date.now();
    }
    sess.who[me] = 1;
    emit('status');
    return derive(code).then(function (k) {
      if (S !== sess) return null;
      sess.key = k.key; sess.topic = k.topic;
      CHANNELS.forEach(function (c) {
        var Ctor = c.type === 'mqtt' ? MqttChannel : c.type === 'ntfy' ? NtfyChannel : null;
        if (!Ctor) return;
        if (c.type === 'mqtt' && !window.WebSocket) return;
        if (c.type === 'ntfy' && !window.EventSource) return;
        sess.channels.push(new Ctor(c.url, k.topic, function (f) { onFrame(sess, f); }, function () { channelState(sess); }));
      });
      sess.tidy = setInterval(function () { tidy(sess); }, 60000);
      sess.retry = setInterval(function () { if (sess.outbox.length) flush(sess); }, 3000);
      if (host) save();
      return sess;
    });
  }
  function channelState(sess) {
    if (S !== sess) return;
    var online = sess.channels.some(function (c) { return c.up; });
    if (online) { flush(sess); if (sess.problem === 'send') sess.problem = null; }
    if (online && !sess.wasOnline) {
      clearTimeout(sess.helloTimer);
      sess.helloTimer = setTimeout(function () { if (S === sess) hello(); }, sess.host ? 200 : 500);
    }
    sess.wasOnline = online;
    emit('status');
  }
  function start(restore) {
    if (!available()) return Promise.reject(new Error('unavailable'));
    return begin(restore ? restore.code : newCode(), true, restore || null);
  }
  function join(code) {
    code = normCode(code);
    if (!code) return Promise.reject(new Error('code'));
    if (!available()) return Promise.reject(new Error('unavailable'));
    return begin(code, false, null);
  }
  function close() {
    if (!S) return;
    var s = S; S = null;
    s.channels.forEach(function (c) { c.close(); });
    clearTimeout(s.waitTimer); clearTimeout(s.helloTimer); clearInterval(s.tidy); clearInterval(s.retry);
    if (s.pending) clearTimeout(s.pending.timer);
  }
  function stop() {
    if (!S) return;
    if (S.host) { var s = S; send({ t: 'end' }); s.chain.then(function () { setTimeout(function () { if (S === s) { close(); forget(); emit('ended'); } }, 600); }); }
    else { close(); emit('ended'); }
  }
  // Phones drop their connections when the screen locks. Coming back after a while: reconnect at once.
  var hiddenAt = 0;
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (S && hiddenAt && Date.now() - hiddenAt > 15000) {
      S.wasOnline = false;
      S.channels.forEach(function (c) { c.restart(); });
    }
    hiddenAt = 0;
  });

  /* =================== what people can do =================== */
  function setStep(i) {
    if (!S || !S.host) return;
    S.step = i; send({ t: 'step', i: i, people: people(), now: Date.now() }); save();
  }
  function reveal(step, level) {
    if (!S || !S.host) return;
    S.shown[step] = level; send({ t: 'show', s: step, l: level, now: Date.now() }); emit('show'); save();
  }
  function level(step) { return S ? (S.shown[step] | 0) : 0; }
  function itemId(step, kind, slot) { return S.me + ':' + step + ':' + kind + ':' + slot; }
  function put(step, kind, value, slot) {
    if (!S || !KINDS[kind] || (HOST_ONLY[kind] && !S.host)) return false;
    var v = String(value == null ? '' : value).slice(0, KINDS[kind]);
    var id = itemId(step, kind, slot == null ? '0' : slot), n = Date.now();
    S.items[id] = { s: step, k: kind, v: v, c: S.me, n: n, r: n };
    delete S.gone[id];
    var m = { t: 'in', id: id, s: step, k: kind, v: v, n: n };
    if (S.host) m.now = n;
    send(m); emit('in'); save();
    return id;
  }
  function add(step, kind, value) {
    if (!S) return false;
    if (MAX_ADD[kind] && mine(step, kind).length >= MAX_ADD[kind]) return false;
    return put(step, kind, value, Date.now().toString(36) + random(3, ALPHABET));
  }
  function remove(id) {
    if (!S || (id.indexOf(S.me + ':') !== 0 && !S.host)) return;
    S.gone[id] = 1; delete S.items[id]; send({ t: 'gone', id: id }); emit('in'); save();
  }
  function items(step, kind) {
    if (!S) return [];
    return Object.keys(S.items).filter(function (id) { var it = S.items[id]; return it.s === step && it.k === kind && (!HOST_ONLY[kind] || it.c === S.hostId); })
      .sort(function (a, b) { return S.items[a].n - S.items[b].n || (a < b ? -1 : 1); })
      .map(function (id) { var it = S.items[id]; return { id: id, v: it.v, c: it.c, n: it.n, mine: it.c === S.me }; });
  }
  function mine(step, kind) { return items(step, kind).filter(function (x) { return x.mine; }); }
  function hostValue(step, kind) { var l = items(step, kind); return l.length ? l[l.length - 1].v : ''; }
  function participants() { return S && S.host ? Object.keys(S.who).filter(function (id) { return id !== S.me; }) : []; }
  function status() {
    if (!S) return { up: 0, of: 0, names: [] };
    return { up: S.channels.filter(function (c) { return c.up; }).length, of: S.channels.length,
      names: S.channels.map(function (c) { return { name: c.name, up: c.up }; }), waiting: S.waiting, problem: S.problem };
  }
  function hostNow() { return Date.now() + (S && !S.host ? S.skew : 0); }

  window.Live = {
    available: available, normCode: normCode, showCode: showCode, saved: saved, forget: forget,
    start: start, join: join, stop: stop, close: close,
    setStep: setStep, reveal: reveal, level: level, put: put, add: add, remove: remove,
    items: items, mine: mine, hostValue: hostValue, participants: participants, people: people,
    status: status, hostNow: hostNow, resend: hello,
    session: function () { return S; },
    on: function (fn) { listeners.push(fn); },
    MAX_ADD: MAX_ADD
  };
})();
