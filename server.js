const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

const groupNumId = {
    "1282690301": "6411-100503D",
    "1282690279": "6412-100503D",
    "1213641978": "6413-100503D"
};

const baseURL = 'https://ssau.ru/rasp';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Функция для загрузки HTML страницы расписания
async function fetchScheduleHTML(url) {
    try {
        const response = await axios.get(url);
        console.log(`Загружено ${url}:`, response.status, response.statusText);
        return response.data;
    } catch (error) {
        console.error(`Ошибка при загрузке ${url}:`, error.message);
        throw new Error(`Не удалось загрузить расписание с ${url}`);
    }
}

// Функция обработки расписания с использованием Cheerio
function processSchedule($, week) {
    try {
        const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
        const schedule = {};
        const dates = [];

        // Получение дат для каждого дня
        $('.schedule__item.schedule__head').each((index, elem) => {
            const date = $(elem).find('.caption-text.schedule__head-date').text().trim();
            if (date) dates.push(date);
        });

        const timeBlocks = $('.schedule__time-item');
        const times = [];
        timeBlocks.each((index, timeElem) => {
            const timeStr = $(timeElem).text().trim();
            if (index % 2 === 0) {
                times.push(`${timeStr} - `);
            } else {
                times[times.length - 1] += timeStr;
            }
        });

        // Инициализация расписания для каждого времени
        times.forEach((time) => {
            schedule[time] = {};
            days.forEach((day) => {
                schedule[time][day] = '-';
            });
        });

        // Обработка ячеек расписания
        $('.schedule__item:not(.schedule__head)').each((index, elem) => {
            const cell = $(elem);
            const dayIndex = index % days.length;
            const timeIndex = Math.floor(index / days.length);
            const timeStr = times[timeIndex];

            cell.find('.schedule__lesson').each((_, lessonElem) => {
                try {
                    const lesson = $(lessonElem);
                    const lessonInfo = extractLessonInfo($, lesson, week);
                    if (schedule[timeStr][days[dayIndex]] === '-') {
                        schedule[timeStr][days[dayIndex]] = lessonInfo;
                    } else if (schedule[timeStr][days[dayIndex]] !== '-') {
                        schedule[timeStr][days[dayIndex]] += `<hr>${lessonInfo}</div>`;
                    }
                } catch (lessonError) {
                    console.error('Ошибка при обработке занятия:', lessonError.message);
                }
            });
        });

        return { days, times, schedule, dates };
    } catch (error) {
        console.error('Ошибка в processSchedule:', error.message);
        throw error;
    }
}

// Функция для извлечения информации о занятии
function extractLessonInfo($, lesson, week) {
    try {
        if (!lesson) {
            console.warn('Занятие не найдено');
            return 'Занятие не найдено';
        }

        const typeClass = lesson.find('.schedule__lesson-type-chip').attr('class') || '';
        const info = lesson.find('.schedule__lesson-info');

        if (!info) {
            console.warn('Информация о занятии не найдена');
            return 'Информация о занятии не найдена';
        }
        const subject = info.find('.body-text.schedule__discipline').text().trim();
        const location = info.find('.caption-text.schedule__place').text().trim();

        let teacher = "Преподаватель неизвестен";
        let teacherId = null;
        const teacherLinkElem = info.find('.schedule__teacher a');
        try {
            teacher = teacherLinkElem.text().trim();
            teacherId = teacherLinkElem.attr('href').split('=')[1];
        } catch (e) {
            console.warn("Ссылка на преподавателя не найдена");
        }

        let groupsHtml = '';
        info.find('a.caption-text.schedule__group').each((_, groupElem) => {
            const groupName = $(groupElem).text().trim();
            const groupIdLink = $(groupElem).attr('href').split('=')[1];
            groupsHtml += `<a href="index.html?groupId=${groupIdLink}&week=${week}" target="_blank">${groupName}</a>, `;
        });

        const groupList = groupsHtml.length > 0 ? groupsHtml.slice(0, -2) : 'Нет групп';

        let lessonInfo = `<b>${subject}</b><br>${location}`;
        if (teacherId) {
            lessonInfo += `<br><a href="teachers.html?staffId=${teacherId}&week=${week}" target="_blank">${teacher}</a>`;
        } else {
            lessonInfo += `<br>${teacher}`;
        }
        lessonInfo += `<br>Группы: ${groupList}`;

        let colorClass = '';
        if (typeClass?.includes('lesson-type-1__bg')) {
            colorClass = 'green';
        } else if (typeClass?.includes('lesson-type-2__bg')) {
            colorClass = 'pink';
        } else if (typeClass?.includes('lesson-type-3__bg')) {
            colorClass = 'blue';
        } else if (typeClass?.includes('lesson-type-4__bg')) {
            colorClass = 'orange';
        } else if (typeClass?.includes('lesson-type-5__bg')) {
            colorClass = 'dark-blue';
        } else if (typeClass?.includes('lesson-type-6__bg')) {
           colorClass = 'turquoise';
        }

        return `<div class="${colorClass}">${lessonInfo}</div>`;
    } catch (error) {
        console.error('Ошибка в extractLessonInfo:', error.message);
        return '<div>Ошибка при обработке занятия</div>';
    }
}

