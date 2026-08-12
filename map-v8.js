(() => {
  'use strict';

  const publicConfig = window.STORMLENS_PUBLIC_CONFIG || {};
  const apiKey = publicConfig.mapTilerApiKey || '';
  if (!apiKey || !window.maptilersdk || !window.maptilerweather) return;

  const { maptilersdk, maptilerweather } = window;
  maptilersdk.config.apiKey = apiKey;

  const WMS = 'https://geo.weather.gc.ca/geomet?';
  const THEME_STORAGE = 'stormlens-theme-v6';
  const MAP_STYLE_STORAGE = 'stormlens-basemap-v6';
  const WEATHER_STORAGE = 'stormlens-weather-layer-v8';
  const RANGE_STORAGE = 'stormlens-timeline-range-v8';
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  const MERCATOR_MAX = 20037508.342789244;

  const MAPTILER = {
    forecastRadar: { title:'Forecast radar', category:'Precipitation', icon:'radar', provider:'maptiler', type:'radar', horizonHours:96, horizon:'Next 4 days', description:'Smooth forecast composite reflectivity in dBZ.' },
    precipitation: { title:'Precipitation', category:'Precipitation', icon:'cloud-rain', provider:'maptiler', type:'precipitation', horizonHours:96, horizon:'Next 4 days', description:'Smooth rain, snow, hail and sleet rate forecast.' },
    temperature: { title:'Temperature', category:'Atmosphere', icon:'thermometer', provider:'maptiler', type:'temperature', horizonHours:96, horizon:'Next 4 days', description:'Smooth 2 m air-temperature forecast.' },
    pressure: { title:'Pressure', category:'Atmosphere', icon:'gauge', provider:'maptiler', type:'pressure', horizonHours:96, horizon:'Next 4 days', description:'Smooth mean sea-level pressure forecast.' },
    wind: { title:'Wind', category:'Wind', icon:'wind', provider:'maptiler', type:'wind', horizonHours:96, horizon:'Next 4 days', description:'Wind speed and direction with animated particles.' }
  };

  const ECCC = {
    observedRadar: { title:'Live radar', category:'Precipitation', icon:'radio-tower', provider:'eccc', layer:'RADAR_1KM_RRAI', style:'RADARURPPRECIPR14-LINEAR', mode:'observed', horizonHours:3, horizon:'Past 3 hours', description:'Official ECCC 1 km observed radar.' },
    nowcast: { title:'Radar nowcast', category:'Precipitation', icon:'cloud-rain-wind', provider:'eccc', layer:'Radar_1km_RainPrecipRate-Extrapolation', style:'RADARURPPRECIPR14-LINEAR', mode:'forecast', horizonHours:1, horizon:'Short range', description:'Extrapolated precipitation based on observed radar.' },
    precipType: { title:'Observed precip type', category:'Precipitation', icon:'cloud-snow', provider:'eccc', layer:'Radar_1km_SfcPrecipType', mode:'observed', horizonHours:3, horizon:'Current / history', description:'Observed rain, snow and mixed precipitation.' },
    precipProb: { title:'Precipitation probability', category:'Precipitation', icon:'percent', provider:'eccc', layer:'HRDPS-WEonG_2.5km_Precip-Prob', mode:'forecast', horizonHours:48, horizon:'Up to 48h', description:'High-resolution Canadian precipitation probability.' },
    rainAccum: { title:'Rain accumulation', category:'Precipitation', icon:'droplets', provider:'eccc', layer:'HRDPS.CONTINENTAL_RN', mode:'forecast', horizonHours:48, horizon:'Up to 48h', description:'Canadian high-resolution accumulated rainfall.' },
    lightning: { title:'Lightning density', category:'Storms', icon:'zap', provider:'eccc', layer:'Lightning_2.5km_Density', style:'Lightning', mode:'observed', horizonHours:3, horizon:'Recent', description:'Canadian lightning flash-density analysis.' },
    thunderRisk: { title:'Thunderstorm probability', category:'Storms', icon:'cloud-lightning', provider:'eccc', layer:'HRDPS-WEonG_2.5km_Thunderstorm-Prob', mode:'forecast', horizonHours:48, horizon:'Up to 48h', description:'High-resolution Canadian thunderstorm probability.' },
    showalter: { title:'Showalter index', category:'Storms', icon:'activity', provider:'eccc', layer:'HRDPS.CONTINENTAL.CONV_SHWINX.500', mode:'forecast', horizonHours:48, horizon:'Up to 48h', description:'Convective instability diagnostic.' },
    alerts: { title:'Official alerts', category:'Storms', icon:'triangle-alert', provider:'eccc', layer:'Current-Alerts', style:'Current-Alerts', mode:'current', horizonHours:0, horizon:'Current', description:'Environment Canada watches, warnings and advisories.' },
    clouds: { title:'Cloud cover', category:'Atmosphere', icon:'cloud', provider:'eccc', layer:'HRDPS.CONTINENTAL_NT', mode:'forecast', horizonHours:48, horizon:'Up to 48h', description:'High-resolution Canadian cloud-cover forecast.' },
    dewpoint: { title:'Dew point', category:'Atmosphere', icon:'droplet', provider:'eccc', layer:'HRDPS.CONTINENTAL_TD', mode:'forecast', horizonHours:48, horizon:'Up to 48h', description:'Canadian dew-point temperature forecast.' },
    humidity: { title:'Humidity', category:'Atmosphere', icon:'waves', provider:'eccc', layer:'HRDPS.CONTINENTAL_HR', mode:'forecast', horizonHours:48, horizon:'Up to 48h', description:'Canadian near-surface relative humidity.' },
    windGust: { title:'Wind gusts', category:'Wind', icon:'wind', provider:'eccc', layer:'HRDPS.CONTINENTAL_WGE', mode:'forecast', horizonHours:48, horizon:'Up to 48h', description:'Canadian high-resolution wind-gust forecast.' },
    snowAccum: { title:'Snow accumulation', category:'Winter', icon:'snowflake', provider:'eccc', layer:'HRDPS.CONTINENTAL_SN', mode:'forecast', horizonHours:48, horizon:'Up to 48h', description:'Canadian accumulated snowfall forecast.' },
    snowDepth: { title:'Snow depth', category:'Winter', icon:'ruler', provider:'eccc', layer:'HRDPS.CONTINENTAL_SD', mode:'forecast', horizonHours:48, horizon:'Up to 48h', description:'Canadian snow-depth forecast.' },
    freezingRain: { title:'Freezing rain', category:'Winter', icon:'cloud-hail', provider:'eccc', layer:'HRDPS.CONTINENTAL_FR', mode:'forecast', horizonHours:48, horizon:'Up to 48h', description:'Canadian freezing-rain accumulation forecast.' },
    modelPrecipType: { title:'Forecast precip type', category:'Winter', icon:'cloud-snow', provider:'eccc', layer:'HRDPS.CONTINENTAL.DIAG_PTYPE', mode:'forecast', horizonHours:48, horizon:'Up to 48h', description:'Model forecast precipitation type.' },
    aqhi: { title:'Air Quality Health Index', category:'Environment', icon:'lungs', provider:'eccc', layer:'AQHI-OBS', mode:'current', horizonHours:0, horizon:'Current', description:'Official Canadian Air Quality Health Index.' },
    smoke: { title:'Wildfire smoke PM2.5', category:'Environment', icon:'cloud-fog', provider:'eccc', layer:'RAQDPS.Sfc_PM2.5-WildfireSmokePlume', mode:'forecast', horizonHours:48, horizon:'Forecast', description:'Canadian wildfire-smoke PM2.5 plume guidance.' }
  };

  const TOMORROW = {
    extendedPrecip: { title:'Extended precipitation', category:'Precipitation', icon:'cloud-rain', provider:'tomorrow', field:'precipitationIntensity', horizonHours:336, horizon:'Next 14 days', description:'Global precipitation intensity from Tomorrow.io.' },
    futureThunderstorms: { title:'Thunderstorms · 14d', category:'Storms', icon:'cloud-lightning', provider:'tomorrow', field:'thunderstormProbability', horizonHours:336, horizon:'Next 14 days', description:'Global thunderstorm probability out to two weeks.' },
    lightningForecast: { title:'Lightning forecast', category:'Storms', icon:'zap', provider:'tomorrow', field:'lightningFlashRateDensity', horizonHours:90, horizon:'Next 90 hours', description:'Forecast lightning flash-rate density, not detected strikes.' },
    extendedTemperature: { title:'Temperature · 14d', category:'Atmosphere', icon:'thermometer', provider:'tomorrow', field:'temperature', horizonHours:336, horizon:'Next 14 days', description:'Extended global temperature forecast.' },
    extendedHumidity: { title:'Humidity · 14d', category:'Atmosphere', icon:'waves', provider:'tomorrow', field:'humidity', horizonHours:336, horizon:'Next 14 days', description:'Extended global relative-humidity forecast.' },
    extendedDewPoint: { title:'Dew point · 14d', category:'Atmosphere', icon:'droplet', provider:'tomorrow', field:'dewPoint', horizonHours:336, horizon:'Next 14 days', description:'Extended global dew-point forecast.' },
    extendedCloudCover: { title:'Cloud cover · 14d', category:'Atmosphere', icon:'cloud', provider:'tomorrow', field:'cloudCover', horizonHours:336, horizon:'Next 14 days', description:'Extended total cloud-cover forecast.' },
    extendedVisibility: { title:'Visibility · 14d', category:'Atmosphere', icon:'eye', provider:'tomorrow', field:'visibility', horizonHours:336, horizon:'Next 14 days', description:'Extended visibility forecast.' },
    extendedWindGust: { title:'Wind gusts · 14d', category:'Wind', icon:'wind', provider:'tomorrow', field:'windGust', horizonHours:336, horizon:'Next 14 days', description:'Extended global wind-gust forecast.' },
    extendedSnow: { title:'Snow intensity · 14d', category:'Winter', icon:'snowflake', provider:'tomorrow', field:'snowIntensity', horizonHours:336, horizon:'Next 14 days', description:'Extended snowfall intensity forecast.' },
    extendedFreezingRain: { title:'Freezing rain · 14d', category:'Winter', icon:'cloud-hail', provider:'tomorrow', field:'freezingRainIntensity', horizonHours:336, horizon:'Next 14 days', description:'Extended freezing-rain intensity forecast.' }
  };

  const defs = { ...MAPTILER, ...ECCC, ...TOMORROW };
  const categories = ['Precipitation','Storms','Atmosphere','Wind','Winter','Environment'];

  let map = null;
  let container = null;
  let selected = localStorage.getItem(WEATHER_STORAGE) || 'observedRadar';
  if (!defs[selected]) selected = 'observedRadar';
  let baseStyle = localStorage.getItem(MAP_STYLE_STORAGE) || 'auto';
  if (!['auto','standard','light','dark','satellite','terrain'].includes(baseStyle)) baseStyle='auto';
  let themeChoice = localStorage.getItem(THEME_STORAGE) || 'system';
  if (!['system','dark','light'].includes(themeChoice)) themeChoice='system';

  let tomorrowConfigured = false;
  let tomorrowReady = false;
  const tomorrowProbes = new Map();
  const ecccMetaCache = new Map();
  let active = null;
  let activeMapTilerLayer = null;
  let playing = false;
  let playbackTimer = null;
  let selectionToken = 0;
  let styleChanging = false;
  let pendingStyleSelection = null;
  let locationFingerprint = '';
  let valuePill = null;
  let rangeBar = null;
  let currentRangeId = null;
  let timeline = { mode:'none', start:0, end:0, current:0, times:[], index:0, options:[] };
  let rasterRenderToken = 0;
  let rasterSlot = -1;
  const rasterSlots = [
    { source:'stormlens-v8-raster-source-a', layer:'stormlens-v8-raster-layer-a' },
    { source:'stormlens-v8-raster-source-b', layer:'stormlens-v8-raster-layer-b' }
  ];

  const $ = q => document.querySelector(q);
  const $$ = q => [...document.querySelectorAll(q)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalizedTime = date => new Date(date).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function currentLocation() {
    try {
      const loc = JSON.parse(localStorage.getItem('stormlens-location') || 'null');
      return loc && Number.isFinite(Number(loc.latitude)) && Number.isFinite(Number(loc.longitude)) ? loc : { name:'Calgary', latitude:51.0447, longitude:-114.0719 };
    } catch (_) { return { name:'Calgary', latitude:51.0447, longitude:-114.0719 }; }
  }

  function currentSettings() {
    try { return JSON.parse(localStorage.getItem('stormlens-settings') || '{}'); }
    catch (_) { return {}; }
  }

  function readRangePrefs() {
    try { return JSON.parse(localStorage.getItem(RANGE_STORAGE) || '{}'); }
    catch (_) { return {}; }
  }

  function saveRangePref(id, rangeId) {
    const prefs = readRangePrefs();
    prefs[id] = rangeId;
    localStorage.setItem(RANGE_STORAGE, JSON.stringify(prefs));
  }

  function effectiveTheme() {
    if (themeChoice === 'dark' || themeChoice === 'light') return themeChoice;
    return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme() {
    const resolved = effectiveTheme();
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themeChoice = themeChoice;
    document.body.dataset.theme = resolved;
    $('#app')?.setAttribute('data-theme', resolved);
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = resolved === 'light' ? '#f5f7fa' : '#070b12';
    const select = $('#stormlensThemeSelect');
    if (select) select.value = themeChoice;
    if (baseStyle === 'auto' && map && !styleChanging) setBaseMap('auto', false);
  }

  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => {
    if (themeChoice === 'system') applyTheme();
  });

  function mapStyleObject(style=baseStyle) {
    const actual = style === 'auto' ? (effectiveTheme() === 'light' ? 'light' : 'dark') : style;
    const S = maptilersdk.MapStyle;
    if (actual === 'standard') return S.STREETS;
    if (actual === 'light') return S.DATAVIZ.LIGHT;
    if (actual === 'dark') return S.DATAVIZ.DARK;
    if (actual === 'satellite') return S.HYBRID;
    if (actual === 'terrain') return S.TOPO;
    return S.DATAVIZ.DARK;
  }

  function firstLabelLayer() {
    const layers = map?.getStyle?.()?.layers || [];
    return layers.find(layer => layer.type === 'symbol' && layer.layout?.['text-field'])?.id;
  }

  function makeMapContainer() {
    const screen = $('#mapScreen');
    if (!screen) return null;
    let node = $('#stormlensMapV8');
    if (!node) {
      node = document.createElement('div');
      node.id = 'stormlensMapV8';
      node.className = 'stormlens-map-v8';
      screen.insertBefore(node, screen.firstChild);
    }
    const legacy = $('#weatherMap');
    if (legacy) { legacy.style.opacity='0'; legacy.style.pointerEvents='none'; }
    return node;
  }

  function ensureValuePill() {
    if (valuePill) return valuePill;
    const screen = $('#mapScreen');
    if (!screen) return null;
    valuePill = document.createElement('div');
    valuePill.className = 'v8-value-pill';
    valuePill.hidden = true;
    screen.appendChild(valuePill);
    return valuePill;
  }

  function locationGeoJSON() {
    const loc = currentLocation();
    return { type:'FeatureCollection', features:[{ type:'Feature', geometry:{ type:'Point', coordinates:[Number(loc.longitude), Number(loc.latitude)] }, properties:{} }] };
  }

  function ensureLocationPin() {
    if (!map || !map.isStyleLoaded?.()) return;
    const source = map.getSource('stormlens-user-location');
    if (source?.setData) source.setData(locationGeoJSON());
    else {
      map.addSource('stormlens-user-location', { type:'geojson', data:locationGeoJSON() });
    }
    if (!map.getLayer('stormlens-user-location-halo')) {
      map.addLayer({ id:'stormlens-user-location-halo', type:'circle', source:'stormlens-user-location', paint:{ 'circle-radius':14, 'circle-color':'#4aa8f5', 'circle-opacity':0.22, 'circle-blur':0.25 } });
    }
    if (!map.getLayer('stormlens-user-location-dot')) {
      map.addLayer({ id:'stormlens-user-location-dot', type:'circle', source:'stormlens-user-location', paint:{ 'circle-radius':7, 'circle-color':'#4aa8f5', 'circle-stroke-color':'#ffffff', 'circle-stroke-width':3, 'circle-opacity':1 } });
    }
    const loc = currentLocation();
    locationFingerprint = `${Number(loc.latitude).toFixed(5)},${Number(loc.longitude).toFixed(5)}`;
  }

  function syncLocation() {
    if (!map || !map.isStyleLoaded?.()) return;
    const loc = currentLocation();
    const fp = `${Number(loc.latitude).toFixed(5)},${Number(loc.longitude).toFixed(5)}`;
    if (fp === locationFingerprint) return;
    ensureLocationPin();
  }

  function setStatus(text, state='live') {
    const label = $('#mapLayerStatus');
    const pill = $('#mapStatusPill');
    if (label) label.textContent = text;
    if (pill) { pill.dataset.state=state; pill.dataset.error=state === 'error' ? 'true' : 'false'; }
  }

  function providerName(def) {
    if (def.provider === 'maptiler') return 'MapTiler Weather';
    if (def.provider === 'tomorrow') return 'Tomorrow.io';
    return 'ECCC GeoMet';
  }

  function renderLegend(def=defs[selected]) {
    const legend = $('#radarLegend');
    const source = $('#radarSourceLine');
    if (!legend || !def) return;
    if (['observedRadar','nowcast','forecastRadar'].includes(selected)) {
      legend.innerHTML = '<span><b class="legend-dot v8-l1"></b>Light</span><span><b class="legend-dot v8-l2"></b>Moderate</span><span><b class="legend-dot v8-l3"></b>Heavy</span><span><b class="legend-dot v8-l4"></b>Very heavy</span><span><b class="legend-dot v8-l5"></b>Extreme</span>';
    } else if (def.field === 'thunderstormProbability') {
      legend.innerHTML = '<span><b class="legend-dot v8-b1"></b>10%</span><span><b class="legend-dot v8-b2"></b>40%</span><span><b class="legend-dot v8-b3"></b>55%</span><span><b class="legend-dot v8-b4"></b>70%</span><span><b class="legend-dot v8-b5"></b>85%+</span>';
    } else if (def.type === 'precipitation' || def.field === 'precipitationIntensity') {
      legend.innerHTML = '<span><b class="legend-dot v8-p1"></b>Light</span><span><b class="legend-dot v8-p2"></b>Moderate</span><span><b class="legend-dot v8-p3"></b>Heavy</span><span><b class="legend-dot v8-p4"></b>Very heavy</span>';
    } else if (def.field === 'lightningFlashRateDensity') {
      legend.innerHTML = '<span class="v8-legend-note">Forecast lightning activity · not observed strikes</span>';
    } else if (def.provider === 'maptiler') {
      legend.innerHTML = `<span class="v8-legend-note">${esc(def.title)} · tap map for exact value</span>`;
    } else {
      legend.innerHTML = `<span class="v8-legend-note">${esc(def.title)}</span>`;
    }
    if (source) source.textContent = `${def.title} · ${providerName(def)} · ${def.horizon}`;
  }

  function ensureRangeBar() {
    if (rangeBar) return rangeBar;
    const controller = $('#radarController');
    const slider = $('#radarTimeline');
    if (!controller || !slider) return null;
    rangeBar = document.createElement('div');
    rangeBar.id = 'stormlensTimelineRanges';
    rangeBar.className = 'v8-range-bar';
    controller.insertBefore(rangeBar, slider);
    rangeBar.addEventListener('click', event => {
      const button = event.target.closest('[data-v8-range]');
      if (!button || button.disabled) return;
      currentRangeId = button.dataset.v8Range;
      saveRangePref(selected, currentRangeId);
      stopPlayback();
      applyActiveRange(true);
    });
    return rangeBar;
  }

  function rangeOptionsFor(def, actualHours=def.horizonHours || 0) {
    if (!def || def.mode === 'current' || actualHours <= 0) return [];
    if (def.mode === 'observed') {
      const options = [];
      if (actualHours >= 1) options.push({ id:'1h', label:'1H', ms:HOUR });
      if (actualHours >= 3) options.push({ id:'3h', label:'3H', ms:3*HOUR });
      if (actualHours >= 6) options.push({ id:'6h', label:'6H', ms:6*HOUR });
      return options;
    }
    const options = [];
    if (actualHours >= 6) options.push({ id:'6h', label:'6H', ms:6*HOUR });
    if (actualHours >= 24) options.push({ id:'24h', label:'24H', ms:24*HOUR });
    if (actualHours >= 48 && actualHours < 90) options.push({ id:'48h', label:'48H', ms:48*HOUR });
    if (actualHours >= 90 && actualHours < 96) options.push({ id:'90h', label:'90H', ms:90*HOUR });
    if (actualHours >= 96) options.push({ id:'4d', label:'4D', ms:4*DAY });
    if (actualHours >= 336) options.push({ id:'14d', label:'14D', ms:14*DAY });
    return options;
  }

  function chooseRange(def, options) {
    if (!options.length) return null;
    const saved = readRangePrefs()[selected];
    if (saved && options.some(option => option.id === saved)) return saved;
    if (def.mode === 'observed') return options[options.length - 1].id;
    if (options.some(option => option.id === '24h')) return '24h';
    return options[0].id;
  }

  function renderRangeBar(options, activeId) {
    const bar = ensureRangeBar();
    if (!bar) return;
    bar.hidden = !options.length;
    bar.innerHTML = options.map(option => `<button type="button" data-v8-range="${option.id}" class="${option.id === activeId ? 'active' : ''}">${option.label}</button>`).join('');
  }

  function configureSlider(min, max, value, step=1) {
    const range = $('#radarTimeline');
    if (!range) return;
    const usable = Number.isFinite(min) && Number.isFinite(max) && max > min;
    range.disabled = !usable;
    range.min = usable ? String(Math.round(min)) : '0';
    range.max = usable ? String(Math.round(max)) : '1';
    range.step = usable ? String(Math.max(1, Math.round(step))) : '1';
    range.value = usable ? String(Math.max(min, Math.min(max, value))) : '0';
  }

  function updateTimelineText(date, leftText, rightText, modeText) {
    const mode = $('#radarModeLabel');
    const stamp = $('#radarTimestamp');
    const left = $('#timelineStartLabel');
    const right = $('#timelineNowLabel');
    if (mode) mode.textContent = modeText || 'WEATHER';
    if (stamp) stamp.textContent = date ? new Date(date).toLocaleString(undefined, { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }) : 'Current';
    if (left) left.textContent = leftText || '';
    if (right) right.textContent = rightText || '';
  }

  function modeTextFor(def) {
    if (def.provider === 'tomorrow') return 'FORECAST · EXTENDED';
    if (def.provider === 'maptiler') return 'FORECAST · SMOOTH';
    if (def.mode === 'observed') return 'OBSERVED';
    if (def.mode === 'forecast') return 'FORECAST';
    return 'CURRENT';
  }

  function formatRangeEnd(ms) {
    if (!ms) return '';
    return new Date(ms).toLocaleDateString(undefined, { month:'short', day:'numeric' });
  }

  function currentOpacity() {
    return Math.max(.25, Math.min(1, Number(currentSettings().radarOpacity || 78) / 100));
  }

  function animationFactor() {
    const value = Number(currentSettings().radarSpeed || 650);
    if (value >= 1000) return 1800;
    if (value >= 500) return 3600;
    if (value >= 250) return 7200;
    return 14400;
  }

  function frameDelay() {
    const value = Number(currentSettings().radarSpeed || 650);
    return Math.max(360, value);
  }

  function stopPlayback() {
    playing = false;
    if (playbackTimer) clearTimeout(playbackTimer);
    playbackTimer = null;
    try { activeMapTilerLayer?.animateByFactor?.(0); } catch (_) {}
    const button = $('#radarPlay');
    if (button) button.innerHTML = '<i data-lucide="play"></i>';
    refreshIcons();
  }

  function setPlayingUI(on) {
    playing = on;
    const button = $('#radarPlay');
    if (button) button.innerHTML = on ? '<i data-lucide="pause"></i>' : '<i data-lucide="play"></i>';
    refreshIcons();
  }

  function removeMapTilerLayer(layer=activeMapTilerLayer) {
    if (!layer || !map) return;
    try { map.removeLayer(layer.id); } catch (_) { try { map.removeLayer(layer); } catch (_) {} }
  }

  function removeRasterSlot(slot) {
    if (!map || slot < 0) return;
    const item = rasterSlots[slot];
    if (map.getLayer(item.layer)) { try { map.removeLayer(item.layer); } catch (_) {} }
    if (map.getSource(item.source)) { try { map.removeSource(item.source); } catch (_) {} }
  }

  function clearRaster() {
    ++rasterRenderToken;
    removeRasterSlot(0);
    removeRasterSlot(1);
    rasterSlot = -1;
  }

  function clearActiveWeather() {
    stopPlayback();
    removeMapTilerLayer();
    activeMapTilerLayer = null;
    clearRaster();
    active = null;
    timeline = { mode:'none', start:0, end:0, current:0, times:[], index:0, options:[] };
    if (valuePill) valuePill.hidden = true;
  }

  function mapTilerConstructor(type) {
    if (type === 'radar') return maptilerweather.RadarLayer;
    if (type === 'precipitation') return maptilerweather.PrecipitationLayer;
    if (type === 'temperature') return maptilerweather.TemperatureLayer;
    if (type === 'pressure') return maptilerweather.PressureLayer;
    if (type === 'wind') return maptilerweather.WindLayer;
    return null;
  }

  function mapTilerOptions(def, token) {
    const base = { id:`stormlens-v8-${def.type}-${token}`, opacity:currentOpacity(), smooth:true };
    if (def.type === 'wind') return { ...base, density:matchMedia('(pointer:coarse)').matches ? 1.7 : 2.3, maxAmount:matchMedia('(pointer:coarse)').matches ? 64 : 128, size:1.3, speed:.00115, refreshInterval:matchMedia('(pointer:coarse)').matches ? 950 : 800 };
    if (def.type === 'temperature' && maptilerweather.ColorRamp?.builtin?.TEMPERATURE_3) base.colorramp = maptilerweather.ColorRamp.builtin.TEMPERATURE_3;
    return base;
  }

  function commitSelection(id, def) {
    selected = id;
    localStorage.setItem(WEATHER_STORAGE, id);
    active = { id, def, provider:def.provider };
    syncQuickButtons();
    renderLayerSelection();
    renderLegend(def);
    window.dispatchEvent(new CustomEvent('stormlens:weather-layer-changed', { detail:{ id, def } }));
  }

  async function activateMapTiler(id, token) {
    const def = defs[id];
    const Constructor = mapTilerConstructor(def.type);
    if (!Constructor) throw new Error('Unsupported MapTiler weather layer');
    const layer = new Constructor(mapTilerOptions(def, token));
    const before = firstLabelLayer();
    if (before) map.addLayer(layer, before); else map.addLayer(layer);
    await layer.onSourceReadyAsync();
    if (token !== selectionToken) { removeMapTilerLayer(layer); return false; }

    const previousMapLayer = activeMapTilerLayer;
    clearRaster();
    if (previousMapLayer && previousMapLayer !== layer) removeMapTilerLayer(previousMapLayer);
    activeMapTilerLayer = layer;
    commitSelection(id, def);

    layer.on('tick', () => {
      if (activeMapTilerLayer !== layer || selected !== id) return;
      const t = +layer.getAnimationTimeDate();
      if (timeline.end && t >= timeline.end - 15000) {
        layer.setAnimationTime(Math.round(timeline.start / 1000));
        return;
      }
      timeline.current = t;
      const slider = $('#radarTimeline');
      if (slider && !slider.matches(':active')) slider.value = String(Math.max(timeline.start, Math.min(timeline.end, t)));
      updateTimelineText(t, 'NOW', formatRangeEnd(timeline.end), modeTextFor(def));
    });
    layer.on('animationTimeSet', () => {
      if (activeMapTilerLayer !== layer || selected !== id) return;
      const t = +layer.getAnimationTimeDate();
      timeline.current = t;
      updateTimelineText(t, 'NOW', formatRangeEnd(timeline.end), modeTextFor(def));
      updatePickedValueAtCenter();
    });

    applyMapTilerRange(true);
    setStatus(`${def.title} · LIVE`, 'live');
    return true;
  }

  function applyMapTilerRange(reset=false) {
    if (!activeMapTilerLayer || !active || active.provider !== 'maptiler') return;
    const def = active.def;
    const availableStart = +activeMapTilerLayer.getAnimationStartDate();
    const availableEnd = +activeMapTilerLayer.getAnimationEndDate();
    const actualHours = Math.max(1, Math.floor((availableEnd - Math.max(Date.now(), availableStart)) / HOUR));
    const options = rangeOptionsFor(def, actualHours);
    if (!options.length) return;
    if (!currentRangeId || !options.some(option => option.id === currentRangeId)) currentRangeId = chooseRange(def, options);
    const option = options.find(item => item.id === currentRangeId) || options[0];
    const start = Math.max(Date.now(), availableStart);
    const end = Math.min(availableEnd, start + option.ms);
    timeline = { mode:'maptiler', start, end, current:reset ? start : Math.max(start, Math.min(end, timeline.current || start)), times:[], index:0, options };
    renderRangeBar(options, option.id);
    configureSlider(start, end, timeline.current, 15*60*1000);
    activeMapTilerLayer.setAnimationTime(Math.round(timeline.current / 1000));
    updateTimelineText(timeline.current, 'NOW', formatRangeEnd(end), modeTextFor(def));
  }

  function parseDuration(value) {
    const m = String(value || '').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 360000;
    return (((Number(m[1]||0)*24 + Number(m[2]||0))*60 + Number(m[3]||0))*60 + Number(m[4]||0))*1000 || 360000;
  }

  function parseTimes(text) {
    if (!text) return [];
    const out = [];
    for (const part of String(text).split(',').map(v => v.trim()).filter(Boolean)) {
      if (!part.includes('/')) { const d = new Date(part); if (!Number.isNaN(+d)) out.push(d); continue; }
      const [a,b,p] = part.split('/');
      const start = new Date(a), end = new Date(b), step = parseDuration(p);
      if (Number.isNaN(+start) || Number.isNaN(+end) || step <= 0) continue;
      for (let t=+start, guard=0; t<=+end && guard<2500; t+=step, guard++) out.push(new Date(t));
    }
    return [...new Map(out.map(d => [d.toISOString(), d])).values()].sort((a,b)=>a-b);
  }

  function directChild(node,name) { return [...(node?.children || [])].find(child => child.localName === name || child.tagName === name); }

  async function ecccMeta(id) {
    if (ecccMetaCache.has(id)) return ecccMetaCache.get(id);
    const def = defs[id];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const params = new URLSearchParams({ service:'WMS', version:'1.3.0', request:'GetCapabilities', layer:def.layer, _:String(Date.now()) });
      const res = await fetch(`${WMS}${params}`, { cache:'no-store', signal:controller.signal });
      if (!res.ok) throw new Error(`GeoMet ${res.status}`);
      const xml = new DOMParser().parseFromString(await res.text(), 'application/xml');
      const node = [...xml.querySelectorAll('Layer')].find(n => directChild(n,'Name')?.textContent?.trim() === def.layer);
      if (!node) throw new Error('Layer unavailable');
      const timeNode = [...node.children].find(child => (child.localName === 'Dimension' || child.localName === 'Extent') && child.getAttribute('name') === 'time');
      const meta = { times:parseTimes(timeNode?.textContent?.trim() || '') };
      ecccMetaCache.set(id, meta);
      return meta;
    } catch (error) {
      return { times:[], error:error.name === 'AbortError' ? 'Timed out' : error.message };
    } finally { clearTimeout(timeout); }
  }

  function ecccTileTemplate(def,date) {
    const params = new URLSearchParams({ SERVICE:'WMS', REQUEST:'GetMap', VERSION:'1.1.1', LAYERS:def.layer, STYLES:def.style || '', FORMAT:'image/png', TRANSPARENT:'true', SRS:'EPSG:3857', WIDTH:'512', HEIGHT:'512' });
    if (date) params.set('TIME', normalizedTime(date));
    return `${WMS}${params.toString()}&BBOX={bbox-epsg-3857}`;
  }

  function tileBBox(z,x,y) {
    const n = 2 ** z;
    const span = MERCATOR_MAX * 2;
    const minx = x / n * span - MERCATOR_MAX;
    const maxx = (x + 1) / n * span - MERCATOR_MAX;
    const maxy = MERCATOR_MAX - y / n * span;
    const miny = MERCATOR_MAX - (y + 1) / n * span;
    return `${minx},${miny},${maxx},${maxy}`;
  }

  function ecccPrefetchUrl(def,date,z,x,y) {
    return ecccTileTemplate(def,date).replace('{bbox-epsg-3857}', tileBBox(z,x,y));
  }

  async function getProviderStatus() {
    try {
      const res = await fetch('/api/provider-status', { cache:'no-store' });
      if (!res.ok) return {};
      return await res.json();
    } catch (_) { return {}; }
  }

  async function probeTomorrow(field, force=false) {
    if (!force && tomorrowProbes.has(field)) return tomorrowProbes.get(field);
    try {
      const res = await fetch(`/api/tomorrow-probe?field=${encodeURIComponent(field)}`, { cache:'no-store' });
      const data = res.ok ? await res.json() : { available:false, reason:`http_${res.status}` };
      tomorrowProbes.set(field, data);
      return data;
    } catch (_) {
      const data = { available:false, reason:'probe_failed' };
      tomorrowProbes.set(field, data);
      return data;
    }
  }

  function tomorrowTemplate(def,date) {
    return `/api/tomorrow-tile?z={z}&x={x}&y={y}&field=${encodeURIComponent(def.field)}&time=${encodeURIComponent(normalizedTime(date))}`;
  }

  function tomorrowPrefetchUrl(def,date,z,x,y) {
    return `/api/tomorrow-tile?z=${z}&x=${x}&y=${y}&field=${encodeURIComponent(def.field)}&time=${encodeURIComponent(normalizedTime(date))}`;
  }

  function lon2tile(lon,z) { return Math.floor((lon + 180) / 360 * (2 ** z)); }
  function lat2tile(lat,z) {
    const rad = lat * Math.PI / 180;
    return Math.floor((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2 * (2 ** z));
  }

  function visibleTiles() {
    if (!map) return [];
    const z = Math.max(1, Math.min(12, Math.floor(map.getZoom())));
    const bounds = map.getBounds();
    const n = 2 ** z;
    let minX = lon2tile(bounds.getWest(), z), maxX = lon2tile(bounds.getEast(), z);
    const minY = Math.max(0, lat2tile(bounds.getNorth(), z));
    const maxY = Math.min(n - 1, lat2tile(bounds.getSouth(), z));
    minX = Math.max(0, minX); maxX = Math.min(n - 1, maxX);
    const result = [];
    for (let x=minX; x<=maxX; x++) for (let y=minY; y<=maxY; y++) result.push({z,x,y});
    return result.slice(0, 24);
  }

  function preloadImage(url) {
    return new Promise(resolve => {
      const img = new Image();
      let settled = false;
      const done = () => { if (settled) return; settled=true; img.onload=null; img.onerror=null; resolve(); };
      img.onload = done; img.onerror = done; img.src = url;
      setTimeout(done, 1000);
    });
  }

  async function prefetchFrame(frame) {
    const tiles = visibleTiles();
    if (!tiles.length) return;
    const urls = tiles.map(tile => frame.prefetch(tile.z,tile.x,tile.y));
    await Promise.race([Promise.all(urls.map(preloadImage)), sleep(1100)]);
  }

  async function presentRasterFrame(frame, token) {
    if (!map || !active || token !== rasterRenderToken) return false;
    await prefetchFrame(frame);
    if (token !== rasterRenderToken || !map || !active) return false;

    const nextSlot = rasterSlot === 0 ? 1 : 0;
    removeRasterSlot(nextSlot);
    const slot = rasterSlots[nextSlot];
    map.addSource(slot.source, { type:'raster', tiles:[frame.template], tileSize:frame.tileSize || 512, minzoom:1, maxzoom:12, attribution:frame.attribution });
    const spec = { id:slot.layer, type:'raster', source:slot.source, paint:{ 'raster-opacity':0, 'raster-resampling':'linear', 'raster-fade-duration':140 } };
    const before = firstLabelLayer();
    if (before) map.addLayer(spec, before); else map.addLayer(spec);

    const oldSlot = rasterSlot;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!map.getLayer(slot.layer)) return;
      map.setPaintProperty(slot.layer, 'raster-opacity', currentOpacity());
      if (oldSlot >= 0 && map.getLayer(rasterSlots[oldSlot].layer)) map.setPaintProperty(rasterSlots[oldSlot].layer, 'raster-opacity', 0);
      map.triggerRepaint?.();
    }));
    rasterSlot = nextSlot;
    if (oldSlot >= 0) setTimeout(() => removeRasterSlot(oldSlot), 240);
    return true;
  }

  function actualHoursFromTimes(times, def) {
    if (!times.length) return def.horizonHours || 0;
    if (def.mode === 'observed') return Math.max(1, Math.ceil((+times[times.length-1] - +times[0]) / HOUR));
    const now = Date.now();
    return Math.max(1, Math.ceil((+times[times.length-1] - now) / HOUR));
  }

  function buildRasterTimeline(def, allTimes) {
    const actualHours = actualHoursFromTimes(allTimes, def);
    const options = rangeOptionsFor(def, Math.min(def.horizonHours || actualHours, actualHours || def.horizonHours));
    if (options.length) {
      if (!currentRangeId || !options.some(option => option.id === currentRangeId)) currentRangeId = chooseRange(def, options);
    } else currentRangeId = null;
    const option = options.find(item => item.id === currentRangeId) || options[0];
    let times = allTimes;
    if (def.mode === 'observed' && option && allTimes.length) {
      const latest = +allTimes[allTimes.length-1];
      times = allTimes.filter(date => +date >= latest - option.ms && +date <= latest + 60000);
    } else if (def.mode === 'forecast' && option && allTimes.length) {
      const now = Date.now();
      const startCandidate = allTimes.find(date => +date >= now - HOUR) || allTimes[0];
      const start = +startCandidate;
      times = allTimes.filter(date => +date >= start && +date <= start + option.ms);
    }
    if (!times.length && allTimes.length) times = [allTimes[allTimes.length-1]];
    const index = def.mode === 'observed' ? Math.max(0, times.length - 1) : 0;
    timeline = { mode:'raster', start:times[0] ? +times[0] : 0, end:times[times.length-1] ? +times[times.length-1] : 0, current:times[index] ? +times[index] : 0, times, index, options };
    renderRangeBar(options, currentRangeId);
    configureSlider(0, Math.max(0, times.length - 1), index, 1);
    updateTimelineText(times[index], def.mode === 'observed' ? `PAST ${currentRangeId?.toUpperCase() || ''}` : 'NOW', times.length > 1 ? formatRangeEnd(+times[times.length-1]) : def.horizon.toUpperCase(), modeTextFor(def));
  }

  function frameForActive(index) {
    if (!active || !timeline.times.length) return null;
    const date = timeline.times[index];
    const def = active.def;
    if (def.provider === 'eccc') {
      return { date, template:ecccTileTemplate(def,date), tileSize:512, attribution:'Environment and Climate Change Canada', prefetch:(z,x,y)=>ecccPrefetchUrl(def,date,z,x,y) };
    }
    if (def.provider === 'tomorrow') {
      return { date, template:tomorrowTemplate(def,date), tileSize:256, attribution:'Tomorrow.io', prefetch:(z,x,y)=>tomorrowPrefetchUrl(def,date,z,x,y) };
    }
    return null;
  }

  async function showRasterIndex(index, { animate=false }={}) {
    if (!active || timeline.mode !== 'raster' || !timeline.times.length) return false;
    index = Math.max(0, Math.min(timeline.times.length - 1, index));
    const token = rasterRenderToken;
    const frame = frameForActive(index);
    if (!frame) return false;
    if (!animate) setStatus(`${active.def.title} · loading`, 'loading');
    const ok = await presentRasterFrame(frame, token);
    if (!ok || token !== rasterRenderToken) return false;
    timeline.index = index;
    timeline.current = +timeline.times[index];
    const slider = $('#radarTimeline'); if (slider) slider.value = String(index);
    updateTimelineText(timeline.times[index], active.def.mode === 'observed' ? `PAST ${currentRangeId?.toUpperCase() || ''}` : 'NOW', timeline.times.length > 1 ? formatRangeEnd(+timeline.times[timeline.times.length-1]) : active.def.horizon.toUpperCase(), modeTextFor(active.def));
    setStatus(`${active.def.title} · LIVE`, 'live');
    const next = Math.min(timeline.times.length - 1, index + rasterPlaybackJump());
    if (next !== index) prefetchFrame(frameForActive(next)).catch(()=>{});
    return true;
  }

  async function activateEccc(id, token) {
    const def = defs[id];
    const meta = await ecccMeta(id);
    if (token !== selectionToken) return false;
    if (meta.error || !meta.times.length) throw new Error(meta.error || 'No ECCC time dimension');

    stopPlayback();
    removeMapTilerLayer();
    activeMapTilerLayer = null;
    clearRaster();
    commitSelection(id, def);
    buildRasterTimeline(def, meta.times);
    ++rasterRenderToken;
    await showRasterIndex(timeline.index);
    ensureLocationPin();
    return true;
  }

  function buildTomorrowTimes(def) {
    const now = Math.floor(Date.now() / HOUR) * HOUR;
    const options = rangeOptionsFor(def, def.horizonHours);
    if (!currentRangeId || !options.some(option => option.id === currentRangeId)) currentRangeId = chooseRange(def, options);
    const option = options.find(item => item.id === currentRangeId) || options[0];
    const end = now + Math.min(def.horizonHours * HOUR, option?.ms || def.horizonHours * HOUR);
    const times = [];
    for (let t=now; t<=end; t+=HOUR) times.push(new Date(t));
    timeline = { mode:'raster', start:now, end, current:now, times, index:0, options };
    renderRangeBar(options, currentRangeId);
    configureSlider(0, Math.max(0, times.length - 1), 0, 1);
    updateTimelineText(times[0], 'NOW', formatRangeEnd(end), modeTextFor(def));
  }

  function tomorrowReason(data) {
    if (data?.reason === 'not_entitled_or_invalid_key') return 'not available on this Tomorrow.io plan';
    if (data?.reason === 'rate_limited') return 'Tomorrow.io rate limit reached';
    if (data?.reason === 'not_configured') return 'Tomorrow.io not configured';
    return 'Tomorrow.io layer unavailable';
  }

  async function activateTomorrow(id, token) {
    const def = defs[id];
    if (!tomorrowConfigured) throw new Error('Tomorrow.io not configured');
    const capability = await probeTomorrow(def.field);
    if (token !== selectionToken) return false;
    if (!capability.available) throw new Error(tomorrowReason(capability));

    stopPlayback();
    removeMapTilerLayer();
    activeMapTilerLayer = null;
    clearRaster();
    commitSelection(id, def);
    buildTomorrowTimes(def);
    ++rasterRenderToken;
    await showRasterIndex(0);
    ensureLocationPin();
    return true;
  }

  async function selectLayer(id, { quiet=false, force=false }={}) {
    if (!defs[id] || !map || styleChanging) return false;
    if (!force && active?.id === id) return true;
    const token = ++selectionToken;
    const previous = active;
    currentRangeId = null;
    setStatus(`${defs[id].title} · loading`, 'loading');
    try {
      let ok = false;
      if (defs[id].provider === 'maptiler') ok = await activateMapTiler(id, token);
      else if (defs[id].provider === 'tomorrow') ok = await activateTomorrow(id, token);
      else ok = await activateEccc(id, token);
      if (token !== selectionToken) return false;
      if (!ok) return false;
      ensureLocationPin();
      if (!quiet) closeLayers();
      return true;
    } catch (error) {
      if (token !== selectionToken) return false;
      console.warn('[StormLens V8 layer]', id, error);
      const message = String(error?.message || 'Layer unavailable');
      setStatus(`${defs[id].title} · ${message}`, 'error');
      if (previous) {
        selected = previous.id;
        active = previous;
        syncQuickButtons();
        renderLayerSelection();
        renderLegend(previous.def);
      }
      return false;
    }
  }

  function applyActiveRange(reset=false) {
    if (!active) return;
    if (active.provider === 'maptiler') return applyMapTilerRange(reset);
    if (active.provider === 'tomorrow') {
      buildTomorrowTimes(active.def);
      ++rasterRenderToken;
      showRasterIndex(0).catch(()=>{});
      return;
    }
    ecccMeta(active.id).then(meta => {
      if (!active || active.id !== selected || meta.error) return;
      buildRasterTimeline(active.def, meta.times);
      ++rasterRenderToken;
      showRasterIndex(timeline.index).catch(()=>{});
    });
  }

  function rasterPlaybackJump() {
    if (!active || active.provider !== 'tomorrow') return 1;
    if (currentRangeId === '14d') return 6;
    if (currentRangeId === '4d' || currentRangeId === '90h') return 3;
    return 1;
  }

  async function rasterPlayTick() {
    if (!playing || timeline.mode !== 'raster' || !timeline.times.length) return;
    let next = timeline.index + rasterPlaybackJump();
    if (next >= timeline.times.length) next = active?.def?.mode === 'observed' ? 0 : 0;
    await showRasterIndex(next, { animate:true });
    if (!playing) return;
    playbackTimer = setTimeout(rasterPlayTick, frameDelay());
  }

  function togglePlayback() {
    if (!active) return;
    if (playing) { stopPlayback(); return; }
    if (timeline.mode === 'maptiler' && activeMapTilerLayer) {
      setPlayingUI(true);
      if (timeline.current >= timeline.end - 60000) {
        timeline.current = timeline.start;
        activeMapTilerLayer.setAnimationTime(Math.round(timeline.start / 1000));
      }
      activeMapTilerLayer.animateByFactor(animationFactor());
      return;
    }
    if (timeline.mode === 'raster' && timeline.times.length > 1) {
      setPlayingUI(true);
      if (timeline.index >= timeline.times.length - 1) timeline.index = 0;
      rasterPlayTick();
    }
  }

  function step(direction) {
    stopPlayback();
    if (!active) return;
    if (timeline.mode === 'maptiler' && activeMapTilerLayer) {
      const next = Math.min(timeline.end, Math.max(timeline.start, (timeline.current || timeline.start) + direction * HOUR));
      timeline.current = next;
      activeMapTilerLayer.setAnimationTime(Math.round(next / 1000));
      const slider = $('#radarTimeline'); if (slider) slider.value = String(next);
      updateTimelineText(next, 'NOW', formatRangeEnd(timeline.end), modeTextFor(active.def));
      return;
    }
    if (timeline.mode === 'raster' && timeline.times.length) {
      showRasterIndex(Math.max(0, Math.min(timeline.times.length - 1, timeline.index + direction))).catch(()=>{});
    }
  }

  let sliderTimer = null;
  function bindTimelineControls() {
    const range = $('#radarTimeline'), play = $('#radarPlay'), back = $('#radarStepBack'), forward = $('#radarStepForward');
    if (!range || range.dataset.v8Bound) return;
    range.dataset.v8Bound = 'true';
    range.addEventListener('input', event => {
      event.preventDefault(); event.stopImmediatePropagation(); stopPlayback();
      clearTimeout(sliderTimer);
      if (!active) return;
      if (timeline.mode === 'maptiler' && activeMapTilerLayer) {
        const ms = Math.max(timeline.start, Math.min(timeline.end, Number(range.value)));
        timeline.current = ms;
        activeMapTilerLayer.setAnimationTime(Math.round(ms / 1000));
        updateTimelineText(ms, 'NOW', formatRangeEnd(timeline.end), modeTextFor(active.def));
      } else if (timeline.mode === 'raster') {
        const index = Math.max(0, Math.min(timeline.times.length - 1, Number(range.value)));
        const date = timeline.times[index];
        updateTimelineText(date, active.def.mode === 'observed' ? `PAST ${currentRangeId?.toUpperCase() || ''}` : 'NOW', formatRangeEnd(timeline.end), modeTextFor(active.def));
        sliderTimer = setTimeout(() => showRasterIndex(index).catch(()=>{}), 90);
      }
    }, true);
    range.addEventListener('change', event => {
      event.preventDefault(); event.stopImmediatePropagation();
      if (timeline.mode === 'raster') { clearTimeout(sliderTimer); showRasterIndex(Number(range.value)).catch(()=>{}); }
    }, true);
    play?.addEventListener('click', event => { event.preventDefault(); event.stopImmediatePropagation(); togglePlayback(); }, true);
    back?.addEventListener('click', event => { event.preventDefault(); event.stopImmediatePropagation(); step(-1); }, true);
    forward?.addEventListener('click', event => { event.preventDefault(); event.stopImmediatePropagation(); step(1); }, true);
  }

  function formatPickedValue(id,value) {
    if (!value) return '';
    if (id === 'forecastRadar' && Number.isFinite(value.value)) return `${value.value.toFixed(0)} dBZ`;
    if (id === 'precipitation' && Number.isFinite(value.value)) return `${value.value.toFixed(1)} mm/h`;
    if (id === 'temperature' && Number.isFinite(value.value)) return `${value.value.toFixed(1)} °C`;
    if (id === 'pressure' && Number.isFinite(value.value)) return `${value.value.toFixed(0)} hPa`;
    if (id === 'wind' && Number.isFinite(value.speedKilometersPerHour)) return `${value.compassDirection || ''} ${value.speedKilometersPerHour.toFixed(1)} km/h`.trim();
    return '';
  }

  function showPickedValue(lngLat) {
    const pill = ensureValuePill();
    if (!pill || !activeMapTilerLayer || active?.provider !== 'maptiler') { if (pill) pill.hidden=true; return; }
    try {
      const value = activeMapTilerLayer.pickAt(lngLat.lng, lngLat.lat);
      const text = formatPickedValue(selected, value);
      if (!text) { pill.hidden=true; return; }
      pill.innerHTML = `<span>${esc(active.def.title)}</span><strong>${esc(text)}</strong>`;
      pill.hidden = false;
    } catch (_) { pill.hidden=true; }
  }

  function updatePickedValueAtCenter() { if (map) showPickedValue(map.getCenter()); }

  function quickTarget(key) {
    if (key === 'radar') return 'observedRadar';
    if (key === 'nowcast') return 'nowcast';
    if (key === 'lightning') return 'lightning';
    if (key === 'storms') return tomorrowReady ? 'futureThunderstorms' : 'thunderRisk';
    if (key === 'alerts') return 'alerts';
    return null;
  }

  function syncQuickButtons() {
    ['radar','nowcast','lightning','storms','alerts'].forEach(key => {
      const button = $(`#quickLayers [data-layer="${key}"]`);
      if (!button) return;
      const target = quickTarget(key);
      const isSelected = selected === target || (key === 'storms' && ['futureThunderstorms','thunderRisk'].includes(selected));
      button.classList.toggle('active', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    });
  }

  function bindQuickControls() {
    const rail = $('#quickLayers');
    if (!rail || rail.dataset.v8Bound) return;
    rail.dataset.v8Bound='true';
    rail.addEventListener('click', event => {
      const button = event.target.closest('[data-layer]');
      if (!button) return;
      const key = button.dataset.layer;
      if (!['radar','nowcast','lightning','storms','alerts','layers'].includes(key)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (key === 'layers') return openLayers();
      const target = quickTarget(key);
      if (target) selectLayer(target);
    }, true);
    $('#recenterBtn')?.addEventListener('click', event => {
      event.preventDefault(); event.stopImmediatePropagation();
      const loc = currentLocation();
      map?.easeTo({ center:[Number(loc.longitude),Number(loc.latitude)], zoom:8.2, duration:650, essential:true });
      ensureLocationPin();
    }, true);
  }

  function mapTypeCards() {
    const items = { auto:['Auto','Follows app theme','auto'], standard:['Standard','Roads + labels','standard'], light:['Light','Bright + clean','light'], dark:['Dark','Low-light weather','dark'], satellite:['Satellite','Imagery + labels','satellite'], terrain:['Terrain','Topo + terrain','terrain'] };
    return Object.entries(items).map(([id,[title,sub,preview]]) => `<button class="map-type-card ${baseStyle === id ? 'active' : ''}" data-map-style="${id}"><span class="map-type-preview preview-${preview}"></span><strong>${title}</strong><small>${sub}</small></button>`).join('');
  }

  function visibleDefinitions() {
    return Object.entries(defs).filter(([,def]) => def.provider !== 'tomorrow' || tomorrowConfigured);
  }

  function providerBadge(def) {
    if (def.provider === 'maptiler') return 'SMOOTH · 4D';
    if (def.provider === 'tomorrow') return def.horizonHours >= 336 ? 'EXTENDED · 14D' : `EXTENDED · ${def.horizonHours}H`;
    if (def.mode === 'observed') return 'OBSERVED';
    if (def.mode === 'forecast') return def.horizonHours ? `CANADA · ${def.horizonHours}H` : 'FORECAST';
    return 'CURRENT';
  }

  function layerRows() {
    return categories.map(category => {
      const rows = visibleDefinitions().filter(([,def]) => def.category === category).map(([id,def]) => `<button class="v6-layer-row ${selected === id ? 'active' : ''}" data-v8-weather="${id}"><span class="v6-layer-icon"><i data-lucide="${def.icon}"></i></span><span class="v6-layer-copy"><strong>${esc(def.title)}</strong><small>${esc(def.description)}</small></span><span class="v8-layer-meta">${providerBadge(def)}</span><span class="v6-radio"><b></b></span></button>`).join('');
      return rows ? `<section class="v6-layer-group"><h3>${category}</h3>${rows}</section>` : '';
    }).join('');
  }

  function buildLayerSheet() {
    const sheet = $('#layersModal .layer-sheet');
    if (!sheet) return;
    sheet.innerHTML = `<div class="sheet-handle"></div><div class="sheet-title-row"><div><span class="eyebrow">MAP</span><h2>Map layers</h2></div><button class="icon-button v8-close-layers" aria-label="Close"><i data-lucide="x"></i></button></div><section class="v6-map-type-section"><div class="v6-section-head"><div><span class="eyebrow">BASE MAP</span><h3>Map type</h3></div><small>MapTiler vector + satellite maps</small></div><div class="map-type-grid">${mapTypeCards()}</div></section><section class="v6-weather-section"><div class="v6-section-head"><div><span class="eyebrow">WEATHER</span><h3>Weather layer</h3></div><small>One active layer at a time</small></div><div class="v6-selected-summary"><span class="health-dot live"></span><strong id="v8SelectedLayerName">${esc(defs[selected].title)}</strong><span>${esc(defs[selected].horizon)}</span></div><div class="v6-layer-groups">${layerRows()}</div></section>`;
    sheet.querySelector('.v8-close-layers')?.addEventListener('click', closeLayers);
    sheet.querySelectorAll('[data-map-style]').forEach(btn => btn.addEventListener('click', () => setBaseMap(btn.dataset.mapStyle)));
    sheet.querySelectorAll('[data-v8-weather]').forEach(btn => btn.addEventListener('click', () => selectLayer(btn.dataset.v8Weather)));
    refreshIcons();
  }

  function renderLayerSelection() {
    $$('[data-v8-weather]').forEach(row => row.classList.toggle('active', row.dataset.v8Weather === selected));
    const name = $('#v8SelectedLayerName'); if (name) name.textContent = defs[selected]?.title || '';
    const summary = $('.v6-selected-summary span:last-child'); if (summary) summary.textContent = defs[selected]?.horizon || '';
  }

  function openLayers() { buildLayerSheet(); const modal=$('#layersModal'); if (modal) modal.hidden=false; refreshIcons(); }
  function closeLayers() { const modal=$('#layersModal'); if (modal) modal.hidden=true; }

  function providerRow(id,title,text,state='loading') {
    const list = $('#settingsModal .settings-list');
    if (!list) return;
    let row = $(`#${id}`);
    if (!row) {
      row = document.createElement('div'); row.id=id; row.className='setting-row';
      row.innerHTML = `<span><strong>${esc(title)}</strong><small data-provider-text>${esc(text)}</small></span><span class="health-dot ${state}" data-provider-dot></span>`;
      list.appendChild(row);
    }
    row.querySelector('[data-provider-text]').textContent = text;
    row.querySelector('[data-provider-dot]').className = `health-dot ${state}`;
  }

  function injectSettings() {
    const list = $('#settingsModal .settings-list');
    if (!list) return;
    if (!$('#stormlensThemeSelect')) {
      const theme = document.createElement('div');
      theme.className='setting-row';
      theme.innerHTML='<span><strong>Appearance</strong><small>App theme</small></span><select id="stormlensThemeSelect"><option value="system">System</option><option value="dark">Dark</option><option value="light">Light</option></select>';
      list.insertBefore(theme,list.firstChild?.nextSibling || list.firstChild);
      $('#stormlensThemeSelect').value=themeChoice;
      $('#stormlensThemeSelect').addEventListener('change',event=>{themeChoice=event.target.value;localStorage.setItem(THEME_STORAGE,themeChoice);applyTheme();});
    }
    if (!$('#stormlensMapStyleSelect')) {
      const row = document.createElement('div'); row.className='setting-row';
      row.innerHTML='<span><strong>Default map</strong><small>MapTiler basemap</small></span><select id="stormlensMapStyleSelect"><option value="auto">Auto</option><option value="standard">Standard</option><option value="light">Light</option><option value="dark">Dark</option><option value="satellite">Satellite</option><option value="terrain">Terrain</option></select>';
      list.insertBefore(row,list.firstChild?.nextSibling || list.firstChild);
      $('#stormlensMapStyleSelect').value=baseStyle;
      $('#stormlensMapStyleSelect').addEventListener('change',event=>setBaseMap(event.target.value));
    }
    $('#radarOpacity')?.addEventListener('input',()=>{
      if (activeMapTilerLayer) { try { activeMapTilerLayer.setOpacity(currentOpacity()); } catch (_) {} }
      if (rasterSlot >= 0 && map?.getLayer(rasterSlots[rasterSlot].layer)) map.setPaintProperty(rasterSlots[rasterSlot].layer,'raster-opacity',currentOpacity());
    });
    providerRow('mapTilerProviderRow','MapTiler','WebGL map + 4-day weather','live');
    providerRow('tomorrowProviderRow','Tomorrow.io', tomorrowConfigured ? (tomorrowReady ? 'Connected · extended maps ready' : 'Key detected · checking plan') : 'Not configured', tomorrowReady ? 'live' : tomorrowConfigured ? 'loading' : 'error');
  }

  function setBaseMap(style,persist=true) {
    if (!map || !['auto','standard','light','dark','satellite','terrain'].includes(style) || styleChanging) return;
    baseStyle=style;
    if (persist) localStorage.setItem(MAP_STYLE_STORAGE,style);
    const setting=$('#stormlensMapStyleSelect'); if (setting) setting.value=style;
    $$('.map-type-card').forEach(card=>card.classList.toggle('active',card.dataset.mapStyle===style));
    pendingStyleSelection=selected;
    styleChanging=true;
    stopPlayback();
    activeMapTilerLayer=null;
    clearRaster();
    active=null;
    map.setStyle(mapStyleObject(style));
  }

  function handleStyleLoad() {
    ensureLocationPin();
    if (!styleChanging) return;
    styleChanging=false;
    const id=pendingStyleSelection || selected;
    pendingStyleSelection=null;
    setTimeout(()=>selectLayer(id,{quiet:true,force:true}),80);
  }

  function refreshIcons() { if (window.lucide) requestAnimationFrame(()=>window.lucide.createIcons()); }

  async function initializeProviders() {
    const status = await getProviderStatus();
    tomorrowConfigured = Boolean(status.tomorrow);
    if (tomorrowConfigured) {
      const core = await probeTomorrow('thunderstormProbability', true);
      tomorrowReady = Boolean(core.available);
    }
    injectSettings();
    buildLayerSheet();
    syncQuickButtons();
  }

  function mapErrorHandler(event) {
    const message = String(event?.error?.message || event?.message || 'Map render error');
    console.warn('[StormLens V8 map]', message);
    if (/401|403|unauthori|forbidden|api.?key|access denied|origin/i.test(message)) {
      window.dispatchEvent(new CustomEvent('stormlens:v8-fatal', { detail:{ reason:'MapTiler key or allowed-origin restriction' } }));
    }
  }

  function initialize() {
    if (map) return;
    container = makeMapContainer();
    if (!container) return;
    const loc = currentLocation();
    map = new maptilersdk.Map({ container, style:mapStyleObject(baseStyle), center:[Number(loc.longitude),Number(loc.latitude)], zoom:7.4, attributionControl:true, navigationControl:false, terrainControl:false });
    window.StormLensMapV8 = api;
    map.on('error', mapErrorHandler);
    map.on('load', async () => {
      bindTimelineControls();
      bindQuickControls();
      ensureRangeBar();
      ensureLocationPin();
      injectSettings();
      await initializeProviders();
      renderLegend(defs[selected]);
      const initial = defs[selected]?.provider === 'tomorrow' && !tomorrowReady ? 'observedRadar' : selected;
      await selectLayer(initial,{quiet:true,force:true});
      ensureLocationPin();
      setInterval(syncLocation,1500);
      document.documentElement.dataset.mapEngine='v8';
      document.documentElement.dataset.mapRender='healthy';
      window.dispatchEvent(new CustomEvent('stormlens:v8-ready', { detail:{ map, tomorrow:tomorrowReady } }));
    });
    map.on('style.load', handleStyleLoad);
    map.on('click', event => showPickedValue(event.lngLat));
    map.on('mousemove', event => { if (active?.provider === 'maptiler' && !matchMedia('(pointer:coarse)').matches) showPickedValue(event.lngLat); });
    const screen = $('#mapScreen');
    if (screen && window.MutationObserver) {
      const observer = new MutationObserver(()=>{
        if (screen.classList.contains('active')) requestAnimationFrame(()=>requestAnimationFrame(()=>{try{map.resize();}catch(_){} ensureLocationPin();}));
      });
      observer.observe(screen,{attributes:true,attributeFilter:['class']});
    }
  }

  const api = {
    get map(){return map;},
    get selectedLayer(){return selected;},
    get activeProvider(){return active?.provider || null;},
    get tomorrowEnabled(){return tomorrowReady;},
    defs,
    selectLayer,
    setBaseMap,
    openLayers,
    stopPlayback,
    setTheme(choice){themeChoice=choice;localStorage.setItem(THEME_STORAGE,choice);applyTheme();}
  };

  window.StormLensPremiumOverlays = {
    get map(){return map;},
    selectLayer,
    toggleLayer(id,force){ if(force===false && selected===id)return; return selectLayer(id); },
    applyPreset(name){ return selectLayer(name==='storm' ? (tomorrowReady ? 'futureThunderstorms' : 'thunderRisk') : name==='winter' ? 'snowAccum' : name==='smoke' ? 'smoke' : 'observedRadar'); }
  };

  applyTheme();
  injectSettings();
  bindTimelineControls();
  bindQuickControls();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once:true });
  else initialize();
})();
