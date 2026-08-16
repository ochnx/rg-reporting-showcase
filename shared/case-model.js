(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ReportingCaseModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function slugify(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  function roundMoney(value) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  function scaleMetric(metric, factors) {
    var next = Object.assign({}, metric);
    if ('spend' in next) next.spend = roundMoney(next.spend * factors.spend);
    if ('leads' in next) next.leads = Math.round(next.leads * factors.leads);
    if ('impressions' in next) next.impressions = Math.round(next.impressions * factors.impressions);
    if ('clicks' in next) next.clicks = Math.round(next.clicks * factors.clicks);
    if ('reach' in next) next.reach = Math.round(next.reach * factors.impressions);
    return next;
  }

  function scalePayload(payload, requestedFactors) {
    var source = clone(payload);
    var factors = {
      spend: Number(requestedFactors && requestedFactors.spend) || 1,
      leads: Number(requestedFactors && requestedFactors.leads) || 1,
      impressions: Number(requestedFactors && requestedFactors.impressions) || 1,
      clicks: Number(requestedFactors && requestedFactors.clicks) || 1
    };
    ['campaign_daily_metrics', 'creative_daily_metrics', 'campaign_geo_insights', 'campaign_demo_insights'].forEach(function (key) {
      source[key] = (source[key] || []).map(function (metric) { return scaleMetric(metric, factors); });
    });
    source.campaigns = (source.campaigns || []).map(function (campaign) {
      var next = Object.assign({}, campaign);
      if ('total_budget' in next) next.total_budget = roundMoney(next.total_budget * factors.spend);
      return next;
    });
    return source;
  }

  function createCase(input) {
    var payload = clone(input.payload);
    payload.client = payload.client || {};
    payload.client.name = input.clientName;
    payload.client.brand = input.clientName;
    if (input.primaryColor) payload.client.primary_color = input.primaryColor;
    return {
      title: String(input.title || '').trim(),
      slug: slugify(input.slug || input.title),
      client_name: String(input.clientName || '').trim(),
      payload: payload,
      is_published: Boolean(input.isPublished)
    };
  }

  function validateCase(value) {
    var errors = [];
    if (!String(value && value.title || '').trim()) errors.push('Titel fehlt');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value && value.slug || ''))) errors.push('Slug ist ungültig');
    if (!String(value && value.client_name || '').trim()) errors.push('Kundenname fehlt');
    var payload = value && value.payload;
    if (!payload || !Array.isArray(payload.campaigns) || payload.campaigns.length === 0) errors.push('Mindestens eine Kampagne ist erforderlich');
    if (!payload || !Array.isArray(payload.campaign_daily_metrics) || payload.campaign_daily_metrics.length === 0) errors.push('Kampagnenmetriken fehlen');
    return errors;
  }

  function prepareCaseRecord(value) {
    return {
      title: value.title,
      slug: value.slug,
      client_name: value.client_name,
      payload: clone(value.payload),
      is_published: Boolean(value.is_published)
    };
  }

  function sum(rows, key) {
    return rows.reduce(function (total, row) { return total + Number(row[key] || 0); }, 0);
  }

  function distributeMetric(rows, key, target, integer) {
    if (!rows.length || !rows.some(function (row) { return key in row; })) return;
    var current = sum(rows, key);
    var raw = rows.map(function (row) {
      return current > 0 ? Number(row[key] || 0) * target / current : target / rows.length;
    });
    var values;
    if (integer) {
      values = raw.map(Math.floor);
      var remainder = Math.round(target - values.reduce(function (a, b) { return a + b; }, 0));
      raw.map(function (value, index) { return { index: index, fraction: value - values[index] }; })
        .sort(function (a, b) { return b.fraction - a.fraction; })
        .slice(0, Math.max(0, remainder))
        .forEach(function (entry) { values[entry.index] += 1; });
    } else {
      values = raw.map(roundMoney);
      var delta = roundMoney(target - values.reduce(function (a, b) { return a + b; }, 0));
      values[values.length - 1] = roundMoney(values[values.length - 1] + delta);
    }
    rows.forEach(function (row, index) { row[key] = values[index]; });
  }

  function getCampaignTotals(payload, campaignId) {
    var rows = (payload.campaign_daily_metrics || []).filter(function (row) { return row.campaign_id === campaignId; });
    return {
      spend: roundMoney(sum(rows, 'spend')),
      leads: sum(rows, 'leads'),
      impressions: sum(rows, 'impressions'),
      clicks: sum(rows, 'clicks'),
      reach: sum(rows, 'reach')
    };
  }

  function updateCampaign(payload, campaignId, changes) {
    var next = clone(payload);
    var campaign = (next.campaigns || []).find(function (item) { return item.id === campaignId; });
    if (!campaign) throw new Error('Kampagne nicht gefunden');
    var originalTotals = getCampaignTotals(next, campaignId);
    var targets = {
      spend: Number(changes.spend),
      leads: Number(changes.leads),
      impressions: Number(changes.impressions),
      clicks: Number(changes.clicks)
    };
    var targetReach = originalTotals.impressions > 0
      ? Math.round(originalTotals.reach * targets.impressions / originalTotals.impressions)
      : Math.round(targets.impressions * 0.78);

    campaign.campaign_name = String(changes.name || campaign.campaign_name).trim();
    campaign.status = changes.status || campaign.status;
    campaign.total_budget = roundMoney(targets.spend * 1.15);

    var creativeIds = (next.creatives || [])
      .filter(function (creative) { return creative.campaign_id === campaignId; })
      .map(function (creative) {
        creative.name = campaign.campaign_name + ' ' + creative.creative_type;
        return creative.id;
      });
    var layers = [
      (next.campaign_daily_metrics || []).filter(function (row) { return row.campaign_id === campaignId; }),
      (next.creative_daily_metrics || []).filter(function (row) { return creativeIds.indexOf(row.creative_id) !== -1; }),
      (next.campaign_geo_insights || []).filter(function (row) { return row.campaign_id === campaignId; }),
      (next.campaign_demo_insights || []).filter(function (row) { return row.campaign_id === campaignId; })
    ];
    layers.forEach(function (rows) {
      distributeMetric(rows, 'spend', targets.spend, false);
      distributeMetric(rows, 'leads', targets.leads, true);
      distributeMetric(rows, 'impressions', targets.impressions, true);
      distributeMetric(rows, 'clicks', targets.clicks, true);
      distributeMetric(rows, 'reach', targetReach, true);
    });
    return next;
  }

  function updateProperty(payload, propertyId, changes) {
    var next = clone(payload);
    var property = (next.properties || []).find(function (item) { return item.id === propertyId; });
    if (!property) throw new Error('Objekt nicht gefunden');
    Object.keys(changes || {}).forEach(function (key) { property[key] = changes[key]; });
    (next.programs || []).filter(function (program) { return program.property_id === propertyId; }).forEach(function (program) {
      program.name = property.name;
      program.subject_label = property.name;
    });
    return next;
  }

  return {
    slugify: slugify,
    createCase: createCase,
    scalePayload: scalePayload,
    validateCase: validateCase,
    prepareCaseRecord: prepareCaseRecord,
    getCampaignTotals: getCampaignTotals,
    updateCampaign: updateCampaign,
    updateProperty: updateProperty
  };
}));
