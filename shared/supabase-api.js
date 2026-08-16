(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ReportingSupabaseApi = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SESSION_KEY = 'rg-reporting-session';
  var CASE_FIELDS = 'id,slug,title,client_name,payload,is_published,created_at,updated_at';

  function createReportingApi(config, dependencies) {
    dependencies = dependencies || {};
    var fetchImpl = dependencies.fetch || globalThis.fetch.bind(globalThis);
    var storage = dependencies.storage || globalThis.localStorage;
    var now = dependencies.now || Date.now;
    var baseUrl = String(config && config.url || '').replace(/\/$/, '');
    var publicKey = String(config && config.key || '');

    function ensureConfigured() {
      if (!baseUrl || !publicKey) throw new Error('Backend ist nicht konfiguriert');
    }

    function getSession() {
      var raw = storage.getItem(SESSION_KEY);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch (_) { storage.removeItem(SESSION_KEY); return null; }
    }

    function storeSession(session) {
      storage.setItem(SESSION_KEY, JSON.stringify(session));
      return session;
    }

    function headers(token) {
      return {
        apikey: publicKey,
        Authorization: 'Bearer ' + (token || publicKey),
        'Content-Type': 'application/json'
      };
    }

    async function parseResponse(response) {
      var body = await response.json().catch(function () { return null; });
      if (!response.ok) {
        var message = body && (body.message || body.error_description || body.error || body.hint);
        throw new Error(message || 'Backend-Fehler (' + response.status + ')');
      }
      return body;
    }

    function requireSession() {
      var session = getSession();
      if (!session || !session.access_token) throw new Error('Nicht angemeldet');
      return session;
    }

    async function signIn(email, password) {
      ensureConfigured();
      var response = await fetchImpl(baseUrl + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ email: email, password: password })
      });
      var session = await parseResponse(response);
      if (!session.expires_at && session.expires_in) session.expires_at = Math.floor(now() / 1000) + session.expires_in;
      return storeSession(session);
    }

    function consumeAuthHash(hash) {
      ensureConfigured();
      var params = new URLSearchParams(String(hash || '').replace(/^#/, ''));
      var accessToken = params.get('access_token');
      var refreshToken = params.get('refresh_token');
      if (!accessToken || !refreshToken) return null;
      var expiresIn = Number(params.get('expires_in') || 3600);
      return storeSession({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: params.get('token_type') || 'bearer',
        type: params.get('type') || '',
        expires_in: expiresIn,
        expires_at: Math.floor(now() / 1000) + expiresIn
      });
    }

    async function requireActiveSession() {
      var session = requireSession();
      if (!session.expires_at || session.expires_at > Math.floor(now() / 1000) + 30) return session;
      if (!session.refresh_token) throw new Error('Sitzung ist abgelaufen');
      var response = await fetchImpl(baseUrl + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });
      var refreshed = await parseResponse(response);
      if (!refreshed.expires_at && refreshed.expires_in) refreshed.expires_at = Math.floor(now() / 1000) + refreshed.expires_in;
      return storeSession(refreshed);
    }

    async function listCases() {
      ensureConfigured();
      var session = await requireActiveSession();
      var response = await fetchImpl(baseUrl + '/rest/v1/reporting_cases?select=' + encodeURIComponent(CASE_FIELDS) + '&order=updated_at.desc', {
        method: 'GET', headers: headers(session.access_token)
      });
      return parseResponse(response);
    }

    async function saveCase(record) {
      ensureConfigured();
      var session = await requireActiveSession();
      var payload = Object.assign({}, record);
      var id = payload.id;
      delete payload.id;
      delete payload.created_at;
      delete payload.updated_at;
      var url = baseUrl + '/rest/v1/reporting_cases';
      var method = 'POST';
      if (id) { url += '?id=eq.' + encodeURIComponent(id); method = 'PATCH'; }
      var requestHeaders = headers(session.access_token);
      requestHeaders.Prefer = 'return=representation';
      var response = await fetchImpl(url, { method: method, headers: requestHeaders, body: JSON.stringify(payload) });
      var rows = await parseResponse(response);
      return Array.isArray(rows) ? rows[0] : rows;
    }

    async function getPublishedCase(slug) {
      ensureConfigured();
      var response = await fetchImpl(baseUrl + '/rest/v1/rpc/get_published_reporting_case', {
        method: 'POST', headers: headers(), body: JSON.stringify({ p_slug: slug })
      });
      return parseResponse(response);
    }

    async function deleteCase(id) {
      ensureConfigured();
      var session = await requireActiveSession();
      var response = await fetchImpl(baseUrl + '/rest/v1/reporting_cases?id=eq.' + encodeURIComponent(id), {
        method: 'DELETE', headers: headers(session.access_token)
      });
      return parseResponse(response);
    }

    async function updatePassword(password) {
      ensureConfigured();
      var session = await requireActiveSession();
      var response = await fetchImpl(baseUrl + '/auth/v1/user', {
        method: 'PUT',
        headers: headers(session.access_token),
        body: JSON.stringify({ password: password })
      });
      return parseResponse(response);
    }

    async function signOut() {
      ensureConfigured();
      var session = getSession();
      try {
        if (session && session.access_token) {
          var response = await fetchImpl(baseUrl + '/auth/v1/logout', {
            method: 'POST', headers: headers(session.access_token)
          });
          await parseResponse(response);
        }
      } finally {
        storage.removeItem(SESSION_KEY);
      }
    }

    return {
      signIn: signIn,
      consumeAuthHash: consumeAuthHash,
      getSession: getSession,
      listCases: listCases,
      saveCase: saveCase,
      deleteCase: deleteCase,
      updatePassword: updatePassword,
      signOut: signOut,
      getPublishedCase: getPublishedCase
    };
  }

  return { createReportingApi: createReportingApi };
}));
