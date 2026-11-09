(function(root){const Items=typeof module!=='undefined'?require('./items'):root.LineItems;
 function price(value){if(value===undefined||value==='')return '';Items.cents(value);return value.replace(',','.');}
 function minimum(value){if(value===undefined||value===null)return null;if(!Number.isSafeInteger(value)||value<0||value>1000000000)throw Error('A készlethatár 0 és 1 000 000 000 közötti egész szám legyen.');return value;}
 function alerts(products){return products.filter(p=>p.minStock!==undefined&&p.minStock!==null&&p.quantity<=p.minStock).map(p=>({id:p.id,name:p.name,sku:p.sku,quantity:p.quantity,minStock:p.minStock})).sort((a,b)=>a.quantity-b.quantity||a.name.localeCompare(b.name,'hu'));}
 function applyPrice(item,product,force=false){if(product.price===undefined||product.price===''||(!force&&item.fullPrice!==''))return item;return Items.edit(item,{fullPrice:price(product.price),discountPercent:item.discountPercent||'0'});}
 const api={price,minimum,alerts,applyPrice};if(typeof module!=='undefined')module.exports=api;else root.InventoryPolicy=api;
})(globalThis);
