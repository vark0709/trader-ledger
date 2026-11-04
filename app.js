
'use strict';

(() => {
  const VER = '0.3.0 (Combined Deals)';

  const $ = s => document.querySelector(s);

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;'
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
    if (!Number.isFinite(n) || n < 0) {
      throw new Error('Rate sahi enter karein');
    }
    const result = Math.round(n * 100);
    if (!Number.isSafeInteger(result)) {
      throw new Error('Amount bahut bada hai');
    }
    return result;
  }

  function todayISO() {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
    ].join('-');
  }

  function formatDate(value) {
    if (!value) return '-';
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  const TITLES = {
    home: 'Dashboard',
    purchase: 'Khareed / New Deal',
    sales: 'Bikri / New Deal',
    parties: 'Parties',
    payments: 'Payment',
    expenses: 'Kharcha (Expenses)',
    reports: 'Reports',
    backup: 'Backup aur Restore',
    settings: 'Settings',
    more: 'Aur options'
  };

  const NAVMAP = {
    home: 'home',
    purchase: 'purchase',
    sales: 'sales',
    parties: 'parties'
  };

  const MODULES = {
    payments: ['Supplier payment aur customer receipt alag',
      'Cash, UPI, Bank', 'Partial aur full payment'],
    expenses: ['Business kharcha entry',
      'Net profit calculation'],
    reports: ['Deal-wise profit/loss',
      'Monthly reports'],
    backup: ['Password-protected encrypted backup',
      'Backup se restore']
  };

  const ZERO = 0;

  const row = (label, value) =>
    `<div class="row"><span>${label}</span><b>${inr(value)}</b></div>`;

  let toastT;

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => {
      t.hidden = true;
    }, 2800);
  }

  async function getParties() {
    return TL_DB.getAll('parties');
  }

  function partyOptions(parties, type, selected = '') {
    const eligible = parties.filter(p =>
      p.type === type || p.type === 'both'
    );

    return '<option value="">Party select karein</option>' +
      eligible.map(p =>
        `<option value="${p.id}" ${String(p.id) === String(selected) ? 'selected' : ''}>
          ${esc(p.name)}
        </option>`
      ).join('');
  }

  async function dealScreen() {
    const parties = await getParties();
    const deals = await TL_DB.getAll('deals');

    deals.sort((a, b) =>
      (b.createdAt || 0) - (a.createdAt || 0)
    );

    const supplierOptions = partyOptions(parties, 'supplier');
    const customerOptions = partyOptions(parties, 'customer');

    const history = deals.length
      ? deals.map(d => `
        <div class="deal-card">
          <div class="row">
            <span>
              <strong>${esc(d.itemName)}</strong>
              <small>${formatDate(d.date)}</small>
            </span>
            <b>${inr(d.profitPaise)}</b>
          </div>
          <small class="mut">
            ${esc(d.supplierName)} → ${esc(d.customerName)}
          </small>
          <small class="mut">
            ${d.quantity} pcs × Buy ${inr(d.buyRatePaise)}
            / Sell ${inr(d.sellRatePaise)}
          </small>
          <small class="${d.profitPaise >= 0 ? 'profit-text' : 'loss-text'}">
            ${d.profitPaise >= 0 ? 'Profit' : 'Loss'}:
            ${inr(Math.abs(d.profitPaise))}
          </small>
          <div class="deal-actions">
            <button type="button" class="ghost"
              data-edit-deal="${d.id}">Edit</button>
            <button type="button" class="ghost"
              data-delete-deal="${d.id}">Delete</button>
          </div>
        </div>
      `).join('')
      : '<p class="note">Abhi koi deal save nahi hui hai.</p>';

    return `
      <div class="grp">
        <h3>New Deal Entry</h3>
        <p class="mut">Purchase aur sale ek saath enter karein.</p>

        <form id="dealForm">
          <input type="hidden" id="dealId">
          <input type="hidden" id="dealDateISO" value="${todayISO()}">

          <label>Deal date</label>
          <input type="text" id="dealDate"
            value="${formatDate(todayISO())}" readonly>

          <label for="itemName">Item name *</label>
          <input id="itemName" maxlength="100"
            placeholder="Example: XYZ" required>

          <label for="supplierId">Buy from — Supplier *</label>
          <select id="supplierId" required>
            ${supplierOptions}
          </select>

          <label for="customerId">Sell to — Customer *</label>
          <select id="customerId" required>
            ${customerOptions}
          </select>

          <label for="quantity">How many pcs? *</label>
          <input id="quantity" type="number"
            min="1" step="1" placeholder="20" required>

          <label for="buyRate">Buy at — per piece (₹) *</label>
          <input id="buyRate" type="number"
            min="0" step="0.01" placeholder="10.00" required>

          <label for="sellRate">Sell at — per piece (₹) *</label>
          <input id="sellRate" type="number"
            min="0" step="0.01" placeholder="11.00" required>

          <div class="deal-summary">
            <h3>Automatic calculation</h3>
            <div class="row">
              <span>Purchase total</span><b id="buyTotal">₹0.00</b>
            </div>
            <div class="row">
              <span>Sales total</span><b id="sellTotal">₹0.00</b>
            </div>
            <div class="row">
              <span>Per piece profit/loss</span><b id="perProfit">₹0.00</b>
            </div>
            <div class="row">
              <strong id="profitLabel">Total profit</strong>
              <b id="totalProfit">₹0.00</b>
            </div>
          </div>

          <button type="submit" id="dealSave">Deal save karein</button>
          <button type="button" class="ghost"
            id="dealCancel" hidden>Cancel edit</button>
        </form>

        ${parties.filter(p => p.type === 'supplier' || p.type === 'both').length === 0
          ? '<p class="note">Pehle Parties mein ek Supplier add karein.</p>' : ''}
        ${parties.filter(p => p.type === 'customer' || p.type === 'both').length === 0
          ? '<p class="note">Pehle Parties mein ek Customer add karein.</p>' : ''}
      </div>

      <div class="grp">
        <h3>Deal history (${deals.length})</h3>
        ${history}
      </div>
    `;
  }

  const VIEWS = {
    async home() {
      const name = await TL_DB.getSetting('businessName', '');
      const deals = await TL_DB.getAll('deals');

      const profit = deals.reduce(
        (sum, d) => sum + (d.profitPaise || 0), 0
      );

      return `
        <div class="hero">
          <small>${name ? esc(name) + ' ka net munafa' : 'Deal gross profit (expenses se pehle)'}</small>
          <div class="big">${inr(profit)}</div>
        </div>
        <div class="grp">
          <h3>Deals</h3>
          <div class="row">
            <span>Total deals</span><b>${deals.length}</b>
          </div>
          ${row('Gross profit / loss', profit)}
        </div>
        <div class="grp">
          <h3>Paisa aur outstanding</h3>
          ${row('Cash', ZERO)}
          ${row('UPI', ZERO)}
          ${row('Bank', ZERO)}
          ${row('Lena hai', ZERO)}
          ${row('Dena hai', ZERO)}
        </div>
        <p class="note">Deal profit calculate ho raha hai.
        Payment balances aur expenses agle modules mein implement honge.</p>
      `;
    },

    purchase: dealScreen,
    sales: dealScreen,

    async parties() {
      const parties = await getParties();
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
                    data-edit-party="${p.id}">Edit</button>
                  <button type="button" class="ghost"
                    data-delete-party="${p.id}">Delete</button>
                </div>
              </div>
            `;
          }).join('')
        : '<p class="note">Abhi koi party add nahi hui hai.</p>';

      return `
        <div class="grp">
          <h3>Nayi party add karein</h3>
          <form id="partyForm">
            <input type="hidden" id="partyId">

            <label for="partyName">Party ka naam *</label>
            <input id="partyName" maxlength="80" required>

            <label for="partyPhone">Phone number</label>
            <input id="partyPhone" type="tel" maxlength="15">

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
              <option value="receive">Humein lena hai</option>
              <option value="pay">Humein dena hai</option>
            </select>

            <button type="submit" id="partySave">Party save karein</button>
            <button type="button" class="ghost"
              id="partyCancel" hidden>Cancel edit</button>
          </form>
        </div>
        <div class="grp">
          <h3>Party list (${parties.length})</h3>
          ${cards}
        </div>
      `;
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

      let persisted = false;
      let usage = '';

      try {
        persisted = await navigator.storage.persisted();
      } catch (e) {}

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
          <input id="bn" maxlength="60" value="${esc(name)}">
          <button type="submit">Save karein</button>
        </form>
        <div class="grp">
          <h3>Device par data</h3>
          <div class="row"><span>Database</span>
            <b>v${TL_DB.VERSION}</b></div>
          <div class="row"><span>Saved records</span><b>${total}</b></div>
          <div class="row"><span>Storage use</span><b>${usage || 'Pata nahi'}</b></div>
          <div class="row"><span>Storage surakshit</span>
            <b>${persisted ? 'Haan' : 'Nahi'}</b></div>
          ${persisted ? '' :
            '<button type="button" class="ghost" id="persist">Storage surakshit karein</button>'}
        </div>
        <div class="grp">
          <h3>App</h3>
          <div class="row"><span>Version</span><b>${VER}</b></div>
          <div class="row"><span>Offline status</span>
            <b>${offline ? 'Taiyaar' : 'Reload ke baad'}</b></div>
          <div class="row"><span>Home screen par</span>
            <b>${standalone ? 'Install hai' : 'Install nahi'}</b></div>
          ${standalone ? '' :
            '<button type="button" class="ghost" id="install">App install karein</button>'}
        </div>
        <p class="note">Data is phone ke browser storage mein rehta hai.
        Encrypted backup aur app lock abhi develop nahi hue hain.</p>
      `;
    }
  };

  for (const k of Object.keys(MODULES)) {
    VIEWS[k] = () => `
      <p class="mut">Yeh screen abhi develop nahi hui hai.</p>
      <ul class="ph">${MODULES[k].map(x => `<li>${x}</li>`).join('')}</ul>
    `;
  }

  let deferred = null;

  addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
  });

  function wireDeal() {
    const form = $('#dealForm');
    if (!form) return;

    const fields = ['quantity', 'buyRate', 'sellRate'];

    function calculate() {
      const qty = Number($('#quantity').value) || 0;
      const buy = Number($('#buyRate').value) || 0;
      const sell = Number($('#sellRate').value) || 0;

      const buyTotal = Math.round(buy * 100) * qty;
      const sellTotal = Math.round(sell * 100) * qty;
      const perProfit = Math.round(sell * 100) - Math.round(buy * 100);
      const totalProfit = perProfit * qty;

      $('#buyTotal').textContent = inr(buyTotal);
      $('#sellTotal').textContent = inr(sellTotal);
      $('#perProfit').textContent = inr(perProfit);
      $('#totalProfit').textContent = inr(totalProfit);
      $('#profitLabel').textContent =
        totalProfit >= 0 ? 'Total profit' : 'Total loss';

      $('#totalProfit').className =
        totalProfit >= 0 ? 'profit-text' : 'loss-text';
    }

    fields.forEach(id => {
      $('#' + id).addEventListener('input', calculate);
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();

      try {
        const idValue = $('#dealId').value;
        const itemName = $('#itemName').value.trim();
        const supplierId = Number($('#supplierId').value);
        const customerId = Number($('#customerId').value);
        const quantity = Number($('#quantity').value);

        const buyRatePaise = toPaise($('#buyRate').value);
        const sellRatePaise = toPaise($('#sellRate').value);

        if (!itemName) throw new Error('Item name zaroori hai');
        if (!supplierId || !customerId) {
          throw new Error('Supplier aur customer select karein');
        }
        if (!Number.isSafeInteger(quantity) || quantity <= 0) {
          throw new Error('Quantity positive whole number honi chahiye');
        }

        const parties = await getParties();
        const supplier = parties.find(p => p.id === supplierId);
        const customer = parties.find(p => p.id === customerId);

        if (!supplier || !customer) {
          throw new Error('Selected party nahi mili');
        }

        const purchaseTotalPaise = buyRatePaise * quantity;
        const salesTotalPaise = sellRatePaise * quantity;
        const profitPaise = salesTotalPaise - purchaseTotalPaise;

        if (![purchaseTotalPaise, salesTotalPaise, profitPaise]
          .every(Number.isSafeInteger)) {
          throw new Error('Total amount bahut bada hai');
        }

        const now = Date.now();

        const record = {
          date: $('#dealDateISO').value,
          itemName,
          supplierId,
          supplierName: supplier.name,
          customerId,
          customerName: customer.name,
          quantity,
          buyRatePaise,
          sellRatePaise,
          purchaseTotalPaise,
          salesTotalPaise,
          profitPaise,
          updatedAt: now
        };

        if (idValue) {
          const id = Number(idValue);
          const old = await TL_DB.get('deals', id);
          if (!old) throw new Error('Deal nahi mili');

          await TL_DB.put('deals', { ...old, ...record });
          await TL_DB.audit('deal', 'update', { id, itemName });
          toast('Deal update ho gayi');
        } else {
          const id = await TL_DB.add('deals', {
            ...record,
            createdAt: now
          });
          await TL_DB.audit('deal', 'add', { id, itemName });
          toast('Deal save ho gayi');
        }

        await route();
      } catch (err) {
        toast('Save nahi hua: ' + err.message);
      }
    });

    $('#dealCancel').addEventListener('click', () => route());

    $('#view').addEventListener('click', async e => {
      const edit = e.target.closest('[data-edit-deal]');
      const del = e.target.closest('[data-delete-deal]');

      if (edit) {
        const id = Number(edit.dataset.editDeal);
        const d = await TL_DB.get('deals', id);
        if (!d) return toast('Deal nahi mili');

        $('#dealId').value = d.id;
        $('#dealDateISO').value = d.date;
        $('#dealDate').value = formatDate(d.date);
        $('#itemName').value = d.itemName;
        $('#supplierId').value = d.supplierId;
        $('#customerId').value = d.customerId;
        $('#quantity').value = d.quantity;
        $('#buyRate').value = (d.buyRatePaise / 100).toFixed(2);
        $('#sellRate').value = (d.sellRatePaise / 100).toFixed(2);
        $('#dealSave').textContent = 'Changes save karein';
        $('#dealCancel').hidden = false;
        calculate();
        return;
      }

      if (del) {
        const id = Number(del.dataset.deleteDeal);
        const d = await TL_DB.get('deals', id);
        if (!d) return toast('Deal nahi mili');

        const ok = confirm(
          `"${d.itemName}" deal delete karni hai?\nYeh action undo nahi hoga.`
        );
        if (!ok) return;

        try {
          const linked = await TL_DB.getByIndex(
            'dealPayments', 'dealId', id
          );

          if (linked.length) {
            return toast('Is deal ki payments linked hain. Pehle payments handle karein.');
          }

          await TL_DB.remove('deals', id);
          await TL_DB.audit('deal', 'delete', {
            id, itemName: d.itemName
          });
          toast('Deal delete ho gayi');
          await route();
        } catch (err) {
          toast('Delete nahi hua: ' + err.message);
        }
      }
    });
  }

  function wireParties() {
    const form = $('#partyForm');
    if (!form) return;

    const reset = () => {
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

        if (!name) throw new Error('Party
