/* =========================================================
   YAO V5.0
   Firebase 雲端版
   消防工程行政管理
   app.js

   本版本重點：

   1. Firebase Email / Password 登入
   2. Firestore 雲端資料
   3. 案場管理
   4. 工作管理
   5. 行事曆
   6. 工作完成 / 恢復
   7. 工作分享
   8. 提醒中心
   9. 提前 N 天提醒
   10. 提前 1 小時提醒
   11. 到時間中央 Popup 提醒
   12. 「我知道了」後才記錄為已確認
   13. 多個提醒自動排隊
   14. 每 30 秒自動檢查
   15. 回到網頁 / 網頁取得焦點時重新檢查
   16. 不依賴 HTML 是否原本存在 reminderPopup
   17. 不修改 Firebase Authentication 帳號資料
   18. 不修改原本 Firestore 使用者資料結構
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
   ※ 保留原本設定，不修改
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

let projectsReady = false;

let itemsReady = false;


/* =========================================================
   行事曆
   ========================================================= */

let calendarDate = new Date();

calendarDate.setDate(1);


/* =========================================================
   提醒系統
   ========================================================= */

let reminderCheckTimer = null;

let reminderInitialCheckTimer = null;

let reminderPopupQueue = [];

let reminderPopupShowing = false;


/*
 * 提醒「已確認」紀錄。
 *
 * 注意：
 *
 * 以前版本是在「準備顯示 Popup」時
 * 就寫入 localStorage。
 *
 * 如果 Popup 因為某些原因沒有成功顯示，
 * 這樣會造成：
 *
 * 「系統以為你看過了」
 *
 * 但其實你根本沒有看到。
 *
 * V5 改成：
 *
 * 只有按下「我知道了」
 * 才會真正寫入已確認紀錄。
 */

const REMINDER_STORAGE_KEY =
    "YAO_REMINDER_ACK_V3";


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


let isoToday =
    getTodayISO();


/* =========================================================
   日期工具
   ========================================================= */

