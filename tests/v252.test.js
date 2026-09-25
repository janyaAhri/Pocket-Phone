// ทดสอบ 2.52.0 — สะพานอัจฉริยะ
const { makeEnv } = require('./harness');
let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) pass++; else { fail++; console.log('FAIL:', name, extra !== undefined ? JSON.stringify(extra) : ''); } };
const quiet = () => { const o = console.log, i = console.info, w = console.warn; console.log = () => {}; console.info = () => {}; console.warn = () => {}; return () => { console.log = o; console.info = i; console.warn = w; }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function boot() {
  const r = quiet();
  const E = makeEnv({ characters: [{ name: 'Aria', avatar: 'a.png' }], characterId: 0, name1: 'Mina', chat: [{ name: 'Aria', mes: 'hi' }] });
  await sleep(900);
  E.ev("getCfg().contacts.push({id:'a.png',name:'Aria',avatar:''})");
  r();
  return E;
}
const q = (E, s) => { const r = quiet(); try { return E.ev(s); } finally { r(); } };
const turn = (E, mes) => { const chat = [{ is_user: true, mes }]; const r = quiet(); try { E.w.ppGenInterceptor(chat, 4096, () => {}, 'normal'); } finally { r(); } return chat; };
const coreOf = chat => (chat.find(m => m.is_system && /Pocket Phone/.test(m.mes) && /POCKET_PHONE_SYNC_V2/.test(m.mes)) || {}).mes || '';

(async () => {
  {
    const E = await boot();
    // ย่อคำสั่งแกนหลัก
    let c = coreOf(turn(E, 'hello'));
    ok(/one-request bridge/.test(c), 'full core first');
    q(E, "ppRecordSyncReceipt('applied',1,0,''); ppRecordSyncReceipt('noop',0,0,'')");
    c = coreOf(turn(E, 'hello'));
    ok(!/one-request bridge/.test(c) && /never a second call/.test(c), 'short core after 2 good turns', c.slice(0, 120));
    ok(E.ev('getCfg().kwTurnHist.slice(-1)[0].core') === 's', 'turn recorded short');
    q(E, "getCfg().syncGoodStreak = 8");
    ok(/one-request bridge/.test(coreOf(turn(E, 'hello'))), 'full core every 8th');
    q(E, "getCfg().syncGoodStreak = 5; ppRecordSyncReceipt('missing',0,0,'')");
    ok(E.ev('getCfg().syncGoodStreak') === 0 && /one-request bridge/.test(coreOf(turn(E, 'hello'))), 'miss resets to full');
    q(E, "getCfg().syncGoodStreak = 3; getCfg().coreAdaptive = false");
    ok(/one-request bridge/.test(coreOf(turn(E, 'hello'))), 'adaptive off = full');
    q(E, 'getCfg().coreAdaptive = true');
    // งบโทเคน
    q(E, "getCfg().bridgeTokenCache = { ok:true, tokenizer:'x', measuredAt:Date.now(), mods:{ core:500, coreShort:80, msg:100, groupcall:80, wallet:60, board:50, life:120, inv_contacts:40, actionlog:10 } }");
    q(E, 'getCfg().syncGoodStreak = 0; getCfg().tokBudget = 700');
    const parts = q(E, "ppBuildBridgeParts('', 'x')");
    ok(parts.dropped.length > 0 && !parts.mods.board && parts.mods.msg, 'budget drops low-priority first', parts.dropped);
    q(E, 'getCfg().tokBudget = 0');
    ok(q(E, "ppBuildBridgeParts('', 'x')").dropped.length === 0, 'no budget no drop');
    // ความคุ้ม
    q(E, "getCfg().kwTurnHist = [{ts:Date.now()-1000,sent:['msg','life','board'],skipped:[]},{ts:Date.now()-500,sent:['msg','life','board'],skipped:[]},{ts:Date.now()-100,sent:['msg','board'],skipped:['life']}]");
    q(E, "getCfg().syncEventLog = [{ts:Date.now()-900,ok:true,type:'dm'},{ts:Date.now()-800,ok:true,type:'email'},{ts:Date.now()-50,ok:true,type:'selfie'}]");
    const u = E.ev('ppBrUsefulness()');
    const row = k => u.rows.find(r => r.key === k);
    ok(row('msg').events === 1 && row('life').events === 2 && row('board').events === 0 && row('life').sentTurns === 2, 'usefulness counts', u.rows);
    // แนวโรล
    q(E, "ppBrApplyGenre('mystery', false)");
    ok(E.ev('getCfg().rpGenre') === 'mystery' && E.ev('getCfg().bridgeMods.news') === true && E.ev('getCfg().bridgeMods.feed') === false, 'genre sets modules');
    ok(E.ev('getCfg().kwEnabled') === true && E.ev('getCfg().kwPerMod.news') === true, 'genre sets keywords');
    q(E, 'getCfg().syncGoodStreak = 0');
    ok(/GENRE mystery/.test(coreOf(turn(E, 'hello'))), 'genre line in core');
    // จังหวะ + ข้อห้าม
    q(E, "getCfg().eventPace = 'busy'; getCfg().botForbid = { money:true, newNpc:true, text:'ห้ามพูดถึงแฟนเก่า' }");
    c = coreOf(turn(E, 'hello'));
    ok(/PACE: keep the phone lively/.test(c) && /NEVER on the phone: send, request or change money/.test(c) && /แฟนเก่า/.test(c), 'pace + forbid lines');
    const r1 = q(E, "ppApplySyncBatch({events:[{type:'wallet',from:'Aria',amount:500,direction:'in'}]})");
    ok(r1.applied === 0 && r1.blocked === 1, 'money blocked', r1);
    const n0 = E.ev('getCfg().contacts.length');
    q(E, "ppApplySyncBatch({events:[{type:'dm',from:'Stranger Zed',text:'hi',to:'Mina'}]})");
    ok(E.ev('getCfg().contacts.length') === n0, 'new npc blocked');
    q(E, 'getCfg().botForbid = {}');
    // กู้ที่ลืมแนบ
    const cands = E.ev(`ppBrScanProse('อาเรียหยิบมือถือขึ้นมาแล้วส่งข้อความหาเธอ "ถึงบ้านยัง" ก่อนจะโทรหาอีกรอบ')`);
    ok(cands.some(x => x.type === 'dm' && x.text === 'ถึงบ้านยัง') && cands.some(x => x.type === 'missed_call'), 'prose scan', cands);
    q(E, `ppBrOfferRecover('Aria texted her "are you up?"')`);
    const rc = E.ev('getCfg().recoverCands');
    ok(rc.length === 1 && rc[0].text === 'are you up?', 'offer recover', rc);
    q(E, `ppBrRecoverApply(${JSON.stringify(rc[0].id)})`);
    ok(E.ev("getThread('a.png').some(m=>m.text==='are you up?')") && E.ev('getCfg().recoverCands.length') === 0, 'recover applies');
    ok(E.ev('ppBrScanProse("she smiled")').length === 0, 'no false recover');
    // หน้าสะพาน + ดูก่อนส่ง
    q(E, "ppOpen(); getCfg().settingsPage='bridge'; ppNav('setpage')");
    const html = E.w.document.getElementById('pp-setpage-body').innerHTML;
    ok(/pp-br-genre/.test(html) && /งบโทเคนต่อเทิร์น/.test(html) && /ความคุ้มค่าของแต่ละโมดูล/.test(html), 'bridge page sections');
    q(E, 'ppBrPreview()');
    ok(!!E.w.document.querySelector('.pp-br-preview .pp-br-pv-row'), 'preview dialog');
    // ปุ่มแนวโรลในหน้า
    { const r = quiet(); E.w.document.querySelector('[data-px="br-genre"][data-id="office"]').click(); r(); }
    ok(E.ev('getCfg().rpGenre') === 'office', 'genre click');
    { const r = quiet(); const b = E.w.document.getElementById('pp-br-f-late'); b.checked = true; b.dispatchEvent(new E.w.Event('change', { bubbles: true })); r(); }
    ok(E.ev('getCfg().botForbid.lateCalls') === true, 'forbid chip change');
    // มือเดียว / ตัวใหญ่
    q(E, "getCfg().pxOneHand = true; ppPxApplyStatus()");
    ok(E.w.document.getElementById('pp-frame').classList.contains('pp-onehand'), 'one-hand class');
    { const r = quiet(); E.w.document.getElementById('pp-frame').click(); r(); }
    ok(E.ev('getCfg().pxOneHand') === false, 'tap top exits one-hand');
    ok(!E.errors.length, 'no uncaught', E.errors.map(String));
  }
  console.log(`\nPASS ${pass}  FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH', e); process.exit(1); });
