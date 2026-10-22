import test from 'node:test';
import assert from 'node:assert/strict';
import {readDate,readTime} from '../capture-date.js';
import {capturePlan,parseCapture,matchProjects} from '../capture-plan.js';
import {fieldList,projectSummaryCard} from '../field-views.js';
import {createCaptureOnce} from '../capture-store.js';
const now=new Date(2026,9,22,12),projects=[{id:'a',name:'朴子及麥寮',code:'A001'},{id:'b',name:'鹿港',code:'A002'},{id:'c',name:'已封存',code:'A003',archived:true}];
const plan=(text,extra={})=>capturePlan(text,projects,{now,...extra});
test('原文、事實與純記錄不會誤建正式工作',()=>{
 for(const text of ['材料型錄放在第二個抽屜。','鹿港泵浦昨天進場。','明天可能要查驗。']){const p=plan(text);assert.equal(p.collection,'inboxNotes');assert.equal(p.data.text,text);assert.equal(p.data.originalText,text)}
 const p=plan('鹿港明天下午三點查驗。',{plain:true});assert.equal(p.collection,'inboxNotes');assert.equal(p.parsed.projectId,'');assert.equal(p.parsed.kind,'note');
});
test('明確案場與日期才建立正式工務，保留完整欄位並關閉未設定通知',()=>{
 const p=plan('鹿港明天下午3點查驗，提前一天提醒。');assert.equal(p.collection,'items');assert.equal(p.data.projectId,'b');assert.equal(p.data.date,'2026-10-23');assert.equal(p.data.time,'15:00');assert.equal(p.data.reminderRequest,'提前 1 天');assert.equal(p.data.reminderAtTime,false);assert.deepEqual(p.data.tgMinutes,[]);assert(!JSON.stringify(p).includes('adminTasks'));
});
test('未排日期的待辦仍可保存，絕不補今天或09:00',()=>{
 const p=plan('鹿港要追蹤材料審查回覆。');assert.equal(p.collection,'inboxNotes');assert.equal(p.data.captureKind,'task');assert.equal(p.data.date,'');assert.equal(p.data.time,'');
 const allDay=plan('鹿港明天回報查驗結果。');assert.equal(allDay.collection,'items');assert.equal(allDay.data.time,'');assert.equal(allDay.data.reminder,'none');
});
test('多日期、多案場和上午下午不明時保留原文',()=>{
 for(const text of ['鹿港今天收到，明天回報。','鹿港和朴子明天要確認。','鹿港明天三點開會。','鹿港2/30要回報。'])assert.equal(plan(text).collection,'inboxNotes',text);
 assert.equal(matchProjects('A0011明天要確認',projects).length,0);
 assert.equal(plan('南港案場明天要確認。').collection,'inboxNotes');
 assert.equal(plan('鹿港運來的材料明天下午三點進場。').collection,'inboxNotes');
 assert.equal(plan('從鹿港帶來的泵浦明天進場。').collection,'inboxNotes');
});
test('重試不能覆寫完成狀態；轉成正式工作後也不能重建原筆記',async()=>{
 const db=new Map([['note',{done:true,text:'原文'}],['converted',{done:true,title:'已轉工作'}]]);
 const runTransaction=async(store,fn)=>fn({get:async ref=>({exists:()=>store.has(ref),data:()=>store.get(ref)}),set:(ref,data)=>store.set(ref,data)});
 assert.equal(await createCaptureOnce(runTransaction,db,'note',{done:false,text:'原文'}),false);assert.equal(db.get('note').done,true);
 assert.equal(await createCaptureOnce(runTransaction,db,'missing-note',{done:false},'converted'),false);assert(!db.has('missing-note'));
 assert.equal(await createCaptureOnce(runTransaction,db,'new',{text:'新原文'},'missing-converted'),true);assert.equal(db.get('new').text,'新原文');
});
test('未排日期的待辦可進待辦列表，純備忘不會計入待辦',()=>{
 const data=[{id:'note',title:'未排日待辦',sourceNote:true,captureKind:'task',date:'',done:false},{id:'memo',title:'純備忘',sourceNote:true,captureKind:'note',date:'',done:false}];
 const html=fieldList(data,'工作紀錄',r=>'ROW:'+r.title,'active');assert(html.includes('ROW:未排日待辦'));assert(!html.includes('ROW:純備忘'));
});
test('分類修正需要真實案場和有效日期時間',()=>{
 const p=plan('要追蹤材料回覆',{changes:{projectId:'b',date:'2026-10-25'}});assert.equal(p.collection,'items');assert.equal(p.data.title,'要追蹤材料回覆');
 for(const changes of [{projectId:'fake'},{projectId:'c'},{date:'2026-02-30'},{time:'25:30'},{kind:'admin'},{type:'fake'}])assert.throws(()=>plan('要追蹤材料回覆',{changes}));
 assert.throws(()=>plan(''));assert.throws(()=>plan('字'.repeat(2001)));
});
test('相對日期、月底、跨年與中文時間',()=>{
 for(const [text,want]of [['昨天','2026-10-21'],['後天','2026-10-24'],['月底','2026-10-31'],['下個月5號','2026-11-05'],['下週五','2026-10-30']])assert.equal(readDate(text,now).date,want);
 assert.equal(readDate('明天',new Date(2026,11,31,12)).date,'2027-01-01');assert.equal(readDate('2/30',now).date,'');
 assert.equal(readTime('下午三點半').time,'15:30');assert.equal(readTime('25點').time,'');
});
test('列表預設包含已完成；案場聯絡資料可展開，沒有假工程進度',()=>{
 const data=[{id:'1',title:'進行中',date:'2026-10-22',done:false,projectId:'b'},{id:'2',title:'已結束',date:'2026-10-21',done:true,projectId:'b'}];
 assert(fieldList(data,'工作紀錄',r=>r.title).includes('已結束'));assert(!fieldList(data,'工作紀錄',r=>'ROW:'+r.title,'active').includes('ROW:已結束'));
 const html=projectSummaryCard({...projects[1],note:'<img src=x>',address:'測試地址'},data,'2026-10-22');assert(html.includes('聯絡與案場資訊'));assert(html.includes('&lt;img'));assert(!html.includes('class="progress"'));assert(!html.includes('50%'));
});
