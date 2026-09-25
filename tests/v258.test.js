// ทดสอบ 2.58.0 — แอพหาคู่ + ธนาคารในกระเป๋าเงิน
const { makeEnv } = require('./harness');
let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) pass++; else { fail++; console.log('FAIL:', name, extra !== undefined ? JSON.stringify(extra) : ''); } };
const quiet = () => { const o = console.log, i = console.info, w = console.warn; console.log = () => {}; console.info = () => {}; console.warn = () => {}; return () => { console.log = o; console.info = i; console.warn = w; }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const q = (E, s) => { const r = quiet(); try { return E.ev(s); } finally { r(); } };
const batch = (E, evs) => q(E, `ppApplySyncBatch({events:${JSON.stringify(evs)}}, 'a.png')`);

const PROFILES = [
  { name: 'ภูมิ', age: 29, gender: 'ชาย', job: 'สถาปนิก', distance: 4, bio: 'ชอบกาแฟดำกับตึกเก่า', looks: 'สูง ใส่แว่นกรอบบาง ผมยุ่งนิด ๆ', personality: 'สุภาพ พิมพ์ยาว ใช้ครับทุกประโยค', interests: ['ถ่ายรูปฟิล์ม', 'วิ่ง', 'หนังเก่า'], prompt_q: 'วันอาทิตย์ในฝัน', prompt_a: 'ตื่นสายแล้วหาร้านข้าวต้มเจ้าเก่า', opener: 'สวัสดีครับ เห็นว่าชอบหนังเก่าเหมือนกัน', likes_you: true, choosy: 0.3, secret: 'เพิ่งเลิกกับแฟนมาสามเดือน' },
  { name: 'ต้นกล้า', age: 17, gender: 'ชาย', job: 'บาริสต้า', bio: 'ชงให้กินฟรี 😎', looks: 'ผิวแทน', personality: 'กวน', interests: 'แมว, เกม', prompt_q: 'q', prompt_a: 'a', opener: 'หวัดดี', likes_you: false, choosy: 1, secret: 'x' },
  { name: 'ไนท์', age: 31, job: 'หมอ', bio: 'เวรดึกบ่อย', interests: ['ดนตรี'], likes_you: false, choosy: 0.0, opener: '' },
];

(async () => {
  const r0 = quiet();
  const E = makeEnv({ characters: [{ name: 'Aria', avatar: 'a.png' }], characterId: 0, name1: 'Mina', chat: [{ name: 'Aria', mes: 'hi' }] });
  await sleep(900);
  E.ev("getCfg().contacts.push({id:'a.png',name:'Aria',avatar:''}); getCfg().bridgeMods.wallet = true; getCfg().logToStory = true; ppOpen()");
  r0();
  // แกะคำตอบ
  const raw = 'นี่คือโปรไฟล์ค่ะ\n```json\n' + JSON.stringify(PROFILES).replace(/"ภูมิ"/, '“ภูมิ”') + ',\n```';
  ok(E.ev(`ppDtParse(${JSON.stringify(raw)}).length`) === 3, 'parse fenced json with smart quotes');
  ok(E.ev(`ppDtParse('{"name":"A","age":22} ขยะ {"name":"B","age":30}').length`) === 2, 'parse loose objects');
  // หน้าเริ่ม
  ok(E.ev('APPS.some(a=>a.nav==="dating")'), 'app registered');
  q(E, "ppNav('dating')");
  ok(!!E.w.document.getElementById('pp-dt-n') && !!E.w.document.querySelector('[data-px="dt-gen"]'), 'setup form');
  // เจนครั้งเดียว
  E.w.__calls = 0;
  q(E, `genWithRetry = async (p) => { window.__calls++; window.__prompt = p; return ${JSON.stringify(JSON.stringify(PROFILES))}; }`);
  { const rr = quiet(); E.w.document.getElementById('pp-dt-n').value = '3'; E.w.document.getElementById('pp-dt-prefs').value = 'ผู้ชายอบอุ่น'; E.w.document.querySelector('[data-px="dt-gen"]').click(); rr(); }
  await sleep(100);
  ok(E.w.__calls === 1, 'one model call', E.w.__calls);
  ok(/Create 3 fictional/.test(E.w.__prompt) && /ผู้ชายอบอุ่น/.test(E.w.__prompt) && /Adults only|adult \(20\+\)/.test(E.w.__prompt), 'prompt has count, prefs, adults');
  const ps = E.ev('ppDt().profiles');
  ok(ps.length === 3 && ps[1].age === 20 && !/😎/.test(ps[1].bio) && ps[1].interests.length === 2, 'normalized (age floor, emoji stripped, interests split)', ps[1]);
  ok(E.w.document.querySelectorAll('.pp-dt-stack .pp-dt-card').length >= 1 && /ภูมิ/.test(E.w.document.getElementById('pp-dating-body').innerHTML), 'card stack shown');
  // ปัด: ภูมิถูกใจเราอยู่แล้ว = แมตช์ทันที
  const id0 = ps[0].id;
  q(E, `ppDtSwipe(${JSON.stringify(id0)}, 'like')`);
  const p0 = E.ev(`ppDt().profiles.find(p=>p.id===${JSON.stringify(id0)})`);
  ok(p0.status === 'matched' && p0.cid && !!E.w.document.getElementById('pp-dt-match'), 'instant match + overlay');
  const c0 = E.ev(`findContact(${JSON.stringify(p0.cid)})`);
  ok(c0 && c0.dating === id0 && /สถาปนิก/.test(c0.npcDesc) && /เพิ่งเลิกกับแฟน/.test(c0.npcDesc) && /strangers who just matched/.test(c0.npcDesc), 'npc grounded in profile');
  ok(/สถาปนิก/.test(E.ev(`getEffectivePersona(${JSON.stringify(p0.cid)})`)), 'chat persona uses profile');
  // ต้นกล้า เลือกมาก ไม่ถูกใจเรา = ไม่แมตช์
  q(E, `document.getElementById('pp-dt-match')?.remove(); ppDtSwipe(${JSON.stringify(ps[1].id)}, 'like')`);
  ok(E.ev(`ppDt().profiles[1].status`) === 'liked', 'choosy = liked only');
  q(E, `ppDtSwipe(${JSON.stringify(ps[2].id)}, 'pass')`);
  ok(E.ev('ppDtQueue().length') === 0 && /ปัดครบทุกคนแล้ว/.test(E.w.document.getElementById('pp-dating-body').innerHTML), 'all swiped');
  q(E, "ppDtTab='me'; ppDtRender()");
  { const rr = quiet(); E.w.document.querySelector('[data-px="dt-recycle"]').click(); rr(); }
  ok(E.ev('ppDtQueue().length') === 1, 'recycle passed');
  // ความลับ: บทหลักไม่รู้
  q(E, `ppActiveContact = findContact(${JSON.stringify(p0.cid)}); ppNav('chat'); ppLog('chat', 'ส่งข้อความหา ภูมิ: สวัสดี')`);
  ok(!E.ev("getCfg().actionLog.some(x=>/ภูมิ/.test(x.text))"), 'dating chat hidden from story log');
  ok(!/ภูมิ/.test(q(E, 'ppBuildContactBlock()')), 'match not in story contact list');
  ok(!/dating app/.test(q(E, "ppPxStateMsg([{mes:'x'}])")), 'no rp line when off');
  q(E, 'getCfg().dtRpAware = true');
  ok(/matched with: ภูมิ \(29\)/.test(q(E, "ppPxStateMsg([{mes:'x'}])")), 'rp line when on');
  q(E, "ppLog('chat', 'ส่งข้อความหา ภูมิ: สวัสดี')");
  ok(E.ev("getCfg().actionLog.some(x=>/ภูมิ/.test(x.text))"), 'logs when rp aware');
  q(E, "getCfg().dtRpAware = false; ppChatTab = 'npc'; ppNav('messages')");
  ok(/ภูมิ/.test(E.w.document.getElementById('pp-scr-messages').innerHTML), 'match visible in messages list');
  // เลิกแมตช์
  q(E, `ppNav('dating'); ppDtUnmatch(${JSON.stringify(id0)})`);
  { const rr = quiet(); [...E.w.document.querySelectorAll('.pp-ov .pp-btn')].pop().click(); rr(); }
  ok(!E.ev(`findContact(${JSON.stringify(p0.cid)})`) && E.ev(`ppDt().profiles[0].status`) === 'unmatched', 'unmatch removes chat');

  // ══ ธนาคาร ══
  q(E, 'walletBalanceSet(10000)');
  const today = E.ev('ppBkToday().getDate()');
  q(E, `ppBk().bills.push({id:'b1',name:'ค่าเช่า',amount:4500,day:${Math.min(28, today)},auto:false})`);
  ok(E.ev("ppBkBillStatus(ppBk().bills[0]).k") === (today > 28 ? 'over' : 'soon'), 'bill due today');
  ok(/ค่าเช่า 4,500|ค่าเช่า ฿4,500|ค่าเช่า/.test(q(E, "ppPxStateMsg([{mes:'x'}])")), 'bot told about bill');
  q(E, "ppBkPayBill('b1')");
  ok(E.ev('walletBalanceGet()') === 5500 && E.ev("ppBkBillStatus(ppBk().bills[0]).k") === 'paid', 'pay bill');
  ok(E.ev("walletHistoryArr().slice(-1)[0].name") === 'ค่าเช่า', 'history row');
  ok(E.ev("ppBkPayBill('b1')") === false, 'cannot pay twice');
  // เงินเดือน
  q(E, `ppBk().salary = {amount:20000, day:${Math.max(1, Math.min(28, today))}, from:'บริษัทเอ', lastPaid:''}; ppBkTick()`);
  ok(E.ev('walletBalanceGet()') === 25500 && E.ev("walletHistoryArr().slice(-1)[0].name") === 'บริษัทเอ', 'salary auto credit');
  q(E, 'ppBkTick()');
  ok(E.ev('walletBalanceGet()') === 25500, 'salary once a month');
  // ผ่อน
  q(E, "ppBk().plans.push({id:'p1',name:'มือถือ',total:10000,months:4,paidCount:0,day:1,auto:true,lastPaid:''}); ppBkTick()");
  ok(E.ev("ppBk().plans[0].paidCount") === 1 && E.ev('walletBalanceGet()') === 23000, 'installment auto');
  // เหตุการณ์จากเรื่อง
  batch(E, [{ type: 'invoice', name: 'ค่าไฟ', amount: 890, day: 10, monthly: true }, { type: 'bonus', amount: 3000, from: 'หัวหน้า', note: 'โบนัสปิดโปรเจกต์' }]);
  ok(E.ev("ppBk().bills.some(b=>b.name==='ค่าไฟ'&&b.day===10)"), 'bill event');
  ok(E.ev('walletBalanceGet()') === 26000, 'payday event credits', E.ev('walletBalanceGet()'));
  // หน้าธนาคาร + สลิป
  q(E, "ppNav('wallet'); ppWalletTab='bank'; renderWallet()");
  const html = E.w.document.getElementById('pp-wallet-body').innerHTML;
  ok(/ต้องจ่ายเดือนนี้/.test(html) && /ค่าไฟ/.test(html) && /มือถือ/.test(html) && /บริษัทเอ/.test(html), 'bank tab');
  ok(!!E.w.document.querySelector('#pp-wallet-seg [data-wtab="bank"]'), 'bank tab button');
  { const rr = quiet(); E.w.document.querySelector('#pp-wallet-body .pp-wrow[data-px="bk-slip"]').click(); rr(); }
  ok(!!E.w.document.querySelector('.pp-bk-slip') && /PP\d{10}/.test(E.w.document.querySelector('.pp-bk-slip').innerHTML), 'slip opens with ref');
  const parts = q(E, "ppBuildBridgeParts('', 'x')");
  ok(/"type":"bill"/.test(parts.mods.wallet) && /"type":"payday"/.test(parts.mods.wallet), 'prompt lines');
  ok(!E.errors.length, 'no uncaught', E.errors.map(String));
  console.log(`\nPASS ${pass}  FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH', e); process.exit(1); });
