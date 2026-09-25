const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const SRC = process.env.PP_SRC || path.join(__dirname, '..', 'index.js');

function makeEnv(stateInit) {
  const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body><div id="extensions_settings"></div><div id="chat"></div></body></html>`,
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
  const w = dom.window;
  const state = Object.assign({
    extensionSettings: {},
    characters: [], characterId: undefined, groupId: null, groups: [],
    chat: [], name1: 'User', chatId: 'chat-1',
    powerUserSettings: { personas: {}, persona_descriptions: {} },
    userAvatar: '',
  }, stateInit || {});
  const handlers = {};
  const ctxObj = () => Object.assign(state, {
    saveSettingsDebounced() {},
    eventSource: { on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); } },
    event_types: { CHAT_CHANGED: 'chat_changed', GENERATION_ENDED: 'gen_end', GENERATION_STARTED: 'gen_start', GENERATION_STOPPED: 'gen_stop', CHARACTER_MESSAGE_RENDERED: 'cmr' },
    getRequestHeaders() { return {}; },
  });
  w.SillyTavern = { getContext: ctxObj, libs: {} };
  w.structuredClone = w.structuredClone || (o => JSON.parse(JSON.stringify(o)));
  w.fetch = async () => ({ ok: false, json: async () => ({}) });
  w.HTMLDialogElement && (w.HTMLDialogElement.prototype.showModal = function () { this.open = true; });
  w.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  w.console = console;
  w.HTMLMediaElement.prototype.pause = function () {}; w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); }; w.HTMLMediaElement.prototype.load = function () {};
  const errors = [];
  w.addEventListener('error', e => errors.push(e.error || e.message));
  w.eval(fs.readFileSync(SRC, 'utf8') + '\n;window.__pp = function (s) { return eval(s); };');
  return { w, dom, state, handlers, errors, ev: s => w.__pp(s) };
}
module.exports = { makeEnv };
