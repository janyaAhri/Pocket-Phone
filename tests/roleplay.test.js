const { makeEnv } = require('./harness');
const fs = require('fs');
let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) pass++; else { fail++; console.log('FAIL:', name, extra !== undefined ? JSON.stringify(extra) : ''); } };
const quiet = () => { const o = console.log, i = console.info, w = console.warn; console.log = () => {}; console.info = () => {}; console.warn = () => {}; return () => { console.log = o; console.info = i; console.warn = w; }; };

const A = { name: 'Aria', avatar: 'a.png' }, B = { name: 'Bram', avatar: 'b.png' }, C = { name: 'Cleo', avatar: 'c.png' };
const A2 = { name: 'Aria', avatar: 'aria_other.png' }; // ชื่อซ้ำ

function env(st) { const r = quiet(); try { return makeEnv(st); } finally { r(); } }

// ── T1 single chat regression
{
  const E = env({ characters: [A], characterId: 0, name1: 'Mina', chat: [{ name: 'Aria', mes: 'hi' }] });
  ok(E.ev('currentCharacterId()') === 'a.png', 'T1 current');
  ok(JSON.stringify(E.ev('ppMainCharIds()')) === '["a.png"]', 'T1 mains');
  ok(E.ev('ppInStGroup()') === false, 'T1 not group');
  ok(E.ev("threadKey('a.png')") === 'a.png::chat-1', 'T1 threadKey main', E.ev("threadKey('a.png')"));
  ok(E.ev("threadKey('npc:x')") === 'npc:x', 'T1 threadKey npc');
  ok(E.ev('walletRouteKey()') === 'a.png::chat-1', 'T1 wallet key unchanged');
  ok(E.ev('ppEchoRouteKey()') === 'a.png::chat-1', 'T1 echo key unchanged');
  ok(E.ev("ppCardAutoLoaded('a.png')") === true, 'T1 card autoload');
}
// ── T2 group chat
const GROUP = () => ({ characterId: undefined, groupId: 'g1', chatId: 'gchat-1',
  groups: [{ id: 'g1', name: 'Crew', members: ['a.png', 'b.png', 'c.png'], disabled_members: ['c.png'], chats: ['gchat-0', 'gchat-1'] }],
  characters: [A, B, C], name1: 'Mina', chat: [{ name: 'Aria', original_avatar: 'a.png', mes: 'x' }, { name: 'Bram', original_avatar: 'b.png', mes: 'y' }] });
{
  const E = env(GROUP());
  ok(E.ev('ppStGroupId()') === 'g1', 'T2 gid');
  ok(JSON.stringify(E.ev('ppStGroupMemberIds()')) === '["a.png","b.png"]', 'T2 members', E.ev('ppStGroupMemberIds()'));
  ok(E.ev('ppMainCharIds().length') === 2, 'T2 mains len');
  ok(E.ev("ppIsMainChar('a.png')") && E.ev("ppIsMainChar('b.png')") && !E.ev("ppIsMainChar('c.png')"), 'T2 isMain');
  ok(E.ev('ppLastSpeakerCharId()') === 'b.png', 'T2 last speaker');
  ok(E.ev('currentCharacterId()') === 'b.png', 'T2 current');
  ok(E.ev("ppContactInScope({id:'a.png'})") === true, 'T2 scope a');
  ok(E.ev("ppContactInScope({id:'c.png'})") === false, 'T2 scope c out');
  ok(E.ev("threadKey('a.png')") === 'a.png::gchat-1', 'T2 threadKey');
  ok(E.ev('walletRouteKey()') === 'grp:g1::gchat-1', 'T2 wallet group key', E.ev('walletRouteKey()'));
  // wallet key stable when speaker changes
  E.state.chat.push({ name: 'Aria', original_avatar: 'a.png', mes: 'z' });
  ok(E.ev('walletRouteKey()') === 'grp:g1::gchat-1', 'T2 wallet stable');
  ok(E.ev('currentCharacterId()') === 'a.png', 'T2 speaker switched');
  ok(E.ev("ppCardAutoLoaded('a.png')") === false, 'T2 no autoload in group');
  // generating member
  E.state.characterId = 1; E.ev('ppMainCharCache = null');
  ok(E.ev('ppGroupGeneratingCharId()') === 'b.png', 'T2 generating');
  ok(E.ev('currentCharacterId()') === 'b.png', 'T2 current=generating');
  E.state.characterId = undefined;
  // list chats in group
  E.ev('ppListStChats()').then(v => ok(JSON.stringify(v) === '["gchat-1","gchat-0"]', 'T2 list group chats', v));
}
// ── wallet seed migration
{
  const st = GROUP();
  st.extensionSettings = { 'pocket-phone': { walletPerChat: true, walletRoutes: { global: { balance: 777, history: [{ a: 1 }], botWallets: {} } } } };
  const E = env(st);
  ok(E.ev('walletBalanceGet()') === 777, 'W seed from global', E.ev('walletBalanceGet()'));
  ok(E.ev("getCfg().walletRoutes.global.balance") === 777, 'W global kept');
  E.ev('walletBalanceSet(10)');
  ok(E.ev("getCfg().walletRoutes.global.balance") === 777 && E.ev('walletBalanceGet()') === 10, 'W independent after seed');
}
// ── T3 persona name
{
  const E = env({ characters: [A], characterId: 0, name1: 'Mina' });
  E.ev("getCfg().userAppName = 'Bee'");
  ok(E.ev('getUserDisplayName()') === 'Mina', 'T3 persona wins');
  E.state.name1 = 'Kira';
  ok(E.ev('getUserDisplayName()') === 'Kira', 'T3 persona switch');
  E.ev('getCfg().userNameFollowsPersona = false');
  ok(E.ev('getUserDisplayName()') === 'Bee', 'T3 switch off');
  E.ev("getCfg().userAppName = ''");
  ok(E.ev('getUserDisplayName()') === 'Kira', 'T3 fallback');
}
// ── T4 fake NPC guard
{
  const E = env({ characters: [A], characterId: 0, name1: 'Mina', powerUserSettings: { personas: { 'm.png': 'Mina', 'z.png': 'Zed', 'x.png': 'Aria' }, persona_descriptions: {} } });
  for (const n of ['Mina', '@mina', 'คุณ Mina', '{{user}}', 'you', 'Zed']) ok(E.ev(`ppIsUserName(${JSON.stringify(n)})`) === true, 'T4 user ' + n);
  ok(E.ev("ppIsUserName('Aria')") === false, 'T4 Aria not user (even though a persona is named Aria)');
  ok(E.ev("ppIsUserName('me')") === false, 'T4 me is not user');
  const before = E.ev('getCfg().contacts.length');
  ok(E.ev("ppSyncFindContact('Mina', true)") === null, 'T4 no contact for user');
  ok(E.ev('getCfg().contacts.length') === before, 'T4 contacts unchanged');
  const r = E.ev("ppSyncFindContact('Aria', true)");
  ok(r && r.id === 'a.png', 'T4 Aria resolves to main', r);
}
// ── Duplicate names
{
  // ST has two cards named Aria; the one in scene is the second
  const E = env({ characters: [A2, A, B], characterId: 1, name1: 'Mina' });
  // contacts: other-Aria already added earlier + an old NPC Aria owned by nobody
  E.ev("getCfg().contacts.push({id:'aria_other.png',name:'Aria',avatar:''}); getCfg().contacts.push({id:'npc:old',name:'Aria',npc:true,ownerCharId:'aria_other.png'})");
  const r = E.ev("ppSyncFindContact('Aria', true)");
  ok(r && r.id === 'a.png', 'D1 scene Aria beats other-card contact', r && r.id);
  ok(E.ev("getCfg().contacts.filter(x=>x.id==='a.png').length") === 1, 'D1 created once');
  const r2 = E.ev("ppSyncFindContact('Aria', true)");
  ok(r2 && r2.id === 'a.png', 'D1 stable 2nd time');
  // NPC with same name, different owners
  E.ev("getCfg().contacts.push({id:'npc:mom1',name:'Mom',npc:true,ownerCharId:'aria_other.png'}); getCfg().contacts.push({id:'npc:mom2',name:'Mom',npc:true,ownerCharId:'a.png'})");
  ok(E.ev("ppSyncFindContact('Mom', true).id") === 'npc:mom2', 'D2 in-scene NPC of same name');
  // legacy tag lookup
  ok(E.ev("ppLegacyTagContact('Aria', true).id") === 'a.png', 'D3 legacy tag dup');
  ok(E.ev("ppLegacyTagContact('Mina', true)") === null, 'D3 legacy tag user');
  // label
  ok(/aria_other/.test(E.ev("ppStCharLabel(listStCharacters()[0])")), 'D4 label shows file', E.ev("ppStCharLabel(listStCharacters()[0])"));
  ok(E.ev("ppStCharLabel(listStCharacters()[2])") === 'Bram', 'D4 plain label');
  // findStCharIndex prefers avatar
  ok(E.ev("ppFindStCharIndex('a.png')") === 1, 'D5 index by avatar');
}
// ── Group: speaker from message avatar with duplicate names
{
  const st = GROUP();
  st.characters = [A2, A, B, C];
  st.chat = [{ name: 'Aria', original_avatar: 'a.png', mes: 'x' }];
  const E = env(st);
  ok(E.ev('ppLastSpeakerCharId()') === 'a.png', 'G1 dup-name speaker via avatar');
  st.chat = [{ name: 'Aria', mes: 'x' }]; E.ev('ppMainCharCache = null');
  ok(E.ev('ppLastSpeakerCharId()') === 'a.png', 'G1 dup-name speaker via name prefers member');
  st.chat = [{ name: 'Aria', force_avatar: '/thumbnail?type=avatar&file=a.png', mes: 'x' }];
  ok(E.ev('ppCharIdFromStMessage(ctx().chat[0])') === 'a.png', 'G1 force_avatar');
}
// ── Sync batch: missing from, me, group routing, user-from
{
  const st = GROUP();
  const E = env(st);
  // speaker is Bram (last msg)
  E.ev("ppApplySyncBatch({events:[{type:'dm',text:'hello from nobody'}]})");
  const bram = E.ev("findContact('b.png')");
  ok(bram && E.ev("getThread('b.png').some(m=>m.text==='hello from nobody')"), 'S1 missing from -> speaker');
  E.ev("ppApplySyncBatch({events:[{type:'dm',from:'me',text:'me msg'}]})");
  ok(E.ev("getThread('b.png').some(m=>m.text==='me msg')"), 'S2 me -> speaker');
  E.ev("ppApplySyncBatch({events:[{type:'dm',from:'Aria',text:'aria msg'}]})");
  ok(E.ev("getThread('a.png').some(m=>m.text==='aria msg')"), 'S3 explicit other member');
  const n0 = E.ev('getCfg().contacts.length');
  E.ev("ppApplySyncBatch({events:[{type:'dm',from:'Mina',text:'self'}]})");
  ok(E.ev('getCfg().contacts.length') === n0, 'S4 no fake user contact');
  // member to member → bounce
  E.ev("ppApplySyncBatch({events:[{type:'dm',from:'Bram',to:'Cleo',text:'secret'}]})");
  ok(!E.ev("getThread('b.png').some(m=>m.text==='secret')"), 'S5 member->nonmember-ST char');
  E.ev("delete getCfg().contacts; getCfg()");
  E.ev("ppApplySyncBatch({events:[{type:'dm',from:'Bram',to:'Aria',text:'psst'}]})");
  ok(!E.ev("getThread('b.png').some(m=>m.text==='psst')"), 'S6 member->member bounced (Aria not yet contact)');
  ok(E.ev('ppSyncSpeakerId') === null, 'S7 speaker reset');
}
// ── T5 interceptor
{
  const st = GROUP();
  const E = env(st);
  let chat = [{ is_user: true, mes: 'hi' }];
  E.w.ppGenInterceptor(chat, 4096, () => {}, 'normal');
  const cast = chat.find(m => m.is_system && /scene cast/.test(m.mes));
  ok(cast && /Aria/.test(cast.mes) && /Bram/.test(cast.mes) && !/Cleo/.test(cast.mes) && /Mina/.test(cast.mes), 'T5 cast has members', cast && cast.mes);
  E.ev('getCfg().requireContactToInject = true');
  chat = [{ is_user: true, mes: 'hi' }];
  E.w.ppGenInterceptor(chat, 4096, () => {}, 'normal');
  ok(chat.length === 1, 'T5 require contact blocks');
  E.ev("getCfg().contacts.push({id:'a.png',name:'Aria'})");
  chat = [{ is_user: true, mes: 'hi' }];
  E.w.ppGenInterceptor(chat, 4096, () => {}, 'normal');
  ok(chat.length > 1, 'T5 one member in contacts -> inject');
  for (const t of ['quiet', 'impersonate']) { chat = [{ is_user: true, mes: 'hi' }]; E.w.ppGenInterceptor(chat, 4096, () => {}, t); ok(chat.length === 1, 'T5 no inject ' + t); }
  // single
  const E2 = env({ characters: [A], characterId: 0, name1: 'Mina' });
  chat = [{ is_user: true, mes: 'hi' }];
  E2.w.ppGenInterceptor(chat, 4096, () => {}, 'normal');
  const cast2 = chat.find(m => m.is_system && /scene cast/.test(m.mes));
  ok(cast2 && /playing is "Aria"/.test(cast2.mes), 'T5 single cast');
}
// ── T6 identity watch
{
  const E = env({ characters: [A], characterId: 0, name1: 'Mina' });
  E.ev("ppLastIdentityKey = ''");
  let calls = 0;
  E.ev('ppRefreshAllViews = (function(o){ return function(){ window.__rc = (window.__rc||0)+1; }; })(ppRefreshAllViews)');
  E.ev('ppIdentityWatch()'); ok(!E.w.__rc, 'T6 first no refresh');
  E.state.name1 = 'Kira'; E.ev('ppIdentityWatch()'); ok(E.w.__rc === 1, 'T6 refresh on change', E.w.__rc);
  E.ev('ppIdentityWatch()'); ok(E.w.__rc === 1, 'T6 no repeat');
}
// ── T7 screens + settings pages
async function screensTest(label, st) {
  const E = env(st);
  await new Promise(r => setTimeout(r, 900));
  ok(!!E.w.document.getElementById('pp-frame'), 'T7 phone injected ' + label);
  const src = fs.readFileSync(process.env.PP_SRC || require('path').join(__dirname, '..', 'index.js'), 'utf8');
  const fn = src.slice(src.indexOf('function ppRenderScreen('), src.indexOf('function ppRenderScreen(') + 6000);
  const screens = [...new Set([...fn.matchAll(/screen === '([a-z0-9]+)'/g)].map(m => m[1]))];
  E.ev("getCfg().contacts.push({id:'a.png',name:'Aria',avatar:''}, {id:'npc:n1',name:'Nina',npc:true,ownerCharId:'a.png'})");
  E.ev("ppActiveContact = findContact('a.png')");
  const r = quiet();
  const errs = [];
  try {
    E.ev('ppOpen && ppOpen()');
  } catch (e) { errs.push('open:' + e.message); }
  for (const sc of screens) {
    try { E.ev(`ppRenderScreen(${JSON.stringify(sc)}, true)`); } catch (e) { errs.push(sc + ':' + e.message); }
  }
  const pages = E.ev('PP_SET_PAGES.map(p=>p.key)');
  for (const k of pages) {
    try { E.ev(`getCfg().settingsPage = ${JSON.stringify(k)}; renderSetPage()`); } catch (e) { errs.push('set:' + k + ':' + e.message); }
  }
  try { E.ev('renderProfileEdit()'); } catch (e) { errs.push('profedit:' + e.message); }
  r();
  ok(!E.errors.length, 'T7 no uncaught window errors ' + label, E.errors.map(String));
  ok(!errs.length, `T7 ${label} screens(${screens.length}) + settings(${pages.length})`, errs);
  const html = E.w.document.body.innerHTML;
  ok(html.includes('pp-pe-follow-persona'), 'T7 follow-persona switch rendered ' + label);
  return E;
}
(async () => {
await screensTest('single', { characters: [A, A2], characterId: 0, name1: 'Mina' });
const EG = await screensTest('group', GROUP());
EG.ev("ppRenderScreen('messages', true)");
const bar = EG.w.document.getElementById('pp-scope-toggle');
ok(bar && /Aria/.test(bar.textContent) && /Bram/.test(bar.textContent), 'T7 scope bar lists members', bar && bar.textContent);
EG.ev("ppRenderScreen('profedit', true)");
ok(EG.w.document.getElementById('pp-pe-follow-persona')?.checked === true, 'T7 follow switch checked');
await screensTest('none', { characters: [A], name1: 'User' });
setTimeout(() => { console.log(`\nPASS ${pass}  FAIL ${fail}`); process.exit(fail ? 1 : 0); }, 800);
})();
