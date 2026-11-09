// Shared shelf identifiers follow the shop's supplied floor plan. No stock is seeded.
(function(root){
 const spots=[];
 const add=(id,label,x,y,w=1,h=1)=>spots.push({id,label,x,y,w,h});
 add('bal-sarok','bal sarok',1,2);add('bf-03','bf polc 03',1,4,1,2);add('bf-02','bf polc 02',1,6,1,3);add('bf-01','bf polc 01',1,9,1,3);
 add('fal','fal',2,5);add('paloma-02','paloma 02',2,6);add('paloma-01','paloma 01',2,7);add('rag-fal','rag fal',2,8);
 add('akku-02','akku 02',3,2,1,3);add('akku-01','akku 01',3,5);add('motul','motul',3,6);add('allvany','állvány',3,7);add('formula','formula',3,8);
 add('porolto','poroltó',4,2);add('bal','bal',4,3,1,4);add('b-pult-elott','b pult előtt',4,8,2);add('b-pult-polc','b pult polc',4,9,2);
 add('pult-4','4. pult',2,10,2);add('pult-3','3. pult',4,10,2);
 add('az-allvany','AZ állvány',7,2);add('oximo','Oximo',8,2);add('plusz-ablak','plusz ablak',9,2);add('jobb','jobb',8,3,2,4);
 for(let i=1;i<=4;i++)add('polc-'+i,'polc 0'+i,10,i===1?2:i===2?3:i===3?5:7,1,i===2||i===3?2:1);
 add('jf-01','jf polc 01',11,2,1,4);add('jf-02','jf polc 02',11,6,1,2);add('jf-03','jf polc 03',11,8,1,3);
 add('j-pult-elott','j pult előtt',7,8,3);add('j-pult-polc','j pult polc',7,9,3);add('pult-2','2. pult',7,10,2);add('pult-1','1. pult',9,10,2);
 add('nyomtato','nyomtató',10,12);add('elem-tarto','elem tartó',10,13);
 for(const [n,x,y,w]of [[6,2,13,4],[5,3,14,2],[4,5,14,1],[7,2,15,2],[8,4,15,2],[3,7,14,1],[2,8,14,1],[1,9,14,1],[9,7,15,1],[10,8,15,1],[11,9,15,1],[16,3,17,2],[15,5,17,1],[14,7,17,1],[13,8,17,1],[12,9,17,1]])add('slot-'+n,String(n).padStart(2,'0'),x,y,w);
 add('akku-polc','akku polc',2,18,1,2);add('k-raktar','k raktár',3,21,1,4);add('polc-mellett','polc mellett',5,21);for(let i=1;i<=3;i++)add('h-rakt-'+i,'h rakt 0'+i,5,21+i);
 add('visszaru','visszáru',10,18,1,3);add('kv-viz-huto','kv, víz, hűtő',7,20);add('abl-torl-02','abl.törl.02',8,20);add('abl-torl-01','abl.törl.01',9,20);
 add('konyha','konyha',7,24);add('huto','hűtő',8,24);add('kezmoso-polc','kézmosó polc',9,23,1,2);
 const other=[['ablaktorlo','ablaktörlő'],['akkumulator','akkumulátor'],['pult','Pult'],['eladoter','Eladótér'],['folyadek-bal','folyadékok, kenőanyagok bal'],['folyadek-jobb','folyadékok, kenőanyagok jobb'],['raktarban','raktárban'],['olajszuro','olajszűrő'],['uj','új']].map(([id,label])=>({id,label}));
 const all=[...spots,...other],byId=new Map(all.map(s=>[s.id,s]));
 function validate(ids){if(!Array.isArray(ids)||ids.length>20||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!byId.has(id)))throw Error('Érvénytelen raktári hely. Válassz a térképről (legfeljebb 20 hely).');return ids;}
 function names(product){return (product.locations||[]).map(id=>byId.get(id)?.label||id).join(' · ');}
 function description(product){return [names(product),product.locationNote||''].filter(Boolean).join(' — ');}
 const api={spots,other,all,validate,names,description};if(typeof module!=='undefined')module.exports=api;else root.WarehouseMap=api;
})(globalThis);
