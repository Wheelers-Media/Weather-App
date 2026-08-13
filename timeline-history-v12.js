(() => {
  'use strict';

  const HOUR=3600000, MINUTE=60000;
  let history={active:false,layer:null,nativeMin:0,coreMin:0,max:0,id:null};
  let playTimer=null;
  let handingOff=false;

  const $=q=>document.querySelector(q);
  const engine=()=>window.StormLensMapV10||null;
  function refreshIcons(){if(window.lucide)requestAnimationFrame(()=>window.lucide.createIcons());}

  function stopHistoryPlayback(){
    clearTimeout(playTimer);playTimer=null;
    const play=$('#radarPlay');
    if(play){play.innerHTML='<i data-lucide="play"></i>';refreshIcons();}
  }

  function currentWeatherLayer(){
    const e=engine();
    if(e?.weatherLayer&&typeof e.weatherLayer.getAnimationStartDate==='function')return e.weatherLayer;
    const map=e?.map;if(!map)return null;
    const ids=(map.getStyle?.()?.layers||[]).map(l=>l.id).filter(id=>String(id).startsWith('stormlens-v10-'));
    for(let i=ids.length-1;i>=0;i--){
      try{
        const layer=map.getLayer(ids[i]);
        if(layer&&typeof layer.getAnimationStartDate==='function'&&typeof layer.setAnimationTime==='function')return layer;
      }catch(_){}
    }
    return null;
  }

  function ensureTrack(){
    const slider=$('#radarTimeline');if(!slider)return null;
    if(slider.parentElement?.classList.contains('v13-timeline-track'))return slider.parentElement;
    const oldParent=slider.parentElement;
    oldParent?.classList.remove('v12-timeline-wrap');
    const track=document.createElement('div');
    track.className='v13-timeline-track';
    slider.parentNode.insertBefore(track,slider);
    track.appendChild(slider);
    return track;
  }

  function ensureNowMarker(){
    const track=ensureTrack();if(!track)return null;
    let marker=track.querySelector('.v12-now-marker');
    if(!marker){marker=document.createElement('span');marker.className='v12-now-marker';track.appendChild(marker);}
    return marker;
  }

  function ensureNote(){
    const controller=$('#radarController');if(!controller)return null;
    let note=controller.querySelector('.v12-history-note');
    if(!note){
      note=document.createElement('div');
      note.className='v12-history-note';
      note.innerHTML='<b></b><span>Past frames are shown only when this weather source publishes real historical data.</span>';
      const source=$('#radarSourceLine');
      source?.insertAdjacentElement('afterend',note);
    }
    return note;
  }

  function setProgress(slider){
    const min=Number(slider.min),max=Number(slider.max),v=Number(slider.value),pct=max>min?((v-min)/(max-min))*100:0;
    slider.style.setProperty('--v10-progress',`${Math.max(0,Math.min(100,pct))}%`);
  }

  function stamp(ms){
    const node=$('#radarTimestamp');
    if(node)node.textContent=new Date(ms).toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  }

  function pastLabel(ms){
    const diff=Math.max(0,Math.round((Date.now()-ms)/HOUR));
    if(diff<1)return'NOW';
    if(diff<24)return`PAST ${diff}H`;
    return`PAST ${Math.round(diff/24)}D`;
  }

  function positionNowMarker(){
    const slider=$('#radarTimeline'),marker=ensureNowMarker();if(!slider||!marker)return;
    const min=Number(slider.min),max=Number(slider.max),now=Date.now();
    if(!Number.isFinite(min)||!Number.isFinite(max)||max<=min){marker.hidden=true;return;}
    const pct=((now-min)/(max-min))*100;
    marker.hidden=pct<0||pct>100;
    marker.style.left=`${Math.max(0,Math.min(100,pct))}%`;
  }

  function resetHistory(){
    stopHistoryPlayback();
    history={active:false,layer:null,nativeMin:0,coreMin:0,max:0,id:null};
    $('#radarController')?.classList.remove('v12-has-history','v12-timeline-wrap');
    const note=ensureNote();if(note)note.hidden=true;
    positionNowMarker();
  }

  function refreshHistory(detail){
    stopHistoryPlayback();
    const def=detail?.def,id=detail?.id,slider=$('#radarTimeline');
    ensureTrack();
    if(!slider||def?.provider!=='maptiler'){resetHistory();return;}
    setTimeout(()=>{
      const layer=currentWeatherLayer();if(!layer)return resetHistory();
      let nativeMin=NaN;
      try{nativeMin=+layer.getAnimationStartDate();}catch(_){return resetHistory();}
      const coreMin=Number(slider.min),max=Number(slider.max);
      if(!Number.isFinite(nativeMin)||!Number.isFinite(coreMin)||!Number.isFinite(max)||nativeMin>=coreMin-15*MINUTE){resetHistory();return;}
      history={active:true,layer,nativeMin,coreMin,max,id};
      slider.min=String(nativeMin);
      slider.value=String(Math.max(nativeMin,Math.min(max,Number(slider.value)||coreMin)));
      setProgress(slider);
      const start=$('#timelineStartLabel');if(start)start.textContent=pastLabel(nativeMin);
      $('#radarController')?.classList.add('v12-has-history');
      const note=ensureNote();if(note)note.hidden=false;
      positionNowMarker();
    },220);
  }

  function setHistoryTime(ms){
    if(!history.active||!history.layer)return;
    const slider=$('#radarTimeline');if(!slider)return;
    const t=Math.max(history.nativeMin,Math.min(history.coreMin,ms));
    slider.value=String(t);setProgress(slider);stamp(t);
    try{history.layer.setAnimationTime(Math.round(t/1000));}catch(_){}
  }

  function continueIntoForecast(){
    if(handingOff||history.max<=history.coreMin+MINUTE)return;
    handingOff=true;
    requestAnimationFrame(()=>{
      handingOff=false;
      const play=$('#radarPlay');
      if(play)play.click();
    });
  }

  function playHistory(){
    if(playTimer||!history.active)return;
    const slider=$('#radarTimeline');if(!slider)return;
    const play=$('#radarPlay');
    if(play){play.innerHTML='<i data-lucide="pause"></i>';refreshIcons();}
    const tick=()=>{
      if(!history.active){stopHistoryPlayback();return;}
      const current=Number(slider.value||history.nativeMin);
      const next=Math.min(history.coreMin,current+15*MINUTE);
      setHistoryTime(next);
      if(next>=history.coreMin){stopHistoryPlayback();continueIntoForecast();return;}
      playTimer=setTimeout(tick,300);
    };
    playTimer=setTimeout(tick,120);
  }

  document.addEventListener('input',event=>{
    if(event.target?.id!=='radarTimeline'||!history.active)return;
    const value=Number(event.target.value);
    if(value<history.coreMin){event.stopImmediatePropagation();stopHistoryPlayback();setHistoryTime(value);}
  },true);

  document.addEventListener('change',event=>{
    if(event.target?.id!=='radarTimeline'||!history.active)return;
    const value=Number(event.target.value);
    if(value<history.coreMin){event.stopImmediatePropagation();setHistoryTime(value);}
  },true);

  document.addEventListener('click',event=>{
    if(!history.active)return;
    const slider=$('#radarTimeline');
    const back=event.target.closest?.('#radarStepBack');
    if(back){
      const current=Number(slider?.value||history.coreMin);
      if(current<=history.coreMin){event.preventDefault();event.stopImmediatePropagation();stopHistoryPlayback();setHistoryTime(current-HOUR);return;}
    }
    const forward=event.target.closest?.('#radarStepForward');
    if(forward){
      const current=Number(slider?.value||history.coreMin);
      if(current<history.coreMin){event.preventDefault();event.stopImmediatePropagation();stopHistoryPlayback();setHistoryTime(Math.min(history.coreMin,current+HOUR));return;}
    }
    const play=event.target.closest?.('#radarPlay');
    if(play){
      const current=Number(slider?.value||history.coreMin);
      if(current<history.coreMin||playTimer){
        event.preventDefault();event.stopImmediatePropagation();
        if(playTimer){stopHistoryPlayback();return;}
        playHistory();
      }
    }
  },true);

  window.addEventListener('stormlens:weather-layer-changed',event=>refreshHistory(event.detail));
  window.addEventListener('stormlens:map-ready',()=>{ensureTrack();ensureNowMarker();ensureNote();positionNowMarker();});
  window.addEventListener('resize',positionNowMarker);
  window.visualViewport?.addEventListener('resize',positionNowMarker);
})();
