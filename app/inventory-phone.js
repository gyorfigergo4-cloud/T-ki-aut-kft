(()=>{'use strict';const $=id=>document.getElementById(id);let token='',product=null,busy=false;
 const pending=()=>{try{return JSON.parse(localStorage.getItem('toki-stock-pending')||'null');}catch{return null;}};
 function message(s){$('status').textContent=s;}
 async function api(command){const r=await fetch('/api/stock',{method:command?'POST':'GET',headers:{Authorization:'Bearer '+token,...(command?{'Content-Type':'application/json'}:{})},...(command?{body:JSON.stringify(command)}:{})});const d=await r.json();if(!r.ok){const e=Error(d.error||'Nem sikerült a művelet.');e.definitive=r.status<500;throw e;}return d;}
 const camera=StockCamera.create({onMessage:message,onCode:text=>{$('barcode').value=text;find().catch(e=>message(e.message));}});
 function stop(){camera.stop();}
 function show(p){product=p;$('product-name').textContent=p?.name||'';$('stock').textContent=p?'Cikkszám: '+p.sku+' · Készlet: '+p.quantity+' db':'';$('receive').hidden=!p;}
 async function find(){stop();const code=$('barcode').value.trim();if(!code)return;const d=await api();const k=s=>s.trim().normalize('NFC').toLocaleLowerCase('hu');const p=d.products.find(p=>k(p.sku)===k(code)||p.barcodes.some(b=>k(b)===k(code)));$('phone-results').replaceChildren();show(p);$('new-product').hidden=true;
  if(p){message('Ellenőrizd a terméket és a darabszámot, majd nyomj Hozzáadás-t.');return;}
  const fold=s=>k(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'');const matches=d.products.filter(p=>fold([p.name,p.sku,...p.barcodes].join(' ')).includes(fold(code)));
  if(matches.length){message(matches.length+' találat. Válassz terméket.'+(matches.length>80?' Szűkítsd a keresést, az első 80 látható.':''));for(const p of matches.slice(0,80)){const b=document.createElement('button');b.type='button';b.textContent=p.name+' · '+p.sku+' · '+p.quantity+' db';b.onclick=()=>{show(p);$('barcode').value=p.sku;$('phone-results').replaceChildren();message('Ellenőrizd a terméket és a darabszámot, majd nyomj Hozzáadás-t.');};$('phone-results').append(b);}return;}
  $('new-product').hidden=false;$('sku').value=code;message('Ismeretlen vonalkód vagy cikkszám. Add meg a termék nevét és cikkszámát, vagy pontosítsd a keresést.');
 }
 async function send(c){if(busy)return;busy=true;const existing=pending();if(existing&&JSON.stringify(existing)!==JSON.stringify(c)){busy=false;throw Error('Előbb próbáld újra a függő műveletet.');}localStorage.setItem('toki-stock-pending',JSON.stringify(c));$('retry').hidden=false;for(const b of document.querySelectorAll('button'))b.disabled=true;
  try{const d=await api(c);localStorage.removeItem('toki-stock-pending');$('retry').hidden=true;if(c.type==='product')await find();else{show(d.products.find(p=>p.id===c.productId));$('quantity').value='1';message('✓ A bevételezés elkészült.');}return d;}
  catch(e){if(e.definitive){localStorage.removeItem('toki-stock-pending');$('retry').hidden=true;}throw e;}
  finally{busy=false;for(const b of document.querySelectorAll('button'))b.disabled=false;}
 }
 $('login').onsubmit=async e=>{e.preventDefault();token=$('code').value.replace(/[\s-]/g,'').toLowerCase();try{await api();$('scanner').hidden=false;$('login').hidden=true;$('retry').hidden=!pending();message('Kapcsolódva. A telefon a központtal azonos helyi hálózaton legyen.');}catch(e){message(e.message);}};
 $('scan').onsubmit=e=>{e.preventDefault();find().catch(e=>message(e.message));};
 $('receive').onsubmit=e=>{e.preventDefault();if(!product)return;send({type:'receive',id:crypto.randomUUID(),productId:product.id,quantity:Number($('quantity').value)}).catch(e=>message(e.message));};
 $('new-product').onsubmit=e=>{e.preventDefault();send({type:'product',id:crypto.randomUUID(),product:{name:$('name').value,sku:$('sku').value,barcodes:[$('barcode').value.trim()]}}).catch(e=>message(e.message));};
 $('retry').onclick=()=>{const c=pending();if(c)send(c).catch(e=>message(e.message));};
 $('camera').onclick=()=>{if(busy||pending()){message('Előbb fejezd be a függő műveletet.');return;}show(null);$('new-product').hidden=true;$('phone-results').replaceChildren();camera.start().catch(e=>message(e.message));};
 $('photo').onclick=()=>{if(busy||pending()){message('Előbb fejezd be a függő műveletet.');return;}stop();$('photo-file').click();};
 $('photo-file').onchange=async()=>{if(busy||pending())return;const file=$('photo-file').files?.[0];if(file){show(null);$('new-product').hidden=true;$('phone-results').replaceChildren();await camera.photo(file);}$('photo-file').value='';};
 $('stop').onclick=stop;$('logout').onclick=()=>{stop();token='';$('code').value='';$('scanner').hidden=true;$('login').hidden=false;message('Kiléptél.');};window.addEventListener('pagehide',stop);
})();
