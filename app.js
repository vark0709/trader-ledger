
'use strict';
(() => {
  const VER = '0.2.0 (Phase 2)';
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  function inr(paise) {
    const n = Math.trunc(Number(paise) || 0);
    const a = Math.abs(n);
    return (n < 0 ? '-' : '') + '₹' +
      new Intl.NumberFormat('en-IN').format(Math.floor(a / 100)) +
      '.' + String(a % 100).padStart(2, '0');
  }

  function toPaise(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) throw new Error('Sahi amount enter karein');
    return Math.round(n * 100);
  }

  const TITLES = {
    home: 'Dashboard', purchase: 'Khareed (Purchase)',
    sales: 'Bikri (Sales)', parties: 'Parties',
    payments: 'Payment', expenses: 'Kharcha (Expenses)',
    reports: 'Reports', backup: 'Backup aur Restore',
    settings: 'Settings', more: 'Aur options'
  };

  const NAVMAP = {
    home: 'home', purchase: 'purchase',
    sales: 'sales', parties: 'parties'
  };

  const MODULES = {
    purchase: ['Supplier se maal ki purchase invoice',
      'Cash, UPI ya Bank se partial ya full payment',
      'Manual purchase cost selection'],
    sales: ['Customer ko bikri ki invoice',
      'Bikri-wise gross profit',
      'Baaki raqam lena (receivable) mein jayegi'],
    payments: ['Invoice ke against payment: Cash, UPI, Bank',
      'Duplicate payment entry se bachav',
      'Payment edit aur reversal'],
    expenses: ['Business kharcha entry',
      'Net profit = gross profit minus kharcha'],
    reports: ['Munafa, lena, dena aur balance reports',
      'Date-wise filter'],
    backup: ['Password se encrypted backup file',
      'Backup se restore']
  };

  const ZERO = 0;
  const row = (l, v) =>
    `<div class="row"><span>${l}</span><b>${inr(v)}</b></div>`;

  const VIEWS = {
    async home() {
      const name = await TL_DB.getSetting('businessName', '');
      return `
        <div class="hero">
          <small>${name ? esc(name) + ' ka net munafa' : 'Net munafa'}</small>
          <div class="big">${inr(ZERO)}</div>
        </div>
        <div class="grp">
          <h3>Paisa kahan hai</h3>
          ${row('Cash', ZERO)}${row('UPI', ZERO)}
          ${row('Bank', ZERO)}${row('Kul paisa', ZERO)}
        </div>
        <div class="grp">
          <h3>Lena aur dena</h3>
          ${row('Lena hai (customers se)', ZERO)}
          ${row('Dena hai (suppliers ko)', ZERO)}
        </div>
        <div class="grp">
          <h3>Munafa</h3>
          ${row('Gross munafa', ZERO)}
          ${row('Kharcha', ZERO)}${row('Net munafa', ZERO)}
        </div>
        <p class="note">Dashboard calculations abhi develop ho rahe hain.
        Parties module ka data ab save hoga.</p>`;
    },

    async parties() {
      const parties = await TL_DB.getAll('parties');
      parties.sort((a, b) => a.name.localeCompare(b.name));

      const cards = parties.length
        ? parties.map(p => {
            const type = {
              customer: 'Customer',
              supplier: 'Supplier',
              both: 'Customer + Supplier'
            }[p.type] || p.type;

            const balance = p.openingBalancePaise || 0;
            const side = p.openingBalanceSide === 'pay'
              ? 'Humein dena hai'
              : 'Humein lena hai';

            return `
              <div class="party-card">
                <div class="row">
                  <span>
                    <strong>${esc(p.name)}</strong>
                    <small>${esc(type)}</small>
                    <small>${esc(p.phone || 'Phone nahi diya')}</small>
                  </span>
                  <b>${inr(balance)}</b>
                </div>
                <small class="mut">${side}</small>
                <div class="party-actions">
                  <button type="button" class="ghost"
                    data-edit="${p.id}">Edit</button>
                  <button type="button" class="ghost"
                    data-delete="${p.id}">Delete</button>
                </div>
              </div>`;
          }).join('')
        : '<p class="note">Abhi koi party add nahi hui hai.</p>';

      return `
        <div class="grp">
          <h3>Nayi party add karein</h3>
          <form id="partyForm">
            <input type="hidden" id="partyId">

            <label for="partyName">Party ka naam *</label>
            <input id="partyName" maxlength="80"
              autocomplete="off" required placeholder="Naam enter karein">

            <label for="partyPhone">Phone number</label>
            <input id="partyPhone" type="tel" maxlength="15"
              autocomplete="off" placeholder="Optional">

            <label for="partyType">Party type *</label>
            <select id="partyType" required>
              <option value="customer">Customer</option>
              <option value="supplier">Supplier</option>
              <option value="both">Both</option>
            </select>

            <label for="openingAmount">Opening balance (₹)</label>
            <input id="openingAmount" type="number"
              min="0" step="0.01" value="0" required>

            <label for="openingSide">Opening balance ka hisaab</label>
            <select id="openingSide">
              <option value="receive">Humein lena hai (Receivable)</option>
              <option value="pay">Humein dena hai (Payable)</option>
            </select>

            <button type="submit" id="partySave">Party save karein</button>
            <button type="button" class="ghost"
              id="partyCancel" hidden>Cancel edit</button>
          </form>
        </div>

        <div class="grp">
          <h3>Party list (${parties.length})</h3>
          ${cards}
        </div>`;
    },

    more() {
      const l = (k, d) =>
        `<a class="row" href="#/${k}">
          <span>${TITLES[k]}<small>${d}</small></span><b>›</b>
        </a>`;
      return l('payments', 'Paisa aaya ya diya') +
        l('expenses', 'Business kharcha') +
        l('reports', 'Munafa aur hisaab') +
        l('backup', 'Data ki safe copy') +
        l('settings', 'App aur database ki jaankari');
    },

    async settings() {
      const name = await TL_DB.getSetting('businessName', '');
      const total = await TL_DB.countAll();
      let persisted = false, usage = '';

      try { persisted = await navigator.storage.persisted(); } catch (e) {}
      try {
        const e = await navigator.storage.estimate();
        usage = Math.round((e.usage || 0) / 1024) + ' KB';
      } catch (e) {}

      const standalone = matchMedia('(display-mode: standalone)').matches;
      const offline = 'serviceWorker' in navigator &&
        !!navigator.serviceWorker.controller;

      return `
        <form id="f">
          <label for="bn">Business ka naam</label>
          <input id="bn" maxlength="60" autocomplete="off"
            value="${esc(name)}">
          <button type="submit">Save karein</button>
        </form>
        <div class="grp">
          <h3>Device par data</h3>
          <div class="row"><span>Database</span>
            <b style="font-size:16px">Taiyaar (v${TL_DB.VERSION})</b></div>
          <div class="row"><span>Saved records</span>
            <b style="font-size:16px">${total}</b></div>
          <div class="row"><span>Storage use</span>
            <b style="font-size:16px">${usage || 'Pata nahi'}</b></div>
          <div class="row"><span>Storage surakshit</span>
            <b style="font-size:16px">${persisted ? 'Haan' : 'Nahi'}</b></div>
          ${persisted ? '' :
            '<button type="button" class="ghost" id="persist">Storage surakshit karein</button>'}
        </div>
        <div class="grp">
          <h3>App</h3>
          <div class="row"><span>Version</span>
            <b style="font-size:16px">${VER}</b></div>
          <div class="row"><span>Offline chalne ke liye</span>
            <b style="font-size:16px">${offline ? 'Taiyaar' : 'Reload ke baad'}</b></div>
          <div class="row"><span>Home screen par</span>
            <b style="font-size:16px">${standalone ? 'Install hai' : 'Install nahi'}</b></div>
          ${standalone ? '' :
            '<button type="button" class="ghost" id="install">App install karein</button>'}
        </div>
        <p class="note">Data is phone ke browser storage mein rehta hai.
        Abhi encrypted backup aur app lock develop nahi hue hain.</p>`;
    }
  };

  for (const k of Object.keys(MODULES)) {
    VIEWS[k] = () => `
      <p class="mut">Yeh screen abhi develop nahi hui hai.</p>
      <ul class="ph">${MODULES[k].map(x => `<li>${x}</li>`).join('')}</ul>`;
  }

  let toastT;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.hidden = true; }, 2500);
  }

  let deferred = null;
  addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
  });

  function wireParties() {
    const form = $('#partyForm');
    if (!form) return;

    const resetForm = () => {
      form.reset();
      $('#partyId').value = '';
      $('#openingAmount').value = '0';
      $('#partySave').textContent = 'Party save karein';
      $('#partyCancel').hidden = true;
    };

    form.addEventListener('submit', async e => {
      e.preventDefault();

      try {
        const idValue = $('#partyId').value;
        const name = $('#partyName').value.trim();
        const phone = $('#partyPhone').value.trim();
        const type = $('#partyType').value;
        const openingBalancePaise = toPaise($('#openingAmount').value);
        const openingBalanceSide = $('#openingSide').value;

        if (!name) throw new Error('Party ka naam zaroori hai');

        const now = Date.now();
        const record = {
          name, phone, type,
          openingBalancePaise,
          openingBalanceSide,
          updatedAt: now
        };

        if (idValue) {
          const old = await TL_DB.get('parties', Number(idValue));
          if (!old) throw new Error('Party record nahi mila');

          await TL_DB.put('parties', {
            ...old, ...record
          });
          await TL_DB.audit('party', 'update', { id: Number(idValue), name });
          toast('Party update ho gayi');
        } else {
          const id = await TL_DB.add('parties', {
            ...record, createdAt: now
          });
          await TL_DB.audit('party', 'add', { id, name });
          toast('Party save ho gayi');
        }

        await route();
      } catch (err) {
        toast('Save nahi hua: ' + err.message);
      }
    });

    $('#partyCancel').addEventListener('click', () => {
      resetForm();
    });

    $('#view').addEventListener('click', async e => {
      const editButton = e.target.closest('[data-edit]');
      const deleteButton = e.target.closest('[data-delete]');

      if (editButton) {
        const id = Number(editButton.dataset.edit);
        const p = await TL_DB.get('parties', id);
        if (!p) return toast('Party nahi mili');

        $('#partyId').value = p.id;
        $('#partyName').value = p.name;
        $('#partyPhone').value = p.phone || '';
        $('#partyType').value = p.type;
        $('#openingAmount').value =
          ((p.openingBalancePaise || 0) / 100).toFixed(2);
        $('#openingSide').value = p.openingBalanceSide || 'receive';
        $('#partySave').textContent = 'Changes save karein';
        $('#partyCancel').hidden = false;
        $('#partyName').focus();
        return;
      }

      if (deleteButton) {
        const id = Number(deleteButton.dataset.delete);
        const p = await TL_DB.get('parties', id);
        if (!p) return toast('Party nahi mili');

        const ok = confirm(
          `"${p.name}" ko delete karna hai?\nYeh action undo nahi hoga.`
        );
        if (!ok) return;

        try {
          const purchases = await TL_DB.getByIndex('purchases', 'partyId', id);
          const sales = await TL_DB.getByIndex('sales', 'partyId', id);
          const payments = await TL_DB.getByIndex('payments', 'partyId', id);

          if (purchases.length || sales.length || payments.length) {
            return toast('Is party ke transactions hain. Delete nahi kar sakte.');
          }

          await TL_DB.remove('parties', id);
          await TL_DB.audit('party', 'delete', { id, name: p.name });
          toast('Party delete ho gayi');
          await route();
        } catch (err) {
          toast('Delete nahi hua: ' + err.message);
        }
      }
    });
  }

  function wireSettings() {
    $('#f').addEventListener('submit', async e => {
      e.preventDefault();
      try {
        await TL_DB.setSetting('businessName',
          $('#bn').value.trim().slice(0, 60));
        await TL_DB.audit('settings', 'update',
          { key: 'businessName' });
        toast('Save ho gaya');
      } catch (err) {
        toast('Save nahi hua: ' + err.message);
      }
    });

    const p = $('#persist');
    if (p) p.addEventListener('click', async () => {
      try {
        const ok = await navigator.storage.persist();
        toast(ok ? 'Storage surakshit ho gaya' :
          'Browser ne abhi mana kiya');
        route();
      } catch (e) {
        toast('Yeh browser mein available nahi');
      }
    });

    const i = $('#install');
    if (i) i.addEventListener('click', async () => {
      if (deferred) {
        deferred.prompt();
        await deferred.userChoice;
        deferred = null;
      } else {
        toast('Chrome menu (⋮) mein Install app ya Add to Home screen dabayein');
      }
    });
  }

  async function route() {
    const h = location.hash.replace(/^#\/?/, '') || 'home';
    const id = VIEWS[h] ? h : 'home';

    $('#title').textContent = TITLES[id];

    try {
      $('#view').innerHTML = await VIEWS[id]();
    } catch (e) {
      $('#view').innerHTML =
        `<p class="note">Database khul nahi paya: ${esc(e.message)}</p>`;
    }

    if (id === 'settings' && $('#f')) wireSettings();
    if (id === 'parties') wireParties();

    document.querySelectorAll('nav a').forEach(a =>
      a.classList.toggle('on',
        a.dataset.k === (NAVMAP[id] || 'more'))
    );

    scrollTo(0, 0);
  }

  function conn() {
    const c = $('#conn');
    c.textContent = navigator.onLine ? 'Online' : 'Offline';
    c.classList.toggle('off', !navigator.onLine);
  }

  addEventListener('online', conn);
  addEventListener('offline', conn);
  addEventListener('hashchange', route);

  conn();
  TL_DB.open().catch(() => {}).then(route);

  if ('serviceWorker' in navigator) {
    addEventListener('load', () =>
      navigator.serviceWorker.register('./service-worker.js')
        .catch(() => {})
    );
  }
})();
