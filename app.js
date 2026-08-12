/* =========================================================
   YAO V4.1
   Firebase 雲端版
   消防工程行政管理
   app.js

   功能：
   - Firebase Email / Password 登入
   - Firestore 雲端資料
   - 案場管理
   - 工作資料
   - 進料 / 出貨
   - 人員安排
   - 查驗
   - 工作紀錄
   - 搜尋
   - 新增 / 編輯 / 刪除
   - 完成 / 恢復
   - 分享
   - 案場封存
   - 月份行事曆
   - 上一個月 / 下一個月
   - 回到今天
   - 電腦版 / 手機版
========================================================= */


/* =========================================================
   Firebase SDK
========================================================= */

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
    getFirestore,
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";


/* =========================================================
   Firebase 設定
========================================================= */

const firebaseConfig = {

    apiKey:
        "AIzaSyDIHHzGpIkuMUvyq5yBrDrb_kvJTAM2QJo",

    authDomain:
        "yao-fire.firebaseapp.com",

    projectId:
        "yao-fire",

    storageBucket:
        "yao-fire.firebasestorage.app",

    messagingSenderId:
        "981464789073",

    appId:
        "1:981464789073:web:9188a540a3253cd4fd4870"
};


const firebaseApp =
    initializeApp(firebaseConfig);

const auth =
    getAuth(firebaseApp);

const db =
    getFirestore(firebaseApp);


/* =========================================================
   全域狀態
========================================================= */

let currentUser = null;

let items = [];

let projects = [];

let currentPage = "dashboard";

let editingItemId = null;

let editingProjectId = null;

let unsubscribeProjects = null;

let unsubscribeItems = null;

let dataReady = false;


/* =========================================================
   行事曆狀態
========================================================= */

let calendarDate = new Date();

calendarDate.setDate(1);


/* =========================================================
   DOM
========================================================= */

const app =
    document.querySelector("#app");

const loginScreen =
    document.querySelector("#loginScreen");

const system =
    document.querySelector("#system");

const loginForm =
    document.querySelector("#loginForm");

const loginEmail =
    document.querySelector("#loginEmail");

const loginPassword =
    document.querySelector("#loginPassword");

const loginError =
    document.querySelector("#loginError");

const loginBtn =
    document.querySelector("#loginBtn");

const logoutBtn =
    document.querySelector("#logoutBtn");


/* =========================================================
   今天
========================================================= */

function getTodayISO() {

    const d = new Date();

    const year =
        d.getFullYear();

    const month =
        String(
            d.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            d.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


const isoToday =
    getTodayISO();


/* =========================================================
   日期工具
========================================================= */

function addDays(number) {

    const d = new Date();

    d.setDate(
        d.getDate() + number
    );

    const year =
        d.getFullYear();

    const month =
        String(
            d.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            d.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function formatDate(date) {

    if (!date)
        return "";

    return String(date)
        .replaceAll("-", "/");
}


/* =========================================================
   HTML 安全
========================================================= */

function esc(text = "") {

    return String(text).replace(
        /[&<>"']/g,
        function (char) {

            return {

                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"

            }[char];

        }
    );
}


/* =========================================================
   Toast
========================================================= */

function toast(message) {

    const box =
        document.querySelector("#toast");

    if (!box)
        return;

    box.textContent =
        message;

    box.classList.add("show");

    setTimeout(
        function () {

            box.classList.remove(
                "show"
            );

        },
        1800
    );
}


/* =========================================================
   Firestore 路徑
========================================================= */

function userCollection(name) {

    return collection(
        db,
        "users",
        currentUser.uid,
        name
    );
}


/* =========================================================
   Firebase 登入
========================================================= */

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            loginError.textContent = "";

            loginBtn.disabled = true;

            loginBtn.textContent =
                "登入中…";

            try {

                await signInWithEmailAndPassword(
                    auth,
                    loginEmail.value.trim(),
                    loginPassword.value
                );

                loginPassword.value = "";

            }

            catch (error) {

                console.error(
                    "Firebase Login Error:",
                    error
                );

                loginError.textContent =
                    getLoginErrorMessage(
                        error.code
                    );

            }

            finally {

                loginBtn.disabled = false;

                loginBtn.textContent =
                    "登入系統";

            }

        }
    );

}


/* =========================================================
   登入錯誤訊息
========================================================= */

function getLoginErrorMessage(code) {

    switch (code) {

        case "auth/invalid-credential":
            return "Email 或密碼錯誤。";

        case "auth/user-not-found":
            return "找不到這個帳號。";

        case "auth/wrong-password":
            return "密碼錯誤。";

        case "auth/invalid-email":
            return "Email 格式不正確。";

        case "auth/too-many-requests":
            return "嘗試次數過多，請稍後再試。";

        case "auth/network-request-failed":
            return "網路連線失敗，請確認網路。";

        case "auth/operation-not-allowed":
            return "Firebase 尚未啟用 Email / Password 登入。";

        default:
            return "登入失敗，請確認帳號與密碼。";

    }

}


/* =========================================================
   登出
========================================================= */

if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        async function () {

            if (
                !confirm(
                    "確定要登出 Yao 嗎？"
                )
            )
                return;

            try {

                await signOut(auth);

            }

            catch (error) {

                console.error(error);

                toast(
                    "登出失敗"
                );

            }

        }
    );

}


