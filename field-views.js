export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e = escapeHTML;
export function recentOrder(a,b) {
    const stamp = v => Number(v.createdAt?.toMillis?.() || v.createdAt || 0) || Date.parse(`${v.date || '1970-01-01'}T${v.time || '00:00'}:00`) || 0;
    return stamp(b)-stamp(a);
}
export function fieldList(data,title,rowHTML,filter='recent') {
    const active=data.filter(t=>!t.done&&(!t.sourceNote||t.captureKind==='task')),done=data.filter(t=>t.done);
    const rows=(filter==='active'?active:filter==='done'?done:data).slice().sort(filter==='active'?(a,b)=>(a.date||'9999').localeCompare(b.date||'9999'):recentOrder);
    const visible=filter==='recent'?rows.slice(0,20):rows;
    return `<header class="field-list-heading"><div><span class="field-eyebrow">工務工作區</span><h2>${e(title)}</h2><p>${data.length} 筆紀錄 · ${active.length} 件待辦</p></div><button class="btn" onclick="openItemModal()">新增工作</button></header><div class="field-list-tabs" role="group" aria-label="工作顯示範圍">${[['recent','最近紀錄',data.length],['active','待辦',active.length],['done','已完成',done.length],['all','全部',data.length]].map(([v,n,c])=>`<button type="button" data-field-list="${v}" aria-pressed="${filter===v}">${n}<span>${c}</span></button>`).join('')}</div><div class="card field-record-list">${visible.length?visible.map(rowHTML).join(''):'<div class="empty">這個範圍目前沒有紀錄。</div>'}</div>${rows.length>20&&filter==='recent'?'<button class="btn field-show-all" data-field-list="all">查看全部紀錄</button>':''}`;
}
export function projectSummaryCard(project,items,today) {
    const all=items.filter(t=>String(t.projectId)===String(project.id)),pending=all.filter(t=>!t.done),late=pending.filter(t=>t.date&&t.date<today),recent=[...all].sort(recentOrder)[0];
    const id=e(project.id);
    return `<article class="project-card field-project-card ${project.archived?'archived':''}"><header class="field-project-cover"><span aria-hidden="true">◇</span><span>${e(project.code)}</span><small>${project.archived?'已封存':'進行中'}</small></header><div class="field-project-content"><h3>${e(project.name)}</h3><div class="field-project-counts"><span><b>${pending.length}</b>待辦工作</span><span${late.length?' class="field-overdue"':''}><b>${late.length}</b>逾期</span></div><div class="field-project-recent"><small>最近紀錄${recent?.date?' · '+e(recent.date.slice(5).replace('-','/')):''}</small><p>${e(recent?.title||'尚無工作紀錄')}</p></div><details class="field-project-info"><summary>聯絡與案場資訊</summary><dl><dt>地址</dt><dd>${e(project.address||'未填寫')}</dd><dt>聯絡人</dt><dd>${e(project.contact||'未填寫')}${project.phone?' · '+e(project.phone):''}</dd><dt>備註</dt><dd>${e(project.note||'未填寫')}</dd></dl></details><footer class="field-project-actions"><button class="btn primary" data-project-open="${id}">查看工作 ↗</button><details class="field-project-more"><summary aria-label="${e(project.name)}的更多操作">•••</summary><div><button type="button" data-project-edit="${id}">編輯資料</button><button type="button" data-project-archive="${id}">${project.archived?'恢復案場':'封存案場'}</button><button type="button" data-project-delete="${id}" class="danger">刪除案場</button></div></details></footer></div></article>`;
}
