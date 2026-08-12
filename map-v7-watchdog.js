(() => {
  let attached = false;
  let errorCount = 0;
  let firstError = '';
  let healthy = false;
  let timer = null;

  function fail(reason) {
    if (healthy) return;
    clearTimeout(timer);
    window.dispatchEvent(new CustomEvent('stormlens:v7-fatal', { detail:{ reason } }));
  }

  function inspect() {
    const engine = window.StormLensMapV7;
    const map = engine?.map;
    const container = document.getElementById('stormlensMapV7');
    if (!map || !container) return false;

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
    document.documentElement.dataset.mapRender='healthy';
    return true;
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
      if (/401|403|unauthori|forbidden|api.?key|access denied/i.test(message)) {
        fail('MapTiler key/domain blocked');
      }
    });

    map.on('load', () => {
      requestAnimationFrame(() => {
        try { map.resize(); } catch (_) {}
        setTimeout(inspect, 150);
        setTimeout(inspect, 700);
      });
    });

    map.on('idle', inspect);

    const container = document.getElementById('stormlensMapV7');
    if (container && window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        try { map.resize(); } catch (_) {}
        inspect();
      });
      ro.observe(container);
    }

    // Never leave the user staring at a blank WebGL canvas.
    timer = setTimeout(() => {
      if (inspect()) return;
      const reason = errorCount ? `MapTiler render failed: ${firstError.slice(0,80)}` : 'MapTiler canvas did not render';
      fail(reason);
    }, 6500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once:true });
  else attach();
})();
