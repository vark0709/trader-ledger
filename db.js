'use strict';
/* IndexedDB layer. Phase 1: sirf schema aur basic helpers. Koi financial logic nahi.
   Paise: sabhi amounts future mein integer paise mein store honge. */
const TL_DB = (() => {
  const NAME = 'trader_ledger', VERSION = 1;
  const SCHEMA = {
    settings:        { keyPath: 'key' },
    parties:         { idx: [['name'], ['type']] },
    purchases:       { idx: [['date'], ['partyId']] },
    sales:           { idx: [['date'], ['partyId']] },
    payments:        { idx: [['date'], ['partyId'], ['invoiceId'], ['refKey', { unique: true }]] },
    expenses:        { idx: [['date']] },
    batches:         { idx: [['purchaseId'], ['date']] },
    allocations:     { idx: [['saleId'], ['batchId']] },
    openingBalances: { idx: [] },
    auditLog:        { idx: [['ts'], ['entity']] }
  };
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('IndexedDB is browser mein available nahi hai'));
      const rq = indexedDB.open(NAME, VERSION);
      rq.onupgradeneeded = () => {
        const db = rq.result, tx = rq.transaction;
        for (const [name, s] of Object.entries(SCHEMA)) {
          const st = db.objectStoreNames.contains(name) ? tx.objectStore(name)
            : db.createObjectStore(name, s.keyPath ? { keyPath: s.keyPath } : { keyPath: 'id', autoIncrement: true });
          for (const [k, o] of (s.idx || [])) if (!st.indexNames.contains(k)) st.createIndex(k, k, o || {});
        }
      };
      rq.onsuccess = () => { const db = rq.result; db.onversionchange = () => db.close(); res(db); };
      rq.onerror = () => { dbp = null; rej(rq.error); };
      rq.onblocked = () => { dbp = null; rej(new Error('Database blocked hai: doosre tab band karein')); };
    });
    return dbp;
  }

  function run(store, mode, fn) {
    return open().then(db => new Promise((res, rej) => {
      const tx = db.transaction(store, mode);
      let out;
      const rq = fn(tx.objectStore(store));
      if (rq) rq.onsuccess = () => { out = rq.result; };
      tx.oncomplete = () => res(out);
      tx.onerror = tx.onabort = () => rej(tx.error || new Error('Transaction fail hua'));
    }));
  }

  const get = (s, k) => run(s, 'readonly', st => st.get(k));
  const put = (s, v) => run(s, 'readwrite', st => st.put(v));
  const getAll = s => run(s, 'readonly', st => st.getAll());
  const count = s => run(s, 'readonly', st => st.count());
  const countAll = async () => {
    let n = 0;
    for (const s of Object.keys(SCHEMA)) if (s !== 'settings') n += await count(s);
    return n;
  };
  const getSetting = async (k, d = null) => { const r = await get('settings', k); return r ? r.value : d; };
  const setSetting = (k, value) => put('settings', { key: k, value });
  const audit = (entity, action, detail = {}) => put('auditLog', { ts: Date.now(), entity, action, detail });

  return { VERSION, open, get, put, getAll, count, countAll, getSetting, setSetting, audit };
})();
