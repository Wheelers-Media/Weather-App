(() => {
  if (!window.L || !L.tileLayer || !L.tileLayer.wms) return;

  const originalWms = L.tileLayer.wms;

  L.tileLayer.wms = function (url, options = {}) {
    const layerName = options.layers || '';
    const isObservedRadar = layerName === 'RADAR_1KM_RRAI';
    const isRadarNowcast = layerName === 'Radar_1km_RainPrecipRate-Extrapolation';
    const patched = { ...options };

    if (isObservedRadar || isRadarNowcast) {
      // Follow ECCC's own web-map example: request the radar product with its
      // server default WMS style. WMS 1.1.1 is also the safest Leaflet path.
      patched.styles = '';
      patched.version = '1.1.1';
      patched.uppercase = false;
    }

    const layer = originalWms.call(this, url, patched);
    if (!isObservedRadar && !isRadarNowcast) return layer;

    let loaded = 0;
    let errors = 0;
    let settled = false;

    const setStatus = text => {
      const el = document.getElementById('mapLayerStatus');
      if (el) el.textContent = text;
    };

    layer.on('loading', () => {
      settled = false;
      setStatus(isObservedRadar ? 'Observed radar · connecting' : 'Radar nowcast · connecting');
    });

    layer.on('tileload', () => {
      loaded += 1;
      settled = true;
      if (loaded === 1) {
        setStatus(isObservedRadar ? 'Observed radar · LIVE' : 'Radar nowcast · LIVE');
      }
    });

    layer.on('tileerror', () => {
      errors += 1;
      if (loaded === 0 && errors >= 3) {
        settled = true;
        setStatus('Radar feed error · retrying');
        layer.redraw();
      }
      if (loaded === 0 && errors >= 8) {
        setStatus('ECCC radar unavailable right now');
      }
    });

    layer.on('load', () => {
      if (loaded > 0) {
        settled = true;
        const timestamp = document.getElementById('radarTimestamp');
        if (timestamp && timestamp.textContent === 'Latest available') {
          timestamp.textContent = 'Latest ECCC frame';
        }
      }
    });

    setTimeout(() => {
      if (!settled && loaded === 0 && errors === 0) {
        setStatus('Radar · waiting for ECCC');
      }
    }, 6000);

    return layer;
  };
})();
