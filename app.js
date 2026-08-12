const data = {
    projects: JSON.parse(localStorage.getItem("yao_projects") || "[]"),
    tasks: JSON.parse(localStorage.getItem("yao_tasks") || "[]"),
    reminders: JSON.parse(localStorage.getItem("yao_reminders") || "[]"),
    notes: JSON.parse(localStorage.getItem("yao_notes") || "[]")
};

function saveData() {
    localStorage.setItem("yao_projects", JSON.stringify(data.projects));
    localStorage.setItem("yao_tasks", JSON.stringify(data.tasks));
    localStorage.setItem("yao_reminders", JSON.stringify(data.reminders));
    localStorage.setItem("yao_notes", JSON.stringify(data.notes));
}


/* =========================
   頁面切換
========================= */

const pages = document.querySelectorAll(".page");
const navItems = document.querySelectorAll(".nav-item");

const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");

const pageInfo = {
    dashboard: ["儀表板", "消防工程管理總覽"],
    projects: ["工程案件", "管理消防工程案件"],
    tasks: ["工作事項", "記錄每天需要處理的工作"],
    reminders: ["提醒事項", "重要工作與時間提醒"],
    notes: ["備忘錄", "快速記錄現場資訊"]
};

function showPage(pageName) {
    pages.forEach(page => {
        page.classList.remove("active");
    });

    const target = document.getElementById(pageName);

    if (target) {
        target.classList.add("active");
    }

    navItems.forEach(item => {
        item.classList.toggle(
            "active",
            item.dataset.page === pageName
        );
    });

    if (pageInfo[pageName]) {
        pageTitle.textContent = pageInfo[pageName][0];
        pageSubtitle.textContent = pageInfo[pageName][1];
    }

    closeSidebar();
}

navItems.forEach(item => {
    item.addEventListener("click", () => {
        showPage(item.dataset.page);
    });
});

document.querySelectorAll("[data-page-target]").forEach(button => {
    button.addEventListener("click", () => {
        showPage(button.dataset.pageTarget);
    });
});


/* =========================
   手機選單
========================= */

const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const menuBtn = document.getElementById("menuBtn");

function openSidebar() {
    sidebar.classList.add("open");
    overlay.classList.add("show");
}

function closeSidebar() {
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
}

menuBtn.addEventListener("click", openSidebar);
overlay.addEventListener("click", closeSidebar);


/* =========================
   Modal
========================= */

const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const closeModal = document.getElementById("closeModal");

function openModal(title, html) {
    modalTitle.textContent = title;
    modalBody.innerHTML = html;
    modal.classList.add("show");
}

function closeModalWindow() {
    modal.classList.remove("show");
}

closeModal.addEventListener("click", closeModalWindow);

modal.addEventListener("click", event => {
    if (event.target === modal) {
        closeModalWindow();
    }
});


/* =========================
   新增工程
========================= */

function addProject() {
    openModal(
        "新增工程",
        `
        <form id="projectForm">

            <div class="form-group">
                <label>工程名稱</label>
                <input
                    id="projectName"
                    required
                    placeholder="例如：XX大樓消防工程"
                >
            </div>

            <div class="form-group">
                <label>地址</label>
                <input
                    id="projectAddress"
                    placeholder="工程地址"
                >
            </div>

            <div class="form-group">
                <label>備註</label>
                <textarea
                    id="projectNote"
                    placeholder="工程備註"
                ></textarea>
            </div>

            <div class="form-actions">
                <button
                    type="button"
                    class="primary-btn"
                    onclick="closeModalWindow()"
                >
                    取消
                </button>

                <button
                    type="submit"
                    class="primary-btn"
                >
                    儲存工程
                </button>
            </div>

        </form>
        `
    );

    document.getElementById("projectForm")
        .addEventListener("submit", event => {
            event.preventDefault();

            data.projects.push({
                id: Date.now(),
                name: document.getElementById("projectName").value,
                address: document.getElementById("projectAddress").value,
                note: document.getElementById("projectNote").value,
                createdAt: new Date().toLocaleDateString("zh-TW")
            });

            saveData();
            closeModalWindow();
            render();
        });
}


/* =========================
   新增工作事項
========================= */

function addTask() {
    openModal(
        "新增工作事項",
        `
        <form id="taskForm">

            <div class="form-group">
                <label>工作內容</label>

                <input
                    id="taskText"
                    required
                    placeholder="例如：確認二樓配線"
                >
            </div>

            <div class="form-actions">

                <button
                    type="button"
                    class="primary-btn"
                    onclick="closeModalWindow()"
                >
                    取消
                </button>

                <button
                    type="submit"
                    class="primary-btn"
                >
                    儲存
                </button>

            </div>

        </form>
        `
    );

    document.getElementById("taskForm")
        .addEventListener("submit", event => {
            event.preventDefault();

            data.tasks.push({
                id: Date.now(),
                text: document.getElementById("taskText").value,
                done: false
            });

            saveData();
            closeModalWindow();
            render();
        });
}


/* =========================
   新增提醒
========================= */

function addReminder() {
    openModal(
        "新增提醒",
        `
        <form id="reminderForm">

            <div class="form-group">
                <label>提醒內容</label>

                <input
                    id="reminderText"
                    required
                    placeholder="例如：明天確認消防檢查"
                >
            </div>

            <div class="form-group">
                <label>日期</label>

                <input
                    id="reminderDate"
                    type="datetime-local"
                >
            </div>

            <div class="form-actions">

                <button
                    type="button"
                    class="primary-btn"
                    onclick="closeModalWindow()"
                >
                    取消
                </button>

                <button
                    type="submit"
                    class="primary-btn"
                >
                    儲存提醒
                </button>

            </div>

        </form>
        `
    );

    document.getElementById("reminderForm")
        .addEventListener("submit", event => {
            event.preventDefault();

            data.reminders.push({
                id: Date.now(),
                text: document.getElementById("reminderText").value,
                date: document.getElementById("reminderDate").value
            });

            saveData();
            closeModalWindow();
            render();
        });
}


