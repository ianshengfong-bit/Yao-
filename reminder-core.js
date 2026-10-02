// Shared by the website and the private reminder worker. Dates use Taiwan time.
export function validReminderTime(value) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '');
}
export function reminderMoments(item, source = 'items') {
    if (!item || item.done || item.archived || item.status === '已完成' || item.reviewStatus === '核定') return [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date || '')) return [];
    const date = new Date(item.date + 'T00:00:00Z');
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== item.date) return [];
    const explicitTime = validReminderTime(item.time);
    if (item.time && !explicitTime) return [];
    // Legacy administrative work without a time keeps the morning overview only.
    if (source === 'adminTasks' && !explicitTime) return [];
    const time = explicitTime ? item.time : '09:00';
    const at = Date.parse(item.date + 'T' + time + ':00+08:00');
    const days = Number(item.reminder);
    const stages = [];
    if (Number.isInteger(days) && days > 0 && days <= 14) stages.push({stage:'before-days', label:`提前 ${days} 天`, at:at-days*86400000});
    if (item.reminderOneHour === true) stages.push({stage:'before-hour', label:'提前 1 小時', at:at-3600000});
    if (item.reminderAtTime === true || (item.reminderAtTime === undefined && explicitTime)) stages.push({stage:'at-time', label:'到時間提醒', at});
    return stages.map(row => ({...row, minute: new Date(row.at+28800000).toISOString().slice(0,16), date:item.date, time}));
}
export function telegramSchedule(item, source = 'items') {
    return [...new Set(reminderMoments(item, source).map(row => row.minute))].sort();
}
