// Capture is deliberately confined to field work. Administrative tasks use admin-store.js.
import { readDate, readTime, iso } from './capture-date.js';

export function matchProjects(text, projects) {
    const codeMatch = code => code && new RegExp('(^|[^A-Za-z0-9])' + String(code).replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '(?![A-Za-z0-9])','i').test(text);
    return projects.filter(p => !p.archived && (
        p.name && text.includes(p.name) || codeMatch(p.code) ||
        String(p.name || '').split(/[及與和、/\s-]+/).some(alias => alias.length >= 2 && text.includes(alias))
    )).filter(p=>{
        if(codeMatch(p.code))return true;
        const names=[p.name,...String(p.name||'').split(/[及與和、/\s-]+/)].filter(n=>n&&n.length>=2);
        return names.some(name=>{
            const at=text.indexOf(name);if(at<0)return false;
            const before=text.slice(Math.max(0,at-1),at),after=text.slice(at+name.length);
            return !/[從由自]/.test(before)&&!/^(?:運來|送來|來的|出發|帶來|購入|買來|供應商|廠商)/.test(after);
        });
    });
}

export function parseCapture(text, projects = [], now = new Date(), plain = false) {
    if (plain) return {projectId:'',date:'',time:'',kind:'note',type:'紀錄',reminderRequest:'',issues:[]};
    const day = readDate(text, now), clock = readTime(text), matches = matchProjects(text, projects), issues = [];
    if (day.issue) issues.push({field:'date',text:day.issue});
    if (clock.issue) issues.push({field:'time',text:clock.issue});
    if (matches.length > 1) issues.push({field:'projectId',text:'案場需確認'});
    if (!matches.length && /(?:[\u3400-\u9fff]{2,8}|[A-Za-z]{1,8})案場/.test(text)) issues.push({field:'projectId',text:'案場未對上'});
    const reminderRequest = /提醒|通知我|叫我|提前/.test(text) ? (/提前\s*(?:一|1)\s*天|前一天/.test(text) ? '提前 1 天' : /提前\s*(?:一|1)\s*(?:小時|時)/.test(text) ? '提前 1 小時' : /提前\s*(?:三|3)\s*天/.test(text) ? '提前 3 天' : /到時|準時/.test(text) ? '到時提醒' : '提醒時間待確認') : '';
    const type = /出貨/.test(text) ? '出貨' : /查驗|檢查|驗收|測試/.test(text) ? '查驗' : /到貨|材料.*進場|設備.*進場|泵浦.*進場|送貨|進料/.test(text) ? '進料' : /工班|派工|師傅|人員/.test(text) ? '人員' : '工作';
    const action = /回報|聯絡|確認|追蹤|安排|核對|檢查|測試|進場|送貨|開會|會議|要|請|待辦|記得/.test(text);
    const fact = /已完成|已經|已到|到了|已測試|已確認|完成了|測試完|確認完|進場了|到貨了|驗收完|已回報/.test(text);
    const uncertain = /可能|也許|或許|如果|不一定|看情況/.test(text);
    const historical = day.date && day.date < iso(now) && !/還沒|尚未|未完成|要追|待辦|請|追蹤|要回報/.test(text);
    const kind = !uncertain && !fact && !historical && (action || reminderRequest || day.date && clock.time) ? 'task' : 'note';
    return {projectId:matches.length === 1 ? String(matches[0].id) : '',date:day.date,time:clock.time,kind,type:kind === 'note' ? '紀錄' : type,reminderRequest,issues};
}

export function capturePlan(text, projects, {plain = false, changes = {}, now = new Date()} = {}) {
    const raw = String(text || '').trim();
    if (!raw || raw.length > 2000) throw new Error('請輸入 1–2000 字的紀錄。');
    const parsed = parseCapture(raw, projects, now, plain);
    const allowed = ['projectId','date','time','kind','type'];
    for (const field of allowed) if (Object.hasOwn(changes, field)) {
        parsed[field] = String(changes[field] || '');
        parsed.issues = parsed.issues.filter(i => i.field !== field);
    }
    if (!['note','task'].includes(parsed.kind)) throw new Error('請選擇保存方式。');
    if (parsed.projectId && !projects.some(p => !p.archived && String(p.id) === parsed.projectId)) throw new Error('這個案場已不存在或已封存，請重新選擇。');
    if (parsed.date && (readDate(parsed.date, now).date !== parsed.date)) throw new Error('日期無效，請重新確認。');
    if (parsed.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(parsed.time)) throw new Error('時間無效，請重新確認。');
    if (!['工作','進料','出貨','人員','查驗','紀錄'].includes(parsed.type)) throw new Error('類型無效。');
    // Existing formal work requires a date. Undated tasks remain usable notes until
    // the user explicitly converts them; never invent today's date or 09:00.
    const toItems = parsed.kind === 'task' && parsed.projectId && parsed.date && !parsed.issues.length;
    const common = {createdAt:now.getTime(),captureSource:'quick',originalText:raw,reminderRequest:parsed.reminderRequest};
    return toItems ? {collection:'items',parsed,data:{...common,projectId:parsed.projectId,type:parsed.type,date:parsed.date,time:parsed.time,title:raw,note:'',done:false,reminder:'none',reminderOneHour:false,reminderAtTime:false,tgMinutes:[],tgScheduleVersion:1}}
        : {collection:'inboxNotes',parsed,data:{...common,text:raw,projectId:parsed.projectId,date:parsed.date,time:parsed.time,type:parsed.type,captureKind:parsed.kind,captureIssues:parsed.issues,done:false}};
}
