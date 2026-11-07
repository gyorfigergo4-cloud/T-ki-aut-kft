const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
function createJob({dir,catalog,fork}){let current={running:false,phase:'Nincs folyamatban letöltés'},active;
 return {status:()=>({...current}),start:()=>{if(current.running)return {...current};const job={running:true,phase:'Letöltés indítása',part:0,parts:15,bytes:0,records:0};current=job;fs.mkdirSync(dir,{recursive:true});const output=path.join(dir,'filter-catalog-'+randomUUID()+'.json');
  try{const child=fork(path.join(__dirname,'filter-catalog-worker.js'),[],{env:{...process.env,...(process.env.HTTP_PROXY?{NODE_USE_ENV_PROXY:'1'}:{})},serviceName:'Toki Auto szurokatalogus'});active=child;
   child.on('spawn',()=>child.postMessage({output}));
   child.on('message',m=>{if(current!==job||!job.running)return;if(m.type==='progress')Object.assign(job,m.data,{running:true});else if(m.type==='complete'){try{if(m.data.file!==output)throw Error('Hibás katalógusválasz.');const result=catalog.install(output);Object.assign(job,{running:false,phase:'Katalógus betöltve',count:result.count,records:result.count,error:null});}catch(e){Object.assign(job,{running:false,error:e.message,phase:'A katalógus nem módosult'});}child.kill();}else if(m.type==='error'){Object.assign(job,{running:false,error:m.error,phase:'A letöltés nem sikerült; a korábbi katalógus megmaradt'});child.kill();}});
   child.on('exit',()=>{if(job.running)Object.assign(job,{running:false,error:'A letöltés megszakadt. Újrapróbálható.',phase:'Letöltés megszakadt'});if(active===child)active=null;fs.rmSync(output,{force:true});});
  }catch(e){Object.assign(job,{running:false,phase:'A letöltés nem indítható',error:e.message});}
  return {...job};},cancel:()=>{if(current.running){Object.assign(current,{running:false,phase:'Letöltés leállítva',error:null});active?.kill();}return {...current};}};
}
module.exports={createJob};
