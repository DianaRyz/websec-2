document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initApplication();
        setupEventListeners();
    } catch (error) {
        console.error('Application initialization failed:', error);
        showError('Произошла ошибка при загрузке приложения');
    }
});

async function initApplication() {
    const groups = await fetchGroups();
    populateGroupSelect(groups);
    generateWeekOptions();
    const { groupId, week } = getUrlParams();

    if (groupId) {
        document.getElementById('groupSelect').value = groupId;
    }

    if (week) {
        document.getElementById('weekPicker').value = week;
        updateCurrentWeekDisplay(week);
        updateNavigationButtons(week);
        await loadSchedule();
    } else {
        updateNavigationButtons(1);
    }
}

function setupEventListeners() {
    document.getElementById('groupSelect').addEventListener('change', async () => {
        const weekNumber = document.getElementById('weekPicker').value;
        if (weekNumber) {
            updateCurrentWeekDisplay(weekNumber);
            updateNavigationButtons(weekNumber);
            await loadSchedule();
        }
    });

    document.getElementById('weekPicker').addEventListener('change', async () => {
        const weekNumber = document.getElementById('weekPicker').value;
        if (weekNumber) {
            updateCurrentWeekDisplay(weekNumber);
            updateNavigationButtons(weekNumber);
            await loadSchedule();
        }
    });

    document.getElementById('prevWeek').addEventListener('click', () => {
        navigateWeek(-1);
    });

    document.getElementById('nextWeek').addEventListener('click', () => {
        navigateWeek(1);
    });
}

async function fetchGroups() {
    try {
        const response = await fetch('/api/groups'); 
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Fetched groups data:', data);
        return data.data;
    } catch (error) {
        console.error('Error fetching groups:', error);
        showError('Не удалось загрузить список групп');
        return [];
    }
}

function populateGroupSelect(groups) {
    const groupSelect = document.getElementById('groupSelect');
    groupSelect.innerHTML = '<option value="">Выберите группу</option>';

    if (Array.isArray(groups)) {
        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            groupSelect.appendChild(option);
        });
    } else {
        console.error('populateGroupSelect: groups is not an array:', groups);
        showError('Ошибка при обработке списка групп');
    }
}

function getUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        groupId: urlParams.get('groupId'),
        week: urlParams.get('week')
    };
}

function generateWeekOptions() {
    const weekPicker = document.getElementById('weekPicker');
    weekPicker.innerHTML = '<option value="">Выберите неделю</option>';

    for (let i = 1; i <= 52; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `${i} неделя`;
        weekPicker.appendChild(option);
    }
}

function updateCurrentWeekDisplay(weekNumber) {
    document.getElementById('currentWeekDisplay').textContent =
        weekNumber ? `Неделя ${weekNumber}` : "Выберите неделю";
}

function updateNavigationButtons(weekNumber) {
    const prevWeek = weekNumber > 1 ? weekNumber - 1 : 52;
    const nextWeek = weekNumber < 52 ? parseInt(weekNumber) + 1 : 1;

    document.getElementById('prevWeek').innerHTML = `&lt; Неделя ${prevWeek}`;
    document.getElementById('nextWeek').innerHTML = `Неделя ${nextWeek} &gt;`;
}

function navigateWeek(direction) {
    let currentWeek = parseInt(document.getElementById('weekPicker').value, 10) || 1;
    let newWeek = currentWeek + direction;

    if (newWeek < 1) newWeek = 52;
    if (newWeek > 52) newWeek = 1;

    document.getElementById('weekPicker').value = newWeek;
    document.getElementById('weekPicker').dispatchEvent(new Event('change'));
}

async function loadSchedule() {
    const weekNumber = document.getElementById('weekPicker').value;
    const groupId = document.getElementById('groupSelect').value;

    console.log('Selected groupId:', groupId);
    console.log('Selected weekNumber:', weekNumber);

    if (!groupId) {
        showError('Выберите группу');
        return;
    }

    if (!weekNumber) {
        showError('Выберите неделю');
        return;
    }

    try {
        showLoading();

        updateBrowserHistory(groupId, weekNumber);
        const data = await loadScheduleData(groupId, weekNumber);

        if (data) {
            renderSchedule(data.dates, data.schedule, data.groupName, data.groupInfo);
        }
    } catch (error) {
        console.error('Error loading schedule:', error);
        showError('Не удалось загрузить расписание');
    } finally {
        hideLoading();
    }
}

async function loadScheduleData(groupId, week) {
    try {
        const url = `/api/schedule?groupId=${groupId}&week=${week}`;
        console.log('Fetching schedule from URL:', url);
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Группа не найдена');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching schedule:', error);
        throw error;
    }
}

