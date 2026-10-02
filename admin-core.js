// Administrative dates are date-only values in the project's Taiwan timezone.
export const STATUSES = ['待準備', '待送出', '已送出', '待回覆', '已完成'];
export const RECIPIENTS = ['監造', '機關', '公司內部', '廠商'];
export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
export function todayISO(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now);
    const value = type => parts.find(p => p.type === type).value;
    return `${value('year')}-${value('month')}-${value('day')}`;
}
export function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const d = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function shiftDate(value, days) {
    const d = new Date(`${value}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}
export function shiftMonth(month, amount) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + amount, 1));
    return d.toISOString().slice(0, 7);
}
export function occurrenceDate(month, day) {
    const [y, m] = month.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${month}-${String(Math.min(Math.max(Number(day), 1), last)).padStart(2, '0')}`;
}
export function weekRange(today) {
    const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
    const start = shiftDate(today, -((weekday + 6) % 7));
    return [start, shiftDate(start, 6)];
}
export function daysUntil(date, today = todayISO()) {
    return Math.round((new Date(`${date}T00:00:00Z`) - new Date(`${today}T00:00:00Z`)) / 86400000);
}
export function urgency(task, today = todayISO()) {
    if (task.status === '已完成') return {level: 'done', label: '已完成'};
    const days = daysUntil(task.date, today);
    if (days < 0) return {level: 'overdue', label: `逾期 ${-days} 天`};
    if (days === 0) return {level: 'soon', label: '今天到期'};
    if (days <= 3) return {level: 'soon', label: `${days} 天內`};
    if (days <= 7) return {level: 'week', label: `${days} 天內`};
    return {level: 'later', label: '之後到期'};
}
export function summary(tasks, today = todayISO()) {
    const open = tasks.filter(t => !t.archived && t.status !== '已完成');
    const [start, end] = weekRange(today);
    return {
        today: open.filter(t => t.date === today),
        week: open.filter(t => t.date >= start && t.date <= end),
        overdue: open.filter(t => t.date < today),
        waiting: open.filter(t => t.status === '待回覆' || t.reviewStatus === '審查中')
    };
}
export function frequencyOf(template) { return template.frequency === 'weekly' ? 'weekly' : 'monthly'; }
export function recurrenceLabel(template) {
    return frequencyOf(template) === 'weekly' ? `每週${WEEKDAYS[template.weekday]}` : `每月 ${template.day} 日`;
}
export function occurrenceId(templateId, key, frequency = 'monthly') {
    return frequency === 'weekly' ? `${templateId}_week_${key}` : `${templateId}_${key}`;
}
export function monthsToGenerate(template, today = todayISO()) {
    if (!template.active || !/^\d{4}-\d{2}$/.test(template.startMonth || '')) return [];
    const last = shiftMonth(today.slice(0, 7), 1);
    const months = [];
    for (let month = template.startMonth; month <= last; month = shiftMonth(month, 1)) {
        months.push(month);
    }
    return months;
}
// Weekly IDs are based on Monday, so changing the weekday never duplicates an
// already-created week. Existing monthly IDs remain compatible with version 1.
export function occurrenceKeys(template, today = todayISO()) {
    if (frequencyOf(template) === 'monthly') return monthsToGenerate(template, today);
    if (!template.active || !validDate(template.startDate) || !Number.isInteger(template.weekday) || template.weekday < 0 || template.weekday > 6) return [];
    const end = occurrenceDate(shiftMonth(today.slice(0, 7), 1), 31);
    const keys = [];
    for (let week = weekRange(template.startDate)[0]; week <= end; week = shiftDate(week, 7)) {
        const date = shiftDate(week, (template.weekday + 6) % 7);
        if (date >= template.startDate && date <= end) keys.push(week);
    }
    return keys;
}
export function taskWindow(tasks, range = 'near', today = todayISO()) {
    return tasks.filter(task => {
        if (task.archived) return false;
        if (range === 'done') return task.status === '已完成';
        if (task.status === '已完成') return false;
        if (range === 'all') return true;
        if (range === 'month') return task.date?.startsWith(today.slice(0, 7));
        if (range === 'next') return task.date?.startsWith(shiftMonth(today.slice(0, 7), 1));
        // Show overdue work even from previous months, but keep future schedules
        // out of the everyday view until they are within seven days.
        return task.date <= shiftDate(today, 7);
    });
}
export function validateTask(data) {
    if (!data.projectId) throw new Error('請先選擇案場。');
    if (!data.title?.trim()) throw new Error('請輸入事項名稱。');
    if (data.title.length > 160 || (data.note || '').length > 4000) throw new Error('名稱最多 160 字，備註最多 4000 字。');
    if (!validDate(data.date)) throw new Error('請填寫有效日期。');
    if (!STATUSES.includes(data.status)) throw new Error('工作狀態無效。');
    if (!RECIPIENTS.includes(data.recipient)) throw new Error('請選擇提交對象。');
    return data;
}
export function historyEntry(action, detail, uid, now = Date.now()) {
    return {action, detail, actor: uid, at: now};
}
export function makeOccurrence(template, key, uid, now = Date.now()) {
    const frequency = frequencyOf(template);
    const date = frequency === 'weekly' ? shiftDate(key, (template.weekday + 6) % 7) : occurrenceDate(key, template.day);
    return {
        projectId: template.projectId, title: template.title, note: template.note || '',
        recipient: template.recipient, date,
        status: '待準備', isSubmission: !!template.isSubmission,
        reviewStatus: template.isSubmission ? '準備中' : '', submissions: [],
        recurringId: template.id, recurrenceFrequency: frequency, month: date.slice(0, 7), archived: false,
        createdAt: now, updatedAt: now,
        history: [historyEntry('固定事項建立', `${date} · ${recurrenceLabel(template)}`, uid, now)]
    };
}
export function changeTask(task, action, payload, uid, now = Date.now()) {
    let patch;
    let detail;
    if (action === 'edit') {
        validateTask({...task, ...payload});
        const fields = ['title', 'date', 'note', 'recipient', ...(payload.projectId !== undefined ? ['projectId'] : [])];
        patch = Object.fromEntries(fields.map(key => [key, payload[key]]));
        detail = fields.filter(key => task[key] !== patch[key]).map(key =>
            `${({title:'名稱', date:'期限', note:'備註', recipient:'提交對象', projectId:'案場'})[key]}：${task[key] || '無'} → ${patch[key] || '無'}`).join('；');
        if (!detail) throw new Error('資料沒有變更。');
    } else if (action === 'status') {
        if (!STATUSES.includes(payload.status)) throw new Error('工作狀態無效。');
        if (task.status === payload.status) throw new Error('狀態沒有變更。');
        if (task.isSubmission && payload.status === '已完成' && task.reviewStatus !== '核定') {
            throw new Error('送審事項請先記錄「核定」，再完成工作。');
        }
        if (task.isSubmission && ['已送出', '待回覆'].includes(payload.status) && task.reviewStatus !== '審查中') {
            throw new Error('請先按「登記送審」記錄送出的版次。');
        }
        patch = {status: payload.status};
        detail = `${task.status} → ${payload.status}`;
    } else if (action === 'submit') {
        if (!task.isSubmission || task.reviewStatus === '審查中' || task.reviewStatus === '核定') throw new Error('目前不能新增送審版次。');
        const submissions = [...(task.submissions || [])];
        const version = Math.max(0, ...submissions.map(s => s.version)) + 1;
        submissions.push({version, status: '審查中', submittedAt: now, recipient: task.recipient, note: payload.note || ''});
        patch = {submissions, reviewStatus: '審查中', status: '已送出'};
        detail = `V${version} → ${task.recipient}；${payload.note || '登記已送出'}`;
    } else if (action === 'review') {
        if (!task.isSubmission || task.reviewStatus !== '審查中' || !['退件', '核定'].includes(payload.result)) throw new Error('請先登記送審，再記錄審查結果。');
        const submissions = (task.submissions || []).map(s => ({...s}));
        const round = submissions.at(-1);
        if (!round) throw new Error('找不到送審紀錄。');
        Object.assign(round, {status: payload.result, reviewedAt: now, reviewNote: payload.note || ''});
        patch = {submissions, reviewStatus: payload.result, status: payload.result === '核定' ? '已完成' : '待準備'};
        detail = `V${round.version} ${payload.result}；${payload.note || '無審查備註'}`;
    } else if (action === 'archive' || action === 'restore') {
        patch = {archived: action === 'archive'};
        detail = action === 'archive' ? '移出月曆與提醒，保留歷程' : '恢復事項';
    } else throw new Error('操作無效。');
    const label = {edit:'編輯事項', status:'狀態變更', submit:'登記送審', review:'審查結果', archive:'封存事項', restore:'恢復事項'}[action];
    return {...patch, updatedAt: now, history: [...(task.history || []), historyEntry(label, detail, uid, now)]};
}
