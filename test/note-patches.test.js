const {test}=require('node:test'),assert=require('node:assert/strict');const {apply}=require('../app/note-patches');
const n=(id,body=id)=>({id,title:id,body,updated:'2026-11-06T08:00:00Z'});
test('részleges mentés csak a módosított jegyzetet érinti, új név előre kerül, törlés ismételhető',()=>{
 const old=[n('a'),n('b'),n('external')],source=JSON.stringify(old);
 const next=apply(old,{upserts:[n('new'),n('a','módosult')],removed:['b']});assert.deepEqual(next.map(r=>r.id),['new','a','external']);assert.equal(next[1].body,'módosult');assert.equal(JSON.stringify(old),source);
 assert.deepEqual(apply(next,{upserts:[n('new'),n('a','módosult')],removed:['b']}),next);
 for(const patch of [{upserts:[n('a')],removed:['a']},{upserts:[n('a'),n('a')],removed:[]},{upserts:[],removed:[],path:'archive.json'},{upserts:[{}],removed:[]}])assert.throws(()=>apply(old,patch));
});
