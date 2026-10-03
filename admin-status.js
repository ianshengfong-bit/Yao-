// Pending status changes belong to a single account and a single task. The
// transaction remains authoritative; only the displayed status is optimistic.
export function createStatusUpdates({save, validate, onChange, onSaved, onError}) {
    let confirmed = new Map(), receipts = new Map(), pending = new Map(), epoch = 0;
    const observed = (task, saved) => {
        const last = saved.history?.at(-1);
        return last ? task.history?.some(h => ['at','action','detail','actor'].every(key => h[key] === last[key])) :
            task.status === saved.status && task.updatedAt === saved.updatedAt;
    };
    function acknowledge(task) {
        const current = confirmed.get(task.id);
        // A listener may have already delivered this commit and a later edit.
        if (current && observed(current, task)) return;
        confirmed.set(task.id, task);
        receipts.set(task.id, task);
    }
    async function flush(id, entry, token) {
        try {
            while (token === epoch && pending.get(id) === entry) {
                const status = entry.desired, expectedStatus = entry.expectedStatus;
                entry.expectedStatus = undefined;
                const result = await save(id, status, expectedStatus);
                if (token !== epoch || pending.get(id) !== entry) return;
                acknowledge(result.task);
                if (entry.desired !== status) { onChange(); continue; }
                pending.delete(id);
                onSaved({...result, id, status, context:entry.context});
                onChange();
                return;
            }
        } catch (error) {
            if (token !== epoch || pending.get(id) !== entry) return;
            pending.delete(id);
            onError({id, status:entry.desired, context:entry.context, error});
            onChange();
        }
    }
    return {
        receive(list) {
            const next = new Map(list.map(task => [task.id, task]));
            for (const [id, saved] of receipts) {
                const task = next.get(id);
                if (!task || observed(task, saved)) receipts.delete(id);
                else next.set(id, saved);
            }
            confirmed = next;
        },
        tasks() {
            return [...confirmed.values()].map(task => {
                const entry = pending.get(task.id);
                return entry && !task.archived ? {...task, status:entry.desired} : task;
            });
        },
        has(id) { return pending.has(id); },
        count() { return pending.size; },
        request(id, status, context = {}) {
            const task = confirmed.get(id), entry = pending.get(id);
            if (!task || task.archived) throw new Error('事項已不存在或已封存，請查看最新資料。');
            if ((entry?.desired || task.status) === status) return false;
            validate({...task, status:entry?.desired || task.status}, status);
            if (entry) {
                entry.desired = status;
                entry.context = context;
                onChange();
            } else {
                const next = {desired:status, expectedStatus:context.expectedStatus, context};
                pending.set(id, next);
                onChange();
                void flush(id, next, epoch);
            }
            return true;
        },
        reset() {
            epoch++;
            confirmed.clear(); receipts.clear(); pending.clear();
        }
    };
}