function renderSchedule(dates, scheduleData, groupName, groupInfo) {
    const tableBody = document.getElementById('scheduleBody');
    tableBody.innerHTML = '';

    const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    const times = Object.keys(scheduleData);

    const table = document.getElementById('scheduleTable');
    const thead = table.querySelector('thead');
    thead.innerHTML = '';
    const headerRow = document.createElement('tr');

    const timeHeader = document.createElement('th');
    timeHeader.textContent = 'Время';
    headerRow.appendChild(timeHeader);

    days.forEach((day, index) => {
        const th = document.createElement('th');
        th.textContent = `${day}${dates && dates[index] ? ` (${dates[index]})` : ''}`;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    times.forEach(time => {
        const row = document.createElement('tr');

        const timeCell = document.createElement('td');
        timeCell.textContent = time;
        row.appendChild(timeCell);

        days.forEach(day => {
            const lesson = scheduleData[time][day];
            const td = document.createElement('td');
            td.innerHTML = lesson !== '-' ? lesson : '-';
            row.appendChild(td);
        });

        tableBody.appendChild(row);
    });

    document.querySelector('.header__title').textContent = groupName;
    const groupInfoElement = document.getElementById('groupInfo');
    groupInfoElement.innerHTML = '';
    if (groupInfo) {
        const h2 = document.createElement('h2');
        h2.textContent = groupInfo.title || 'Информация о группе';
        groupInfoElement.appendChild(h2);

        const divDescription = document.createElement('div');
        divDescription.innerHTML = groupInfo.description || 'Нет дополнительной информации';
        groupInfoElement.appendChild(divDescription);

        const divSemesterInfo = document.createElement('div');
        divSemesterInfo.textContent = groupInfo.semesterInfo || '';
        groupInfoElement.appendChild(divSemesterInfo);
    }
}

function updateBrowserHistory(groupId, week) {
    const params = new URLSearchParams({ groupId, week });
    window.history.replaceState({}, '', `?${params.toString()}`);
}

function showLoading() {
    document.getElementById('loadingIndicator').style.display = 'block';
}

function hideLoading() {
    document.getElementById('loadingIndicator').style.display = 'none';
}

function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    setTimeout(() => errorElement.style.display = 'none', 5000);
}

$(document).ready(() => {
    const config = {
        maxWeeks: 52,
        days: ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']
    };

    const urlParams = new URLSearchParams(window.location.search);
    let staffId = urlParams.get('staffId');
    let currentWeek = parseInt(urlParams.get('week')) || getCurrentAcademicWeek();

    init();

    function init() {
        if (!staffId) {
            showError('Не указан идентификатор преподавателя');
            return;
        }

        generateWeekOptions();
        setupEventListeners();
        loadTeacherSchedule(staffId, currentWeek);
        loadTeacherInfo(staffId);
    }

    function setupEventListeners() {
        $('#weekPicker').change(onWeekChange);
        $('#prevWeek').click(() => navigateWeek(-1));
        $('#nextWeek').click(() => navigateWeek(1));
    }

    async function loadTeacherSchedule(staffId, week) {
        if (!staffId) {
            console.error('staffId is undefined');
            return;
        }

        console.log(`Loading schedule for staffId: ${staffId}, week: ${week}`);
        showLoading();

        try {
            const response = await fetchSchedule(staffId, week);
            console.log("Данные с сервера:", response);

            if (!response || !response.schedule) {
                throw new Error('Неверный формат данных расписания');
            }

            renderTeacherSchedule(response);
            updateCurrentWeekDisplay(week);
            updateNavigationButtons(week);
            updateUrlParams(staffId, week);
        } catch (error) {
            handleScheduleError(error);
        } finally {
            hideLoading();
        }
    }

    async function fetchSchedule(staffId, week) {
        try {
            const url = `/api/teacherSchedule?staffId=${staffId}&week=${week}`;
            console.log("URL запроса:", url);

            const response = await $.getJSON(url);

            if (!response || !response.schedule) {
                throw new Error('Неверный формат данных расписания');
            }

            console.log("Данные с сервера (fetchSchedule):", response);
            return response;

        } catch (error) {
            console.error("Error in fetchSchedule:", error);
            throw error;
        }
    }

    function renderTeacherSchedule(data) {
        const { teacherName, teacherInfo, dates, schedule } = data;

        console.log("Данные для отображения:", data);
        $('#teacherHeader').text(teacherName);
        const $teacherInfoContainer = $('#teacherInfo');
        $teacherInfoContainer.empty();
        if (teacherInfo) {
            $teacherInfoContainer.append(
                $('<h2>').text(teacherInfo.title || 'Информация о преподавателе'),
                $('<div>').html(teacherInfo.description || 'Нет дополнительной информации'),
                $('<div>').text(teacherInfo.semesterInfo || '')
            );
        }
        const $table = $('<table>').addClass('schedule-table');
        const $thead = $('<thead>');
        const $tbody = $('<tbody>');
        $thead.append(
            $('<tr>').append(
                $('<th>').text('Время'),
                ...config.days.map((day, index) =>
                    $('<th>').text(`${day}${dates && dates[index] ? ` (${dates[index]})` : ''}`)
                )
            )
        );

        Object.keys(schedule).forEach(time => {
            $tbody.append(
                $('<tr>').append(
                    $('<td>').text(time),
                    ...config.days.map(day => {
                        const lessonContent = schedule[time][day] !== '-' ?
                            formatLessonContent(schedule[time][day]) :
                            '-';
                        return $('<td>').html(lessonContent);
                    })
                )
            );
        });
        $('#scheduleTable').empty().append($thead, $tbody);
    }

    async function loadTeacherInfo(staffId) {
        if (!staffId) {
            console.error('staffId is undefined');
            return;
        }

        console.log('Загрузка информации о преподавателе с ID:', staffId);

        try {
            const response = await $.getJSON(`/api/teacherInfo?staffId=${staffId}`);

            console.log('Информация о преподавателе с сервера:', response);

            if (response && response.success) {
                renderTeacherInfo(response);
            } else {
                console.error('Ошибка при загрузке информации о преподавателе:', response ? response.error : 'Неизвестная ошибка');
                showError('Не удалось загрузить информацию о преподавателе');
                document.getElementById('teacherInfo').innerHTML = '';
            }

        } catch (error) {
            console.error('Ошибка при загрузке информации о преподавателе:', error);
            showError('Ошибка при загрузке информации о преподавателе');
            document.getElementById('teacherInfo').innerHTML = '';
        }
    }

    function renderTeacherInfo(data) {
        console.log("Данные для отображения информации о преподавателе:", data);

        const { teacherName, teacherInfo } = data;
        const teacherInfoElement = document.getElementById('teacherInfo');
        console.log("teacherInfoElement:", teacherInfoElement);

        if (!teacherInfoElement) {
            console.error("Элемент с ID 'teacherInfo' не найден");
            return;
        }
        if (teacherInfoElement.children.length === 0) {
            if (teacherName) {
                const h2 = document.createElement('h2');
                h2.textContent = teacherName;
                teacherInfoElement.appendChild(h2);
            }
            if (teacherInfo) {
                const p = document.createElement('p');
                p.innerHTML = teacherInfo;
                teacherInfoElement.appendChild(p);
            }
        }
    }


    function formatLessonContent(html) {
        return html.replace(/<a href="\/rasp\?groupId=(\d+)/g,
            '<a href="group.html?groupId=$1" target="_blank"');
    }

    function updateCurrentWeekDisplay(week) {
        $('#currentWeekDisplay').text(`Неделя ${week}`);
    }

    function updateNavigationButtons(week) {
        const prevWeek = week > 1 ? week - 1 : config.maxWeeks;
        const nextWeek = week < config.maxWeeks ? week + 1 : 1;

        $('#prevWeek').text(`Неделя ${prevWeek}`).attr('title', `Перейти на неделю ${prevWeek}`);
        $('#nextWeek').text(`Неделя ${nextWeek}`).attr('title', `Перейти на неделю ${nextWeek}`);
    }

    function updateUrlParams(staffId, week) {
        const url = new URL(window.location.href);
        url.searchParams.set('staffId', staffId);
        url.searchParams.set('week', week);
        window.history.pushState({}, '', url.toString());
    }

    function generateWeekOptions() {
        const $weekPicker = $('#weekPicker');
        $weekPicker.empty();

        for (let i = 1; i <= config.maxWeeks; i++) {
            $weekPicker.append(
                $('<option>', {
                    value: i,
                    text: `${i} неделя`
                })
            );
        }

        if (currentWeek) {
            $weekPicker.val(currentWeek);
        }
    }

    function onWeekChange() {
        const selectedWeek = parseInt($(this).val(), 10);
        currentWeek = selectedWeek;
        loadTeacherSchedule(staffId, selectedWeek);
    }

    function navigateWeek(direction) {
        let newWeek = currentWeek + direction;

        if (newWeek < 1) newWeek = config.maxWeeks;
        if (newWeek > config.maxWeeks) newWeek = 1;

        $('#weekPicker').val(newWeek).trigger('change');
    }

    function getCurrentAcademicWeek() {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const diff = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24 * 7));
        return (diff % config.maxWeeks) + 1;
    }

    function showLoading() {
        $('#loadingIndicator').show();
    }

    function hideLoading() {
        $('#loadingIndicator').hide();
    }

    function showError(message) {
        $('#errorMessage').text(message).show();
    }

    function handleScheduleError(error) {
        console.error('Ошибка при загрузке расписания:', error);
        let message = 'Ошибка при загрузке расписания';
        if (error.responseJSON && error.responseJSON.error) {
            message = error.responseJSON.error;
        } else if (error.message) {
            message = error.message;
        }
        showError(message);
    }
});
