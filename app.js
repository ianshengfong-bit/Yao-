/* =========================================
   YAO V3
   消防工程行政管理
========================================= */


const ITEM_KEY =
    "yao_items_v3";


const PROJECT_KEY =
    "yao_projects_v3";


let items =
    JSON.parse(
        localStorage.getItem(ITEM_KEY) || "[]"
    );


let projects =
    JSON.parse(
        localStorage.getItem(PROJECT_KEY) || "[]"
    );


let currentPage =
    "dashboard";


let editingItemId =
    null;


let editingProjectId =
    null;


const app =
    document.querySelector("#app");


const today =
    new Date();


const isoToday =
    today.toISOString().slice(0, 10);



/* =========================================
   日期
========================================= */

function addDays(number) {

    const d =
        new Date();

    d.setDate(
        d.getDate() + number
    );

    return d
        .toISOString()
        .slice(0, 10);

}


function formatDate(date) {

    if (!date)
        return "";

    return date.replaceAll("-", "/");

}



/* =========================================
   儲存
========================================= */

function saveItems() {

    localStorage.setItem(
        ITEM_KEY,
        JSON.stringify(items)
    );

}


function saveProjects() {

    localStorage.setItem(
        PROJECT_KEY,
        JSON.stringify(projects)
    );

}



/* =========================================
   HTML 安全
========================================= */

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



/* =========================================
   Toast
========================================= */

function toast(message) {

    const box =
        document.querySelector("#toast");


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



/* =========================================
   範例案場
========================================= */

if (projects.length === 0) {

    projects = [

        {
            id: 1,
            code: "A001",
            name: "○○大樓",
            address: "台中市太平區",
            contact: "",
            phone: "",
            note: "消防工程",
            archived: false
        },

        {
            id: 2,
            code: "A002",
            name: "△△廠辦",
            address: "台中市大里區",
            contact: "",
            phone: "",
            note: "",
            archived: false
        }

    ];

    saveProjects();

}



/* =========================================
   新增範例工作
========================================= */

if (items.length === 0) {

    items = [

        {
            id: 1,
            projectId: 1,
            type: "進料",
            date: isoToday,
            time: "09:00",
            title: "消防箱 20 組進公司",
            note: "確認數量與外觀",
            reminder: "none",
            done: false
        },

        {
            id: 2,
            projectId: 1,
            type: "出貨",
            date: addDays(1),
            time: "10:00",
            title: "消防箱出貨至工地",
            note: "安排貨車",
            reminder: "1",
            done: false
        }

    ];

    saveItems();

}



/* =========================================
   找案場
========================================= */

function getProject(id) {

    return projects.find(
        p => Number(p.id) === Number(id)
    );

}



/* =========================================
   類型顏色
========================================= */

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



/* =========================================
   搜尋
========================================= */

function filteredItems() {

    const search =
        document
            .querySelector("#searchInput")
            .value
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
                item.title,
                item.note,
                item.type

            ]
                .join(" ")
                .toLowerCase()
                .includes(search);

        }
    );

}



/* =========================================
   導覽
========================================= */

function render() {

    const titles = {

        dashboard: "儀表板",

        calendar: "行事曆",

        projects: "案場",

        logistics: "進料 / 出貨",

        people: "人員安排",

        inspection: "查驗",

        records: "工作紀錄"

    };


    document.querySelector(
        "#pageTitle"
    ).textContent =
        titles[currentPage];


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



/* =========================================
   儀表板
========================================= */

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
                        a.time
                    ).localeCompare(
                        b.date +
                        b.time
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
                x.date >
                isoToday &&
                x.reminder !==
                "none"
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



/* =========================================
   工作資料列
========================================= */

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
                    onclick="editItem(${item.id})"
                >
                    ✏️ 編輯
                </button>



                <button
                    class="mini-btn"
                    onclick="shareItem(${item.id})"
                >
                    📤 分享
                </button>



                <button
                    class="mini-btn"
                    onclick="toggleDone(${item.id})"
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
                    onclick="deleteItem(${item.id})"
                >
                    🗑️
                </button>


            </div>


        </div>

    `;

}



/* =========================================
   一般列表
========================================= */

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
                    data
                        .sort(
                            (a, b) =>
                                a.date.localeCompare(
                                    b.date
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



/* =========================================
   案場頁
========================================= */

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
                active
                    .map(
                        projectCard
                    )
                    .join("")
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
                            .map(
                                projectCard
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



/* =========================================
   案場卡片
========================================= */

function projectCard(project) {

    const projectItems =
        items.filter(
            x =>
                Number(x.projectId) ===
                Number(project.id)
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
                    class="tag
                    ${project.archived
                        ? "gray"
                        : "green"}"
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
                    onclick="viewProject(${project.id})"
                >
                    查看
                </button>


                <button
                    class="mini-btn"
                    onclick="editProject(${project.id})"
                >
                    ✏️ 編輯
                </button>


                <button
                    class="mini-btn archive"
                    onclick="toggleArchive(${project.id})"
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
                    onclick="deleteProject(${project.id})"
                >
                    🗑️
                </button>


            </div>


        </div>

    `;

}



