const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
async function openInventory(initial){
 const dom=new JSDOM(fs.readFileSync('app/index.html','utf8'),{runScripts:'outside-only',url:'https://inventory.local'}),{window}=dom;let products=initial;
 window.notesAPI={inventoryLoad:async()=>({ok:true,products,movements:[],revision:'fixture',status:{mode:'local'}})};
 window.WorkOrdersUI={showInventory:async()=>{window.document.getElementById('inventory-view').hidden=false;return true;}};
 for(const file of ['inventory-categories.js','warehouse-map.js','warehouse-map-ui.js','inventory-ui.js'])window.eval(fs.readFileSync('app/'+file,'utf8'));
 await window.InventoryUI.show();const $=id=>window.document.getElementById(id);
 return {dom,$,rows:()=>[...$('stock-products').children],setProducts:async next=>{products=next;await window.InventoryUI.refresh();},input:(id,value)=>{$(id).value=value;$(id).dispatchEvent(new window.Event(id==='stock-search'?'input':'change'));}};
}
const product=index=>({id:'p-'+index,name:'Termék '+String(index).padStart(3,'0'),sku:'SKU-'+String(index).padStart(3,'0'),quantity:index,barcodes:[],locations:[],category:index<=65?'oil-filter':'air-filter'});
test('legfeljebb 50 raktári termék oldalanként, mindegyik pontosan egyszer elérhető',async()=>{
 const products=Array.from({length:123},(_,i)=>product(i+1)),ui=await openInventory(products);
 try{const seen=[];for(const count of [50,50,23]){assert.equal(ui.rows().length,count);seen.push(...ui.rows().map(row=>row.children[1].textContent));if(seen.length<123)ui.$('stock-next').click();}assert.equal(new Set(seen).size,123);assert.deepEqual(seen,products.map(p=>p.sku));assert.equal(ui.$('stock-next').disabled,true);assert.match(ui.$('stock-page').textContent,/3 \/ 3/);ui.$('stock-prev').click();assert.equal(ui.rows().length,50);assert.equal(ui.rows()[0].children[1].textContent,'SKU-051');assert.equal(ui.dom.window.InventoryUI.getSnapshot().products.length,123);}finally{ui.dom.window.close();}
});
test('keresés és típusszűrés visszaáll az első oldalra, frissítéskor a lap a létező tartományba kerül',async()=>{
 const ui=await openInventory(Array.from({length:123},(_,i)=>product(i+1)));
 try{ui.$('stock-next').click();ui.$('stock-next').click();ui.input('stock-search','Termék 12');assert.equal(ui.rows().length,4);assert.equal(ui.$('stock-prev').disabled,true);assert.equal(ui.$('stock-next').disabled,true);ui.input('stock-search','');ui.input('stock-category-filter','oil-filter');assert.equal(ui.rows().length,50);ui.$('stock-next').click();assert.equal(ui.rows().length,15);assert.match(ui.$('stock-page').textContent,/2 \/ 2/);await ui.setProducts([product(1),product(2),product(3)]);assert.equal(ui.rows().length,3);assert.equal(ui.$('stock-prev').disabled,true);assert.equal(ui.$('stock-next').disabled,true);await ui.setProducts([]);assert.equal(ui.rows().length,0);assert.match(ui.$('stock-page').textContent,/0 termék · 1 \/ 1/);assert.equal(ui.$('stock-next').disabled,true);}finally{ui.dom.window.close();}
});
test('pontosan 50 tételhez egyetlen oldal, az 51. tétel külön oldalra kerül',async()=>{
 const ui=await openInventory(Array.from({length:50},(_,i)=>product(i+1)));
 try{assert.equal(ui.rows().length,50);assert.equal(ui.$('stock-next').disabled,true);await ui.setProducts(Array.from({length:51},(_,i)=>product(i+1)));assert.equal(ui.rows().length,50);assert.equal(ui.$('stock-next').disabled,false);ui.$('stock-next').click();assert.equal(ui.rows().length,1);assert.equal(ui.rows()[0].children[1].textContent,'SKU-051');assert.equal(ui.$('stock-next').disabled,true);}finally{ui.dom.window.close();}
});
