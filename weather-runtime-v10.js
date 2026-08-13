(() => {
  'use strict';

  const HOUR = 3600000;

  function installWeatherGuards() {
    const W = window.maptilerweather;
    if (!W || W.__stormlensGuarded) return;
    W.__stormlensGuarded = true;

    const wrap = (name) => {
      const Original = W[name];
      if (typeof Original !== 'function') return;

      W[name] = class StormLensWeatherLayer extends Original {
        constructor(options = {}) {
          const next = { ...options };

          if (name === 'WindLayer') {
            // MapTiler requires maxAmount to be a power of two. The previous values
            // 72/140 were invalid and could prevent the particle renderer behaving correctly.
            next.maxAmount = matchMedia('(pointer:coarse)').matches ? 64 : 128;
            next.density = matchMedia('(pointer:coarse)').matches ? 1.35 : 1.8;
            next.size = 1.4;
            next.speed = 0.001;
          }

          if (name === 'PrecipitationLayer' && W.ColorRamp) {
            // Emphasize common drizzle/light-rain rates instead of spending most of the
            // palette on extreme 0-50 mm/h values.
            next.colorramp = new W.ColorRamp({
              stops: [
                { value:0, color:[0,0,0,0] },
                { value:0.05, color:[72,166,255,125] },
                { value:0.2, color:[55,184,255,185] },
                { value:0.5, color:[31,205,133,215] },
                { value:1.5, color:[250,204,21,230] },
                { value:4, color:[249,115,22,242] },
                { value:8, color:[239,68,68,250] },
                { value:15, color:[168,85,247,255] }
              ]
            });
          }

          super(next);
          this.__stormlensReady = false;
          this.__stormlensPendingTime = null;
          this.__stormlensPendingFactor = null;
          this.on('sourceReady', () => {
            this.__stormlensReady = true;
            if (Number.isFinite(this.__stormlensPendingTime)) {
              try { super.setAnimationTime(this.__stormlensPendingTime); } catch (_) {}
            }
            if (Number.isFinite(this.__stormlensPendingFactor) && this.__stormlensPendingFactor > 0) {
              try { super.animateByFactor(this.__stormlensPendingFactor); } catch (_) {}
            }
          });
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
            return new Date(Number.isFinite(this.__stormlensPendingTime) ? this.__stormlensPendingTime * 1000 : Date.now());
          }
          const value = super.getAnimationTimeDate();
          return value instanceof Date && Number.isFinite(+value) ? value : new Date(Date.now());
        }

        setAnimationTime(time) {
          if (!this.__stormlensReady) {
            this.__stormlensPendingTime = Number(time);
            return;
          }
          return super.setAnimationTime(time);
        }

        animateByFactor(factor) {
          if (!this.__stormlensReady) {
            this.__stormlensPendingFactor = Number(factor);
            return;
          }
          this.__stormlensPendingFactor = Number(factor);
          return super.animateByFactor(factor);
        }
      };
    };

    ['RadarLayer','PrecipitationLayer','TemperatureLayer','PressureLayer','WindLayer'].forEach(wrap);
  }

  function hideAdvancedNoise() {
    document.querySelectorAll('[data-v10-weather="showalter"]').forEach(row => row.remove());
  }

  function numericProbabilityLegend(id) {
    const legend = document.getElementById('radarLegend');
    if (!legend) return;
    if (id === 'thunderRisk' || id === 'precipProb') {
      legend.innerHTML = '<span><b class="legend-dot v10-blue"></b>0%</span><span><b class="legend-dot v10-yellow"></b>25%</span><span><b class="legend-dot v10-red"></b>50%</span><span><b class="legend-dot v10-purple"></b>100%</span>';
    }
  }

  async function hideUnavailableTomorrowLayers() {
    const engine = window.StormLensMapV10;
    if (!engine?.defs) return;
    const entries = Object.entries(engine.defs).filter(([, def]) => def.provider === 'tomorrow' && def.field);
    for (const [id, def] of entries) {
      try {
        const response = await fetch(`/api/tomorrow-probe?field=${encodeURIComponent(def.field)}`, { cache:'no-store' });
        const data = response.ok ? await response.json() : { available:false };
        if (!data.available) document.querySelectorAll(`[data-v10-weather="${id}"]`).forEach(row => row.remove());
      } catch (_) {}
    }
  }

  installWeatherGuards();

  const observer = new MutationObserver(() => {
    hideAdvancedNoise();
  });
  observer.observe(document.documentElement, { childList:true, subtree:true });

  window.addEventListener('stormlens:weather-layer-changed', event => {
    const id = event.detail?.id;
    requestAnimationFrame(() => numericProbabilityLegend(id));
  });

  window.addEventListener('stormlens:map-ready', () => {
    hideAdvancedNoise();
    hideUnavailableTomorrowLayers();
    const engine = window.StormLensMapV10;
    if (engine?.selectedLayer === 'showalter') engine.selectLayer('storm');
  });
})();
