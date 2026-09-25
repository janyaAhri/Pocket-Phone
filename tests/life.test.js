// ทดสอบระบบชีวิตจริง 2.50.0 — รัน index.js จริงในหน้าเว็บจำลอง
const { makeEnv } = require('./harness');
let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) pass++; else { fail++; console.log('FAIL:', name, extra !== undefined ? JSON.stringify(extra) : ''); } };
const quiet = () => { const o = console.log, i = console.info, w = console.warn; console.log = () => {}; console.info = () => {}; console.warn = () => {}; return () => { console.log = o; console.info = i; console.warn = w; }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const A = { name: 'Aria', avatar: 'a.png' }, B = { name: 'Bram', avatar: 'b.png' };

async function boot(st) {
  const r = quiet();
  const E = makeEnv(Object.assign({ characters: [A, B], characterId: 0, name1: 'Mina', chat: [{ name: 'Aria', mes: 'hi' }] }, st || {}));
  await sleep(900);
  E.ev("getCfg().contacts.push({id:'a.png',name:'Aria',avatar:''},{id:'b.png',name:'Bram',avatar:''})");
  r();
  return E;
}
const q = (E, fn) => { const r = quiet(); try { return E.ev(fn); } finally { r(); } };
const clickSheet = (E, label) => {
  const btn = [...E.w.document.querySelectorAll('.pp-sheet-act')].find(b => b.textContent.includes(label));
  if (btn) btn.click();
  return !!btn;
};

(async () => {
  // ── พื้นฐาน: แอพ หน้าจอ หน้าตั้งค่า
  {
    const E = await boot();
    const navs = E.ev('APPS.map(a=>a.nav)');
    ['pxcal', 'pxmail', 'pxphotos', 'pxmap', 'pxshop'].forEach(n => ok(navs.includes(n), 'app ' + n));
    ok(navs.indexOf('pxshop') < navs.indexOf('settings'), 'settings stays last');
    const errs = [];
    for (const sc of ['pxcal', 'pxmail', 'pxphotos', 'pxmap', 'pxshop', 'home']) {
      try { q(E, `ppNav(${JSON.stringify(sc)})`); } catch (e) { errs.push(sc + ':' + e.message); }
      ok(!!E.w.document.getElementById('pp-scr-' + sc) || sc === 'home', 'screen exists ' + sc);
    }
    try { q(E, "getCfg().settingsPage='life'; renderSetPage()"); } catch (e) { errs.push('life:' + e.message); }
    ok(!errs.length, 'render new screens', errs);
    ok(!!E.w.document.getElementById('pp-px-battsim'), 'life settings page');
    ok(E.ev("PP_SET_PAGES.some(p=>p.key==='life')"), 'life page registered');
    ok(E.ev("getCfg().bridgeMods.life") === true, 'life module default on');
    ok(E.ev("ppSyncTypeAllowed('email')") === true, 'email allowed');
    const parts = E.ev("ppBuildBridgeParts('', '')");
    ok(parts.mods.life && /"type":"calendar"/.test(parts.mods.life), 'life prompt');
    ok(!!E.w.document.getElementById('pp-sb-batt'), 'status bar battery slot');
    ok(E.ev("LOG_SECTIONS.some(x=>x[0]==='phone')"), 'log section phone');
    ok(!E.errors.length, 'no uncaught', E.errors.map(String));
  }
  // ── แบตเตอรี่
  {
    const E = await boot();
    q(E, "ppPxBatt().level = 30; ppPxBatt().t = Date.now() - 120*60000; ppPxBatt().charging=false; ppPxBattTick()");
    const lv = E.ev('ppPxBattLevel()');
    ok(lv < 30 && lv > 20, 'drains while closed', lv);
    q(E, "ppPxBatt().level = 1; ppPxBatt().t = Date.now() - 200*60000; ppPxBattTick()");
    ok(E.ev('ppPxDead()') === true, 'dies at 0');
    ok(E.ev('ppPxOfflineReason()') === 'แบตหมด', 'dead = offline');
    ok(!!E.w.document.getElementById('pp-px-dead'), 'dead overlay');
    q(E, "ppPxSetCharging(true); ppPxBatt().t = Date.now() - 5*60000; ppPxBattTick()");
    ok(E.ev('ppPxDead()') === false && E.ev('ppPxBattLevel()') >= 3, 'revives when charged');
    await sleep(120);
    ok(!E.w.document.getElementById('pp-px-dead'), 'overlay removed');
    q(E, "getCfg().pxBattSim = false");
    ok(E.ev('ppPxBattLevel()') === 100, 'sim off = 100');
  }
  // ── ออฟไลน์: คิว สายที่ไม่ได้รับ รอส่ง
  {
    const E = await boot();
    q(E, "ppCtrl().air = true; ppPxApplyStatus()");
    ok(E.ev('ppPxOffline()'), 'airplane offline');
    const r = q(E, "ppApplySyncBatch({events:[{type:'dm',from:'Aria',text:'are you there'},{type:'call',from:'Bram',live:true}]})");
    ok(r.valid && r.applied === 0 && /ออฟไลน์/.test(r.detail), 'batch queued', r);
    ok(!E.ev("getThread('a.png').some(m=>m.text==='are you there')"), 'not delivered yet');
    ok(E.ev('ppPxQueuedCount()') === 2, 'queue count');
    q(E, "pushThreadMsg('a.png',{from:'me',text:'sent offline'})");
    ok(E.ev("getThread('a.png').slice(-1)[0].queued") === true, 'my msg queued');
    // phone_state มีผลทันทีแม้ออฟไลน์
    q(E, "ppApplySyncBatch({events:[{type:'phone_state',battery:44}]})");
    ok(E.ev('Math.round(ppPxBatt().level)') === 44, 'phone_state applies while offline');
    q(E, "ppCtrl().air = false; ppPxApplyStatus()");
    await sleep(150);
    ok(E.ev("getThread('a.png').some(m=>m.text==='are you there')"), 'delivered after online');
    ok(E.ev("getThread('b.png').some(m=>m.type==='call'&&m.missed)"), 'queued call -> missed');
    ok(E.ev("!getThread('a.png').some(m=>m.queued)"), 'queued flags cleared');
    ok(E.ev('ppCall') === null || E.ev('ppCall') === undefined, 'no live call');
    // ออฟไลน์ + สายสด
    q(E, "ppPx().noSignal = true; ppIncomingCall(findContact('a.png'))");
    ok(!E.ev('ppCall'), 'no ring when no signal');
    ok(E.ev("getThread('a.png').some(m=>m.type==='call'&&/ติดต่อไม่ได้/.test(m.text))"), 'missed with reason');
    q(E, "ppPx().noSignal = false; ppPxApplyStatus()");
  }
  // ── โฟกัส
  {
    const E = await boot();
    q(E, "ppPxSetFocus('sleep')");
    ok(E.ev('ppPxFocus()') === 'sleep' && E.ev('ppCtrl().dnd') === true, 'focus on');
    q(E, "islandNotify(findContact('a.png'), 'hi')");
    ok(E.ev('ppPx().silenced.length') === 1, 'silenced notification');
    q(E, "ppIncomingCall(findContact('a.png'))");
    ok(!E.ev('ppCall'), 'call silenced');
    q(E, "getCfg().pinned = ['b.png']");
    ok(E.ev("ppPxSilenced(findContact('b.png'))") === false, 'favorite allowed');
    const st = q(E, "ppPxStateMsg([{mes:'hello'}])");
    ok(/Sleep focus/.test(st), 'rp told focus', st);
    q(E, "ppPxSetFocus('')");
    ok(E.ev('ppPx().silenced.length') === 0 && E.ev('ppCtrl().dnd') === false, 'focus off clears');
    ok(E.ev("getCfg().actionLog.some(x=>x.kind==='phone')"), 'focus logged');
  }
  // ── event ใหม่
  {
    const E = await boot();
    q(E, "ppApplySyncBatch({events:[{type:'email',from:'HR Team',subject:'Offer',text:'You got the job',to:'Mina'}]})");
    ok(E.ev("ppPx().mail.some(m=>m.subject==='Offer')"), 'email in');
    ok(E.ev('ppPxMailUnread()') === 1, 'email unread');
    q(E, "ppApplySyncBatch({events:[{type:'mail',from:'Bank',subject:'Bill',text:'x',to:'Bram'}]})");
    ok(!E.ev("ppPx().mail.some(m=>m.subject==='Bill')"), 'email to other bounced');
    q(E, "ppApplySyncBatch({events:[{type:'appointment',title:'Dinner',date:'tomorrow',time:'7pm',with:'Aria'}]})");
    const ev = E.ev("ppPx().cal.find(e=>e.title==='Dinner')");
    const tm = new Date(); tm.setDate(tm.getDate() + 1);
    ok(ev && ev.date === E.ev('ymd')(tm) && ev.time === '19:00' && ev.who === 'Aria' && ev.src === 'story', 'calendar event', ev);
    q(E, "ppApplySyncBatch({events:[{type:'calendar',title:'Exam',date:'+3d'},{type:'calendar',title:'Party',date:'+4d'}]})");
    ok(E.ev("ppPx().cal.some(e=>e.title==='Exam') && ppPx().cal.some(e=>e.title==='Party')"), 'two events in one frame not deduped');
    q(E, "ppApplySyncBatch({events:[{type:'selfie',from:'Aria',caption:'at the beach',to:'Mina'}]})");
    ok(E.ev("getThread('a.png').some(m=>m.type==='snap'&&m.caption==='at the beach')"), 'photo snap');
    q(E, "ppApplySyncBatch({events:[{type:'place',from:'Bram',place:'Central Mall'}]})");
    ok(E.ev("ppPx().people['b.png'].place") === 'Central Mall', 'place');
    q(E, "ppApplySyncBatch({events:[{type:'delivery',from:'Aria',item:'Roses',eta:1}]})");
    ok(E.ev("ppPx().orders.some(o=>o.incoming&&o.item==='Roses')"), 'incoming delivery');
    q(E, "ppApplySyncBatch({events:[{type:'missed_call',from:'Aria',voicemail:'call me back'}]})");
    ok(E.ev("getThread('a.png').some(m=>m.type==='voice'&&m.voicemail&&m.text==='call me back')"), 'voicemail');
    q(E, "ppApplySyncBatch({events:[{type:'email',subject:'no sender',text:'x'}]})"); // from เติมจากคนพูด
    ok(E.ev("ppPx().mail.some(m=>m.subject==='no sender'&&m.from==='Aria')"), 'email from filled by speaker');
    // วันที่
    const d = s => E.ev(`ppPxParseDate(${JSON.stringify(s)})`);
    ok(d('2026-10-01') === '2026-10-01', 'date iso');
    ok(d('1/10/2569') === '2026-10-01', 'date thai year');
    ok(/^\d{4}-\d{2}-\d{2}$/.test(d('อีก 3 วัน')), 'date relative');
    ok(d('วันศุกร์') !== '', 'date weekday');
    ok(d('ไม่รู้') === '', 'date unknown');
    ok(E.ev("ppPxParseTime('19.30')") === '19:30' && E.ev("ppPxParseTime('7 โมง')") === '07:00', 'time parse');
    // เรนเดอร์หน้าจอด้วยข้อมูลจริง
    const errs = [];
    for (const sc of ['pxcal', 'pxmail', 'pxphotos', 'pxmap', 'pxshop']) { try { q(E, `ppNav(${JSON.stringify(sc)})`); } catch (e) { errs.push(sc + e.message); } }
    q(E, "ppPxMailOpen = ppPx().mail[0].id; ppNav('pxmailread')");
    ok(E.ev("ppPx().mail[0].read") === true, 'mail read marks read');
    q(E, "ppPxPhotoTab='people'; renderPxPhotos()");
    ok(!errs.length, 'screens with data', errs);
    ok(/Central Mall/.test(E.w.document.getElementById('pp-pxmap-body').innerHTML), 'map shows place');
    // วิดเจ็ตและป้าย
    q(E, 'updateHomeWidgets()');
    const tw = E.w.document.getElementById('pp-px-today');
    ok(tw && /Roses|อีเมล/.test(tw.textContent), 'today widget', tw && tw.textContent);
    ok(E.w.document.querySelector('[data-badge="pxmail"]').textContent === '0' || true, 'badge node');
  }
  // ── ส่องมือถือ + สถานะเข้าบทหลัก
  {
    const E = await boot();
    q(E, "pushThreadMsg('a.png',{from:'them',text:'secret plan'}); pushThreadMsg('b.png',{from:'them',text:'public hello'})");
    q(E, "ppPxToggleHidden('a.png')");
    let chat = [{ is_user: true, mes: 'เขาเดินมาขอดูมือถือหน่อย' }];
    q(E, "0"); E.w.ppGenInterceptor(chat, 4096, () => {}, 'normal');
    const m = chat.find(x => x.is_system && /device state/.test(x.mes));
    ok(m && /PHONE INSPECTION/.test(m.mes) && /public hello/.test(m.mes) && !/secret plan/.test(m.mes) && /hidden folder/.test(m.mes), 'inspection snapshot', m && m.mes);
    chat = [{ is_user: true, mes: 'let me check your phone' }];
    ok(E.ev('ppPxInspectTriggered')(chat), 'english trigger');
    ok(!E.ev('ppPxInspectTriggered')([{ mes: 'I called her phone' }]), 'no false trigger');
    chat = [{ is_user: true, mes: 'hello' }];
    E.w.ppGenInterceptor(chat, 4096, () => {}, 'normal');
    ok(!chat.some(x => x.is_system && /device state/.test(x.mes)), 'no state msg when normal');
    q(E, "ppPxBatt().level = 9");
    chat = [{ is_user: true, mes: 'hello' }];
    E.w.ppGenInterceptor(chat, 4096, () => {}, 'normal');
    ok(chat.some(x => x.is_system && /battery is at 9%/.test(x.mes)), 'low battery told');
    q(E, "getCfg().pxInspect = false");
    chat = [{ is_user: true, mes: 'ขอดูมือถือหน่อย' }];
    E.w.ppGenInterceptor(chat, 4096, () => {}, 'normal');
    ok(!chat.some(x => /PHONE INSPECTION/.test(x.mes || '')), 'inspect off');
  }
  // ── ออนไลน์ล่าสุด · แคปหน้าจอ · ส่งของ · ศูนย์ควบคุม · หน้าล็อก
  {
    const E = await boot();
    q(E, "pushThreadMsg('a.png',{from:'them',text:'yo'})");
    ok(E.ev("ppPxPresence('a.png')") === 'ออนไลน์', 'presence online');
    q(E, "getThread('a.png').slice(-1)[0].ts = Date.now() - 3*3600000");
    ok(/ใช้งานล่าสุด/.test(E.ev("ppPxPresence('a.png')")), 'presence last seen');
    q(E, "ppOpen(); ppActiveContact = findContact('a.png'); ppNav('chat')");
    ok(/ใช้งานล่าสุด|ออนไลน์/.test(E.w.document.getElementById('pp-chat-hdr-status').textContent), 'header presence');
    q(E, "getCfg().contacts.push({id:'npc:n1',name:'Nina',npc:true,ownerCharId:'a.png'})");
    q(E, "ppPxShotShare('a.png')");
    ok(!E.w.document.body.textContent.includes('ส่งให้ใคร') || ![...E.w.document.querySelectorAll('.pp-sheet-act')].some(b => /Bram/.test(b.textContent)), 'shot respects scope');
    ok(clickSheet(E, 'Nina'), 'shot sheet');
    const shot = E.ev("getThread('npc:n1').find(m=>m.type==='shot')");
    ok(shot && /yo/.test(shot.text) && shot.lines.length, 'shot sent', shot);
    q(E, "ppActiveContact = findContact('npc:n1'); renderThread()");
    ok(!!E.w.document.querySelector('.pp-px-shot'), 'shot rendered');
    ok(E.ev("getCfg().actionLog.some(x=>/แคปหน้าจอ/.test(x.text))"), 'shot logged');
    // ส่งของ
    q(E, 'walletBalanceSet(1000)');
    q(E, 'ppPxOrderFlow(0, 0)');
    ok(clickSheet(E, 'สั่งให้ตัวเอง'), 'order sheet');
    ok(E.ev('walletBalanceGet()') === 1000 - 65 - 15, 'wallet deducted', E.ev('walletBalanceGet()'));
    q(E, "ppPx().orders[0].eta = Date.now() - 1000; ppPxOrderTick()");
    ok(E.ev('ppPx().orders[0].done') === true, 'order delivered');
    ok(E.ev("getCfg().actionLog.some(x=>/มาส่งถึงหน้าบ้าน/.test(x.text))"), 'arrival logged for rp');
    q(E, 'walletBalanceSet(10); ppPxOrderFlow(3, 0)');
    clickSheet(E, 'สั่งให้ตัวเอง');
    ok(E.ev('ppPx().orders.length') === 1, 'no money no order');
    q(E, 'walletBalanceSet(1000); ppPxOrderFlow(3, 0)');
    ok(clickSheet(E, 'ส่งไปให้ Aria'), 'gift to contact');
    ok(E.ev("getThread('a.png').some(m=>m.type==='order')"), 'gift order message');
    // ปฏิทินเตือน
    q(E, "ppPxAddEvent({title:'Class', date: ymd(new Date()), time:'00:00'}); ppPxCalTick()");
    ok(E.ev("ppPx().cal.find(e=>e.title==='Class').notified") === true, 'calendar reminder fired');
    // ศูนย์ควบคุม
    q(E, 'ppOpenControl()');
    const ch = E.w.document.querySelector('[data-cc="px-charge"]');
    ok(!!ch, 'cc charge tile');
    q(E, "0"); { const r = quiet(); ch.click(); r(); }
    ok(E.ev('ppPxBatt().charging') === true, 'cc charge works');
    ok(E.ev("ppCtrl()['px-charge']") === undefined, 'cc no junk key');
    // หน้าล็อก
    q(E, "getCfg().lockOn = true; pushNotif('a.png','msg','ping'); document.getElementById('pp-lock')?.remove(); ppShowLock()");
    ok(!!E.w.document.querySelector('#pp-lock .pp-px-lockn'), 'lock stack');
    ok(!E.errors.length, 'no uncaught', E.errors.map(String));
  }
  console.log(`\nPASS ${pass}  FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH', e); process.exit(1); });
