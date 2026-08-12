(() => {
  let repairs = 0;
  function removeLegacyWeatherLayers() {
    const engine = window.StormLensMapV6;
    const map = engine?.map;
    if (!map) return;
    const remove=[];
    map.eachLayer(layer=>{
      if (layer?._stormlensWeatherV6 || layer?._stormlensBaseV6) return;
      if (layer?._stormlensProvider === 'rainviewer-fallback' || layer?.wmsParams?.layers) remove.push(layer);
    });
    remove.forEach(layer=>{ try { map.removeLayer(layer); } catch (_) {} });
  }

  function repair() {
    const engine=window.StormLensMapV6;
    if (!engine?.map || !engine.selectedLayer) return;
    removeLegacyWeatherLayers();
    repairs += 1;
    // Re-select once after the legacy async capabilities request has had time to finish.
    // This guarantees v6 owns the timeline, legend and weather frame shown to the user.
    if (repairs === 2) engine.selectLayer(engine.selectedLayer,{quiet:true});
  }

  function install() {
    repairs=0;
    [300,1200,2600].forEach(delay=>setTimeout(repair,delay));
  }

  window.addEventListener('stormlens:map-ready',install);
  if(window.StormLensMap) install();
})();
