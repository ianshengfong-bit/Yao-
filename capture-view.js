import {parseCapture,capturePlan} from './capture-plan.js';
import {escapeHTML as e,pickRows,rowCounts,rowCard,filterStrip,showUndo,isEvening,frequentThings} from './field-views.js';

/* 工務首頁（工地用）：一行輸入、待辦直接列出、兩行卡片。
   左邊圓圈或往右滑完成；點卡片展開全文與其他操作。 */
export function createFieldHome(root,navigate) {
    let convert=null,draft='',plain=false,changes={},query='',filter=isEvening()?'tomorrow':'open',saving=false,message='',failed=false,requestId='',editorOpen=false,generation=0,limit=20,searchOpen=false;
    const expanded=new Set();
    // 從別的 App 分享過來（?text=）或捷徑「記一下」（?capture=1）：直接帶進輸入框
    let wantFocus=false;
    try{const q=new URLSearchParams(location.search);const shared=[q.get('title'),q.get('text'),q.get('url')].filter(Boolean).join('\n').trim();if(shared){draft=shared.slice(0,2000);wantFocus=true}if(q.has('capture'))wantFocus=true;if(shared||q.has('capture'))history.replaceState(null,'',location.pathname)}catch{}
    const api=()=>window.YaoWorkspace;
    const projectName=id=>api()?.listProjects().find(p=>String(p.id)===String(id))?.name||'';
    const short=date=>date?date.slice(5).replace('-','/'):'';
    const key=r=>r.source+':'+r.id;
    function effective(){try{return capturePlan(draft,api()?.listProjects()||[],{plain,changes}).parsed}catch{return {...parseCapture(draft,api()?.listProjects()||[],new Date(),plain),...changes}}}
    function recordData(){const globalQuery=String(document.getElementById('searchInput')?.value||'').trim().toLowerCase();return [...(api()?.listItems(true)||[]).map(r=>({...r,source:'item',kind:'task'})),...(api()?.listNotes()||[]).map(r=>({...r,source:'note',title:r.text,kind:r.captureKind||'note'}))].filter(r=>!globalQuery||[r.title,r.date,projectName(r.projectId),r.type].join(' ').toLowerCase().includes(globalQuery))}
    function chip(name,label){return `<button type="button" class="field-chip" data-adjust="${name}">${e(label)} <span aria-hidden="true">⌄</span></button>`}
    function draftChips(){const p=effective();return draft.trim()?`${p.projectId?chip('projectId',projectName(p.projectId)):''}${p.date?chip('date',short(p.date)):''}${p.time?chip('time',p.time):''}${chip('kind',p.kind==='task'?'待辦':'隨手記')}${p.issues.map(i=>chip(i.field,i.text)).join('')}${p.reminderRequest?'<span class="field-reminder-request">提醒要求已保留 · 通知未設定</span>':''}`:''}
    function editor(){const p=effective();return `<div class="field-adjust"><label>案場<select data-adjust-field="projectId"><option value="">未指定</option>${(api()?.listProjects()||[]).filter(p=>!p.archived).map(v=>`<option value="${e(v.id)}" ${String(v.id)===p.projectId?'selected':''}>${e(v.name)}</option>`).join('')}</select></label><label>日期<input type="date" data-adjust-field="date" value="${e(p.date)}"></label><label>時間<input type="time" data-adjust-field="time" value="${e(p.time)}"></label><label>保存方式<select data-adjust-field="kind"><option value="note" ${p.kind==='note'?'selected':''}>隨手記</option><option value="task" ${p.kind==='task'?'selected':''}>待辦</option></select></label><button class="btn" type="button" data-close-adjust>收起</button></div>`}
    function card(r){
        const note=r.source==='note',k=key(r),id=e(r.id);
        return rowCard(r,{edit:note?`data-note-inline="${id}"`:`data-home-edit="${id}" data-source="item"`,source:r.source,key:k,project:projectName(r.projectId),kind:note?(r.kind==='task'?'待辦':'隨手記'):r.type,open:expanded.has(k),expandAttr:'data-home-expand',check:`data-home-done="${id}" data-source="${r.source}"`,actions:`${note?`<button type="button" data-note-inline="${id}">編輯</button>`:''}<button type="button" data-home-edit="${id}" data-source="${r.source}">${note?'整理成工作':'查看／修改'}</button><button type="button" data-home-share="${id}" data-source="${r.source}">分享（LINE）</button><button type="button" data-home-copy="${id}" data-source="${r.source}">複製文字</button><button type="button" class="danger" data-home-delete="${id}" data-source="${r.source}">刪除</button>`});
    }
    // 常帶的東西：打字時出現，點一下就加進去（用「、」分開，存好會自動變成小清單）
    function thingChips(){
        if(!/帶|載|拿|買|、/.test(draft))return '';
        const w=api();if(!w)return '';
        const rows=[...(w.listItems()||[]),...(w.listNotes()||[]).map(n=>({...n,title:n.text}))];
        const names=(w.listProjects()||[]).map(p=>p.name);
        const list=frequentThings(rows,projectName,14,names).filter(t=>!draft.includes(t)).slice(0,8);
        return list.map(t=>`<button type="button" class="field-thing" data-add-thing="${e(t)}">＋${e(t)}</button>`).join('');
    }
    function convertBox(){
        if(!convert)return '';
        const projects=(api()?.listProjects()||[]).filter(p=>!p.archived);
        const t=new Date(),tm=new Date();tm.setDate(t.getDate()+1);
        const d=x=>[x.getFullYear(),String(x.getMonth()+1).padStart(2,'0'),String(x.getDate()).padStart(2,'0')].join('-');
        return `<div class="field-convert" id="fieldConvert"><select data-convert-project aria-label="案場"><option value="">選案場</option>${projects.map(p=>`<option value="${e(p.id)}" ${String(p.id)===convert.projectId?'selected':''}>${e(p.name)}</option>`).join('')}</select>${convert.date?`<button type="button" class="primary" data-convert-date="${e(convert.date)}">${e(short(convert.date))} 轉成工作</button>`:''}<button type="button" ${!convert.date&&!isEvening()?'class="primary"':''} data-convert-date="${d(t)}">今天做</button><button type="button" ${!convert.date&&isEvening()?'class="primary"':''} data-convert-date="${d(tm)}">明天做</button><input type="date" data-convert-pick aria-label="選其他日期"><button type="button" class="field-convert-skip" data-convert-skip>留在隨手記</button></div>`;
    }
    async function doConvert(date){
        const projectId=root.querySelector('[data-convert-project]')?.value||'';
        if(!projectId){message='請先選案場，再選日期。';failed=true;render();return}
        const target=convert;convert=null;failed=false;
        try{const r=await api().convertNote(target.id,{projectId,date});message='已轉成工作：'+short(date)+' '+projectName(projectId);render();
            r.synced?.catch(err=>{failed=true;message='雲端同步失敗：'+(err.message||'請再試一次');render()});
            setTimeout(()=>{if(!convert&&!failed){message='';render()}},3000)}
        catch(error){convert=target;failed=true;message=error.message||'轉換失敗，請再試一次。';render()}
    }
    // 首頁上方的「行政」小區塊：只顯示逾期／今天／明天，點了直接打開那件行政事項。
    function adminBlock(){
        const list=api()?.adminDue?.();
        if(list===null||list===undefined)return '';
        const today=new Date(),iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'),t=iso(today);
        const when=d=>d<t?`<b class="is-late">逾期 ${Math.round((Date.parse(t)-Date.parse(d))/864e5)} 天</b>`:d===t?'<b class="is-today">今天</b>':'<b>明天</b>';
        const rows=list.slice(0,4).map(x=>`<li><button type="button" data-admin-open="${e(x.id)}"><span class="field-admin-title">${e(x.title)}</span><span class="field-admin-meta">${when(x.date)}<span>${e(x.status||'')}</span>${x.recipient?`<span>送交 ${e(x.recipient)}</span>`:''}${projectName(x.projectId)?`<span>${e(projectName(x.projectId))}</span>`:''}</span></button></li>`).join('');
        return `<section class="field-admin-today"><header class="field-area-head"><span class="field-area-tag is-admin">行政</span><small>${list.length?`${list.length} 件`:'沒有待辦'}</small><button type="button" data-admin-open="">全部 ↗</button></header>${list.length?`<ul>${rows}</ul>`:''}${list.length>4?`<button type="button" class="field-admin-more" data-admin-open="">還有 ${list.length-4} 件 ↗</button>`:''}</section>`;
    }
    function rowsFor(all){const q=query.toLowerCase();return pickRows(all.filter(r=>!q||[r.title,r.date,projectName(r.projectId),r.type].join(' ').toLowerCase().includes(q)),filter)}
    function feed(){const all=recordData(),rows=rowsFor(all);if(!rows.length)return `<div class="field-empty">${filter==='tomorrow'?'明天還沒有安排。':filter==='open'?'沒有未完成的事。<br>想到什麼，直接在上面記下。':'這裡沒有符合的紀錄。'}</div>`;return rows.slice(0,limit).map(card).join('')+(rows.length>limit?`<button type="button" class="field-more" data-home-more>再顯示 ${Math.min(20,rows.length-limit)} 筆（共 ${rows.length}）</button>`:'')}
    function render({restoreFocus=false,restoreCursor=null}={}){
        const old=root.querySelector('#nextSmartInput'),focused=restoreFocus||document.activeElement===old,start=restoreFocus?restoreCursor:old?.selectionStart,end=restoreFocus?restoreCursor:old?.selectionEnd,searchFocused=document.activeElement?.id==='fieldHomeSearch';
        const projects=(api()?.listProjects()||[]).filter(p=>!p.archived),items=api()?.listItems()||[];
        root.innerHTML=`<section class="field-capture"><form id="nextSmartForm" class="field-composer${draft.trim()||editorOpen?' has-draft':''}"><div class="field-composer-line"><textarea id="nextSmartInput" aria-label="輸入現場紀錄或交辦事項" rows="1" maxlength="2000" placeholder="記一下現場的事…" ${saving?'disabled':''}></textarea>${draft.trim()?'':`<button class="field-paste" type="button" data-paste aria-label="貼上剛剛複製的文字">貼上</button>`}<button class="field-send" type="submit" ${saving||!draft.trim()?'disabled':''}>${saving?'儲存中':'記下'}</button></div><div class="field-composer-extra"><div id="fieldThings" class="field-things">${thingChips()}</div><div id="fieldDraftChips" class="field-draft-chips">${draftChips()}</div><div id="fieldAdjust" ${editorOpen?'':'hidden'}>${editorOpen?editor():''}</div><div class="field-composer-tools"><button type="button" class="field-text-button" data-paste ${saving?'disabled':''}>貼上</button><button type="button" class="field-text-button" data-adjust="projectId" ${saving?'disabled':''}>調整分類</button><label class="field-plain"><input type="checkbox" id="fieldPlain" ${plain?'checked':''} ${saving?'disabled':''}>只記原文</label><span>Ctrl＋Enter 送出</span></div></div></form><div class="field-save-message ${failed?'is-error':''}" role="${failed?'alert':'status'}" ${message?'':'hidden'}>${e(message)}</div>${convertBox()}</section>
<div class="field-home-columns"><section class="field-recent">${adminBlock()}<header class="field-area-head"><span class="field-area-tag is-field">現場</span><small></small></header>${filterStrip(rowCounts(recordData()),filter,'data-home-filter',`<button type="button" class="field-search-toggle" data-home-search aria-label="搜尋紀錄" aria-pressed="${searchOpen||Boolean(query)}">⌕</button>`)}${searchOpen||query?`<label class="field-home-search"><input type="search" id="fieldHomeSearch" aria-label="搜尋原文、案場或日期" placeholder="找原文、案場或日期…" value="${e(query)}"></label>`:''}<div id="fieldRecentList">${feed()}</div></section>
<aside class="field-home-aside"><section><header class="field-section-head"><h3>我的案場</h3><button type="button" data-home-page="projects">全部 ↗</button></header><div class="field-mini-projects">${projects.slice(0,4).map(p=>`<button type="button" data-home-project="${e(p.id)}"><span><strong>${e(p.name)}</strong><small>${items.filter(t=>String(t.projectId)===String(p.id)&&!t.done).length} 件待辦</small></span><span aria-hidden="true">↗</span></button>`).join('')||'<div class="field-empty">先建立第一個案場。</div>'}</div></section><section><h3>常用工務</h3><div class="field-tool-grid">${[['calendar','▦','行事曆'],['logistics','▣','進料／出貨'],['people','♙','人員安排'],['inspection','◎','查驗']].map(([p,i,n])=>`<button type="button" data-home-page="${p}"><span aria-hidden="true">${i}</span><strong>${n}</strong></button>`).join('')}</div></section><button type="button" class="field-admin-link" data-home-page="administration"><span>工程行政</span><small>↗</small></button></aside></div>`;
        const input=root.querySelector('#nextSmartInput');input.value=draft;grow(input);
        if(saving) root.querySelectorAll('#nextSmartForm input,#nextSmartForm textarea,#nextSmartForm select,#nextSmartForm button').forEach(el=>el.disabled=true);
        if(focused&&!saving){input.focus({preventScroll:true});input.setSelectionRange(start,end)}
        else if(wantFocus&&!saving){wantFocus=false;input.focus();input.setSelectionRange(input.value.length,input.value.length)}
        if(searchFocused||searchOpen&&!query&&document.activeElement===document.body)root.querySelector('#fieldHomeSearch')?.focus({preventScroll:true});
    }
    // 空白時交給 CSS 的一行高度；有內容才依文字長高（避免版面還沒排好就量錯）。
    function grow(input){input.style.height='';if(!input.value)return;input.style.height='auto';input.style.height=Math.min(input.scrollHeight,260)+'px'}
    function redrawDraft(){root.querySelector('#fieldDraftChips').innerHTML=draftChips();const th=root.querySelector('#fieldThings');if(th)th.innerHTML=thingChips();root.querySelector('#nextSmartForm').classList.toggle('has-draft',Boolean(draft.trim())||editorOpen);root.querySelector('#nextSmartForm [type=submit]').disabled=saving||!draft.trim()}
    root.addEventListener('input',event=>{if(event.target.id==='nextSmartInput'){draft=event.target.value;if(convert){convert=null;message='';const c=root.querySelector('#fieldConvert');c?.remove();const m=root.querySelector('.field-save-message');if(m)m.hidden=true}grow(event.target);changes={};requestId='';editorOpen=false;root.querySelector('#fieldAdjust').hidden=true;redrawDraft()}else if(event.target.id==='fieldHomeSearch'){query=event.target.value;limit=20;root.querySelector('#fieldRecentList').innerHTML=feed()}});
    root.addEventListener('change',event=>{if(event.target.matches?.('[data-convert-pick]')){if(event.target.value)doConvert(event.target.value);return}if(event.target.matches?.('[data-convert-project]')){convert&&(convert.projectId=event.target.value);if(failed){failed=false;message='已記下，放在隨手記。';render()}return}if(event.target.id==='fieldPlain'){plain=event.target.checked;changes={};requestId='';redrawDraft()}else if(event.target.dataset.adjustField){changes[event.target.dataset.adjustField]=event.target.value;requestId='';redrawDraft()}});
    root.addEventListener('keydown',event=>{
        if(event.target.id==='nextSmartInput'&&(event.ctrlKey||event.metaKey)&&event.key==='Enter'&&!event.isComposing){event.preventDefault();root.querySelector('#nextSmartForm').requestSubmit()}
        else if(event.target.dataset?.homeExpand&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.target.click()}
    });
    root.addEventListener('submit',async event=>{if(event.target.id!=='nextSmartForm')return;event.preventDefault();if(saving||!draft.trim())return;const version=generation;saving=true;message='';failed=false;requestId ||= crypto.randomUUID();const text=draft;render();try{const result=await api().capture(text,{plain,changes,requestId});if(version!==generation)return;draft='';changes={};plain=false;requestId='';editorOpen=false;query='';if(filter==='done')filter='open';convert=result.collection==='inboxNotes'?{id:result.id,projectId:result.parsed.projectId||'',date:result.parsed.date||''}:null;message=result.parsed.reminderRequest?'已記下。提醒要求有保留，通知尚未設定。':result.collection==='items'?'已記下，並加入工務工作。':'已記下，放在隨手記。';
            // 雲端同步失敗時把原文放回輸入框，不讓字不見。
            result.synced?.catch(error=>{if(version!==generation)return;if(!draft.trim())draft=text;failed=true;message='雲端同步失敗，原文已放回輸入框，請再按一次記下。';render()});
            setTimeout(()=>{if(version===generation&&!failed&&message&&!convert){message='';const el=root.querySelector('.field-save-message');if(el)el.hidden=true}},3500)}catch(error){if(version!==generation)return;failed=true;message=error.message||'這次尚未儲存成功，原文還在，可以再試一次。'}finally{if(version===generation){saving=false;render();if(!failed&&!convert&&matchMedia('(pointer:fine)').matches)root.querySelector('#nextSmartInput')?.focus({preventScroll:true})}}});
    root.addEventListener('click',async event=>{
        const b=event.target.closest('button');
        if(!b){const row=event.target.closest('[data-home-expand]');if(row){const k=row.dataset.homeExpand;expanded.has(k)?expanded.delete(k):expanded.add(k);root.querySelector('#fieldRecentList').innerHTML=feed();root.querySelector(`[data-home-expand="${CSS.escape(k)}"]`)?.focus({preventScroll:true})}return}
        if(b.dataset.addThing){const t=b.dataset.addThing,end=draft.trimEnd();draft=end+(/[、，,\s帶載拿買]$/.test(end)||!end?'':'、')+t;changes={};requestId='';render({restoreFocus:true,restoreCursor:draft.length});return}
        if(b.hasAttribute('data-paste')){try{const t=(await navigator.clipboard.readText()).trim();if(t){draft=(draft.trim()?draft.trimEnd()+'\n':'')+t.slice(0,2000);changes={};requestId='';convert=null;message='';render({restoreFocus:true,restoreCursor:draft.length})}else{message='剪貼簿是空的。';failed=false;render()}}catch{message='手機不允許直接讀取，請長按輸入框選「貼上」。';failed=false;render()}return}
        if(b.dataset.homeShare){const r=recordData().find(r=>r.id===b.dataset.homeShare&&r.source===b.dataset.source);if(r){const text=[projectName(r.projectId),r.date?short(r.date)+(r.time?' '+r.time:''):'',r.title].filter(Boolean).join(' ');try{if(navigator.share)await navigator.share({text});else{await navigator.clipboard.writeText(text);b.textContent='已複製，可貼到 LINE'}}catch{}}return}
        if(b.dataset.homeDelete){if(b.dataset.source==='note')await window.deleteInboxNote?.(b.dataset.homeDelete);else await window.deleteItem?.(b.dataset.homeDelete);return}
        if(b.dataset.adminOpen!==undefined){api()?.openAdmin?.(b.dataset.adminOpen);return}
        if(b.dataset.convertDate){doConvert(b.dataset.convertDate);return}
        if(b.hasAttribute('data-convert-skip')){convert=null;message='';render();return}
        if(b.dataset.adjust){editorOpen=true;root.querySelector('#nextSmartForm').classList.add('has-draft');root.querySelector('#fieldAdjust').hidden=false;root.querySelector('#fieldAdjust').innerHTML=editor();root.querySelector(`[data-adjust-field="${b.dataset.adjust}"]`)?.focus()}
        else if(b.hasAttribute('data-close-adjust')){editorOpen=false;root.querySelector('#fieldAdjust').hidden=true;redrawDraft()}
        else if(b.dataset.homeFilter){filter=b.dataset.homeFilter;limit=20;render();root.querySelector(`[data-home-filter="${filter}"]`)?.focus({preventScroll:true})}
        else if(b.hasAttribute('data-home-search')){searchOpen=!(searchOpen||query);if(!searchOpen)query='';render();if(searchOpen)root.querySelector('#fieldHomeSearch')?.focus()}
        else if(b.hasAttribute('data-home-more')){limit+=20;root.querySelector('#fieldRecentList').innerHTML=feed()}
        else if(b.dataset.homePage)navigate(b.dataset.homePage);
        else if(b.dataset.homeProject){navigate('projects');window.viewProject?.(b.dataset.homeProject)}
        else if(b.dataset.homeEdit){if(b.dataset.source==='note')window.organizeInboxNote?.(b.dataset.homeEdit);else window.editItem?.(b.dataset.homeEdit)}
        else if(b.dataset.homeDone){b.disabled=true;const r=recordData().find(r=>r.id===b.dataset.homeDone&&r.source===b.dataset.source);try{if(b.dataset.source==='note')await api().toggleNote(b.dataset.homeDone);else await window.toggleDone?.(b.dataset.homeDone,{quiet:true});if(r&&!r.done)showUndo(r.title,()=>(r.source==='note'?api().toggleNote(r.id):window.toggleDone?.(r.id,{quiet:true}))?.catch?.(error=>{message=error.message||'復原尚未儲存，請再試一次。';failed=true;render()}))}catch(error){message=error.message||'進度尚未儲存，請再試一次。';failed=true;render()}finally{if(b.isConnected)b.disabled=false}}
        else if(b.dataset.homeCopy){const r=recordData().find(r=>r.id===b.dataset.homeCopy&&r.source===b.dataset.source);if(r){try{await navigator.clipboard.writeText(r.title);b.textContent='已複製'}catch{b.textContent='請長按原文複製'}}}
    });
    return {render,reset(){generation++;convert=null;saving=false;draft='';changes={};plain=false;query='';message='';requestId='';filter=isEvening()?'tomorrow':'open';editorOpen=false;limit=20;searchOpen=false;expanded.clear()}};
}