/* =========================================================
   Firebase 登入狀態
========================================================= */

onAuthStateChanged(
    auth,
    async function (user) {

        if (user) {

            currentUser =
                user;

            loginScreen.classList.add(
                "hidden"
            );

            system.classList.remove(
                "hidden"
            );

            await startRealtimeData();

        }

        else {

            currentUser =
                null;

            stopRealtimeData();

            system.classList.add(
                "hidden"
            );

            loginScreen.classList.remove(
                "hidden"
            );

        }

    }
);


/* =========================================================
   啟動即時資料
========================================================= */

async function startRealtimeData() {

    dataReady = false;

    items = [];

    projects = [];

    if (unsubscribeProjects)
        unsubscribeProjects();

    if (unsubscribeItems)
        unsubscribeItems();


    unsubscribeProjects =
        onSnapshot(
            userCollection("projects"),

            snapshot => {

                projects =
                    snapshot.docs.map(
                        docItem => ({

                            id:
                                docItem.id,

                            ...docItem.data()

                        })
                    );

                dataReady = true;

                render();

            },

            error => {

                console.error(
                    "案場同步失敗:",
                    error
                );

                toast(
                    "案場資料讀取失敗"
                );

            }
        );


    unsubscribeItems =
        onSnapshot(
            userCollection("items"),

            snapshot => {

                items =
                    snapshot.docs.map(
                        docItem => ({

                            id:
                                docItem.id,

                            ...docItem.data()

                        })
                    );

                dataReady = true;

                render();

            },

            error => {

                console.error(
                    "工作同步失敗:",
                    error
                );

                toast(
                    "工作資料讀取失敗"
                );

            }
        );

}


/* =========================================================
   停止即時資料
========================================================= */

function stopRealtimeData() {

    if (unsubscribeProjects) {

        unsubscribeProjects();

        unsubscribeProjects =
            null;

    }

    if (unsubscribeItems) {

        unsubscribeItems();

        unsubscribeItems =
            null;

    }

    items = [];

    projects = [];

    dataReady = false;
}


/* =========================================================
   找案場
========================================================= */

function getProject(id) {

    return projects.find(
        p =>
            String(p.id) ===
            String(id)
    );

}


/* =========================================================
   類型 CSS
========================================================= */

function typeClass(type) {

    if (type === "查驗")
        return "red";

    if (type === "進料")
        return "blue";

    if (type === "出貨")
        return "orange";

    if (type === "人員")
        return "green";

    return "";
}


/* =========================================================
   搜尋
========================================================= */

function filteredItems() {

    const input =
        document.querySelector(
            "#searchInput"
        );

    if (!input)
        return items;

    const search =
        input.value
            .trim()
            .toLowerCase();

    if (!search)
        return items;


    return items.filter(
        function (item) {

            const project =
                getProject(
                    item.projectId
                );

            return [

                project?.name || "",
                project?.code || "",
                item.title || "",
                item.note || "",
                item.type || ""

            ]
                .join(" ")
                .toLowerCase()
                .includes(search);

        }
    );

}


/* =========================================================
   主 Render
========================================================= */

function render() {

    if (!currentUser)
        return;


    if (!dataReady) {

        app.innerHTML = `

            <div class="card loading-card">

                <div class="loading-spinner">
                    ⏳
                </div>

                <h3>
                    正在載入雲端資料…
                </h3>

                <div class="muted">
                    正在與 Firebase 同步
                </div>

            </div>

        `;

        return;

    }


    const titles = {

        dashboard: "儀表板",

        calendar: "行事曆",

        projects: "案場",

        logistics: "進料 / 出貨",

        people: "人員安排",

        inspection: "查驗",

        records: "工作紀錄"

    };


    const pageTitle =
        document.querySelector(
            "#pageTitle"
        );

    if (pageTitle) {

        pageTitle.textContent =
            titles[currentPage];

    }


    document
        .querySelectorAll(".nav-item")
        .forEach(
            function (button) {

                button.classList.toggle(
                    "active",
                    button.dataset.page ===
                    currentPage
                );

            }
        );


    const data =
        filteredItems();


    if (
        currentPage ===
        "dashboard"
    )
        renderDashboard(data);


    if (
        currentPage ===
        "calendar"
    )
        renderCalendar(data);


    if (
        currentPage ===
        "projects"
    )
        renderProjects();


    if (
        currentPage ===
        "logistics"
    )
        renderListPage(
            data.filter(
                x =>
                    x.type === "進料" ||
                    x.type === "出貨"
            ),
            "物流"
        );


    if (
        currentPage ===
        "people"
    )
        renderListPage(
            data.filter(
                x =>
                    x.type === "人員"
            ),
            "人員安排"
        );


    if (
        currentPage ===
        "inspection"
    )
        renderListPage(
            data.filter(
                x =>
                    x.type === "查驗"
            ),
            "查驗"
        );


    if (
        currentPage ===
        "records"
    )
        renderListPage(
            data.filter(
                x =>
                    x.type === "紀錄"
            ),
            "工作紀錄"
        );

}


