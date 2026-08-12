(() => {
  let attached = false;
  let errorCount = 0;
  let firstError = '';
  let healthy = false;
  let timer = null;
  let activeObserver = null;

  function mapScreenIsVisible() {
    const screen = document.getElementById('mapScreen');
    if (!screen) return false;
    return screen.classList.contains('active') && screen.getBoundingClientRect().width > 100 && screen.getBoundingClientRect().height > 180;
  }

  function setDiagnostic(text, state='loading') {
    const pill = document.getElementById('mapStatusPill');
    const label = document.getElementById('mapLayerStatus');
    if (pill) pill.dataset.engineState = state;
    if (label) label.dataset.engineDiagnostic = text || '';
  }

  function fail(reason) {
    if (healthy) return;
    clearTimeout(timer);
    setDiagnostic(reason, 'error');
    window.dispatchEvent(new CustomEvent('stormlens:v7-fatal', { detail:{ reason } }));
  }

  function inspect() {
    const engine = window.StormLensMapV7;
    const map = engine?.map;
    const container = document.getElementById('stormlensMapV7');
    if (!map || !container || !mapScreenIsVisible()) return false;

    const rect = container.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 180) {
      try { map.resize(); } catch (_) {}
      return false;
    }

    const canvas = container.querySelector('canvas');
    if (!canvas || canvas.width < 100 || canvas.height < 180) {
      try { map.resize(); } catch (_) {}
      return false;
    }

    const styleReady = typeof map.isStyleLoaded === 'function' ? map.isStyleLoaded() : true;
    if (!styleReady) return false;

    healthy = true;
    clearTimeout(timer);
    document.documentElement.dataset.mapRender = 'healthy';
    document.documentElement.dataset.mapEngine = 'v7';
    setDiagnostic('MapTiler WebGL ready', 'healthy');
    return true;
  }

  function startVisibleHealthWindow() {
    if (healthy || !mapScreenIsVisible()) return;
    const map = window.StormLensMapV7?.map;
    try { map?.resize?.(); } catch (_) {}
    clearTimeout(timer);
    setDiagnostic('Checking MapTiler WebGL', 'loading');
    [80, 280, 750, 1600, 3200].forEach(delay => setTimeout(inspect, delay));
    timer = setTimeout(() => {
      if (inspect()) return;
      const reason = errorCount
        ? `MapTiler render failed: ${firstError.slice(0,100)}`
        : 'MapTiler canvas did not become ready while Map was visible';
      fail(reason);
    }, 12000);
  }

  function watchScreenVisibility() {
    const screen = document.getElementById('mapScreen');
    if (!screen || !window.MutationObserver) return;
    activeObserver?.disconnect?.();
    activeObserver = new MutationObserver(() => {
      if (screen.classList.contains('active')) {
        requestAnimationFrame(() => requestAnimationFrame(startVisibleHealthWindow));
      } else {
        clearTimeout(timer);
      }
    });
    activeObserver.observe(screen, { attributes:true, attributeFilter:['class'] });
    if (screen.classList.contains('active')) startVisibleHealthWindow();
  }

  function attach() {
    if (attached) return;
    const map = window.StormLensMapV7?.map;
    if (!map) return setTimeout(attach, 80);
    attached = true;

    map.on('error', event => {
      const message = String(event?.error?.message || event?.message || 'MapTiler render error');
      errorCount += 1;
      if (!firstError) firstError = message;
      console.warn('[StormLens V7 map error]', message);
      setDiagnostic(message, 'error');
      if (/401|403|unauthori|forbidden|api.?key|access denied|origin/i.test(message)) {
        fail('MapTiler key or allowed-origin restriction');
      }
    });

    map.on('load', () => {
      requestAnimationFrame(() => {
        try { map.resize(); } catch (_) {}
        if (mapScreenIsVisible()) startVisibleHealthWindow();
      });
    });

    map.on('idle', () => {
      if (mapScreenIsVisible()) inspect();
    });

    const container = document.getElementById('stormlensMapV7');
    if (container && window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        if (!mapScreenIsVisible()) return;
        try { map.resize(); } catch (_) {}
        inspect();
      });
      ro.observe(container);
    }

    watchScreenVisibility();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once:true });
  else attach();
})();
