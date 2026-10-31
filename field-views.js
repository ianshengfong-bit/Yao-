export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e = escapeHTML;
export function recentOrder(a,b) {
    const stamp = v => Number(v.createdAt?.toMillis?.() || v.createdAt || 0) || Date.parse(`${v.date || '1970-01-01'}T${v.time || '00:00'}:00`) || 0;
    return stamp(b)-stamp(a);
}

/* ---- 工務列表共用：首頁與工作紀錄用同一種兩行卡片、篩選列與復原列 ---- */
export const localDay = (d = new Date()) => [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
export const isLateRow = (r,today = localDay()) => !r.done && Boolean(r.date) && r.date < today;
export function rowCounts(rows,today = localDay()) {
    const open=rows.filter(r=>!r.done);
    return {open:open.length,today:open.filter(r=>r.date===today).length,late:open.filter(r=>isLateRow(r,today)).length,done:rows.length-open.length,all:rows.length};
}
const LEGACY = {active:'open',recent:'all'};
export const normalizeFilter = f => LEGACY[f] || (['open','today','late','done','all'].includes(f) ? f : 'all');
// 未完成類：照日期（逾期在最前、沒日期的在最後）；已完成／全部：未完成在前，再照新舊。
export function pickRows(rows,filter,today = localDay()) {
    const f=normalizeFilter(filter);
    const pick={open:r=>!r.done,today:r=>!r.done&&r.date===today,late:r=>isLateRow(r,today),done:r=>r.done,all:()=>true}[f];
    const byDate=(a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||(a.time||'').localeCompare(b.time||'')||recentOrder(a,b);
    const byRecent=(a,b)=>Number(Boolean(a.done))-Number(Boolean(b.done))||recentOrder(a,b);
    return rows.filter(pick).sort(f==='done'||f==='all'?byRecent:byDate);
}
export function filterStrip(counts,filter,attr,extra = '') {
    const f=normalizeFilter(filter);
    return `<div class="field-strip" role="group" aria-label="篩選紀錄">${[['open','未完成'],['today','今天'],['late','逾期'],['done','已完成'],['all','全部']].filter(([v])=>v!=='late'||counts.late||f==='late').map(([v,n])=>`<button type="button" ${attr}="${v}" aria-pressed="${f===v}"${v==='late'?' class="is-late"':''}>${n}<b>${counts[v]}</b></button>`).join('')}${extra}</div>`;
}
const shortDate = date => date ? date.slice(5).replace('-','/') : '';
/* r: {id,title,done,date,time,reminderRequest}; opts.check 是完成按鈕的屬性字串，opts.actions 是展開後的按鈕 HTML。 */
export function rowCard(r,{key,project = '',kind = '',open = false,check,expandAttr,actions = '',today = localDay()}) {
    const late=isLateRow(r,today),when=r.date?shortDate(r.date)+(r.time?' '+r.time:''):'';
    const days=late?Math.round((Date.parse(today)-Date.parse(r.date))/864e5):0;
    const meta=[project,when,kind].filter(Boolean).map(t=>`<span>${e(t)}</span>`).join('');
    return `<article class="field-row${r.done?' is-done':''}${late?' is-late':''}${open?' is-open':''}"><button type="button" class="field-check" ${check} aria-label="${r.done?'恢復':'完成'}：${e(r.title)}">${r.done?'✓':''}</button><div class="field-row-body" ${expandAttr}="${e(key)}" role="button" tabindex="0" aria-expanded="${open}"><p class="field-row-title">${e(r.title)}</p><div class="field-row-meta">${meta}${late?`<span class="field-overdue">逾期 ${days} 天</span>`:''}${r.reminderRequest?'<span class="field-row-bell" title="提醒要求已記下；通知尚未設定">⏰</span>':''}</div>${open&&actions?`<div class="field-row-actions">${actions}</div>`:''}</div></article>`;
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