/* =========================================================
   儀表板
========================================================= */

function renderDashboard(data) {

    const todayItems =
        data.filter(
            x =>
                x.date ===
                isoToday
        );


    const upcoming =
        data
            .filter(
                x =>
                    x.date >=
                    isoToday &&
                    !x.done
            )
            .sort(
                (a, b) =>
                    (
                        a.date +
                        (a.time || "")
                    ).localeCompare(
                        b.date +
                        (b.time || "")
                    )
            )
            .slice(0, 7);


    const pending =
        items.filter(
            x =>
                !x.done
        ).length;


    const reminders =
        items.filter(
            x =>
                !x.done &&
                x.date > isoToday &&
                x.reminder !== "none"
        ).length;


    const activeProjects =
        projects.filter(
            x =>
                !x.archived
        ).length;


    app.innerHTML = `

        <div class="grid stats">

            <div class="stat">

                <div class="stat-label">
                    今日工作
                </div>

                <div class="stat-value">
                    ${todayItems.length}
                </div>

            </div>


            <div class="stat">

                <div class="stat-label">
                    待處理
                </div>

                <div class="stat-value">
                    ${pending}
                </div>

            </div>


            <div class="stat">

                <div class="stat-label">
                    即將提醒
                </div>

                <div class="stat-value">
                    ${reminders}
                </div>

            </div>


            <div class="stat">

                <div class="stat-label">
                    進行中案場
                </div>

                <div class="stat-value">
                    ${activeProjects}
                </div>

            </div>

        </div>


        <div
            class="grid two-col"
            style="margin-top:16px"
        >

            <div class="card">

                <h3>
                    今天要處理
                </h3>

                <div class="list">

                    ${
                        todayItems.length
                        ?
                        todayItems
                            .map(itemRow)
                            .join("")
                        :
                        `
                        <div class="empty">
                            今天沒有安排事項
                        </div>
                        `
                    }

                </div>

            </div>


            <div class="card">

                <h3>
                    接下來
                </h3>

                <div class="list">

                    ${
                        upcoming.length
                        ?
                        upcoming
                            .map(itemRow)
                            .join("")
                        :
                        `
                        <div class="empty">
                            目前沒有待辦
                        </div>
                        `
                    }

                </div>

            </div>

        </div>

    `;

}


/* =========================================================
   工作資料列
========================================================= */

function itemRow(item) {

    const project =
        getProject(
            item.projectId
        );


    if (!project)
        return "";


    return `

        <div class="list-row">

            <div class="list-main">

                <strong>
                    ${esc(item.title)}
                </strong>

                <span>

                    ${esc(project.code)}

                    ｜

                    ${esc(project.name)}

                    ・

                    ${formatDate(item.date)}

                    ${item.time || ""}

                    ・

                    ${esc(item.note || "")}

                </span>

            </div>


            <div class="row-actions">

                <span
                    class="tag ${typeClass(item.type)}"
                >
                    ${esc(item.type)}
                </span>


                <button
                    class="mini-btn"
                    onclick="editItem('${item.id}')"
                >
                    ✏️ 編輯
                </button>


                <button
                    class="mini-btn"
                    onclick="shareItem('${item.id}')"
                >
                    📤 分享
                </button>


                <button
                    class="mini-btn"
                    onclick="toggleDone('${item.id}')"
                >
                    ${
                        item.done
                        ?
                        "恢復"
                        :
                        "完成"
                    }
                </button>


                <button
                    class="mini-btn delete"
                    onclick="deleteItem('${item.id}')"
                >
                    🗑️
                </button>

            </div>

        </div>

    `;

}


/* =========================================================
   一般列表
========================================================= */

function renderListPage(
    data,
    title
) {

    app.innerHTML = `

        <div class="project-toolbar">

            <div class="muted">

                ${title}

                共 ${data.length} 筆

            </div>


            <button
                class="btn primary"
                onclick="openItemModal()"
            >
                ＋ 新增
            </button>

        </div>


        <div class="card">

            <div class="list">

                ${
                    data.length
                    ?
                    [...data]
                        .sort(
                            (a, b) =>
                                (a.date || "")
                                .localeCompare(
                                    b.date || ""
                                )
                        )
                        .map(itemRow)
                        .join("")
                    :
                    `
                    <div class="empty">
                        尚無資料
                    </div>
                    `
                }

            </div>

        </div>

    `;

}


/* =========================================================
   案場頁
========================================================= */

