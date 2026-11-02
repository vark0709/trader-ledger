'use strict';
(() => {
  const VER = '0.1.0 (Phase 1)';
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Paise (integer) -> "₹1,23,456.78". Float math nahi.
  function inr(paise) {
    const n = Math.trunc(paise), a = Math.abs(n);
    return (n < 0 ? '-' : '') + '₹' + new Intl.NumberFormat('en-IN').format(Math.floor(a / 100)) + '.' + String(a % 100).padStart(2, '0');
  }

  const TITLES = { home: 'Dashboard', purchase: 'Khareed (Purchase)', sales: 'Bikri (Sales)', parties: 'Parties',
    payments: 'Payment', expenses: 'Kharcha (Expenses)', reports: 'Reports', backup: 'Backup aur Restore',
    settings: 'Settings', more: 'Aur options' };
  const NAVMAP = { home: 'home', purchase: 'purchase', sales: 'sales', parties: 'parties' };

  const MODULES = {
    purchase: ['Supplier se maal ki purchase invoice', 'Cash, UPI ya Bank se partial ya full payment', 'FIFO cost batch internally banega (stock screen nahi)'],
    sales: ['Customer ko bikri ki invoice', 'Bikri-wise gross profit, FIFO cost se', 'Baaki raqam lena (receivable) mein jayegi'],
    parties: ['Customer aur supplier ki list', 'Opening lena aur dena', 'Party-wise baaki hisaab'],
    payments: ['Invoice ke against payment: Cash, UPI, Bank', 'Duplicate payment entry se bachav', 'Payment edit aur reversal'],
    expenses: ['Business kharcha entry', 'Net profit = gross profit minus kharcha'],
    reports: ['Munafa, lena, dena aur balance reports', 'Date-wise filter'],
    backup: ['Password se encrypted backup file', 'Backup se restore']
  };

  const ZERO = 0; // Phase 1: ledger abhi nahi hai, isliye sab figures zero. Asli calculation baad ke phase mein.
  const row = (l, v) => `<div class="row"><span>${l}</span><b>${inr(v)}</b></div>`;

  const VIEWS = {
    async home() {
      const name = await TL_DB.getSetting('businessName', '');
      return `<div class="hero"><small>${name ? esc(name) + ' ka net munafa' : 'Net munafa'}</small><div class="big">${inr(ZERO)}</div></div>
      <div class="grp"><h3>Paisa kahan hai</h3>${row('Cash', ZERO)}${row('UPI', ZERO)}${row('Bank', ZERO)}${row('Kul paisa', ZERO)}</div>
      <div class="grp"><h3>Lena aur dena</h3>${row('Lena hai (customers se)', ZERO)}${row('Dena hai (suppliers ko)', ZERO)}</div>
      <div class="grp"><h3>Munafa</h3>${row('Gross munafa', ZERO)}${row('Kharcha', ZERO)}${row('Net munafa', ZERO)}</div>
      <p class="note">Abhi koi entry nahi hai, isliye sab figures ₹0.00 hain. Khareed, Bikri, Payment aur Kharcha screens abhi bane nahi hain.</p>`;
    },
    more() {
      const l = (k, d) => `<a class="row" href="#/${k}"><span>${TITLES[k]}<small>${d}</small></span><b>›</b></a>`;
      return l('payments', 'Paisa aaya ya diya') + l('expenses', 'Business kharcha') + l('reports', 'Munafa aur hisaab') +
        l('backup', 'Data ki safe copy') + l('settings', 'App aur database ki jaankari');
    },
    async settings() {
      const name = await TL_DB.getSetting('businessName', '');
      const total = await TL_DB.countAll();
      let persisted = false, usage = '';
      try { persisted = await navigator.storage.persisted(); } catch (e) {}
      try { const e = await navigator.storage.estimate(); usage = Math.round((e.usage || 0) / 1024) + ' KB'; } catch (e) {}
      const standalone = matchMedia('(display-mode: standalone)').matches;
      const offline = 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
      return `<form id="f"><label for="bn">Business ka naam</label>
        <input id="bn" maxlength="60" autocomplete="off" value="${esc(name)}"><button type="submit">Save karein</button></form>
      <div class="grp"><h3>Device par data</h3>
        <div class="row"><span>Database</span><b style="font-size:16px">Taiyaar (v${TL_DB.VERSION})</b></div>
        <div class="row"><span>Saved records</span><b style="font-size:16px">${total}</b></div>
        <div class="row"><span>Storage use</span><b style="font-size:16px">${usage || 'Pata nahi'}</b></div>
        <div class="row"><span>Storage surakshit</span><b style="font-size:16px">${persisted ? 'Haan' : 'Nahi'}</b></div>
        ${persisted ? '' : '<button type="button" class="ghost" id="persist">Storage surakshit karein</button>'}</div>
      <div class="grp"><h3>App</h3>
        <div class="row"><span>Version</span><b style="font-size:16px">${VER}</b></div>
        <div class="row"><span>Offline chalne ke liye</span><b style="font-size:16px">${offline ? 'Taiyaar' : 'Reload ke baad'}</b></div>
        <div class="row"><span>Home screen par</span><b style="font-size:16px">${standalone ? 'Install hai' : 'Install nahi'}</b></div>
        ${standalone ? '' : '<button type="button" class="ghost" id="install">App install karein</button>'}</div>
      <p class="note">Aapka sara data sirf is phone ke browser storage mein rehta hai. Koi server ya cloud use nahi hota.</p>`;
    }
  };
  for (const k of Object.keys(MODULES)) {
    VIEWS[k] = () => `<p class="mut">Yeh screen abhi bana nahi hai. Yahan koi entry save nahi hogi.</p>
      <p class="mut" style="margin-top:14px">Yahan aayega:</p><ul class="ph">${MODULES[k].map(x => `<li>${x}</li>`).join('')}</ul>`;
  }

  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2500);
  }

  let deferred = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });

  function wireSettings() {
    $('#f').addEventListener('submit', async e => {
      e.preventDefault();
      try {
        await TL_DB.setSetting('businessName', $('#bn').value.trim().slice(0, 60));
        await TL_DB.audit('settings', 'update', { key: 'businessName' });
        toast('Save ho gaya');
      } catch (err) { toast('Save nahi hua: ' + err.message); }
    });
    const p = $('#persist');
    if (p) p.addEventListener('click', async () => {
      try { const ok = await navigator.storage.persist(); toast(ok ? 'Storage surakshit ho gaya' : 'Browser ne abhi mana kiya'); route(); }
      catch (e) { toast('Yeh browser mein available nahi'); }
    });
    const i = $('#install');
    if (i) i.addEventListener('click', async () => {
      if (deferred) { deferred.prompt(); await deferred.userChoice; deferred = null; }
      else toast('Chrome menu (⋮) mein "Install app" ya "Add to Home screen" dabayein');
    });
  }

  async function route() {
    const h = location.hash.replace(/^#\/?/, '') || 'home';
    const id = VIEWS[h] ? h : 'home';
    $('#title').textContent = TITLES[id];
    try { $('#view').innerHTML = await VIEWS[id](); }
    catch (e) { $('#view').innerHTML = `<p class="note">Database khul nahi paya: ${esc(e.message)}</p>`; }
    if (id === 'settings' && $('#f')) wireSettings();
    document.querySelectorAll('nav a').forEach(a => a.classList.toggle('on', a.dataset.k === (NAVMAP[id] || 'more')));
    scrollTo(0, 0);
  }

  function conn() {
    const c = $('#conn'); c.textContent = navigator.onLine ? 'Online' : 'Offline'; c.classList.toggle('off', !navigator.onLine);
  }
  addEventListener('online', conn); addEventListener('offline', conn);
  addEventListener('hashchange', route);

  conn();
  TL_DB.open().catch(() => {}).then(route);
  if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
})();
