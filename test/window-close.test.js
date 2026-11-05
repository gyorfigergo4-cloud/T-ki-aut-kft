const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {attach}=require('../app/window-close');
function setup(){
 const app=new EventEmitter(),ipcMain=new EventEmitter(),messages=[];let destroyed=false,sequence=0,quitCount=0;
 const win=new EventEmitter();win.webContents={send:(name,token)=>messages.push({name,token})};win.isDestroyed=()=>destroyed;
 win.close=()=>{let stopped=false;win.emit('close',{preventDefault(){stopped=true;}});if(!stopped){destroyed=true;win.emit('closed');}};
 app.quit=()=>{let stopped=false;app.emit('before-quit',{preventDefault(){stopped=true;}});if(!stopped){quitCount++;win.close();}};
 attach({win,app,ipcMain,newToken:()=>String(++sequence)});
 const event={sender:win.webContents};
 return {win,app,ipcMain,messages,event,ready:()=>ipcMain.emit('app-close-ready',event),reply:(token,approved,sender=win.webContents)=>ipcMain.emit('complete-app-close',{sender},{token,approved}),destroyed:()=>destroyed,quits:()=>quitCount};
}
test('a natív X megáll, a Vissza elutasítja a bezárást, új próbálkozás új jóváhagyást igényel',()=>{
 const state=setup();state.ready();state.win.close();state.win.close();assert.equal(state.destroyed(),false);assert.equal(state.messages.length,1);const first=state.messages[0].token;
 state.reply(first,false);assert.equal(state.destroyed(),false);state.win.close();assert.equal(state.messages.length,2);const second=state.messages[1].token;assert.notEqual(second,first);
 state.reply(first,true);assert.equal(state.destroyed(),false,'régi jóváhagyás nem érvényes');state.reply(second,true,{});assert.equal(state.destroyed(),false,'másik ablak nem zárhatja be');state.reply(second,'true');assert.equal(state.destroyed(),false,'csak boolean true fogadható el');
 state.win.close();const third=state.messages.at(-1).token;state.reply(third,true);assert.equal(state.destroyed(),true);
});
test('indulás közbeni bezárás megvárja a felületet, az app.quit is visszavonható',()=>{
 const state=setup();state.win.close();assert.equal(state.destroyed(),false);assert.equal(state.messages.length,0);state.ready();assert.equal(state.messages.length,1);state.reply(state.messages[0].token,false);
 state.app.quit();assert.equal(state.destroyed(),false);assert.equal(state.quits(),0);state.reply(state.messages.at(-1).token,false);assert.equal(state.destroyed(),false);state.app.quit();state.reply(state.messages.at(-1).token,true);assert.equal(state.destroyed(),true);assert.equal(state.quits(),1);
});
