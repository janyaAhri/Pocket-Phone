// ทดสอบ 2.56.0 — โลกในเรื่อง
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
  E.ev("getCfg().contacts.push({id:'a.png',name:'Aria',avatar:''},{id:'npc:b',name:'Bram',npc:true,ownerCharId:'a.png'},{id:'npc:c',name:'Cleo',npc:true,ownerCharId:'a.png'}); getCfg().bridgeMods.life = true; ppOpen()");
  r0();
  // เวลาในเรื่อง: ปิดอยู่ = นาฬิกาไม่ขยับ
  ok(E.ev('getCfg().wdStoryTime') === false, 'story time off by default');
  let r = batch(E, [{ type: 'time_skip', hours: 8 }]);
  ok(r.applied === 1 && E.ev('ppWdNow() - Date.now()') < 1000, 'skip without story time keeps clock', r);
  ok(E.ev("getThread('a.png').some(m=>m.type==='sysline'&&/8 ชั่วโมงต่อมา/.test(m.text))"), 'skip divider');
  q(E, 'getCfg().wdStoryTime = true');
  batch(E, [{ type: 'time_jump', days: 1 }]);
  const off = E.ev('ppWdNow() - Date.now()');
  ok(off > 86390000 && off < 86410000, 'story time moves a day', off);
  const expect = E.ev('(()=>{const d=new Date(Date.now()+86400000);return d.getHours()+":"+String(d.getMinutes()).padStart(2,"0")})()');
  ok(E.ev('ppNow()') === expect, 'phone clock follows story', [E.ev('ppNow()'), expect]);
  ok(E.ev('ppWdSkipMs({to:"07:30"})') > 0 && E.ev('ppWdSkipMs({to:"07:30"})') <= 86400000, 'skip to time');
  ok(E.ev('ppWdSkipMs({to:"blah"})') === 0, 'unknown skip');
  ok(/In-story clock/.test(q(E, "ppPxStateMsg([{mes:'x'}])")), 'bot gets story clock');
  q(E, 'ppWdResetTime()');
  ok(E.ev('ppWd().offset') === 0, 'reset time');
  // อากาศ
  r = batch(E, [{ type: 'weather', cond: 'ฝนตกหนัก ฟ้าร้อง', temp: 24, place: 'สยาม' }]);
  ok(r.applied === 1 && E.ev('ppWdWeather().kind') === 'storm', 'weather storm', E.ev('ppWd().weather'));
  ok(/Current weather in the story \(สยาม\): ฝนตกหนัก ฟ้าร้อง, 24°C/.test(q(E, "ppPxStateMsg([{mes:'x'}])")), 'bot gets weather');
  q(E, "ppNav('home'); ppPxTick()");
  ok(!!E.w.document.querySelector('#pp-wd-fx.storm'), 'storm fx on home');
  ok(/ฝนตกหนัก/.test(E.w.document.getElementById('pp-px-today').innerHTML), 'weather in today widget');
  q(E, "getCfg().wdWeatherFx = false; ppWdApplyFx()");
  ok(!E.w.document.getElementById('pp-wd-fx'), 'fx switch off');
  q(E, 'getCfg().wdWeatherFx = true');
  ok(E.ev("ppWdWxKind('snowing hard')") === 'snow' && E.ev("ppWdWxKind('แดดจัดมาก')") === 'sun' && E.ev("ppWdWxKind('หมอกลง')") === 'fog', 'weather kinds');
  batch(E, [{ type: 'time_skip', hours: 10 }]);
  ok(E.ev('ppWdWeather()') === null, 'long skip expires weather');
  // ข่าวลือ
  r = batch(E, [{ type: 'rumor', about: 'Aria', text: 'อาเรียเลิกกับแฟนแล้ว', spread: [{ from: 'Bram', text: 'แกรู้ยัง อาเรียเลิกแล้วนะ', delay: 1 }, 'Cleo'] }]);
  ok(r.applied === 1 && E.ev('ppWd().rumors.length') === 1 && E.ev('ppWd().rumors[0].spreaders.length') === 2, 'rumor queued', E.ev('ppWd().rumors'));
  ok(E.ev('ppWdFlush()') === 0, 'not yet');
  ok(E.ev('ppWdFlush(Date.now() + 61000)') === 1 && E.ev("getThread('npc:b').slice(-1)[0].text") === 'แกรู้ยัง อาเรียเลิกแล้วนะ', 'first spreader arrives');
  ok(E.ev('ppWdFlush(Date.now() + 3600000)') === 1 && /อาเรียเลิกกับแฟนแล้ว/.test(E.ev("getThread('npc:c').slice(-1)[0].text")), 'template for second');
  ok(E.ev("ppBotLog().some(x=>/ข่าวลือ/.test(x.text))") && E.ev("getCfg().actionLog.some(x=>/ลือกันอยู่/.test(x.text))"), 'logs');
  ok(/Rumors going around/.test(q(E, "ppPxStateMsg([{mes:'x'}])")), 'bot knows rumor');
  // ไม่ได้ระบุคนส่งต่อ = เลือกคนนอกฉาก ไม่ใช่เจ้าของเรื่อง
  batch(E, [{ type: 'gossip', about: 'Bram', text: 'แบรมโดนไล่ออก' }]);
  const sp = E.ev('ppWd().rumors[1].spreaders.map(s=>s.cid)');
  ok(sp.length >= 1 && !sp.includes('npc:b') && !sp.includes('a.png'), 'auto spreaders off-scene', sp);
  // ออฟไลน์ = ค้าง
  q(E, 'ppCtrl().air = true');
  ok(E.ev('ppWdFlush(Date.now() + 99999999)') === 0, 'offline waits');
  q(E, 'ppCtrl().air = false');
  // หน้าตั้งค่า
  q(E, "getCfg().settingsPage = 'life'; ppNav('setpage'); renderSetPage()");
  const html = E.w.document.body.innerHTML;
  ok(/โลกในเรื่อง/.test(html) && /ข่าวลือล่าสุด/.test(html) && /pp-wd-story/.test(html), 'settings section');
  const o1 = E.ev('ppWd().offset');
  { const rr = quiet(); E.w.document.querySelector('[data-px="wd-plus"][data-h="1"]').click(); rr(); }
  const o2 = E.ev('ppWd().offset') - o1;
  ok(o2 >= 3599000 && o2 <= 3601000, '+1h button', o2);
  // prompt
  const parts = q(E, "ppBuildBridgeParts('', 'x')");
  ok(/time_skip/.test(parts.mods.life) && /rumor/.test(parts.mods.life) && /Off-scene friends/.test(parts.mods.life), 'prompt lines');
  ok(!E.errors.length, 'no uncaught', E.errors.map(String));
  console.log(`\nPASS ${pass}  FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH', e); process.exit(1); });
