/* Swipe a record to the right to complete it (or restore a finished one).
   Touch only; it presses the card's existing done button, so every save path stays the same. */
const CARDS = [
    ['.field-row', '[data-home-done],[data-row-done],[data-note-done]'],
    ['.list-row', '[data-note-done],.mobile-done-btn,button[onclick^="toggleDone"]'],
    ['.admin-task-row', '.admin-complete[data-admin="complete"],.admin-complete[data-admin="reopen"]']
];
const START = 12, TRIGGER = 0.32, MAX_TRIGGER = 110;

function cardFor(target) {
    for (const [card, button] of CARDS) {
        const el = target.closest(card);
        const action = el && [...el.querySelectorAll(button)].find(b => !b.disabled && b.offsetParent !== null);
        if (action) return {el, action};
    }
    return null;
}

export function enableSwipeDone(root = document) {
    let drag = null;
    const reset = el => {
        el.classList.remove('is-swiping', 'swipe-ready');
        el.style.removeProperty('--swipe');
    };
    root.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse' || event.button !== 0) return;
        if (event.target.closest('input,textarea,select,summary,[contenteditable]')) return;
        const hit = cardFor(event.target);
        if (!hit) return;
        drag = {...hit, id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, active: false};
    }, {passive: true});
    root.addEventListener('pointermove', event => {
        if (!drag || event.pointerId !== drag.id) return;
        const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
        if (!drag.active) {
            // Vertical intent means the person is scrolling: let go.
            if (Math.abs(dy) > START && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
            if (dx < START || Math.abs(dx) < Math.abs(dy) * 1.4) return;
            drag.active = true;
            drag.el.classList.add('is-swiping');
            drag.el.dataset.swipeLabel = /恢復|reopen/.test(drag.action.textContent + drag.action.dataset.admin) ? '↺ 恢復' : '✓ 完成';
            try { drag.el.setPointerCapture(event.pointerId); } catch {}
        }
        drag.dx = Math.max(0, dx);
        const limit = Math.min(drag.el.offsetWidth * TRIGGER, MAX_TRIGGER);
        drag.el.style.setProperty('--swipe', `${drag.dx}px`);
        drag.el.classList.toggle('swipe-ready', drag.dx >= limit);
    }, {passive: true});
    const finish = event => {
        if (!drag || event.pointerId !== drag.id) return;
        const {el, action, active, dx} = drag;
        drag = null;
        if (!active) return;
        const done = dx >= Math.min(el.offsetWidth * TRIGGER, MAX_TRIGGER);
        // The swipe must not also count as a tap on whatever sits under the finger.
        const swallow = e => { e.stopPropagation(); e.preventDefault(); };
        el.addEventListener('click', swallow, {capture: true, once: true});
        setTimeout(() => el.removeEventListener('click', swallow, {capture: true}), 350);
        if (done) {
            el.classList.add('swipe-commit');
            navigator.vibrate?.(12);
            setTimeout(() => { el.removeEventListener('click', swallow, {capture: true}); reset(el); el.classList.remove('swipe-commit'); action.click(); }, 160);
        } else reset(el);
    };
    root.addEventListener('pointerup', finish);
    root.addEventListener('pointercancel', event => { if (drag?.active) reset(drag.el); drag = null; });
}
