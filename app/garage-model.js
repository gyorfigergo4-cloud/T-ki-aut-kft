(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GarageModel=factory();})(typeof window==='undefined'?globalThis:window,()=>{
 const key=s=>s.trim().normalize('NFC').toLocaleLowerCase('hu');
 function validate(people){
  if(!Array.isArray(people)||people.length>20000)throw Error('Hibás vagy túl nagy névjegyzék.');
  const ids=new Set();
  for(const p of people){
   if(p&&Object.keys(p).some(k=>!['id','name','cars'].includes(k)))throw Error('Csak név és járműadatok tárolhatók a közös névjegyzékben.');
   if(!p||typeof p.id!=='string'||!p.id||p.id.length>200||ids.has(p.id))throw Error('Hibás vagy ismétlődő azonosító.');ids.add(p.id);
   if(typeof p.name!=='string'||!p.name.trim()||p.name.length>200)throw Error('A név kötelező, legfeljebb 200 karakter lehet.');
   if(!Array.isArray(p.cars)||p.cars.length>1000)throw Error('Hibás járműlista.');
   const carIds=new Set();
   for(const c of p.cars){if(c&&Object.keys(c).some(k=>!['id','vehicle','vin','plate'].includes(k)))throw Error('Csak járműadatok tárolhatók a közös névjegyzékben.');if(!c||typeof c.id!=='string'||!c.id||c.id.length>200||carIds.has(c.id))throw Error('Hibás járműazonosító.');carIds.add(c.id);
    for(const f of ['vehicle','vin','plate'])if(typeof c[f]!=='string'||c[f].length>300)throw Error('A jármű mezői legfeljebb 300 karakteres szövegek lehetnek.');
    if(![c.vehicle,c.vin,c.plate].some(s=>s.trim()))throw Error('Add meg az autót, az alvázszámot vagy a rendszámot.');
   }
  }return people;
 }
 // Excel clipboard TSV, including quoted cells with tabs, newlines and escaped quotes.
 function table(text){
  if(typeof text!=='string'||text.length>5000000)throw Error('Legfeljebb 5 MB szöveg másolható be.');
  const rows=[];let row=[],cell='',quoted=false;
  text=text.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  for(let i=0;i<text.length;i++){const ch=text[i];
   if(ch==='"'&&(quoted||cell==='')){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
   else if(!quoted&&(ch==='\t'||ch==='\n')){row.push(cell.trim());cell='';if(ch==='\n'){if(row.some(Boolean))rows.push(row);row=[];}}
   else cell+=ch;
  }
  if(quoted)throw Error('Lezáratlan idézőjel az Excel-adatokban. Másold be újra a teljes cellákat.');
  row.push(cell.trim());if(row.some(Boolean))rows.push(row);
  if(rows.length>20000)throw Error('Egyszerre legfeljebb 20 000 sor olvasható be.');return rows;
 }
 function importRows(people,rows,mapping,header,fill,id){
  validate(people);const result=JSON.parse(JSON.stringify(people));let added=0,skipped=0,last='';
  if(!rows.length)throw Error('Másolj be legalább egy sort az Excelből.');
  const columns=Object.values(mapping).filter(i=>i>=0);if(mapping.name<0||columns.length!==new Set(columns).size)throw Error('Válassz külön oszlopot a névhez és minden adatmezőhöz.');
  if(!['vehicle','vin','plate'].some(f=>mapping[f]>=0))throw Error('Válassz legalább egy járműoszlopot.');
  rows.slice(header?1:0).forEach((r,index)=>{
   const get=f=>mapping[f]>=0?(r[mapping[f]]||'').trim():'';
   let name=get('name');if(name)last=name;else if(fill)name=last;
   const car={id:id(),vehicle:get('vehicle'),vin:get('vin'),plate:get('plate')};
   if(!name)throw Error(`${index+(header?2:1)}. sor: hiányzik a név.`);
   if(![car.vehicle,car.vin,car.plate].some(Boolean))throw Error(`${index+(header?2:1)}. sor: hiányzik a jármű adata.`);
   let person=result.find(p=>key(p.name)===key(name));if(!person){person={id:id(),name,cars:[]};result.push(person);}
   if(person.cars.some(c=>['vehicle','vin','plate'].every(f=>key(c[f])===key(car[f])))){skipped++;return;}
   person.cars.push(car);added++;
  });
  if(!added&&!skipped)throw Error('Nincs beolvasható adatsor.');validate(result);return {people:result,added,skipped};
 }
 return {validate,table,importRows,key};
});
