(() => {
  'use strict';
  const $ = q => document.querySelector(q);
  let selectedDay = 0;
  let cache = null;
  let cacheKey = '';
  let token = 0;

  function locationState() {
    try {
      const location = JSON.parse(localStorage.getItem('stormlens-location') || 'null');
      if (location && Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude))) return location;
    } catch (_) {}
    return { latitude:51.0447, longitude:-114.0719 };
  }

  function signature() {
    const location = locationState();
    return `${Number(location.latitude).toFixed(4)},${Number(location.longitude).toFixed(4)}`;
  }

  async function loadAirQuality() {
    const key = signature();
    if (cache && cacheKey === key) return cache;
    const location = locationState();
    const params = new URLSearchParams({
      latitude:String(location.latitude),
      longitude:String(location.longitude),
      timezone:'auto',
      forecast_days:'7',
      hourly:'us_aqi,pm2_5'
    });
    const response = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`, { cache:'no-store' });
    if (!response.ok) throw new Error(`Air quality service returned ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.reason || 'Air quality unavailable');
    cache = data;
    cacheKey = key;
    return data;
  }

  function category(value) {
    if (!Number.isFinite(value)) return ['Unavailable',''];
    if (value <= 50) return ['Good','v14-aqi-good'];
    if (value <= 100) return ['Moderate','v14-aqi-moderate'];
    if (value <= 150) return ['Sensitive groups','v14-aqi-sensitive'];
    if (value <= 200) return ['Unhealthy','v14-aqi-unhealthy'];
    if (value <= 300) return ['Very unhealthy','v14-aqi-very-unhealthy'];
    return ['Hazardous','v14-aqi-hazardous'];
  }

  async function enhance() {
    const body = $('#v12DayBody');
    const grid = body?.querySelector('.v12-metric-grid');
    if (!body || !grid || $('#v12DayDetail')?.hidden) return;
    const index = selectedDay;
    const viewKey = `${signature()}:${index}`;
    if (body.dataset.v14Aqi === viewKey || body.dataset.v14AqiLoading === viewKey) return;
    body.dataset.v14AqiLoading = viewKey;
    const current = ++token;
    try {
      grid.querySelector('[data-v14-aqi]')?.remove();
      const card = document.createElement('div');
      card.className = 'v12-metric';
      card.dataset.v14Aqi = 'true';

      if (index >= 7) {
        card.innerHTML = '<small>Air quality</small><strong>—</strong><p>AQ forecast currently extends through day 7</p>';
        grid.appendChild(card);
        body.dataset.v14Aqi = viewKey;
        return;
      }

      const data = await loadAirQuality();
      if (current !== token || index !== selectedDay) return;
      const date = data.hourly?.time?.find(time => true)?.slice(0,10);
      const dates = [...new Set((data.hourly?.time || []).map(time => String(time).slice(0,10)))];
      const targetDate = dates[index] || date;
      const ids = [];
      (data.hourly?.time || []).forEach((time,i) => { if (String(time).slice(0,10) === targetDate) ids.push(i); });
      const aqis = ids.map(i => Number(data.hourly.us_aqi?.[i])).filter(Number.isFinite);
      const pm = ids.map(i => Number(data.hourly.pm2_5?.[i])).filter(Number.isFinite);
      const maxAqi = aqis.length ? Math.max(...aqis) : NaN;
      const avgPm = pm.length ? pm.reduce((a,b) => a+b,0) / pm.length : NaN;
      const [label,className] = category(maxAqi);
      card.classList.add(className);
      card.innerHTML = Number.isFinite(maxAqi)
        ? `<small>Air quality</small><strong>AQI ${Math.round(maxAqi)}</strong><p>${label}${Number.isFinite(avgPm) ? ` · PM2.5 avg ${avgPm.toFixed(1)} µg/m³` : ''}</p>`
        : '<small>Air quality</small><strong>—</strong><p>Forecast unavailable</p>';
      grid.appendChild(card);
      body.dataset.v14Aqi = viewKey;
    } catch (error) {
      console.warn('[StormLens V14 air quality]',error);
    } finally {
      if (body?.dataset.v14AqiLoading === viewKey) delete body.dataset.v14AqiLoading;
    }
  }

  function selectRow(row) {
    selectedDay = Number(row?.dataset?.v12Day) || 0;
    token++;
    const body = $('#v12DayBody');
    if (body) { delete body.dataset.v14Aqi; delete body.dataset.v14AqiLoading; }
    setTimeout(enhance,90);
  }

  document.addEventListener('click',event => {
    const row = event.target.closest?.('.day-row[data-v12-day]');
    if (row) selectRow(row);
  },true);
  document.addEventListener('keydown',event => {
    const row = event.target.closest?.('.day-row[data-v12-day]');
    if (row && (event.key === 'Enter' || event.key === ' ')) selectRow(row);
  },true);
  new MutationObserver(() => requestAnimationFrame(enhance)).observe(document.body,{childList:true,subtree:true});
})();
