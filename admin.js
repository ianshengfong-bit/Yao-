import {STATUSES, RECIPIENTS, todayISO, shiftMonth, shiftDate, occurrenceDate, urgency, summary, weekRange} from './admin-core.js';

const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
const e = escapeHTML;
const pretty = date => date?.replaceAll('-', '/') || '—';
const timestamp = at => new Intl.DateTimeFormat('zh-TW', {
    timeZone:'Asia/Taipei', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', year:'numeric', hour12:false
}).format(new Date(at));
const options = (values, selected) => values.map(v => `<option value="${e(v)}" ${v === selected ? 'selected' : ''}>${e(v)}</option>`).join('');

export function createAdministration({getUser, getProjects, getSearch, isActive, getStore, toast, openProject}) {
    let uid = null, store = null, stop = null, tasks = [], templates = [];
    let tasksReady = false, templatesReady = false, error = '', generationError = '', epoch = 0;
    let projectId = '', tab = 'overview', filter = 'all', statusFilter = '', recipientFilter = '';
    let month = todayISO().slice(0, 7), selectedDate = todayISO();
    let generating = false, generationRequested = false, busy = false, lastToday = todayISO();
    let returnFocus = null, dialogKind = '', dialogId = '', dialogEpoch = 0;
    const app = document.querySelector('#app');
    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop hidden admin-modal-backdrop';
    overlay.innerHTML = '<div class="modal admin-modal" role="dialog" aria-modal="true" aria-labelledby="adminDialogTitle" tabindex="-1"></div>';
    document.body.append(overlay);
    const dialog = overlay.firstElementChild;

    function chosenProject() {
        const projects = getProjects();
        if (!projects.some(p => p.id === projectId)) projectId = projects.find(p => !p.archived && /監察/.test(p.name))?.id || '';
        return projects.find(p => p.id === projectId);
    }
    function scoped(includeArchived = false) {
        return tasks.filter(t => t.projectId === projectId && (includeArchived || !t.archived));
    }
    function searched(list) {
        const q = getSearch().trim().toLocaleLowerCase();
        return list.filter(t => (!q || [t.title, t.note, t.recipient, t.status, t.reviewStatus, pretty(t.date), t.date].join(' ').toLocaleLowerCase().includes(q)) &&
            (!statusFilter || t.status === statusFilter) && (!recipientFilter || t.recipient === recipientFilter));
    }
    function badge(task) {
        const u = urgency(task);
        return `<span class="admin-badge admin-${u.level}">${e(u.label)}</span>`;
    }
    function row(task) {
        return `<button type="button" class="admin-task-row" data-admin="detail" data-id="${e(task.id)}">
            <span class="admin-row-date">${e(pretty(task.date).slice(5))}</span>
            <span class="admin-row-content"><strong>${e(task.title)}</strong><span>${e(task.recipient)} · ${e(task.status)}${task.recurringId ? ' · 每月固定' : ''}${task.isSubmission ? ` · ${e(task.reviewStatus)}` : ''}</span></span>
            ${badge(task)}<span class="admin-chevron" aria-hidden="true">›</span></button>`;
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
        const count = tasks.filter(t => !t.archived && t.status !== '已完成' && t.date <= today && /監察/.test(getProjects().find(p => p.id === t.projectId)?.name || '')).length;
        node.textContent = String(count);
        node.classList.toggle('hidden', !count);
    }
    function reset() {
        epoch++;
        stop?.(); stop = null; uid = null; store = null;
        tasks = []; templates = []; tasksReady = false; templatesReady = false;
        error = ''; generationError = ''; generating = false; generationRequested = false;
        projectId = ''; tab = 'overview'; filter = 'all'; statusFilter = ''; recipientFilter = '';
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
    function overview(all, list) {
        const s = summary(all);
        const [start,end] = weekRange(todayISO());
        const stat = (key,label,value,hint) => `<button class="stat admin-stat ${filter === key ? 'is-active' : ''}" data-admin="filter" data-filter="${key}"><span class="stat-label">${label}</span><span class="stat-value ${key === 'overdue' && value ? 'admin-overdue' : ''}">${value}<small> 件</small></span><span class="admin-stat-hint">${hint}</span></button>`;
        const focus = filter === 'all' ? [...new Map([...s.overdue, ...s.today, ...s.week, ...s.waiting].map(t => [t.id,t])).values()] : s[filter] || [];
        const names = {all:'近期需要處理', today:'今日事項', week:'本週事項', overdue:'逾期事項', waiting:'等待回覆'};
        return `<div class="stats admin-stats">${stat('today','今日到期',s.today.length,pretty(todayISO()))}${stat('week','本週到期',s.week.length,`${pretty(start).slice(5)}–${pretty(end).slice(5)}`)}${stat('overdue','逾期待辦',s.overdue.length,'已完成事項不列入')}${stat('waiting','等待回覆',s.waiting.length,'送審中／待回覆')}</div>
            <section class="card admin-attention"><div class="admin-section-head"><h3>${names[filter]}</h3><button class="btn" data-admin="filter" data-filter="all">顯示全部提醒</button></div>${taskList(searched(focus), '目前沒有符合條件的待辦事項。')}</section>
            <div class="admin-overview-grid">${calendar(list)}<section class="card admin-day-detail"><div class="admin-section-head"><div><h3>${pretty(selectedDate).slice(5)} 當日事項</h3><p class="muted">${pretty(selectedDate)}</p></div><button class="btn" data-admin="new" data-date="${selectedDate}" ${chosenProject()?.archived ? 'disabled' : ''}>＋ 新增</button></div>${taskList(list.filter(t => t.date === selectedDate), '這天沒有事項，可以先安排工作。')}</section></div>`;
    }
    function reviews(list) {
        const submissions = list.filter(t => t.isSubmission);
        return `<section class="card"><div class="admin-section-head"><div><h3>送審追蹤</h3><p class="muted">每次送出保留版次、對象與審查結果；退件後可建立下一版。</p></div><button class="btn primary" data-admin="new-review" ${chosenProject()?.archived ? 'disabled' : ''}>＋ 送審事項</button></div>
            ${submissions.length ? `<div class="admin-review-grid">${submissions.map(t => {
                const version = t.submissions?.at(-1)?.version;
                return `<button class="admin-review-card" data-admin="detail" data-id="${e(t.id)}"><span class="admin-review-top"><span class="admin-badge">${e(t.reviewStatus)}</span><strong>${version ? `V${version}` : '尚未送出'}</strong></span><h3>${e(t.title)}</h3><p>${e(t.recipient)} · ${e(t.status)}</p><div class="admin-review-deadline">期限 ${pretty(t.date)} ${badge(t)}</div></button>`;
            }).join('')}</div>` : '<div class="admin-empty">還沒有送審事項。新增時選擇「送審文件」即可追蹤版次。</div>'}</section>`;
    }
    function recurring() {
        const list = templates.filter(t => t.projectId === projectId);
        return `<section class="card"><div class="admin-section-head"><div><h3>每月固定事項</h3><p class="muted">提前建立到下個月；遇到短月，29～31 日會排在該月最後一天。</p></div><button class="btn primary" data-admin="new-recurring" ${chosenProject()?.archived ? 'disabled' : ''}>＋ 固定事項</button></div>
            <div class="admin-info">編輯或停用設定會影響尚未產生的月份。已建立的工作保留原內容，可從「事項」個別調整或封存。網站開啟或回到前景時會補齊排程。</div>
            ${list.length ? list.map(t => `<div class="admin-recurring-row"><div><span class="admin-badge">${t.active ? '啟用中' : '已停用'}</span><h3>${e(t.title)}</h3><p class="muted">每月 ${t.day} 日 · ${e(t.recipient)} · 自 ${e(t.startMonth)} 開始${t.isSubmission ? ' · 送審文件' : ''}</p></div><div class="admin-row-actions"><button class="btn" data-admin="edit-template" data-id="${e(t.id)}">編輯</button><button class="btn" data-admin="toggle-template" data-id="${e(t.id)}">${t.active ? '停用' : '啟用'}</button></div></div>`).join('') : '<div class="admin-empty">還沒有設定每月固定事項。</div>'}</section>`;
    }
    function history() {
        const q = getSearch().trim().toLocaleLowerCase();
        const events = [
            ...scoped(true).flatMap(t => (t.history || []).map(h => ({...h, title:t.title, id:t.id, archived:t.archived}))),
            ...templates.filter(t => t.projectId === projectId).flatMap(t => (t.history || []).map(h => ({...h, title:t.title, template:true})))
        ].filter(h => !q || [h.title,h.action,h.detail].join(' ').toLocaleLowerCase().includes(q)).sort((a,b) => b.at-a.at);
        return `<section class="card"><div class="admin-section-head"><div><h3>行政歷程</h3><p class="muted">建立、編輯、狀態變更、送審、退件、核定與封存紀錄。</p></div></div>
            ${events.length ? `<ol class="admin-timeline">${events.map(h => `<li><span class="admin-history-dot"></span><div><small>${e(timestamp(h.at))}</small><p><strong>${e(h.action)}</strong> · ${e(h.title)}${h.archived ? '（已封存）' : ''}</p><div class="admin-history-detail">${e(h.detail)}</div>${h.id ? `<button class="admin-text-button" data-admin="detail" data-id="${e(h.id)}">查看事項 ›</button>` : ''}</div></li>`).join('')}</ol>` : '<div class="admin-empty">尚無行政紀錄。</div>'}</section>`;
    }
    function render() {
        if (!isActive() || !getUser()) return;
        ensureStarted();
        const project = chosenProject();
        updateBadge();
        const projectSelect = `<label class="admin-project-label">案場<select id="adminProject">${projectId ? '' : '<option value="">請選擇案場</option>'}${getProjects().map(p => `<option value="${e(p.id)}" ${p.id === projectId ? 'selected' : ''}>${e(p.name)}${p.archived ? '（已封存）' : ''}</option>`).join('')}</select></label>`;
        let content;
        if (error) content = `<section class="card admin-error" role="alert"><h3>行政資料尚未就緒</h3><p>${e(error)}</p><button class="btn" data-admin="retry">重新連線</button></section>`;
        else if (!tasksReady || !templatesReady) content = '<section class="card admin-empty" role="status">正在載入行政資料…</section>';
        else if (!project) content = `<section class="card admin-empty"><h3>先選擇監察院案場</h3><p>從上方選擇既有案場。若尚未建立監察院，可先新增案場。</p><button class="btn primary" data-admin="new-project">＋ 新增案場</button></section>`;
        else {
            const all = scoped(), list = searched(all);
            const view = tab === 'overview' ? overview(all,list) : tab === 'reviews' ? reviews(list) : tab === 'recurring' ? recurring() : tab === 'history' ? history() : `<section class="card"><div class="admin-section-head"><h3>行政事項 <span class="admin-badge">${list.length} 件</span></h3><button class="btn primary" data-admin="new" ${project.archived ? 'disabled' : ''}>＋ 新增事項</button></div>${taskList(list, '沒有符合條件的事項。')}</section>`;
            content = `<div class="admin-tabs" role="group" aria-label="行政視圖">${[['overview','總覽與月曆'],['tasks','事項'],['reviews','送審追蹤'],['recurring','每月固定'],['history','行政歷程']].map(([key,name]) => `<button class="${tab === key ? 'active' : ''}" data-admin="tab" data-tab="${key}" aria-pressed="${tab === key}">${name}</button>`).join('')}</div>
                ${project.archived ? '<div class="admin-info">此案場已封存，固定事項暫停產生。仍可查看與處理已有行政紀錄。</div>' : ''}
                ${generationError ? `<div class="admin-error" role="alert">${e(generationError)} <button class="btn" data-admin="generate">重試排程</button></div>` : ''}
                ${tab !== 'recurring' && tab !== 'history' ? `<div class="admin-filters"><label>工作狀態<select id="adminStatusFilter"><option value="">全部狀態</option>${options(STATUSES,statusFilter)}</select></label><label>提交對象<select id="adminRecipientFilter"><option value="">全部對象</option>${options(RECIPIENTS,recipientFilter)}</select></label><span class="muted">可使用上方搜尋縮小範圍</span>${statusFilter || recipientFilter || getSearch().trim() ? '<button class="btn" data-admin="clear-filters">清除篩選</button>' : ''}</div>` : ''}
                ${view}`;
        }
        app.innerHTML = `<div class="admin-page"><div class="admin-heading"><div><div class="admin-beta">行政 BETA · 監察院先行</div><h2>把每個期限，安排清楚。</h2><p class="muted">今天 ${pretty(todayISO())} · 台灣時間 · ${getSearch().trim() ? '搜尋已套用；總覽數量依案場全部事項計算。' : '先看近期工作，再追蹤每次送審。'}</p></div>${projectSelect}</div>${content}</div>`;
    }
    function showDialog(title, body, footer = '') {
        returnFocus = document.activeElement;
        dialogEpoch = epoch;
        dialog.innerHTML = `<div class="modal-head"><h2 id="adminDialogTitle">${e(title)}</h2><button class="icon-btn" type="button" data-admin="close" aria-label="關閉">×</button></div>${body}${footer}<div class="admin-dialog-error" role="alert"></div>`;
        overlay.classList.remove('hidden');
        document.body.classList.add('admin-modal-open');
        dialog.querySelector('input, textarea, select, button')?.focus();
    }
    function closeDialog() {
        if (busy && dialogEpoch === epoch) return;
        overlay.classList.add('hidden');
        document.body.classList.remove('admin-modal-open');
        dialogKind = ''; dialogId = '';
        if (returnFocus?.isConnected) returnFocus.focus();
        else if (isActive()) document.querySelector('.admin-tabs button.active')?.focus();
    }
    function openNew({date = selectedDate, recurring = false, submission = false} = {}) {
        if (!getUser()) return;
        ensureStarted();
        const project = chosenProject();
        if (!project || project.archived || !tasksReady || !templatesReady || error) { toast('請先等待行政資料載入並選擇使用中的案場。'); return; }
        dialogKind = 'new'; dialogId = '';
        taskForm(null, {date,recurring,submission});
    }
    function taskForm(task, defaults = {}) {
        dialogKind = task ? 'edit' : 'new'; dialogId = task?.id || '';
        showDialog(task ? '編輯行政事項' : '新增行政事項', `<form id="adminForm">
            <div class="admin-info">${e(chosenProject()?.name || '')}${task?.recurringId ? ' · 只編輯這個月份；固定設定請至「每月固定」。' : ''}</div>
            <label>事項名稱<input name="title" maxlength="160" required value="${e(task?.title || '')}" placeholder="例如：人員名冊更新"></label>
            <div class="form-grid"><label>截止日期<input name="date" type="date" required value="${e(task?.date || defaults.date || todayISO())}" min="2000-01-01" max="2100-12-31"></label><label>提交對象<select name="recipient">${options(RECIPIENTS,task?.recipient || '監造')}</select></label></div>
            ${task ? '' : `<div class="form-grid"><label>排程<select name="schedule"><option value="once" ${!defaults.recurring ? 'selected' : ''}>單次事項</option><option value="monthly" ${defaults.recurring ? 'selected' : ''}>每月固定</option></select></label><label>事項類別<select name="kind"><option value="normal">一般行政</option><option value="submission" ${defaults.submission ? 'selected' : ''}>送審文件（追蹤版次）</option></select></label></div><div class="form-hint">每月固定以截止日期的日數排程，提前建立到下個月；短月使用月底。</div>`}
            <label>準備內容／備註<textarea name="note" rows="4" maxlength="4000" placeholder="要準備哪些資料、交付方式、聯絡事項…">${e(task?.note || '')}</textarea></label>
            <div class="modal-actions"><button class="btn" type="button" data-admin="close">取消</button><button class="btn primary" type="submit">儲存事項</button></div></form>`);
    }
    function detail(id) {
        const task = tasks.find(t => t.id === id && t.projectId === projectId);
        if (!task) { toast('找不到事項，請重新整理。'); return; }
        dialogKind = 'detail'; dialogId = id;
        const controls = task.archived ? `<button class="btn" data-admin="restore" data-id="${e(id)}">恢復事項</button>` : `<button class="btn" data-admin="edit" data-id="${e(id)}">編輯</button><button class="btn" data-admin="archive" data-id="${e(id)}">封存</button>`;
        const rounds = (task.submissions || []).map(s => `<li><strong>V${s.version} · ${e(s.status)}</strong><p>送至 ${e(s.recipient)} · ${e(timestamp(s.submittedAt))}</p><p>${e(s.note || '無送審備註')}</p>${s.reviewedAt ? `<p>${e(timestamp(s.reviewedAt))} · ${e(s.reviewNote || '無審查備註')}</p>` : ''}</li>`).join('');
        showDialog(task.title, `<div class="admin-detail-summary">${badge(task)}<span class="admin-badge">${task.recurringId ? '每月固定' : '單次事項'}</span>${task.archived ? '<span class="admin-badge">已封存</span>' : ''}</div>
            <dl class="admin-detail-fields"><div><dt>截止日期</dt><dd>${pretty(task.date)}</dd></div><div><dt>提交對象</dt><dd>${e(task.recipient)}</dd></div><div><dt>工作狀態</dt><dd>${e(task.status)}</dd></div>${task.isSubmission ? `<div><dt>送審結果</dt><dd>${e(task.reviewStatus)}</dd></div>` : ''}</dl>
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
        showDialog('編輯每月固定設定', `<form id="adminForm"><div class="admin-info">只影響尚未產生的月份。已建立的事項與完成紀錄保留。</div>
            <label>事項名稱<input name="title" required maxlength="160" value="${e(template.title)}"></label>
            <div class="form-grid"><label>每月日期<input name="day" type="number" min="1" max="31" required value="${template.day}"></label><label>提交對象<select name="recipient">${options(RECIPIENTS,template.recipient)}</select></label></div>
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
            toast('行政資料已儲存');
            next?.();
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
            }
        }
    }
    async function click(event) {
        const button = event.target.closest('[data-admin]');
        if (!button || (!app.contains(button) && !overlay.contains(button)) || !isActive() || busy) return;
        const action = button.dataset.admin, id = button.dataset.id;
        if (action === 'close') closeDialog();
        else if (action === 'tab') { tab = button.dataset.tab; render(); }
        else if (action === 'filter') { filter = button.dataset.filter; render(); }
        else if (action === 'month') { month = shiftMonth(month,Number(button.dataset.step)); selectedDate = `${month}-01`; render(); }
        else if (action === 'date') { selectedDate = button.dataset.date; render(); }
        else if (action === 'today') { selectedDate = todayISO(); month = selectedDate.slice(0,7); render(); }
        else if (action === 'clear-filters') { statusFilter = ''; recipientFilter = ''; const search = document.querySelector('#searchInput'); if (search) search.value = ''; render(); }
        else if (action === 'new' || action === 'new-review' || action === 'new-recurring') openNew({date:button.dataset.date || todayISO(), submission:action === 'new-review', recurring:action === 'new-recurring'});
        else if (action === 'new-project') openProject();
        else if (action === 'detail') detail(id);
        else if (action === 'edit') taskForm(tasks.find(t => t.id === id));
        else if (action === 'submit' || action === 'review') reviewForm(id,action === 'submit');
        else if (action === 'archive' || action === 'restore') await perform(s => s.mutate(id,action), closeDialog);
        else if (action === 'edit-template') templateForm(id);
        else if (action === 'toggle-template') { const t = templates.find(t => t.id === id); if (t) await perform(s => s.editTemplate(id,{active:!t.active})); }
        else if (action === 'retry') { reset(); render(); }
        else if (action === 'generate') scheduleGeneration();
    }
    app.addEventListener('click',click);
    overlay.addEventListener('click',event => { if (event.target === overlay) closeDialog(); else click(event); });
    app.addEventListener('change',event => {
        if (event.target.id === 'adminProject') { projectId = event.target.value; filter = 'all'; statusFilter = ''; recipientFilter = ''; }
        else if (event.target.id === 'adminStatusFilter') statusFilter = event.target.value;
        else if (event.target.id === 'adminRecipientFilter') recipientFilter = event.target.value;
        else return;
        render();
    });
    overlay.addEventListener('submit',async event => {
        event.preventDefault();
        if (dialogEpoch !== epoch || busy) return;
        const data = Object.fromEntries(new FormData(event.target));
        if (typeof data.title === 'string') data.title = data.title.trim();
        const id = dialogId, kind = dialogKind;
        await perform(async s => {
            if (event.target.id === 'adminStatusForm') await s.mutate(id,'status',data);
            else if (kind === 'new') await s.create({projectId, title:data.title, date:data.date, recipient:data.recipient, note:data.note, status:'待準備', isSubmission:data.kind === 'submission'},data.schedule === 'monthly');
            else if (kind === 'edit') await s.mutate(id,'edit',data);
            else if (kind === 'template') await s.editTemplate(id,data);
            else if (kind === 'submit' || kind === 'review') await s.mutate(id,kind,data);
        }, closeDialog);
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
            lastToday = today; updateBadge(); if (isActive()) render(); scheduleGeneration();
        }
    }
    document.addEventListener('visibilitychange',() => { if (document.visibilityState === 'visible') { refreshDate(); if (uid) scheduleGeneration(); } });
    window.addEventListener('online',() => { if (uid) scheduleGeneration(); });
    setInterval(refreshDate,60000);
    return {render, openNew, reset, onProjectsChanged() { updateBadge(); if (isActive()) render(); if (uid) scheduleGeneration(); }};
}
