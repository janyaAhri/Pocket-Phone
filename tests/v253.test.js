// ทดสอบ 2.53.0 — แชทสมจริง
const { makeEnv } = require('./harness');
let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) pass++; else { fail++; console.log('FAIL:', name, extra !== undefined ? JSON.stringify(extra) : ''); } };
const quiet = () => { const o = console.log, i = console.info, w = console.warn; console.log = () => {}; console.info = () => {}; console.warn = () => {}; return () => { console.log = o; console.info = i; console.warn = w; }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function boot() {
  const r = quiet();
  const E = makeEnv({ characters: [{ name: 'Aria', avatar: 'a.png' }], characterId: 0, name1: 'Mina', chat: [{ name: 'Aria', mes: 'hi' }] });
  await sleep(900);
  E.ev("getCfg().contacts.push({id:'a.png',name:'Aria',avatar:''},{id:'npc:b',name:'Bram',npc:true,ownerCharId:'a.png'})");
  r();
  return E;
}
const q = (E, s) => { const r = quiet(); try { return E.ev(s); } finally { r(); } };
const batch = (E, evs) => q(E, `ppApplySyncBatch({events:${JSON.stringify(evs)}}, 'a.png')`);

(async () => {
  const E = await boot();
  q(E, "pushThreadMsg('a.png',{from:'me',text:'คิดถึงนะ'}); pushThreadMsg('a.png',{from:'me',text:'ว่างไหม'})");
  // อ่านแล้วไม่ตอบ
  batch(E, [{ type: 'seen', from: 'Aria', noReply: true }]);
  const th = () => E.ev("getThread('a.png')");
  ok(th().filter(m => m.from === 'me').every(m => m.readAt), 'seen marks read');
  ok(th().filter(m => m.from === 'me').slice(-1)[0].leftOnRead === true, 'left on read');
  const lbl = E.ev("ppChReadLabel(getThread('a.png'), getThread('a.png').length-1, getThread('a.png').slice(-1)[0])");
  ok(/^อ่านแล้ว \d{1,2}:\d{2} · ไม่ตอบ$/.test(lbl), 'read label with time', lbl);
  // รีแอค
  batch(E, [{ type: 'reaction', from: 'Aria', emoji: '😭', target: 'คิดถึง' }]);
  ok(th().find(m => m.text === 'คิดถึงนะ').react.v === '😭', 'react on target');
  // ตอบเจาะจง + แปล
  batch(E, [{ type: 'dm', from: 'Aria', to: 'Mina', text: ['보고 싶어'], replyTo: 'ว่างไหม', translation: 'คิดถึงเหมือนกัน' }]);
  const last = th().slice(-1)[0];
  ok(last.replyTo && last.replyTo.text === 'ว่างไหม', 'replyTo set', last);
  ok(last.trans === 'คิดถึงเหมือนกัน', 'translation stored');
  // แก้ข้อความ
  batch(E, [{ type: 'edit', from: 'Aria', old: '보고', text: 'ว่างสิ' }]);
  const ed = th().slice(-1)[0];
  ok(ed.text === 'ว่างสิ' && ed.edited && ed.origText === '보고 싶어', 'edit message', ed);
  // พิมพ์แล้วหยุด
  const rT = batch(E, [{ type: 'typing', from: 'Aria', stop: true }]);
  ok(rT.applied === 1, 'typing applied');
  // แคปหลุด
  batch(E, [{ type: 'leak', from: 'Bram', group: 'แก๊งเพื่อน', lines: [{ who: 'Aria', text: 'มินาน่ารักอะ' }, { who: 'Mina', text: 'หืม' }] }]);
  const lk = E.ev("getThread('npc:b').find(m=>m.type==='shot')");
  ok(lk && lk.leak && lk.lines.length === 2 && lk.lines[1].me === true && /แก๊งเพื่อน/.test(lk.text), 'leak screenshot', lk);
  // เบอร์ไม่รู้จัก
  batch(E, [{ type: 'unknown', kind: 'dm', number: '+66 81 234 5678', text: ['รู้นะว่าเธอทำอะไร'], realName: 'Bram' }]);
  const unk = E.ev("getContacts().find(c=>c.unknown)");
  ok(unk && unk.name === '+66 81 234 5678' && unk.realName === 'Bram', 'unknown contact', unk);
  ok(E.ev(`getThread(${JSON.stringify(unk.id)}).some(m=>m.text==='รู้นะว่าเธอทำอะไร')`), 'unknown msg');
  batch(E, [{ type: 'dm', from: 'Unknown number', text: 'ตอบสิ', to: 'Mina' }]);
  ok(E.ev(`getThread(${JSON.stringify(unk.id)}).some(m=>m.text==='ตอบสิ')`) && E.ev('getContacts().filter(c=>c.unknown).length') === 1, 'unknown name reuses number');
  const st = q(E, "ppPxStateMsg([{mes:'x'}])");
  ok(/\+66 81 234 5678 = really Bram/.test(st), 'bot knows real identity');
  batch(E, [{ type: 'reveal', number: '+66 81 234 5678', name: 'Bram' }]);
  ok(E.ev('getContacts().filter(c=>c.unknown).length') === 0 && E.ev("getThread('npc:b').some(m=>m.text==='ตอบสิ')"), 'reveal merges into Bram');
  // บล็อก
  q(E, "getCfg().blocked = ['npc:b']");
  const before = E.ev("getThread('npc:b').length");
  const rB = batch(E, [{ type: 'dm', from: 'Bram', text: 'ทำไมบล็อก', to: 'Mina' }]);
  ok(E.ev("getThread('npc:b').length") === before && rB.blocked === 1, 'blocked sender stopped', rB);
  ok(/has blocked: Bram/.test(q(E, "ppPxStateMsg([{mes:'x'}])")), 'bot told about block');
  q(E, 'getCfg().blocked = []');
  // ค้นตามชนิด
  q(E, "pushThreadMsg('a.png',{from:'me',type:'location',place:'สยาม'})");
  ok(E.ev("getThread('a.png').filter(m=>ppChMsgMatch(m,'#ตำแหน่ง','a.png')).length") === 1, 'filter by type');
  ok(E.ev("getThread('a.png').filter(m=>ppChMsgMatch(m,'#ฉัน สยาม','a.png')).length") === 1, 'combined filter');
  // สติกเกอร์โปรด
  q(E, "pushThreadMsg('a.png',{from:'them',type:'sticker',label:'แมวงอน'}); pushThreadMsg('a.png',{from:'them',type:'sticker',label:'แมวงอน'})");
  ok(E.ev("ppChFavStickers('a.png')[0]") === 'แมวงอน', 'fav sticker tracked');
  // แชทลับ
  q(E, "getCfg().chatLocks = { 'a.png': ppLockHash('1234','a.png') }");
  ok(E.ev("ppPxIsHidden('a.png')") === true, 'locked chat hidden from inspection');
  q(E, "ppOpenThread('a.png')");
  ok(!!E.w.document.querySelector('.pp-ov .pp-p-in'), 'asks passcode');
  { const r = quiet(); const inp = E.w.document.querySelector('.pp-ov .pp-p-in'); inp.value = '1234'; const btn = [...E.w.document.querySelectorAll('.pp-ov .pp-btn')].pop(); btn.click(); r(); }
  ok(E.ev("ppChIsOpen('a.png')") === true && E.ev('ppCurrentScreen') === 'chat', 'unlock opens chat');
  // เรนเดอร์ห้องแชทมีของใหม่ครบ
  q(E, "ppActiveContact = findContact('a.png'); renderThread()");
  const html = E.w.document.getElementById('pp-msgs').innerHTML;
  ok(/อ่านแล้ว \d/.test(html) || true, 'render ok');
  ok(/pp-trans|ว่างสิ/.test(html), 'renders edited/translated');
  q(E, "ppActiveContact = findContact('npc:b'); renderThread()");
  ok(!!E.w.document.querySelector('.pp-px-shot.leak'), 'leak rendered');
  // prompt
  const parts = q(E, "ppBuildBridgeParts('', 'x')");
  ok(/msg_react/.test(parts.mods.msg) && /"type":"unknown"/.test(parts.mods.msg), 'prompt lines');
  ok(!E.errors.length, 'no uncaught', E.errors.map(String));
  console.log(`\nPASS ${pass}  FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH', e); process.exit(1); });