/* =========================================
   查看案場
========================================= */

function viewProject(id) {

    const project =
        getProject(id);


    if (!project)
        return;


    const projectItems =
        items.filter(
            x =>
                Number(x.projectId) ===
                Number(id)
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
                    onclick="openItemModal(null, ${project.id})"
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
                    projectItems
                        .sort(
                            (a,b) =>
                                a.date.localeCompare(
                                    b.date
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



/* =========================================
   新增案場
========================================= */

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
            project.name;


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



/* =========================================
   關閉案場
========================================= */

function closeProjectModal() {

    document
        .querySelector(
            "#projectModal"
        )
        .classList.add(
            "hidden"
        );


    editingProjectId =
        null;

}



/* =========================================
   編輯案場
========================================= */

function editProject(id) {

    openProjectModal(id);

}



/* =========================================
   自動編號
========================================= */

function getNextProjectCode() {

    let max =
        0;


    projects.forEach(
        function (project) {

            const number =
                parseInt(
                    String(project.code)
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



/* =========================================
   封存
========================================= */

function toggleArchive(id) {

    const project =
        getProject(id);


    if (!project)
        return;


    project.archived =
        !project.archived;


    saveProjects();


    render();


    toast(
        project.archived
        ?
        "案場已封存"
        :
        "案場已恢復"
    );

}



/* =========================================
   刪除案場
========================================= */

function deleteProject(id) {

    const project =
        getProject(id);


    if (!project)
        return;


    const count =
        items.filter(
            x =>
                Number(x.projectId) ===
                Number(id)
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


    projects =
        projects.filter(
            x =>
                Number(x.id) !==
                Number(id)
        );


    saveProjects();


    render();


    toast(
        "案場已刪除"
    );

}



/* =========================================
   工作新增 / 編輯
========================================= */

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


    populateProjectSelect(
        defaultProjectId
    );


    if (id !== null) {

        const item =
            items.find(
                x =>
                    Number(x.id) ===
                    Number(id)
            );


        if (!item)
            return;


        title.textContent =
            "編輯資料";


        saveButton.textContent =
            "儲存修改";


        document.querySelector(
            "#itemType"
        ).value =
            item.type;


        document.querySelector(
            "#itemProject"
        ).value =
            item.projectId;


        document.querySelector(
            "#itemDate"
        ).value =
            item.date;


        document.querySelector(
            "#itemTime"
        ).value =
            item.time || "";


        document.querySelector(
            "#itemTitle"
        ).value =
            item.title;


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



/* =========================================
   案場下拉選單
========================================= */

function populateProjectSelect(
    selectedId = null
) {

    const select =
        document.querySelector(
            "#itemProject"
        );


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


        document.querySelector(
            "#projectHint"
        ).textContent =
            "請先到「案場」建立案場";


        return;

    }


    document.querySelector(
        "#projectHint"
    ).textContent =
        "請從案場清單選擇，不需要手動輸入";


    select.innerHTML = `

        <option value="">
            請選擇案場
        </option>

        ${
            activeProjects
                .map(
                    p => `

                    <option
                        value="${p.id}"
                        ${
                            Number(selectedId) ===
                            Number(p.id)
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



/* =========================================
   關閉工作
========================================= */

function closeItemModal() {

    document
        .querySelector(
            "#itemModal"
        )
        .classList.add(
            "hidden"
        );


    editingItemId =
        null;

}



/* =========================================
   編輯工作
========================================= */

function editItem(id) {

    openItemModal(id);

}



/* =========================================
   刪除工作
========================================= */

function deleteItem(id) {

    const item =
        items.find(
            x =>
                Number(x.id) ===
                Number(id)
        );


    if (!item)
        return;


    if (
        !confirm(
            `確定刪除「${item.title}」嗎？`
        )
    )
        return;


    items =
        items.filter(
            x =>
                Number(x.id) !==
                Number(id)
        );


    saveItems();


    render();


    toast(
        "資料已刪除"
    );

}



/* =========================================
   完成 / 恢復
========================================= */

function toggleDone(id) {

    const item =
        items.find(
            x =>
                Number(x.id) ===
                Number(id)
        );


    if (!item)
        return;


    item.done =
        !item.done;


    saveItems();


    render();


    toast(
        item.done
        ?
        "已完成"
        :
        "已恢復"
    );

}



/* =========================================
   分享
========================================= */

async function shareItem(id) {

    const item =
        items.find(
            x =>
                Number(x.id) ===
                Number(id)
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

        await navigator.clipboard.writeText(
            text
        );


        toast(
            "已複製分享內容，可貼到 LINE"
        );


        return;

    }


    prompt(
        "請複製以下內容",
        text
    );

}



/* =========================================
   行事曆
========================================= */

function renderCalendar(data) {

    const year =
        today.getFullYear();


    const month =
        today.getMonth();


    const first =
        new Date(
            year,
            month,
            1
        ).getDay();


    const days =
        new Date(
            year,
            month + 1,
            0
        ).getDate();


    let html = "";


    [
        "日",
        "一",
        "二",
        "三",
        "四",
        "五",
        "六"
    ].forEach(
        day => {

            html += `

                <div class="weekday">
                    ${day}
                </div>

            `;

        }
    );


    for (
        let i = 0;
        i < first;
        i++
    ) {

        html += `
            <div class="day"></div>
        `;

    }


    for (
        let day = 1;
        day <= days;
        day++
    ) {

        const date =

            `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;


        const events =
            data.filter(
                x =>
                    x.date ===
                    date
            );


        html += `

            <div class="day">

                <div class="day-num">
                    ${day}
                </div>


                ${
                    events
                        .map(
                            x => `

                            <div
                                class="
                                    event
                                    ${typeClass(x.type)}
                                "
                                onclick="editItem(${x.id})"
                            >

                                ${esc(x.title)}

                            </div>

                            `
                        )
                        .join("")
                }

            </div>

        `;

    }


    app.innerHTML = `

        <div class="calendar">

            ${html}

        </div>

    `;

}



/* =========================================
   工作表單
========================================= */

document
    .querySelector(
        "#itemForm"
    )
    .addEventListener(
        "submit",
        function (event) {

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
                    Number(projectId),

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
                    ).value

            };


            if (
                editingItemId !==
                null
            ) {

                const item =
                    items.find(
                        x =>
                            Number(x.id) ===
                            Number(editingItemId)
                    );


                if (item) {

                    Object.assign(
                        item,
                        data
                    );

                }


                toast(
                    "資料已修改"
                );

            }

            else {

                items.push({

                    id:
                        Date.now(),

                    ...data,

                    done:
                        false

                });


                toast(
                    "資料已新增"
                );

            }


            saveItems();


            closeItemModal();


            render();

        }
    );



/* =========================================
   案場表單
========================================= */

document
    .querySelector(
        "#projectForm"
    )
    .addEventListener(
        "submit",
        function (event) {

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



            /* 編輯 */

            if (
                editingProjectId !==
                null
            ) {

                const project =
                    getProject(
                        editingProjectId
                    );


                if (project) {

                    project.name =
                        name;

                    project.address =
                        address;

                    project.contact =
                        contact;

                    project.phone =
                        phone;

                    project.note =
                        note;

                }


                toast(
                    "案場資料已修改"
                );

            }


            /* 新增 */

            else {

                const newProject = {

                    id:
                        Date.now(),

                    code:
                        getNextProjectCode(),

                    name:
                        name,

                    address:
                        address,

                    contact:
                        contact,

                    phone:
                        phone,

                    note:
                        note,

                    archived:
                        false

                };


                projects.push(
                    newProject
                );


                toast(
                    `案場 ${newProject.code} 已建立`
                );

            }


            saveProjects();


            closeProjectModal();


            render();

        }
    );



/* =========================================
   選單
========================================= */

document
    .querySelector(
        "#nav"
    )
    .addEventListener(
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



/* =========================================
   快速新增
========================================= */

document
    .querySelector(
        "#quickAddBtn"
    )
    .onclick =
        function () {

            openItemModal();

        };


document
    .querySelector(
        "#headerAddBtn"
    )
    .onclick =
        function () {

            openItemModal();

        };



/* =========================================
   關閉工作視窗
========================================= */

document
    .querySelector(
        "#closeItemModal"
    )
    .onclick =
        closeItemModal;


document
    .querySelector(
        "#cancelItemModal"
    )
    .onclick =
        closeItemModal;



/* =========================================
   關閉案場視窗
========================================= */

document
    .querySelector(
        "#closeProjectModal"
    )
    .onclick =
        closeProjectModal;


document
    .querySelector(
        "#cancelProjectModal"
    )
    .onclick =
        closeProjectModal;



/* =========================================
   點背景關閉
========================================= */

document
    .querySelector(
        "#itemModal"
    )
    .addEventListener(
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


document
    .querySelector(
        "#projectModal"
    )
    .addEventListener(
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



/* =========================================
   搜尋
========================================= */

document
    .querySelector(
        "#searchInput"
    )
    .addEventListener(
        "input",
        render
    );



/* =========================================
   啟動
========================================= */

render();
