(function () {
  'use strict';

  var model = window.ReportingCaseModel;
  var apiFactory = window.ReportingSupabaseApi;
  var config = window.REPORTING_BACKEND || {};
  var api = apiFactory.createReportingApi(config);
  var cases = [];
  var current = null;
  var form = document.getElementById('caseForm');
  var toastTimer;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function number(value) { return Number(value || 0); }
  function money(value) { return Math.round(number(value) * 100) / 100; }
  function isStrongPassword(password) {
    return String(password || '').length >= 12 &&
      /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) &&
      /[!@#$%^&*()_+\-=\[\]{};'\\:"|<>?,.\/`~]/.test(password);
  }

  function notify(message) {
    var toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2600);
  }

  function setBusy(busy) {
    document.querySelectorAll('button').forEach(function (button) { button.disabled = busy; });
  }

  function showLoginError(message) {
    var error = document.getElementById('loginError');
    error.textContent = message || '';
    error.classList.toggle('show', Boolean(message));
  }

  function showWorkspace() {
    document.getElementById('loginView').hidden = true;
    document.getElementById('inviteView').hidden = true;
    document.getElementById('workspace').hidden = false;
    var session = api.getSession();
    document.getElementById('accountLabel').textContent = session && session.user ? session.user.email || '' : '';
  }

  function showLogin() {
    document.getElementById('workspace').hidden = true;
    document.getElementById('inviteView').hidden = true;
    document.getElementById('loginView').hidden = false;
  }

  function showInvite() {
    document.getElementById('workspace').hidden = true;
    document.getElementById('loginView').hidden = true;
    document.getElementById('inviteView').hidden = false;
  }

  function makeNewCase() {
    var suffix = String(Date.now()).slice(-5);
    return model.createCase({
      title: 'Neuer Reporting Case',
      slug: 'reporting-case-' + suffix,
      clientName: 'Elbstein Immobilien',
      primaryColor: '#e7352e',
      payload: window.createDemoDashboardPayload()
    });
  }

  async function loadCases(preferredId) {
    cases = await api.listCases();
    var selected = preferredId && cases.find(function (item) { return item.id === preferredId; });
    current = selected || cases[0] || makeNewCase();
    render();
  }

  function renderCaseList() {
    var list = document.getElementById('caseList');
    if (!cases.length) {
      list.innerHTML = '<div class="case-item"><strong>Noch keine Cases</strong><span>Erstelle rechts deinen ersten Case.</span></div>';
      return;
    }
    list.innerHTML = cases.map(function (item) {
      return '<button type="button" class="case-item ' + (current && current.id === item.id ? 'active' : '') + '" data-id="' + escapeHtml(item.id) + '">' +
        '<strong>' + escapeHtml(item.title) + '</strong>' +
        '<span class="' + (item.is_published ? 'published' : '') + '">' + (item.is_published ? 'Veröffentlicht' : 'Entwurf') + ' · /' + escapeHtml(item.slug) + '</span></button>';
    }).join('');
    list.querySelectorAll('[data-id]').forEach(function (button) {
      button.addEventListener('click', function () {
        current = clone(cases.find(function (item) { return item.id === button.dataset.id; }));
        render();
      });
    });
  }

  function propertyCard(property) {
    var priceKey = Object.prototype.hasOwnProperty.call(property, 'price') ? 'price' : 'price_from';
    var sizeKey = Object.prototype.hasOwnProperty.call(property, 'size_sqm') ? 'size_sqm' : 'size_from';
    var roomKey = Object.prototype.hasOwnProperty.call(property, 'rooms') ? 'rooms' : 'num_units';
    return '<article class="property-card" data-id="' + escapeHtml(property.id) + '" data-price-key="' + priceKey + '" data-size-key="' + sizeKey + '" data-room-key="' + roomKey + '">' +
      '<div class="property-card-head"><strong>' + escapeHtml(property.name) + '</strong><span>' + escapeHtml(property.id) + '</span></div>' +
      '<div class="property-fields">' +
        '<label>Name<input data-field="name" value="' + escapeHtml(property.name) + '"></label>' +
        '<label>Stadt<input data-field="city" value="' + escapeHtml(property.city) + '"></label>' +
        '<label>Typ<select data-field="property_type">' + ['wohnung','haus','villa','penthouse','reihenhaus','neubauprojekt'].map(function (type) { return '<option value="' + type + '" ' + (property.property_type === type ? 'selected' : '') + '>' + type + '</option>'; }).join('') + '</select></label>' +
        '<label>Preis ab / Preis<input data-field="price" type="number" min="0" value="' + escapeHtml(property[priceKey] || 0) + '"></label>' +
        '<label>Fläche ab / m²<input data-field="size" type="number" min="0" step="0.1" value="' + escapeHtml(property[sizeKey] || 0) + '"></label>' +
        '<label>Zimmer / Einheiten<input data-field="rooms" type="number" min="0" step="0.5" value="' + escapeHtml(property[roomKey] || 0) + '"></label>' +
      '</div></article>';
  }

  function campaignRow(campaign) {
    var totals = model.getCampaignTotals(current.payload, campaign.id);
    return '<tr data-id="' + escapeHtml(campaign.id) + '">' +
      '<td><input data-field="name" value="' + escapeHtml(campaign.campaign_name) + '"></td>' +
      '<td><select data-field="status">' + ['active','paused','completed'].map(function (status) { return '<option value="' + status + '" ' + (campaign.status === status ? 'selected' : '') + '>' + status + '</option>'; }).join('') + '</select></td>' +
      '<td><input data-field="spend" type="number" min="0" step="0.01" value="' + totals.spend + '"></td>' +
      '<td><input data-field="leads" type="number" min="0" step="1" value="' + totals.leads + '"></td>' +
      '<td><input data-field="impressions" type="number" min="0" step="1" value="' + totals.impressions + '"></td>' +
      '<td><input data-field="clicks" type="number" min="0" step="1" value="' + totals.clicks + '"></td>' +
    '</tr>';
  }

  function renderEditor() {
    form.elements.title.value = current.title || '';
    form.elements.slug.value = current.slug || '';
    form.elements.clientName.value = current.client_name || current.payload.client.name || '';
    form.elements.primaryColor.value = current.payload.client.primary_color || '#e7352e';
    form.elements.isPublished.checked = Boolean(current.is_published);
    document.getElementById('editorTitle').textContent = current.title || 'Neuer Case';
    document.getElementById('saveState').textContent = current.id ? 'Zuletzt zentral gespeichert' : 'Noch nicht gespeichert';
    document.getElementById('propertyRows').innerHTML = (current.payload.properties || []).map(propertyCard).join('');
    document.getElementById('campaignRows').innerHTML = (current.payload.campaigns || []).map(campaignRow).join('');
    document.getElementById('deleteCase').disabled = !current.id;
    document.getElementById('openViewer').disabled = !current.id || !current.is_published;
  }

  function render() {
    renderCaseList();
    renderEditor();
  }

  function collectCase() {
    var payload = clone(current.payload);
    document.querySelectorAll('#propertyRows .property-card').forEach(function (card) {
      var changes = {
        name: card.querySelector('[data-field="name"]').value.trim(),
        city: card.querySelector('[data-field="city"]').value.trim(),
        property_type: card.querySelector('[data-field="property_type"]').value
      };
      changes[card.dataset.priceKey] = money(card.querySelector('[data-field="price"]').value);
      changes[card.dataset.sizeKey] = number(card.querySelector('[data-field="size"]').value);
      changes[card.dataset.roomKey] = number(card.querySelector('[data-field="rooms"]').value);
      payload = model.updateProperty(payload, card.dataset.id, changes);
    });
    document.querySelectorAll('#campaignRows tr').forEach(function (row) {
      payload = model.updateCampaign(payload, row.dataset.id, {
        name: row.querySelector('[data-field="name"]').value.trim(),
        status: row.querySelector('[data-field="status"]').value,
        spend: money(row.querySelector('[data-field="spend"]').value),
        leads: Math.round(number(row.querySelector('[data-field="leads"]').value)),
        impressions: Math.round(number(row.querySelector('[data-field="impressions"]').value)),
        clicks: Math.round(number(row.querySelector('[data-field="clicks"]').value))
      });
    });
    var clientName = form.elements.clientName.value.trim();
    payload.client.name = clientName;
    payload.client.brand = clientName;
    payload.client.primary_color = form.elements.primaryColor.value;
    (payload.programs || []).forEach(function (program) {
      var property = (payload.properties || []).find(function (item) { return item.id === program.property_id; });
      if (property) program.account_label = clientName + ' ' + property.city;
    });
    return Object.assign({}, current, {
      title: form.elements.title.value.trim(),
      slug: form.elements.slug.value.trim(),
      client_name: clientName,
      payload: payload,
      is_published: form.elements.isPublished.checked
    });
  }

  document.getElementById('loginForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    showLoginError('');
    setBusy(true);
    try {
      await api.signIn(event.target.elements.email.value.trim(), event.target.elements.password.value);
      event.target.elements.password.value = '';
      showWorkspace();
      await loadCases();
    } catch (error) {
      showLoginError(error.message);
    } finally { setBusy(false); }
  });

  document.getElementById('inviteForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    var password = event.target.elements.password.value;
    var confirmation = event.target.elements.passwordConfirm.value;
    var errorElement = document.getElementById('inviteError');
    errorElement.textContent = '';
    errorElement.classList.remove('show');
    if (!isStrongPassword(password) || password !== confirmation) {
      errorElement.textContent = !isStrongPassword(password) ? 'Mindestens 12 Zeichen mit Groß- und Kleinbuchstaben, Zahl und Sonderzeichen.' : 'Die Passwörter stimmen nicht überein.';
      errorElement.classList.add('show');
      return;
    }
    setBusy(true);
    try {
      await api.updatePassword(password);
      event.target.reset();
      showWorkspace();
      await loadCases();
      notify('Account aktiviert');
    } catch (error) {
      errorElement.textContent = error.message;
      errorElement.classList.add('show');
    } finally { setBusy(false); }
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    setBusy(true);
    try {
      var next = collectCase();
      var errors = model.validateCase(next);
      if (errors.length) throw new Error(errors.join(' · '));
      var record = model.prepareCaseRecord(next);
      if (next.id) record.id = next.id;
      var saved = await api.saveCase(record);
      await loadCases(saved.id);
      notify('Case gespeichert');
    } catch (error) {
      notify(error.message);
    } finally { setBusy(false); }
  });

  document.getElementById('newCase').addEventListener('click', function () { current = makeNewCase(); render(); });
  document.getElementById('duplicateCase').addEventListener('click', function () {
    var next = collectCase();
    delete next.id; delete next.created_at; delete next.updated_at;
    next.title += ' Kopie';
    next.slug = model.slugify(next.title + '-' + String(Date.now()).slice(-4));
    next.is_published = false;
    current = next;
    render();
    notify('Kopie erstellt, noch nicht gespeichert');
  });
  document.getElementById('deleteCase').addEventListener('click', async function () {
    if (!current.id || !window.confirm('Diesen Case dauerhaft löschen?')) return;
    setBusy(true);
    try { await api.deleteCase(current.id); await loadCases(); notify('Case gelöscht'); }
    catch (error) { notify(error.message); }
    finally { setBusy(false); }
  });
  document.getElementById('openViewer').addEventListener('click', function () {
    if (current && current.is_published) window.open('client/?case=' + encodeURIComponent(current.slug), '_blank', 'noopener');
  });
  document.getElementById('logoutButton').addEventListener('click', async function () {
    try { await api.signOut(); } catch (_) { /* local session is cleared in finally */ }
    cases = []; current = null; showLogin();
  });
  form.elements.title.addEventListener('input', function () {
    if (!current.id) form.elements.slug.value = model.slugify(form.elements.title.value);
    document.getElementById('editorTitle').textContent = form.elements.title.value || 'Neuer Case';
  });

  async function init() {
    if (!config.url || !config.key) {
      showLogin();
      showLoginError('Backend ist noch nicht eingerichtet.');
      return;
    }
    var invitation = api.consumeAuthHash(window.location.hash);
    if (invitation) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      showInvite();
      return;
    }
    if (!api.getSession()) { showLogin(); return; }
    showWorkspace();
    try { await loadCases(); }
    catch (error) { showLogin(); showLoginError(error.message); }
  }

  init();
}());
