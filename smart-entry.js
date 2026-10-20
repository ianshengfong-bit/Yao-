// Natural-language entry; confirmation uses the existing authenticated work form.
  function fromDate(date) {
    return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  }
  function validDay(year, month, day) {
    const v = new Date(year,month-1,day,12);
    return v.getFullYear() === year && v.getMonth() === month-1 && v.getDate() === day ? v : null;
  }
  function nextNumberDate(day, today) {
    for (let delta = 0; delta < 14; delta++) {
      const first = new Date(today.getFullYear(),today.getMonth()+delta,1,12);
      const test = validDay(first.getFullYear(),first.getMonth()+1,day);
      if (test && fromDate(test) >= fromDate(today)) return test;
    }
    return null;
  }
  function parseDate(text, today = new Date()) {
    const src = text.replace(/號/g,'日');
    let m, d;
    if ((m = src.match(/(20\d{2})[年\-/](\d{1,2})[月\-/](\d{1,2})日?/))) {
      return validDay(+m[1],+m[2],+m[3]);
    }
    if ((m = src.match(/(?:下個月|下月)\s*(\d{1,2})日/))) {
      const first = new Date(today.getFullYear(),today.getMonth()+1,1,12);
      return validDay(first.getFullYear(), first.getMonth()+1, +m[1]);
    }
    if ((m = src.match(/(\d{1,2})[月\/\-](\d{1,2})日?/))) {
      for (let y=today.getFullYear();y<=today.getFullYear()+1;y++) {
        d=validDay(y,+m[1],+m[2]);
        if (d && fromDate(d)>=fromDate(today)) return d;
      }
      return validDay(today.getFullYear(),+m[1],+m[2]);
    }
    if (/大後天/.test(src)) { d = new Date(today); d.setDate(d.getDate()+3); return d; }
    if (/後天/.test(src)) { d = new Date(today); d.setDate(d.getDate()+2); return d; }
    if (/明天/.test(src)) { d = new Date(today); d.setDate(d.getDate()+1); return d; }
    if (/今天|今日/.test(src)) return today;
    if (/月底/.test(src)) return new Date(today.getFullYear(),today.getMonth()+1,0,12);
    const days = {一:1,二:2,三:3,四:4,五:5,六:6,日:0,天:0};
    if ((m = src.match(/(下週|下星期|下禮拜|本週|這週|星期|禮拜|週)([一二三四五六日天])/))) {
      const target=days[m[2]];
      const now= today.getDay();
      const thisMondayOffset=(now+6)%7;
      if (/^下/.test(m[1])) {
        d = new Date(today); d.setDate(d.getDate()-thisMondayOffset+7+(target===0?6:target-1)); return d;
      }
      const diff=(target-now+7)%7;
      d = new Date(today); d.setDate(d.getDate()+diff); return d;
    }
    // Standalone 21號 / 21日 is an unambiguous day of month, except when part of hours.
    if ((m = src.match(/(?:^|[^\d月/\-])(\d{1,2})日/))) return nextNumberDate(+m[1],today);
    return null;
  }
  // Supports Chinese and Arabic times: 早上八點、下午三點半、08:30、上午8時15分.
  function chineseNumber(raw) {
    const text = String(raw || '').trim();
    if (/^\d+$/.test(text)) return +text;
    const num = {零:0,〇:0,一:1,二:2,兩:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
    if (text === '十') return 10;
    if (text.startsWith('廿')) return 20 + (text.length > 1 ? (num[text[1]] ?? NaN) : 0);
    if (text.includes('十')) {
      const [left, right] = text.split('十');
      return (left ? (num[left] ?? NaN) : 1)*10 + (right ? (num[right] ?? NaN) : 0);
    }
    if (![...text].every(ch => ch in num)) return NaN;
    return +[...text].map(ch => num[ch]).join('');
  }
  function parseTime(text) {
    // Do not mistake the 21 in 21號 for a time. A time needs 點/時/: or daypart.
    const hours = '[0-9]{1,2}|[零〇一二兩三四五六七八九十廿]{1,3}';
    const matcher = new RegExp('(凌晨|清晨|早上|上午|中午|下午|傍晚|晚上|晚間)?\\s*(' + hours + ')(?:[:：]([0-9]{2})|[點時时](半|[0-9]{1,2}|[零〇一二兩三四五六七八九十廿]{1,3})?\\s*分?)?', 'g');
    let m;
    while ((m = matcher.exec(text))) {
      if (!m[1] && !/[點時时:：]/.test(m[0])) continue;
      // A bare daypart + digits might still be a date (e.g. 上午21號): reject day suffix.
      if (/^[號日]/.test(text.slice(m.index+m[0].length))) continue;
      let hour = chineseNumber(m[2]);
      let minute = m[3] == null ? 0 : Number(m[3]);
      if (m[4] != null) minute = m[4] === '半' ? 30 : chineseNumber(m[4]);
      if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) continue;
      if (['下午','傍晚','晚上','晚間'].includes(m[1]) && hour < 12) hour += 12;
      if (['凌晨','清晨','早上','上午'].includes(m[1]) && hour === 12) hour = 0;
      if (m[1] === '中午' && hour < 11) hour += 12;
      if (['晚上','晚間'].includes(m[1]) && hour === 12) hour = 0;
      return String(hour).padStart(2,'0') + ':' + String(minute).padStart(2,'0');
    }
    return '';
  }
  function parseReminder(text) {
    const has = /提醒|通知我|叫我/.test(text);
    const oneHour = /(?:提前|前)\s*(?:1|一)\s*(?:小時|時)/.test(text);
    let lead = 'none';
    if (/(?:提前|前)\s*(?:1|一)\s*天/.test(text)) lead='1';
    else if (/(?:提前|前)\s*(?:3|三)\s*天/.test(text)) lead='3';
    else if (/(?:提前|前)\s*(?:7|七)\s*天/.test(text)) lead='7';
    const unsupported = /(?:提前|前)\s*([二兩四五六八九十]|[2-9]|1[0-9])\s*天/.test(text) && lead==='none';
    return {has,oneHour,lead,unsupported};
  }
  function guessType(text) {
    if (/出貨|出料|寄出|退貨/.test(text)) return '出貨';
    if (/進料|進貨|到貨|材料.*進場|設備.*進場|(?:總機|機組|泵浦).*進場|貨車|送貨/.test(text)) return '進料';
    if (/查驗|檢查|查核|檢驗|驗收|測試/.test(text)) return '查驗';
    if (/人員|工班|師傅|工人|班表|派工/.test(text)) return '人員';
    if (/施工|現場紀錄|紀錄|拍照|工序/.test(text)) return '紀錄';
    return '工作';
  }
  // Read available project names from the existing YAO form / current records.
  // Never fetches Firestore or modifies the user's records.
  function getProjects() {
    return window.YaoWorkspace?.listProjects?.() || [];
  }
  function placeHint(text) {
    // The leading place immediately before a date is a plausible project shorthand.
    // Show it as unconfirmed until matched against a real project option.
    const m = text.match(/(?:^|[\s，,。;；])([\u3400-\u9fff]{2,12})(?=(?:20\d{2}年)?\d{1,2}(?:月\d{1,2})?[日號])/);
    return m ? m[1] : '';
  }
  function siteMatches(project, text) {
    if (project.name && text.includes(project.name)) return true;
    if (project.code && text.includes(project.code)) return true;
    const hint = placeHint(text);
    if (hint && project.name?.includes(hint)) return true;
    const aliases = String(project.name || '').split(/[及與和、/\s\-]+/).filter(s=>s.length>=2);
    return aliases.some(alias=>text.includes(alias));
  }
  function guessProject(text) {
    const choices = getProjects().filter(p=>!p.archived && siteMatches(p,text));
    return choices.length === 1 ? choices[0] : null;
  }
  function interpret(text, now = new Date()) {
    const date=parseDate(text, now), time=parseTime(text), reminder=parseReminder(text);
    const project=guessProject(text);
    const projectHint=project ? project.name : placeHint(text);
    return {date:date?fromDate(date):'',time,reminder,project,projectHint,invalidDate: /(?:\d{1,2}[月/\-]\d{1,2}|\d{1,2}[號日])/.test(text) && !date, type:guessType(text),semanticType:/(?:開會|會議|會勘|討論會)/.test(text)?'會議':'',title:text.trim()};
  }
  export function prefillWork(text) {
    if (!text.trim() || !window.openItemModal) return false;
    const p=interpret(text.trim());
    window.openItemModal();
    const modal=document.getElementById('itemModal');
    if(!modal || modal.classList.contains('hidden'))return;
    const update=(id,value)=>{const el=document.getElementById(id);if(el && value!=null)el.value=value;};
    update('itemTitle',p.title);
    if(p.date || p.invalidDate)update('itemDate',p.date);
    if(p.time)update('itemTime',p.time);
    update('itemType',p.type);
    // Project choices have been populated by the app's own data-connected modal.
    const select=document.getElementById('itemProject');
    if(select) {
      const available=[...select.options].filter(x=>x.value);
      const hinted=p.project?.name || p.projectHint;
      const normalized=x=>String(x||'').replace(/[\s　]/g,'').toLowerCase();
      const matching=available.filter(x=> {
        const label=(x.textContent||'').split('｜').slice(1).join('｜').trim() || (x.textContent||'').trim();
        const code=(x.textContent||'').split('｜')[0].trim();
        const query=normalized(p.title);
        if (p.project?.id && x.value===String(p.project.id)) return true;
        return label && (query.includes(normalized(label)) || (hinted && normalized(label).includes(normalized(hinted))) || (hinted && normalized(hinted).includes(normalized(label))) || (code && query.includes(normalized(code))));
      });
      // Only select automatically when exactly one real option matches.
      if(matching.length===1) select.value=matching[0].value;
    }
    update('itemReminder',p.reminder.lead);
    const oneHour=document.getElementById('itemOneHourReminder'); if(oneHour)oneHour.checked=p.reminder.oneHour;
    const atTime=document.getElementById('itemAtTimeReminder');if(atTime)atTime.checked=p.reminder.has && p.reminder.lead === 'none' && !p.reminder.oneHour;
    if(!document.getElementById('itemProject')?.value) document.getElementById('itemProject')?.focus();
    else document.getElementById('itemTitle')?.focus();
    return true;
  }

export function workChips(text) {
  if (!text.trim()) return [];
  const p=interpret(text);
  const labels=[p.project ? p.project.name : p.projectHint ? p.projectHint+'（待確認）' : '選擇案場', p.invalidDate ? '日期需確認' : p.date || '今天'];
  if(p.time) labels.push(p.time);
  labels.push(p.semanticType || p.type);
  if(p.reminder.lead!=='none') labels.push('提前 '+p.reminder.lead+' 天');
  if(p.reminder.oneHour) labels.push('提前 1 小時');
  if(p.reminder.has && p.reminder.lead==='none' && !p.reminder.oneHour) labels.push('到時提醒');
  if(p.reminder.unsupported) labels.push('提醒天數需確認');
  return labels;
}
export { parseDate, parseTime, interpret };
