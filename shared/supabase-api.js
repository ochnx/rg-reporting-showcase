(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ReportingSupabaseApi = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var CASE_FIELDS = 'id,slug,title,client_name,payload,is_published,created_at,updated_at';

  function createReportingApi(config, dependencies) {
    dependencies = dependencies || {};
    var fetchImpl = dependencies.fetch || globalThis.fetch.bind(globalThis);
    var baseUrl = String(config && config.url || '').replace(/\/$/, '');
    var publicKey = String(config && config.key || '');

    function ensureConfigured() {
      if (!baseUrl || !publicKey) throw new Error('Backend ist nicht konfiguriert');
    }

    function headers() {
      return {
        apikey: publicKey,
        Authorization: 'Bearer ' + publicKey,
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

    async function listCases() {
      ensureConfigured();
      var response = await fetchImpl(baseUrl + '/rest/v1/reporting_cases?select=' + encodeURIComponent(CASE_FIELDS) + '&order=updated_at.desc', {
        method: 'GET', headers: headers()
      });
      return parseResponse(response);
    }

    async function saveCase(record) {
      ensureConfigured();
      var payload = Object.assign({}, record);
      var id = payload.id;
      delete payload.id;
      delete payload.created_at;
      delete payload.updated_at;
      var url = baseUrl + '/rest/v1/reporting_cases';
      var method = 'POST';
      if (id) { url += '?id=eq.' + encodeURIComponent(id); method = 'PATCH'; }
      var requestHeaders = headers();
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
      var response = await fetchImpl(baseUrl + '/rest/v1/reporting_cases?id=eq.' + encodeURIComponent(id), {
        method: 'DELETE', headers: headers()
      });
      return parseResponse(response);
    }

    return {
      listCases: listCases,
      saveCase: saveCase,
      deleteCase: deleteCase,
      getPublishedCase: getPublishedCase
    };
  }

  return { createReportingApi: createReportingApi };
}));