// Роут для получения списка групп
app.get('/api/groups', (req, res) => {
    try {
        const groups = Object.entries(groupNumId).map(([id, name]) => ({
            id,
            name: name.split('-')[0],
        }));
        res.json({ success: true, data: groups });
    } catch (error) {
        console.error("Ошибка при получении групп:", error);
        res.status(500).json({ success: false, error: "Не удалось получить группы" });
    }
});

// Роут для получения расписания по группе
app.get('/api/schedule', async (req, res) => {
    try {
        const groupId = req.query.groupId;
        const week = req.query.week;

        console.log('Получен groupId:', groupId);
        console.log('Получена неделя:', week);

        if (!groupId || !week) {
            return res.status(400).json({ success: false, error: 'Отсутствуют groupId или week' });
        }

        if (!groupNumId[groupId]) {
            console.log(`groupId ${groupId} не найден в GROUP_NUMBER_IDS`);
            return res.status(404).json({
                success: false,
                error: 'Группа не найдена',
                availableGroups: Object.keys(groupNumId)
            });
        }

        const url = `${baseURL}?groupId=${groupId}&selectedWeek=${week}`;
        console.log(`Загрузка расписания для группы с URL: ${url}`);

        const html = await fetchScheduleHTML(url);
        const $ = cheerio.load(html);

        const groupName = $('.page-header h1.h1-text').text().trim();
        if (!groupName) {
            return res.status(404).json({ success: false, error: 'Группа не найдена' });
        }
        const scheduleData = processSchedule($, week); 
        const groupInfoBlock = $('.card-default.info-block');
        let groupDescription = '';
        groupInfoBlock.find('.info-block__description div').each((_, descElem) => {
            groupDescription += $(descElem).text().trim() + '<br>';
        });
        const groupTitle = groupInfoBlock.find('.info-block__title').text().trim();
        const groupSemesterInfo = groupInfoBlock.find('.info-block__semester div').text().trim();

        res.json({
            success: true,
            groupId,
            week,
            groupName,
            groupInfo: {
                title: groupTitle,
                description: groupDescription,
                semesterInfo: groupSemesterInfo
            },
            schedule: scheduleData.schedule,
            dates: scheduleData.dates
        });

    } catch (error) {
        console.error('Ошибка при загрузке или обработке расписания:', error.message);
        res.status(500).json({ success: false, error: 'Не удалось получить расписание', details: error.message });
    }
});

// Роут для получения расписания преподавателя
app.get('/api/teacherSchedule', async (req, res) => {
    try {
        const staffId = req.query.staffId;
        const week = req.query.week;

        console.log(`Получен staffId: ${staffId}, неделя: ${week}`);

        if (!staffId || !week) {
            return res.status(400).json({ success: false, error: 'Отсутствуют staffId или week' });
        }

        const url = `${baseURL}?staffId=${staffId}&selectedWeek=${week}`;
        console.log(`Загрузка расписания преподавателя с URL: ${url}`);

        const html = await fetchScheduleHTML(url);
        const $ = cheerio.load(html);

        const teacherName = $('.page-header h1.h1-text').text().trim();
        if (!teacherName) {
            return res.status(404).json({ success: false, error: 'Преподаватель не найден' });
        }
        const scheduleData = processSchedule($, week);

        res.json({
            success: true,
            staffId,
            week,
            teacherName,
            schedule: scheduleData.schedule,
            dates: scheduleData.dates
        });

    } catch (error) {
        console.error('Ошибка при загрузке или обработке расписания преподавателя:', error.message);
        res.status(500).json({ success: false, error: 'Не удалось получить расписание преподавателя', details: error.message });
    }
});

// Роут для получения информации о преподавателе
app.get('/api/teacherInfo', async (req, res) => {
    try {
        const staffId = req.query.staffId;
        console.log("Получен staffId:", staffId);

        if (!staffId) {
            return res.status(400).json({ success: false, error: 'Отсутствует staffId' });
        }

        const url = `${baseURL}?staffId=${staffId}`;
        console.log(`Загрузка информации о преподавателе с URL: ${url}`);

        const html = await fetchScheduleHTML(url);
        const $ = cheerio.load(html);
        let teacherName = $('.page-header h1.h1-text').text().trim();
        teacherName = teacherName.replace('Расписание, ', '');
        console.log(`Имя преподавателя: ${teacherName}`);

        if (!teacherName) {
            return res.status(404).json({ success: false, error: 'Преподаватель не найден' });
        }

        const teacherInfoBlock = $('.card-default.info-block');
        let teacherDescription = '';
        teacherInfoBlock.find('.info-block__description div').each((_, descElem) => {
            teacherDescription += $(descElem).text().trim() + '<br>';
        });
        console.log(`Описание преподавателя: ${teacherDescription}`);
        let semesterInfo = teacherInfoBlock.find('.info-block__semester div').text().trim();
        teacherDescription += `<br>${semesterInfo}`;

        res.json({
            success: true,
            staffId,
            teacherName,
            teacherInfo: teacherDescription
        });

    } catch (error) {
        console.error('Ошибка при загрузке или обработке информации о преподавателе:', error.message);
        res.status(500).json({ success: false, error: 'Не удалось получить информацию о преподавателе', details: error.message });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
