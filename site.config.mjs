// Главные настройки сайта. Меняйте тексты, цифры и ссылки здесь —
// остальной код трогать не нужно.

export default {
  // Telegram-канал, из которого забираются посты
  channel: 'analysts_world',

  // Адрес сайта (свой домен, подключён к GitHub Pages)
  site: 'https://analystworld.ru',

  title: 'Мир аналитика данных',
  tagline: 'Аналитик данных · автор канала @analysts_world',
  description:
    'Будни аналитика, много рабочего кода, A/B-тесты и подготовка к собеседованиям. Объясняю сложное простым языком.',

  // Фото на главной: положите файл в public/ (например public/photo.jpg)
  // и впишите сюда '/photo.jpg'. Пусто — будет показана аватарка канала.
  photo: '',

  // Карточки с цифрами на главной.
  // value: 'auto:subscribers' и 'auto:posts' обновляются сами.
  stats: [
    { value: 'auto:subscribers', label: 'подписчиков в Telegram' },
    { value: 'auto:posts', label: 'постов с кодом и разборами' },
    { value: 'N лет', label: 'в аналитике' },
  ],

  links: {
    telegram: 'https://t.me/analysts_world',
    linkedin: 'https://www.linkedin.com/in/valeriashuvaeva',
  },

  // Рубрики: пост попадает в первую рубрику, у которой совпало
  // хотя бы одно ключевое слово (регистр не важен).
  rubrics: [
    {
      slug: 'interview',
      name: 'Задачки с собеседований',
      keywords: ['собеседовани', 'задачк', 'задача с'],
    },
    {
      slug: 'ab-tests',
      name: 'A/B-тесты',
      keywords: ['a/b', 'а/б', 'ab-тест', 'аб-тест', 'a/b-тест', 'mde', 'srm', 't-тест', 'бутстрап', 'статзначим', 'p-value'],
    },
    {
      slug: 'sql-python',
      name: 'SQL и Python',
      keywords: ['sql', 'python', 'pandas', 'duckdb', 'select', 'оконн', 'join'],
    },
    {
      slug: 'events',
      name: 'Ивенты',
      keywords: ['конференц', 'митап', 'meetup', 'digital day', 'fuckup', 'ивент', 'офисе'],
    },
  ],
  // Рубрика для всего, что не подошло ни под одну рубрику выше
  defaultRubric: { slug: 'other', name: 'Вне выборки' },

  // Рекламные посты (с пометкой «Реклама» / erid) на сайт не попадают
  skipAds: true,

  // Посты, которые не нужно показывать на сайте (номер поста — из ссылки
  // t.me/analysts_world/<номер>). Они не скачиваются и не попадают на сайт.
  hiddenPosts: [
    340, // Fuckup Night — событие прошло
  ],

  // Аналитика посещений. Пусто — счётчики не подключаются.
  analytics: {
    yandexMetrikaId: '', // например '12345678'
    posthogKey: '', // например 'phc_...'
    posthogHost: 'https://eu.i.posthog.com',
  },
};
