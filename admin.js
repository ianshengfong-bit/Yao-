import {STATUSES, RECIPIENTS, WEEKDAYS, todayISO, shiftMonth, shiftDate, occurrenceDate, urgency, summary, weekRange, frequencyOf, recurrenceLabel, taskWindow} from './admin-core.js';

const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
const e = escapeHTML;
const pretty = date => date?.replaceAll('-', '/') || '—';
const timestamp = at => new Intl.DateTimeFormat('zh-TW', {
    timeZone:'Asia/Taipei', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', year:'numeric', hour12:false
}).format(new Date(at));
const options = (values, selected) => values.map(v => `<option value="${e(v)}" ${v === selected ? 'selected' : ''}>${e(v)}</option>`).join('');
const mobileIcon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',dots:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',down:'<path d="m7 10 5 5 5-5"/>',filter:'<path d="M4 7h16M7 12h10M10 17h4"/>'})[name] || ''}</svg>`;
const VIEWS = [['overview','待辦','grid'],['calendar','月曆','calendar'],['reviews','送審追蹤','file'],['recurring','固定排程','repeat'],['history','歷程','clock']];
const allowedStatuses = task => STATUSES.filter(s => !task.isSubmission || (s !== '已完成' || task.reviewStatus === '核定') && (!['已送出','待回覆'].includes(s) || task.reviewStatus === '審查中'));
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({check:'<path d="m5 12 4 4L19 6"/>',plus:'<path d="M12 5v14M5 12h14"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18"/>',repeat:'<path d="M4 9a8 8 0 0 1 13-5l3 3m0-5v5h-5M20 15A8 8 0 0 1 7 20l-3-3m0 5v-5h5"/>',file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6M8 13h8m-8 4h5"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',edit:'<path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15Z"/>',grid:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>'})[name] || ''}</svg>`;

