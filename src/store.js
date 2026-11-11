// 저장소. 브라우저에서는 IndexedDB, 테스트에서는 메모리 구현을 쓴다. 인터페이스는 같다.
//  카드:  putCards(cards), listCards({day}), listDays(), deleteDay(day)
//  상태:  getStates() → 배열, putState(state)   (간격 반복 상태, 카드 id 기준)
//  로그:  putLog(entry), listLogs()
//  백업:  exportAll() → {cards, states, logs}, importAll({cards, states, logs}) (전체 교체)

const byOrder = (a, b) => a.day - b.day || a.order - b.order;

export function createMemoryStore() {
  const cards = new Map();
  const states = new Map();
  const logs = [];
  return {
    async putCards(list) { for (const c of list) cards.set(c.id, { ...c }); },
    async listCards({ day } = {}) {
      return [...cards.values()].filter((c) => day == null || c.day === day).sort(byOrder);
    },
    async listDays() { return [...new Set([...cards.values()].map((c) => c.day))].sort((a, b) => a - b); },
    async deleteDay(day) {
      for (const [k, c] of cards) if (c.day === day) { cards.delete(k); states.delete(k); }
    },
    async getStates() { return [...states.values()].map((s) => ({ ...s })); },
    async putState(s) { states.set(s.id, { ...s }); },
    async putLog(e) { logs.push({ ...e }); },
    async listLogs() { return logs.map((e) => ({ ...e })); },
    async exportAll() { return { cards: await this.listCards(), states: await this.getStates(), logs: await this.listLogs() }; },
    async importAll(d) {
      cards.clear(); states.clear(); logs.length = 0;
      d.cards.forEach((c) => cards.set(c.id, { ...c }));
      d.states.forEach((x) => states.set(x.id, { ...x }));
      d.logs.forEach((l) => logs.push({ ...l }));
    },
  };
}

// localStorage에 통째로 저장하는 보조 저장소(IndexedDB를 못 쓰는 환경용).
export function createLocalStore(key = 'vocab-app-data-v1') {
  const mem = createMemoryStore();
  const save = async () => { localStorage.setItem(key, JSON.stringify(await mem.exportAll())); };
  const ready = (async () => {
    const raw = localStorage.getItem(key);          // 접근이 막혀 있으면 여기서 예외 → 호출한 쪽이 다음 방식으로 넘어간다
    if (raw) await mem.importAll(JSON.parse(raw));
    else localStorage.setItem(key, JSON.stringify({ cards: [], states: [], logs: [] }));
  })();
  const wrap = (fn, write) => async (...a) => { await ready; const r = await fn(...a); if (write) await save(); return r; };
  return {
    putCards: wrap(mem.putCards, true), listCards: wrap(mem.listCards), listDays: wrap(mem.listDays), deleteDay: wrap(mem.deleteDay, true),
    getStates: wrap(mem.getStates), putState: wrap(mem.putState, true), putLog: wrap(mem.putLog, true), listLogs: wrap(mem.listLogs),
    exportAll: wrap(mem.exportAll), importAll: wrap(mem.importAll, true), ready,
  };
}

// 가능한 저장 방식을 차례로 시도한다. mode: 'idb' | 'local' | 'memory'(저장 안 됨)
export function createStore() {
  const NAMES = ['putCards', 'listCards', 'listDays', 'deleteDay', 'getStates', 'putState', 'putLog', 'listLogs', 'exportAll', 'importAll'];
  const out = { mode: 'pending' };
  const pick = (async () => {
    try {
      if (typeof indexedDB === 'undefined') throw new Error('no idb');
      const s = createIdbStore();
      await Promise.race([s.listDays(), new Promise((_, rej) => setTimeout(() => rej(new Error('idb timeout')), 2000))]);
      out.mode = 'idb'; return s;
    } catch { /* 다음 방식 */ }
    try {
      const s = createLocalStore(); await s.ready;
      out.mode = 'local'; return s;
    } catch { /* 다음 방식 */ }
    out.mode = 'memory';
    return createMemoryStore();
  })();
  NAMES.forEach((n) => { out[n] = async (...a) => (await pick)[n](...a); });
  out.whenReady = () => pick.then(() => out.mode);
  return out;
}

export function createIdbStore(dbName = 'vocab-app') {
  const open = () => new Promise((res, rej) => {
    const r = indexedDB.open(dbName, 2);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('cards')) {
        db.createObjectStore('cards', { keyPath: 'id' }).createIndex('day', 'day');
      }
      if (!db.objectStoreNames.contains('states')) db.createObjectStore('states', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('logs')) db.createObjectStore('logs', { autoIncrement: true });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const run = async (names, mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const tx = db.transaction(names, mode);
      const out = fn(...names.map((n) => tx.objectStore(n)));
      tx.oncomplete = () => { db.close(); res(out && 'result' in out ? out.result : out); };
      tx.onerror = () => rej(tx.error);
    });
  };
  return {
    // 같은 id를 다시 저장하면 내용만 갱신한다(학습 상태는 별도 저장소라 그대로).
    putCards: (list) => run(['cards'], 'readwrite', (s) => { list.forEach((c) => s.put(c)); }),
    listCards: async ({ day } = {}) => (await run(['cards'], 'readonly',
      (s) => (day == null ? s.getAll() : s.index('day').getAll(day)))).sort(byOrder),
    async listDays() {
      const all = await this.listCards();
      return [...new Set(all.map((c) => c.day))].sort((a, b) => a - b);
    },
    deleteDay: (day) => run(['cards', 'states'], 'readwrite', (cs, ss) => {
      const r = cs.index('day').openCursor(day);
      r.onsuccess = () => { const c = r.result; if (c) { ss.delete(c.value.id); c.delete(); c.continue(); } };
    }),
    getStates: () => run(['states'], 'readonly', (s) => s.getAll()),
    putState: (st) => run(['states'], 'readwrite', (s) => { s.put(st); }),
    putLog: (e) => run(['logs'], 'readwrite', (s) => { s.add(e); }),
    listLogs: () => run(['logs'], 'readonly', (s) => s.getAll()),
    async exportAll() { return { cards: await this.listCards(), states: await this.getStates(), logs: await this.listLogs() }; },
    importAll: (d) => run(['cards', 'states', 'logs'], 'readwrite', (cs, ss, ls) => {
      cs.clear(); ss.clear(); ls.clear();
      d.cards.forEach((c) => cs.put(c)); d.states.forEach((x) => ss.put(x)); d.logs.forEach((l) => ls.add(l));
    }),
  };
}