function renderProjects() {

    const active =
        projects.filter(
            x =>
                !x.archived
        );


    const archived =
        projects.filter(
            x =>
                x.archived
        );


    app.innerHTML = `

        <div class="project-toolbar">

            <div>

                <strong>
                    案場管理
                </strong>

                <div class="muted">
                    建立一次，之後所有工作都從下拉選單選擇
                </div>

            </div>


            <button
                class="btn primary"
                onclick="openProjectModal()"
            >
                ＋ 新增案場
            </button>

        </div>


        <div class="grid project-grid">

            ${
                active.length
                ?
                active
                    .map(projectCard)
                    .join("")
                :
                `
                <div class="card empty">
                    目前還沒有案場<br>
                    請按「新增案場」建立第一個案場
                </div>
                `
            }

        </div>


        ${
            archived.length
            ?
            `

            <div
                class="card"
                style="margin-top:20px"
            >

                <h3>
                    📦 已封存案場
                </h3>

                <div class="grid project-grid">

                    ${
                        archived
                            .map(projectCard)
                            .join("")
                    }

                </div>

            </div>

            `
            :
            ""
        }

    `;

}


/* =========================================================
   案場卡片
========================================================= */

function projectCard(project) {

    const projectItems =
        items.filter(
            x =>
                String(x.projectId) ===
                String(project.id)
        );


    const done =
        projectItems.filter(
            x =>
                x.done
        ).length;


    const percent =
        projectItems.length
        ?
        done /
        projectItems.length *
        100
        :
        0;


    return `

        <div
            class="
                project-card
                ${project.archived ? "archived" : ""}
            "
        >

            <div class="project-head">

                <div>

                    <div class="project-code">
                        ${esc(project.code)}
                    </div>

                    <h3>
                        ${esc(project.name)}
                    </h3>

                </div>


                <span
                    class="
                        tag
                        ${project.archived
                            ? "gray"
                            : "green"}
                    "
                >

                    ${
                        project.archived
                        ?
                        "已封存"
                        :
                        "進行中"
                    }

                </span>

            </div>


            <div class="project-info">

                📍
                ${esc(project.address || "尚未填寫")}

                <br>

                👤
                ${esc(project.contact || "尚未填寫")}

                ${
                    project.phone
                    ?
                    "｜" +
                    esc(project.phone)
                    :
                    ""
                }

                <br>

                📝
                ${esc(project.note || "無備註")}

            </div>


            <div class="progress">

                <div
                    style="
                        width:${percent}%
                    "
                ></div>

            </div>


            <div class="muted">

                ${projectItems.length}
                筆工作

                ・

                ${done}
                筆完成

            </div>


            <div class="project-actions">

                <button
                    class="mini-btn"
                    onclick="viewProject('${project.id}')"
                >
                    查看
                </button>


                <button
                    class="mini-btn"
                    onclick="editProject('${project.id}')"
                >
                    ✏️ 編輯
                </button>


                <button
                    class="mini-btn archive"
                    onclick="toggleArchive('${project.id}')"
                >

                    ${
                        project.archived
                        ?
                        "恢復"
                        :
                        "封存"
                    }

                </button>


                <button
                    class="mini-btn delete"
                    onclick="deleteProject('${project.id}')"
                >
                    🗑️
                </button>

            </div>

        </div>

    `;

}


/* =========================================================
   查看案場
========================================================= */

function viewProject(id) {

    const project =
        getProject(id);


    if (!project)
        return;


    const projectItems =
        items.filter(
            x =>
                String(x.projectId) ===
                String(id)
        );


    app.innerHTML = `

        <div class="project-toolbar">

            <div>

                <div class="project-code">
                    ${esc(project.code)}
                </div>

                <h2 style="margin:0">
                    ${esc(project.name)}
                </h2>

                <div class="muted">
                    ${esc(project.address || "")}
                </div>

            </div>


            <div>

                <button
                    class="btn"
                    onclick="renderProjects()"
                >
                    ← 返回案場
                </button>


                <button
                    class="btn primary"
                    onclick="openItemModal(null, '${project.id}')"
                >
                    ＋ 新增工作
                </button>

            </div>

        </div>


        <div class="card">

            <h3>
                這個案場的工作
            </h3>


            <div class="list">

                ${
                    projectItems.length
                    ?
                    [...projectItems]
                        .sort(
                            (a, b) =>
                                (a.date || "")
                                .localeCompare(
                                    b.date || ""
                                )
                        )
                        .map(itemRow)
                        .join("")
                    :
                    `
                    <div class="empty">
                        這個案場目前還沒有工作
                    </div>
                    `
                }

            </div>

        </div>

    `;

}


/* =========================================================
   自動案場編號
========================================================= */

function getNextProjectCode() {

    let max = 0;


    projects.forEach(
        function (project) {

            const number =
                parseInt(
                    String(project.code || "")
                        .replace(
                            "A",
                            ""
                        ),
                    10
                );


            if (
                !isNaN(number) &&
                number > max
            ) {

                max =
                    number;

            }

        }
    );


    return (
        "A" +
        String(max + 1)
            .padStart(3, "0")
    );

}


