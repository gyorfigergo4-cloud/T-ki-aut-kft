(function(root){
 const Items=typeof module!=='undefined'?require('./items'):root.LineItems;
 const dateValid=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
 const textFields=['id','number','kind','day','customer','phone','vin','vehicle','plate','validUntil','publicNote','internalNote','created','updated'];
 function validate(docs){
  if(!Array.isArray(docs))throw new Error('Sérült munkalapadatok');
  const ids=new Set(),numbers=new Set();
  for(const doc of docs){
   if(!doc||textFields.some(k=>typeof doc[k]!=='string')||!doc.id||!doc.number.trim()||doc.number.length>80||ids.has(doc.id)||numbers.has(doc.number.trim().toLowerCase()))throw new Error('A munkalap azonosítója vagy sorszáma hibás, illetve ismétlődik.');
   if(!['quote','workorder'].includes(doc.kind)||!dateValid(doc.day)||(doc.validUntil&&!dateValid(doc.validUntil))||!Number.isFinite(Date.parse(doc.created))||!Number.isFinite(Date.parse(doc.updated)))throw new Error('A munkalap dátuma vagy típusa hibás.');
   if(textFields.some(k=>doc[k].length>20000))throw new Error('Túl hosszú munkalapmező.');
   Items.validate(doc.items);ids.add(doc.id);numbers.add(doc.number.trim().toLowerCase());
  }
  return docs;
 }
 function blank(id,day,docs,itemId){
  const year=day.slice(0,4),used=docs.map(d=>new RegExp('^TA-'+year+'-(\\d+)$').exec(d.number)).filter(Boolean).map(m=>Number(m[1]));
  const now=new Date().toISOString();
  return {id,number:'TA-'+year+'-'+String(Math.max(0,...used)+1).padStart(4,'0'),kind:'quote',day,customer:'',phone:'',vin:'',vehicle:'',plate:'',validUntil:'',publicNote:'',internalNote:'',items:[{...Items.blank(itemId),description:''}],created:now,updated:now};
 }
 function activeItems(doc){return doc.items.filter(i=>i.partNumber||i.description||i.supplier||i.fullPrice!==''||i.discountedPrice!=='');}
 function redactor(items){
  const escapePattern=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const patterns=items.map(i=>i.partNumber.trim().normalize('NFC')).filter(Boolean).sort((a,b)=>b.length-a.length).flatMap(code=>{
   const exact=new RegExp((/^[\p{L}\p{N}]/u.test(code)?'(?<![\\p{L}\\p{N}])':'')+escapePattern(code).replace(/\s+/g,'\\s+')+(/[\p{L}\p{N}]$/u.test(code)?'(?![\\p{L}\\p{N}])':''),'giu');
   const words=code.match(/[\p{L}\p{N}]+/gu);
   const flexible=words?new RegExp('(?<![\\p{L}\\p{N}])'+words.map(escapePattern).join('[\\s_./-]*')+'(?![\\p{L}\\p{N}])','giu'):null;
   return flexible?[exact,flexible]:[exact];
  });
  return value=>{let out=value.normalize('NFC');for(const pattern of patterns)out=out.replace(pattern,'…');return out;};
 }
 function printable(doc){
  validate([doc]);
  if(!doc.customer.trim())throw new Error('Nyomtatás előtt add meg az ügyfél nevét.');
  const active=activeItems(doc);
  if(!active.length)throw new Error('Nyomtatáshoz legalább egy árazott tételt adj meg.');
  if(active.some(i=>i.fullPrice===''||i.discountedPrice===''))throw new Error('Nyomtatás előtt töltsd ki minden tétel árát.');
  if(active.some(i=>Items.cents(i.discountedPrice)>Items.cents(i.fullPrice)))throw new Error('A kedvezményes ár nem lehet magasabb a teli árnál.');
  const safe=redactor(doc.items);
  // Only this whitelist crosses the boundary into the print document. Never
  // pass partNumber, source, legacyLine, supplier or internalNote to the view.
  return {title:doc.kind==='quote'?'Árajánlat':'Munkalap',number:doc.number,day:doc.day,validUntil:doc.validUntil,customer:safe(doc.customer),phone:safe(doc.phone),vin:safe(doc.vin),vehicle:safe(doc.vehicle),plate:safe(doc.plate),note:safe(doc.publicNote),items:active.map(i=>({description:safe(i.description||'Alkatrész'),fullPrice:i.fullPrice,discountPercent:i.discountPercent||'0',discountedPrice:i.discountedPrice,quantity:i.quantity,total:Items.totals([i]).discountedPrice})),totals:Items.totals(active)};
 }
 const api={validate,blank,activeItems,printable};
 if(typeof module!=='undefined')module.exports=api;else root.WorkOrderModel=api;
})(globalThis);
