(() => {
  'use strict';

  const SOURCE='stormlens-location-accuracy-source';
  const FILL='stormlens-location-accuracy-fill';
  const LINE='stormlens-location-accuracy-line';
  let fingerprint='';

  function map(){ return window.StormLensMapV10?.map || null; }
  function readLocation(){
    try { return JSON.parse(localStorage.getItem('stormlens-location') || 'null'); }
    catch (_) { return null; }
  }
  function circle(lon,lat,radiusM){
    const steps=56, coords=[];
    const dLat=radiusM/111320;
    const dLon=radiusM/(111320*Math.max(.2,Math.cos(lat*Math.PI/180)));
    for(let i=0;i<=steps;i++){
      const a=(i/steps)*Math.PI*2;
      coords.push([lon+Math.cos(a)*dLon,lat+Math.sin(a)*dLat]);
    }
    return {type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[coords]}}]};
  }
  function remove(){
    const m=map(); if(!m)return;
    try{if(m.getLayer(FILL))m.removeLayer(FILL);}catch(_){}
    try{if(m.getLayer(LINE))m.removeLayer(LINE);}catch(_){}
    try{if(m.getSource(SOURCE))m.removeSource(SOURCE);}catch(_){}
  }
  function render(){
    const m=map(), loc=readLocation();
    if(!m?.isStyleLoaded?.()||!loc||loc.source!=='device')return remove();
    const lat=Number(loc.latitude),lon=Number(loc.longitude),accuracy=Number(loc.accuracy||0);
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||!Number.isFinite(accuracy)||accuracy<=0)return remove();
    const radius=Math.min(25000,Math.max(accuracy,8));
    const data=circle(lon,lat,radius);
    if(m.getSource(SOURCE))m.getSource(SOURCE).setData(data);
    else{
      m.addSource(SOURCE,{type:'geojson',data});
      m.addLayer({id:FILL,type:'fill',source:SOURCE,paint:{'fill-color':'#59adf5','fill-opacity':accuracy<=50?.055:accuracy<=250?.075:.10}});
      m.addLayer({id:LINE,type:'line',source:SOURCE,paint:{'line-color':'#74bdff','line-opacity':accuracy<=50?.25:.5,'line-width':1.2,'line-dasharray':[2,2]}});
    }
  }
  function sync(){
    const loc=readLocation();
    const next=loc?`${Number(loc.latitude).toFixed(6)},${Number(loc.longitude).toFixed(6)},${Math.round(Number(loc.accuracy||0))}`:'';
    if(next!==fingerprint){fingerprint=next;render();}
  }
  window.addEventListener('stormlens:map-ready',()=>setTimeout(render,100));
  window.addEventListener('stormlens:weather-layer-changed',()=>setTimeout(render,80));
  setInterval(sync,1000);
})();
