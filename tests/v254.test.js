// ทดสอบ 2.54.0 — ฟีดคึกคัก
const { makeEnv } = require('./harness');
let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) pass++; else { fail++; console.log('FAIL:', name, extra !== undefined ? JSON.stringify(extra) : ''); } };
const quiet = () => { const o = console.log, i = console.info, w = console.warn; console.log = () => {}; console.info = () => {}; console.warn = () => {}; return () => { console.log = o; console.info = i; console.warn = w; }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const q = (E, s) => { const r = quiet(); try { return E.ev(s); } finally { r(); } };
const batch = (E, evs) => q(E, `ppApplySyncBatch({events:${JSON.stringify(evs)}}, 'a.png')`);

(async () => {
  const r0 = quiet();
  const E = makeEnv({ characters: [{ name: 'Aria', avatar: 'a.png' }], characterId: 0, name1: 'Mina', chat: [{ name: 'Aria', mes: 'hi' }] });
  await sleep(900);
  E.ev("getCfg().contacts.push({id:'a.png',name:'Aria',avatar:''},{id:'npc:b',name:'Bram',npc:true,ownerCharId:'a.png'}); getCfg().bridgeMods.feed = true; getCfg().bridgeMods.social = true; ppOpen()");
  r0();
  // แท็ก + รีลส์ + แซะ
  batch(E, [{ type: 'reel', author: 'Aria', text: 'ทะเลวันนี้', reel: 'คลื่นซัดเท้า มีเงาใครบางคนยืนอยู่', tags: ['Mina'] }]);
  let p = E.ev("getFeedPosts().slice(-1)[0]");
  ok(p && p.reel && /คลื่น/.test(p.reel) && p.taggedUser === true, 'reel + tag', p);
  batch(E, [{ type: 'post', author: 'Aria', text: 'บางคนก็ไม่รู้ตัวเลยเนอะ', about: 'Bram' }]);
  p = E.ev("getFeedPosts().slice(-1)[0]");
  ok(p.about === 'npc:b', 'vague post target hidden', p.about);
  // ไลฟ์
  batch(E, [{ type: 'live', from: 'Aria', title: 'ร้องเพลงก่อนนอน', viewers: 88, comments: [{ who: 'fan01', text: 'มาแล้ว' }] }]);
  ok(E.ev('ppFdActiveLives().length') === 1, 'live active');
  // เทรนด์ + โฆษณา
  batch(E, [{ type: 'trend', tag: '#อาเรียร้องไห้', volume: 15300, note: 'คลิปหลุดจากงาน' }, { type: 'ad', brand: 'ชานมบ้านมด', text: 'ซื้อ 1 แถม 1 วันนี้', cta: 'สั่งเลย' }]);
  ok(E.ev("ppFd().trends[0].tag") === 'อาเรียร้องไห้', 'trend stored');
  ok(E.ev("getFeedPosts().some(p=>p.kind==='ad'&&p.authorName==='ชานมบ้านมด')"), 'ad post');
  // แอคหลุมโดนจับ
  q(E, "ppAccounts().push({id:'alt1',owner:'user',name:'เงาจันทร์',handle:'moonshadow',knownBy:[]}); saveCfg()");
  batch(E, [{ type: 'alt_caught', from: 'Aria', account: '@moonshadow' }]);
  ok(E.ev("ppFindAccount('alt1').knownBy.includes('a.png')"), 'alt caught adds knownBy', E.ev("ppFindAccount('alt1')"));
  // หน้าฟีด
  q(E, "ppFeedTab='home'; ppNav('feed')");
  let html = E.w.document.getElementById('pp-feed-scroll').innerHTML;
  ok(/pp-fd-livebar/.test(html) && /pp-fd-seg/.test(html), 'live bar + seg');
  ok(/pp-fd-reel/.test(html) && /แท็กคุณ/.test(html) && /แซะใคร/.test(html), 'post extras render');
  ok(/ได้รับการสนับสนุน/.test(html) && /pp-fd-cta/.test(html), 'ad renders in scope');
  { const r = quiet(); E.w.document.querySelector('[data-px="fd-mode"][data-m="foryou"]').click(); r(); }
  ok(E.ev('ppFdMode') === 'foryou', 'for you mode');
  html = E.w.document.getElementById('pp-feed-scroll').innerHTML;
  ok(/ชานมบ้านมด/.test(html), 'for you shows ad');
  // หน้าสำรวจ
  q(E, "ppFeedTab='explore'; renderFeed()");
  ok(/เทรนด์ตอนนี้/.test(E.w.document.getElementById('pp-feed-scroll').innerHTML) && /15K/.test(E.w.document.getElementById('pp-feed-scroll').innerHTML), 'trends in explore');
  // ไลฟ์ห้อง
  const lid = E.ev('ppFdActiveLives()[0].id');
  q(E, `ppFdOpenLive(${JSON.stringify(lid)})`);
  ok(!!E.w.document.getElementById('pp-fd-live'), 'live screen');
  { const r = quiet(); E.w.document.getElementById('pp-fd-live-in').value = 'สู้ ๆ นะ'; E.w.document.querySelector('[data-px="live-send"]').click(); r(); }
  ok(E.ev("getCfg().actionLog.some(x=>/คอมเมนต์ในไลฟ์ของ Aria/.test(x.text))"), 'live comment logged');
  q(E, "clearInterval(ppFdLiveTimer); document.getElementById('pp-fd-live').remove()");
  batch(E, [{ type: 'live_end', from: 'Aria' }]);
  ok(E.ev('ppFdActiveLives().length') === 0, 'live end');
  // prompt
  const parts = q(E, "ppBuildBridgeParts('', 'x')");
  ok(/"type":"live"/.test(parts.mods.feed) && /alt_caught/.test(parts.mods.social), 'prompt lines');
  ok(!E.errors.length, 'no uncaught', E.errors.map(String));
  console.log(`\nPASS ${pass}  FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH', e); process.exit(1); });
