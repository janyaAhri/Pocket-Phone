// ทดสอบ 2.55.0 — โทรสมจริง
const { makeEnv } = require('./harness');
let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) pass++; else { fail++; console.log('FAIL:', name, extra !== undefined ? JSON.stringify(extra) : ''); } };
const quiet = () => { const o = console.log, i = console.info, w = console.warn, e = console.error; console.log = () => {}; console.info = () => {}; console.warn = () => {}; console.error = () => {}; return () => { console.log = o; console.info = i; console.warn = w; console.error = e; }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const q = (E, s) => { const r = quiet(); try { return E.ev(s); } finally { r(); } };
const batch = (E, evs) => q(E, `ppApplySyncBatch({events:${JSON.stringify(evs)}}, 'a.png')`);

(async () => {
  const r0 = quiet();
  const E = makeEnv({ characters: [{ name: 'Aria', avatar: 'a.png' }], characterId: 0, name1: 'Mina', chat: [{ name: 'Aria', mes: 'hi' }] });
  await sleep(900);
  E.ev("getCfg().contacts.push({id:'a.png',name:'Aria',avatar:''},{id:'npc:b',name:'Bram',npc:true,ownerCharId:'a.png'},{id:'npc:c',name:'Cleo',npc:true,ownerCharId:'a.png'}); getCfg().bridgeMods.groupcall = true; ppOpen()");
  r0();
  // สีหน้า
  ok(E.ev("ppClDetectFace('ฮ่า ๆ ตลกมาก')") === 'joy' && E.ev("ppClDetectFace('ขอโทษนะ')") === 'sadness' && E.ev("ppClDetectFace('โอเค')") === '', 'face detect');
  // วิดีโอคอล
  q(E, "ppActiveContact = findContact('a.png'); ppActiveGroup = null; ppClStartVideo()");
  ok(E.ev('ppCall && ppCall.video') === true && !!E.w.document.getElementById('pp-cl-video') && !!E.w.document.getElementById('pp-cl-self'), 'video call layers');
  ok(/You ARE|VIDEO call/.test(E.ev('ppClVideoPromptLine()')), 'video prompt line');
  q(E, "ppCall.connected = true; ppCall.startTs = Date.now(); ppClFaceFromRaw('\"555\"\\n[FACE love]', ['555'])");
  await sleep(50);
  ok(E.ev('ppCall.face') === 'love', 'face from tag', E.ev('ppCall.face'));
  { const r = quiet(); E.w.document.getElementById('pp-cl-self').click(); r(); }
  ok(E.ev('ppCall.camOff') === true && /กล้องปิด/.test(E.w.document.getElementById('pp-cl-self').innerHTML), 'camera off toggle');
  { const r = quiet(); E.w.document.querySelector('[data-px="cl-video"]').click(); r(); }
  ok(E.ev('ppCall.video') === false && !E.w.document.getElementById('pp-cl-video'), 'video toggled off');
  q(E, 'ppCall.video = true; ppClApplyVideo()');
  // สายซ้อน
  q(E, "ppIncomingCall(findContact('npc:b'))");
  ok(!!E.w.document.getElementById('pp-cl-wait') && E.ev("ppCall.c.id") === 'a.png', 'call waiting banner');
  { const r = quiet(); E.w.document.querySelector('[data-px="cl-wait-no"]').click(); r(); }
  ok(!E.w.document.getElementById('pp-cl-wait') && E.ev("getThread('npc:b').some(m=>m.type==='call'&&m.missed)"), 'waiting declined = missed');
  // สายหลุด
  const rD = batch(E, [{ type: 'call_drop', reason: 'เข้าลิฟต์' }]);
  ok(rD.applied === 1 && E.ev('ppCall') === null, 'call dropped', rD);
  ok(/สายหลุด · เข้าลิฟต์/.test(E.w.document.getElementById('pp-callend-sub').textContent), 'callend shows drop');
  const lg = E.ev('getCfg().callLog.slice(-1)[0]');
  ok(lg.video === true && lg.dropped === 'เข้าลิฟต์', 'call log flags', lg);
  ok(!E.w.document.getElementById('pp-cl-video'), 'video cleaned up');
  // สัญญาณหาย = สายหลุด
  q(E, "ppActiveContact = findContact('a.png'); ppStartCall(); ppCall.connected = true; ppCall.startTs = Date.now(); ppCtrl().air = true; ppPxApplyStatus()");
  ok(E.ev('ppCall') === null, 'offline drops call');
  q(E, 'ppCtrl().air = false; ppPxApplyStatus()');
  // คอลกลุ่ม
  q(E, "getCfg().groups = getCfg().groups || []; getCfg().groups.push({id:'grp:1',name:'แก๊งเพื่อน',members:['a.png','npc:b','npc:c']}); saveCfg()");
  q(E, `genWithRetry = async () => 'Aria: "ได้ยินไหม"\\nBram: "ชัดแจ๋ว"\\nNobody: "x"\\n*เงียบ*'`);
  const rG = batch(E, [{ type: 'group_call', group: 'แก๊งเพื่อน', from: 'Bram' }]);
  ok(rG.applied === 1 && E.ev('ppCall && ppCall.group') === 'grp:1' && E.ev('ppCall.incoming') === true, 'incoming group call', rG);
  ok(E.w.document.querySelectorAll('#pp-call-av .pp-cl-grid > span').length === 3, 'member grid');
  q(E, 'ppAcceptCall()');
  await sleep(2500);
  const tr = E.ev('ppCall ? ppCall.transcript : []');
  ok(tr.length === 2 && /^Aria: ได้ยินไหม$/.test(tr[0].text) && /^Bram: ชัดแจ๋ว$/.test(tr[1].text), 'group lines parsed', tr);
  q(E, 'ppEndCall()');
  ok(E.ev("getThread('grp:1').some(m=>m.type==='call')") && E.ev('getCfg().callLog.slice(-1)[0].group') === true, 'group call logged');
  // กลุ่มเรียกขณะติดสาย
  q(E, "ppActiveContact = findContact('a.png'); ppStartCall()");
  batch(E, [{ type: 'group_call', group: 'แก๊งเพื่อน', from: 'Cleo' }]);
  ok(E.ev("getThread('grp:1').some(m=>/ติดสายอื่น/.test(m.text||''))"), 'group call while busy');
  q(E, 'ppEndCall()');
  // วิดีโอคอลเรียกเข้าจากเรื่อง
  batch(E, [{ type: 'call', from: 'Aria', live: true, video: true }]);
  ok(E.ev('ppCall && ppCall.video') === true, 'incoming video call flagged', E.ev('ppCall'));
  q(E, 'ppEndCall(true)');
  // ผู้โทรไม่ทราบชื่อ
  q(E, "getCfg().contacts.push({id:'unk:1',name:'+66 81 000 0000',unknown:true,realName:'Bram'}); ppIncomingCall(findContact('unk:1'))");
  ok(E.w.document.getElementById('pp-call-sub').textContent === 'ไม่ทราบชื่อผู้โทร', 'unknown caller label');
  q(E, 'ppEndCall(true)');
  // ปุ่มโทรในกลุ่ม
  q(E, "ppActiveContact = null; ppActiveGroup = getGroup('grp:1'); renderThread()");
  ok(E.w.document.getElementById('pp-chat-call-btn').style.display === 'flex', 'group call button visible');
  // prompt
  const parts = q(E, "ppBuildBridgeParts('', 'x')");
  ok(/group_call/.test(parts.mods.groupcall) && /call_drop/.test(parts.mods.groupcall), 'prompt lines');
  ok(!E.errors.length, 'no uncaught', E.errors.map(String));
  console.log(`\nPASS ${pass}  FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH', e); process.exit(1); });
