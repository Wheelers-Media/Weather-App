(() => {
  if (!window.L || !L.tileLayer || !L.tileLayer.wms) return;

  const originalWms = L.tileLayer.wms;

  L.tileLayer.wms = function (url, options = {}) {
    const layerName = options.layers || '';
    const isObservedRadar = layerName === 'RADAR_1KM_RRAI';
    const isRadarNowcast = layerName === 'Radar_1km_RainPrecipRate-Extrapolation';

    const patched = { ...options };

    if (isObservedRadar) {
      // Use the current ECCC rain-radar palette and the most broadly compatible
      // WMS version for Leaflet tile requests.
      patched.styles = 'Radar-Rain_14colors';
      patched.version = '1.1.1';
      patched.uppercase = false;
    }

    if (isRadarNowcast) {
      // Let GeoMet choose its default style. Applying the observed-radar style to
      // the nowcast product can return empty/error tiles on some GeoMet revisions.
      patched.styles = '';
      patched.version = '1.1.1';
      patched.uppercase = false;
    }

    const layer = originalWms.call(this, url, patched);

    if (!isObservedRadar && !isRadarNowcast) return layer;

    let loaded = 0;
    let errors = 0;
    let fallbackTried = false;

    const setStatus = text => {
      const el = document.getElementById('mapLayerStatus');
      if (el) el.textContent = text;
    };

    layer.on('loading', () => {
      setStatus(isObservedRadar ? 'Observed radar · connecting' : 'Radar nowcast · connecting');
    });

    layer.on('tileload', () => {
      loaded += 1;
      if (loaded === 1) {
        setStatus(isObservedRadar ? 'Observed radar · LIVE' : 'Radar nowcast · LIVE');
      }
    });

    layer.on('tileerror', () => {
      errors += 1;
      if (!fallbackTried && loaded === 0 && errors >= 2) {
        fallbackTried = true;
        // Final compatibility fallback: use ECCC's default style.
        layer.wmsParams.styles = '';
        layer.wmsParams.version = '1.1.1';
        layer.options.uppercase = false;
        setStatus('Radar · retrying ECCC feed');
        layer.redraw();
      } else if (fallbackTried && loaded === 0 && errors >= 6) {
        setStatus('Radar feed unavailable · tap another layer');
      }
    });

    layer.on('load', () => {
      if (loaded > 0) {
        const timestamp = document.getElementById('radarTimestamp');
        if (timestamp && timestamp.textContent === 'Latest available') {
          timestamp.textContent = 'Latest ECCC frame';
        }
      }
    });

    return layer;
  };
})();
