(() => {
  'use strict';

  const STORAGE = 'stormlens-weather-layer-v7';
  const SOURCE_ID = 'stormlens-tomorrow-source';
  const LAYER_ID = 'stormlens-tomorrow-layer';
  const HOUR = 60 * 60 * 1000;

  const TOMORROW = {
    extendedPrecip: {
      title:'Extended precipitation', category:'Precipitation', icon:'cloud-rain', provider:'tomorrow',
      field:'precipitationIntensity', hours:336, horizon:'Next 14 days', unit:'mm/h',
      description:'Extended global precipitation intensity from Tomorrow.io.'
    },
    futureThunderstorms: {
      title:'Thunderstorms · 14d', category:'Storms', icon:'cloud-lightning', provider:'tomorrow',
      field:'thunderstormProbability', hours:336, horizon:'Next 14 days', unit:'%',
      description:'Global thunderstorm probability out to two weeks.'
    },
    lightningForecast: {
      title:'Lightning forecast', category:'Storms', icon:'zap', provider:'tomorrow',
      field:'lightningFlashRateDensity', hours:90, horizon:'Next 90 hours', unit:'flashes/km²/5 min',
      description:'Forecast lightning flash-rate density. This is forecast activity, not detected strikes.'
    },
    extendedTemperature: {
      title:'Temperature · 14d', category:'Atmosphere', icon:'thermometer', provider:'tomorrow',
      field:'temperature', hours:336, horizon:'Next 14 days', unit:'°C',
      description:'Extended global temperature forecast.'
    },
    extendedHumidity: {
      title:'Humidity · 14d', category:'Atmosphere', icon:'waves', provider:'tomorrow',
      field:'humidity', hours:336, horizon:'Next 14 days', unit:'%',
      description:'Extended global relative-humidity forecast.'
    },
    extendedDewPoint: {
      title:'Dew point · 14d', category:'Atmosphere', icon:'droplet', provider:'tomorrow',
      field:'dewPoint', hours:336, horizon:'Next 14 days', unit:'°C',
      description:'Extended global dew-point forecast.'
    },
    extendedCloudCover: {
      title:'Cloud cover · 14d', category:'Atmosphere', icon:'cloud', provider:'tomorrow',
      field:'cloudCover', hours:336, horizon:'Next 14 days', unit:'%',
      description:'Extended total cloud-cover forecast.'
    },
    extendedVisibility: {
      title:'Visibility · 14d', category:'Atmosphere', icon:'eye', provider:'tomorrow',
      field:'visibility', hours:336, horizon:'Next 14 days', unit:'km',
      description:'Extended visibility forecast.'
    },
    extendedWindGust: {
      title:'Wind gusts · 14d', category:'Wind', icon:'wind', provider:'tomorrow',
      field:'windGust', hours:336, horizon:'Next 14 days', unit:'m/s',
      description:'Extended global wind-gust forecast.'
    },
    extendedSnow: {
      title:'Snow intensity · 14d', category:'Winter', icon:'snowflake', provider:'tomorrow',
      field:'snowIntensity', hours:336, horizon:'Next 14 days', unit:'mm/h',
      description:'Extended snowfall intensity forecast.'
    },
    extendedFreezingRain: {
      title:'Freezing rain · 14d', category:'Winter', icon:'cloud-hail', provider:'tomorrow',
      field:'freezingRainIntensity', hours:336, horizon:'Next 14 days', unit:'mm/h',
      description:'Extended freezing-rain intensity forecast.'
    }
  };

  let engine = null;
  let map = null;
  let enabled = false;
  let active = null;
  let times = [];
  let index = 0;
  let timer = null;
  let playing = false;
  let switchToken = 0;
  let originalSelect = null;
  let originalOpenLayers = null;
  let originalSetBaseMap = null;
  let originalSelectedGetter = null;
  let styleReapplyTimer = null;
  const probes = new Map();

  const $ = q => document.querySelector(q);
  const $$ = q => [...document.querySelectorAll(q)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const iso = date => new Date(date).toISOString().replace(/\.\d{3}Z$/, 'Z');

  function currentSettings() {
    try { return JSON.parse(localStorage.getItem('stormlens-settings') || '{}'); }
    catch (_) { return {}; }
  }

  function providerRow(text, state='loading') {
    const list = $('#settingsModal .settings-list');
    if (!list) return;
    let row = $('#tomorrowProviderRow');
    if (!row) {
      row = document.createElement('div');
      row.id = 'tomorrowProviderRow';
      row.className = 'setting-row';
      row.innerHTML = '<span><strong>Tomorrow.io</strong><small id="tomorrowProviderText">Checking…</small></span><span class="health-dot loading" id="tomorrowProviderDot"></span>';
      list.appendChild(row);
    }
    const label = $('#tomorrowProviderText');
    const dot = $('#tomorrowProviderDot');
    if (label) label.textContent = text;
    if (dot) dot.className = `health-dot ${state}`;
  }

  async function getProviderStatus() {
    try {
      const response = await fetch('/api/provider-status', { cache:'no-store' });
      if (!response.ok) return false;
      return Boolean((await response.json()).tomorrow);
    } catch (_) { return false; }
  }

  async function probe(field, force=false) {
    if (!force && probes.has(field)) return probes.get(field);
    try {
      const response = await fetch(`/api/tomorrow-probe?field=${encodeURIComponent(field)}`, { cache:'no-store' });
      const data = response.ok ? await response.json() : { available:false, reason:`http_${response.status}` };
      probes.set(field, data);
      return data;
    } catch (_) {
      const data = { available:false, reason:'probe_failed' };
      probes.set(field, data);
      return data;
    }
  }

  function firstLabelLayer() {
    const layers = map?.getStyle?.()?.layers || [];
    return layers.find(layer => layer.type === 'symbol' && layer.layout?.['text-field'])?.id;
  }

  function removeLayerAndSource() {
    if (!map) return;
    if (map.getLayer(LAYER_ID)) { try { map.removeLayer(LAYER_ID); } catch (_) {} }
    if (map.getSource(SOURCE_ID)) { try { map.removeSource(SOURCE_ID); } catch (_) {} }
  }

  function removeCoreWeather() {
    if (!map) return;
    engine?.stopPlayback?.();
    const layerIds = [
      'stormlens-radar','stormlens-precipitation','stormlens-temperature','stormlens-pressure','stormlens-wind',
      'stormlens-eccc-layer'
    ];
    layerIds.forEach(id => { if (map.getLayer(id)) { try { map.removeLayer(id); } catch (_) {} } });
    if (map.getSource('stormlens-eccc-source')) { try { map.removeSource('stormlens-eccc-source'); } catch (_) {} }
  }

  function stop() {
    playing = false;
    if (timer) clearTimeout(timer);
    timer = null;
    const button = $('#radarPlay');
    if (button) button.innerHTML = '<i data-lucide="play"></i>';
    if (window.lucide) requestAnimationFrame(() => window.lucide.createIcons());
  }

  function setStatus(text, state='live') {
    const label = $('#mapLayerStatus');
    const pill = $('#mapStatusPill');
    if (label) label.textContent = text;
    if (pill) {
      pill.dataset.state = state;
      pill.dataset.error = state === 'error' ? 'true' : 'false';
    }
  }

  function syncQuickButtons() {
    const quick = active?.id === 'futureThunderstorms' ? 'storms' : null;
    $$('#quickLayers [data-layer]').forEach(button => {
      const selected = Boolean(quick && button.dataset.layer === quick);
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function syncSheet() {
    if (!active) return;
    $$('[data-v7-weather]').forEach(row => row.classList.toggle('active', row.dataset.v7Weather === active.id));
    const name = $('#v7SelectedLayerName');
    if (name) name.textContent = active.def.title;
    const summary = $('.v6-selected-summary span:last-child');
    if (summary) summary.textContent = active.def.horizon;
  }

  function legendHtml(def) {
    if (def.field === 'thunderstormProbability') {
      return '<span><b class="legend-dot" style="background:#2563eb"></b>10%</span><span><b class="legend-dot" style="background:#22c55e"></b>40%</span><span><b class="legend-dot" style="background:#facc15"></b>55%</span><span><b class="legend-dot" style="background:#f97316"></b>70%</span><span><b class="legend-dot" style="background:#ef4444"></b>85%+</span>';
    }
    if (def.field === 'precipitationIntensity') {
      return '<span><b class="legend-dot" style="background:#60a5fa"></b>Light</span><span><b class="legend-dot" style="background:#22c55e"></b>Moderate</span><span><b class="legend-dot" style="background:#facc15"></b>Heavy</span><span><b class="legend-dot" style="background:#ef4444"></b>Very heavy</span>';
    }
    if (def.field === 'lightningFlashRateDensity') {
      return '<span class="v7-legend-text">Forecast lightning flash density · not observed strikes</span>';
    }
    return `<span class="v7-legend-text">${esc(def.title)} · ${esc(def.unit)}</span>`;
  }

  function renderTimeline() {
    if (!active) return;
    const def = active.def;
    const date = times[index];
    const range = $('#radarTimeline');
    if (range) {
      range.disabled = false;
      range.min = '0';
      range.max = String(Math.max(0, times.length - 1));
      range.step = '1';
      range.value = String(index);
    }
    const mode = $('#radarModeLabel');
    const stamp = $('#radarTimestamp');
    const left = $('#timelineStartLabel');
    const right = $('#timelineNowLabel');
    if (mode) mode.textContent = def.hours > 100 ? 'FORECAST · 14 DAYS' : `FORECAST · ${def.hours} HOURS`;
    if (stamp) stamp.textContent = date.toLocaleString(undefined, { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
    if (left) left.textContent = 'NOW';
    if (right) right.textContent = new Date(times[times.length - 1]).toLocaleDateString(undefined, { month:'short', day:'numeric' });
    const legend = $('#radarLegend');
    if (legend) legend.innerHTML = legendHtml(def);
    const source = $('#radarSourceLine');
    if (source) source.textContent = `${def.title} · Tomorrow.io Weather Maps · ${def.horizon}`;
  }

  function tileTemplate(def, date) {
    return `/api/tomorrow-tile?z={z}&x={x}&y={y}&field=${encodeURIComponent(def.field)}&time=${encodeURIComponent(iso(date))}`;
  }

  function addTomorrowSource(def, date) {
    removeLayerAndSource();
    map.addSource(SOURCE_ID, {
      type:'raster',
      tiles:[tileTemplate(def, date)],
      tileSize:256,
      minzoom:1,
      maxzoom:12,
      attribution:'Tomorrow.io'
    });
    const spec = {
      id:LAYER_ID,
      type:'raster',
      source:SOURCE_ID,
      paint:{
        'raster-opacity':Math.max(.30, Math.min(1, Number(currentSettings().radarOpacity || 78) / 100)),
        'raster-resampling':'linear',
        'raster-fade-duration':220
      }
    };
    const before = firstLabelLayer();
    if (before) map.addLayer(spec, before); else map.addLayer(spec);
  }

  function updateSource(date) {
    if (!active || !map) return;
    const source = map.getSource(SOURCE_ID);
    const tiles = [tileTemplate(active.def, date)];
    if (source?.setTiles) source.setTiles(tiles);
    else addTomorrowSource(active.def, date);
    renderTimeline();
  }

  function buildTimes(def) {
    const start = Math.floor(Date.now() / HOUR) * HOUR;
    const count = Math.floor(def.hours) + 1;
    return Array.from({ length:count }, (_, i) => new Date(start + i * HOUR));
  }

  function reasonText(data) {
    if (data?.reason === 'not_entitled_or_invalid_key') return 'not available on this Tomorrow.io plan';
    if (data?.reason === 'rate_limited') return 'Tomorrow.io rate limit reached';
    if (data?.reason === 'not_configured') return 'Tomorrow.io key not configured';
    return 'Tomorrow.io layer unavailable';
  }

  async function activateTomorrow(id, { quiet=false, reapply=false }={}) {
    const def = TOMORROW[id];
    if (!enabled || !def || !map) return false;
    const token = ++switchToken;
    stop();
    setStatus(`${def.title} · checking`, 'loading');

    const capability = await probe(def.field);
    if (token !== switchToken) return false;
    if (!capability.available) {
      setStatus(`${def.title} · ${reasonText(capability)}`, 'error');
      providerRow(`Connected · ${reasonText(capability)}`, capability.reason === 'rate_limited' ? 'loading' : 'error');
      return false;
    }

    removeCoreWeather();
    active = { id, def };
    localStorage.setItem(STORAGE, id);
    times = buildTimes(def);
    index = reapply ? Math.min(index, times.length - 1) : 0;
    addTomorrowSource(def, times[index]);
    renderTimeline();
    syncQuickButtons();
    syncSheet();
    setStatus(`${def.title} · LIVE`, 'live');
    providerRow('Connected · Weather Maps ready', 'live');
    window.dispatchEvent(new CustomEvent('stormlens:weather-layer-changed', { detail:{ id, def } }));
    if (!quiet) {
      const modal = $('#layersModal');
      if (modal) modal.hidden = true;
    }
    return true;
  }

  function deactivateTomorrow() {
    if (!active) return;
    ++switchToken;
    stop();
    removeLayerAndSource();
    active = null;
    times = [];
    index = 0;
  }

  function step(direction) {
    if (!active || !times.length) return;
    stop();
    index = Math.max(0, Math.min(times.length - 1, index + direction));
    updateSource(times[index]);
  }

  function playTick() {
    if (!playing || !active || !times.length) return;
    const jump = active.def.hours > 100 ? 3 : 1;
    index += jump;
    if (index >= times.length) index = 0;
    updateSource(times[index]);
    const delay = Math.max(850, Number(currentSettings().radarSpeed || 650));
    timer = setTimeout(playTick, delay);
  }

  function togglePlay() {
    if (!active) return;
    if (playing) return stop();
    playing = true;
    const button = $('#radarPlay');
    if (button) button.innerHTML = '<i data-lucide="pause"></i>';
    if (window.lucide) requestAnimationFrame(() => window.lucide.createIcons());
    playTick();
  }

  function syncFromSlider() {
    if (!active || !times.length) return;
    const range = $('#radarTimeline');
    index = Math.max(0, Math.min(times.length - 1, Number(range?.value || 0)));
    updateSource(times[index]);
  }

  function installEventOwnership() {
    document.addEventListener('input', event => {
      if (!active || event.target?.id !== 'radarTimeline') return;
      event.preventDefault(); event.stopImmediatePropagation(); stop(); syncFromSlider();
    }, true);

    document.addEventListener('change', event => {
      if (!active) return;
      if (event.target?.id === 'radarTimeline') {
        event.preventDefault(); event.stopImmediatePropagation(); syncFromSlider();
        return;
      }
      if (event.target?.id === 'stormlensMapStyleSelect') {
        event.stopImmediatePropagation();
        originalSetBaseMap?.(event.target.value);
      }
    }, true);

    document.addEventListener('click', event => {
      if (!active) return;
      const target = event.target;
      if (target?.closest?.('#radarPlay')) {
        event.preventDefault(); event.stopImmediatePropagation(); togglePlay(); return;
      }
      if (target?.closest?.('#radarStepBack')) {
        event.preventDefault(); event.stopImmediatePropagation(); step(-1); return;
      }
      if (target?.closest?.('#radarStepForward')) {
        event.preventDefault(); event.stopImmediatePropagation(); step(1); return;
      }
      const mapType = target?.closest?.('[data-map-style]');
      if (mapType) {
        event.preventDefault(); event.stopImmediatePropagation(); originalSetBaseMap?.(mapType.dataset.mapStyle);
      }
    }, true);
  }

  function patchEngine() {
    if (!engine || engine.__stormlensTomorrowPatched) return;
    engine.__stormlensTomorrowPatched = true;
    Object.assign(engine.defs, TOMORROW);

    originalSelect = engine.selectLayer;
    originalOpenLayers = engine.openLayers;
    originalSetBaseMap = engine.setBaseMap;
    const descriptor = Object.getOwnPropertyDescriptor(engine, 'selectedLayer');
    originalSelectedGetter = descriptor?.get ? () => descriptor.get.call(engine) : () => null;

    engine.selectLayer = async (id, options={}) => {
      if (TOMORROW[id]) return activateTomorrow(id, options);
      deactivateTomorrow();
      return originalSelect(id, options);
    };
    engine.openLayers = (...args) => {
      const result = originalOpenLayers(...args);
      setTimeout(syncSheet, 0);
      return result;
    };
    Object.defineProperty(engine, 'selectedLayer', {
      configurable:true,
      enumerable:true,
      get:() => active?.id || originalSelectedGetter?.()
    });
    Object.defineProperty(engine, 'tomorrowEnabled', {
      configurable:true,
      enumerable:true,
      get:() => enabled
    });

    const premium = window.StormLensPremiumOverlays;
    if (premium) {
      premium.selectLayer = engine.selectLayer;
      premium.toggleLayer = (id, force) => {
        if (force === false && engine.selectedLayer === id) return;
        return engine.selectLayer(id);
      };
      premium.applyPreset = name => engine.selectLayer(
        name === 'storm' ? 'futureThunderstorms' : name === 'winter' ? 'extendedSnow' : name === 'smoke' ? 'smoke' : 'observedRadar'
      );
    }

    map.on('style.load', () => {
      if (!active) return;
      clearTimeout(styleReapplyTimer);
      const id = active.id;
      styleReapplyTimer = setTimeout(() => activateTomorrow(id, { quiet:true, reapply:true }), 220);
    });

    installEventOwnership();
  }

  async function initialize() {
    for (let tries=0; tries<120 && !window.StormLensMapV7?.map; tries++) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    engine = window.StormLensMapV7;
    map = engine?.map;
    if (!engine || !map) return;

    providerRow('Checking server key…', 'loading');
    const hasKey = await getProviderStatus();
    if (!hasKey) {
      providerRow('Not configured in this deployment', 'error');
      return;
    }

    const core = await probe('thunderstormProbability', true);
    if (!core.available) {
      providerRow(`Key detected · ${reasonText(core)}`, core.reason === 'rate_limited' ? 'loading' : 'error');
      return;
    }

    enabled = true;
    providerRow('Connected · Weather Maps ready', 'live');
    patchEngine();

    const stored = localStorage.getItem(STORAGE);
    if (TOMORROW[stored]) {
      const start = () => setTimeout(() => engine.selectLayer(stored, { quiet:true }), 220);
      if (map.loaded?.()) start(); else map.once('load', start);
    }

    window.dispatchEvent(new CustomEvent('stormlens:tomorrow-ready', { detail:{ layers:Object.keys(TOMORROW) } }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once:true });
  else initialize();
})();
