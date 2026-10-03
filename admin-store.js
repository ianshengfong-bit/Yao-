import {telegramSchedule} from './reminder-core.js';
import {collection, doc, onSnapshot, runTransaction} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import {changeTask, historyEntry, makeOccurrence, occurrenceKeys, occurrenceId, validateTask, frequencyOf, recurrenceLabel, weekRange} from './admin-core.js';

// All new writes are confined to these two user-scoped collections.
export function createAdminStore(db, uid) {
    const tasks = collection(db, 'users', uid, 'adminTasks');
    const templates = collection(db, 'users', uid, 'adminRecurring');
    return {
        subscribe(onTasks, onTemplates, onError) {
            const stops = [
                onSnapshot(tasks, {includeMetadataChanges:true}, snap => {
                    // An unconfirmed local write must not become the rollback
                    // baseline. The metadata event delivers it after approval.
                    if (!snap.metadata.hasPendingWrites) onTasks(snap.docs.map(d => ({...d.data(), id:d.id})));
                }, onError),
                onSnapshot(templates, snap => onTemplates(snap.docs.map(d => ({...d.data(), id:d.id}))), onError)
            ];
            return () => stops.forEach(stop => stop());
        },
        async create(data, recurring) {
            validateTask(data);
            const frequency = recurring === true ? 'monthly' : recurring;
            if (frequency && !['monthly', 'weekly'].includes(frequency)) throw new Error('固定排程類型無效。');
            const ref = doc(recurring ? templates : tasks);
            const now = Date.now();
            await runTransaction(db, async tx => {
                if (recurring) {
                    const template = {
                        projectId:data.projectId, title:data.title, note:data.note,
                        recipient:data.recipient, isSubmission:data.isSubmission,
                        time:data.time || '', reminder:data.reminder || 'none', reminderAtTime:data.reminderAtTime !== false, reminderOneHour:data.reminderOneHour === true,
                        frequency,
                        ...(frequency === 'weekly' ? {startDate:data.date, weekday:new Date(`${data.date}T00:00:00Z`).getUTCDay()} : {day:Number(data.date.slice(8)), startMonth:data.date.slice(0,7)}),
                        active:true, createdAt:now, updatedAt:now,
                        history:[historyEntry('新增固定事項', frequency === 'weekly' ? `每週${['日','一','二','三','四','五','六'][new Date(`${data.date}T00:00:00Z`).getUTCDay()]}` : `每月 ${Number(data.date.slice(8))} 日`, uid, now)]
                    };
                    tx.set(ref, template);
                    const key = frequency === 'weekly' ? weekRange(data.date)[0] : template.startMonth;
                    tx.set(doc(tasks, occurrenceId(ref.id, key, frequency)), makeOccurrence({...template, id:ref.id}, key, uid, now));
                } else {
                    tx.set(ref, {
                        ...data, tgMinutes:telegramSchedule(data,'adminTasks'), tgScheduleVersion:1, archived:false, reviewStatus:data.isSubmission ? '準備中' : '',
                        submissions:[], recurringId:'', createdAt:now, updatedAt:now,
                        history:[historyEntry('新增事項', `${data.date} · ${data.recipient}`, uid, now)]
                    });
                }
            });
            return ref.id;
        },
        async mutate(id, action, payload = {}) {
            const ref = doc(tasks, id);
            return runTransaction(db, async tx => {
                const snap = await tx.get(ref);
                if (!snap.exists()) throw new Error('事項已不存在，請重新整理。');
                const task = snap.data();
                if (task.archived && action !== 'restore') throw new Error('請先恢復封存事項。');
                if (action === 'status' && payload.expectedStatus !== undefined && task.status !== payload.expectedStatus) {
                    throw new Error('這件工作的進度已在其他地方變更，請查看最新狀態。');
                }
                // Another device may have made the same change during the wait.
                if (action === 'status' && task.status === payload.status) return {task:{...task,id}, previousStatus:task.status};
                const patch = changeTask(task, action, payload, uid);
                tx.update(ref, patch);
                return {task:{...task,...patch,id}, previousStatus:task.status};
            });
        },
        async editTemplate(id, data) {
            const ref = doc(templates, id);
            await runTransaction(db, async tx => {
                const snap = await tx.get(ref);
                if (!snap.exists()) throw new Error('固定事項已不存在。');
                const old = snap.data();
                const frequency = frequencyOf(old);
                const patch = data.active !== undefined ? {active:!!data.active} : {
                    title:data.title.trim(), note:data.note, recipient:data.recipient,
                    ...Object.fromEntries(['time','reminder','reminderAtTime','reminderOneHour'].filter(key => data[key] !== undefined).map(key => [key,data[key]])),
                    ...(data.projectId ? {projectId:data.projectId} : {}),
                    ...(frequency === 'weekly' ? {weekday:Number(data.weekday)} : {day:Number(data.day)})
                };
                if (data.active === undefined) {
                    validateTask({...old, ...patch, date:frequency === 'weekly' ? old.startDate : `${old.startMonth}-01`, status:'待準備'});
                    if (frequency === 'weekly') {
                        if (!Number.isInteger(patch.weekday) || patch.weekday < 0 || patch.weekday > 6) throw new Error('請選擇每週星期幾。');
                    } else if (!Number.isInteger(patch.day) || patch.day < 1 || patch.day > 31) throw new Error('請填寫 1～31 日。');
                }
                const now = Date.now();
                const detail = data.active !== undefined ? (patch.active ? '恢復未來排程' : '停止產生新事項；已建立的事項保留') :
                    `${recurrenceLabel(old)} → ${recurrenceLabel({...old,...patch})}；${old.title} → ${patch.title}；${old.recipient} → ${patch.recipient}；備註：${old.note || '無'} → ${patch.note || '無'}${patch.projectId && patch.projectId !== old.projectId ? '；變更後續工作的案場' : ''}（已建立的事項保持原內容）`;
                tx.update(ref, {...patch, updatedAt:now, history:[...(old.history || []), historyEntry('固定事項設定', detail, uid, now)]});
            });
        },
        async generate(template, today) {
            // Read the latest template and every candidate before any write. Stable IDs
            // plus transactions prevent duplicate months or overwriting completed work.
            const keys = occurrenceKeys(template, today);
            for (let offset = 0; offset < keys.length; offset += 60) {
                const chunk = keys.slice(offset, offset + 60);
                await runTransaction(db, async tx => {
                    const snap = await tx.get(doc(templates, template.id));
                    if (!snap.exists() || !snap.data().active) return;
                    const latest = {...snap.data(), id:template.id};
                    const eligible = new Set(occurrenceKeys(latest, today));
                    const refs = chunk.map(key => doc(tasks, occurrenceId(template.id, key, frequencyOf(latest))));
                    const snapshots = [];
                    for (const ref of refs) snapshots.push(await tx.get(ref));
                    refs.forEach((ref, i) => {
                        if (!snapshots[i].exists() && eligible.has(chunk[i])) {
                            tx.set(ref, makeOccurrence(latest, chunk[i], uid));
                        }
                    });
                });
            }
        }
    };
}
