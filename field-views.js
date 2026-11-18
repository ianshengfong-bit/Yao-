export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e = escapeHTML;
export function recentOrder(a,b) {
    const stamp = v => Number(v.createdAt?.toMillis?.() || v.createdAt || 0) || Date.parse(`${v.date || '1970-01-01'}T${v.time || '00:00'}:00`) || 0;
    return stamp(b)-stamp(a);
}

/* ---- 工務列表共用：首頁與工作紀錄用同一種兩行卡片、篩選列與復原列 ---- */
export const localDay = (d = new Date()) => [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
export const nextDay = (today = localDay()) => { const d=new Date(today+'T12:00:00'); d.setDate(d.getDate()+1); return localDay(d); };
// 傍晚 5 點以後，首頁預設看「明天」：你通常前一晚安排隔天要去哪、帶什麼。
export const isEvening = (now = new Date()) => now.getHours() >= 17;
export const isLateRow = (r,today = localDay()) => !r.done && Boolean(r.date) && r.date < today;
export function rowCounts(rows,today = localDay()) {
    const open=rows.filter(r=>!r.done);
    const tm=nextDay(today);
    return {open:open.length,today:open.filter(r=>r.date===today).length,tomorrow:open.filter(r=>r.date===tm).length,late:open.filter(r=>isLateRow(r,today)).length,done:rows.length-open.length,all:rows.length};
}
const LEGACY = {active:'open',recent:'all'};
export const normalizeFilter = f => LEGACY[f] || (['open','today','tomorrow','late','done','all'].includes(f) ? f : 'all');
// 未完成類：照日期（逾期在最前、沒日期的在最後）；已完成／全部：未完成在前，再照新舊。
export function pickRows(rows,filter,today = localDay()) {
    const f=normalizeFilter(filter);
    const tm=nextDay(today);
    const pick={open:r=>!r.done,today:r=>!r.done&&r.date===today,tomorrow:r=>!r.done&&r.date===tm,late:r=>isLateRow(r,today),done:r=>r.done,all:()=>true}[f];
    const byDate=(a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||(a.time||'').localeCompare(b.time||'')||recentOrder(a,b);
    const byRecent=(a,b)=>Number(Boolean(a.done))-Number(Boolean(b.done))||recentOrder(a,b);
    return rows.filter(pick).sort(f==='done'||f==='all'?byRecent:byDate);
}
export function filterStrip(counts,filter,attr,extra = '') {
    const f=normalizeFilter(filter);
    return `<div class="field-strip" role="group" aria-label="篩選紀錄">${[['open','未完成'],['today','今天'],['tomorrow','明天'],['late','逾期'],['done','已完成'],['all','全部']].filter(([v])=>(v!=='late'||counts.late||f==='late')&&(v!=='tomorrow'||counts.tomorrow||f==='tomorrow'||isEvening())).map(([v,n])=>`<button type="button" ${attr}="${v}" aria-pressed="${f===v}"${v==='late'?' class="is-late"':''}>${n}<b>${counts[v]}</b></button>`).join('')}${extra}</div>`;
}
/* 一筆打很多樣東西時，自動拆成小清單。
   只用明確的分隔：以及、還有、、，,；;＋+、換行、「 和 」「 跟 」（前後要有空白）。
   開頭的案場名稱會先拿掉，例如「朴子 泵浦啟動燈*3 以及 7609 鐵棍一隻」→ 泵浦啟動燈 ×3／7609 鐵棍一隻 */
export function splitChecklist(text,project = '') {
    let t=String(text||'').trim();
    const names=[project,...String(project||'').split(/[及與和、/\s-]+/)].filter(n=>n&&n.length>=2).sort((a,b)=>b.length-a.length);
    for(const n of names)if(t.startsWith(n)){t=t.slice(n.length).replace(/^[\s:：,，、-]+/,'');break}
    const parts=t.split(/\s*(?:以及|還有|[、，,；;＋+\n]|\s和\s|\s跟\s)\s*/).map(x=>x.trim().replace(/[*＊xX×]\s*(\d+)\s*$/,' ×$1')).filter(x=>x.length>0);
    // 第一項常帶著「明天去朴子 帶…」這種前言：只留「帶／載／拿」後面的東西
    if(parts.length>=2)parts[0]=parts[0].replace(/^(?:.*\s)?(帶|載|拿|準備|買)(?=\S)/,'').trim()||parts[0];
    if(parts.length>=2)for(const n of names)if(parts[0].includes(n)){parts[0]=parts[0].replace(n,'').replace(/\s{2,}/g,' ').trim();break}
    return parts.length>=2&&parts.length<=30&&parts[0]?parts:[];
}
// 有自己編過的清單就用自己的；沒有才從標題自動拆。
export const rowChecklist = (r,project = '') => Array.isArray(r.checklist) ? r.checklist.filter(Boolean) : splitChecklist(r.title,project);
/* 常帶的東西：從你以前所有的小清單統計出現次數，最常用的排前面。
   去掉數量（×3、2組…）只留品名，例如「砂輪機」「鐵鎚」「安全帶」。 */
export const baseThing = (text,names = []) => {
    let t=String(text||'').trim();
    t=t.replace(/^(?:.*\s)?(帶|載|拿|準備|買)(?=\S)/,'');
    t=t.replace(/^(明天|今天|後天|大後天|下週.|週.)?\s*(去|到|在)\S*\s+/,'');
    for(const n of names)if(n&&t.startsWith(n+' ')){t=t.slice(n.length).trim();break}
    t=t.replace(/\s*(好多支|好多|很多|一些|等等)$/,'');
    t=t.replace(/\s*[×xX*＊]\s*\d+\s*$/,'').replace(/\s*\d+\s*(支|個|組|張|顆|台|隻|條|包|箱|捲|片|把|件|套)\s*$/,'').replace(/(一|兩|二|三|四|五)(支|個|組|張|顆|台|隻|條|包|箱|捲|片|把|件|套)$/,'');
    return t.trim();
};
// 只留「東西」：短品名，排除文書、流程、時間類的字。
export const looksLikeThing = name => name.length>=2 && name.length<=8 && !/^\d+$/.test(name) && !/[：:？?！!。]/.test(name)
    && !/流程|準備|資料|報告|進度|送審|送管|管制|整理|確認|等老闆|老闆|聯絡|回報|查驗|會議|開會|明天|今天|後天|週.|星期|上午|下午|早上|晚上|日誌|函文|計畫|申請|設備$/.test(name)
    && (name.match(/\s/g)||[]).length<=1;
export function frequentThings(rows,projectNameOf = () => '',limit = 10,projectNames = []) {
    const count=new Map(),names=[...new Set(projectNames.flatMap(n=>[n,...String(n||'').split(/[及與和、/\s-]+/)]).filter(n=>n&&n.length>=2))].sort((a,b)=>b.length-a.length);
    for(const r of rows){
        const list=rowChecklist({...r,title:r.title||r.text||''},projectNameOf(r.projectId));
        for(const raw of list){const name=baseThing(raw,names);if(!looksLikeThing(name))continue;const c=count.get(name)||{n:0,last:0};c.n++;c.last=Math.max(c.last,Number(r.createdAt)||0);count.set(name,c)}
    }
    return [...count].filter(([,c])=>c.n>=1).sort((a,b)=>b[1].n-a[1].n||b[1].last-a[1].last).slice(0,limit).map(([name])=>name);
}
const shortDate = date => date ? date.slice(5).replace('-','/') : '';
/* r: {id,title,done,date,time,reminderRequest}; opts.check 是完成按鈕的屬性字串，opts.actions 是展開後的按鈕 HTML。 */
/* 隨手記直接編輯：同一時間只編輯一筆，文字暫存在這裡，重畫畫面也不會不見。 */
export const noteEditing = {id:'', text:''};
function noteEditor(r) {
    return `<article class="field-row is-editing"><div class="field-note-edit"><textarea data-note-edit-text rows="3" maxlength="2000" aria-label="編輯隨手記">${e(noteEditing.text)}</textarea><div class="field-note-edit-actions"><button type="button" data-note-cancel>取消</button><button type="button" class="primary" data-note-save="${e(r.id)}">儲存</button></div></div></article>`;
}
export function rowCard(r,opts) {
    if (opts.source === 'note' && noteEditing.id && String(r.id) === noteEditing.id) return noteEditor(r);
    const {key,project = '',kind = '',open = false,check,expandAttr,actions = '',today = localDay()}=opts;
    const late=isLateRow(r,today),when=r.date?shortDate(r.date)+(r.time?' '+r.time:''):'';
    const days=late?Math.round((Date.parse(today)-Date.parse(r.date))/864e5):0;
    const list=opts.source?rowChecklist(r,project):[],ticks=new Set((r.checks||[]).map(Number));
    const ready=list.filter((_,i)=>ticks.has(i)).length;
    const meta=[project,when,kind].filter(Boolean).map(t=>`<span>${e(t)}</span>`).join('')+(list.length?`<span class="field-ready${ready===list.length?' is-all':''}">已備好 ${ready}/${list.length}</span>`:'');
    const checklist=list.length?`<ul class="field-checklist">${list.map((x,i)=>`<li><button type="button" class="field-tick${ticks.has(i)?' is-on':''}" data-tick="${i}" data-tick-row="${e(opts.source)}:${e(r.id)}" aria-pressed="${ticks.has(i)}"><span aria-hidden="true">${ticks.has(i)?'✓':''}</span>${e(x)}</button></li>`).join('')}</ul>`:'';
    return `<article class="field-row${r.done?' is-done':''}${late?' is-late':''}${open?' is-open':''}"><button type="button" class="field-check" ${check} aria-label="${r.done?'恢復':'完成'}：${e(r.title)}">${r.done?'✓':''}</button><div class="field-row-body" ${expandAttr}="${e(key)}" role="button" tabindex="0" aria-expanded="${open}"><p class="field-row-title">${e(r.title)}</p><div class="field-row-meta">${meta}${late?`<span class="field-overdue">逾期 ${days} 天</span>`:''}${r.reminderRequest?'<span class="field-row-bell" title="提醒要求已記下；通知尚未設定">⏰</span>':''}</div>${checklist}${open&&actions?`<div class="field-row-actions">${actions}</div>`:''}</div></article>`;
}
// 完成後底部出現「復原」5 秒，避免滑錯就找不到。
let undoTimer=0,undoAction=null;
export function showUndo(title,onUndo) {
    clearTimeout(undoTimer);undoAction=onUndo;
    let bar=document.getElementById('fieldUndo');
    if(!bar){bar=document.createElement('div');bar.id='fieldUndo';bar.className='field-undo';bar.setAttribute('role','status');document.body.append(bar);
        bar.addEventListener('click',ev=>{if(!ev.target.closest('button')||!undoAction)return;const run=undoAction;undoAction=null;bar.hidden=true;run();});}
    bar.innerHTML=`<span>已完成：${e(String(title).replace(/\s+/g,' ').slice(0,24))}</span><button type="button">復原</button>`;bar.hidden=false;
    undoTimer=setTimeout(()=>{bar.hidden=true;undoAction=null},5000);
}

export function fieldList(data,title,rowHTML,filter='all',{limit = Infinity} = {}) {
    const today=localDay(),counts=rowCounts(data,today),rows=pickRows(data,filter,today);
    const visible=rows.slice(0,limit);
    return `<header class="field-list-heading"><div><span class="field-eyebrow">工務工作區</span><h2>${e(title)}</h2><p>${counts.all} 筆紀錄 · ${counts.open} 件未完成</p></div><button class="btn primary" onclick="openItemModal()">＋ 新增工作</button></header>${filterStrip(counts,filter,'data-field-list')}<div class="field-record-list">${visible.length?visible.map(rowHTML).join(''):'<div class="field-empty">這個範圍目前沒有紀錄。</div>'}</div>${rows.length>visible.length?`<button type="button" class="field-more" data-field-more>再顯示 ${Math.min(30,rows.length-visible.length)} 筆（共 ${rows.length}）</button>`:''}`;
}
export function projectSummaryCard(project,items,today) {
    const all=items.filter(t=>String(t.projectId)===String(project.id)),pending=all.filter(t=>!t.done),late=pending.filter(t=>t.date&&t.date<today),recent=[...all].sort(recentOrder)[0];
    const id=e(project.id);
    return `<article class="project-card field-project-card ${project.archived?'archived':''}"><header class="field-project-cover"><span aria-hidden="true">◇</span><span>${e(project.code)}</span><small>${project.archived?'已封存':'進行中'}</small></header><div class="field-project-content"><h3>${e(project.name)}</h3><div class="field-project-counts"><span><b>${pending.length}</b>待辦工作</span><span${late.length?' class="field-overdue"':''}><b>${late.length}</b>逾期</span></div><div class="field-project-recent"><small>最近紀錄${recent?.date?' · '+e(recent.date.slice(5).replace('-','/')):''}</small><p>${e(recent?.title||'尚無工作紀錄')}</p></div><details class="field-project-info"><summary>聯絡與案場資訊</summary><dl><dt>地址</dt><dd>${e(project.address||'未填寫')}</dd><dt>聯絡人</dt><dd>${e(project.contact||'未填寫')}${project.phone?' · '+e(project.phone):''}</dd><dt>備註</dt><dd>${e(project.note||'未填寫')}</dd></dl></details><footer class="field-project-actions"><button class="btn primary" data-project-open="${id}">查看工作 ↗</button><details class="field-project-more"><summary aria-label="${e(project.name)}的更多操作">•••</summary><div><button type="button" data-project-edit="${id}">編輯資料</button><button type="button" data-project-archive="${id}">${project.archived?'恢復案場':'封存案場'}</button><button type="button" data-project-delete="${id}" class="danger">刪除案場</button></div></details></footer></div></article>`;
}
