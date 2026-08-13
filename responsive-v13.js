(() => {
  'use strict';

  let resizeRaf=0;
  let lastWidth=0;
  let lastHeight=0;

  function viewportSize(){
    const vv=window.visualViewport;
    return {
      width:Math.round(vv?.width||window.innerWidth||document.documentElement.clientWidth||0),
      height:Math.round(vv?.height||window.innerHeight||document.documentElement.clientHeight||0)
    };
  }

  function classify(width,height){
    if(height<620&&width>height)return'landscape-compact';
    if(width<760)return'phone';
    if(width<1180)return'tablet';
    return'desktop';
  }

  function applyViewport(){
    resizeRaf=0;
    const {width,height}=viewportSize();
    if(!width||!height)return;
    document.documentElement.style.setProperty('--sl-viewport-height',`${height}px`);
    document.documentElement.style.setProperty('--sl-viewport-width',`${width}px`);
    document.documentElement.dataset.stormlensViewport=classify(width,height);

    const sizeChanged=Math.abs(width-lastWidth)>1||Math.abs(height-lastHeight)>1;
    lastWidth=width;lastHeight=height;
    if(sizeChanged){
      requestAnimationFrame(()=>{
        try{window.StormLensMapV10?.map?.resize?.();}catch(_){}
        try{window.StormLensMap?.resize?.();}catch(_){}
      });
    }
  }

  function schedule(){
    if(resizeRaf)return;
    resizeRaf=requestAnimationFrame(applyViewport);
  }

  applyViewport();
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(schedule,80),{passive:true});
  window.visualViewport?.addEventListener('resize',schedule,{passive:true});
  window.visualViewport?.addEventListener('scroll',schedule,{passive:true});

  window.addEventListener('stormlens:map-ready',()=>{
    schedule();
    const mapNode=document.getElementById('weatherMap');
    if(mapNode&&window.ResizeObserver){
      const observer=new ResizeObserver(()=>{
        requestAnimationFrame(()=>{
          try{window.StormLensMapV10?.map?.resize?.();}catch(_){}
        });
      });
      observer.observe(mapNode);
    }
  });
})();
