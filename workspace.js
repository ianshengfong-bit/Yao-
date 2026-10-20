import { workChips, prefillWork } from './smart-entry.js';
/* YAO redesigned field workspace. Pure DOM enhancement to the existing YAO app.
   No Firestore calls and no modifications to administrative forms. */
(() => {
  'use strict';
  const system = document.getElementById('system');
  const nav = document.getElementById('nav');
  const app = document.getElementById('app');
  if (!system || !nav || !app || window.__YAO_NEXT_LOADED__) return;
  window.__YAO_NEXT_LOADED__ = true;
  const next = document.createElement('div');
  let draft = '';
  let revealObserver;
  let dataDirty = true;
  let restoreInputFocus = false;
  let restoreCursor = null;
  const dayNames = '日一二三四五六';
  const isLogged = () => !system.classList.contains('hidden');
  const page = () => nav.querySelector('.nav-item.active')?.dataset.page || '';
  const isField = () => isLogged() && page() !== 'administration';
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateShort = x => x ? String(x).slice(5).replace('-','/') : '未排日期';
  const weekday = d => ['週日','週一','週二','週三','週四','週五','週六'][d.getDay()];
  const today = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const navNames = {dashboard:['◈','總覽'],records:['▤','工作紀錄'],projects:['◇','我的案場'],calendar:['▦','行事曆'],reminders:['◉','提醒中心'],administration:['▧','工程行政'],logistics:['▣','進料／出貨'],people:['♙','人員安排'],inspection:['◎','查驗'],inbox:['▥','待整理']};
  const stored = key => {try{return localStorage.getItem(key)}catch{return null}};
  const save = (key, value) => {try{localStorage.setItem(key,value)}catch{}};
  const themeKey='YAO_NEXT_THEME';
  const themeMedia=matchMedia('(prefers-color-scheme: dark)');
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let theme=stored(themeKey)||'system';
  if (!['system','light','dark'].includes(theme)) theme='system';
  function syncTheme(){
    const resolved=theme==='system'?(themeMedia.matches?'dark':'light'):theme;
    document.body.dataset.yaoTheme=resolved;
    document.querySelectorAll('[data-next-theme]').forEach(b=>{b.classList.toggle('selected',b.dataset.nextTheme===theme);b.setAttribute('aria-pressed',String(b.dataset.nextTheme===theme));});
  }
  themeMedia.addEventListener?.('change',syncTheme);
  function renderNavigation(){
    if (nav.dataset.yaoNext) return;
    nav.dataset.yaoNext='1';
    const all=new Map([...nav.querySelectorAll('.nav-item[data-page]')].map(b=>[b.dataset.page,b]));
    for(const [key,b] of all){
      const [glyph,title]=navNames[key]||['•',key];
      const count=[...b.querySelectorAll('.nav-count')];
      b.replaceChildren();
      const s=document.createElement('span');s.className='next-nav-symbol';s.textContent=glyph;
      const t=document.createElement('span');t.className='next-nav-title';t.textContent=title;
      b.append(s,t,...count);b.title=title;
    }
    nav.replaceChildren();
    const group = document.createElement('div');group.className='next-main-links';
    for(const key of ['dashboard','records','projects','calendar','reminders'])if(all.has(key))group.append(all.get(key));
    nav.append(group);
    const other=document.createElement('details');other.className='next-more';other.id='nextMore';
    other.open=stored('YAO_NEXT_MORE')==='true';
    const summary=document.createElement('summary');summary.innerHTML='<span class="next-nav-symbol">▧</span><span class="next-nav-title">其他工務</span><span class="next-arrow">⌄</span>';other.append(summary);
    for(const key of ['logistics','people','inspection','inbox'])if(all.has(key))other.append(all.get(key));
    other.addEventListener('toggle',()=>save('YAO_NEXT_MORE',other.open?'true':'false'));
    nav.append(other);
    const sep=document.createElement('div');sep.className='next-nav-divider';nav.append(sep);
    if(all.has('administration'))nav.append(all.get('administration'));
    const brand=system.querySelector('.sidebar .brand');
    if(brand){
      const logo=brand.querySelector('.logo');if(logo)logo.textContent='✦';
      const name=brand.querySelector('strong');if(name)name.textContent='YAO';
      const cap=brand.querySelector('span');if(cap)cap.textContent='我的工作空間';
      let toggle=brand.querySelector('#nextCollapse');
      if(!toggle){toggle=document.createElement('button');toggle.id='nextCollapse';toggle.type='button';toggle.textContent='‹';toggle.title='收合／展開';toggle.setAttribute('aria-label','收合或展開選單');brand.append(toggle);
        toggle.addEventListener('click',()=>{document.body.classList.toggle('next-compact');save('YAO_NEXT_COLLAPSE',String(document.body.classList.contains('next-compact')))});}
    }
    if(stored('YAO_NEXT_COLLAPSE')==='true')document.body.classList.add('next-compact');
    const bottom=system.querySelector('.sidebar-bottom');
    if(bottom){
      const switcher=document.createElement('div');switcher.className='next-theme-control';
      switcher.innerHTML='<span>外觀</span><div class="next-theme-modes" role="group" aria-label="外觀主題"><button type="button" data-next-theme="light" title="日間">☀</button><button type="button" data-next-theme="system" title="自動">◐</button><button type="button" data-next-theme="dark" title="夜間">☾</button></div>';
      switcher.addEventListener('click',e=>{const btn=e.target.closest('[data-next-theme]');if(!btn)return;theme=btn.dataset.nextTheme;save(themeKey,theme);syncTheme()});
      bottom.insertBefore(switcher,bottom.firstChild);
      const caption=bottom.querySelector('small');if(caption)caption.textContent='YAO';
    }
    syncTheme();
  }
  function realBridge(){
    try{
      const api=window.YaoWorkspace;
      if(api?.listItems && api?.listProjects)return {items:api.listItems(true)||[],projects:api.listProjects()||[]};
    }catch(e){}
    return null;
  }
  function domRows(card){
    return [...(card?.querySelectorAll('.list-row')||[])].map(el=>{
      const title=el.querySelector('.list-main strong')?.textContent?.trim()||'';
      const meta=el.querySelector('.compact-item-meta')?.textContent?.trim()||'';
      const note=el.querySelector('.compact-item-note')?.textContent?.trim()||'';
      const action=el.querySelector('button[onclick*="editItem"]')?.getAttribute('onclick')||'';
      const id=action.match(/editItem\(['"]([^'"\)]*)/)?.[1]||'';
      let parts=meta.split('・');const m=(parts[0]||'').split('｜');const proj=(m.length>1?m.slice(1).join('｜'):m[0]||'').trim();
      return {id,title,meta,note,project:proj,dateText:(parts[1]||'').trim(),type:el.querySelector('.tag')?.textContent?.trim()||'',done:false};
    }).filter(x=>x.title);
  }
  function sourceSnapshot(){
    const bridge=realBridge();
    if(bridge){
      const pMap=new Map(bridge.projects.map(p=>[String(p.id),p]));
      const work=bridge.items.map(i=>({...i,project:pMap.get(String(i.projectId))?.name||'未指定案場',dateText:[dateShort(i.date),i.time||''].filter(Boolean).join(' ')}));
      const now=today();
      const active=work.filter(i=>!i.done);
      const order=(a,b)=>`${a.date||''} ${a.time||''}`.localeCompare(`${b.date||''} ${b.time||''}`);
      return {today:active.filter(x=>x.date===now).sort(order),next:active.filter(x=>x.date>now).sort(order),late:active.filter(x=>x.date&&x.date<now).sort(order),recent:[...work].sort((a,b)=>order(b,a)).slice(0,7),projects:bridge.projects.filter(p=>!p.archived).map(p=>({...p,open:active.filter(x=>String(x.projectId)===String(p.id)).length,done:work.filter(x=>String(x.projectId)===String(p.id)&&x.done).length})), pending:active.length,projectTotal:bridge.projects.filter(p=>!p.archived).length};
    }
    const stats=[...app.querySelectorAll(':scope > .grid.stats .stat-value')].map(x=>+(x.textContent||'').replace(/[^\d]/g,'')||0);
    const cards=[...app.querySelectorAll('.dashboard-work-grid > .card')];
    const todayRows=domRows(cards[0]),nextRows=domRows(cards[1]);
    const all=[...todayRows,...nextRows].filter((x,i,a)=>a.findIndex(y=>y.id?y.id===x.id:y.title===x.title&&y.meta===x.meta)===i);
    const names=[...new Set(all.map(x=>x.project).filter(Boolean))];
    return {today:todayRows,next:nextRows,late:[],recent:all,projects:names.map(name=>({name})),pending:stats[1]||0,projectTotal:stats[3]||0,reminderCount:stats[2]||0};
  }
  function openPage(name){ const target=nav.querySelector(`.nav-item[data-page="${name}"]`); target?.click(); }
  function recordRow(i,kind='normal'){
    const date=i.dateText||[dateShort(i.date),i.time||''].filter(Boolean).join(' ');
    return `<div class="next-record"><span class="next-record-mark ${kind}" aria-hidden="true"></span><div class="next-record-body"><strong>${esc(i.title)}</strong><small>${esc(i.project||'未指定案場')}${i.type?' <span class="next-dot">·</span> '+esc(i.type):''}</small></div><span class="next-record-date">${esc(date)}</span><button class="next-row-open" type="button" data-next-edit="${esc(i.id||'')}" title="編輯工作" aria-label="編輯 ${esc(i.title)}">↗</button></div>`;
  }
  function recordRows(rows,empty,kind){return rows.length?rows.slice(0,5).map(i=>recordRow(i,kind)).join(''):`<div class="next-empty">${esc(empty)}</div>`}
  function layout(){
    revealObserver?.disconnect();
    const focused = restoreInputFocus || document.activeElement?.id === 'nextSmartInput';
    const selection = restoreInputFocus ? restoreCursor : focused ? document.activeElement.selectionStart : null;
    restoreInputFocus = false;
    const d=new Date();const s=sourceSnapshot();
    const dateLabel=`${d.getMonth()+1} 月 ${d.getDate()} 日・${weekday(d)}`;
    const prj=s.projects.slice(0,3).map((p,i)=>`<button class="next-project" data-next-project="${esc(p.id)}" type="button"><span class="next-project-symbol p${i%3}">⌂</span><span class="next-project-info"><strong>${esc(p.name)}</strong><small>${p.open==null?'查看案場工作':`待處理 ${p.open} 件 · 已完成 ${p.done||0} 件`}</small></span><span class="next-project-open">↗</span></button>`).join('');
    const recent=s.recent.slice(0,5).map(i=>recordRow(i)).join('');
    next.innerHTML=`
      <section class="next-hero">
        <div class="next-hero-top"><span class="next-eyebrow"><span class="next-live-dot"></span> 工程工作空間</span><span class="next-date">${esc(dateLabel)}</span></div>
        <div class="next-hero-heading"><div><h2>把重要的事，<br><span>整理得剛剛好。</span></h2><p>所有案場與工作，集中在這裡。</p></div><div class="next-orbit" aria-hidden="true"><i></i><b></b><em></em></div></div>
        <form id="nextSmartForm" class="next-command"><span class="next-command-star" aria-hidden="true">✦</span><input id="nextSmartInput" type="text" aria-label="快速新增工作紀錄" placeholder="記錄一件事…" autocomplete="off"><button type="submit" aria-label="解析並新增工作">↗</button></form>
        <div class="next-smart-chips" id="nextSmartChips" aria-live="polite"></div>
      </section>
      <section class="next-info-strip" aria-label="工作概況">
        <button class="next-info-tile" type="button" data-next-page="records"><span class="next-info-icon">◷</span><span><b>${s.today.length}</b><small>今天</small></span></button>
        <button class="next-info-tile" type="button" data-next-page="records"><span class="next-info-icon">◉</span><span><b>${s.pending}</b><small>待處理</small></span></button>
        <button class="next-info-tile" type="button" data-next-page="calendar"><span class="next-info-icon">◈</span><span><b>${s.reminderCount ?? s.next.length}</b><small>接下來</small></span></button>
        <button class="next-info-tile" type="button" data-next-page="projects"><span class="next-info-icon">◇</span><span><b>${s.projectTotal}</b><small>進行中案場</small></span></button>
      </section>
      <section class="next-focus-layout"><div class="next-main-section next-focus"><header><div><span class="next-kicker">TODAY</span><h3>今天要處理</h3></div><button type="button" data-next-page="records">所有工作 ↗</button></header><div class="next-records">${recordRows(s.today,'今天還沒有安排事項','today')}</div></div>
      <div class="next-main-section next-next"><header><div><span class="next-kicker">UP NEXT</span><h3>接下來</h3></div><button type="button" data-next-page="calendar">開啟日曆 ↗</button></header><div class="next-records">${recordRows(s.next,'暫時沒有即將進行的工作','next')}</div></div></section>
      <section class="next-bottom-layout"><div class="next-main-section"><header><div><span class="next-kicker">MY PROJECTS</span><h3>我的案場</h3></div><button type="button" data-next-page="projects">查看全部 ↗</button></header><div class="next-projects">${prj||(s.projectTotal?`<button type="button" class="next-project" data-next-page="projects"><span class="next-project-symbol">⌂</span><span class="next-project-info"><strong>已有 ${s.projectTotal} 個案場</strong><small>前往案場查看完整資料</small></span><span class="next-project-open">↗</span></button>`:'<div class="next-empty">還沒有案場</div>')}</div></div>
      <div class="next-main-section"><header><div><span class="next-kicker">WORK STREAM</span><h3>工作動態</h3></div><button type="button" data-next-page="records">全部紀錄 ↗</button></header><div class="next-records">${recent||'<div class="next-empty">目前沒有工作紀錄</div>'}</div></div></section>
      <div class="next-bottom-space"></div>
    `;
    const input=next.querySelector('#nextSmartInput');
    input.value=draft;
    function drawChips(){
      const chips=next.querySelector('#nextSmartChips');
      chips.replaceChildren();
      for(const label of workChips(draft)){
        const c=document.createElement('span');c.className='next-chip';c.textContent=label;chips.append(c);
      }
    }
    drawChips();
    input.addEventListener('input',()=>{draft=input.value;drawChips()});
    next.querySelector('#nextSmartForm').addEventListener('submit',e=>{
      e.preventDefault();if(!draft.trim()){input.focus();return;}
      prefillWork(draft);
    });
    if(focused){input.focus({preventScroll:true});input.setSelectionRange(selection,selection);}
    next.querySelectorAll('[data-next-project]').forEach(b=>b.addEventListener('click',()=>{
      openPage('projects');window.viewProject?.(b.dataset.nextProject);
    }));
    next.querySelectorAll('[data-next-page]').forEach(b=>b.addEventListener('click',()=>openPage(b.dataset.nextPage)));
    next.querySelectorAll('[data-next-edit]').forEach(b=>b.addEventListener('click',()=>{
      const id=b.dataset.nextEdit;if(id&&typeof window.editItem==='function')window.editItem(id);else openPage('records');
    }));
    if(!reduceMotion.matches && 'IntersectionObserver' in window){
      const observer=revealObserver=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('next-visible');observer.unobserve(e.target)}}),{threshold:.04});
      next.querySelectorAll('.next-main-section,.next-info-tile,.next-project').forEach((el,i)=>{el.classList.add('next-animate-in');el.style.setProperty('--next-delay',`${Math.min(i*38,220)}ms`);observer.observe(el)});
    }
  }

  let mobileBar, menuToggle, menuBackdrop;
  function setupMobileNavigation(){
    mobileBar=document.createElement('nav');mobileBar.className='next-mobile-nav';mobileBar.setAttribute('aria-label','主要導覽');
    for(const key of ['dashboard','records','projects','calendar']){
      const b=document.createElement('button');b.type='button';b.dataset.mobilePage=key;
      b.innerHTML=`<span aria-hidden="true">${navNames[key][0]}</span><small>${navNames[key][1]}</small>`;
      b.addEventListener('click',()=>{openPage(key);closeMenu()});mobileBar.append(b);
    }
    menuToggle=document.createElement('button');menuToggle.type='button';menuToggle.innerHTML='<span aria-hidden="true">☰</span><small>更多</small>';
    menuToggle.setAttribute('aria-label','開啟更多選單');menuToggle.setAttribute('aria-expanded','false');menuToggle.setAttribute('aria-controls','nav');
    menuToggle.addEventListener('click',()=>{
      if(document.body.classList.contains('next-menu-open'))closeMenu();
      else{document.body.classList.add('next-menu-open');menuToggle.setAttribute('aria-expanded','true');nav.querySelector('.nav-item.active')?.focus();}
    });mobileBar.append(menuToggle);system.append(mobileBar);
    menuBackdrop=document.createElement('button');menuBackdrop.type='button';menuBackdrop.className='next-menu-backdrop';menuBackdrop.setAttribute('aria-label','關閉更多選單');menuBackdrop.addEventListener('click',closeMenu);system.append(menuBackdrop);
    nav.addEventListener('click',e=>{if(e.target.closest('.nav-item'))closeMenu(false)});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
  }
  function closeMenu(focus=true){
    const wasOpen=document.body.classList.contains('next-menu-open');document.body.classList.remove('next-menu-open');
    menuToggle?.setAttribute('aria-expanded','false');if(wasOpen&&focus)menuToggle?.focus();
  }
  function syncMobileNavigation(p){
    mobileBar?.querySelectorAll('[data-mobile-page]').forEach(b=>{b.classList.toggle('selected',b.dataset.mobilePage===p);if(b.dataset.mobilePage===p)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    menuToggle?.classList.toggle('selected',!['dashboard','records','projects','calendar'].includes(p));
  }

  let renderPending=false;
  function sync(){
    const logged=isLogged();document.body.classList.toggle('yao-next',logged);
    const work=isField();document.body.classList.toggle('yao-next-field',work);
    const p=page();document.body.dataset.yaoNextPage=p;
    syncMobileNavigation(p);
    if(!logged){draft='';next.replaceChildren();next.dataset.built='';document.body.classList.remove('next-menu-open');}
    const title=document.getElementById('pageTitle');if(title&&p==='dashboard')title.textContent='總覽';
    const eyebrow=system.querySelector('.topbar .eyebrow');if(eyebrow)eyebrow.textContent=work?'我的工程':'工程行政';
    const other=document.getElementById('nextMore');if(other?.querySelector('.nav-item.active'))other.open=true;
    if(work&&p==='dashboard'&&window.YaoWorkspace?.ready()){
      if(!next.isConnected){next.dataset.built='';next.id='yaoNextDashboard';next.className='next-dashboard';app.prepend(next);}
      if(!next.dataset.built || dataDirty){next.dataset.built='1';dataDirty=false;layout();}
    }
    if((!work||p!=='dashboard')&&next.isConnected){next.remove();next.dataset.built='';}
    if(work&&p==='records'){
      if(!document.getElementById('nextRecordTitle')){
        const bar=document.createElement('div');bar.id='nextRecordTitle';bar.className='next-record-head';bar.innerHTML='<div><span class="next-kicker">YOUR WORK</span><h2>每一件事情，都有跡可循。</h2></div><div class="next-shortcuts"><button type="button" data-work-shortcut="logistics">進出貨</button><button type="button" data-work-shortcut="people">人員</button><button type="button" data-work-shortcut="inspection">查驗</button></div>';
        app.prepend(bar);bar.querySelectorAll('[data-work-shortcut]').forEach(b=>b.addEventListener('click',()=>openPage(b.dataset.workShortcut)));
      }
    }
  }
  function schedule(){if(renderPending)return;renderPending=true;requestAnimationFrame(()=>{renderPending=false;sync()});}
  renderNavigation();setupMobileNavigation();syncTheme();sync();
  window.addEventListener('yao:before-render',()=>{
    const input=document.getElementById('nextSmartInput');
    restoreInputFocus=Boolean(input&&document.activeElement===input);
    restoreCursor=input?.selectionStart ?? null;
  });
  window.addEventListener('yao:rendered',()=>{dataDirty=true;schedule()});
  window.addEventListener('yao:item-saved',()=>{draft='';dataDirty=true;schedule()});
  new MutationObserver(schedule).observe(app,{childList:true});
  new MutationObserver(schedule).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
  new MutationObserver(schedule).observe(system,{attributes:true,attributeFilter:['class']});
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&isField()){
      e.preventDefault();if(page()!=='dashboard'){openPage('dashboard');setTimeout(()=>document.getElementById('nextSmartInput')?.focus(),60)}else document.getElementById('nextSmartInput')?.focus();
    }
  });
  document.addEventListener('pointerdown',e=>{
    if(reduceMotion.matches||!isField())return;
    const btn=e.target.closest('.next-dashboard button,.next-main-links button');if(!btn)return;
    btn.classList.add('next-pressed');setTimeout(()=>btn.classList.remove('next-pressed'),180);
  },{passive:true});
  window.addEventListener('resize',()=>{if(innerWidth<820)document.body.classList.remove('next-compact')},{passive:true});
})();
