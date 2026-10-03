// Reuse existing controls and keyed task rows during live updates. Event
// handlers are delegated by admin.js; input focus and scroll stay in place.
const keyOf = node => node.nodeType === 1 ? node.id || node.dataset.domKey ||
    (node.dataset.taskId ? `task:${node.dataset.taskId}` : '') ||
    (node.dataset.admin ? `action:${node.dataset.admin}:${node.dataset.id || node.dataset.tab || node.dataset.project || node.dataset.date || node.dataset.range || node.dataset.filter || node.dataset.step || node.dataset.title || ''}` : '') ||
    (['DIV','SECTION','ASIDE','HEADER','NAV','FORM','DETAILS','ARTICLE'].includes(node.tagName) && node.classList.length ? `container:${node.tagName}:${node.classList[0]}${node.classList[0] === 'card' ? ':' + (node.classList[1] || '') : ''}` : '') : '';
const compatible = (a, b) => a.nodeType === b.nodeType && (a.nodeType !== 1 || a.tagName === b.tagName) && keyOf(a) === keyOf(b);
function patch(current, next) {
    if (current.nodeType !== 1) {
        if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
        return;
    }
    const open = current.tagName === 'DETAILS' ? current.open : null;
    const value = ['SELECT','INPUT','TEXTAREA'].includes(current.tagName) ? next.value : null;
    const checked = next.checked;
    for (const attr of [...current.attributes]) if (!next.hasAttribute(attr.name)) current.removeAttribute(attr.name);
    for (const attr of next.attributes) if (current.getAttribute(attr.name) !== attr.value) current.setAttribute(attr.name, attr.value);
    reconcile(current, next);
    if (open !== null) current.open = open;
    if (current.tagName === 'SELECT') current.value = value;
    else if (['INPUT','TEXTAREA'].includes(current.tagName) && current !== document.activeElement) {
        if (current.value !== value) current.value = value;
        if (current.tagName === 'INPUT') current.checked = checked;
    }
}
function reconcile(current, next) {
    const remaining = new Set(current.childNodes);
    const keyed = new Map([...remaining].filter(n => keyOf(n)).map(n => [keyOf(n), n]));
    let cursor = current.firstChild;
    for (const child of [...next.childNodes]) {
        let match = keyOf(child) ? keyed.get(keyOf(child)) : cursor;
        if (!match || !remaining.has(match) || !compatible(match, child)) {
            match = [...remaining].find(n => compatible(n, child));
        }
        if (match) {
            if (match !== cursor) current.insertBefore(match, cursor);
            remaining.delete(match);
            patch(match, child);
            cursor = match.nextSibling;
        } else {
            current.insertBefore(child, cursor);
        }
    }
    remaining.forEach(node => node.remove());
}
export function updateAdminDOM(root, html) {
    const next = document.createElement('template');
    next.innerHTML = html;
    reconcile(root, next.content);
}
