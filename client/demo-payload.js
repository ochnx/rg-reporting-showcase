(function () {
  'use strict';

  function hashSeed(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function randomFor(seedText) {
    var state = hashSeed(seedText) || 1;
    return function () {
      state += 0x6D2B79F5;
      var t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function isoDate(date) {
    return date.toISOString().slice(0, 10);
  }

  function addDays(dateText, offset) {
    var date = new Date(dateText + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + offset);
    return isoDate(date);
  }

  function allocate(total, weights, integers) {
    var weightTotal = weights.reduce(function (sum, value) { return sum + value; }, 0);
    var raw = weights.map(function (value) { return total * value / weightTotal; });
    if (!integers) {
      var rounded = raw.map(function (value) { return Math.round(value * 100) / 100; });
      var delta = Math.round((total - rounded.reduce(function (sum, value) { return sum + value; }, 0)) * 100) / 100;
      rounded[rounded.length - 1] = Math.round((rounded[rounded.length - 1] + delta) * 100) / 100;
      return rounded;
    }
    var base = raw.map(Math.floor);
    var remainder = Math.round(total - base.reduce(function (sum, value) { return sum + value; }, 0));
    raw.map(function (value, index) { return { index: index, fraction: value - base[index] }; })
      .sort(function (a, b) { return b.fraction - a.fraction; })
      .slice(0, remainder)
      .forEach(function (item) { base[item.index] += 1; });
    return base;
  }

  var definitions = [
    { id:'c01', program:'p01', flight:1, property:'o01', name:'Harbor Residences | Launch', start:'2026-03-02', days:25, spend:4250, leads:486, impressions:286000, clicks:4380, status:'completed' },
    { id:'c02', program:'p01', flight:2, property:'o01', name:'Harbor Residences | Re-Launch', start:'2026-04-06', days:29, spend:5160, leads:641, impressions:344000, clicks:5710, status:'completed' },
    { id:'c03', program:'p02', flight:1, property:'o02', name:'Alster Gardens', start:'2026-04-20', days:31, spend:3880, leads:402, impressions:254000, clicks:3920, status:'completed' },
    { id:'c04', program:'p03', flight:1, property:'o03', name:'Kant Palais', start:'2026-05-04', days:35, spend:4720, leads:421, impressions:301000, clicks:4460, status:'completed' },
    { id:'c05', program:'p04', flight:1, property:'o04', name:'Isar Lofts', start:'2026-05-18', days:34, spend:5590, leads:437, impressions:327000, clicks:4700, status:'completed' },
    { id:'c06', program:'p05', flight:1, property:'o05', name:'Rheinblick Villen', start:'2026-06-01', days:32, spend:4460, leads:463, impressions:294000, clicks:4520, status:'completed' },
    { id:'c07', program:'p06', flight:1, property:'o06', name:'Taunus Hof', start:'2026-06-15', days:35, spend:6270, leads:452, impressions:352000, clicks:4870, status:'completed' },
    { id:'c08', program:'p07', flight:1, property:'o07', name:'Elbterrassen', start:'2026-06-29', days:36, spend:4930, leads:529, impressions:319000, clicks:5020, status:'completed' },
    { id:'c09', program:'p08', flight:1, property:'o08', name:'Spreebogen Quartier', start:'2026-07-06', days:40, spend:6880, leads:566, impressions:401000, clicks:6050, status:'active' },
    { id:'c10', program:'p09', flight:1, property:'o09', name:'Maximilian Höfe', start:'2026-07-13', days:35, spend:6350, leads:408, impressions:344000, clicks:4790, status:'active' },
    { id:'c11', program:'p10', flight:1, property:'o10', name:'Phoenix Park', start:'2026-07-20', days:28, spend:3720, leads:397, impressions:248000, clicks:3890, status:'active' },
    { id:'c12', program:'p11', flight:1, property:'o11', name:'Havel Maisonettes', start:'2026-07-27', days:21, spend:3290, leads:344, impressions:217000, clicks:3360, status:'paused' }
  ];

  var properties = [
    { id:'o01', name:'Harbor Residences', address:'Am Leuchtturm 18', plz:'20457', city:'Hamburg', stadtteil:'HafenCity', property_type:'neubauprojekt', price_from:495000, price_to:1890000, size_from:48, size_to:181, num_units:36, location_rating:'A' },
    { id:'o02', name:'Alster Gardens', address:'Bellevue 27', plz:'22301', city:'Hamburg', stadtteil:'Winterhude', property_type:'wohnung', price:885000, size_sqm:104, rooms:3.5, plot_size:0, location_rating:'A' },
    { id:'o03', name:'Kant Palais', address:'Kantstraße 112', plz:'10627', city:'Berlin', stadtteil:'Charlottenburg', property_type:'penthouse', price:1490000, size_sqm:142, rooms:4, plot_size:0, location_rating:'A' },
    { id:'o04', name:'Isar Lofts', address:'Isartalstraße 44', plz:'80469', city:'München', stadtteil:'Glockenbachviertel', property_type:'neubauprojekt', price_from:740000, price_to:2640000, size_from:62, size_to:198, num_units:28, location_rating:'A' },
    { id:'o05', name:'Rheinblick Villen', address:'Uferallee 9', plz:'40545', city:'Düsseldorf', stadtteil:'Oberkassel', property_type:'villa', price:2180000, size_sqm:246, rooms:7, plot_size:780, location_rating:'A' },
    { id:'o06', name:'Taunus Hof', address:'Feldbergstraße 31', plz:'60323', city:'Frankfurt', stadtteil:'Westend', property_type:'haus', price:1675000, size_sqm:188, rooms:6, plot_size:520, location_rating:'A' },
    { id:'o07', name:'Elbterrassen', address:'Ottenser Hauptstraße 71', plz:'22765', city:'Hamburg', stadtteil:'Ottensen', property_type:'wohnung', price:695000, size_sqm:87, rooms:3, plot_size:0, location_rating:'A' },
    { id:'o08', name:'Spreebogen Quartier', address:'Alt-Moabit 86', plz:'10555', city:'Berlin', stadtteil:'Moabit', property_type:'neubauprojekt', price_from:425000, price_to:1420000, size_from:44, size_to:156, num_units:54, location_rating:'A' },
    { id:'o09', name:'Maximilian Höfe', address:'Widenmayerstraße 20', plz:'80538', city:'München', stadtteil:'Lehel', property_type:'villa', price:3250000, size_sqm:278, rooms:8, plot_size:920, location_rating:'A' },
    { id:'o10', name:'Phoenix Park', address:'Phoenixseestraße 14', plz:'44263', city:'Dortmund', stadtteil:'Hörde', property_type:'reihenhaus', price:565000, size_sqm:136, rooms:5, plot_size:310, location_rating:'B' },
    { id:'o11', name:'Havel Maisonettes', address:'Schiffbauergasse 6', plz:'14467', city:'Potsdam', stadtteil:'Berliner Vorstadt', property_type:'wohnung', price:795000, size_sqm:116, rooms:4, plot_size:0, location_rating:'B' }
  ];

  function createPayload() {
    var programs = properties.map(function (property, index) {
      return { id:'p' + String(index + 1).padStart(2, '0'), property_id:property.id, kind:'objekt', name:property.name, subject_label:property.name, account_label:'Elbstein Immobilien ' + property.city };
    });
    var campaigns = [];
    var daily = [];
    var creatives = [];
    var creativeDaily = [];
    var geo = [];
    var demographics = [];
    var creativeTypes = ['th_reel', 'scn_reel', 'carousel'];
    var regions = ['Hamburg', 'Schleswig-Holstein', 'Niedersachsen', 'Berlin', 'Nordrhein-Westfalen', 'Bayern'];
    var ageGroups = ['18-24','25-34','35-44','45-54','55-64','65+'];

    definitions.forEach(function (definition, campaignIndex) {
      var rng = randomFor(definition.id);
      var weights = [];
      for (var day = 0; day < definition.days; day++) {
        var weekday = new Date(addDays(definition.start, day) + 'T12:00:00Z').getUTCDay();
        var weekdayFactor = weekday === 0 ? 0.80 : weekday === 6 ? 0.88 : (weekday === 2 || weekday === 3 ? 1.13 : 1.0);
        var ramp = 0.82 + Math.min(day / 12, 1) * 0.25;
        weights.push(Math.max(0.25, weekdayFactor * ramp * (0.72 + rng() * 0.56)));
      }
      var spends = allocate(definition.spend, weights, false);
      var leads = allocate(definition.leads, weights.map(function (w, i) { return w * (0.86 + Math.sin(i * 0.73 + campaignIndex) * 0.08 + rng() * 0.16); }), true);
      var impressions = allocate(definition.impressions, weights, true);
      var clicks = allocate(definition.clicks, weights, true);
      var reaches = allocate(Math.round(definition.impressions * 0.78), weights, true);

      campaigns.push({ id:definition.id, program_id:definition.program, property_id:definition.property, campaign_name:definition.name, flight_no:definition.flight, start_date:definition.start, end_date:addDays(definition.start, definition.days - 1), total_budget:Math.round(definition.spend * 1.15), status:definition.status });
      for (var i = 0; i < definition.days; i++) {
        daily.push({ id:definition.id + '-d' + i, campaign_id:definition.id, date:addDays(definition.start, i), spend:spends[i], leads:leads[i], impressions:impressions[i], clicks:clicks[i], reach:reaches[i] });
      }

      var creativeWeights = [1.18 + rng() * 0.12, 1.0 + rng() * 0.12, 0.76 + rng() * 0.12];
      var creativeSpend = allocate(definition.spend, creativeWeights, false);
      var creativeLeads = allocate(definition.leads, creativeWeights.map(function (w, i) { return w * [1.22, 1.03, 0.78][i]; }), true);
      var creativeImpressions = allocate(definition.impressions, creativeWeights, true);
      var creativeClicks = allocate(definition.clicks, creativeWeights, true);
      creativeTypes.forEach(function (type, creativeIndex) {
        var creativeId = definition.id + '-cr' + (creativeIndex + 1);
        creatives.push({ id:creativeId, campaign_id:definition.id, creative_type:type, name:definition.name + ' ' + type });
        creativeDaily.push({ id:creativeId + '-m', creative_id:creativeId, date:definition.start, spend:creativeSpend[creativeIndex], leads:creativeLeads[creativeIndex], impressions:creativeImpressions[creativeIndex], clicks:creativeClicks[creativeIndex], reach:Math.round(creativeImpressions[creativeIndex] * 0.78) });
      });

      var regionWeights = regions.map(function (_, i) { return [1.6, 1.0, 0.86, 0.72, 0.63, 0.55][i] * (0.86 + rng() * 0.28); });
      var regionLeads = allocate(definition.leads, regionWeights, true);
      var regionSpend = allocate(definition.spend, regionWeights, false);
      var regionImpressions = allocate(definition.impressions, regionWeights, true);
      regions.forEach(function (region, regionIndex) {
        geo.push({ campaign_id:definition.id, region:region, sync_date:'2026-08-16', leads:regionLeads[regionIndex], spend:regionSpend[regionIndex], impressions:regionImpressions[regionIndex], clicks:Math.round(regionImpressions[regionIndex] * 0.015), reach:Math.round(regionImpressions[regionIndex] * 0.78) });
      });

      var ageWeights = [0.46, 1.45, 1.78, 1.31, 0.82, 0.39];
      var ageLeads = allocate(definition.leads, ageWeights, true);
      ageGroups.forEach(function (age, ageIndex) {
        var femaleShare = 0.51 + (rng() - 0.5) * 0.08;
        var femaleLeads = Math.round(ageLeads[ageIndex] * femaleShare);
        var maleLeads = ageLeads[ageIndex] - femaleLeads;
        [['female', femaleLeads], ['male', maleLeads]].forEach(function (pair) {
          demographics.push({ campaign_id:definition.id, age:age, gender:pair[0], sync_date:'2026-08-16', leads:pair[1], spend:Math.round((definition.spend * pair[1] / Math.max(definition.leads, 1)) * 100) / 100, impressions:Math.round(definition.impressions * pair[1] / Math.max(definition.leads, 1)) });
        });
      });
    });

    return {
      client:{ id:'client-elbstein', name:'Elbstein Immobilien', brand:'Elbstein Immobilien', primary_color:'#e7352e', logo_url:null },
      programs:programs,
      properties:properties,
      campaigns:campaigns,
      campaign_daily_metrics:daily,
      creatives:creatives,
      creative_daily_metrics:creativeDaily,
      campaign_geo_insights:geo,
      campaign_demo_insights:demographics
    };
  }

  window.createDemoDashboardPayload = createPayload;
}());