/* =========================================================
   案場新增 / 編輯
========================================================= */

function openProjectModal(id = null) {

    editingProjectId =
        id;


    const modal =
        document.querySelector(
            "#projectModal"
        );


    const title =
        document.querySelector(
            "#projectModalTitle"
        );


    if (!modal)
        return;


    if (id !== null) {

        const project =
            getProject(id);


        if (!project)
            return;


        title.textContent =
            "編輯案場";


        document.querySelector(
            "#projectName"
        ).value =
            project.name || "";


        document.querySelector(
            "#projectAddress"
        ).value =
            project.address || "";


        document.querySelector(
            "#projectContact"
        ).value =
            project.contact || "";


        document.querySelector(
            "#projectPhone"
        ).value =
            project.phone || "";


        document.querySelector(
            "#projectNote"
        ).value =
            project.note || "";

    }

    else {

        title.textContent =
            "新增案場";


        document
            .querySelector(
                "#projectForm"
            )
            .reset();

    }


    modal.classList.remove(
        "hidden"
    );

}


function closeProjectModal() {

    const modal =
        document.querySelector(
            "#projectModal"
        );

    if (modal) {

        modal.classList.add(
            "hidden"
        );

    }

    editingProjectId =
        null;

}


function editProject(id) {

    openProjectModal(id);

}


/* =========================================================
   新增 / 編輯工作
========================================================= */

function openItemModal(
    id = null,
    defaultProjectId = null
) {

    editingItemId =
        id;


    const modal =
        document.querySelector(
            "#itemModal"
        );


    const title =
        document.querySelector(
            "#itemModalTitle"
        );


    const saveButton =
        document.querySelector(
            "#saveItemBtn"
        );


    if (!modal)
        return;


    if (id !== null) {

        const item =
            items.find(
                x =>
                    String(x.id) ===
                    String(id)
            );


        if (!item)
            return;


        populateProjectSelect(
            item.projectId
        );


        title.textContent =
            "編輯資料";


        saveButton.textContent =
            "儲存修改";


        document.querySelector(
            "#itemType"
        ).value =
            item.type || "";


        document.querySelector(
            "#itemProject"
        ).value =
            item.projectId || "";


        document.querySelector(
            "#itemDate"
        ).value =
            item.date || "";


        document.querySelector(
            "#itemTime"
        ).value =
            item.time || "";


        document.querySelector(
            "#itemTitle"
        ).value =
            item.title || "";


        document.querySelector(
            "#itemNote"
        ).value =
            item.note || "";


        document.querySelector(
            "#itemReminder"
        ).value =
            item.reminder || "none";

    }

    else {

        title.textContent =
            "新增資料";


        saveButton.textContent =
            "儲存";


        document
            .querySelector(
                "#itemForm"
            )
            .reset();


        populateProjectSelect(
            defaultProjectId
        );


        document.querySelector(
            "#itemDate"
        ).value =
            isoToday;

    }


    modal.classList.remove(
        "hidden"
    );

}


/* =========================================================
   案場下拉選單
========================================================= */

function populateProjectSelect(
    selectedId = null
) {

    const select =
        document.querySelector(
            "#itemProject"
        );


    const hint =
        document.querySelector(
            "#projectHint"
        );


    if (!select)
        return;


    const activeProjects =
        projects.filter(
            x =>
                !x.archived
        );


    if (
        activeProjects.length ===
        0
    ) {

        select.innerHTML = `

            <option value="">
                尚未建立案場
            </option>

        `;


        if (hint) {

            hint.textContent =
                "請先到「案場」建立案場";

        }

        return;

    }


    if (hint) {

        hint.textContent =
            "請從案場清單選擇，不需要手動輸入";

    }


    select.innerHTML = `

        <option value="">
            請選擇案場
        </option>

        ${
            activeProjects
                .map(
                    p => `

                    <option
                        value="${esc(p.id)}"
                        ${
                            String(selectedId) ===
                            String(p.id)
                            ?
                            "selected"
                            :
                            ""
                        }
                    >

                        ${esc(p.code)}
                        ｜${esc(p.name)}

                    </option>

                    `
                )
                .join("")
        }

    `;

}


/* =========================================================
   關閉工作
========================================================= */

function closeItemModal() {

    const modal =
        document.querySelector(
            "#itemModal"
        );


    if (modal) {

        modal.classList.add(
            "hidden"
        );

    }


    editingItemId =
        null;

}


function editItem(id) {

    openItemModal(id);

}


/* =========================================================
   刪除工作
========================================================= */

async function deleteItem(id) {

    const item =
        items.find(
            x =>
                String(x.id) ===
                String(id)
        );


    if (!item)
        return;


    if (
        !confirm(
            `確定刪除「${item.title}」嗎？`
        )
    )
        return;


    try {

        await deleteDoc(
            doc(
                db,
                "users",
                currentUser.uid,
                "items",
                String(id)
            )
        );


        toast(
            "資料已刪除"
        );

    }

    catch (error) {

        console.error(error);

        toast(
            "刪除失敗"
        );

    }

}


