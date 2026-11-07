// Camera/image decoding stays on the phone; no image is uploaded to the stock API.
(()=>{'use strict';
 const $=id=>document.getElementById(id),TRY_HARDER=3; // ZXing DecodeHintType.TRY_HARDER, pinned library enum.
 const reader=()=>new ZXingBrowser.BrowserMultiFormatReader(new Map([[TRY_HARDER,true]]));
 function create({onCode,onMessage}){
  const video=$('video');let stream=null,timer=null,generation=0,scanning=false,torch=false,frame=0,errors=0;
  const canvas=document.createElement('canvas'),rotated=document.createElement('canvas');
  const context=canvas.getContext('2d',{willReadFrequently:true}),rotateContext=rotated.getContext('2d',{willReadFrequently:true});
  function stop(){generation++;scanning=false;clearTimeout(timer);timer=null;if(stream)for(const t of stream.getTracks())t.stop();stream=null;video.pause();video.srcObject=null;video.hidden=true;$('camera-preview').hidden=true;$('stop').hidden=true;$('camera-device-wrap').hidden=true;$('camera-zoom-wrap').hidden=true;$('camera-light').hidden=true;torch=false;}
  function dimensions(source){return {width:source.videoWidth||source.naturalWidth||0,height:source.videoHeight||source.naturalHeight||0};}
  function capture(source,max=1600,crop=false){
   const d=dimensions(source);if(!d.width||!d.height)return false;
   const sx=crop?d.width*.1:0,sy=crop?d.height*.25:0,sw=crop?d.width*.8:d.width,sh=crop?d.height*.5:d.height,scale=Math.min(1,max/Math.max(sw,sh));
   canvas.width=Math.max(1,Math.round(sw*scale));canvas.height=Math.max(1,Math.round(sh*scale));context.drawImage(source,sx,sy,sw,sh,0,0,canvas.width,canvas.height);return true;
  }
  function decode(r,turn=false){
   if(!turn)return r.decodeFromCanvas(canvas).getText();
   rotated.width=canvas.height;rotated.height=canvas.width;rotateContext.setTransform(0,1,-1,0,canvas.height,0);rotateContext.drawImage(canvas,0,0);return r.decodeFromCanvas(rotated).getText();
  }
  function result(text,session){if(session!==generation||!text)return;stop();onCode(text);}
  async function cameraOptions(track,session){
   try{const caps=track.getCapabilities?.()||{};
    if(caps.focusMode?.includes('continuous'))await track.applyConstraints({advanced:[{focusMode:'continuous'}]}).catch(()=>{});
    if(session!==generation)return;
    if(caps.zoom&&caps.zoom.max>caps.zoom.min){const z=$('camera-zoom');z.min=caps.zoom.min;z.max=Math.max(caps.zoom.min,Math.min(caps.zoom.max,4));z.step=caps.zoom.step||.1;z.value=track.getSettings().zoom||caps.zoom.min;$('camera-zoom-wrap').hidden=false;z.oninput=()=>{if(session===generation)track.applyConstraints({advanced:[{zoom:Number(z.value)}]}).catch(()=>onMessage('Ezen a kamerán a nagyítás nem állítható.'));};}
    if(caps.torch){$('camera-light').hidden=false;$('camera-light').textContent='Lámpa bekapcsolása';$('camera-light').onclick=async()=>{if(session!==generation)return;try{await track.applyConstraints({advanced:[{torch:!torch}]});torch=!torch;$('camera-light').textContent=torch?'Lámpa kikapcsolása':'Lámpa bekapcsolása';}catch{onMessage('Ezen a kamerán a lámpa nem kapcsolható.');}};}
    const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');if(session!==generation)return;
    if(devices.length>1){const select=$('camera-device');select.replaceChildren();for(const [index,d]of devices.entries()){const option=document.createElement('option');option.value=d.deviceId;option.textContent=d.label||('Kamera '+(index+1));select.append(option);}select.value=track.getSettings().deviceId||devices[0].deviceId;$('camera-device-wrap').hidden=false;select.onchange=()=>start(select.value).catch(e=>onMessage(e.message));}
   }catch{/* Optional focus, zoom and camera enumeration must not stop scanning. */}
  }
  async function start(deviceId){
   stop();const session=generation;if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error('A kamerához a saját HTTPS-címet és megbízható helyi tanúsítványt használd.');
   onMessage('Kamera indítása…');$('camera').disabled=true;
   try{
    const constraints={audio:false,video:{...(deviceId?{deviceId:{exact:deviceId}}:{facingMode:{ideal:'environment'}}),width:{ideal:1920},height:{ideal:1080}}};
    const opened=await navigator.mediaDevices.getUserMedia(constraints);if(session!==generation){for(const t of opened.getTracks())t.stop();return;}
    stream=opened;video.muted=true;video.setAttribute('playsinline','');video.srcObject=stream;video.hidden=false;$('camera-preview').hidden=false;$('stop').hidden=false;
    await video.play();const since=Date.now();while(session===generation&&(!video.videoWidth||!video.videoHeight||video.readyState<2)){if(Date.now()-since>8000)throw Error('A kamera még nem ad olvasható képet. Próbáld újra vagy készíts fotót.');await new Promise(r=>setTimeout(r,50));}
    if(session!==generation)return;scanning=true;frame=0;errors=0;const r=reader();void cameraOptions(stream.getVideoTracks()[0],session);
    onMessage('Kamera aktív. A teljes kód legyen élesen a keretben. Fordíthatod vízszintesre, vagy használhatod a Fotó készítése gombot.');
    function loop(){
     if(session!==generation||!scanning)return;
     try{if(video.readyState>=2&&capture(video)){
       let text;try{text=decode(r);}catch(first){try{text=decode(r,true);}catch(second){if(frame%3===2&&capture(video,1600,true)){try{text=decode(r);}catch{try{text=decode(r,true);}catch{}}}if(first instanceof TypeError||first instanceof ReferenceError||first.name==='SecurityError')throw first;}}
       if(text){result(text,session);return;}errors=0;frame++;if(frame===12)onMessage('Még nem sikerült felismerni. Legyen éles a teljes kód; próbálj másik hátlapi kamerát, nagyítást vagy a Fotó készítése gombot.');
      }}catch(e){errors++;if(errors>=3){stop();onMessage('A kamera képe nem dolgozható fel. Próbáld a Fotó készítése / kép beolvasása gombot.');return;}}
     if(session===generation)timer=setTimeout(loop,180);
    }
    loop();
   }catch(e){if(session===generation){stop();throw Error('A kamera nem indítható. '+(e.message||'Engedélyezd a kamerát a böngészőben.'));}}
   finally{$('camera').disabled=false;}
  }
  async function photo(file){
   stop();if(!file)return;const session=generation;onMessage('Kép feldolgozása…');const url=URL.createObjectURL(file),image=new Image();
   try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('A kép nem nyitható meg. Készíts új fényképet a címkéről.'));image.src=url;});if(session!==generation)return;
    const r=reader();for(const crop of [false,true])for(const size of [2000,1000]){capture(image,size,crop);for(const turn of [false,true]){try{const text=decode(r,turn);if(text){result(text,session);return;}}catch{}}}
    onMessage('A képen nem sikerült kódot felismerni. Fotózd közelebbről, élesen, a teljes vonalkóddal és a szélein üres hellyel, vagy írd be kézzel a számát.');
   }catch(e){onMessage(e.message||'Nem sikerült a kép beolvasása.');}finally{URL.revokeObjectURL(url);}
  }
  return {start,stop,photo};
 }
 window.StockCamera={create};
})();
