(() => {
  const DEFAULT_LOCATION = {
    name: 'Calgary', admin1: 'Alberta', country: 'Canada', countryCode: 'CA', provinceCode: 'AB',
    latitude: 51.0447, longitude: -114.0719, timezone: 'America/Edmonton', source: 'default'
  };
  const OLD_DEFAULT = { latitude: 55.1707, longitude: -118.7884 };

  function migrateDefaultLocation() {
    const stored = JSON.parse(localStorage.getItem('stormlens-location') || 'null');
    const hasMigration = localStorage.getItem('stormlens-calgary-default-v2') === '1';
    if (!stored) return DEFAULT_LOCATION;
    const wasOldDefault = Math.abs(stored.latitude - OLD_DEFAULT.latitude) < .01 && Math.abs(stored.longitude - OLD_DEFAULT.longitude) < .01;
    if (!hasMigration && wasOldDefault) return DEFAULT_LOCATION;
    return stored;
  }

  function migrateSavedLocations() {
    const stored = JSON.parse(localStorage.getItem('stormlens-saved') || 'null');
    if (!stored?.length) return [DEFAULT_LOCATION];
    const hasMigration = localStorage.getItem('stormlens-calgary-default-v2') === '1';
    if (!hasMigration && stored.length === 1 && Math.abs(stored[0].latitude - OLD_DEFAULT.latitude) < .01 && Math.abs(stored[0].longitude - OLD_DEFAULT.longitude) < .01) return [DEFAULT_LOCATION];
    if (!stored.some(x => Math.abs(x.latitude - DEFAULT_LOCATION.latitude) < .01 && Math.abs(x.longitude - DEFAULT_LOCATION.longitude) < .01)) return [DEFAULT_LOCATION, ...stored];
    return stored;
  }

  const state = {
    location: migrateDefaultLocation(),
    savedLocations: migrateSavedLocations(),
    settings: Object.assign({ tempUnit: 'celsius', windUnit: 'kmh', radarOpacity: 78, radarSpeed: 650 }, JSON.parse(localStorage.getItem('stormlens-settings') || '{}')),
    weather: null,
    airQuality: null,
    alerts: [],
    fetchedAt: null,
    alertsFetchedAt: null,
    map: null,
    baseLayer: null,
    weatherLayer: null,
    alertsLayer: null,
    localAlertGeoLayer: null,
    activeMapLayer: 'radar',
    alertsEnabled: false,
    radarTimes: [],
    radarIndex: 0,
    radarTimer: null,
    selectedModel: 'auto',
    modelData: null,
    searchTimer: null,
    locating: false,
    installPrompt: null
  };
  localStorage.setItem('stormlens-calgary-default-v2', '1');
  localStorage.setItem('stormlens-location', JSON.stringify(state.location));
  localStorage.setItem('stormlens-saved', JSON.stringify(state.savedLocations));

  const WMS = 'https://geo.weather.gc.ca/geomet?';
  const ALERTS_API = 'https://api.weather.gc.ca/collections/weather-alerts/items';
  const LAYERS = {
    radar: { id: 'RADAR_1KM_RRAI', label: 'Observed radar', mode: 'OBSERVED RADAR', style: 'RADARURPPRECIPR14-LINEAR' },
    nowcast: { id: 'Radar_1km_RainPrecipRate-Extrapolation', label: 'Radar nowcast', mode: 'RADAR NOWCAST', style: 'RADARURPPRECIPR14-LINEAR' },
    futureprecip: { id: 'HRDPS.CONTINENTAL_RT', label: 'Future precipitation · 48h', mode: 'FORECAST PRECIPITATION' },
    preciptype: { id: 'Radar_1km_SfcPrecipType', label: 'Precipitation type', mode: 'PRECIPITATION TYPE' },
    precipprob: { id: 'HRDPS-WEonG_2.5km_Precip-Prob', label: 'Precipitation probability', mode: 'FORECAST PROBABILITY' },
    temperature: { id: 'HRDPS-WEonG_2.5km_AirTemp', label: 'Temperature', mode: 'FORECAST TEMPERATURE' },
    windgust: { id: 'HRDPS-WEonG_2.5km_WindGust', label: 'Wind gust', mode: 'FORECAST WIND GUSTS' },
    lightning: { id: 'Lightning_2.5km_Density', label: 'Lightning density', mode: 'LIGHTNING DENSITY', style: 'Lightning' },
    storms: { id: 'HRDPS-WEonG_2.5km_Thunderstorm-Prob', label: 'Thunderstorm probability', mode: 'THUNDERSTORM FORECAST' }
  };

  const MODEL_ENDPOINTS = {
    auto: 'https://api.open-meteo.com/v1/forecast',
    gem: 'https://api.open-meteo.com/v1/gem',
    gfs: 'https://api.open-meteo.com/v1/gfs',
    ecmwf: 'https://api.open-meteo.com/v1/ecmwf',
    icon: 'https://api.open-meteo.com/v1/dwd-icon'
  };

  const modelLabels = { auto: 'Best Match', gem: 'GEM Canada', gfs: 'GFS', ecmwf: 'ECMWF', icon: 'ICON' };

  function init() {
    bindNavigation();
    bindModals();
    bindSearch();
    bindSettings();
    updateHeader();
    syncSettingsUI();
    renderSavedLocations();
    updateLocationPermissionStatus();
    bindInstallPrompt();
    loadWeather();
    registerServiceWorker();
    refreshIcons();
    if (!localStorage.getItem('stormlens-location-choice-v1')) {
      setTimeout(() => openModal('locationPermissionModal'), 550);
    }
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
  }


  function bindInstallPrompt() {
    const btn = $('#installAppBtn');
    const status = $('#installAppStatus');
    if (!btn || !status) return;
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;
    if (standalone) {
      status.textContent = 'Installed';
      btn.textContent = 'Installed';
      btn.disabled = true;
    } else {
      status.textContent = 'Ready when Chrome offers install';
    }

    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      state.installPrompt = event;
      status.textContent = 'Ready to install';
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="download"></i> Install';
      refreshIcons();
    });

    btn.addEventListener('click', async () => {
      if (!state.installPrompt) {
        toast('In Chrome, open the ⋮ menu and choose Add to Home screen or Install app.');
        return;
      }
      state.installPrompt.prompt();
      await state.installPrompt.userChoice.catch(() => null);
      state.installPrompt = null;
    });

    window.addEventListener('appinstalled', () => {
      status.textContent = 'Installed';
      btn.textContent = 'Installed';
      btn.disabled = true;
      state.installPrompt = null;
      toast('StormLens installed.');
    });
  }

  function refreshIcons() {
    if (window.lucide) requestAnimationFrame(() => lucide.createIcons());
  }

  function bindNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => switchScreen(btn.dataset.target)));
  }

  function switchScreen(target) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.dataset.screen === target));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.target === target));
    if (target === 'map') {
      setTimeout(() => {
        initMap();
        state.map && state.map.invalidateSize();
      }, 80);
    }
    if (target === 'forecast') renderForecast();
    if (target === 'storms') renderStorms();
    refreshIcons();
  }

  function bindModals() {
    $('#locationSearchBtn').addEventListener('click', () => openModal('searchModal'));
    $('#locationMenuBtn').addEventListener('click', () => openModal('locationsModal'));
    $('#settingsBtn').addEventListener('click', () => openModal('settingsModal'));
    $('#addLocationBtn').addEventListener('click', () => { closeModal('locationsModal'); openModal('searchModal'); });
    document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', () => closeModal(btn.dataset.close)));
    document.querySelectorAll('.modal-backdrop').forEach(modal => modal.addEventListener('click', e => {
      if (e.target === modal && !modal.dataset.locked) closeModal(modal.id);
    }));
    document.querySelector('[data-default-location]').addEventListener('click', () => selectLocation(DEFAULT_LOCATION, true));
    $('#allowLocationBtn')?.addEventListener('click', () => {
      localStorage.setItem('stormlens-location-choice-v1', 'asked');
      useGeolocation({ closePermissionModal: true });
    });
    $('#keepCalgaryBtn')?.addEventListener('click', () => {
      localStorage.setItem('stormlens-location-choice-v1', 'calgary');
      closeModal('locationPermissionModal');
      selectLocation(DEFAULT_LOCATION, true);
    });
    $('#settingsLocationBtn')?.addEventListener('click', () => useGeolocation());
    $('#alertDetailClose')?.addEventListener('click', () => closeModal('alertDetailModal'));
  }

  function openModal(id) { const el = $('#' + id); el.hidden = false; refreshIcons(); if (id === 'searchModal') setTimeout(() => $('#locationSearchInput').focus(), 150); }
  function closeModal(id) { $('#' + id).hidden = true; }

  function bindSearch() {
    $('#locationSearchInput').addEventListener('input', e => {
      clearTimeout(state.searchTimer);
      const q = e.target.value.trim();
      if (q.length < 2) return;
      state.searchTimer = setTimeout(() => searchLocations(q), 260);
    });
    $('#useMyLocationBtn').addEventListener('click', () => useGeolocation());
  }

  async function searchLocations(query) {
    const box = $('#searchResults');
    box.innerHTML = '<div class="search-result"><span class="result-icon"><i data-lucide="loader-circle"></i></span><span><strong>Searching…</strong><small>Open-Meteo geocoding</small></span></div>';
    refreshIcons();
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=en&format=json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      const results = data.results || [];
      if (!results.length) { box.innerHTML = '<div class="search-result"><span><strong>No locations found</strong><small>Try another spelling</small></span></div>'; return; }
      box.innerHTML = results.map((r, i) => `
        <button class="search-result" data-result-index="${i}">
          <span class="result-icon"><i data-lucide="map-pin"></i></span>
          <span><strong>${escapeHtml(r.name)}</strong><small>${escapeHtml([r.admin1, r.country].filter(Boolean).join(', '))}</small></span>
        </button>`).join('');
      box.querySelectorAll('[data-result-index]').forEach(btn => btn.addEventListener('click', () => {
        const r = results[Number(btn.dataset.resultIndex)];
        selectLocation({
          name:r.name, admin1:r.admin1 || '', country:r.country || '', countryCode:r.country_code || '',
          provinceCode: provinceCodeFromName(r.admin1 || ''), latitude:r.latitude, longitude:r.longitude,
          timezone:r.timezone || 'auto', source:'search'
        }, true);
      }));
      refreshIcons();
    } catch (err) {
      box.innerHTML = `<div class="error-card"><h3>Search unavailable</h3><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  function useGeolocation(options = {}) {
    if (!navigator.geolocation) return toast('Location services are not supported by this browser.');
    if (state.locating) return;
    state.locating = true;
    const btn = $('#allowLocationBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-circle"></i> Finding you…'; refreshIcons(); }
    toast('Requesting precise location…');

    navigator.geolocation.getCurrentPosition(async pos => {
      const loc = {
        name:'Current location', admin1:'', country:'', countryCode:'', provinceCode:'',
        latitude:pos.coords.latitude, longitude:pos.coords.longitude, timezone:'auto',
        source:'device', accuracy:Math.round(pos.coords.accuracy || 0)
      };
      try {
        // BigDataCloud's free client-side reverse geocoder is designed for the device's own consented coordinates.
        const params = new URLSearchParams({
          latitude: loc.latitude, longitude: loc.longitude, localityLanguage:'en'
        });
        const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`);
        if (res.ok) {
          const d = await res.json();
          loc.name = d.city || d.locality || d.principalSubdivision || loc.name;
          loc.admin1 = d.principalSubdivision || '';
          loc.country = d.countryName || '';
          loc.countryCode = d.countryCode || '';
          loc.provinceCode = provinceCodeFromName(loc.admin1);
        }
      } catch (_) {}

      localStorage.setItem('stormlens-location-choice-v1', 'device');
      if (options.closePermissionModal) closeModal('locationPermissionModal');
      selectLocation(loc, false);
      updateLocationPermissionStatus('granted');
      state.locating = false;
      resetLocationButton();
      toast(`Using ${loc.name}.`);
    }, err => {
      state.locating = false;
      resetLocationButton();
      updateLocationPermissionStatus(err.code === 1 ? 'denied' : 'unavailable');
      if (options.closePermissionModal && err.code !== 1) closeModal('locationPermissionModal');
      const message = err.code === 1
        ? 'Location permission was denied. You can enable it in Chrome site settings at any time.'
        : 'Could not get your location. Calgary will stay selected.';
      toast(message);
    }, { enableHighAccuracy:true, timeout:15000, maximumAge:120000 });
  }

  function resetLocationButton() {
    const btn = $('#allowLocationBtn');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="locate-fixed"></i> Use my location'; refreshIcons(); }
  }

  async function updateLocationPermissionStatus(forced) {
    const label = $('#locationPermissionStatus');
    let status = forced || 'prompt';
    try {
      if (!forced && navigator.permissions?.query) status = (await navigator.permissions.query({ name:'geolocation' })).state;
    } catch (_) {}
    if (!label) return;
    const messages = {
      granted: state.location.source === 'device' ? `On · ${state.location.name}` : 'Allowed',
      denied: 'Blocked in browser settings',
      unavailable: 'Unavailable',
      prompt: 'Not requested yet'
    };
    label.textContent = messages[status] || 'Not requested yet';
  }

  function selectLocation(loc, save) {
    state.location = loc;
    state.airQuality = null;
    state.alerts = [];
    state.modelData = null;
    localStorage.setItem('stormlens-location', JSON.stringify(loc));
    if (save && !state.savedLocations.some(x => Math.abs(x.latitude-loc.latitude)<.001 && Math.abs(x.longitude-loc.longitude)<.001)) {
      state.savedLocations.unshift(loc);
      localStorage.setItem('stormlens-saved', JSON.stringify(state.savedLocations));
    }
    closeModal('searchModal'); closeModal('locationsModal');
    updateHeader(); renderSavedLocations(); updateLocationPermissionStatus();
    if (state.map) {
      state.map.setView([loc.latitude, loc.longitude], 8);
      addUserMarker();
      if (state.alertsEnabled) renderLocalAlertPolygons();
    }
    loadWeather();
  }

  function updateHeader() {
    $('#headerLocation').textContent = state.location.name;
    $('#headerRegion').textContent = [state.location.admin1, state.location.country].filter(Boolean).join(', ') || 'Current location';
  }

  function renderSavedLocations() {
    const box = $('#savedLocationsList');
    box.innerHTML = state.savedLocations.map((loc, i) => `
      <button class="saved-location-row" data-saved-index="${i}">
        <span class="saved-location-main"><span class="result-icon"><i data-lucide="map-pin"></i></span><span><strong>${escapeHtml(loc.name)}</strong><small>${escapeHtml([loc.admin1,loc.country].filter(Boolean).join(', '))}</small></span></span>
        <span class="saved-temp"><i data-lucide="chevron-right"></i></span>
      </button>`).join('');
    box.querySelectorAll('[data-saved-index]').forEach(btn => btn.addEventListener('click', () => selectLocation(state.savedLocations[Number(btn.dataset.savedIndex)], false)));
    refreshIcons();
  }

  function bindSettings() {
    $('#tempUnit').addEventListener('change', e => { state.settings.tempUnit = e.target.value; saveSettings(); loadWeather(); });
    $('#windUnit').addEventListener('change', e => { state.settings.windUnit = e.target.value; saveSettings(); loadWeather(); });
    $('#radarOpacity').addEventListener('input', e => { state.settings.radarOpacity = Number(e.target.value); saveSettings(); if (state.weatherLayer) state.weatherLayer.setOpacity(state.settings.radarOpacity/100); });
    $('#radarSpeed').addEventListener('change', e => { state.settings.radarSpeed = Number(e.target.value); saveSettings(); if (state.radarTimer) { stopRadar(); playRadar(); } });
  }

  function syncSettingsUI() {
    $('#tempUnit').value = state.settings.tempUnit;
    $('#windUnit').value = state.settings.windUnit;
    $('#radarOpacity').value = state.settings.radarOpacity;
    $('#radarSpeed').value = state.settings.radarSpeed;
  }
  function saveSettings() { localStorage.setItem('stormlens-settings', JSON.stringify(state.settings)); }

  async function loadWeather() {
    const home = $('#homeContent');
    home.classList.add('loading-state');
    if (!state.weather) home.innerHTML = '<div class="skeleton hero-skeleton"></div><div class="skeleton card-skeleton"></div><div class="skeleton card-skeleton"></div>';

    const { latitude, longitude } = state.location;
    const params = new URLSearchParams({
      latitude, longitude, timezone:'auto', forecast_days:'16',
      temperature_unit: state.settings.tempUnit,
      wind_speed_unit: state.settings.windUnit,
      current:'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,snowfall,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,dew_point_2m,visibility',
      hourly:'temperature_2m,apparent_temperature,precipitation_probability,precipitation,rain,snowfall,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,relative_humidity_2m,dew_point_2m,pressure_msl,cloud_cover,cape,visibility',
      daily:'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,rain_sum,snowfall_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,sunrise,sunset,uv_index_max'
    });

    try {
      const forecastPromise = fetch(`https://api.open-meteo.com/v1/forecast?${params}`).then(async res => {
        if (!res.ok) throw new Error(`Forecast service returned ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.reason || 'Forecast error');
        return data;
      });

      const [forecastResult, airResult, alertResult] = await Promise.allSettled([
        forecastPromise,
        loadAirQuality(latitude, longitude),
        loadAlerts()
      ]);

      if (forecastResult.status !== 'fulfilled') throw forecastResult.reason;
      state.weather = forecastResult.value;
      state.fetchedAt = new Date();

      if (airResult.status === 'fulfilled') state.airQuality = airResult.value;
      if (alertResult.status === 'fulfilled') {
        state.alerts = alertResult.value;
        state.alertsFetchedAt = new Date();
      }

      localStorage.setItem('stormlens-weather-cache', JSON.stringify({
        data: state.weather,
        airQuality: state.airQuality,
        alerts: state.alerts,
        location:state.location,
        fetchedAt:state.fetchedAt.toISOString()
      }));

      renderHome(); renderForecast(); renderStorms();
      if (state.map && state.alertsEnabled) renderLocalAlertPolygons();
    } catch (err) {
      const cache = JSON.parse(localStorage.getItem('stormlens-weather-cache') || 'null');
      if (cache?.data && cache?.location && Math.abs(cache.location.latitude-state.location.latitude)<.01 && Math.abs(cache.location.longitude-state.location.longitude)<.01) {
        state.weather = cache.data;
        state.airQuality = cache.airQuality || null;
        state.alerts = cache.alerts || [];
        state.fetchedAt = new Date(cache.fetchedAt);
        renderHome(); renderForecast(); renderStorms();
        toast('Live update failed. Showing cached weather.');
      } else {
        home.innerHTML = `<div class="error-card" style="margin-top:20px"><h3>Weather could not load</h3><p>${escapeHtml(err.message)}. Check your connection and try again.</p><button id="retryWeather">Try again</button></div>`;
        $('#retryWeather')?.addEventListener('click', loadWeather);
      }
    } finally {
      home.classList.remove('loading-state');
      refreshIcons();
    }
  }

  async function loadAirQuality(latitude, longitude) {
    const params = new URLSearchParams({
      latitude, longitude, timezone:'auto',
      current:'us_aqi,pm2_5,pm10,ozone'
    });
    const res = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`);
    if (!res.ok) throw new Error(`Air quality service returned ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.reason || 'Air quality error');
    return data;
  }

  async function loadAlerts() {
    const province = state.location.provinceCode || provinceCodeFromName(state.location.admin1 || '');
    const isCanada = (state.location.countryCode || '').toUpperCase() === 'CA' || /canada/i.test(state.location.country || '');
    if (!isCanada || !province) return [];

    const params = new URLSearchParams({
      f:'json',
      limit:'100',
      filter:`properties.province=${province}`
    });
    const res = await fetch(`${ALERTS_API}?${params}`);
    if (!res.ok) throw new Error(`ECCC alerts returned ${res.status}`);
    const data = await res.json();
    const features = data.features || [];
    const point = [Number(state.location.longitude), Number(state.location.latitude)];
    const local = features.filter(feature => geometryContainsPoint(feature.geometry, point));
    if (local.length) return local;

    // Some alert products can be area-named without a usable polygon. Keep only obvious local-name matches as a conservative fallback.
    const needle = String(state.location.name || '').toLowerCase();
    return features.filter(feature => needle.length > 2 && String(feature.properties?.feature_name_en || '').toLowerCase().includes(needle));
  }

  function renderActiveAlerts() {
    if (!state.alerts?.length) return '';
    const alerts = state.alerts.slice(0, 4);
    return `<section class="active-alerts">
      <div class="section-kicker"><span class="eyebrow">OFFICIAL ECCC ALERTS</span><span>${alerts.length}</span></div>
      ${alerts.map((feature, i) => {
        const p = feature.properties || {};
        const level = alertRiskClass(p);
        const title = p.alert_name_en || p.alert_short_name_en || 'Weather alert';
        const area = p.feature_name_en || state.location.name;
        const expires = p.expiration_datetime || p.event_end_datetime;
        return `<button class="alert-card alert-${level}" data-alert-index="${i}">
          <span class="alert-icon"><i data-lucide="triangle-alert"></i></span>
          <span class="alert-copy"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(area)}${expires ? ` · until ${escapeHtml(formatAlertTime(expires))}` : ''}</small></span>
          <i data-lucide="chevron-right"></i>
        </button>`;
      }).join('')}
    </section>`;
  }

  function bindAlertCards(root = document) {
    root.querySelectorAll('[data-alert-index]').forEach(btn => btn.addEventListener('click', () => {
      const feature = state.alerts[Number(btn.dataset.alertIndex)];
      if (feature) showAlertDetail(feature);
    }));
  }

  function showAlertDetail(feature) {
    const p = feature.properties || {};
    const title = p.alert_name_en || p.alert_short_name_en || 'Weather alert';
    const area = p.feature_name_en || state.location.name;
    const timing = [p.publication_datetime && `Issued ${formatAlertTime(p.publication_datetime)}`, (p.expiration_datetime || p.event_end_datetime) && `Ends ${formatAlertTime(p.expiration_datetime || p.event_end_datetime)}`].filter(Boolean).join(' · ');
    $('#alertDetailContent').innerHTML = `
      <div class="alert-detail-severity alert-${alertRiskClass(p)}"><i data-lucide="triangle-alert"></i>${escapeHtml(p.alert_type || 'Alert')}</div>
      <h2>${escapeHtml(title)}</h2>
      <p class="alert-detail-area">${escapeHtml(area)}</p>
      ${timing ? `<p class="alert-detail-time">${escapeHtml(timing)}</p>` : ''}
      ${p.alert_text_en ? `<div class="alert-detail-text">${sanitizeAlertText(p.alert_text_en)}</div>` : '<p class="alert-detail-text">Full alert text is not available from this response.</p>'}
      <div class="alert-source-note">Source: Environment and Climate Change Canada</div>`;
    openModal('alertDetailModal');
    refreshIcons();
  }

  function sanitizeAlertText(text) {
    return escapeHtml(String(text || '')).replace(/\r?\n/g, '<br>');
  }

  function alertRiskClass(p = {}) {
    const risk = String(p.risk_colour_en || '').toLowerCase();
    const type = String(p.alert_type || '').toLowerCase();
    if (risk.includes('red') || type.includes('warning')) return 'warning';
    if (risk.includes('orange') || type.includes('watch')) return 'watch';
    if (risk.includes('yellow') || type.includes('advisory')) return 'advisory';
    return 'statement';
  }

  function formatAlertTime(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
  }

  function aqiLabel(value) {
    const v = Number(value);
    if (!Number.isFinite(v)) return 'Unavailable';
    if (v <= 50) return 'Good';
    if (v <= 100) return 'Moderate';
    if (v <= 150) return 'Unhealthy for sensitive groups';
    if (v <= 200) return 'Unhealthy';
    if (v <= 300) return 'Very unhealthy';
    return 'Hazardous';
  }

  function renderHome() {
    const w = state.weather; if (!w) return;
    const c = w.current, d = w.daily, h = w.hourly;
    const nowIdx = nearestTimeIndex(h.time, new Date());
    const cond = weatherCondition(c.weather_code, c.is_day);
    const precipInfo = buildPrecipSummary(nowIdx);
    const tempSymbol = state.settings.tempUnit === 'fahrenheit' ? '°F' : '°C';
    const windSymbol = ({kmh:'km/h', mph:'mph', kn:'kt', ms:'m/s'})[state.settings.windUnit];
    const updateMin = Math.max(0, Math.round((Date.now() - state.fetchedAt.getTime())/60000));

    $('#homeContent').innerHTML = `
      <div class="hero">
        <div class="hero-topline"><span class="eyebrow">CURRENT CONDITIONS</span><span class="update-badge"><b class="dot"></b>${updateMin === 0 ? 'Updated now' : `Updated ${updateMin}m ago`}</span></div>
        <div class="current-main">
          <div class="temp-block">
            <div class="current-temp">${round(c.temperature_2m)}<sup>°</sup></div>
            <div class="condition-line">${cond.label}</div>
            <div class="feels-line">Feels like ${round(c.apparent_temperature)}°</div>
            <div class="hilo"><strong>H ${round(d.temperature_2m_max[0])}°</strong><span>L ${round(d.temperature_2m_min[0])}°</span></div>
          </div>
          <div class="hero-icon"><i data-lucide="${cond.icon}"></i></div>
        </div>
        <p class="smart-summary">${escapeHtml(buildSmartSummary(nowIdx))}</p>
      </div>

      ${renderActiveAlerts()}

      <article class="panel card-pad">
        <div class="card-head"><div><span class="eyebrow">PRECIPITATION</span><h2>${precipInfo.title}</h2></div><div class="side-value"><strong>${h.precipitation_probability[nowIdx] ?? 0}%</strong><small>right now</small></div></div>
        <div class="precip-overview">
          <div class="precip-stat"><small>NEXT 6 HOURS</small><strong>${precipInfo.next6.toFixed(1)} mm</strong></div>
          <div class="precip-stat"><small>TODAY</small><strong>${(d.precipitation_sum[0] ?? 0).toFixed(1)} mm</strong></div>
        </div>
        ${renderPrecipBars(nowIdx)}
      </article>

      <article class="panel card-pad">
        <div class="card-head"><div><span class="eyebrow">NEXT 24 HOURS</span><h3>Hourly forecast</h3></div></div>
        <div class="hourly-strip">${renderHourlyItems(nowIdx)}</div>
      </article>

      <div class="metrics-grid">
        ${metricCard('droplets','Humidity',`${round(c.relative_humidity_2m)}%`,`Dew point ${round(c.dew_point_2m)}°`)}
        ${metricCard('wind','Wind',`${round(c.wind_speed_10m)} ${windSymbol}`,`Gusts ${round(c.wind_gusts_10m)} ${windSymbol}`)}
        ${metricCard('gauge','Pressure',`${round(c.pressure_msl)} hPa`, pressureTrend(nowIdx))}
        ${metricCard('eye','Visibility',formatVisibility(c.visibility),`${round(c.cloud_cover)}% cloud cover`)}
        ${metricCard('sun','UV index',`${round(d.uv_index_max?.[0] ?? 0)}`,uvLabel(d.uv_index_max?.[0] ?? 0))}
        ${metricCard('wind','Air quality',state.airQuality?.current?.us_aqi != null ? `${round(state.airQuality.current.us_aqi)} AQI` : '—',state.airQuality?.current?.us_aqi != null ? aqiLabel(state.airQuality.current.us_aqi) : 'Unavailable')}
        ${metricCard('sunrise','Sunrise',formatLocalTime(d.sunrise[0]),`Sunset ${formatLocalTime(d.sunset[0])}`)}
      </div>

      <div class="section-title"><div><span class="eyebrow">OUTLOOK</span><h2>Next 16 days</h2></div></div>
      <article class="panel card-pad daily-list">${renderDailyRows()}</article>
      <div style="height:10px"></div>`;
    bindAlertCards($('#homeContent'));
    refreshIcons();
  }

  function buildSmartSummary(nowIdx) {
    const h = state.weather.hourly;
    const upcoming = [];
    for (let i = nowIdx; i < Math.min(h.time.length, nowIdx + 18); i++) {
      if ((h.precipitation_probability[i] || 0) >= 55 || (h.precipitation[i] || 0) >= .5) upcoming.push(i);
    }
    const maxCape = Math.max(...(h.cape?.slice(nowIdx, nowIdx+18) || [0]).filter(Number.isFinite), 0);
    if (upcoming.length) {
      const first = upcoming[0], last = upcoming[upcoming.length-1];
      const thunder = maxCape > 700 || h.weather_code.slice(nowIdx, nowIdx+18).some(code => code >= 95);
      return `${thunder ? 'Thunderstorm potential' : 'Precipitation'} increases around ${formatHour(h.time[first])}${last > first ? ` and remains elevated through ${formatHour(h.time[last])}` : ''}. ${maxCape > 900 ? 'Convective instability is elevated.' : 'Check the radar before heading out.'}`;
    }
    return `No meaningful precipitation signal in the next several hours. Winds peak near ${round(Math.max(...h.wind_gusts_10m.slice(nowIdx, nowIdx+12)))} ${({kmh:'km/h',mph:'mph',kn:'kt',ms:'m/s'})[state.settings.windUnit]}.`;
  }

  function buildPrecipSummary(nowIdx) {
    const h = state.weather.hourly;
    let next6 = 0; for (let i=nowIdx;i<Math.min(nowIdx+6,h.precipitation.length);i++) next6 += h.precipitation[i] || 0;
    let first = -1;
    for (let i=nowIdx;i<Math.min(nowIdx+18,h.time.length);i++) if ((h.precipitation_probability[i]||0)>=50 && (h.precipitation[i]||0)>.1) { first=i; break; }
    return { next6, title: first >= 0 ? `Likely around ${formatHour(h.time[first])}` : 'Quiet for now' };
  }

  function renderPrecipBars(nowIdx) {
    const h=state.weather.hourly, vals=h.precipitation.slice(nowIdx,nowIdx+12), max=Math.max(.4,...vals);
    const bars=vals.map(v=>`<span class="precip-bar-wrap"><b class="precip-bar" style="height:${Math.max(3,(v/max)*100)}%"></b></span>`).join('');
    return `<div class="precip-bars">${bars}</div><div class="precip-ticks"><span>Now</span><span>+3h</span><span>+6h</span><span>+12h</span></div>`;
  }

  function renderHourlyItems(nowIdx) {
    const h=state.weather.hourly; let out='';
    for (let i=nowIdx;i<Math.min(nowIdx+24,h.time.length);i++) {
      const cond=weatherCondition(h.weather_code[i], true);
      out += `<div class="hour-item ${i===nowIdx?'now':''}"><div class="hour-time">${i===nowIdx?'NOW':formatHour(h.time[i])}</div><div class="hour-icon"><i data-lucide="${cond.icon}"></i></div><strong>${round(h.temperature_2m[i])}°</strong><div class="rain-chance"><i data-lucide="droplet"></i>${round(h.precipitation_probability[i]||0)}%</div></div>`;
    } return out;
  }

  function renderDailyRows() {
    const d=state.weather.daily; return d.time.map((t,i)=>{
      const cond=weatherCondition(d.weather_code[i],true); const date=new Date(t+'T12:00');
      return `<div class="day-row"><div class="day-name"><strong>${i===0?'Today':date.toLocaleDateString(undefined,{weekday:'short'})}</strong><small>${date.toLocaleDateString(undefined,{month:'short',day:'numeric'})}</small></div><div class="day-icon"><i data-lucide="${cond.icon}"></i></div><div class="day-precip">${round(d.precipitation_probability_max[i]||0)}% <span>${(d.precipitation_sum[i]||0).toFixed(1)} mm</span></div><div class="day-temps"><strong>${round(d.temperature_2m_max[i])}°</strong><span>${round(d.temperature_2m_min[i])}°</span></div></div>`;
    }).join('');
  }

  function metricCard(icon,label,value,sub) { return `<div class="metric-card"><div class="metric-icon"><i data-lucide="${icon}"></i></div><small>${label}</small><strong>${value}</strong><p>${sub}</p></div>`; }

  function renderForecast() {
    if (!state.weather) return;
    const box=$('#forecastContent');
    const h=state.weather.hourly, nowIdx=nearestTimeIndex(h.time,new Date());
    box.innerHTML = `
      <div class="section-title"><div><span class="eyebrow">FORECAST</span><h2>${escapeHtml(state.location.name)}</h2></div></div>
      <div class="tab-row"><button class="tab-btn active" data-forecast-tab="hourly">Hourly</button><button class="tab-btn" data-forecast-tab="daily">Daily</button><button class="tab-btn" data-forecast-tab="models">Models</button></div>
      <div id="forecastTabContent">${forecastHourlyPanel(nowIdx)}</div>`;
    box.querySelectorAll('[data-forecast-tab]').forEach(btn=>btn.addEventListener('click',()=>{
      box.querySelectorAll('[data-forecast-tab]').forEach(b=>b.classList.toggle('active',b===btn));
      const c=$('#forecastTabContent');
      c.innerHTML = btn.dataset.forecastTab==='hourly' ? forecastHourlyPanel(nowIdx) : btn.dataset.forecastTab==='daily' ? `<article class="panel card-pad daily-list" style="margin-top:14px">${renderDailyRows()}</article>` : forecastModelsPanel();
      if(btn.dataset.forecastTab==='models') bindModelPicker();
      refreshIcons();
    }));
    refreshIcons();
  }

  function forecastHourlyPanel(nowIdx) {
    return `<article class="panel chart-card" style="margin-top:14px"><div class="card-head"><div><span class="eyebrow">48 HOURS</span><h3>Temperature + precipitation</h3></div></div>${renderWeatherChart(nowIdx,48)}</article><article class="panel card-pad" style="margin-top:14px"><div class="hourly-strip">${renderHourlyItems(nowIdx)}</div></article>`;
  }

  function renderWeatherChart(start,count) {
    const h=state.weather.hourly, temps=h.temperature_2m.slice(start,start+count), rain=h.precipitation.slice(start,start+count), times=h.time.slice(start,start+count);
    const W=720,H=190,pad={l:8,r:8,t:18,b:24}, minT=Math.min(...temps)-2,maxT=Math.max(...temps)+2,maxR=Math.max(1,...rain);
    const x=i=>pad.l+(i/(temps.length-1))*(W-pad.l-pad.r), yT=v=>pad.t+(1-(v-minT)/(maxT-minT))*(H-pad.t-pad.b), yR=v=>H-pad.b-(v/maxR)*62;
    const tempPath=temps.map((v,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${yT(v).toFixed(1)}`).join(' ');
    let area=`M${x(0)},${H-pad.b} `; rain.forEach((v,i)=>area+=`L${x(i)},${yR(v)} `); area+=`L${x(rain.length-1)},${H-pad.b} Z`;
    const labels=[0,12,24,36,47].filter(i=>i<times.length).map(i=>`<text x="${x(i)}" y="${H-5}" class="chart-label" text-anchor="${i===0?'start':i===47?'end':'middle'}">${formatHour(times[i])}</text>`).join('');
    const grid=[.25,.5,.75].map(p=>`<line x1="0" x2="${W}" y1="${pad.t+p*(H-pad.t-pad.b)}" y2="${pad.t+p*(H-pad.t-pad.b)}"/>`).join('');
    return `<svg class="weather-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><g class="chart-grid">${grid}</g><path class="chart-rain" d="${area}"/><path class="chart-temp" d="${tempPath}"/>${labels}</svg>`;
  }

  function forecastModelsPanel() {
    return `<div style="margin-top:14px"><div class="model-picker">${Object.keys(MODEL_ENDPOINTS).map(k=>`<button class="model-chip ${k===state.selectedModel?'active':''}" data-model="${k}">${modelLabels[k]}</button>`).join('')}</div><article class="panel card-pad" id="modelPanel"><div class="card-head"><div><span class="eyebrow">MODEL VIEW</span><h3>${modelLabels[state.selectedModel]}</h3></div></div><div id="modelPanelContent">${state.modelData ? renderModelData(state.modelData) : '<p style="color:var(--muted);font-size:12px">Choose a model to compare its next 24 hours.</p>'}</div></article></div>`;
  }

  function bindModelPicker() {
    document.querySelectorAll('[data-model]').forEach(btn=>btn.addEventListener('click',()=>{
      state.selectedModel=btn.dataset.model;
      document.querySelectorAll('[data-model]').forEach(b=>b.classList.toggle('active',b===btn));
      loadModelData(state.selectedModel);
    }));
    if(!state.modelData) loadModelData(state.selectedModel);
  }

  async function loadModelData(model) {
    const content=$('#modelPanelContent'); if(!content) return;
    content.innerHTML='<p style="color:var(--muted);font-size:12px">Loading model…</p>';
    const {latitude,longitude}=state.location;
    const params=new URLSearchParams({latitude,longitude,timezone:'auto',forecast_days:'7',temperature_unit:state.settings.tempUnit,wind_speed_unit:state.settings.windUnit,hourly:'temperature_2m,precipitation,wind_speed_10m,pressure_msl,cloud_cover'});
    try {
      const res=await fetch(`${MODEL_ENDPOINTS[model]}?${params}`); if(!res.ok) throw new Error(`Model returned ${res.status}`); const d=await res.json(); if(d.error) throw new Error(d.reason);
      state.modelData=d; content.innerHTML=renderModelData(d); refreshIcons();
    } catch(err) { content.innerHTML=`<div class="error-card"><h3>Model unavailable</h3><p>${escapeHtml(err.message)}</p></div>`; }
  }

  function renderModelData(d) {
    const h=d.hourly, idx=nearestTimeIndex(h.time,new Date()), p24=sum(h.precipitation.slice(idx,idx+24)), maxW=Math.max(...h.wind_speed_10m.slice(idx,idx+24)), tempEnd=h.temperature_2m[Math.min(idx+12,h.temperature_2m.length-1)];
    return `<div class="model-summary"><div class="model-stat"><small>12H TEMP</small><strong>${round(tempEnd)}°</strong></div><div class="model-stat"><small>24H PRECIP</small><strong>${p24.toFixed(1)} mm</strong></div><div class="model-stat"><small>MAX WIND</small><strong>${round(maxW)}</strong></div></div><div style="margin-top:14px">${renderMiniModelChart(h,idx)}</div>`;
  }

  function renderMiniModelChart(h,start) {
    const vals=h.temperature_2m.slice(start,start+36),W=650,H=120,min=Math.min(...vals)-1,max=Math.max(...vals)+1,x=i=>6+(i/(vals.length-1))*(W-12),y=v=>8+(1-(v-min)/(max-min))*(H-20); const p=vals.map((v,i)=>`${i?'L':'M'}${x(i)},${y(v)}`).join(' '); return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:120px"><path d="${p}" fill="none" stroke="#9ed0ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function renderStorms() {
    if(!state.weather)return;
    const h=state.weather.hourly;
    const idx=nearestTimeIndex(h.time,new Date());
    const cape=Math.max(...(h.cape?.slice(idx,idx+12)||[0]).filter(Number.isFinite),0);
    const pop=Math.max(...h.precipitation_probability.slice(idx,idx+12));
    const gust=Math.max(...h.wind_gusts_10m.slice(idx,idx+12));
    const codes=h.weather_code.slice(idx,idx+12);
    const risk=stormRisk(cape,pop,codes);
    const officialCount = state.alerts?.length || 0;

    $('#stormsContent').innerHTML=`
      <div class="section-title"><div><span class="eyebrow">CONVECTIVE WEATHER</span><h2>Storms near you</h2></div></div>
      ${officialCount ? `<div class="storm-alert-banner"><i data-lucide="triangle-alert"></i><div><strong>${officialCount} official alert${officialCount===1?'':'s'} for ${escapeHtml(state.location.name)}</strong><small>Environment and Climate Change Canada</small></div></div>` : ''}
      <div class="storm-hero">
        <span class="storm-status"><b class="status-dot"></b>FORECAST SIGNAL</span>
        <h1>${risk.headline}</h1><p>${risk.summary}</p>
        <div class="storm-action-row">
          <button class="primary-button" id="openStormMap"><i data-lucide="radar"></i> Storm radar</button>
          <button class="secondary-action-button" id="openLightningMap"><i data-lucide="zap"></i> Lightning</button>
        </div>
      </div>
      <div class="storm-grid">
        ${stormMetric('activity','CAPE',`${round(cape)} J/kg`)}
        ${stormMetric('cloud-rain','Rain chance',`${round(pop)}%`)}
        ${stormMetric('wind','Peak gust',`${round(gust)} ${({kmh:'km/h',mph:'mph',kn:'kt',ms:'m/s'})[state.settings.windUnit]}`)}
        ${stormMetric('triangle-alert','Official alerts',`${officialCount}`)}
      </div>
      <div class="section-title"><div><span class="eyebrow">OUTLOOK</span><h2>Thunderstorm potential</h2></div></div>
      <div class="outlook-strip">${renderOutlooks(idx)}</div>
      ${officialCount ? `<div class="section-title"><div><span class="eyebrow">ALERT DETAILS</span><h2>Active for your location</h2></div></div><div class="storm-alert-list">${renderActiveAlerts()}</div>` : ''}
      <article class="panel card-pad" style="margin-top:14px">
        <div class="card-head"><div><span class="eyebrow">REAL DATA LAYERS</span><h3>Built for storm watching</h3></div></div>
        <p style="margin:0;color:var(--muted);font-size:12px;line-height:1.6">The map uses official ECCC radar, radar extrapolation nowcast, lightning-density analysis, thunderstorm-probability guidance and alert polygons. Lightning is displayed as density data, not invented strike counts.</p>
      </article>`;

    $('#openStormMap')?.addEventListener('click',()=>{ switchScreen('map'); setTimeout(()=>setMapLayer('storms'),120); });
    $('#openLightningMap')?.addEventListener('click',()=>{ switchScreen('map'); setTimeout(()=>setMapLayer('lightning'),120); });
    bindAlertCards($('#stormsContent'));
    refreshIcons();
  }

  function stormMetric(icon,label,value){return `<div class="storm-metric"><i data-lucide="${icon}"></i><small>${label}</small><strong>${value}</strong></div>`;}
  function stormRisk(cape,pop,codes){ const thunder=codes.some(c=>c>=95); if(thunder||cape>1600) return {headline:'Storm environment is active',summary:'Forecast guidance supports meaningful thunderstorm potential. Use the radar and official alert layers for timing and severity.'}; if(cape>700&&pop>45)return{headline:'Storms are possible',summary:'Instability and precipitation overlap in the near-term forecast. Convective development is worth watching.'}; if(cape>250)return{headline:'Low-end storm potential',summary:'Some instability is present, but the signal is not strong enough to call for an active storm setup.'}; return{headline:'No strong storm signal',summary:'The near-term forecast does not show a significant convective signal at your selected location.'}; }
  function renderOutlooks(idx){ const h=state.weather.hourly; const blocks=[['Today',idx,idx+12],['Tonight',idx+12,idx+24],['Tomorrow',idx+24,idx+48]]; return blocks.map(([name,a,b])=>{ const cape=Math.max(...(h.cape?.slice(a,b)||[0]).filter(Number.isFinite),0), pop=Math.max(...h.precipitation_probability.slice(a,b),0), r=stormRiskLevel(cape,pop,h.weather_code.slice(a,b)); return `<div class="outlook-day"><small>${name}</small><span class="risk-pill risk-${r.className}">${r.label}</span></div>`; }).join(''); }
  function stormRiskLevel(cape,pop,codes){ if(codes.some(c=>c>=96)||cape>1800)return{label:'HIGH',className:'high'};if(codes.some(c=>c>=95)||cape>900&&pop>50)return{label:'MODERATE',className:'moderate'};if(cape>350&&pop>30)return{label:'LOW',className:'low'};return{label:'NONE',className:'none'}; }

  function initMap() {
    if(state.map) return;
    state.map = L.map('weatherMap',{ zoomControl:false, preferCanvas:true }).setView([state.location.latitude,state.location.longitude],7);
    state.baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{ attribution:'© OpenStreetMap © CARTO', maxZoom:19 }).addTo(state.map);
    bindMapControls();
    setMapLayer('radar');
    addUserMarker();
  }

  function addUserMarker(){ if(!state.map)return; if(state.userMarker) state.map.removeLayer(state.userMarker); state.userMarker=L.circleMarker([state.location.latitude,state.location.longitude],{radius:6,color:'#d9efff',weight:2,fillColor:'#6eb8ff',fillOpacity:1}).addTo(state.map); }

  function bindMapControls() {
    $('#recenterBtn').addEventListener('click',()=>state.map.flyTo([state.location.latitude,state.location.longitude],8,{duration:.7}));
    document.querySelectorAll('#quickLayers [data-layer]').forEach(btn=>btn.addEventListener('click',()=>{
      const l=btn.dataset.layer; if(l==='layers') return openModal('layersModal'); if(l==='alerts') { toggleAlerts(); return; } setMapLayer(l);
    }));
    document.querySelectorAll('[data-select-layer]').forEach(btn=>btn.addEventListener('click',()=>{setMapLayer(btn.dataset.selectLayer);closeModal('layersModal');}));
    document.querySelector('[data-toggle-alerts]').addEventListener('click',()=>toggleAlerts());
    $('#radarPlay').addEventListener('click',()=> state.radarTimer ? stopRadar() : playRadar());
    $('#radarStepBack').addEventListener('click',()=>stepRadar(-1));
    $('#radarStepForward').addEventListener('click',()=>stepRadar(1));
    $('#radarTimeline').addEventListener('input',e=>{ state.radarIndex=Number(e.target.value); applyRadarTime(); });
  }

  async function setMapLayer(key) {
    if(!state.map || !LAYERS[key]) return;
    stopRadar(); state.activeMapLayer=key;
    if(state.weatherLayer) state.map.removeLayer(state.weatherLayer);
    const cfg=LAYERS[key];
    state.weatherLayer=L.tileLayer.wms(WMS,{
      layers:cfg.id,
      styles:cfg.style || '',
      format:'image/png',
      transparent:true,
      opacity:state.settings.radarOpacity/100,
      version:'1.3.0',
      uppercase:true
    }).addTo(state.map);
    $('#mapLayerStatus').textContent=cfg.label;
    $('#radarModeLabel').textContent=cfg.mode;
    $('#timelineStartLabel').textContent=['futureprecip','storms','precipprob','temperature','windgust'].includes(key) ? 'NOW' : 'PAST';
    document.querySelectorAll('#quickLayers [data-layer]').forEach(b=>b.classList.toggle('active',b.dataset.layer===key));
    document.querySelectorAll('[data-select-layer]').forEach(b=>b.classList.toggle('active',b.dataset.selectLayer===key));
    await loadLayerTimes(cfg.id);
    updateMapLegend(key);
    refreshIcons();
  }

  async function loadLayerTimes(layerId) {
    const ts=$('#radarTimestamp'); ts.textContent='Loading timeline…';
    try {
      const url=`https://geo.weather.gc.ca/geomet?service=WMS&version=1.3.0&request=GetCapabilities&layer=${encodeURIComponent(layerId)}`;
      const res=await fetch(url); if(!res.ok) throw new Error('Timeline unavailable'); const xmlText=await res.text(); const parser=new DOMParser(); const xml=parser.parseFromString(xmlText,'application/xml');
      const layerNodes=[...xml.querySelectorAll('Layer')]; let target=null; for(const node of layerNodes){const name=node.querySelector(':scope > Name')?.textContent;if(name===layerId){target=node;break;}}
      const dim=target?.querySelector('Dimension[name="time"], Extent[name="time"]');
      state.radarTimes=parseTimeDimension(dim?.textContent?.trim()||'');
      if(!state.radarTimes.length) { state.radarIndex=0; $('#radarTimeline').max=0; $('#radarTimeline').value=0; ts.textContent='Latest available'; return; }
      const forecastLike=['nowcast','futureprecip','storms','precipprob','temperature','windgust'].includes(state.activeMapLayer);
      state.radarIndex=forecastLike ? nearestTimeIndex(state.radarTimes,new Date()) : state.radarTimes.length-1;
      $('#radarTimeline').min=0; $('#radarTimeline').max=state.radarTimes.length-1; $('#radarTimeline').value=state.radarIndex; applyRadarTime();
    } catch(err) { state.radarTimes=[]; ts.textContent='Latest available'; }
  }

  function parseTimeDimension(text) {
    if(!text)return[];
    const parts=text.split(',').map(s=>s.trim()).filter(Boolean); const out=[];
    for(const p of parts){
      if(p.includes('/')){
        const [startS,endS,periodS]=p.split('/'); const start=new Date(startS),end=new Date(endS),step=parseISODuration(periodS||'PT6M'); if(!isNaN(start)&&!isNaN(end)&&step>0){ for(let t=start.getTime(), guard=0;t<=end.getTime()&&guard<1000;t+=step,guard++) out.push(new Date(t).toISOString()); }
      } else { const d=new Date(p); if(!isNaN(d)) out.push(d.toISOString()); }
    }
    return [...new Set(out)].sort();
  }

  function parseISODuration(v){ if(!v)return 360000; const m=v.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); if(!m)return 360000; return (((+m[1]||0)*24+(+m[2]||0))*60+(+m[3]||0))*60000+(+m[4]||0)*1000; }

  function applyRadarTime(){
    if(!state.radarTimes.length||!state.weatherLayer)return;
    const time=state.radarTimes[state.radarIndex];
    state.weatherLayer.setParams({time},false);
    $('#radarTimeline').value=state.radarIndex;
    const d=new Date(time);
    const deltaMin=Math.round((d.getTime()-Date.now())/60000);
    const cfg=LAYERS[state.activeMapLayer];
    let mode=cfg?.mode || 'WEATHER LAYER';
    if(state.activeMapLayer==='nowcast') mode=deltaMin > 0 ? 'FORECAST NOWCAST' : 'OBSERVED / NOWCAST';
    if(state.activeMapLayer==='radar') mode='OBSERVED RADAR';
    $('#radarModeLabel').textContent=mode;
    $('#radarTimestamp').textContent=d.toLocaleString(undefined,{weekday:'short',hour:'numeric',minute:'2-digit'});
    $('#timelineNowLabel').textContent=deltaMin > 6 ? `+${deltaMin} MIN` : deltaMin < -6 ? `${Math.abs(deltaMin)} MIN AGO` : 'NOW';
  }
  function stepRadar(dir){ if(!state.radarTimes.length)return; state.radarIndex=Math.max(0,Math.min(state.radarTimes.length-1,state.radarIndex+dir));applyRadarTime(); }
  function playRadar(){ if(!state.radarTimes.length)return; if(state.radarIndex>=state.radarTimes.length-1) state.radarIndex=0; state.radarTimer=setInterval(()=>{ if(state.radarIndex>=state.radarTimes.length-1) state.radarIndex=0; else state.radarIndex++; applyRadarTime(); },state.settings.radarSpeed); $('#radarPlay').innerHTML='<i data-lucide="pause"></i>'; refreshIcons(); }
  function stopRadar(){ if(state.radarTimer){clearInterval(state.radarTimer);state.radarTimer=null;} const b=$('#radarPlay'); if(b)b.innerHTML='<i data-lucide="play"></i>'; refreshIcons(); }

  function updateMapLegend(key){ const el=$('#radarLegend'); if(key==='lightning') el.innerHTML='<span>Density of detected lightning activity</span>'; else if(key==='storms') el.innerHTML='<span>Forecast thunderstorm probability from ECCC guidance</span>'; else el.innerHTML='<span><b class="legend-dot l1"></b>Light</span><span><b class="legend-dot l2"></b>Moderate</span><span><b class="legend-dot l3"></b>Heavy</span><span><b class="legend-dot l4"></b>Intense</span>'; }

  function toggleAlerts() {
    if(!state.map)return;
    state.alertsEnabled=!state.alertsEnabled;
    document.querySelectorAll('[data-layer="alerts"], [data-toggle-alerts]').forEach(b=>b.classList.toggle('active',state.alertsEnabled));
    if(state.alertsEnabled){
      state.alertsLayer=L.tileLayer.wms(WMS,{
        layers:'Current-Alerts',
        styles:'Current-Alerts',
        format:'image/png',
        transparent:true,
        opacity:.92,
        version:'1.3.0',
        uppercase:true
      }).addTo(state.map);
      renderLocalAlertPolygons();
      toast(state.alerts.length ? `${state.alerts.length} local ECCC alert${state.alerts.length===1?'':'s'} found.` : 'Official ECCC alert layer enabled.');
    } else {
      if(state.alertsLayer){state.map.removeLayer(state.alertsLayer);state.alertsLayer=null;}
      if(state.localAlertGeoLayer){state.map.removeLayer(state.localAlertGeoLayer);state.localAlertGeoLayer=null;}
    }
  }

  function renderLocalAlertPolygons() {
    if (!state.map) return;
    if (state.localAlertGeoLayer) {
      state.map.removeLayer(state.localAlertGeoLayer);
      state.localAlertGeoLayer = null;
    }
    const features = (state.alerts || []).filter(f => f.geometry);
    if (!features.length || !state.alertsEnabled) return;
    state.localAlertGeoLayer = L.geoJSON({ type:'FeatureCollection', features }, {
      style: feature => {
        const level = alertRiskClass(feature.properties || {});
        const colours = {
          warning:'#ff566b',
          watch:'#ff9f43',
          advisory:'#ffd85b',
          statement:'#77baff'
        };
        return { color:colours[level] || '#77baff', weight:2, fillOpacity:.08, opacity:.95 };
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        layer.bindPopup(`<strong>${escapeHtml(p.alert_name_en || 'Weather alert')}</strong><br>${escapeHtml(p.feature_name_en || state.location.name)}`);
      }
    }).addTo(state.map);
  }

  function geometryContainsPoint(geometry, point) {
    if (!geometry || !point) return false;
    const [x, y] = point;
    const inRing = ring => {
      let inside = false;
      for (let i=0, j=ring.length-1; i<ring.length; j=i++) {
        const xi=Number(ring[i][0]), yi=Number(ring[i][1]);
        const xj=Number(ring[j][0]), yj=Number(ring[j][1]);
        const intersect=((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/((yj-yi)||Number.EPSILON)+xi);
        if(intersect) inside=!inside;
      }
      return inside;
    };
    const inPolygon = poly => {
      if (!poly?.length || !inRing(poly[0])) return false;
      for (let i=1;i<poly.length;i++) if (inRing(poly[i])) return false;
      return true;
    };
    if (geometry.type === 'Polygon') return inPolygon(geometry.coordinates);
    if (geometry.type === 'MultiPolygon') return geometry.coordinates.some(inPolygon);
    return false;
  }

  function provinceCodeFromName(name) {
    const key=String(name||'').trim().toLowerCase();
    const map={
      'alberta':'AB','british columbia':'BC','manitoba':'MB','new brunswick':'NB',
      'newfoundland and labrador':'NL','northwest territories':'NT','nova scotia':'NS',
      'nunavut':'NU','ontario':'ON','prince edward island':'PE','quebec':'QC',
      'saskatchewan':'SK','yukon':'YT'
    };
    return map[key] || '';
  }


  function weatherCondition(code,isDay=true){
    const map={0:['Clear','sun'],1:['Mostly clear','sun'],2:['Partly cloudy','cloud-sun'],3:['Overcast','cloud'],45:['Fog','cloud-fog'],48:['Rime fog','cloud-fog'],51:['Light drizzle','cloud-drizzle'],53:['Drizzle','cloud-drizzle'],55:['Heavy drizzle','cloud-rain'],56:['Freezing drizzle','cloud-hail'],57:['Freezing drizzle','cloud-hail'],61:['Light rain','cloud-rain'],63:['Rain','cloud-rain'],65:['Heavy rain','cloud-rain-wind'],66:['Freezing rain','cloud-hail'],67:['Freezing rain','cloud-hail'],71:['Light snow','cloud-snow'],73:['Snow','cloud-snow'],75:['Heavy snow','snowflake'],77:['Snow grains','snowflake'],80:['Rain showers','cloud-rain'],81:['Rain showers','cloud-rain-wind'],82:['Heavy showers','cloud-rain-wind'],85:['Snow showers','cloud-snow'],86:['Heavy snow showers','snowflake'],95:['Thunderstorm','cloud-lightning'],96:['Thunderstorm + hail','cloud-lightning'],99:['Severe thunderstorm','cloud-lightning']}; const [label,icon]=map[code]||['Variable','cloud']; return{label,icon:(!isDay&&icon==='sun')?'moon':icon};
  }
  function nearestTimeIndex(arr,date){ const t=date.getTime(); let best=0,d=Infinity; arr.forEach((v,i)=>{const x=Math.abs(new Date(v).getTime()-t);if(x<d){d=x;best=i;}}); return best; }
  function pressureTrend(idx){ const p=state.weather.hourly.pressure_msl; const prev=p[Math.max(0,idx-3)],cur=p[idx]; const diff=cur-prev; return Math.abs(diff)<.7?'Steady':diff>0?'Rising':'Falling'; }
  function formatVisibility(m){ if(m==null)return'—'; return m>=10000?`${Math.round(m/1000)} km`:`${(m/1000).toFixed(1)} km`; }
  function uvLabel(v){return v<3?'Low':v<6?'Moderate':v<8?'High':v<11?'Very high':'Extreme';}
  function formatLocalTime(v){ if(!v)return'—'; return new Date(v).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}); }
  function formatHour(v){ return new Date(v).toLocaleTimeString(undefined,{hour:'numeric'}).replace(' ',''); }
  function round(v){ return Number.isFinite(Number(v))?Math.round(Number(v)):'—'; }
  function sum(arr){return arr.reduce((a,b)=>a+(Number(b)||0),0);}
  function toast(msg){ const el=$('#toast');el.textContent=msg;el.hidden=false;clearTimeout(el._t);el._t=setTimeout(()=>el.hidden=true,2800); }
  function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function $(sel){return document.querySelector(sel);}

  document.addEventListener('DOMContentLoaded',init);
})();