/* =========================================================
   完成 / 恢復
========================================================= */

async function toggleDone(id) {

    const item =
        items.find(
            x =>
                String(x.id) ===
                String(id)
        );


    if (!item)
        return;


    try {

        await updateDoc(
            doc(
                db,
                "users",
                currentUser.uid,
                "items",
                String(id)
            ),
            {
                done:
                    !item.done
            }
        );


        toast(
            item.done
            ?
            "已恢復"
            :
            "已完成"
        );

    }

    catch (error) {

        console.error(error);

        toast(
            "更新失敗"
        );

    }

}


/* =========================================================
   刪除案場
========================================================= */

async function deleteProject(id) {

    const project =
        getProject(id);


    if (!project)
        return;


    const count =
        items.filter(
            x =>
                String(x.projectId) ===
                String(id)
        ).length;


    if (count > 0) {

        alert(
            `這個案場目前還有 ${count} 筆工作資料。\n\n請先保留案場或封存，不建議直接刪除。`
        );

        return;

    }


    if (
        !confirm(
            `確定刪除「${project.name}」嗎？`
        )
    )
        return;


    try {

        await deleteDoc(
            doc(
                db,
                "users",
                currentUser.uid,
                "projects",
                String(id)
            )
        );


        toast(
            "案場已刪除"
        );

    }

    catch (error) {

        console.error(error);

        toast(
            "刪除失敗"
        );

    }

}


/* =========================================================
   封存 / 恢復案場
========================================================= */

async function toggleArchive(id) {

    const project =
        getProject(id);


    if (!project)
        return;


    try {

        await updateDoc(
            doc(
                db,
                "users",
                currentUser.uid,
                "projects",
                String(id)
            ),
            {
                archived:
                    !project.archived
            }
        );


        toast(
            project.archived
            ?
            "案場已恢復"
            :
            "案場已封存"
        );

    }

    catch (error) {

        console.error(error);

        toast(
            "更新失敗"
        );

    }

}


/* =========================================================
   分享
========================================================= */

async function shareItem(id) {

    const item =
        items.find(
            x =>
                String(x.id) ===
                String(id)
        );


    if (!item)
        return;


    const project =
        getProject(
            item.projectId
        );


    const text =
`【${project?.code || ""}｜${project?.name || ""}】

📌 ${item.type}

日期：${formatDate(item.date)}${item.time ? " " + item.time : ""}

內容：${item.title}

${item.note ? "備註：" + item.note : ""}`;


    if (
        navigator.share
    ) {

        try {

            await navigator.share({

                title:
                    `${project?.name || ""}｜${item.type}`,

                text:
                    text

            });

        }

        catch (error) {

            console.log(
                "取消分享"
            );

        }

        return;

    }


    if (
        navigator.clipboard
    ) {

        try {

            await navigator.clipboard.writeText(
                text
            );


            toast(
                "已複製分享內容，可貼到 LINE"
            );

        }

        catch (error) {

            console.error(error);

            prompt(
                "請複製以下內容",
                text
            );

        }

        return;

    }


    prompt(
        "請複製以下內容",
        text
    );

}


/* =========================================================
   行事曆
   電腦版 + 手機版
========================================================= */

function changeCalendarMonth(offset) {

    calendarDate =
        new Date(
            calendarDate.getFullYear(),
            calendarDate.getMonth() + offset,
            1
        );


    renderCalendar(
        filteredItems()
    );

}


function goCalendarToday() {

    calendarDate =
        new Date();


    calendarDate.setDate(1);


    renderCalendar(
        filteredItems()
    );

}


