const fs=require('node:fs'),path=require('node:path');
const {validate}=require('./garage-model');
function read(file){return fs.existsSync(file)?validate(JSON.parse(fs.readFileSync(file,'utf8'))):[];}
function write(file,people){validate(people);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(people,null,2),'utf8');if(fs.existsSync(file))fs.copyFileSync(file,file+'.bak');fs.renameSync(file+'.tmp',file);}
module.exports={read,write};
