/* 新增／編輯表單重新排版（只搬動畫面上的欄位，欄位 id 與儲存邏輯不變）
   順序：要做什麼 → 小清單 → 哪個案場 → 哪天 → 類型 → 更多設定（備註、提醒，平常收起來） */
export function enhanceItemForm() {
    const modal = document.getElementById('itemModal');
    const form = document.getElementById('itemForm');
    if (!modal || !form || form.dataset.enhanced) return;
    form.dataset.enhanced = '1';
    form.classList.add('item-form-v2');
    const $ = id => document.getElementById(id);
    const labelOf = id => $(id)?.closest('label');
    const title = labelOf('itemTitle'), checklist = $('itemChecklistEditor');
    const type = labelOf('itemType'), project = labelOf('itemProject'), hint = $('projectHint');
    const dateGrid = $('itemDate')?.closest('.form-grid');
    const note = labelOf('itemNote'), reminder = labelOf('itemReminder');
    const oneHour = labelOf('itemOneHourReminder'), atTime = labelOf('itemAtTimeReminder');
    const actions = form.querySelector('.modal-actions');
    if (!title || !project || !dateGrid || !type || !actions) return;

    // 標題文字改成口語
    const setText = (label, text) => { const node = [...label.childNodes].find(n => n.nodeType === 3 && n.textContent.trim()); if (node) node.textContent = text; };
    setText(title, '要做什麼');
    setText(project, '案場');
    setText(type, '類型');
    $('itemTitle').placeholder = '例如：朴子 泵浦啟動燈*3 以及 7609 鐵棍一隻';

    // 案場：最近用過的案場變成按鈕
    const projectChips = document.createElement('div'); projectChips.className = 'chip-row'; projectChips.id = 'itemProjectChips';
    // 日期：今天／明天／後天／下週一
    const dateChips = document.createElement('div'); dateChips.className = 'chip-row'; dateChips.id = 'itemDateChips';
    // 類型：一排小按鈕取代下拉選單
    const typeChips = document.createElement('div'); typeChips.className = 'chip-row'; typeChips.id = 'itemTypeChips';

    const more = document.createElement('details'); more.className = 'item-more';
    more.innerHTML = '<summary><span>備註・提醒</span></summary>';
    const moreBody = document.createElement('div'); moreBody.className = 'item-more-body';
    more.append(moreBody);
    [note, reminder, oneHour, atTime].filter(Boolean).forEach(el => moreBody.append(el));

    form.prepend(title);
    title.after(checklist || document.createTextNode(''));
    (checklist || title).after(project);
    project.append(projectChips);
    project.after(hint || document.createTextNode(''));
    (hint || project).after(dateGrid);
    dateGrid.before(dateChips);
    dateGrid.after(type);
    type.append(typeChips);
    type.after(more);
    more.after(actions);

    const iso = d => [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
    const fire = el => { el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); };

    function recentProjects() {
        const api = window.YaoWorkspace, select = $('itemProject');
        const valid = new Set([...select.options].map(o => o.value).filter(Boolean));
        const used = (api?.listItems() || []).sort((a,b) => Number(b.createdAt||0) - Number(a.createdAt||0)).map(i => String(i.projectId)).filter(id => valid.has(id));
        const order = [...new Set([...used, ...valid])];
        return order.slice(0, 5).map(id => ({id, name:(api?.listProjects() || []).find(p => String(p.id) === id)?.name || select.querySelector(`option[value="${CSS.escape(id)}"]`)?.textContent.trim() || id}));
    }
    function dateOptions() {
        const t = new Date(), add = n => { const d = new Date(t); d.setDate(d.getDate()+n); return d; };
        const monday = add(((8 - t.getDay()) % 7) || 7);
        return [['今天', iso(t)], ['明天', iso(add(1))], ['後天', iso(add(2))], ['下週一', iso(monday)]];
    }
    function sync() {
        const select = $('itemProject'), date = $('itemDate'), typeSelect = $('itemType');
        projectChips.innerHTML = recentProjects().map(p => `<button type="button" data-chip-project="${p.id}" class="${select.value === p.id ? 'on' : ''}">${p.name.replace(/[<>&"]/g, '')}</button>`).join('');
        dateChips.innerHTML = dateOptions().map(([n, v]) => `<button type="button" data-chip-date="${v}" class="${date.value === v ? 'on' : ''}">${n}</button>`).join('');
        typeChips.innerHTML = [...typeSelect.options].map(o => `<button type="button" data-chip-type="${o.value}" class="${typeSelect.value === o.value ? 'on' : ''}">${o.textContent.trim()}</button>`).join('');
        // 有填備註或開了提醒時，自動展開「更多設定」
        const used = ($('itemNote')?.value || '').trim() || ($('itemReminder')?.value || 'none') !== 'none' || $('itemOneHourReminder')?.checked;
        more.open = Boolean(used);
    }
    form.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.chipProject) { const s = $('itemProject'); s.value = b.dataset.chipProject; fire(s); sync(); }
        else if (b.dataset.chipDate) { const d = $('itemDate'); d.value = b.dataset.chipDate; fire(d); sync(); }
        else if (b.dataset.chipType) { const s = $('itemType'); s.value = b.dataset.chipType; fire(s); sync(); }
    });
    form.addEventListener('change', e => { if (['itemProject','itemDate','itemType'].includes(e.target.id)) syncSoon(); });
    let pending = 0;
    const syncSoon = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(() => setTimeout(sync, 0)); };
    // 每次打開表單（新增、編輯、整理隨手記）都重新同步按鈕狀態
    new MutationObserver(() => { if (!modal.classList.contains('hidden')) { syncSoon(); setTimeout(sync, 60); } }).observe(modal, {attributes:true, attributeFilter:['class']});
    sync();
}