function renderCalendar(data) {

    const year =
        calendarDate.getFullYear();


    const month =
        calendarDate.getMonth();


    const monthTitle =
        `${year} 年 ${month + 1} 月`;


    const firstDay =
        new Date(
            year,
            month,
            1
        ).getDay();


    const daysInMonth =
        new Date(
            year,
            month + 1,
            0
        ).getDate();


    const previousMonthDays =
        new Date(
            year,
            month,
            0
        ).getDate();


    let calendarHTML =
        "";


    /* =====================================
       星期標題
    ===================================== */

    const weekdays = [

        "日",
        "一",
        "二",
        "三",
        "四",
        "五",
        "六"

    ];


    weekdays.forEach(
        day => {

            calendarHTML += `

                <div class="weekday">

                    ${day}

                </div>

            `;

        }
    );


    /* =====================================
       上個月日期
    ===================================== */

    for (
        let i = firstDay - 1;
        i >= 0;
        i--
    ) {

        const day =
            previousMonthDays - i;


        calendarHTML += `

            <div class="day other-month">

                <div class="day-num">
                    ${day}
                </div>

            </div>

        `;

    }


    /* =====================================
       本月份日期
    ===================================== */

    for (
        let day = 1;
        day <= daysInMonth;
        day++
    ) {

        const date =
            `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;


        const events =
            data.filter(
                item =>
                    item.date === date
            );


        const isToday =
            date === isoToday;


        calendarHTML += `

            <div
                class="
                    day
                    ${isToday ? "today" : ""}
                "
            >

                <div class="day-num">

                    <span>
                        ${day}
                    </span>

                    ${
                        events.length
                        ?
                        `
                        <span class="day-count">
                            ${events.length}
                        </span>
                        `
                        :
                        ""
                    }

                </div>


                <div class="day-events">

                    ${
                        events
                            .map(
                                item => {

                                    return `

                                        <div
                                            class="
                                                event
                                                ${typeClass(item.type)}
                                            "
                                            onclick="editItem('${item.id}')"
                                            title="${esc(item.title)}"
                                        >

                                            ${
                                                item.time
                                                ?
                                                `<span>${esc(item.time)}</span>`
                                                :
                                                ""
                                            }

                                            <strong>
                                                ${esc(item.title)}
                                            </strong>

                                        </div>

                                    `;

                                }
                            )
                            .join("")
                    }

                </div>

            </div>

        `;

    }


    /* =====================================
       下個月日期
    ===================================== */

    const totalCells =
        firstDay +
        daysInMonth;


    const remainingCells =
        Math.ceil(
            totalCells / 7
        ) * 7 -
        totalCells;


    for (
        let day = 1;
        day <= remainingCells;
        day++
    ) {

        calendarHTML += `

            <div class="day other-month">

                <div class="day-num">
                    ${day}
                </div>

            </div>

        `;

    }


    /* =====================================
       判斷目前月份
    ===================================== */

    const currentMonth =
        new Date();


    const isCurrentMonth =
        currentMonth.getFullYear() === year &&
        currentMonth.getMonth() === month;


    /* =====================================
       畫面
    ===================================== */

    app.innerHTML = `

        <div class="calendar-page">


            <div class="calendar-toolbar">


                <div class="calendar-title">


                    <button
                        class="calendar-nav-btn"
                        onclick="changeCalendarMonth(-1)"
                        aria-label="上一個月"
                    >
                        ‹
                    </button>


                    <div>

                        <h2>
                            ${monthTitle}
                        </h2>


                        <div class="muted">

                            ${
                                isCurrentMonth
                                ?
                                "目前月份"
                                :
                                "月份行事曆"
                            }

                        </div>

                    </div>


                    <button
                        class="calendar-nav-btn"
                        onclick="changeCalendarMonth(1)"
                        aria-label="下一個月"
                    >
                        ›
                    </button>


                </div>


                <button
                    class="
                        btn
                        calendar-today-btn
                    "
                    onclick="goCalendarToday()"
                >

                    📍 今天

                </button>


            </div>


            <div class="calendar-card">


                <div class="calendar">

                    ${calendarHTML}

                </div>


            </div>


            <div class="calendar-hint">

                <span>
                    點擊工作可以直接編輯
                </span>

                <span>
                    共 ${data.length} 筆資料
                </span>

            </div>


        </div>

    `;

}


/* =========================================================
   工作表單
========================================================= */

const itemForm =
    document.querySelector(
        "#itemForm"
    );


if (itemForm) {

    itemForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const projectId =
                document.querySelector(
                    "#itemProject"
                ).value;


            if (!projectId) {

                alert(
                    "請先選擇案場。"
                );

                return;

            }


            const data = {

                projectId:
                    String(projectId),

                type:
                    document.querySelector(
                        "#itemType"
                    ).value,

                date:
                    document.querySelector(
                        "#itemDate"
                    ).value,

                time:
                    document.querySelector(
                        "#itemTime"
                    ).value,

                title:
                    document.querySelector(
                        "#itemTitle"
                    ).value.trim(),

                note:
                    document.querySelector(
                        "#itemNote"
                    ).value.trim(),

                reminder:
                    document.querySelector(
                        "#itemReminder"
                    ).value,

                done:
                    false

            };


            if (!data.title) {

                alert(
                    "請輸入工作內容。"
                );

                return;

            }


            try {

                if (
                    editingItemId !==
                    null
                ) {

                    const oldItem =
                        items.find(
                            x =>
                                String(x.id) ===
                                String(editingItemId)
                        );


                    await updateDoc(
                        doc(
                            db,
                            "users",
                            currentUser.uid,
                            "items",
                            String(editingItemId)
                        ),
                        {
                            ...data,

                            done:
                                oldItem?.done ||
                                false
                        }
                    );


                    toast(
                        "資料已修改"
                    );

                }

                else {

                    await addDoc(
                        userCollection("items"),
                        data
                    );


                    toast(
                        "資料已新增"
                    );

                }


                closeItemModal();

            }

            catch (error) {

                console.error(
                    "資料儲存失敗:",
                    error
                );

                toast(
                    "資料儲存失敗"
                );

            }

        }
    );

}


/* =========================================================
   案場表單
========================================================= */

const projectForm =
    document.querySelector(
        "#projectForm"
    );


if (projectForm) {

    projectForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const name =
                document.querySelector(
                    "#projectName"
                ).value.trim();


            const address =
                document.querySelector(
                    "#projectAddress"
                ).value.trim();


            const contact =
                document.querySelector(
                    "#projectContact"
                ).value.trim();


            const phone =
                document.querySelector(
                    "#projectPhone"
                ).value.trim();


            const note =
                document.querySelector(
                    "#projectNote"
                ).value.trim();


            if (!name) {

                alert(
                    "請輸入案場名稱。"
                );

                return;

            }


            try {

                if (
                    editingProjectId !==
                    null
                ) {

                    const oldProject =
                        getProject(
                            editingProjectId
                        );


                    await updateDoc(
                        doc(
                            db,
                            "users",
                            currentUser.uid,
                            "projects",
                            String(editingProjectId)
                        ),
                        {

                            name,

                            address,

                            contact,

                            phone,

                            note,

                            archived:
                                oldProject?.archived ||
                                false

                        }
                    );


                    toast(
                        "案場資料已修改"
                    );

                }

                else {

                    const newProject = {

                        code:
                            getNextProjectCode(),

                        name,

                        address,

                        contact,

                        phone,

                        note,

                        archived:
                            false

                    };


                    await addDoc(
                        userCollection("projects"),
                        newProject
                    );


                    toast(
                        `案場 ${newProject.code} 已建立`
                    );

                }


                closeProjectModal();

            }

            catch (error) {

                console.error(
                    "案場儲存失敗:",
                    error
                );

                toast(
                    "案場儲存失敗"
                );

            }

        }
    );

}


/* =========================================================
   選單
========================================================= */

const nav =
    document.querySelector(
        "#nav"
    );


if (nav) {

    nav.addEventListener(
        "click",
        function (event) {

            const button =
                event.target.closest(
                    ".nav-item"
                );


            if (!button)
                return;


            currentPage =
                button.dataset.page;


            render();

        }
    );

}


/* =========================================================
   快速新增
========================================================= */

const quickAddBtn =
    document.querySelector(
        "#quickAddBtn"
    );


if (quickAddBtn) {

    quickAddBtn.onclick =
        function () {

            openItemModal();

        };

}


const headerAddBtn =
    document.querySelector(
        "#headerAddBtn"
    );


if (headerAddBtn) {

    headerAddBtn.onclick =
        function () {

            openItemModal();

        };

}


/* =========================================================
   關閉工作 Modal
========================================================= */

const closeItemBtn =
    document.querySelector(
        "#closeItemModal"
    );


if (closeItemBtn) {

    closeItemBtn.onclick =
        closeItemModal;

}


const cancelItemBtn =
    document.querySelector(
        "#cancelItemModal"
    );


if (cancelItemBtn) {

    cancelItemBtn.onclick =
        closeItemModal;

}


/* =========================================================
   關閉案場 Modal
========================================================= */

const closeProjectBtn =
    document.querySelector(
        "#closeProjectModal"
    );


if (closeProjectBtn) {

    closeProjectBtn.onclick =
        closeProjectModal;

}


const cancelProjectBtn =
    document.querySelector(
        "#cancelProjectModal"
    );


if (cancelProjectBtn) {

    cancelProjectBtn.onclick =
        closeProjectModal;

}


/* =========================================================
   背景點擊關閉 Modal
========================================================= */

const itemModal =
    document.querySelector(
        "#itemModal"
    );


if (itemModal) {

    itemModal.addEventListener(
        "click",
        function (event) {

            if (
                event.target.id ===
                "itemModal"
            ) {

                closeItemModal();

            }

        }
    );

}


const projectModal =
    document.querySelector(
        "#projectModal"
    );


if (projectModal) {

    projectModal.addEventListener(
        "click",
        function (event) {

            if (
                event.target.id ===
                "projectModal"
            ) {

                closeProjectModal();

            }

        }
    );

}


/* =========================================================
   搜尋
========================================================= */

const searchInput =
    document.querySelector(
        "#searchInput"
    );


if (searchInput) {

    searchInput.addEventListener(
        "input",
        render
    );

}


/* =========================================================
   全域函式
   HTML onclick 需要
========================================================= */

window.editItem =
    editItem;

window.deleteItem =
    deleteItem;

window.toggleDone =
    toggleDone;

window.shareItem =
    shareItem;

window.openItemModal =
    openItemModal;

window.renderProjects =
    renderProjects;

window.viewProject =
    viewProject;

window.openProjectModal =
    openProjectModal;

window.editProject =
    editProject;

window.deleteProject =
    deleteProject;

window.toggleArchive =
    toggleArchive;


/* =========================================================
   行事曆全域函式
========================================================= */

window.changeCalendarMonth =
    changeCalendarMonth;

window.goCalendarToday =
    goCalendarToday;


/* =========================================================
   初始化
========================================================= */

console.log(
    "YAO V4.1 Firebase 系統已啟動"
);