/* =========================
   新增備忘錄
========================= */

function addNote() {
    openModal(
        "新增備忘錄",
        `
        <form id="noteForm">

            <div class="form-group">
                <label>標題</label>

                <input
                    id="noteTitle"
                    required
                    placeholder="例如：現場注意事項"
                >
            </div>

            <div class="form-group">
                <label>內容</label>

                <textarea
                    id="noteText"
                    placeholder="輸入備忘內容..."
                ></textarea>
            </div>

            <div class="form-actions">

                <button
                    type="button"
                    class="primary-btn"
                    onclick="closeModalWindow()"
                >
                    取消
                </button>

                <button
                    type="submit"
                    class="primary-btn"
                >
                    儲存
                </button>

            </div>

        </form>
        `
    );

    document.getElementById("noteForm")
        .addEventListener("submit", event => {
            event.preventDefault();

            data.notes.push({
                id: Date.now(),
                title: document.getElementById("noteTitle").value,
                text: document.getElementById("noteText").value
            });

            saveData();
            closeModalWindow();
            render();
        });
}


/* =========================
   Render
========================= */

function render() {
    document.getElementById("projectCount").textContent =
        data.projects.length;

    document.getElementById("taskCount").textContent =
        data.tasks.length;

    document.getElementById("reminderCount").textContent =
        data.reminders.length;

    document.getElementById("noteCount").textContent =
        data.notes.length;

    renderProjects();
    renderTasks();
    renderReminders();
    renderNotes();
}


/* =========================
   工程列表
========================= */

function renderProjects() {
    const list = document.getElementById("projectList");
    const recent = document.getElementById("recentProjects");

    if (data.projects.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🏗️</div>
                <h3>目前沒有工程案件</h3>
                <p>按「新增工程」開始建立</p>
            </div>
        `;

        recent.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🏗️</div>
                <h3>目前還沒有工程</h3>
                <p>按右上角「新增」建立第一個工程案件</p>
            </div>
        `;

        return;
    }

    list.innerHTML = data.projects.map(project => `
        <div class="project-card">

            <h3>
                ${escapeHtml(project.name)}
            </h3>

            <p>
                ${escapeHtml(project.address || "未填寫地址")}
            </p>

            <p>
                ${escapeHtml(project.note || "")}
            </p>

            <small>
                建立：${escapeHtml(project.createdAt)}
            </small>

        </div>
    `).join("");

    recent.innerHTML = data.projects
        .slice(-3)
        .reverse()
        .map(project => `
            <div class="list-item">

                <div>
                    <strong>
                        ${escapeHtml(project.name)}
                    </strong>

                    <div>
                        ${escapeHtml(project.address || "")}
                    </div>
                </div>

            </div>
        `)
        .join("");
}


/* =========================
   工作事項
========================= */

function renderTasks() {
    const list = document.getElementById("taskList");

    if (data.tasks.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <h3>目前沒有工作事項</h3>
            </div>
        `;

        return;
    }

    list.innerHTML = data.tasks.map(task => `
        <div class="list-item">

            <label>

                <input
                    type="checkbox"
                    ${task.done ? "checked" : ""}
                    onchange="toggleTask(${task.id})"
                >

                ${escapeHtml(task.text)}

            </label>

        </div>
    `).join("");
}


/* =========================
   提醒
========================= */

function renderReminders() {
    const list = document.getElementById("reminderList");

    if (data.reminders.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔔</div>
                <h3>目前沒有提醒</h3>
            </div>
        `;

        return;
    }

    list.innerHTML = data.reminders.map(reminder => `
        <div class="list-item">

            <div>

                <strong>
                    ${escapeHtml(reminder.text)}
                </strong>

                <div>
                    ${escapeHtml(reminder.date || "未設定時間")}
                </div>

            </div>

        </div>
    `).join("");
}


/* =========================
   備忘錄
========================= */

function renderNotes() {
    const list = document.getElementById("noteList");

    if (data.notes.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📝</div>
                <h3>目前沒有備忘錄</h3>
            </div>
        `;

        return;
    }

    list.innerHTML = data.notes.map(note => `
        <div class="note-card">

            <h3>
                ${escapeHtml(note.title)}
            </h3>

            <p>
                ${escapeHtml(note.text)}
            </p>

        </div>
    `).join("");
}


/* =========================
   工作完成
========================= */

function toggleTask(id) {
    const task = data.tasks.find(item => item.id === id);

    if (task) {
        task.done = !task.done;

        saveData();
        render();
    }
}


/* =========================
   防止 HTML 注入
========================= */

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================
   按鈕
========================= */

document.getElementById("addBtn")
    .addEventListener("click", addProject);

document.getElementById("addMobileBtn")
    .addEventListener("click", addProject);

document.getElementById("addProjectBtn")
    .addEventListener("click", addProject);

document.getElementById("addTaskBtn")
    .addEventListener("click", addTask);

document.getElementById("addReminderBtn")
    .addEventListener("click", addReminder);

document.getElementById("addNoteBtn")
    .addEventListener("click", addNote);


/* =========================
   啟動
========================= */

render();


/* =========================
   Service Worker
========================= */

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("sw.js")
            .catch(error => {
                console.log(
                    "Service Worker 啟動失敗",
                    error
                );
            });
    });
}