function addDays(number) {

    const d =
        new Date();

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


function addDaysFromISO(
    isoDate,
    amount
) {

    const parts =
        String(isoDate)
            .split("-")
            .map(Number);

    if (
        parts.length !== 3 ||
        parts.some(
            Number.isNaN
        )
    ) {

        return isoDate;

    }


    const date =
        new Date(
            parts[0],
            parts[1] - 1,
            parts[2]
        );


    date.setDate(
        date.getDate() + amount
    );


    return `${date.getFullYear()}-${String(
        date.getMonth() + 1
    ).padStart(2, "0")}-${String(
        date.getDate()
    ).padStart(2, "0")}`;
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

            box.classList.remove("show");

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
   登入
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
   登入錯誤
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


            console.log(
                "YAO：登入成功",
                currentUser.uid
            );


            loginScreen.classList.add(
                "hidden"
            );


            system.classList.remove(
                "hidden"
            );


            /*
             * 先建立提醒 UI
             */

            ensureReminderUI();


            /*
             * 建立提醒中心按鈕
             */

            ensureReminderNav();


            /*
             * 啟動提醒檢查
             */

            startReminderChecker();


            /*
             * 啟動 Firebase 即時資料
             */

            await startRealtimeData();

        }

        else {

            currentUser =
                null;


            stopRealtimeData();

            stopReminderChecker();


            reminderPopupQueue = [];

            closeReminderPopup(true);


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
   建立即時資料
   ========================================================= */

async function startRealtimeData() {

    dataReady = false;

    projectsReady = false;

    itemsReady = false;

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


                projectsReady = true;

                console.log(
                    "YAO：案場資料同步完成",
                    projects.length
                );


                updateDataReady();

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


                itemsReady = true;

                console.log(
                    "YAO：工作資料同步完成",
                    items.length
                );


                updateDataReady();

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
   確認兩個 Firebase collection 都完成
   ========================================================= */

function updateDataReady() {

    if (
        projectsReady &&
        itemsReady
    ) {

        dataReady = true;

        console.log(
            "YAO：Firebase 資料全部準備完成"
        );


        render();


        /*
         * Firebase 資料完成後
         * 立即檢查提醒。
         */

        checkDueReminders();

    }

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

    projectsReady = false;

    itemsReady = false;

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


    ensureReminderNav();


    const titles = {

        dashboard:
            "儀表板",

        calendar:
            "行事曆",

        projects:
            "案場",

        logistics:
            "進料 / 出貨",

        people:
            "人員安排",

        inspection:
            "查驗",

        records:
            "工作紀錄",

        reminders:
            "提醒中心"

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


    if (
        currentPage ===
        "reminders"
    )
        renderReminders();

}


/* =========================================================
   切換頁面
   ========================================================= */

function goToPage(page) {

    if (!page)
        return;


    currentPage =
        page;


    render();

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
                x.date >= isoToday &&
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


            <div
                class="stat"
                style="cursor:pointer"
                onclick="goToPage('reminders')"
            >

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

                    ${esc(item.time || "")}

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


        const oneHour =
            document.querySelector(
                "#itemOneHourReminder"
            );


        if (oneHour) {

            oneHour.checked =
                item.reminderOneHour === true;

        }

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


        const oneHour =
            document.querySelector(
                "#itemOneHourReminder"
            );


        if (oneHour) {

            oneHour.checked =
                false;

        }

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


        clearReminderHistoryForItem(id);


        reminderPopupQueue =
            reminderPopupQueue.filter(
                row =>
                    String(row.item.id) !==
                    String(id)
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


/* =========================================================
   行事曆
   ========================================================= */

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


    for (
        let i = firstDay - 1;
        i >= 0;
        i--
    ) {

        const day =
            previousMonthDays - i;


        calendarHTML += `

            <div class="day other-month">

                <div
                    class="day-num"
                    style="
                        display:flex;
                        align-items:center;
                        justify-content:space-between;
                        gap:8px;
                    "
                >

                    <span class="day-number">
                        ${day}
                    </span>

                </div>

            </div>

        `;

    }


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


        const eventCountHTML =
            events.length > 0
            ?
            `
            <span
                class="day-count"
                style="
                    display:inline-flex;
                    align-items:center;
                    justify-content:center;
                    min-width:20px;
                    height:20px;
                    padding:0 5px;
                    margin-left:auto;
                    border-radius:10px;
                    font-size:12px;
                    line-height:20px;
                    flex-shrink:0;
                "
            >
                ${events.length}
            </span>
            `
            :
            "";


        calendarHTML += `

            <div
                class="
                    day
                    ${isToday ? "today" : ""}
                "
            >

                <div
                    class="day-num"
                    style="
                        display:flex;
                        align-items:center;
                        width:100%;
                        min-height:24px;
                        gap:8px;
                        box-sizing:border-box;
                    "
                >

                    <span
                        class="day-number"
                        style="
                            display:inline-block;
                            flex:0 0 auto;
                            line-height:24px;
                            white-space:nowrap;
                        "
                    >
                        ${day}
                    </span>

                    ${eventCountHTML}

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

                <div
                    class="day-num"
                    style="
                        display:flex;
                        align-items:center;
                    "
                >

                    <span class="day-number">
                        ${day}
                    </span>

                </div>

            </div>

        `;

    }


    const currentMonth =
        new Date();


    const isCurrentMonth =
        currentMonth.getFullYear() === year &&
        currentMonth.getMonth() === month;


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
   提醒：
   取得實際提醒時間
   ========================================================= */

function getReminderTimes(item) {

    const result = [];


    if (
        !item ||
        !item.date
    )
        return result;


    const workTime =
        item.time || "09:00";


    const reminderBefore =
        item.reminder || "none";


    /*
     * 第一階段
     * 提前 N 天
     */

    if (
        reminderBefore !== "none"
    ) {

        const days =
            parseInt(
                reminderBefore,
                10
            );


        if (
            !isNaN(days) &&
            days > 0
        ) {

            result.push({

                stage: 1,

                date:
                    addDaysFromISO(
                        item.date,
                        -days
                    ),

                time:
                    workTime,

                label:
                    `提前 ${days} 天`

            });

        }

    }


    /*
     * 第二階段
     * 提前 1 小時
     */

    if (
        item.reminderOneHour === true
    ) {

        const oneHour =
            subtractOneHour(
                item.date,
                workTime
            );


        result.push({

            stage: 2,

            date:
                oneHour.date,

            time:
                oneHour.time,

            label:
                "提前 1 小時"

        });

    }


    return result;

}


/* =========================================================
   扣除一小時
   ========================================================= */

function subtractOneHour(
    isoDate,
    time
) {

    const safeTime =
        time || "09:00";


    const parts =
        safeTime
            .split(":")
            .map(Number);


    let hour =
        Number.isFinite(parts[0])
        ?
        parts[0]
        :
        9;


    let minute =
        Number.isFinite(parts[1])
        ?
        parts[1]
        :
        0;


    let date =
        isoDate;


    minute -= 60;


    if (minute < 0) {

        minute += 60;

        hour -= 1;

    }


    if (hour < 0) {

        hour += 24;

        date =
            addDaysFromISO(
                isoDate,
                -1
            );

    }


    return {

        date,

        time:
            `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`

    };

}


/* =========================================================
   建立提醒資料
   ========================================================= */

function buildReminderRows() {

    const rows = [];


    items.forEach(
        item => {

            if (
                item.done ||
                !item.date
            )
                return;


            const project =
                getProject(
                    item.projectId
                );


            const reminderTimes =
                getReminderTimes(
                    item
                );


            reminderTimes.forEach(
                reminder => {

                    rows.push({

                        item,

                        project,

                        ...reminder

                    });

                }
            );

        }
    );


    rows.sort(
        (a, b) => {

            const aKey =
                `${a.date} ${a.time}`;

            const bKey =
                `${b.date} ${b.time}`;

            return aKey.localeCompare(
                bKey
            );

        }
    );


    return rows;

}


/* =========================================================
   提醒中心
   ========================================================= */

function renderReminders() {

    const rows =
        buildReminderRows();


    const todayRows =
        rows.filter(
            row =>
                row.date ===
                isoToday
        );


    const futureRows =
        rows.filter(
            row =>
                row.date >
                isoToday
        );


    const overdueRows =
        rows.filter(
            row =>
                row.date <
                isoToday
        );


    app.innerHTML = `

        <div class="project-toolbar">

            <div>

                <strong>
                    🔔 提醒中心
                </strong>

                <div class="muted">
                    集中查看目前需要注意的工作提醒
                </div>

            </div>

        </div>


        ${
            todayRows.length
            ?
            `

            <div class="card">

                <h3>
                    🔴 今天提醒
                </h3>

                <div class="list">

                    ${
                        todayRows
                            .map(
                                reminderRow
                            )
                            .join("")
                    }

                </div>

            </div>

            `
            :
            `
            <div class="card">

                <h3>
                    今天提醒
                </h3>

                <div class="empty">
                    今天目前沒有提醒
                </div>

            </div>
            `
        }


        <div
            class="card"
            style="margin-top:16px"
        >

            <h3>
                📅 即將提醒
            </h3>

            <div class="list">

                ${
                    futureRows.length
                    ?
                    futureRows
                        .slice(0, 30)
                        .map(
                            reminderRow
                        )
                        .join("")
                    :
                    `
                    <div class="empty">
                        目前沒有即將到期的提醒
                    </div>
                    `
                }

            </div>

        </div>


        ${
            overdueRows.length
            ?
            `

            <div
                class="card"
                style="margin-top:16px"
            >

                <h3>
                    ⚠️ 已經過提醒時間
                </h3>

                <div class="list">

                    ${
                        overdueRows
                            .slice(-20)
                            .map(
                                reminderRow
                            )
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
   提醒資料列
   ========================================================= */

function reminderRow(row) {

    const item =
        row.item;


    const project =
        row.project;


    if (!project)
        return "";


    const isToday =
        row.date ===
        isoToday;


    const dateText =
        isToday
        ?
        "今天"
        :
        formatDate(
            row.date
        );


    return `

        <div class="list-row">

            <div class="list-main">

                <strong>

                    ${
                        row.stage === 2
                        ?
                        "⏰ "
                        :
                        "🔔 "
                    }

                    ${esc(item.title)}

                </strong>

                <span>

                    ${esc(project.code)}
                    ｜${esc(project.name)}

                    ・

                    ${dateText}

                    ${esc(row.time)}

                    ・

                    ${esc(row.label)}

                </span>

            </div>


            <div class="row-actions">

                <span
                    class="
                        tag
                        ${row.stage === 2
                            ? "orange"
                            : "blue"}
                    "
                >
                    ${esc(row.label)}
                </span>


                <button
                    class="mini-btn"
                    onclick="editItem('${item.id}')"
                >
                    ✏️ 查看
                </button>

            </div>

        </div>

    `;

}


/* =========================================================
   讀取「已確認提醒」
   ========================================================= */

function getAcknowledgedReminderKeys() {

    try {

        const raw =
            localStorage.getItem(
                REMINDER_STORAGE_KEY
            );


        if (!raw)
            return {};


        const parsed =
            JSON.parse(raw);


        if (
            parsed &&
            typeof parsed === "object"
        ) {

            return parsed;

        }

    }

    catch (error) {

        console.error(
            "提醒確認紀錄讀取失敗:",
            error
        );

    }


    return {};

}


/* =========================================================
   記錄提醒「我知道了」
   ========================================================= */

function acknowledgeReminder(key) {

    const acknowledged =
        getAcknowledgedReminderKeys();


    acknowledged[key] =
        Date.now();


    /*
     * 清理超過 30 天的紀錄
     */

    const limit =
        Date.now() -
        (
            30 *
            24 *
            60 *
            60 *
            1000
        );


    Object.keys(acknowledged)
        .forEach(
            oldKey => {

                if (
                    acknowledged[oldKey] <
                    limit
                ) {

                    delete acknowledged[oldKey];

                }

            }
        );


    try {

        localStorage.setItem(
            REMINDER_STORAGE_KEY,
            JSON.stringify(
                acknowledged
            )
        );


        console.log(
            "YAO：提醒已確認",
            key
        );

    }

    catch (error) {

        console.error(
            "提醒確認紀錄儲存失敗:",
            error
        );

    }

}


/* =========================================================
   提醒唯一 ID
   ========================================================= */

function getReminderKey(row) {

    return [

        currentUser?.uid ||
            "guest",

        row.item.id,

        row.stage,

        row.date,

        row.time

    ].join("|");

}


/* =========================================================
   判斷提醒是否到時間
   ========================================================= */

function isReminderDue(row) {

    const now =
        new Date();


    const currentDate =
        getTodayISO();


    /*
     * 只處理今天的提醒。
     */

    if (
        row.date !==
        currentDate
    ) {

        return false;

    }


    const timeParts =
        String(
            row.time || "09:00"
        )
            .split(":")
            .map(Number);


    const reminderHour =
        Number.isFinite(
            timeParts[0]
        )
        ?
        timeParts[0]
        :
        9;


    const reminderMinute =
        Number.isFinite(
            timeParts[1]
        )
        ?
        timeParts[1]
        :
        0;


    const reminderTime =
        new Date();


    reminderTime.setHours(
        reminderHour,
        reminderMinute,
        0,
        0
    );


    /*
     * 到時間後就算到期。
     */

    return now >= reminderTime;

}


/* =========================================================
   檢查目前提醒
   ========================================================= */

function checkDueReminders() {

    if (!currentUser) {

        console.log(
            "YAO 提醒檢查：尚未登入"
        );

        return;

    }


    if (!dataReady) {

        console.log(
            "YAO 提醒檢查：Firebase 資料尚未完成"
        );

        return;

    }


    isoToday =
        getTodayISO();


    const rows =
        buildReminderRows();


    const acknowledged =
        getAcknowledgedReminderKeys();


    const dueRows =
        rows.filter(
            row => {

                const key =
                    getReminderKey(
                        row
                    );


                /*
                 * 如果使用者已經按過
                 * 「我知道了」
                 * 就永遠不再加入 Queue。
                 */

                if (
                    acknowledged[key]
                ) {

                    return false;

                }


                return isReminderDue(
                    row
                );

            }
        );


    console.log(
        "YAO 提醒檢查：",
        {
            now:
                new Date().toLocaleString(),

            today:
                isoToday,

            totalReminderRows:
                rows.length,

            dueRows:
                dueRows.length,

            queue:
                reminderPopupQueue.length

        }
    );


    if (
        dueRows.length === 0
    ) {

        return;

    }


    dueRows.forEach(
        row => {

            const key =
                getReminderKey(
                    row
                );


            /*
             * 注意：
             *
             * 這裡「不」寫 localStorage。
             *
             * 必須等使用者真的按
             * 「我知道了」
             * 才算已確認。
             */


            const alreadyQueued =
                reminderPopupQueue.some(
                    queued =>
                        getReminderKey(
                            queued
                        ) === key
                );


            if (
                alreadyQueued
            ) {

                return;

            }


            /*
             * 如果現在正在顯示這一則
             * 也不要再次加入。
             */

            if (
                reminderPopupShowing &&
                reminderPopupCurrentRow
            ) {

                if (
                    getReminderKey(
                        reminderPopupCurrentRow
                    ) === key
                ) {

                    return;

                }

            }


            reminderPopupQueue.push(
                row
            );

        }
    );


    showNextReminderPopup();

}


/* =========================================================
   目前正在顯示哪一筆提醒
   ========================================================= */

let reminderPopupCurrentRow =
    null;


/* =========================================================
   啟動提醒檢查器
   ========================================================= */

function startReminderChecker() {

    stopReminderChecker();


    /*
     * 登入後稍微等一下
     * 再做第一次檢查。
     */

    reminderInitialCheckTimer =
        setTimeout(
            () => {

                checkDueReminders();

            },
            1000
        );


    /*
     * 每 30 秒檢查一次。
     */

    reminderCheckTimer =
        setInterval(
            () => {

                isoToday =
                    getTodayISO();


                checkDueReminders();

            },
            30000
        );


    console.log(
        "YAO：提醒檢查器已啟動"
    );

}


/* =========================================================
   停止提醒檢查器
   ========================================================= */

function stopReminderChecker() {

    if (
        reminderInitialCheckTimer
    ) {

        clearTimeout(
            reminderInitialCheckTimer
        );


        reminderInitialCheckTimer =
            null;

    }


    if (
        reminderCheckTimer
    ) {

        clearInterval(
            reminderCheckTimer
        );


        reminderCheckTimer =
            null;

    }


    console.log(
        "YAO：提醒檢查器已停止"
    );

}


/* =========================================================
   網頁重新取得焦點
   ========================================================= */

window.addEventListener(
    "focus",
    function () {

        if (
            currentUser &&
            dataReady
        ) {

            console.log(
                "YAO：網頁重新取得焦點，重新檢查提醒"
            );


            checkDueReminders();

        }

    }
);


/* =========================================================
   網頁從背景回來
   ========================================================= */

document.addEventListener(
    "visibilitychange",
    function () {

        if (
            document.visibilityState ===
            "visible"
        ) {

            if (
                currentUser &&
                dataReady
            ) {

                console.log(
                    "YAO：網頁重新顯示，重新檢查提醒"
                );


                isoToday =
                    getTodayISO();


                checkDueReminders();

            }

        }

    }
);


/* =========================================================
   自動建立提醒中心
   ========================================================= */

function ensureReminderNav() {

    const nav =
        document.querySelector(
            "#nav"
        );


    if (!nav)
        return;


    let button =
        nav.querySelector(
            '.nav-item[data-page="reminders"]'
        );


    if (button)
        return;


    /*
     * 自動建立提醒中心按鈕
     */

    button =
        document.createElement(
            "button"
        );


    button.className =
        "nav-item";


    button.dataset.page =
        "reminders";


    button.type =
        "button";


    button.innerHTML = `

        <span>
            🔔
        </span>

        <span>
            提醒中心
        </span>

    `;


    nav.appendChild(
        button
    );


    console.log(
        "YAO：提醒中心按鈕已建立"
    );

}


/* =========================================================
   自動建立提醒 Popup
   ========================================================= */

function ensureReminderUI() {

    /*
     * 如果已經存在
     * 就不要重複建立。
     */

    if (
        document.querySelector(
            "#reminderPopup"
        )
    ) {

        return;

    }


    /*
     * 建立 CSS
     */

    const style =
        document.createElement(
            "style"
        );


    style.id =
        "yao-reminder-style";


    style.textContent = `

        #reminderPopup {

            position:fixed;

            inset:0;

            z-index:99999;

            display:flex;

            align-items:center;

            justify-content:center;

            padding:20px;

            background:
                rgba(0,0,0,.68);

            backdrop-filter:
                blur(5px);

        }


        #reminderPopup.hidden {

            display:none;

        }


        .yao-reminder-box {

            width:
                min(560px, 100%);

            max-height:
                calc(100vh - 40px);

            overflow:auto;

            background:
                #ffffff;

            color:
                #111827;

            border-radius:
                24px;

            box-shadow:
                0 30px 80px
                rgba(0,0,0,.35);

            overflow:hidden;

            animation:
                yaoReminderIn
                .25s ease;

        }


        .yao-reminder-top {

            padding:
                24px 26px;

            background:
                linear-gradient(
                    135deg,
                    #dc2626,
                    #b91c1c
                );

            color:#fff;

        }


        .yao-reminder-title {

            font-size:
                25px;

            font-weight:
                800;

            margin:0;

        }


        .yao-reminder-stage {

            margin-top:
                8px;

            font-size:
                14px;

            opacity:.92;

        }


        .yao-reminder-body {

            padding:
                26px;

        }


        .yao-reminder-project {

            font-size:
                15px;

            font-weight:
                700;

            color:
                #6b7280;

            margin-bottom:
                12px;

        }


        .yao-reminder-content {

            font-size:
                25px;

            font-weight:
                800;

            line-height:
                1.45;

            margin-bottom:
                20px;

        }


        .yao-reminder-time {

            padding:
                14px 16px;

            background:
                #f3f4f6;

            border-radius:
                12px;

            font-size:
                15px;

            color:
                #374151;

        }


        .yao-reminder-note {

            margin-top:
                14px;

            padding:
                14px 16px;

            background:
                #fff7ed;

            border-radius:
                12px;

            color:
                #7c2d12;

            line-height:
                1.6;

        }


        .yao-reminder-actions {

            margin-top:
                22px;

            display:flex;

            justify-content:flex-end;

            gap:10px;

        }


        #reminderPopupClose {

            border:0;

            border-radius:
                12px;

            padding:
                13px 25px;

            background:
                #111827;

            color:#fff;

            font-size:
                16px;

            font-weight:
                700;

            cursor:pointer;

            min-width:
                120px;

        }


        #reminderPopupClose:hover {

            opacity:.9;

        }


        #reminderPopupClose:focus {

            outline:
                3px solid
                rgba(59,130,246,.35);

            outline-offset:
                2px;

        }


        @keyframes yaoReminderIn {

            from {

                opacity:0;

                transform:
                    translateY(20px)
                    scale(.96);

            }

            to {

                opacity:1;

                transform:
                    translateY(0)
                    scale(1);

            }

        }


        body.reminder-popup-open {

            overflow:hidden;

        }


        @media (max-width:600px) {

            #reminderPopup {

                padding:
                    12px;

            }


            .yao-reminder-box {

                border-radius:
                    18px;

            }


            .yao-reminder-top {

                padding:
                    20px;

            }


            .yao-reminder-body {

                padding:
                    20px;

            }


            .yao-reminder-title {

                font-size:
                    22px;

            }


            .yao-reminder-content {

                font-size:
                    22px;

            }


            #reminderPopupClose {

                width:
                    100%;

            }

        }

    `;


    document.head.appendChild(
        style
    );


    /*
     * 建立 Popup
     */

    const popup =
        document.createElement(
            "div"
        );


    popup.id =
        "reminderPopup";


    popup.className =
        "hidden";


    popup.innerHTML = `

        <div
            class="yao-reminder-box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reminderPopupTitle"
        >

            <div
                class="yao-reminder-top"
            >

                <h2
                    id="reminderPopupTitle"
                    class="yao-reminder-title"
                >
                    🔔 工作提醒
                </h2>


                <div
                    id="reminderPopupStage"
                    class="yao-reminder-stage"
                >
                    工作提醒
                </div>

            </div>


            <div
                class="yao-reminder-body"
            >

                <div
                    id="reminderPopupProject"
                    class="yao-reminder-project"
                >
                    案場
                </div>


                <div
                    id="reminderPopupContent"
                    class="yao-reminder-content"
                >
                    工作內容
                </div>


                <div
                    id="reminderPopupTime"
                    class="yao-reminder-time"
                >
                    工作時間
                </div>


                <div
                    id="reminderPopupNote"
                    class="yao-reminder-note"
                >
                    備註
                </div>


                <div
                    class="yao-reminder-actions"
                >

                    <button
                        id="reminderPopupClose"
                        type="button"
                    >
                        我知道了
                    </button>

                </div>

            </div>

        </div>

    `;


    document.body.appendChild(
        popup
    );


    /*
     * 關閉按鈕
     */

    const closeButton =
        document.querySelector(
            "#reminderPopupClose"
        );


    if (closeButton) {

        closeButton.onclick =
            acknowledgeAndCloseReminder;

    }


    /*
     * 點擊黑色背景也關閉。
     *
     * 但背景關閉也會視為
     * 「我知道了」。
     */

    popup.addEventListener(
        "click",
        function (event) {

            if (
                event.target ===
                popup
            ) {

                acknowledgeAndCloseReminder();

            }

        }
    );


    console.log(
        "YAO：提醒 Popup UI 已建立"
    );

}


/* =========================================================
   顯示下一個提醒
   ========================================================= */

function showNextReminderPopup() {

    if (
        reminderPopupShowing
    )
        return;


    if (
        reminderPopupQueue.length ===
        0
    )
        return;


    const row =
        reminderPopupQueue.shift();


    showReminderPopup(
        row
    );

}


/* =========================================================
   顯示提醒 Popup
   ========================================================= */

function showReminderPopup(row) {

    ensureReminderUI();


    const backdrop =
        document.querySelector(
            "#reminderPopup"
        );


    const title =
        document.querySelector(
            "#reminderPopupTitle"
        );


    const projectBox =
        document.querySelector(
            "#reminderPopupProject"
        );


    const contentBox =
        document.querySelector(
            "#reminderPopupContent"
        );


    const timeBox =
        document.querySelector(
            "#reminderPopupTime"
        );


    const stageBox =
        document.querySelector(
            "#reminderPopupStage"
        );


    const noteBox =
        document.querySelector(
            "#reminderPopupNote"
        );


    const closeButton =
        document.querySelector(
            "#reminderPopupClose"
        );


    if (
        !backdrop ||
        !title ||
        !projectBox ||
        !contentBox ||
        !timeBox ||
        !stageBox ||
        !noteBox
    ) {

        console.error(
            "YAO：提醒視窗建立失敗"
        );


        /*
         * 如果 UI 建立失敗，
         * 不要把提醒標記成已確認。
         *
         * 放回 Queue。
         */

        reminderPopupQueue.unshift(
            row
        );


        return;

    }


    const project =
        row.project;


    reminderPopupCurrentRow =
        row;


    reminderPopupShowing =
        true;


    /*
     * 標題
     */

    title.textContent =
        row.stage === 2
        ?
        "⏰ 一小時前提醒"
        :
        "🔔 工作提醒";


    /*
     * 案場
     */

    projectBox.textContent =
        project
        ?
        `${project.code}｜${project.name}`
        :
        "未指定案場";


    /*
     * 工作
     */

    contentBox.textContent =
        row.item.title ||
        "未命名工作";


    /*
     * 工作時間 / 提醒時間
     */

    timeBox.textContent =
        `工作時間：${row.item.time || "09:00"}　｜　提醒時間：${row.time}`;


    /*
     * 提醒階段
     */

    stageBox.textContent =
        row.stage === 2
        ?
        "第二階段提醒：工作前 1 小時"
        :
        `第一階段提醒：${row.label}`;


    /*
     * 備註
     */

    if (
        row.item.note &&
        String(row.item.note).trim()
    ) {

        noteBox.textContent =
            `備註：${row.item.note}`;

        noteBox.style.display =
            "block";

    }

    else {

        noteBox.style.display =
            "none";

    }


    /*
     * 顯示
     */

    backdrop.classList.remove(
        "hidden"
    );


    document.body.classList.add(
        "reminder-popup-open"
    );


    console.log(
        "YAO：顯示提醒 Popup",
        row
    );


    /*
     * 自動 Focus
     */

    setTimeout(
        () => {

            if (closeButton) {

                closeButton.focus();

            }

        },
        100
    );


    /*
     * 瀏覽器標題短暫變化
     */

    const oldTitle =
        document.title;


    document.title =
        "🔔 YAO 工作提醒";


    setTimeout(
        () => {

            if (
                document.title ===
                "🔔 YAO 工作提醒"
            ) {

                document.title =
                    oldTitle;

            }

        },
        5000
    );

}


/* =========================================================
   「我知道了」並關閉提醒
   ========================================================= */

function acknowledgeAndCloseReminder() {

    if (
        !reminderPopupCurrentRow
    ) {

        closeReminderPopup();

        return;

    }


    const row =
        reminderPopupCurrentRow;


    const key =
        getReminderKey(
            row
        );


    /*
     * ★ 重要
     *
     * 只有使用者真的按下
     * 「我知道了」
     * 才寫入 localStorage。
     */

    acknowledgeReminder(
        key
    );


    /*
     * 從 Queue 裡面清掉
     * 同一個提醒。
     */

    reminderPopupQueue =
        reminderPopupQueue.filter(
            queued =>
                getReminderKey(
                    queued
                ) !== key
        );


    closeReminderPopup();

}


/* =========================================================
   關閉提醒
   ========================================================= */

function closeReminderPopup(
    force = false
) {

    const backdrop =
        document.querySelector(
            "#reminderPopup"
        );


    if (backdrop) {

        backdrop.classList.add(
            "hidden"
        );

    }


    document.body.classList.remove(
        "reminder-popup-open"
    );


    reminderPopupShowing =
        false;


    reminderPopupCurrentRow =
        null;


    /*
     * 登出時
     * 不繼續顯示。
     */

    if (force) {

        reminderPopupQueue = [];

        return;

    }


    /*
     * 下一個提醒。
     */

    setTimeout(
        () => {

            showNextReminderPopup();

        },
        150
    );

}


/* =========================================================
   ESC 關閉提醒
   ========================================================= */

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Escape" &&
            reminderPopupShowing
        ) {

            /*
             * ESC 也視為「我知道了」。
             */

            acknowledgeAndCloseReminder();

        }

    }
);


/* =========================================================
   測試提醒 Popup
   =========================================================
   這個功能是給我們測試用的。

   登入 YAO 後，
   開啟 Console 輸入：

       testReminderPopup()

   就會直接跳出測試提醒。

   注意：
   這只是測試畫面，
   不會寫入 Firebase。
   ========================================================= */

function testReminderPopup() {

    if (!currentUser) {

        console.warn(
            "YAO：請先登入系統再測試提醒。"
        );

        return;

    }


    const testProject =
        projects[0] ||
        {
            id:
                "test-project",

            code:
                "TEST",

            name:
                "測試案場"
        };


    const testItem = {

        id:
            "test-reminder-" +
            Date.now(),

        projectId:
            testProject.id,

        type:
            "查驗",

        date:
            getTodayISO(),

        time:
            "18:00",

        title:
            "這是一個提醒測試",

        note:
            "如果你看到這個視窗，代表 YAO Popup 正常。",

        reminder:
            "none",

        reminderOneHour:
            true,

        done:
            false

    };


    const testRow = {

        item:
            testItem,

        project:
            testProject,

        stage:
            2,

        date:
            getTodayISO(),

        time:
            "17:00",

        label:
            "提前 1 小時"

    };


    reminderPopupQueue.push(
        testRow
    );


    showNextReminderPopup();

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


            const oneHourCheckbox =
                document.querySelector(
                    "#itemOneHourReminder"
                );


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

                reminderOneHour:
                    oneHourCheckbox
                    ?
                    oneHourCheckbox.checked
                    :
                    false,

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


                    /*
                     * 修改工作後
                     * 清除舊提醒確認紀錄。
                     *
                     * 讓新的提醒可以再次出現。
                     */

                    clearReminderHistoryForItem(
                        editingItemId
                    );


                    /*
                     * 如果這筆工作目前在 Queue
                     * 也移除舊版本。
                     */

                    reminderPopupQueue =
                        reminderPopupQueue.filter(
                            row =>
                                String(row.item.id) !==
                                String(editingItemId)
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
   清除某筆工作舊提醒記錄
   ========================================================= */

function clearReminderHistoryForItem(
    itemId
) {

    const acknowledged =
        getAcknowledgedReminderKeys();


    let changed =
        false;


    Object.keys(acknowledged)
        .forEach(
            key => {

                if (
                    key.includes(
                        `|${itemId}|`
                    )
                ) {

                    delete acknowledged[key];

                    changed = true;

                }

            }
        );


    if (!changed)
        return;


    try {

        localStorage.setItem(
            REMINDER_STORAGE_KEY,
            JSON.stringify(
                acknowledged
            )
        );

    }

    catch (error) {

        console.error(
            error
        );

    }

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
   背景點擊關閉工作 Modal
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


/* =========================================================
   背景點擊關閉案場 Modal
   ========================================================= */

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

window.goToPage =
    goToPage;


/* =========================================================
   行事曆全域函式
   ========================================================= */

window.changeCalendarMonth =
    changeCalendarMonth;

window.goCalendarToday =
    goCalendarToday;


/* =========================================================
   提醒測試函式
   ========================================================= */

window.testReminderPopup =
    testReminderPopup;


/* =========================================================
   初始化
   ========================================================= */

console.log(
    "========================================"
);

console.log(
    "YAO V5.0 Firebase 系統已啟動"
);

console.log(
    "YAO V5.0 提醒系統已啟動"
);

console.log(
    "提醒測試：登入後於 Console 輸入 testReminderPopup()"
);

console.log(
    "========================================"
);