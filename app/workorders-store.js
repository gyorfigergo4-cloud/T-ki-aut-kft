const fs=require('node:fs'),path=require('node:path');
const {validate}=require('./workorders-model');
function read(file){if(!fs.existsSync(file))return [];return validate(JSON.parse(fs.readFileSync(file,'utf8')));}
function write(file,docs){validate(docs);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(docs),'utf8');if(fs.existsSync(file))fs.copyFileSync(file,file+'.bak');fs.renameSync(file+'.tmp',file);}
module.exports={read,write};
