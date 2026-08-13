(() => {
  'use strict';

  const HOUR=3600000,MINUTE=60000;
  let history={active:false,layer:null,nativeMin:0,coreMin:0,max:0,id:null};
  let playTimer=null;

  const $=q=>document.querySelector(q);
  const engine=()=>window.StormLensMapV10||null;
  function refreshIcons(){if(window.lucide)requestAnimationFrame(()=>window.lucide.createIcons());}
  function stopHistoryPlayback(){clearInterval(playTimer);playTimer=null;const play=$('#radarPlay');if(play){play.innerHTML='<i data-lucide="play"></i>';refreshIcons();}}

  function currentWeatherLayer(){
    const e=engine(),map=e?.map;if(!map)return null;
    const ids=(map.getStyle?.()?.layers||[]).map(l=>l.id).filter(id=>String(id).startsWith('stormlens-v10-'));
    for(let i=ids.length-1;i>=0;i--){
      try{const layer=map.getLayer(ids[i]);if(layer&&typeof layer.getAnimationStartDate==='function'&&typeof layer.setAnimationTime==='function')return layer;}catch(_){}
    }
    return null;
  }

  function setProgress(slider){
    const min=Number(slider.min),max=Number(slider.max),v=Number(slider.value),pct=max>min?((v-min)/(max-min))*100:0;
    slider.style.setProperty('--v10-progress',`${Math.max(0,Math.min(100,pct))}%`);
  }
  function stamp(ms){
    const node=$('#radarTimestamp');if(node)node.textContent=new Date(ms).toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  }
  function leftLabel(ms){const diff=Math.max(0,Math.round((Date.now()-ms)/HOUR));return diff>0?`PAST ${diff}H`:'NOW';}

  function ensureNowMarker(){
    const slider=$('#radarTimeline');if(!slider)return null;
    const parent=slider.parentElement;if(!parent)return null;
    parent.classList.add('v12-timeline-wrap');
    let marker=parent.querySelector('.v12-now-marker');if(!marker){marker=document.createElement('span');marker.className='v12-now-marker';parent.appendChild(marker);}
    return marker;
  }
  function ensureNote(){
    const controller=$('#radarController');if(!controller)return null;
    let note=controller.querySelector('.v12-history-note');if(!note){note=document.createElement('div');note.className='v12-history-note';note.innerHTML='<b></b><span>Past frames appear only when the active weather source publishes them.</span>';const source=$('#radarSourceLine');source?.insertAdjacentElement('afterend',note);}
    return note;
  }
  function positionNowMarker(){
    const slider=$('#radarTimeline'),marker=ensureNowMarker();if(!slider||!marker)return;
    const min=Number(slider.min),max=Number(slider.max),now=Date.now();
    if(!Number.isFinite(min)||!Number.isFinite(max)||max<=min){marker.hidden=true;return;}
    const pct=((now-min)/(max-min))*100;marker.hidden=pct<0||pct>100;marker.style.left=`${Math.max(0,Math.min(100,pct))}%`;
  }

  function resetHistory(){
    stopHistoryPlayback();history={active:false,layer:null,nativeMin:0,coreMin:0,max:0,id:null};
    $('#radarController')?.classList.remove('v12-has-history');
    const note=ensureNote();if(note)note.hidden=true;
    positionNowMarker();
  }

  function refreshHistory(detail){
    stopHistoryPlayback();
    const def=detail?.def,id=detail?.id,slider=$('#radarTimeline');
    if(!slider||def?.provider!=='maptiler'){resetHistory();return;}
    setTimeout(()=>{
      const layer=currentWeatherLayer();if(!layer)return resetHistory();
      let nativeMin=NaN;
      try{nativeMin=+layer.getAnimationStartDate();}catch(_){return resetHistory();}
      const coreMin=Number(slider.min),max=Number(slider.max);
      if(!Number.isFinite(nativeMin)||!Number.isFinite(coreMin)||nativeMin>=coreMin-15*MINUTE){resetHistory();return;}
      history={active:true,layer,nativeMin,coreMin,max,id};
      slider.min=String(nativeMin);setProgress(slider);
      const start=$('#timelineStartLabel');if(start)start.textContent=leftLabel(nativeMin);
      $('#radarController')?.classList.add('v12-has-history');
      const note=ensureNote();if(note)note.hidden=false;
      positionNowMarker();
    },180);
  }

  function setHistoryTime(ms){
    if(!history.active||!history.layer)return;
    const slider=$('#radarTimeline');if(!slider)return;
    const t=Math.max(history.nativeMin,Math.min(history.coreMin,ms));
    slider.value=String(t);setProgress(slider);stamp(t);
    try{history.layer.setAnimationTime(Math.round(t/1000));}catch(_){}
  }

  document.addEventListener('input',event=>{
    if(event.target?.id!=='radarTimeline'||!history.active)return;
    const value=Number(event.target.value);
    if(value<history.coreMin){event.stopImmediatePropagation();setHistoryTime(value);}
  },true);

  document.addEventListener('change',event=>{
    if(event.target?.id!=='radarTimeline'||!history.active)return;
    const value=Number(event.target.value);
    if(value<history.coreMin){event.stopImmediatePropagation();setHistoryTime(value);}
  },true);

  document.addEventListener('click',event=>{
    if(!history.active)return;
    const back=event.target.closest?.('#radarStepBack');
    if(back){
      const slider=$('#radarTimeline'),current=Number(slider?.value||history.coreMin);
      if(current<=history.coreMin){event.preventDefault();event.stopImmediatePropagation();setHistoryTime(current-HOUR);return;}
    }
    const forward=event.target.closest?.('#radarStepForward');
    if(forward){
      const slider=$('#radarTimeline'),current=Number(slider?.value||history.coreMin);
      if(current<history.coreMin){event.preventDefault();event.stopImmediatePropagation();setHistoryTime(Math.min(history.coreMin,current+HOUR));return;}
    }
    const play=event.target.closest?.('#radarPlay');
    if(play){
      const slider=$('#radarTimeline'),current=Number(slider?.value||history.coreMin);
      if(current<history.coreMin||playTimer){
        event.preventDefault();event.stopImmediatePropagation();
        if(playTimer){stopHistoryPlayback();return;}
        play.innerHTML='<i data-lucide="pause"></i>';refreshIcons();
        playTimer=setInterval(()=>{
          const nowValue=Number(slider.value);const next=Math.min(history.coreMin,nowValue+15*MINUTE);setHistoryTime(next);if(next>=history.coreMin)stopHistoryPlayback();
        },420);
      }
    }
  },true);

  window.addEventListener('stormlens:weather-layer-changed',event=>refreshHistory(event.detail));
  window.addEventListener('stormlens:map-ready',()=>{ensureNowMarker();ensureNote();positionNowMarker();});
  window.addEventListener('resize',positionNowMarker);
})();
