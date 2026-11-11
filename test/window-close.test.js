const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {attach}=require('../app/window-close');
function setup(tray=false){
 const app=new EventEmitter(),ipcMain=new EventEmitter(),messages=[];let destroyed=false,sequence=0,quitCount=0,hides=0,reveals=0;
 const win=new EventEmitter();win.webContents={send:(name,token,action)=>messages.push({name,token,action})};win.isDestroyed=()=>destroyed;
 win.close=()=>{let stopped=false;win.emit('close',{preventDefault(){stopped=true;}});if(!stopped){destroyed=true;win.emit('closed');}};
 app.quit=()=>{let stopped=false;app.emit('before-quit',{preventDefault(){stopped=true;}});if(!stopped){quitCount++;win.close();}};
 attach({win,app,ipcMain,newToken:()=>String(++sequence),shouldHide:()=>tray,hide:()=>hides++,reveal:()=>reveals++});
 const event={sender:win.webContents};
 return {win,app,ipcMain,messages,event,ready:()=>ipcMain.emit('app-close-ready',event),reply:(token,approved,sender=win.webContents)=>ipcMain.emit('complete-app-close',{sender},{token,approved}),destroyed:()=>destroyed,quits:()=>quitCount,hides:()=>hides,reveals:()=>reveals};
}
test('a natív X megáll, a Vissza elutasítja a bezárást, új próbálkozás új jóváhagyást igényel',()=>{
 const state=setup();state.ready();state.win.close();state.win.close();assert.equal(state.destroyed(),false);assert.equal(state.messages.length,1);const first=state.messages[0].token;
 state.reply(first,false);assert.equal(state.destroyed(),false);state.win.close();assert.equal(state.messages.length,2);const second=state.messages[1].token;assert.notEqual(second,first);
 state.reply(first,true);assert.equal(state.destroyed(),false,'régi jóváhagyás nem érvényes');state.reply(second,true,{});assert.equal(state.destroyed(),false,'másik ablak nem zárhatja be');state.reply(second,'true');assert.equal(state.destroyed(),false,'csak boolean true fogadható el');
 state.win.close();const third=state.messages.at(-1).token;state.reply(third,true);assert.equal(state.destroyed(),true);
});
test('X mentési jóváhagyás után elrejt, ismételt megnyitás után is újra használható',()=>{
 const s=setup(true);s.ready();s.win.close();assert.equal(s.messages[0].action,'hide');assert.equal(s.hides(),0);s.reply(s.messages[0].token,true);assert.equal(s.hides(),1);assert.equal(s.destroyed(),false);assert.equal(s.quits(),0);s.win.close();s.reply(s.messages[1].token,true);assert.equal(s.hides(),2);assert.equal(s.destroyed(),false);
});
test('tálca Kilépés megmutatja az ablakot és külön, megszakítható végső jóváhagyást kér',()=>{
 const s=setup(true);s.ready();s.app.quit();assert.equal(s.messages[0].action,'quit');assert.equal(s.reveals(),1);s.reply(s.messages[0].token,false);assert.equal(s.destroyed(),false);s.app.quit();s.reply(s.messages[1].token,true);assert.equal(s.destroyed(),true);assert.equal(s.quits(),1);assert.equal(s.hides(),0);
});
test('Kilépés a tálcára mentés közben nem veszhet el és nem kerülheti meg az ellenőrzést',()=>{
 const s=setup(true);s.ready();s.win.close();const hide=s.messages[0];s.app.quit();assert.equal(s.messages.length,1);s.reply(hide.token,true);assert.equal(s.messages.length,2);assert.equal(s.messages[1].action,'quit');assert.equal(s.hides(),0);assert.equal(s.destroyed(),false);s.reply(s.messages[1].token,false);s.win.close();assert.equal(s.messages[2].action,'hide');s.reply(s.messages[2].token,false);assert.equal(s.hides(),0);assert.equal(s.destroyed(),false);
});
test('indulás közbeni bezárás megvárja a felületet, az app.quit is visszavonható',()=>{
 const state=setup();state.win.close();assert.equal(state.destroyed(),false);assert.equal(state.messages.length,0);state.ready();assert.equal(state.messages.length,1);state.reply(state.messages[0].token,false);
 state.app.quit();assert.equal(state.destroyed(),false);assert.equal(state.quits(),0);state.reply(state.messages.at(-1).token,false);assert.equal(state.destroyed(),false);state.app.quit();state.reply(state.messages.at(-1).token,true);assert.equal(state.destroyed(),true);assert.equal(state.quits(),1);
});
