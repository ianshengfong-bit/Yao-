/* =========================================
   行事曆
   電腦版 + 手機版
========================================= */

let calendarDate = new Date();


function changeCalendarMonth(offset) {

    calendarDate = new Date(
        calendarDate.getFullYear(),
        calendarDate.getMonth() + offset,
        1
    );

    renderCalendar(filteredItems());

}


function goCalendarToday() {

    calendarDate = new Date();

    renderCalendar(filteredItems());

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


    let calendarHTML = "";


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
       上個月的日期
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
       本月份
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

                                    const project =
                                        getProject(
                                            item.projectId
                                        );


                                    return `

                                        <div
                                            class="
                                                event
                                                ${typeClass(item.type)}
                                            "
                                            onclick="
                                                editItem('${item.id}')
                                            "
                                            title="${esc(
                                                item.title
                                            )}"
                                        >

                                            <span>
                                                ${esc(
                                                    item.time || ""
                                                )}
                                            </span>

                                            <strong>
                                                ${esc(
                                                    item.title
                                                )}
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
       補足下個月日期
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
       判斷是否目前月份
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


/* =========================================
   行事曆全域函式
========================================= */

window.changeCalendarMonth =
    changeCalendarMonth;

window.goCalendarToday =
    goCalendarToday;