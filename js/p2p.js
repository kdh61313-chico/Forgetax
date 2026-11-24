/* EMBER TITHE — peer-to-peer room transport for static hosting (GitHub Pages).
   Star topology over WebRTC (PeerJS): the room creator is the hub and relays everyone's presence.
   Exposes the same shape the game uses from the claude.ai room: join(name, {host}) -> { presence, onPeers, peers, connected, leave, onDrop } */
'use strict';
(function (ET) {
  const P2P = ET.P2P = {};
  const PREFIX = 'embertithe-v1-';
  const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }] };
  P2P.available = () => typeof window.Peer === 'function';
  // optional self-hosted signalling: ?peer=host:port (defaults to the public PeerJS cloud)
  const OPT = (() => { try { const q = new URLSearchParams(location.search).get('peer'); if (!q) return {}; const [h, pt] = q.split(':'); return { host: h, port: +(pt || 443), secure: location.protocol === 'https:' && h !== 'localhost', path: '/' }; } catch (e) { return {}; } })();

  P2P.join = function (name, opts) {
    const host = !!(opts && opts.host);
    return new Promise((resolve, reject) => {
      let peer, settled = false, dropFns = [], peerFns = [], mine = {}, all = {}, seen = {}, conns = {}, hubConn = null, myId = null, sendT = null, alive = true;
      const fail = (code, msg) => { if (settled) return; settled = true; try { peer && peer.destroy(); } catch (e) { } const e = new Error(msg || code); e.code = code; reject(e); };
      const snapshot = () => {
        const arr = [];
        for (const id in all) arr.push(Object.freeze({ peer: id, by: null, isMe: id === myId, sameTab: id === myId, kind: 'viewer', guest: false, presence: Object.freeze(Object.assign({}, all[id] || {})), updatedAt: seen[id] || Date.now() }));
        return Object.freeze(arr);
      };
      let last = Object.freeze([]);
      const emitPeers = () => { last = snapshot(); peerFns.forEach(f => { try { f({ peers: last, joined: [], left: [], updated: [] }); } catch (e) { console.error(e); } }); };
      const broadcast = () => { const msg = { t: 'all', m: all }; for (const id in conns) { try { conns[id].open && conns[id].send(msg); } catch (e) { } } emitPeers(); };
      const flush = () => { sendT = null; if (!alive) return; if (host) { all[myId] = mine; seen[myId] = Date.now(); broadcast(); } else if (hubConn && hubConn.open) { try { hubConn.send({ t: 'p', p: mine }); } catch (e) { } } };
      const schedule = () => { if (!sendT) sendT = setTimeout(flush, 70); };
      const drop = why => { if (!alive) return; alive = false; dropFns.forEach(f => { try { f(why); } catch (e) { } }); };
      const api = {
        name,
        presence(patch) { for (const k in patch) { if (patch[k] === null) delete mine[k]; else mine[k] = patch[k]; } if (myId) { all[myId] = mine; seen[myId] = Date.now(); } schedule(); return Promise.resolve(); },
        onPeers(fn) { peerFns.push(fn); setTimeout(() => fn({ peers: last, joined: last, left: [], updated: [] }), 0); return () => { peerFns = peerFns.filter(f => f !== fn); }; },
        peers() { return last; },
        connected() { return alive && (host || (hubConn && hubConn.open)); },
        hubId() { return host ? myId : (hubConn ? hubConn.peer : null); },
        onDrop(fn) { dropFns.push(fn); },
        emit() { return Promise.resolve(); }, on() { return () => { }; },
        leave() { alive = false; try { peer && peer.destroy(); } catch (e) { } return Promise.resolve(); }
      };
      try { peer = host ? new Peer(PREFIX + name, Object.assign({ config: ICE, debug: 0 }, OPT)) : new Peer(Object.assign({ config: ICE, debug: 0 }, OPT)); } catch (e) { return fail('init', e.message); }
      const to = setTimeout(() => fail('timeout', '연결 시간이 초과됐습니다'), 15000);
      peer.on('error', e => {
        const t = e && e.type;
        if (!settled) { clearTimeout(to); return fail(t === 'unavailable-id' ? 'taken' : t === 'peer-unavailable' ? 'notfound' : (t || 'error'), e.message); }
        if (t === 'peer-unavailable' || t === 'network' || t === 'server-error') { if (!host) drop(t); }
      });
      peer.on('disconnected', () => { try { if (alive) peer.reconnect(); } catch (e) { } });
      peer.on('open', id => {
        myId = id; all[myId] = mine; seen[myId] = Date.now();
        if (host) {
          peer.on('connection', c => {
            c.on('open', () => { conns[c.peer] = c; try { c.send({ t: 'all', m: all }); } catch (e) { } });
            c.on('data', d => { if (!d || typeof d !== 'object') return; if (d.t === 'p' && d.p && typeof d.p === 'object') { all[c.peer] = d.p; seen[c.peer] = Date.now(); schedule(); } });
            const gone = () => { delete conns[c.peer]; delete all[c.peer]; schedule(); };
            c.on('close', gone); c.on('error', gone);
          });
          clearTimeout(to); settled = true; emitPeers(); resolve(api);
        } else {
          const c = hubConn = peer.connect(PREFIX + name, { reliable: true, serialization: 'json' });
          c.on('open', () => { clearTimeout(to); if (!settled) { settled = true; resolve(api); } flush(); });
          c.on('data', d => { if (!d || typeof d !== 'object' || d.t !== 'all' || !d.m || typeof d.m !== 'object') return; const now = Date.now(); all = {}; for (const id in d.m) { all[id] = d.m[id]; if (!seen[id]) seen[id] = now; } all[myId] = mine; emitPeers(); });
          c.on('close', () => drop('host-left'));
          c.on('error', () => drop('host-left'));
        }
      });
    });
  };
})(window.ET);
