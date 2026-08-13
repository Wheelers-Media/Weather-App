(() => {
  'use strict';

  const HOUR = 3600000;
  const unavailableTomorrow = new Set();
  const getEngine = () => window.StormLensMapV10 || null;

  function locationState() {
    try {
      const value = JSON.parse(localStorage.getItem('stormlens-location') || 'null');
      if (value && Number.isFinite(Number(value.latitude)) && Number.isFinite(Number(value.longitude))) return value;
    } catch (_) {}
    return { name:'Calgary', latitude:51.0447, longitude:-114.0719 };
  }

  function setStatus(text, state='live') {
    const label = document.getElementById('mapLayerStatus');
    const pill = document.getElementById('mapStatusPill');
    if (label) label.textContent = text;
    if (pill) pill.dataset.state = state;
  }

  function selectedMatches(name) {
    const id = getEngine()?.selectedLayer;
    if (name === 'RadarLayer') return id === 'radar' || id === 'nowcast';
    if (name === 'PrecipitationLayer') return id === 'precipitation' || id === 'storm';
    if (name === 'TemperatureLayer') return id === 'temperature';
    if (name === 'PressureLayer') return id === 'pressure';
    if (name === 'WindLayer') return id === 'wind';
    return false;
  }

  function precipitationStatus(layer) {
    if (getEngine()?.selectedLayer !== 'precipitation' || !layer?.__stormlensReady) return;
    const loc = locationState();
    try {
      const value = Number(layer.pickAt(Number(loc.longitude), Number(loc.latitude))?.value);
      if (!Number.isFinite(value)) return;
      if (value < 0.05) setStatus('Precipitation · none near your location at this time');
      else setStatus(`Precipitation · ${value.toFixed(value < 1 ? 1 : 0)} mm/h near your location`);
    } catch (_) {}
  }

  function installWeatherGuards() {
    const W = window.maptilerweather;
    if (!W || W.__stormlensGuardedV11) return;
    W.__stormlensGuardedV11 = true;

    const wrap = name => {
      const Original = W[name];
      if (typeof Original !== 'function') return;

      W[name] = class StormLensWeatherLayer extends Original {
        constructor(options = {}) {
          const next = { ...options };

          if (name === 'WindLayer') {
            next.maxAmount = matchMedia('(pointer:coarse)').matches ? 64 : 128;
            next.density = matchMedia('(pointer:coarse)').matches ? 1.35 : 1.8;
            next.size = 1.4;
            next.speed = 0.001;
          }

          if (name === 'PrecipitationLayer' && W.ColorRamp) {
            next.colorramp = new W.ColorRamp({ stops:[
              { value:0, color:[0,0,0,0] },
              { value:0.05, color:[72,166,255,125] },
              { value:0.2, color:[55,184,255,185] },
              { value:0.5, color:[31,205,133,215] },
              { value:1.5, color:[250,204,21,230] },
              { value:4, color:[249,115,22,242] },
              { value:8, color:[239,68,68,250] },
              { value:15, color:[168,85,247,255] }
            ] });
          }

          super(next);
          this.__stormlensReady = false;
          this.__pendingTime = null;
          this.__pendingFactor = null;

          const slowTimer = setTimeout(() => {
            if (!this.__stormlensReady && selectedMatches(name)) {
              const id = getEngine()?.selectedLayer;
              const title = getEngine()?.defs?.[id]?.title || name.replace('Layer','');
              setStatus(`${title} · loading weather data…`, 'loading');
            }
          }, name === 'WindLayer' ? 8500 : 5500);

          this.on('sourceReady', () => {
            clearTimeout(slowTimer);
            this.__stormlensReady = true;
            if (Number.isFinite(this.__pendingTime)) {
              try { super.setAnimationTime(this.__pendingTime); } catch (_) {}
            }
            if (Number.isFinite(this.__pendingFactor) && this.__pendingFactor > 0) {
              try { super.animateByFactor(this.__pendingFactor); } catch (_) {}
            }
            if (selectedMatches(name)) {
              const id = getEngine()?.selectedLayer;
              const title = getEngine()?.defs?.[id]?.title || name.replace('Layer','');
              setStatus(`${title} · READY`);
            }
            if (name === 'PrecipitationLayer') setTimeout(() => precipitationStatus(this), 120);
          });

          if (name === 'PrecipitationLayer') {
            this.on('animationTimeSet', () => setTimeout(() => precipitationStatus(this), 120));
          }
        }

        getAnimationStartDate() {
          if (!this.__stormlensReady) return new Date(Date.now());
          const value = super.getAnimationStartDate();
          return value instanceof Date && Number.isFinite(+value) ? value : new Date(Date.now());
        }

        getAnimationEndDate() {
          if (!this.__stormlensReady) return new Date(Date.now() + 96 * HOUR);
          const value = super.getAnimationEndDate();
          return value instanceof Date && Number.isFinite(+value) ? value : new Date(Date.now() + 96 * HOUR);
        }

        getAnimationTimeDate() {
          if (!this.__stormlensReady) {
            return new Date(Number.isFinite(this.__pendingTime) ? this.__pendingTime * 1000 : Date.now());
          }
          const value = super.getAnimationTimeDate();
          return value instanceof Date && Number.isFinite(+value) ? value : new Date(Date.now());
        }

        setAnimationTime(time) {
          if (!this.__stormlensReady) { this.__pendingTime = Number(time); return; }
          return super.setAnimationTime(time);
        }

        animateByFactor(factor) {
          if (!this.__stormlensReady) { this.__pendingFactor = Number(factor); return; }
          this.__pendingFactor = Number(factor);
          return super.animateByFactor(factor);
        }
      };
    };

    ['RadarLayer','PrecipitationLayer','TemperatureLayer','PressureLayer','WindLayer'].forEach(wrap);
  }

  function cleanSheet() {
    document.querySelectorAll('[data-v10-weather="showalter"]').forEach(row => row.remove());
    for (const id of unavailableTomorrow) document.querySelectorAll(`[data-v10-weather="${id}"]`).forEach(row => row.remove());
  }

  function cleanProbabilityLegend(id) {
    if (id !== 'thunderRisk' && id !== 'precipProb') return;
    const legend = document.getElementById('radarLegend');
    if (!legend) return;
    legend.innerHTML = '<span><b class="legend-dot v10-blue"></b>0%</span><span><b class="legend-dot v10-yellow"></b>25%</span><span><b class="legend-dot v10-red"></b>50%</span><span><b class="legend-dot v10-purple"></b>100%</span>';
  }

  async function probeTomorrow() {
    const e = getEngine();
    if (!e?.defs) return;
    for (const [id, def] of Object.entries(e.defs).filter(([,d]) => d.provider === 'tomorrow' && d.field)) {
      try {
        const response = await fetch(`/api/tomorrow-probe?field=${encodeURIComponent(def.field)}`, { cache:'no-store' });
        const result = response.ok ? await response.json() : { available:false };
        if (!result.available) unavailableTomorrow.add(id);
      } catch (_) {}
    }
    cleanSheet();
  }

  installWeatherGuards();
  new MutationObserver(cleanSheet).observe(document.documentElement, { childList:true, subtree:true });

  window.addEventListener('stormlens:weather-layer-changed', event => {
    requestAnimationFrame(() => cleanProbabilityLegend(event.detail?.id));
  });

  window.addEventListener('stormlens:map-ready', () => {
    cleanSheet();
    probeTomorrow();
    const e = getEngine();
    if (e?.selectedLayer === 'showalter') e.selectLayer('storm');
  });
})();
