
'use strict';

/* TRADER LEDGER - Phase 3 Database
   Combined Deal System
   All financial amounts stored as integer paise.
*/

const TL_DB = (() => {
  const NAME = 'trader_ledger';
  const VERSION = 3;

  const SCHEMA = {
    settings: {
      keyPath: 'key',
      idx: []
    },
    parties: {
      idx: [['name'], ['type']]
    },
    purchases: {
      idx: [['date'], ['partyId'], ['productName']]
    },
    sales: {
      idx: [['date'], ['partyId'], ['productName'], ['purchaseId']]
    },
    payments: {
      idx: [['date'], ['partyId'], ['invoiceId'], ['refKey', { unique: true }]]
    },
    expenses: {
      idx: [['date'], ['category']]
    },
    batches: {
      idx: [['purchaseId'], ['date'], ['productName']]
    },
    allocations: {
      idx: [['saleId'], ['batchId']]
    },
    openingBalances: {
      idx: [['partyId']]
    },
    auditLog: {
      idx: [['ts'], ['entity']]
    },

    // New combined deal records
    deals: {
      idx: [
        ['date'],
        ['supplierId'],
        ['customerId'],
        ['itemName']
      ]
    },

    // Separate supplier payments and customer receipts
    dealPayments: {
      idx: [
        ['dealId'],
        ['partyId'],
        ['side'],
        ['date']
      ]
    }
  };

  let dbp = null;

  function open() {
    if (dbp) return dbp;

    dbp = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        dbp = null;
        return reject(new Error('IndexedDB available nahi hai'));
      }

      const request = indexedDB.open(NAME, VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        const tx = request.transaction;

        for (const [name, schema] of Object.entries(SCHEMA)) {
          const store = db.objectStoreNames.contains(name)
            ? tx.objectStore(name)
            : db.createObjectStore(name, {
                keyPath: schema.keyPath || 'id',
                ...(schema.keyPath ? {} : { autoIncrement: true })
              });

          for (const [indexName, options] of schema.idx) {
            if (!store.indexNames.contains(indexName)) {
              store.createIndex(indexName, indexName, options || {});
            }
          }
        }
      };

      request.onsuccess = () => {
        const db = request.result;

        db.onversionchange = () => {
          db.close();
          dbp = null;
        };

        resolve(db);
      };

      request.onerror = () => {
        dbp = null;
        reject(request.error);
      };

      request.onblocked = () => {
        dbp = null;
        reject(new Error('Database blocked hai. Doosre tabs band karein.'));
      };
    });

    return dbp;
  }

  function run(storeName, mode, operation) {
    return open().then(db => new Promise((resolve, reject) => {
      let result;
      let settled = false;

      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);

      try {
        const request = operation(store);

        if (request) {
          request.onsuccess = () => {
            result = request.result;
          };

          request.onerror = () => {
            try {
              tx.abort();
            } catch (_) {}
          };
        }
      } catch (error) {
        try {
          tx.abort();
        } catch (_) {}

        settled = true;
        reject(error);
        return;
      }

      tx.oncomplete = () => {
        if (!settled) {
          settled = true;
          resolve(result);
        }
      };

      tx.onerror = tx.onabort = () => {
        if (!settled) {
          settled = true;
          reject(tx.error || new Error('Database transaction fail hua'));
        }
      };
    }));
  }

  const get = (store, key) =>
    run(store, 'readonly', s => s.get(key));

  const getAll = store =>
    run(store, 'readonly', s => s.getAll());

  const add = (store, value) =>
    run(store, 'readwrite', s => s.add(value));

  const put = (store, value) =>
    run(store, 'readwrite', s => s.put(value));

  const remove = (store, key) =>
    run(store, 'readwrite', s => s.delete(key));

  const count = store =>
    run(store, 'readonly', s => s.count());

  const getByIndex = (store, index, key) =>
    run(store, 'readonly', s => s.index(index).getAll(key));

  async function countAll() {
    let total = 0;

    for (const store of Object.keys(SCHEMA)) {
      if (store !== 'settings') {
        total += await count(store);
      }
    }

    return total;
  }

  async function getSetting(key, fallback = null) {
    const record = await get('settings', key);
    return record ? record.value : fallback;
  }

  const setSetting = (key, value) =>
    put('settings', { key, value });

  const audit = (entity, action, detail = {}) =>
    add('auditLog', {
      ts: Date.now(),
      entity,
      action,
      detail
    });

  return {
    NAME,
    VERSION,
    SCHEMA,
    open,
    get,
    getAll,
    getByIndex,
    add,
    put,
    remove,
    count,
    countAll,
    getSetting,
    setSetting,
    audit
  };
})();