export function createAdministration({getUser, getProjects, getSearch, isActive, getStore, toast, openProject}) {
    let uid = null, store = null, stop = null, tasks = [], templates = [];
    let tasksReady = false, templatesReady = false, error = '', generationError = '', epoch = 0;
    let projectId = 'all', tab = 'overview', filter = 'all', statusFilter = '', recipientFilter = '', range = 'near';
    let month = todayISO().slice(0, 7), selectedDate = todayISO();
    let generating = false, generationRequested = false, busy = false, lastToday = todayISO();
    let returnFocus = null, returnSelector = '', dialogKind = '', dialogId = '', dialogEpoch = 0;
    let quickDraft = {title:'',date:todayISO(),projectId:'',recipient:'監造'}, notice = null, mobileSearchOpen = false;
    const app = document.querySelector('#app');
    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop hidden admin-modal-backdrop';
    overlay.innerHTML = '<div class="modal admin-modal" role="dialog" aria-modal="true" aria-labelledby="adminDialogTitle" tabindex="-1"></div>';
    document.body.append(overlay);
    const dialog = overlay.firstElementChild;
    function fitDialog() {
        if (overlay.classList.contains('hidden')) return;
        const viewport = window.visualViewport;
        overlay.style.setProperty('--admin-viewport-height',`${viewport?.height || window.innerHeight}px`);
        overlay.style.setProperty('--admin-viewport-top',`${viewport?.offsetTop || 0}px`);
    }
    window.visualViewport?.addEventListener('resize',fitDialog);
    window.visualViewport?.addEventListener('scroll',fitDialog);

    function chosenProject() {
        const projects = getProjects();
        if (projectId !== 'all' && !projects.some(p => p.id === projectId)) projectId = 'all';
        return projects.find(p => p.id === projectId);
    }
    function scoped(includeArchived = false) {
        return tasks.filter(t => (projectId === 'all' || t.projectId === projectId) && (includeArchived || !t.archived));
    }
    const projectName = id => getProjects().find(p => p.id === id)?.name || '案場已移除';
    function projectOptions(selected) {
        return '<option value="">選擇案場</option>' + getProjects().filter(p => !p.archived || p.id === selected).map(p => `<option value="${e(p.id)}" ${p.id === selected ? 'selected' : ''}>${e(p.name)}${p.archived ? '（已封存）' : ''}</option>`).join('');
    }
    function setProject(id) {
        projectId = id; filter = 'all'; statusFilter = ''; recipientFilter = ''; notice = null;
        try { localStorage.setItem(`yao-admin-project:${uid}`,id); } catch {}
        render();
    }
    function searched(list) {
        const q = getSearch().trim().toLocaleLowerCase();
        return list.filter(t => (!q || [t.title, t.note, t.recipient, t.status, t.reviewStatus, projectName(t.projectId), pretty(t.date), t.date].join(' ').toLocaleLowerCase().includes(q)) &&
            (!statusFilter || t.status === statusFilter) && (!recipientFilter || t.recipient === recipientFilter));
    }
    function badge(task) {
        const u = urgency(task);
        return `<span class="admin-badge admin-${u.level}">${e(u.label)}</span>`;
    }
    function row(task) {
        const done = task.status === '已完成';
        const cadence = task.recurringId ? (task.recurrenceFrequency === 'weekly' ? '每週固定' : '每月固定') : '';
        const action = task.isSubmission ? (task.reviewStatus === '審查中' ? 'review' : task.reviewStatus === '核定' ? '' : 'submit') : done ? '' : 'complete';
        const allowed = allowedStatuses(task), u = urgency(task);
        const mobileDate = task.date === todayISO() ? '今天到期' : `${pretty(task.date).slice(5)} 週${WEEKDAYS[new Date(`${task.date}T00:00:00Z`).getUTCDay()]}`;
        const mobileState = task.isSubmission ? ({'退件':'returned','審查中':'reviewing','核定':'approved'}[task.reviewStatus] || STATUSES.indexOf(task.status)) : STATUSES.indexOf(task.status);
        const mobileMeta = `<span class="admin-row-mobile-meta"><span class="admin-mobile-due admin-${u.level}">${icon('calendar')}${e(mobileDate)}${!done && task.date !== todayISO() && ['overdue','soon','week'].includes(u.level) ? `<em>${e(u.label)}</em>` : ''}</span><span class="admin-mobile-status admin-state-${mobileState}">${e(task.isSubmission ? task.reviewStatus : task.status)}${task.isSubmission && task.submissions?.length ? ` V${task.submissions.at(-1).version}` : ''}</span><span class="admin-mobile-recipient">送交 ${e(task.recipient)}</span>${cadence ? `<span class="admin-mobile-cadence" aria-label="${cadence}" title="${cadence}">${icon('repeat')}${cadence.replace('固定','')}</span>` : ''}</span>`;
        return `<article class="admin-task-row ${done ? 'is-done' : ''} admin-task-${u.level}" data-task-id="${e(task.id)}">
            <button class="admin-complete ${done ? 'is-checked' : ''}" data-admin="${task.isSubmission ? 'detail' : done ? 'reopen' : 'complete'}" data-id="${e(task.id)}" aria-label="${task.isSubmission ? '查看送審' : done ? '重新開啟' : '完成'}：${e(task.title)}" ${busy ? 'disabled' : ''}>${done ? icon('check') : task.isSubmission ? icon('file') : ''}</button>
            <button type="button" class="admin-row-main" data-admin="detail" data-id="${e(task.id)}"><strong>${e(task.title)}</strong><span class="admin-row-desktop-meta">${projectId === 'all' ? `<span class="admin-project-tag">${e(projectName(task.projectId))}</span>` : ''}${e(task.recipient)}${cadence ? ` <span class="admin-recurring-tag">${icon('repeat')}${cadence}</span>` : ''}${task.isSubmission ? ` · ${e(task.reviewStatus)}${task.submissions?.length ? ` V${task.submissions.at(-1).version}` : ''}` : ''}</span>${mobileMeta}${projectId === 'all' ? `<span class="admin-mobile-task-project">${e(projectName(task.projectId))}</span>` : ''}</button>
            <div class="admin-row-deadline"><span>${e(pretty(task.date).slice(5))} 週${WEEKDAYS[new Date(`${task.date}T00:00:00Z`).getUTCDay()]}</span>${badge(task)}</div>
            <div class="admin-row-actions"><select class="admin-inline-status" data-task-status="${e(task.id)}" aria-label="${e(task.title)}的工作狀態" ${busy ? 'disabled' : ''}>${options(allowed,task.status)}</select>${task.isSubmission && action ? `<button class="btn admin-row-review" data-admin="${action}" data-id="${e(task.id)}" ${busy ? 'disabled' : ''}>${action === 'submit' ? '登記送審' : '記錄結果'}</button>` : ''}<button class="admin-edit-button" data-admin="edit" data-id="${e(task.id)}" aria-label="編輯：${e(task.title)}">${icon('edit')}</button></div><button class="admin-mobile-row-more" data-admin="row-actions" data-id="${e(task.id)}" aria-label="操作：${e(task.title)}">${mobileIcon('dots')}</button></article>`;
    }
    function taskList(list, empty = '這裡目前沒有事項。') {
        return list.length ? `<div class="admin-task-list">${[...list].sort((a,b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)).map(row).join('')}</div>` : `<div class="admin-empty">${e(empty)}</div>`;
    }
    function scheduleGeneration() {
        if (!uid || uid !== getUser()?.uid) return;
        generationRequested = true;
        if (generating || !tasksReady || !templatesReady || error) return;
        generate();
    }
    async function generate() {
        generating = true;
        generationRequested = false;
        const token = epoch, currentStore = store;
        try {
            const today = todayISO();
            for (const template of templates) {
                if (token !== epoch) return;
                const project = getProjects().find(p => p.id === template.projectId);
                if (template.active && project && !project.archived) await currentStore.generate(template, today);
            }
            if (token === epoch) generationError = '';
        } catch (err) {
            if (token === epoch) generationError = friendlyError(err, '固定排程尚未完成');
        } finally {
            if (token === epoch) {
                generating = false;
                if (isActive()) render();
                if (generationRequested && !generationError) scheduleGeneration();
            }
        }
    }
    function friendlyError(err, prefix = '行政資料無法讀取') {
        if (err.code === 'permission-denied' || err.code === 'firestore/permission-denied') return `${prefix}：Firebase 權限尚未允許行政資料，請依附帶說明新增權限。原有功能可繼續使用。`;
        if (err.code === 'unavailable' || err.code === 'firestore/unavailable') return `${prefix}：目前無法連線，請確認網路後重試。`;
        return `${prefix}：${err.message || '請稍後重試。'}`;
    }
    function ensureStarted() {
        const user = getUser();
        if (!user) return;
        if (uid === user.uid && stop) return;
        reset();
        uid = user.uid;
        try { projectId = localStorage.getItem(`yao-admin-project:${uid}`) || 'all'; } catch {}
        store = getStore(uid);
        const token = epoch;
        const refresh = () => { updateBadge(); if (isActive()) render(); };
        stop = store.subscribe(list => {
            if (token !== epoch) return;
            tasks = list; tasksReady = true; refresh();
            if (generationRequested) scheduleGeneration();
        }, list => {
            if (token !== epoch) return;
            templates = list; templatesReady = true; refresh(); scheduleGeneration();
        }, err => {
            if (token !== epoch) return;
            error = friendlyError(err); refresh();
        });
    }
    function updateBadge() {
        const node = document.querySelector('#adminNavCount');
        if (!node) return;
        const today = todayISO();
        const count = tasks.filter(t => !t.archived && t.status !== '已完成' && t.date <= today).length;
        node.textContent = String(count);
        node.classList.toggle('hidden', !count);
    }
    function reset() {
        epoch++;
        stop?.(); stop = null; uid = null; store = null;
        tasks = []; templates = []; tasksReady = false; templatesReady = false;
        error = ''; generationError = ''; generating = false; generationRequested = false;
        projectId = 'all'; tab = 'overview'; filter = 'all'; statusFilter = ''; recipientFilter = ''; range = 'near'; notice = null; mobileSearchOpen = false;
        quickDraft = {title:'',date:todayISO(),projectId:'',recipient:'監造'};
        month = todayISO().slice(0,7); selectedDate = todayISO(); busy = false;
        closeDialog(); updateBadge();
    }
    function calendar(list) {
        const [y,m] = month.split('-').map(Number);
        const firstDay = new Date(Date.UTC(y,m-1,1)).getUTCDay();
        const count = new Date(Date.UTC(y,m,0)).getUTCDate();
        const today = todayISO();
        let cells = Array.from({length:firstDay}, () => '<div class="admin-calendar-blank" aria-hidden="true"></div>').join('');
        for (let day = 1; day <= count; day++) {
            const date = `${month}-${String(day).padStart(2,'0')}`;
            const rows = list.filter(t => t.date === date);
            cells += `<button type="button" class="admin-calendar-day ${date === today ? 'is-today' : ''} ${date === selectedDate ? 'is-selected' : ''}" data-admin="date" data-date="${date}" aria-pressed="${date === selectedDate}" aria-label="${pretty(date)}，${rows.length} 件事項">
                <span class="admin-day-number">${day}${date === today ? '<small>今天</small>' : ''}</span>
                ${rows.slice(0,2).map(t => `<span class="admin-calendar-label admin-${urgency(t).level}">${e(t.title)}</span>`).join('')}
                ${rows.length > 2 ? `<span class="admin-calendar-more">＋${rows.length-2} 件</span>` : ''}</button>`;
        }
        const dates = [...new Set(list.filter(t => t.date.startsWith(month)).map(t => t.date))].sort();
        return `<section class="card admin-calendar-card"><div class="admin-section-head"><div><h3>行政月曆</h3><p class="muted">${y} 年 ${m} 月 · 點日期查看當日事項</p></div>
            <div class="admin-month-controls"><button class="btn" data-admin="month" data-step="-1" aria-label="上一個月">‹</button><button class="btn" data-admin="today">今天</button><button class="btn" data-admin="month" data-step="1" aria-label="下一個月">›</button></div></div>
            <div class="admin-calendar-desktop"><div class="admin-calendar-weekdays">${['日','一','二','三','四','五','六'].map(d => `<span>${d}</span>`).join('')}</div><div class="admin-calendar-grid">${cells}</div></div>
            <div class="admin-calendar-mobile">${dates.length ? dates.map(date => `<div class="admin-mobile-date"><button class="admin-date-heading ${date === selectedDate ? 'is-selected' : ''}" data-admin="date" data-date="${date}">${pretty(date).slice(5)} <span>${list.filter(t => t.date === date).length} 件</span></button>${taskList(list.filter(t => t.date === date))}</div>`).join('') : '<div class="admin-empty">本月尚未安排事項。</div>'}</div>
            <div class="admin-legend"><span class="admin-overdue">● 逾期</span><span class="admin-soon">● 3 天內</span><span class="admin-week">● 7 天內</span><span class="admin-later">● 之後</span><span class="admin-done">● 完成</span></div>
            </section>`;
    }
    function composer() {
        const selected = projectId !== 'all' ? projectId : quickDraft.projectId;
        return `<form id="adminQuickForm" class="admin-quick-form"><div class="admin-quick-input">${icon('plus')}<input id="adminQuickTitle" name="title" aria-label="快速新增事項名稱" placeholder="寫下一件要做的事…" maxlength="160" required value="${e(quickDraft.title)}"></div><div class="admin-quick-tools">${projectId === 'all' ? `<select id="adminQuickProject" name="projectId" aria-label="快速新增案場" required>${projectOptions(selected)}</select>` : `<input type="hidden" name="projectId" value="${e(selected)}">`}<label class="admin-quick-date">${icon('calendar')}<input id="adminQuickDate" name="date" aria-label="快速新增截止日期" type="date" required min="2000-01-01" max="2100-12-31" value="${e(quickDraft.date)}"></label><select id="adminQuickRecipient" name="recipient" aria-label="快速新增提交對象">${options(RECIPIENTS,quickDraft.recipient)}</select><button class="admin-quick-more" type="button" data-admin="quick-more">詳細設定</button><button class="btn primary" type="submit" ${busy || chosenProject()?.archived ? 'disabled' : ''}>新增${icon('arrow')}</button></div></form>`;
    }
    function weekStrip(all) {
        const today = todayISO(), [start] = weekRange(today);
        return `<section class="card admin-week-card"><div class="admin-section-head"><h3>本週節奏</h3><button class="admin-text-button" data-admin="tab" data-tab="calendar">看月曆${icon('arrow')}</button></div><div class="admin-week-strip">${Array.from({length:7},(_,i) => {
            const date = shiftDate(start,i), count = all.filter(t => t.date === date && t.status !== '已完成').length;
            return `<button data-admin="week-day" data-date="${date}" class="${date === today ? 'is-today' : ''} ${filter === 'date' && date === selectedDate ? 'is-selected' : ''}" aria-label="${pretty(date)}，${count} 件未完成事項"><span>週${WEEKDAYS[(i+1)%7]}</span><strong>${Number(date.slice(8))}</strong><small>${count ? `${count} 件` : '—'}</small></button>`;
        }).join('')}</div><p class="admin-week-hint">點日期，直接看當天要做的事。</p></section>`;
    }
    function groupedTasks(list) {
        if (!list.length) return `<div class="admin-empty"><span class="admin-empty-icon">${icon(range === 'done' ? 'check' : 'calendar')}</span><strong>${filter !== 'all' || statusFilter || recipientFilter || getSearch().trim() ? '這個範圍沒有符合的事項' : range === 'near' ? '近期工作都安排好了' : range === 'done' ? '完成的工作會留在這裡' : '這個月份還沒有安排工作'}</strong><p>${range === 'near' && filter === 'all' ? '下個月的固定工作，會留在下個月。' : '可以切換範圍，或新增一件工作。'}</p><button class="btn" data-admin="new">＋ 新增事項</button></div>`;
        const today = todayISO(), groups = new Map();
        for (const task of [...list].sort((a,b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))) {
            const key = range === 'done' && filter === 'all' ? '已完成' : task.date < today ? '逾期・先處理' : task.date === today ? '今天' : task.date === shiftDate(today,1) ? '明天' : task.date.slice(0,7) === today.slice(0,7) ? '接下來' : `${Number(task.date.slice(0,4))} 年 ${Number(task.date.slice(5,7))} 月`;
            if (!groups.has(key)) groups.set(key,[]);
            groups.get(key).push(task);
        }
        return [...groups].map(([label,rows]) => `<section class="admin-task-group"><div class="admin-group-title ${label.startsWith('逾期') ? 'admin-overdue' : ''}"><h3>${label}</h3><span>${rows.length} 件</span></div>${taskList(rows)}</section>`).join('');
    }
    function overview(all) {
        const today = todayISO(), s = summary(all), [start,end] = weekRange(today);
        const stat = (key,label,value,hint,glyph) => `<button class="admin-stat ${filter === key ? 'is-active' : ''} ${key === 'overdue' && value ? 'has-overdue' : ''}" data-admin="filter" data-filter="${key}"><span class="admin-stat-top">${label}${icon(glyph)}</span><strong>${value}<small> 件</small></strong><span class="admin-stat-hint">${hint}</span></button>`;
        const selected = filter === 'all' ? taskWindow(all,range,today) : filter === 'date' ? all.filter(t => t.date === selectedDate && t.status !== '已完成') : s[filter] || [];
        const list = searched(selected);
        const ranges = [['near','近期'],['month',`${Number(today.slice(5,7))} 月`],['next',`${Number(shiftMonth(today.slice(0,7),1).slice(5))} 月`],['all','所有待辦'],['done','已完成']];
        const names = {today:'今天到期',week:'本週事項',overdue:'逾期待辦',waiting:'所有日期的待回覆',date:`${pretty(selectedDate).slice(5)} 當日事項`};
        const future = all.filter(t => !t.archived && t.status !== '已完成' && t.date.startsWith(shiftMonth(today.slice(0,7),1))).length;
        const mobileRange = filter === 'all' ? range : filter;
        const mobileRanges = [['near','近期'],['today',`今天 (${s.today.length})`],['week',`本週 (${s.week.length})`],['overdue',`逾期 (${s.overdue.length})`],['waiting',`待回覆 (${s.waiting.length})`],['month','本月'],['next','下個月'],['all','所有待辦'],['done','已完成']];
        if (filter === 'date') mobileRanges.push(['date',pretty(selectedDate).slice(5)]);
        const mobileSummary = `<div class="admin-mobile-summary" role="group" aria-label="行政提醒">${[['today','今天',s.today.length,'calendar'],['week','本週',s.week.length,'grid'],['overdue','逾期',s.overdue.length,'clock']].map(([key,label,count,glyph]) => `<button data-admin="filter" data-filter="${key}" class="${filter === key ? 'is-active' : ''} ${key === 'overdue' && count ? 'has-overdue' : ''}" aria-pressed="${filter === key}" aria-label="${label} ${count} 件"><span>${icon(glyph)}${label}</span><strong>${count}<small> 件</small></strong></button>`).join('')}</div>`;
        return `${mobileSummary}<div class="admin-mobile-listbar"><label><span class="admin-sr-only">查看工作範圍</span><select id="adminMobileRange" aria-label="查看工作範圍">${mobileRanges.map(([key,label]) => `<option value="${key}" ${key === mobileRange ? 'selected' : ''}>${label}</option>`).join('')}</select></label><span>${list.length} 件</span><button data-admin="mobile-filters" aria-label="篩選工作" class="${statusFilter || recipientFilter ? 'is-filtered' : ''}">${mobileIcon('filter')}篩選${statusFilter || recipientFilter ? ' ·' : ''}</button></div><div class="admin-stats">${stat('today','今天',s.today.length,'今天到期','calendar')}${stat('week','本週',s.week.length,`${pretty(start).slice(5)}–${pretty(end).slice(5)}`,'grid')}${stat('overdue','逾期',s.overdue.length,'優先處理','clock')}${stat('waiting','待回覆',s.waiting.length,'追蹤已送出的文件','file')}</div>
            <div class="admin-workspace-grid"><section class="card admin-work-card"><div class="admin-section-head"><div><span class="admin-eyebrow">${projectId === 'all' ? '全部案場' : e(projectName(projectId))}</span><h3>待辦工作</h3></div><button class="btn" data-admin="new">${icon('plus')}新增事項</button></div>${composer()}<div class="admin-list-toolbar"><div class="admin-range-tabs" role="group" aria-label="工作日期範圍">${ranges.map(([key,label]) => `<button data-admin="range" data-range="${key}" class="${range === key && filter === 'all' ? 'active' : ''}" aria-pressed="${range === key && filter === 'all'}">${label}</button>`).join('')}</div><details class="admin-filter-menu" ${statusFilter || recipientFilter ? 'open' : ''}><summary>篩選${statusFilter || recipientFilter ? ' · 已套用' : ''}</summary><div class="admin-filter-popover"><label>工作狀態<select id="adminStatusFilter"><option value="">全部狀態</option>${options(STATUSES,statusFilter)}</select></label><label>提交對象<select id="adminRecipientFilter"><option value="">全部對象</option>${options(RECIPIENTS,recipientFilter)}</select></label><button class="admin-text-button" data-admin="clear-filters">清除篩選</button></div></details></div><div class="admin-range-description"><span>${filter === 'all' ? ({near:'逾期與未來 7 天，先看眼前要做的事。',month:`${Number(today.slice(5,7))} 月未完成工作`,next:`${Number(shiftMonth(today.slice(0,7),1).slice(5))} 月未來排程`,all:'所有日期的未完成工作',done:'所有日期的完成紀錄'})[range] : names[filter]}</span><span>${list.length} 件</span>${filter !== 'all' ? '<button class="admin-text-button" data-admin="filter" data-filter="all">回到近期</button>' : ''}</div>${groupedTasks(list)}${future && range !== 'next' && range !== 'all' && filter === 'all' ? `<button class="admin-future-link" data-admin="range" data-range="next">${icon('calendar')}下個月已安排 ${future} 件<span>查看${icon('arrow')}</span></button>` : ''}</section>
            <aside class="admin-workspace-aside">${weekStrip(all)}<section class="card admin-shortcuts"><div class="admin-section-head"><h3>常用工作</h3><span class="muted">少打幾個字</span></div>${[['施工日誌','彙整日誌與施作照片','once'],['人員名冊更新','核對人員與證照資料','monthly'],['本週進度彙整','整理進度與待處理事項','weekly'],['文件送審','保留每次送審版次','submission']].map(([title,hint,kind]) => `<button data-admin="preset" data-title="${title}" data-kind="${kind}"><span class="admin-shortcut-icon">${icon(kind === 'submission' ? 'file' : kind === 'once' ? 'edit' : 'repeat')}</span><span><strong>${title}</strong><small>${hint}</small></span>${icon('plus')}</button>`).join('')}</section><div class="admin-tip">${icon('check')}<p><strong>完成，就點左邊的圓圈。</strong><br>進度可以直接改；點工作名稱查看完整內容。</p></div></aside></div>`;
    }
    function calendarView(list) {
        return `<div class="admin-overview-grid">${calendar(list)}<section class="card admin-day-detail"><div class="admin-section-head"><div><h3>${pretty(selectedDate).slice(5)} 當日事項</h3><p class="muted">${pretty(selectedDate)}</p></div><button class="btn" data-admin="new" data-date="${selectedDate}" ${chosenProject()?.archived ? 'disabled' : ''}>＋ 新增</button></div>${taskList(list.filter(t => t.date === selectedDate), '這天沒有事項，可以先安排工作。')}</section></div>`;
    }
    function reviews(list) {
        const submissions = taskWindow(list,range).filter(t => t.isSubmission);
        return `<section class="card"><div class="admin-section-head"><div><h3>送審追蹤</h3><p class="muted">每次送出保留版次、對象與審查結果；退件後可建立下一版。</p></div><button class="btn primary" data-admin="new-review" ${chosenProject()?.archived ? 'disabled' : ''}>＋ 送審事項</button></div>
            <div class="admin-range-tabs admin-review-ranges" role="group" aria-label="送審日期範圍">${[['near','近期'],['month','本月'],['next','下月'],['all','所有待辦'],['done','已核定']].map(([key,label]) => `<button data-admin="range" data-range="${key}" class="${range === key ? 'active' : ''}" aria-pressed="${range === key}">${label}</button>`).join('')}</div>
            ${submissions.length ? `<div class="admin-review-grid">${submissions.map(t => {
                const version = t.submissions?.at(-1)?.version;
                return `<button class="admin-review-card" data-admin="detail" data-id="${e(t.id)}"><span class="admin-review-top"><span class="admin-badge">${e(t.reviewStatus)}</span><strong>${version ? `V${version}` : '尚未送出'}</strong></span><h3>${e(t.title)}</h3><p>${projectId === 'all' ? `${e(projectName(t.projectId))} · ` : ''}${e(t.recipient)} · ${e(t.status)}</p><div class="admin-review-deadline">期限 ${pretty(t.date)} ${badge(t)}</div></button>`;
            }).join('')}</div>` : '<div class="admin-empty">這個日期範圍沒有送審事項，可以切換範圍或新增。</div>'}</section>`;
    }
    function recurring() {
        const query = getSearch().trim().toLocaleLowerCase();
        const list = templates.filter(t => (projectId === 'all' || t.projectId === projectId) && (!query || [t.title,t.note,t.recipient,projectName(t.projectId)].join(' ').toLocaleLowerCase().includes(query)));
        return `<section class="card"><div class="admin-section-head"><div><h3>固定排程</h3><p class="muted">每週、每月只設定一次，後續工作自動排好。</p></div><button class="btn primary" data-admin="new-recurring" ${chosenProject()?.archived ? 'disabled' : ''}>＋ 固定事項</button></div>
            ${list.length ? `<div class="admin-recurring-grid">${list.map(t => {
                const next = tasks.filter(task => task.recurringId === t.id && !task.archived && task.status !== '已完成' && task.date >= todayISO()).sort((a,b) => a.date.localeCompare(b.date))[0];
                return `<article class="admin-recurring-card ${t.active ? '' : 'is-paused'}"><div class="admin-recurring-top"><span class="admin-cadence">${icon('repeat')}${e(recurrenceLabel(t))}</span><span class="admin-badge ${t.active ? 'admin-done' : ''}">${t.active ? '排程中' : '已暫停'}</span></div><h3>${e(t.title)}</h3><p>${e(projectName(t.projectId))} · ${e(t.recipient)}${t.isSubmission ? ' · 送審文件' : ''}</p><div class="admin-next-occurrence">${next ? `下次工作 <strong>${pretty(next.date)}</strong>` : t.active ? '尚無待辦工作' : '已建立的工作保留'}</div><div class="admin-recurring-actions"><button class="btn" data-admin="edit-template" data-id="${e(t.id)}">編輯設定</button><button class="admin-text-button" data-admin="toggle-template" data-id="${e(t.id)}" ${busy ? 'disabled' : ''}>${t.active ? '暫停排程' : '恢復排程'}</button></div></article>`;
            }).join('')}</div>` : '<div class="admin-empty"><strong>把每次都要做的事，交給固定排程。</strong><p>例如每週五彙整進度、每月 5 日更新名冊。</p><button class="btn" data-admin="new-recurring">＋ 設定第一件固定工作</button></div>'}
            <details class="admin-schedule-help"><summary>調整排程會怎麼影響工作？</summary><p>網站開啟時提前排到下個月。29～31 日遇到短月會排在月底。編輯或暫停設定只影響尚未建立的工作；已排好的事項可從工作台個別編輯或封存，完成紀錄會保留。</p></details></section>`;
    }
    function history() {
        const q = getSearch().trim().toLocaleLowerCase();
        const events = [
            ...scoped(true).flatMap(t => (t.history || []).map(h => ({...h, title:t.title, id:t.id, archived:t.archived}))),
            ...templates.filter(t => projectId === 'all' || t.projectId === projectId).flatMap(t => (t.history || []).map(h => ({...h, title:t.title, template:true})))
        ].filter(h => !q || [h.title,h.action,h.detail].join(' ').toLocaleLowerCase().includes(q)).sort((a,b) => b.at-a.at);
        return `<section class="card"><div class="admin-section-head"><div><h3>行政歷程</h3><p class="muted">建立、編輯、狀態變更、送審、退件、核定與封存紀錄。</p></div></div>
            ${events.length ? `<ol class="admin-timeline">${events.map(h => `<li><span class="admin-history-dot"></span><div><small>${e(timestamp(h.at))}</small><p><strong>${e(h.action)}</strong> · ${e(h.title)}${h.archived ? '（已封存）' : ''}</p><div class="admin-history-detail">${e(h.detail)}</div>${h.id ? `<button class="admin-text-button" data-admin="detail" data-id="${e(h.id)}">查看事項 ›</button>` : ''}</div></li>`).join('')}</ol>` : '<div class="admin-empty">尚無行政紀錄。</div>'}</section>`;
    }
    function render() {
        if (!isActive() || !getUser()) return;
        ensureStarted();
        const project = chosenProject();
        updateBadge();
        const activeProjects = getProjects().filter(p => !p.archived);
        const due = id => tasks.filter(t => (id === 'all' || t.projectId === id) && !t.archived && t.status !== '已完成' && t.date <= todayISO()).length;
        const moreProjects = getProjects().some(p => p.archived) || activeProjects.length > 6;
        const projectSelect = `<div class="admin-project-bar"><div class="admin-project-chips" role="group" aria-label="選擇案場">${[{id:'all',name:'全部案場'},...activeProjects].map(p => `<button class="${projectId === p.id ? 'active' : ''}" data-admin="project" data-project="${e(p.id)}" aria-pressed="${projectId === p.id}">${e(p.name)}${due(p.id) ? `<span>${due(p.id)}</span>` : ''}</button>`).join('')}</div>${moreProjects ? `<select id="adminProject" aria-label="更多案場"><option value="all">全部案場</option>${getProjects().map(p => `<option value="${e(p.id)}" ${p.id === projectId ? 'selected' : ''}>${e(p.name)}${p.archived ? '（已封存）' : ''}</option>`).join('')}</select>` : ''}</div>`;
        let content;
        if (error) content = `<section class="card admin-error" role="alert"><h3>行政資料尚未就緒</h3><p>${e(error)}</p><button class="btn" data-admin="retry">重新連線</button></section>`;
        else if (!tasksReady || !templatesReady) content = '<section class="card admin-empty" role="status">正在載入行政資料…</section>';
        else if (!getProjects().length) content = `<section class="card admin-empty"><h3>先建立一個案場</h3><p>工作會依案場整理，之後可以隨時切換。</p><button class="btn primary" data-admin="new-project">＋ 新增案場</button></section>`;
        else {
            const all = scoped(), list = searched(all);
            const view = tab === 'overview' ? overview(all) : tab === 'calendar' ? calendarView(list) : tab === 'reviews' ? reviews(list) : tab === 'recurring' ? recurring() : history();
            content = `<div class="admin-tabs" role="group" aria-label="行政視圖">${[['overview','工作台','grid'],['calendar','月曆','calendar'],['reviews','送審追蹤','file'],['recurring','固定排程','repeat'],['history','歷程','clock']].map(([key,name,glyph]) => `<button class="${tab === key ? 'active' : ''}" data-admin="tab" data-tab="${key}" aria-pressed="${tab === key}">${icon(glyph)}${name}</button>`).join('')}</div>
                ${project?.archived ? '<div class="admin-info">此案場已封存，固定事項暫停產生。仍可查看与處理已有行政紀錄。</div>' : ''}
                ${generationError ? `<div class="admin-error" role="alert">${e(generationError)} <button class="btn" data-admin="generate">重試排程</button></div>` : ''}
                ${notice ? `<div class="admin-save-notice" role="status">${icon('check')}<span>${e(notice.text)}</span>${notice.undo ? '<button data-admin="undo">撤銷</button>' : ''}<button data-admin="dismiss-notice" aria-label="關閉儲存提示">×</button></div>` : ''}
                ${view}`;
        }
        const focused = app.contains(document.activeElement) ? document.activeElement : null;
        const focusId = focused?.id, selection = focused?.tagName === 'INPUT' && ['text','search'].includes(focused.type) ? [focused.selectionStart,focused.selectionEnd] : null;
        const focusedStatus = focused?.dataset.taskStatus;
        const projectScroll = app.querySelector('.admin-project-chips')?.scrollLeft || 0;
        app.innerHTML = `<div class="admin-page">${mobileChrome()}<div class="admin-heading"><span class="admin-eyebrow">${pretty(todayISO())} · 星期${WEEKDAYS[new Date(`${todayISO()}T00:00:00Z`).getUTCDay()]}</span><p>${getSearch().trim() ? `搜尋「${e(getSearch().trim())}」` : '先看近期工作，再安排下一步。'}</p></div>${projectSelect}${content}</div>`;
        if (focusId) { const replacement = document.getElementById(focusId); replacement?.focus({preventScroll:true}); if (selection) replacement?.setSelectionRange(...selection); }
        else if (focusedStatus) app.querySelector(`[data-task-status="${CSS.escape(focusedStatus)}"]`)?.focus({preventScroll:true});
        const chips = app.querySelector('.admin-project-chips'), activeChip = chips?.querySelector('.active');
        if (chips && activeChip) {
            chips.scrollLeft = projectScroll;
            const left = activeChip.offsetLeft - chips.offsetLeft;
            if (left < chips.scrollLeft) chips.scrollLeft = left;
            else if (left + activeChip.offsetWidth > chips.scrollLeft + chips.clientWidth) chips.scrollLeft = left + activeChip.offsetWidth - chips.clientWidth;
        }
    }
    function mobileChrome() {
        const viewName = VIEWS.find(([key]) => key === tab)?.[1] || '待辦';
        const addAction = tab === 'reviews' ? 'new-review' : tab === 'recurring' ? 'new-recurring' : 'new';
        return `<header class="admin-mobile-header"><div class="admin-mobile-brand"><span class="admin-brand-mark">${icon('file')}</span><div><span>Yao · ${pretty(todayISO()).slice(5)} 週${WEEKDAYS[new Date(`${todayISO()}T00:00:00Z`).getUTCDay()]}</span><h1>行政工作台</h1></div></div><div><button data-admin="mobile-search" aria-label="${mobileSearchOpen ? '收起搜尋' : '搜尋工作'}" aria-expanded="${mobileSearchOpen}">${mobileIcon('search')}</button><button data-admin="mobile-nav" aria-label="Yao 選單">${mobileIcon('menu')}</button></div></header>
        ${mobileSearchOpen || getSearch().trim() ? `<div class="admin-mobile-search"><input id="adminMobileSearch" type="search" aria-label="搜尋行政工作" placeholder="搜尋工作或案場" value="${e(getSearch())}"><button data-admin="mobile-search-clear" aria-label="清除並收起搜尋">×</button></div>` : ''}
        <div class="admin-mobile-context"><button data-admin="mobile-projects" aria-label="切換案場：${projectId === 'all' ? '全部案場' : e(projectName(projectId))}"><span class="admin-project-symbol">${icon('grid')}</span><span class="admin-mobile-project-name"><small>目前案場</small><strong>${projectId === 'all' ? '全部案場' : e(projectName(projectId))}</strong></span>${mobileIcon('down')}</button><button data-admin="mobile-views" aria-label="行政功能：${viewName}">更多${mobileIcon('down')}</button></div>
        ${tasksReady && templatesReady && !error && getProjects().some(p => !p.archived) ? `<div class="admin-mobile-add"><nav aria-label="行政常用功能">${[['overview','待辦','grid'],['calendar','月曆','calendar'],['reviews','送審','file']].map(([key,label,glyph]) => `<button data-admin="tab" data-tab="${key}" class="${tab === key ? 'is-active' : ''}" aria-pressed="${tab === key}">${icon(glyph)}<span>${label}</span></button>`).join('')}</nav><button class="admin-mobile-create" data-admin="${addAction}" aria-label="${tab === 'reviews' ? '新增送審' : tab === 'recurring' ? '新增固定事項' : '新增工作'}" data-date="${tab === 'calendar' ? selectedDate : todayISO()}" ${projectId !== 'all' && chosenProject()?.archived ? 'disabled' : ''}>${icon('plus')}<span>新增</span></button></div>` : ''}`;
    }
    function mobileMenu(kind) {
        dialogKind = kind; dialogId = '';
        if (kind === 'mobile-projects') showDialog('切換案場', `<div class="admin-sheet-list">${[{id:'all',name:'全部案場'},...getProjects()].map(p => `<button data-admin="project" data-project="${e(p.id)}" class="${p.id === projectId ? 'is-selected' : ''}"><span>${e(p.name)}${p.archived ? '（已封存）' : ''}</span>${p.id === projectId ? icon('check') : ''}</button>`).join('')}</div>`);
        else if (kind === 'mobile-views') showDialog('行政功能', `<div class="admin-sheet-list">${VIEWS.map(([key,name,glyph]) => `<button data-admin="tab" data-tab="${key}" class="${key === tab ? 'is-selected' : ''}">${icon(glyph)}<span>${name}</span>${key === tab ? icon('check') : ''}</button>`).join('')}</div>`);
        else if (kind === 'mobile-nav') showDialog('Yao 選單', `<div class="admin-sheet-list">${[...document.querySelectorAll('#nav [data-page]')].map(n => `<button data-admin="navigate" data-page="${e(n.dataset.page)}"><span>${e([...n.childNodes].filter(c => c.nodeType === Node.TEXT_NODE).map(c => c.textContent).join('').trim())}</span></button>`).join('')}<button data-admin="quick-note">${icon('edit')}<span>快速記一下</span></button><button data-admin="logout"><span>登出</span></button></div>`);
        else if (kind === 'mobile-filters') showDialog('篩選工作', `<form id="adminMobileFilterForm"><label>工作狀態<select name="status"><option value="">全部狀態</option>${options(STATUSES,statusFilter)}</select></label><label>提交對象<select name="recipient"><option value="">全部對象</option>${options(RECIPIENTS,recipientFilter)}</select></label><div class="modal-actions"><button type="button" class="btn" data-admin="clear-filters">清除</button><button type="submit" class="btn primary">套用</button></div></form>`);
    }
    function rowActions(id) {
        const task = tasks.find(t => t.id === id && !t.archived);
        if (!task) return;
        dialogKind = 'row-actions'; dialogId = id;
        const reviewAction = task.isSubmission && task.reviewStatus !== '核定' ? `<button data-admin="${task.reviewStatus === '審查中' ? 'review' : 'submit'}" data-id="${e(id)}">${icon('file')}<span>${task.reviewStatus === '審查中' ? '記錄審查結果' : '登記送審'}</span></button>` : '';
        showDialog(task.title, `<p class="admin-sheet-caption">${pretty(task.date)} · ${e(task.recipient)}</p><div class="admin-sheet-status" role="group" aria-label="更新工作狀態">${allowedStatuses(task).map(status => `<button data-admin="set-status" data-id="${e(id)}" data-status="${e(status)}" class="${status === task.status ? 'is-selected' : ''}" ${busy ? 'disabled' : ''}>${e(status)}${status === task.status ? icon('check') : ''}</button>`).join('')}</div><div class="admin-sheet-list">${reviewAction}<button data-admin="detail" data-id="${e(id)}">${icon('file')}<span>查看完整內容</span></button><button data-admin="edit" data-id="${e(id)}">${icon('edit')}<span>編輯工作</span></button></div>`);
    }
    function showDialog(title, body, footer = '') {
        if (overlay.classList.contains('hidden')) {
            returnFocus = document.activeElement;
            returnSelector = returnFocus?.dataset.id ? `[data-admin="detail"][data-id="${CSS.escape(returnFocus.dataset.id)}"]` : '';
        }
        dialogEpoch = epoch;
        dialog.classList.toggle('admin-menu-sheet', dialogKind.startsWith('mobile-') || dialogKind === 'row-actions');
        dialog.innerHTML = `<div class="modal-head"><h2 id="adminDialogTitle">${e(title)}</h2><button class="icon-btn" type="button" data-admin="close" aria-label="關閉">×</button></div>${body}${footer}<div class="admin-dialog-error" role="alert"></div>`;
        overlay.classList.remove('hidden');
        fitDialog();
        document.body.classList.add('admin-modal-open');
        (dialog.querySelector('[name="title"]') || dialog.querySelector('input:not([type="hidden"]), textarea, select') || dialog.querySelector('button'))?.focus();
    }
    function closeDialog() {
        if (overlay.classList.contains('hidden')) return;
        if (busy && dialogEpoch === epoch) return;
        overlay.classList.add('hidden');
        document.body.classList.remove('admin-modal-open');
        dialogKind = ''; dialogId = '';
        if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
        else if (isActive()) ((returnSelector ? app.querySelector(returnSelector) : null) || app.querySelector(window.matchMedia('(max-width:768px)').matches ? '.admin-mobile-context button' : '.admin-tabs button.active'))?.focus({preventScroll:true});
    }
    function openNew({date = tab === 'calendar' ? selectedDate : todayISO(), recurring = false, submission = false, title = '', note = '', project: targetProject = '', recipient = quickDraft.recipient} = {}) {
        if (!getUser()) return;
        ensureStarted();
        const project = chosenProject();
        if (project?.archived || !getProjects().some(p => !p.archived) || !tasksReady || !templatesReady || error) { toast('請先等待行政資料載入，並確認至少有一個使用中的案場。'); return; }
        dialogKind = 'new'; dialogId = '';
        taskForm(null, {date,recurring,submission,title,note,recipient,projectId:targetProject || (projectId !== 'all' ? projectId : quickDraft.projectId)});
    }
    function taskForm(task, defaults = {}) {
        dialogKind = task ? 'edit' : 'new'; dialogId = task?.id || '';
        const compact = window.matchMedia('(max-width:768px)').matches;
        const extras = `${task ? '' : `<label>工作類型<select name="kind"><option value="normal">一般行政</option><option value="submission" ${defaults.submission ? 'selected' : ''}>送審文件・保留版次</option></select></label>`}<label>準備內容／備註 <span class="muted">選填</span><textarea name="note" rows="3" maxlength="4000" placeholder="要準備哪些資料、交付方式、聯絡事項…">${e(task?.note || defaults.note || '')}</textarea></label>${compact && !task ? '<label class="admin-again-option"><input type="checkbox" name="again" value="true">儲存後繼續新增</label>' : ''}`;
        showDialog(task ? '編輯行政事項' : '新增行政事項', `<form id="adminForm">
            ${task?.recurringId ? '<div class="admin-info">只調整這一次工作。要調整之後的週期，請至「固定排程」。</div>' : ''}
            <label>事項名稱<input name="title" maxlength="160" required value="${e(task?.title || defaults.title || '')}" placeholder="例如：人員名冊更新"></label>
            <label>案場<select name="projectId" required>${projectOptions(task?.projectId || defaults.projectId)}</select></label>
            <div class="form-grid"><label>截止日期<input name="date" type="date" required value="${e(task?.date || defaults.date || todayISO())}" min="2000-01-01" max="2100-12-31"></label><label>提交對象<select name="recipient">${options(RECIPIENTS,task?.recipient || defaults.recipient || '監造')}</select></label></div>
            <div class="admin-date-presets"><button type="button" data-admin="form-date" data-days="0">今天</button><button type="button" data-admin="form-date" data-days="1">明天</button><button type="button" data-admin="form-date" data-days="7">一週後</button></div>
            ${task ? '' : `<fieldset class="admin-schedule-choice"><legend>多久做一次</legend>${[['once','單次'],['weekly','每週固定'],['monthly','每月固定']].map(([key,label]) => `<label><input type="radio" name="schedule" value="${key}" ${key === (defaults.recurring === true ? 'monthly' : defaults.recurring || 'once') ? 'checked' : ''}><span>${label}</span></label>`).join('')}</fieldset><div id="adminSchedulePreview" class="admin-schedule-preview"></div>`}
            ${compact ? `<details class="admin-form-extra" ${defaults.submission || task?.note || defaults.note ? 'open' : ''}><summary>備註${task ? '' : '與送審設定'}</summary>${extras}</details>` : extras}
            <div class="modal-actions"><button class="btn" type="button" data-admin="close">取消</button>${task || compact ? '' : '<button class="btn" type="submit" data-again="true">儲存並再新增</button>'}<button class="btn primary" type="submit">${task ? '儲存修改' : '新增工作'}</button></div></form>`);
        updateSchedulePreview();
    }
    function updateSchedulePreview() {
        const node = dialog.querySelector('#adminSchedulePreview');
        if (!node) return;
        const date = dialog.querySelector('[name="date"]').value, schedule = dialog.querySelector('[name="schedule"]:checked')?.value;
        if (!date || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())) { node.textContent = '先選日期，再安排週期。'; return; }
        node.classList.toggle('is-once',schedule === 'once');
        if (schedule === 'once') { node.textContent = `${pretty(date)}・只安排這一次`; return; }
        const dates = schedule === 'weekly' ? [date,shiftDate(date,7),shiftDate(date,14)] : [date,...[1,2].map(n => occurrenceDate(shiftMonth(date.slice(0,7),n),Number(date.slice(8))))];
        const label = schedule === 'weekly' ? `每週${WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]}` : `每月 ${Number(date.slice(8))} 日`;
        node.innerHTML = `<strong>${label}</strong><span>接下來：${dates.map(d => pretty(d).slice(5)).join(' → ')}</span>`;
    }
    function detail(id) {
        const task = tasks.find(t => t.id === id && (projectId === 'all' || t.projectId === projectId));
        if (!task) { toast('找不到事項，請重新整理。'); return; }
        dialogKind = 'detail'; dialogId = id;
        const controls = task.archived ? `<button class="btn" data-admin="restore" data-id="${e(id)}">恢復事項</button>` : `<button class="btn" data-admin="edit" data-id="${e(id)}">編輯</button><button class="btn" data-admin="copy" data-id="${e(id)}">再新增類似工作</button><button class="btn" data-admin="archive" data-id="${e(id)}">封存</button>`;
        const rounds = (task.submissions || []).map(s => `<li><strong>V${s.version} · ${e(s.status)}</strong><p>送至 ${e(s.recipient)} · ${e(timestamp(s.submittedAt))}</p><p>${e(s.note || '無送審備註')}</p>${s.reviewedAt ? `<p>${e(timestamp(s.reviewedAt))} · ${e(s.reviewNote || '無審查備註')}</p>` : ''}</li>`).join('');
        showDialog(task.title, `<div class="admin-detail-summary">${badge(task)}<span class="admin-badge">${task.recurringId ? task.recurrenceFrequency === 'weekly' ? '每週固定' : '每月固定' : '單次事項'}</span>${task.archived ? '<span class="admin-badge">已封存</span>' : ''}</div>
            <dl class="admin-detail-fields"><div><dt>案場</dt><dd>${e(projectName(task.projectId))}</dd></div><div><dt>截止日期</dt><dd>${pretty(task.date)}</dd></div><div><dt>提交對象</dt><dd>${e(task.recipient)}</dd></div><div><dt>工作狀態</dt><dd>${e(task.status)}</dd></div>${task.isSubmission ? `<div><dt>送審結果</dt><dd>${e(task.reviewStatus)}</dd></div>` : ''}</dl>
            <div class="admin-status-track">${STATUSES.map(s => `<span class="${s === task.status ? 'active' : ''}">${s}</span>`).join('<span aria-hidden="true">›</span>')}</div>
            <h3>準備內容／備註</h3><p class="admin-note">${e(task.note || '尚未填寫')}</p>
            ${!task.archived ? `<form id="adminStatusForm"><label>更新工作狀態<select name="status">${options(STATUSES,task.status)}</select></label><button class="btn primary" type="submit">更新狀態</button></form>` : ''}
            ${task.isSubmission ? `<div class="admin-submission-panel"><div class="admin-section-head"><h3>送審版次</h3>${!task.archived ? (task.reviewStatus === '審查中' ? `<button class="btn primary" data-admin="review" data-id="${e(id)}">記錄審查結果</button>` : task.reviewStatus !== '核定' ? `<button class="btn primary" data-admin="submit" data-id="${e(id)}">${task.reviewStatus === '退件' ? '登記下一版送審' : '登記送審'}</button>` : '') : ''}</div>${rounds ? `<ol class="admin-rounds">${rounds}</ol>` : '<p class="muted">尚未送出。按「登記送審」建立 V1；此操作只記錄送出狀態。</p>'}</div>` : ''}
            <details class="admin-task-history"><summary>事項歷程（${(task.history || []).length} 筆）</summary><ol class="admin-rounds">${[...(task.history || [])].reverse().map(h => `<li><strong>${e(h.action)}</strong><small> ${e(timestamp(h.at))}</small><p>${e(h.detail)}</p></li>`).join('')}</ol></details>
            <div class="modal-actions">${controls}<button class="btn" data-admin="close">關閉</button></div>`);
    }
    function reviewForm(id, submit = false) {
        const task = tasks.find(t => t.id === id && !t.archived);
        if (!task) return;
        dialogKind = submit ? 'submit' : 'review'; dialogId = id;
        const version = submit ? Math.max(0,...(task.submissions || []).map(s => s.version)) + 1 : task.submissions?.at(-1)?.version;
        showDialog(submit ? `登記 V${version} 送審` : `V${version} 審查結果`, `<form id="adminForm"><div class="admin-info">${e(task.title)} · 提交給 ${e(task.recipient)}<br>登記紀錄後，可在行政歷程查詢。</div>
            ${submit ? '' : '<label>審查結果<select name="result"><option>退件</option><option>核定</option></select></label>'}
            <label>${submit ? '送審備註' : '審查意見／修正內容'}<textarea name="note" rows="4" maxlength="4000" placeholder="${submit ? '例如：已送出修正版、送件方式' : '例如：需補充施工流程說明'}"></textarea></label>
            <div class="form-hint">${submit ? '儲存後會標示「已送出／審查中」。' : '退件會回到「待準備」；核定會標示「已完成」。'}</div>
            <div class="modal-actions"><button class="btn" type="button" data-admin="detail" data-id="${e(id)}">返回事項</button><button class="btn primary" type="submit">儲存紀錄</button></div></form>`);
    }
    function templateForm(id) {
        const template = templates.find(t => t.id === id);
        if (!template) return;
        dialogKind = 'template'; dialogId = id;
        showDialog('編輯固定排程', `<form id="adminForm"><div class="admin-info">${e(recurrenceLabel(template))} · 只調整尚未建立的工作，完成紀錄保留。</div>
            <label>事項名稱<input name="title" required maxlength="160" value="${e(template.title)}"></label>
            <label>案場<select name="projectId" required>${projectOptions(template.projectId)}</select></label>
            <div class="form-grid">${frequencyOf(template) === 'weekly' ? `<label>每週星期<select name="weekday">${[1,2,3,4,5,6,0].map(day => `<option value="${day}" ${template.weekday === day ? 'selected' : ''}>星期${WEEKDAYS[day]}</option>`).join('')}</select></label>` : `<label>每月日期<input name="day" type="number" min="1" max="31" required value="${template.day}"></label>`}<label>提交對象<select name="recipient">${options(RECIPIENTS,template.recipient)}</select></label></div>
            <label>準備內容／備註<textarea name="note" rows="4" maxlength="4000">${e(template.note)}</textarea></label>
            <div class="modal-actions"><button class="btn" type="button" data-admin="close">取消</button><button class="btn primary" type="submit">儲存設定</button></div></form>`);
    }
    async function perform(work, next) {
        if (busy || !store || uid !== getUser()?.uid) return;
        const token = epoch, currentStore = store;
        busy = true;
        dialog.querySelectorAll('button, input, textarea, select').forEach(n => n.disabled = true);
        try {
            await work(currentStore);
            if (token !== epoch) return;
            busy = false;
            next?.();
            if (!notice) toast('行政資料已儲存');
        } catch (err) {
            if (token !== epoch) return;
            busy = false;
            const message = friendlyError(err,'儲存未完成');
            if (!overlay.classList.contains('hidden')) dialog.querySelector('.admin-dialog-error').textContent = message;
            else toast(message);
        } finally {
            if (token === epoch) {
                busy = false;
                dialog.querySelectorAll('button, input, textarea, select').forEach(n => n.disabled = false);
                if (isActive()) render();
            }
        }
    }
    async function updateStatus(id, status) {
        const task = tasks.find(t => t.id === id && !t.archived);
        if (!task || task.status === status) return;
        const previous = task.status;
        await perform(s => s.mutate(id,'status',{status}), () => {
            notice = {text:`${task.title} · ${status}`,undo:{id,previous,expected:status}};
        });
    }
    async function click(event) {
        const button = event.target.closest('[data-admin]');
        if (!button || (!app.contains(button) && !overlay.contains(button)) || !isActive() || busy) return;
        const action = button.dataset.admin, id = button.dataset.id;
        if (action === 'close') closeDialog();
        else if (['mobile-projects','mobile-views','mobile-nav','mobile-filters'].includes(action)) mobileMenu(action);
        else if (action === 'mobile-search' || action === 'mobile-search-clear') { const search = document.querySelector('#searchInput'); mobileSearchOpen = action !== 'mobile-search-clear' && !mobileSearchOpen && !getSearch().trim(); if (!mobileSearchOpen && search) search.value = ''; render(); if (mobileSearchOpen) document.querySelector('#adminMobileSearch')?.focus(); }
        else if (action === 'row-actions') rowActions(id);
        else if (action === 'set-status') { await updateStatus(id,button.dataset.status); if (!dialog.querySelector('.admin-dialog-error')?.textContent) closeDialog(); }
        else if (action === 'navigate') { closeDialog(); [...document.querySelectorAll('#nav [data-page]')].find(n => n.dataset.page === button.dataset.page)?.click(); }
        else if (action === 'quick-note' || action === 'logout') { closeDialog(); document.querySelector(action === 'quick-note' ? '#mobileQuickNoteBtn' : '#logoutBtn')?.click(); }
        else if (action === 'tab') { closeDialog(); tab = button.dataset.tab; statusFilter = ''; recipientFilter = ''; filter = 'all'; render(); }
        else if (action === 'project') { closeDialog(); setProject(button.dataset.project); }
        else if (action === 'range') { range = button.dataset.range; filter = 'all'; render(); }
        else if (action === 'filter') { filter = button.dataset.filter; if (filter === 'all') range = 'near'; render(); }
        else if (action === 'week-day') { selectedDate = button.dataset.date; filter = 'date'; render(); }
        else if (action === 'month') { month = shiftMonth(month,Number(button.dataset.step)); selectedDate = `${month}-01`; render(); }
        else if (action === 'date') { selectedDate = button.dataset.date; render(); }
        else if (action === 'today') { selectedDate = todayISO(); month = selectedDate.slice(0,7); render(); }
        else if (action === 'clear-filters') { statusFilter = ''; recipientFilter = ''; const search = document.querySelector('#searchInput'); if (search) search.value = ''; closeDialog(); render(); }
        else if (action === 'new' || action === 'new-review' || action === 'new-recurring') openNew({date:button.dataset.date || todayISO(), submission:action === 'new-review', recurring:action === 'new-recurring' ? 'weekly' : false});
        else if (action === 'quick-more') openNew({title:quickDraft.title,date:quickDraft.date,project:quickDraft.projectId});
        else if (action === 'preset') openNew({title:button.dataset.title,recurring:['weekly','monthly'].includes(button.dataset.kind) ? button.dataset.kind : false,submission:button.dataset.kind === 'submission'});
        else if (action === 'complete' || action === 'reopen') await updateStatus(id,action === 'complete' ? '已完成' : '待準備');
        else if (action === 'undo') {
            const undo = notice?.undo, task = tasks.find(t => t.id === undo?.id);
            if (!undo || !task || task.archived || task.status !== undo.expected) { notice = null; toast('這件工作的進度已變更，請查看最新狀態。'); render(); }
            else await perform(s => s.mutate(undo.id,'status',{status:undo.previous}),() => { notice = {text:'已撤銷剛才的進度變更'}; });
        }
        else if (action === 'dismiss-notice') { notice = null; render(); }
        else if (action === 'form-date') { dialog.querySelector('[name="date"]').value = shiftDate(todayISO(),Number(button.dataset.days)); updateSchedulePreview(); }
        else if (action === 'new-project') openProject();
        else if (action === 'detail') detail(id);
        else if (action === 'edit') taskForm(tasks.find(t => t.id === id));
        else if (action === 'copy') { const task = tasks.find(t => t.id === id); if (task) openNew({title:task.title,note:task.note,project:task.projectId,recipient:task.recipient,submission:task.isSubmission}); }
        else if (action === 'submit' || action === 'review') reviewForm(id,action === 'submit');
        else if (action === 'archive' || action === 'restore') await perform(s => s.mutate(id,action), closeDialog);
        else if (action === 'edit-template') templateForm(id);
        else if (action === 'toggle-template') { const t = templates.find(t => t.id === id); if (t) await perform(s => s.editTemplate(id,{active:!t.active})); }
        else if (action === 'retry') { reset(); render(); }
        else if (action === 'generate') scheduleGeneration();
    }
    app.addEventListener('click',click);
    overlay.addEventListener('click',event => { if (event.target === overlay) closeDialog(); else click(event); });
    app.addEventListener('input',event => {
        if (event.target.id === 'adminMobileSearch') { const search = document.querySelector('#searchInput'); if (search) search.value = event.target.value; if (!event.isComposing) render(); }
        if (event.target.id === 'adminQuickTitle') quickDraft.title = event.target.value;
        if (event.target.id === 'adminQuickDate') quickDraft.date = event.target.value;
        if (event.target.id === 'adminQuickProject') quickDraft.projectId = event.target.value;
        if (event.target.id === 'adminQuickRecipient') quickDraft.recipient = event.target.value;
    });
    app.addEventListener('compositionend',event => { if (event.target.id === 'adminMobileSearch') render(); });
    app.addEventListener('change',async event => {
        if (event.target.id === 'adminMobileRange') { const value = event.target.value; if (['today','week','overdue','waiting','date'].includes(value)) filter = value; else { range = value; filter = 'all'; } render(); return; }
        if (event.target.dataset.taskStatus) { await updateStatus(event.target.dataset.taskStatus,event.target.value); return; }
        if (event.target.id === 'adminProject') { setProject(event.target.value); return; }
        else if (event.target.id === 'adminStatusFilter') statusFilter = event.target.value;
        else if (event.target.id === 'adminRecipientFilter') recipientFilter = event.target.value;
        else return;
        render();
    });
    app.addEventListener('submit',async event => {
        if (event.target.id !== 'adminQuickForm') return;
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.target));
        if (!getProjects().some(p => p.id === data.projectId && !p.archived)) { toast('請選擇使用中的案場。'); return; }
        await perform(s => s.create({projectId:data.projectId,title:data.title.trim(),date:data.date,recipient:data.recipient,note:'',status:'待準備',isSubmission:false},false),() => {
            quickDraft = {title:'',date:todayISO(),projectId:data.projectId,recipient:data.recipient};
            if (data.date > shiftDate(todayISO(),7)) {
                range = data.date.startsWith(todayISO().slice(0,7)) ? 'month' : data.date.startsWith(shiftMonth(todayISO().slice(0,7),1)) ? 'next' : 'all';
                filter = 'all';
            } else { range = 'near'; filter = 'all'; }
            notice = {text:`已新增「${data.title.trim()}」 · ${pretty(data.date)}`};
            render(); document.querySelector('#adminQuickTitle')?.focus();
        });
    });
    overlay.addEventListener('change',event => { if (['schedule','date'].includes(event.target.name)) updateSchedulePreview(); });
    overlay.addEventListener('submit',async event => {
        event.preventDefault();
        if (dialogEpoch !== epoch || busy) return;
        const data = Object.fromEntries(new FormData(event.target));
        if (event.target.id === 'adminMobileFilterForm') { statusFilter = data.status; recipientFilter = data.recipient; closeDialog(); render(); return; }
        if (typeof data.title === 'string') data.title = data.title.trim();
        const id = dialogId, kind = dialogKind, again = event.submitter?.dataset.again === 'true' || data.again === 'true';
        if (['new','edit','template'].includes(kind) && event.target.id !== 'adminStatusForm' && !getProjects().some(p => p.id === data.projectId && (!p.archived || p.id === tasks.find(t => t.id === id)?.projectId || p.id === templates.find(t => t.id === id)?.projectId))) { dialog.querySelector('.admin-dialog-error').textContent = '請選擇使用中的案場。'; return; }
        await perform(async s => {
            if (event.target.id === 'adminStatusForm') await s.mutate(id,'status',data);
            else if (kind === 'new') await s.create({projectId:data.projectId, title:data.title, date:data.date, recipient:data.recipient, note:data.note, status:'待準備', isSubmission:data.kind === 'submission'},data.schedule === 'once' ? false : data.schedule);
            else if (kind === 'edit') await s.mutate(id,'edit',data);
            else if (kind === 'template') await s.editTemplate(id,data);
            else if (kind === 'submit' || kind === 'review') await s.mutate(id,kind,data);
        }, () => {
            if (kind === 'new') {
                quickDraft.projectId = data.projectId;
                quickDraft.recipient = data.recipient;
                if (quickDraft.title === data.title) quickDraft.title = '';
                notice = {text:`已新增「${data.title}」 · ${pretty(data.date)}${data.schedule !== 'once' ? ` · ${data.schedule === 'weekly' ? '每週固定' : '每月固定'}` : ''}`};
                if (tab === 'overview') {
                    filter = 'all';
                    range = data.date <= shiftDate(todayISO(),7) ? 'near' : data.date.startsWith(todayISO().slice(0,7)) ? 'month' : data.date.startsWith(shiftMonth(todayISO().slice(0,7),1)) ? 'next' : 'all';
                }
            }
            closeDialog();
            if (again) openNew({date:data.date,project:data.projectId,recipient:data.recipient});
        });
    });
    overlay.addEventListener('keydown',event => {
        if (event.key === 'Escape') { event.preventDefault(); closeDialog(); }
        if (event.key === 'Tab') {
            const focusable = [...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary')].filter(n => n.getClientRects().length);
            const first = focusable[0], last = focusable.at(-1);
            if (!first) { event.preventDefault(); dialog.focus(); }
            else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
    });
    function refreshDate() {
        if (!uid || !getUser()) return;
        const today = todayISO();
        if (lastToday !== today) {
            if (selectedDate === lastToday) { selectedDate = today; month = today.slice(0,7); }
            if (quickDraft.date === lastToday) quickDraft.date = today;
            lastToday = today; updateBadge(); if (isActive()) render(); scheduleGeneration();
        }
    }
    document.addEventListener('visibilitychange',() => { if (document.visibilityState === 'visible') { refreshDate(); if (uid) scheduleGeneration(); } });
    window.addEventListener('online',() => { if (uid) scheduleGeneration(); });
    setInterval(refreshDate,60000);
    return {render, openNew, reset, onProjectsChanged() { updateBadge(); if (isActive()) render(); if (uid) scheduleGeneration(); }};
}
