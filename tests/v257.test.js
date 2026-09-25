// ทดสอบ 2.57.0 — หน้าตาและลูกเล่น
const { makeEnv } = require('./harness');
let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) pass++; else { fail++; console.log('FAIL:', name, extra !== undefined ? JSON.stringify(extra) : ''); } };
const quiet = () => { const o = console.log, i = console.info, w = console.warn; console.log = () => {}; console.info = () => {}; console.warn = () => {}; return () => { console.log = o; console.info = i; console.warn = w; }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const q = (E, s) => { const r = quiet(); try { return E.ev(s); } finally { r(); } };

(async () => {
  const r0 = quiet();
  const E = makeEnv({ characters: [{ name: 'Aria', avatar: 'a.png' }], characterId: 0, name1: 'Mina', chat: [{ name: 'Aria', mes: 'hi' }] });
  // เสียงสังเคราะห์ปลอม นับจำนวนโน้ต
  E.w.__notes = 0;
  E.w.AudioContext = function () { return { state: 'running', currentTime: 0, destination: {},
    createOscillator() { return { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() { E.w.__notes++; }, stop() {} }; },
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; } }; };
  await sleep(900);
  E.ev("getCfg().contacts.push({id:'a.png',name:'Aria',avatar:''},{id:'npc:b',name:'Bram',npc:true,ownerCharId:'a.png'}); getCfg().dynamicIsland = true; ppOpen()");
  r0();
  // ชื่อแอพตามยุค
  ok(E.ev("ppLkLabel({nav:'messages',label:'ข้อความ'})") === 'ข้อความ', 'modern keeps label');
  q(E, "ppEraSet('fantasy')");
  ok(E.ev("ppLkLabel({nav:'messages',label:'ข้อความ'})") === 'สาส์นเวท', 'fantasy label');
  ok(/สาส์นเวท/.test(E.w.document.getElementById('pp-home').innerHTML), 'grid re-rendered with era label');
  q(E, "getCfg().eraLang = false");
  ok(E.ev("ppLkLabel({nav:'messages',label:'ข้อความ'})") === 'ข้อความ', 'era label switch off');
  q(E, "getCfg().eraLang = true; ppEraSet('modern')");
  ok(!/สาส์นเวท/.test(E.w.document.getElementById('pp-home').innerHTML), 'back to modern labels');
  // ซูมจากไอคอน
  q(E, "ppNav('home'); ppLkIcon = {x:100,y:200,t:Date.now()}; ppNav('messages')");
  ok(E.w.document.getElementById('pp-scr-messages').classList.contains('pp-anim-zoom') || E.w.document.getElementById('pp-scr-messages').classList.contains('pp-anim-in'), 'open anim applied');
  q(E, "ppNav('home'); getCfg().lkZoomAnim = false; ppLkIcon = {x:1,y:1,t:Date.now()}");
  ok(E.ev("ppLkOpenClass(document.getElementById('pp-scr-feed'))") === 'pp-anim-in', 'zoom switch off');
  q(E, 'getCfg().lkZoomAnim = true');
  // Live Activity
  q(E, "ppPx().orders.push({id:'o1',item:'ชานมไข่มุก',placed:Date.now(),eta:Date.now()+600000,done:false}); ppIslandState = null; islandRefresh()");
  const isl = () => E.w.document.getElementById('pp-island');
  ok(isl().classList.contains('pp-island-compact') && /ชานมไข่มุก/.test(isl().innerHTML) && /10 นาที/.test(isl().innerHTML), 'delivery live activity', isl().innerHTML);
  q(E, "islandNotify(findContact('npc:b'), 'สวัสดี')");
  ok(!isl().classList.contains('pp-island-compact') && /สวัสดี/.test(isl().innerHTML), 'notification takes over');
  q(E, 'islandCollapse()');
  ok(isl().classList.contains('pp-island-compact'), 'live activity returns');
  q(E, "ppActiveContact = findContact('a.png'); ppStartCall(); ppCall.connected = true; ppCall.startTs = Date.now() - 65000; ppNav('home'); ppIslandState = null; islandRefresh()");
  ok(/1:0[45]/.test(isl().innerHTML) && /Aria/.test(isl().innerHTML), 'call live activity timer', isl().innerHTML);
  { const r = quiet(); isl().querySelector('[data-px="lk-go"]').click(); r(); }
  ok(E.ev('ppCurrentScreen') === 'call', 'tap returns to call');
  q(E, 'ppEndCall()');
  q(E, "getCfg().lkLive = false; ppIslandState = null; islandRefresh()");
  ok(!isl().classList.contains('pp-island-compact'), 'live switch off');
  q(E, 'getCfg().lkLive = true');
  // เสียงข้อความ
  q(E, "ppLkLastTone = 0; islandNotify(findContact('npc:b'), 'hi')");
  ok(E.w.__notes === 0, 'default no tone');
  q(E, "getCfg().lkMsgTone = 'tri'; ppLkLastTone = 0; islandNotify(findContact('npc:b'), 'hi')");
  ok(E.w.__notes === 3, 'global tone plays 3 notes', E.w.__notes);
  q(E, "getChatStyle('npc:b').msgTone = 'pop'; ppLkLastTone = 0; islandNotify(findContact('npc:b'), 'hi')");
  ok(E.w.__notes === 5, 'per-contact tone', E.w.__notes);
  q(E, "getChatStyle('npc:b').msgTone = 'none'; ppLkLastTone = 0; islandNotify(findContact('npc:b'), 'hi')");
  ok(E.w.__notes === 5, 'per-contact silent');
  q(E, "ppLkLastTone = 0; islandNotify(findContact('a.png'), 'สายเรียกเข้า')");
  ok(E.w.__notes === 5, 'calls do not play message tone');
  // หน้าล็อก
  q(E, "getCfg().lkLockFont = 'serif'; getCfg().lkLockColor = '#ffcc00'; getCfg().lkLockPos = 'top'; getCfg().lkLockClear = true; getCfg().lockOn = true; document.getElementById('pp-lock')?.remove(); ppShowLock()");
  const lock = E.w.document.getElementById('pp-lock');
  ok(lock && lock.classList.contains('pp-lk-top') && lock.classList.contains('pp-lk-clear') && !!lock.querySelector('.pp-lk-lockwp'), 'lock decorated');
  ok(/Georgia/.test(lock.querySelector('.pp-lock-clock').style.cssText) && /255, 204, 0|#ffcc00/i.test(lock.querySelector('.pp-lock-clock').style.cssText), 'lock font and color', lock.querySelector('.pp-lock-clock').style.cssText);
  q(E, "document.getElementById('pp-lock').remove(); getCfg().lockOn = false");
  // วอลเปเปอร์มีมิติ
  q(E, "saveMedia('home-wp-depth', 'data:image/png;base64,iVBORw0KGgo='); getCfg().lkDepth = true");
  await q(E, 'ppLkApplyDepth()');
  await sleep(50);
  const dep = E.w.document.getElementById('pp-lk-depth');
  ok(dep && /data:image\/png/.test(dep.style.backgroundImage) && dep.previousElementSibling && dep.previousElementSibling.id === 'pp-home-date', 'depth layer after clock/date');
  // หน้าตั้งค่า
  q(E, "getCfg().settingsPage = 'lockfx'; ppNav('setpage'); renderSetPage()");
  const html = E.w.document.getElementById('pp-setpage-body').innerHTML;
  ok(/หน้าล็อก/.test(html) && /วอลเปเปอร์มีมิติ/.test(html) && /pp-lk-tone/.test(html) && /pp-lk-live/.test(html), 'settings page');
  { const r = quiet(); E.w.document.querySelector('[data-px="lk-font"][data-id="hand"]').click(); r(); }
  ok(E.ev('getCfg().lkLockFont') === 'hand', 'pick font');
  // ตั้งค่าแชท
  q(E, "ppActiveContact = findContact('npc:b'); ppActiveGroup = null; ppNav('chatsettings')");
  const sel = E.w.document.getElementById('pp-lk-ctone');
  ok(!!sel, 'per-chat tone select');
  if (sel) { const r = quiet(); sel.value = 'chime'; sel.dispatchEvent(new E.w.Event('change', { bubbles: true })); r(); }
  ok(E.ev("getChatStyle('npc:b').msgTone") === 'chime', 'per-chat tone saved');
  ok(!E.errors.length, 'no uncaught', E.errors.map(String));
  console.log(`\nPASS ${pass}  FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH', e); process.exit(1); });
