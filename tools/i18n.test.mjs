import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_SETTINGS, VERSION, MAPS, WEAPONS, SUBS, SPECIALS, DIFFICULTY } from '../src/config.js';
import { ZH_PHRASES } from '../src/i18n/zh.js';

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
globalThis.document = { documentElement: { lang: 'zh-CN' } };
const i18n = await import('../src/i18n/strings.js');
let nextImport = 0;
const fresh = () => import(`../src/i18n/strings.js?test=${++nextImport}`);

test('first visit uses Chinese in the dictionary and game settings', () => {
  assert.equal(i18n.getLang(), 'zh');
  assert.equal(DEFAULT_SETTINGS.lang, 'zh');
  for (const key of ['PLAY', 'ONLINE', 'LOADOUT', 'LOCKER', 'HOW TO PLAY', 'BOSS BATTLE', 'settings.title', 'Turf War · Zone Control · Boss Battle', 'Play with friends · private rooms', 'MATCHES', 'CURRENT LOADOUT']) {
    assert.match(i18n.t(key), /[\u3400-\u9fff]/, key);
  }
});

test('every map, weapon, sub and special has a translated name and description', () => {
  for (const item of [...MAPS, ...Object.values(WEAPONS), ...Object.values(SUBS), ...Object.values(SPECIALS), ...Object.values(DIFFICULTY)]) {
    for (const field of ['name', 'blurb']) {
      if (item[field]) assert.match(i18n.t(item[field]), /[\u3400-\u9fff]/, `${item.id}: ${field}`);
    }
  }
  assert.equal(i18n.t('Tidewater Plaza'), '海滨钟楼广场');
});

test('Chinese interpolation preserves every variable', () => {
  const placeholders = (text) => [...text.matchAll(/\{([a-zA-Z]+)\}/g)].map((match) => match[1]).sort();
  for (const [key, value] of Object.entries(ZH_PHRASES)) {
    assert.deepEqual(placeholders(value), placeholders(key), key);
  }
  assert.equal(i18n.t('Connecting to room {code}…', { code: 'A7BCD' }), '正在连接房间 A7BCD…');
  assert.equal(i18n.t('Player-Nickname'), 'Player-Nickname');
});

test('English remains selectable, persists and can switch back to Chinese', async () => {
  const notices = [];
  const off = i18n.onLangChange((id) => notices.push(id));
  i18n.setLang('en');
  assert.equal(i18n.t('PLAY'), 'PLAY');
  assert.equal(document.documentElement.lang, 'en');
  assert.equal(storage.get('inkwave.lang'), 'en');
  assert.equal((await fresh()).getLang(), 'en');
  i18n.setLang('zh');
  assert.equal(i18n.t('PLAY'), '开始游戏');
  assert.equal(document.documentElement.lang, 'zh');
  assert.deepEqual(notices, ['en', 'zh']);
  off();
});

test('invalid or unavailable local storage still starts in Chinese', async () => {
  storage.set('inkwave.lang', 'invalid');
  assert.equal((await fresh()).getLang(), 'zh');
  const getItem = localStorage.getItem;
  localStorage.getItem = () => { throw new Error('storage unavailable'); };
  try { assert.equal((await fresh()).getLang(), 'zh'); }
  finally { localStorage.getItem = getItem; storage.delete('inkwave.lang'); }
});

test('Chinese page metadata and displayed version match the release', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /<title>INKWAVE · 涂地大乱斗<\/title>/);
  assert.equal(VERSION, pkg.version);
});
