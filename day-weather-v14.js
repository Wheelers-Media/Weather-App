(() => {
  'use strict';
  const $ = q => document.querySelector(q);
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  let selectedDay = 0;
  let requestToken = 0;
  let cache = null;
  let cacheKey = '';

  function locationState() {
    try {
      const location = JSON.parse(localStorage.getItem('stormlens-location') || 'null');
      if (location && Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude))) return location;
    } catch (_) {}
    return { latitude:51.0447, longitude:-114.0719 };
  }

  function settings() {
    try { return JSON.parse(localStorage.getItem('stormlens-settings') || '{}') || {}; }
    catch (_) { return {}; }
  }

  function signature() {
    const location = locationState();
    const options = settings();
    return `${Number(location.latitude).toFixed(4)},${Number(location.longitude).toFixed(4)}:${options.tempUnit || 'celsius'}:${options.windUnit || 'kmh'}`;
  }

  async function loadForecast() {
    const key = signature();
    if (cache && cacheKey === key) return cache;
    const location = locationState();
    const options = settings();
    const params = new URLSearchParams({
      latitude:String(location.latitude),
      longitude:String(location.longitude),
      timezone:'auto',
      forecast_days:'16',
      temperature_unit:options.tempUnit === 'fahrenheit' ? 'fahrenheit' : 'celsius',
      wind_speed_unit:options.windUnit || 'kmh',
      hourly:'cape,precipitation_probability,weather_code',
      daily:'precipitation_sum,precipitation_hours,precipitation_probability_max,weather_code'
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { cache:'no-store' });
    if (!response.ok) throw new Error(`Forecast service returned ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.reason || 'Forecast unavailable');
    cache = data;
    cacheKey = key;
    return data;
  }

  function indicesForDate(data,date) {
    const result = [];
    (data.hourly?.time || []).forEach((time,index) => {
      if (String(time).slice(0,10) === date) result.push(index);
    });
    return result;
  }

  function stormPotential(data,date) {
    const indices = indicesForDate(data,date);
    const capes = indices.map(i => Number(data.hourly.cape?.[i])).filter(Number.isFinite);
    const pops = indices.map(i => Number(data.hourly.precipitation_probability?.[i])).filter(Number.isFinite);
    const codes = indices.map(i => Number(data.hourly.weather_code?.[i])).filter(Number.isFinite);
    const maxCape = capes.length ? Math.max(...capes) : 0;
    const maxPop = pops.length ? Math.max(...pops) : 0;
    if (codes.includes(99)) return { pct:100, maxCape, maxPop };
    if (codes.includes(96)) return { pct:95, maxCape, maxPop };
    if (codes.includes(95)) return { pct:85, maxCape, maxPop };
    const capeScore = clamp((maxCape - 100) / 14, 0, 100);
    let pct = Math.round(capeScore * 0.65 + maxPop * 0.35);
    if (maxCape < 200) pct = Math.min(pct,20);
    else if (maxCape < 500) pct = Math.min(pct,40);
    else if (maxCape < 800) pct = Math.min(pct,60);
    return { pct:clamp(pct,0,100), maxCape, maxPop };
  }

  async function enhance() {
    const body = $('#v12DayBody');
    const grid = body?.querySelector('.v12-metric-grid');
    if (!body || !grid || $('#v12DayDetail')?.hidden) return;
    const index = selectedDay;
    const viewKey = `${signature()}:${index}`;
    if (body.dataset.v14Weather === viewKey || body.dataset.v14WeatherLoading === viewKey) return;
    body.dataset.v14WeatherLoading = viewKey;
    const token = ++requestToken;
    try {
      const data = await loadForecast();
      if (token !== requestToken || index !== selectedDay) return;
      const date = data.daily?.time?.[index];
      if (!date) return;
      const amount = Number(data.daily.precipitation_sum?.[index] || 0);
      const hours = Number(data.daily.precipitation_hours?.[index] || 0);
      const chance = Number(data.daily.precipitation_probability_max?.[index] || 0);
      const storm = stormPotential(data,date);

      const precipitation = [...grid.querySelectorAll('.v12-metric')].find(card => card.querySelector('small')?.textContent.trim() === 'Precipitation');
      if (precipitation) {
        precipitation.classList.add('v14-metric-accent');
        precipitation.querySelector('small').textContent = 'Expected precipitation';
        precipitation.querySelector('strong').textContent = `${amount.toFixed(1)} mm`;
        precipitation.querySelector('p').textContent = `${Math.round(chance)}% max chance · about ${Math.round(hours)}h`;
      }

      grid.querySelector('[data-v14-storm]')?.remove();
      const card = document.createElement('div');
      card.className = 'v12-metric v14-metric-accent';
      card.dataset.v14Storm = 'true';
      card.innerHTML = `<small>Storm potential*</small><strong>${storm.pct}%</strong><p>Max CAPE ${Math.round(storm.maxCape)} J/kg · max precip chance ${Math.round(storm.maxPop)}%</p>`;
      grid.appendChild(card);

      body.querySelector('.v14-estimate-note')?.remove();
      const note = document.createElement('div');
      note.className = 'v14-estimate-note';
      note.textContent = '* Storm potential is a StormLens model-derived signal from CAPE, precipitation probability and forecast weather code. It is not an official thunderstorm probability or warning.';
      grid.insertAdjacentElement('afterend',note);
      body.dataset.v14Weather = viewKey;
    } catch (error) {
      console.warn('[StormLens V14 weather details]',error);
    } finally {
      if (body?.dataset.v14WeatherLoading === viewKey) delete body.dataset.v14WeatherLoading;
    }
  }

  function selectRow(row) {
    selectedDay = Number(row?.dataset?.v12Day) || 0;
    requestToken++;
    const body = $('#v12DayBody');
    if (body) {
      delete body.dataset.v14Weather;
      delete body.dataset.v14WeatherLoading;
    }
    setTimeout(enhance,70);
  }

  document.addEventListener('click',event => {
    const row = event.target.closest?.('.day-row[data-v12-day]');
    if (row) selectRow(row);
  },true);
  document.addEventListener('keydown',event => {
    const row = event.target.closest?.('.day-row[data-v12-day]');
    if (row && (event.key === 'Enter' || event.key === ' ')) selectRow(row);
  },true);
  const scheduleEnhance = () => requestAnimationFrame(enhance);
  if (window.StormLensAppObserve) window.StormLensAppObserve(scheduleEnhance);
  else new MutationObserver(scheduleEnhance).observe(document.body,{childList:true,subtree:true});
})();
