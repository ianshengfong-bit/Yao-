import {collection, doc, onSnapshot, runTransaction} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import {changeTask, historyEntry, makeOccurrence, monthsToGenerate, occurrenceId, validateTask} from './admin-core.js';

// All new writes are confined to these two user-scoped collections.
export function createAdminStore(db, uid) {
    const tasks = collection(db, 'users', uid, 'adminTasks');
    const templates = collection(db, 'users', uid, 'adminRecurring');
    return {
        subscribe(onTasks, onTemplates, onError) {
            const stops = [
                onSnapshot(tasks, snap => onTasks(snap.docs.map(d => ({...d.data(), id:d.id}))), onError),
                onSnapshot(templates, snap => onTemplates(snap.docs.map(d => ({...d.data(), id:d.id}))), onError)
            ];
            return () => stops.forEach(stop => stop());
        },
        async create(data, recurring) {
            validateTask(data);
            const ref = doc(recurring ? templates : tasks);
            const now = Date.now();
            await runTransaction(db, async tx => {
                if (recurring) {
                    const template = {
                        projectId:data.projectId, title:data.title, note:data.note,
                        recipient:data.recipient, isSubmission:data.isSubmission,
                        day:Number(data.date.slice(8)), startMonth:data.date.slice(0,7),
                        active:true, createdAt:now, updatedAt:now,
                        history:[historyEntry('新增固定事項', `每月 ${Number(data.date.slice(8))} 日`, uid, now)]
                    };
                    tx.set(ref, template);
                    tx.set(doc(tasks, occurrenceId(ref.id, template.startMonth)), makeOccurrence({...template, id:ref.id}, template.startMonth, uid, now));
                } else {
                    tx.set(ref, {
                        ...data, archived:false, reviewStatus:data.isSubmission ? '準備中' : '',
                        submissions:[], recurringId:'', createdAt:now, updatedAt:now,
                        history:[historyEntry('新增事項', `${data.date} · ${data.recipient}`, uid, now)]
                    });
                }
            });
            return ref.id;
        },
        async mutate(id, action, payload = {}) {
            const ref = doc(tasks, id);
            await runTransaction(db, async tx => {
                const snap = await tx.get(ref);
                if (!snap.exists()) throw new Error('事項已不存在，請重新整理。');
                const task = snap.data();
                if (task.archived && action !== 'restore') throw new Error('請先恢復封存事項。');
                tx.update(ref, changeTask(task, action, payload, uid));
            });
        },
        async editTemplate(id, data) {
            const ref = doc(templates, id);
            await runTransaction(db, async tx => {
                const snap = await tx.get(ref);
                if (!snap.exists()) throw new Error('固定事項已不存在。');
                const old = snap.data();
                const patch = data.active !== undefined ? {active:!!data.active} : {
                    title:data.title.trim(), note:data.note, recipient:data.recipient, day:Number(data.day)
                };
                if (data.active === undefined) {
                    validateTask({...old, ...patch, date:`${old.startMonth}-01`, status:'待準備'});
                    if (!Number.isInteger(patch.day) || patch.day < 1 || patch.day > 31) throw new Error('請填寫 1～31 日。');
                }
                const now = Date.now();
                const detail = data.active !== undefined ? (patch.active ? '恢復未來排程' : '停止產生新事項；已建立的事項保留') :
                    `每月 ${old.day} → ${patch.day} 日；${old.title} → ${patch.title}；${old.recipient} → ${patch.recipient}；備註：${old.note || '無'} → ${patch.note || '無'}（已建立的事項保持原內容）`;
                tx.update(ref, {...patch, updatedAt:now, history:[...(old.history || []), historyEntry('固定事項設定', detail, uid, now)]});
            });
        },
        async generate(template, today) {
            // Read the latest template and every candidate before any write. Stable IDs
            // plus transactions prevent duplicate months or overwriting completed work.
            const months = monthsToGenerate(template, today);
            for (let offset = 0; offset < months.length; offset += 60) {
                const chunk = months.slice(offset, offset + 60);
                await runTransaction(db, async tx => {
                    const snap = await tx.get(doc(templates, template.id));
                    if (!snap.exists() || !snap.data().active) return;
                    const latest = {...snap.data(), id:template.id};
                    const refs = chunk.map(month => doc(tasks, occurrenceId(template.id, month)));
                    const snapshots = [];
                    for (const ref of refs) snapshots.push(await tx.get(ref));
                    refs.forEach((ref, i) => {
                        if (!snapshots[i].exists() && chunk[i] >= latest.startMonth) {
                            tx.set(ref, makeOccurrence(latest, chunk[i], uid));
                        }
                    });
                });
            }
        }
    };
}
