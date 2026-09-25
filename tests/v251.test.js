// ทดสอบ 2.51.0 — ยุคของเครื่อง · โทเคนคีย์เวิร์ด · พื้นหลังแชท · ป๊อปอัพ · แผนที่
const { makeEnv } = require('./harness');
let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) pass++; else { fail++; console.log('FAIL:', name, extra !== undefined ? JSON.stringify(extra) : ''); } };
const quiet = () => { const o = console.log, i = console.info, w = console.warn; console.log = () => {}; console.info = () => {}; console.warn = () => {}; return () => { console.log = o; console.info = i; console.warn = w; }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const A = { name: 'Aria', avatar: 'a.png' };
async function boot() {
  const r = quiet();
  const E = makeEnv({ characters: [A], characterId: 0, name1: 'Mina', chat: [{ name: 'Aria', mes: 'hi' }] });
  await sleep(900);
  E.ev("getCfg().contacts.push({id:'a.png',name:'Aria',avatar:''})");
  r();
  return E;
}
const q = (E, s) => { const r = quiet(); try { return E.ev(s); } finally { r(); } };

(async () => {
  // ── ยุคของเครื่อง
  {
    const E = await boot();
    const f = () => E.w.document.getElementById('pp-frame');
    const ids = E.ev('PP_ERAS.map(e=>e.id)');
    ok(ids.length >= 13 && ids[0] === 'modern', 'eras list', ids);
    q(E, 'ppOpen()');
    ok(f().classList.contains('pp-lg'), 'modern keeps iGlass');
    const errs = [];
    for (const id of ids) {
      try { q(E, `ppEraSet(${JSON.stringify(id)})`); } catch (e) { errs.push(id + e.message); }
      if (id === 'modern') continue;
      ok(f().classList.contains('pp-era-' + id), 'era class ' + id);
      ok(!f().classList.contains('pp-lg') && !f().classList.contains('pp-themed'), 'era pauses iGlass ' + id);
      for (const sc of ['home', 'messages', 'pxmap', 'settings']) { try { q(E, `ppNav('${sc}')`); } catch (e) { errs.push(id + sc + e.message); } }
    }
    ok(!errs.length, 'every era renders', errs);
    q(E, "ppEraSet('mono')");
    ok(/data-appnav="feed"/.test(E.w.document.getElementById('pp-era-hide').textContent), 'mono hides feed');
    ok(!/data-appnav="messages"/.test(E.w.document.getElementById('pp-era-hide').textContent), 'mono keeps messages');
    ok(!!E.w.document.getElementById('pp-era-fx'), 'mono pixel fx');
    let chat = [{ is_user: true, mes: 'hello' }];
    E.w.ppGenInterceptor(chat, 4096, () => {}, 'normal');
    ok(chat.some(m => m.is_system && /monochrome green screen/.test(m.mes)), 'bot told era');
    q(E, "getCfg().eraHideApps = false; ppEraApply()");
    ok(E.w.document.getElementById('pp-era-hide').textContent === '', 'hide apps off');
    q(E, "getCfg().eraTellBot = false");
    chat = [{ is_user: true, mes: 'hello' }];
    E.w.ppGenInterceptor(chat, 4096, () => {}, 'normal');
    ok(!chat.some(m => /monochrome/.test(m.mes || '')), 'tell bot off');
    q(E, "ppEraSet('modern')");
    ok(f().classList.contains('pp-lg') && !f().className.includes('pp-era-mono'), 'modern restores iGlass');
    ok(!E.w.document.getElementById('pp-era-fx'), 'fx removed');
    q(E, "getCfg().settingsPage='era'; ppNav('setpage')");
    ok(E.w.document.querySelectorAll('.pp-era-card').length === ids.length, 'era page cards');
    { const r = quiet(); E.w.document.querySelector('.pp-era-card[data-id="fantasy"]').click(); r(); }
    ok(E.ev('getCfg().phoneEra') === 'fantasy' && f().classList.contains('pp-era-fantasy'), 'era pick click');
    ok(E.ev("getCfg().actionLog.some(x=>/กระจกเวทมนตร์/.test(x.text))"), 'era change logged');
    q(E, "ppApplyIglass(); ppApplyDeco()");
    ok(f().classList.contains('pp-era-fantasy') && !f().classList.contains('pp-lg'), 'era survives re-apply');
    ok(!E.errors.length, 'no uncaught', E.errors.map(String));
  }
  // ── โทเคนคีย์เวิร์ด
  {
    const E = await boot();
    q(E, "getCfg().bridgeTokenCache = { ok:true, tokenizer:'x', measuredAt:Date.now(), mods:{ core:100, msg:50, groupcall:40, feed:0, story:0, wallet:30, social:0, news:0, board:20, life:60, inv_contacts:10, actionlog:5 } }");
    q(E, "getCfg().kwEnabled = true; getCfg().kwPerMod = { groupcall:true, life:true, board:true }");
    // เทิร์นที่ไม่มีคีย์เวิร์ดเลย
    let chat = [{ is_user: true, mes: 'hello there' }];
    E.w.ppGenInterceptor(chat, 4096, () => {}, 'normal');
    let hist = E.ev('getCfg().kwTurnHist');
    ok(hist.length === 1 && hist[0].skipped.includes('life') && hist[0].sent.includes('msg'), 'turn recorded', hist);
    // เทิร์นที่มีคำว่าโทร
    chat = [{ is_user: true, mes: 'เดี๋ยวโทรหานะ' }];
    E.w.ppGenInterceptor(chat, 4096, () => {}, 'normal');
    const st = E.ev('ppKwTokenStats()');
    const on = E.ev("BRIDGE_MOD_META.filter(m=>bridgeOn(m.key)).map(m=>m.key)");
    const tok = { msg: 50, groupcall: 40, wallet: 30, board: 20, life: 60, inv_contacts: 10, actionlog: 5 };
    const full = 100 + on.reduce((a, k) => a + (tok[k] || 0), 0);
    ok(st.full === full, 'full cost', { st, full });
    // board ไม่มีคำค้นเริ่มต้น = ส่งตลอด จึงข้ามแค่ life
    ok(E.ev("ppKwWords('board').length") === 0 ? st.last === full - 60 : st.last === full - 60 - 20, 'last turn: groupcall sent, life skipped', st);
    ok(st.avg < st.full && st.saved > 0 && st.pct > 0, 'avg saves', st);
    ok(st.freq.groupcall.n === 1 && st.freq.groupcall.of === 2, 'freq', st.freq);
    // วัดโทเคนต้องไม่ทับผลเทิร์นจริง
    const before = JSON.stringify(E.ev('getCfg().kwLastHit'));
    q(E, "ppKwMeasuring = true; ppBuildBridgeParts('', 'nothing'); ppKwMeasuring = false");
    ok(JSON.stringify(E.ev('getCfg().kwLastHit')) === before, 'measure keeps last hit');
    const parts = q(E, "(ppKwMeasuring = true, (() => { try { return ppBuildBridgeParts('', 'nothing'); } finally { ppKwMeasuring = false; } })())");
    ok(parts.mods.life && parts.mods.groupcall, 'measure bypasses keyword gate');
    q(E, "getCfg().settingsPage='bridge'; ppNav('setpage')");
    const html = E.w.document.getElementById('pp-setpage-body').innerHTML;
    ok(/จ่ายจริงเฉลี่ยต่อเทิร์น/.test(html) && /pp-kwstat/.test(html) && /ส่งจริง 1\/2 เทิร์น/.test(html), 'bridge page shows real cost');
    ok(/^~\d+ tok$/.test(E.ev("ppSetPageValue('bridge')")), 'settings index shows avg', E.ev("ppSetPageValue('bridge')"));
    ok(E.ev("PP_KW_DEFAULT.life").includes('อีเมล'), 'life keywords');
    ok(st.fixed === st.full - st.gatedFull && st.fixed >= st.core, 'fixed vs gated split', st);
    ok(/ส่งทุกเทิร์นแน่นอน/.test(html) && /คีย์เวิร์ดคุมได้แค่/.test(html), 'split shown');
    ok(E.ev("getCfg().kwLastWord.groupcall") === 'โทร', 'trigger word recorded', E.ev('getCfg().kwLastWord'));
    ok(/เจอคำว่า "โทร"/.test(html), 'trigger word shown');
    // คำสั้นที่เคยตรงทุกประโยคต้องไม่ตรงแล้ว
    q(E, "getCfg().kwPerMod = { feed:true, groupcall:true, wallet:true, life:true }; getCfg().bridgeMods.feed = true");
    const hay = 'เธอเดินลงมาพร้อมสายตาที่มีค่า ถนัดมือซ้าย แล้วเดินตามไป';
    ['feed', 'groupcall', 'wallet', 'life'].forEach(k => ok(E.ev(`ppKwMatchWord('${k}', ${JSON.stringify(hay)})`) === '', 'no false hit ' + k, E.ev(`ppKwMatchWord('${k}', ${JSON.stringify(hay)})`)));
    ok(E.ev(`ppKwMatchWord('feed', 'เดี๋ยวลงไอจีให้ดู')`) === 'ลงไอจี', 'real hit feed');
  }
  // ── พื้นหลังแชท
  {
    const E = await boot();
    q(E, "getChatStyle('a.png').bg = Object.keys(CHAT_BGS).find(k=>k && k!=='mesh') || ''; ppActiveContact=findContact('a.png'); ppActiveGroup=null; ppNav('chat')");
    await sleep(50);
    const layer = E.w.document.getElementById('pp-chat-bgl');
    const msgs = E.w.document.getElementById('pp-msgs');
    ok(layer && layer.parentElement.id === 'pp-scr-chat', 'bg layer pinned to chat screen');
    ok(layer && layer.style.background !== '', 'bg on layer', layer && layer.style.background);
    ok(msgs.style.backgroundImage === '' && msgs.style.background === '', 'msgs has no bg');
    q(E, "getChatStyle('a.png').bg = 'mesh'; applyChatStyle()");
    await sleep(20);
    ok(layer.classList.contains('gx-bg-mesh') && !msgs.classList.contains('gx-bg-mesh'), 'mesh on layer');
    const css = E.w.document.getElementById('pp-px-css').textContent;
    ok(/#pp-frame \.pp-ov\{[^}]*backdrop-filter:blur\(16px\)/.test(css), 'popup blur css');
    ok(/#pp-scr-chat\.has-chatbg \.pp-msgs::before\{content:none/.test(css), 'deco bg moved to layer');
  }
  // ── แผนที่
  {
    const E = await boot();
    q(E, "ppPx().myLoc='บ้าน'; ppNav('pxmap')");
    ok(!!E.w.document.getElementById('pp-px-map-world'), 'map world');
    const z0 = E.ev('ppPxMapView.z');
    q(E, 'ppPxMapZoom(1.5)');
    ok(E.ev('ppPxMapView.z') > z0, 'zoom in');
    q(E, 'ppPxMapZoom(100)');
    ok(E.ev('ppPxMapView.z') === 3, 'zoom clamp');
    q(E, 'ppPxMapView.x = 99999; ppPxMapApply()');
    ok(E.ev('ppPxMapView.x') <= 0, 'pan clamp');
    q(E, "ppPxMapDragged = true");
    q(E, "0"); { const r = quiet(); const pin = E.w.document.querySelector('.pp-px-mappin'); if (pin) pin.click(); r(); }
    ok(E.ev('ppPxMapDragged') === false, 'drag suppresses pin tap once');
  }
  console.log(`\nPASS ${pass}  FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH', e); process.exit(1); });
