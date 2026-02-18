// Ukrainian translations (Cyrillic only)
export const uk = {
  // Navigation
  nav: {
    dashboard: 'Головна',
    courses: 'Курси',
    groups: 'Групи',
    students: 'Учні',
    lessons: 'Заняття',
    reports: 'Звіти',
    users: 'Користувачі',
  },

  // Page titles
  pages: {
    dashboard: 'Головна',
    courses: 'Курси',
    groups: 'Групи',
    groupDetails: 'Група',
    newGroup: 'Нова група',
    editGroup: 'Редагувати групу',
    students: 'Учні',
    lessons: 'Заняття',
    reports: 'Звіти',
    users: 'Користувачі',
    login: 'Вхід',
  },

  // App name and branding
  app: {
    name: 'Адміністрування школи',
    subtitle: 'Панель керування',
    loginSubtitle: 'Панель керування школою курсів',
  },

  // Actions
  actions: {
    create: 'Створити',
    save: 'Зберегти',
    cancel: 'Скасувати',
    edit: 'Редагувати',
    delete: 'Видалити',
    archive: 'Архівувати',
    restore: 'Відновити',
    logout: 'Вийти',
    login: 'Увійти',
    search: 'Пошук',
    filter: 'Фільтр',
    refresh: 'Оновити',
    export: 'Експорт',
    view: 'Переглянути',
    add: 'Додати',
    close: 'Закрити',
    remove: 'Видалити',
    addGroup: 'Додати групу',
  },

  // Common words
  common: {
    loading: 'Завантаження...',
    saving: 'Збереження...',
    noData: 'Немає даних',
    all: 'Всі',
    yes: 'Так',
    no: 'Ні',
    from: 'З',
    to: 'По',
    status: 'Статус',
    actions: 'Дії',
    required: "Обов'язкове поле",
    confirm: 'Підтвердити',
    note: 'Примітка',
    photosFolder: 'Папка з фото',
    link: 'Посилання',
  },

  // Days of week (full names)
  days: {
    1: 'Понеділок',
    2: 'Вівторок',
    3: 'Середа',
    4: 'Четвер',
    5: "П'ятниця",
    6: 'Субота',
    7: 'Неділя',
  },

  // Days of week (short names for group title)
  daysShort: {
    1: 'Пн',
    2: 'Вт',
    3: 'Ср',
    4: 'Чт',
    5: 'Пт',
    6: 'Сб',
    7: 'Нд',
  },

  // Status labels
  status: {
    active: 'Активний',
    activeF: 'Активна',
    archived: 'Архів',
    inactive: 'Неактивний',
    graduate: 'Випуск',
    // Student study status
    studying: 'Навчається',
    notStudying: 'Не навчається',
  },

  // Group status labels
  groupStatus: {
    active: 'Активна',
    graduate: 'Випуск',
    inactive: 'Неактивна',
  },

  // Roles
  roles: {
    admin: 'Адміністратор',
    teacher: 'Викладач',
  },

  // Forms
  forms: {
    // Course form
    courseTitle: 'Назва курсу',
    courseDescription: 'Опис',
    courseTitlePlaceholder: 'Введіть назву курсу',
    courseDescriptionPlaceholder: 'Короткий опис курсу',
    courseAgeLabel: 'Вік дітей',
    courseAgeLabelPlaceholder: '6',
    courseAgeLabelHint: 'Введіть число (наприклад: 6). Знак "+" додасться автоматично.',
    courseDurationMonths: 'Тривалість (місяців)',
    courseDurationMonthsPlaceholder: 'Оберіть тривалість',
    courseProgram: 'Програма курсу',
    courseProgramPlaceholder: 'Опис програми курсу',

    // Student form
    fullName: 'П.І.Б.',
    firstName: "Ім'я",
    lastName: 'Прізвище',
    phone: 'Телефон',
    parentName: "Ім'я батька",
    parentPhone: 'Телефон батька',
    fullNamePlaceholder: 'Повне ім\'я',
    phonePlaceholder: '+380...',
    
    // New student form fields
    birthDate: 'Дата народження',
    birthDatePlaceholder: 'дд.мм.рррр',
    school: 'Навчальний заклад',
    schoolPlaceholder: 'Назва навчального закладу',
    discount: 'Знижка (%)',
    discountPlaceholder: '0',
    photo: 'Фото дитини',
    uploadPhoto: 'Завантажити фото',
    changePhoto: 'Змінити фото',
    removePhoto: 'Видалити фото',
    
    // Contact info
    mainPhone: 'Основний контакт',
    additionalPhone: 'Додатковий контакт',
    contactName: "Ім'я контактної особи",
    contactNamePlaceholder: "Ім'я контактної особи",
    whoIsThis: 'Хто це',
    whoIsThisPlaceholder: 'Оберіть',
    relationMother: 'Мама',
    relationFather: 'Тато',
    relationGrandmother: 'Бабуся',
    relationGrandfather: 'Дідусь',
    relationOther: 'Інше',
    relationOtherPlaceholder: 'Вкажіть ступінь спорідненості',
    
    // Additional info
    additionalInfo: 'Додаткова інформація',
    interestedCourses: 'Курси, які зацікавили',
    interestedCoursesPlaceholder: 'Оберіть курси',
    source: 'Звідки дізналися про нас',
    sourcePlaceholder: 'Оберіть',
    sourceOtherPlaceholder: 'Вкажіть інший варіант',
    
    // Source options
    sourceSocial: 'Соціальні мережі',
    sourceFriends: 'Знайомі/Рекомендації',
    sourceSearch: 'Пошук в інтернеті',
    sourceOther: 'Інше',

    // User form
    name: "Ім'я",
    email: 'Email',
    password: 'Пароль',
    role: 'Роль',
    namePlaceholder: "Повне ім'я",
    emailPlaceholder: 'email@school.ua',
    passwordPlaceholder: 'Мін. 6 символів',

    // Group form
    groupTitle: 'Назва групи',
    course: 'Курс',
    teacher: 'Викладач',
    schedule: 'Розклад',
    dayOfWeek: 'День тижня',
    startTime: 'Час початку',
    duration: 'Тривалість',
    monthlyPrice: 'Ціна/місяць',
    pricePlaceholder: '0 UAH',
    note: 'Примітка',
    notePlaceholder: 'Введіть примітку',
    photosFolderUrl: 'Посилання на Google Drive',
    photosFolderPlaceholder: 'https://drive.google.com/...',
    selectCourse: "Оберіть курс",
    selectDay: "Оберіть день тижня",
    selectTeacher: "Оберіть викладача",
    selectStatus: "Оберіть статус",

    // Filters
    month: 'Місяць',
    group: 'Група',
    startDate: 'Дата початку навчання',
    endDate: 'Кінцева дата',
  },

  // Table headers
  table: {
    id: 'ID',
    title: 'Назва',
    description: 'Опис',
    age: 'Вік',
    duration: 'Тривалість',
    groups: 'Груп',
    students: 'Учнів',
    date: 'Дата',
    time: 'Час',
    group: 'Група',
    course: 'Курс',
    teacher: 'Викладач',
    schedule: 'Розклад',
    price: 'Ціна/міс',
    name: "Ім'я",
    role: 'Роль',
    created: 'Створено',
    phone: 'Телефон',
    parent: 'Батько',
    parentPhone: 'Телефон батька',
    total: 'Всього',
    present: 'Присутній',
    absent: 'Відсутній',
    makeup: 'Відпрацювання',
    percent: '%',
    debt: 'Борг',
    note: 'Примітка',
  },

  // Validation messages
  validation: {
    required: "Обов'язкове поле",
    invalidEmail: 'Некоректний email',
    invalidUrl: 'Некоректний формат посилання',
    minLength: 'Мінімум {min} символів',
    maxLength: 'Максимум {max} символів',
    selectCourse: "Оберіть курс",
    selectDay: "Оберіть день тижня",
    selectTime: "Вкажіть час",
    selectTeacher: "Оберіть викладача",
    invalidTime: "Некоректний формат часу",
    invalidTitleFormat: "Назва групи має формат: 'Пн 16:30 Назва курсу'",
    invalidAgeFormat: 'Вік повинен бути цілим числом від 0 до 99',
  },

  // Toast/notification messages
  toasts: {
    created: 'Успішно створено',
    updated: 'Успішно оновлено',
    deleted: 'Успішно видалено',
    archived: 'Успішно архівовано',
    restored: 'Успішно відновлено',
    saved: 'Успішно збережено',
    error: 'Сталася помилка. Спробуйте ще раз.',
    networkError: 'Помилка мережі. Спробуйте ще раз.',
    groupCreated: 'Групу успішно створено',
    groupUpdated: 'Групу успішно оновлено',
    studentAdded: 'Учня успішно додано до групи',
    studentRemoved: 'Учня успішно видалено з групи',
  },

  // Auth messages
  auth: {
    invalidCredentials: 'Неправильний email або пароль',
    sessionExpired: 'Сесія закінчилася — увійдіть знову',
    unauthorized: 'Необхідна авторизація',
    forbidden: 'Недостатньо прав доступу',
    loginFailed: 'Помилка входу',
    emailRequired: "Email обов'язковий",
    passwordRequired: "Пароль обов'язковий",
  },

  // API errors
  errors: {
    internal: 'Внутрішня помилка сервера',
    notFound: 'Не знайдено',
    badRequest: 'Невірний запит',
    unauthorized: 'Необхідна авторизація',
    forbidden: 'Недостатньо прав доступу',
    invalidData: 'Невірні дані',
    emailExists: 'Користувач з таким email вже існує',
  },

  // Empty states
  emptyStates: {
    noCourses: 'Курсів не знайдено',
    noCoursesHint: 'Створіть перший курс для початку роботи',
    createCourse: 'Створити курс',

    noGroups: 'Груп не знайдено',
    noGroupsHint: 'Створіть першу групу для початку роботи',
    noGroupsTeacher: 'У вас немає призначених груп',
    createGroup: 'Створити групу',

    noStudents: 'Учнів не знайдено',
    noStudentsHint: 'Додайте першого учня',
    addStudent: 'Додати учня',
    noStudentsInGroup: 'У цій групі немає учнів',
    addStudentToGroup: 'Додати учня до групи',

    noUsers: 'Користувачів не знайдено',

    noLessons: 'Немає запланованих занять',
    noLessonsHint: 'Виберіть фільтри та натисніть "Оновити" для перерахунку',

    selectFilters: 'Виберіть фільтри та натисніть "Оновити" для перерахунку',
  },

  // Modal titles
  modals: {
    newCourse: 'Новий курс',
    editCourse: 'Редагувати курс',
    newStudent: 'Новий учень',
    editStudent: 'Редагувати дані учня',
    newUser: 'Новий користувач',
    newGroup: 'Нова група',
    editGroup: 'Редагувати групу',
    confirmArchive: 'Архівувати?',
    confirmRestore: 'Відновити?',
    addStudentToGroup: 'Додати учня до групи',
  },

  // Form sections
  formSections: {
    studentInfo: 'Дані учня',
    contactInfo: 'Контактна інформація',
    additionalContact: 'Додатковий контакт',
    additionalInfo: 'Додатково',
  },

  // Group tabs
  groupTabs: {
    overview: 'Огляд',
    students: 'Учні',
    lessons: 'Заняття',
    attendance: 'Відвідуваність',
  },

  // Reports
  reports: {
    attendance: 'Відвідуваність',
    payments: 'Оплати',
    debts: 'Борги',
    totalPaid: 'Всього оплачено',
    cash: 'Готівка',
    account: 'Рахунок',
    operationsCount: 'Кількість операцій',
    totalDebt: 'Загальний борг',
    debtors: 'Боржників',
    debtor: 'Боржник',
  },

  // Dashboard
  dashboard: {
    activeGroups: 'Активні групи',
    upcomingLessons: 'Найближчі заняття',
    monthlyDebt: 'Борг за місяць',
    debtorsCount: 'Боржників',
    allLessons: 'Всі заняття',
  },

  // Demo
  demo: {
    title: 'Демо дані:',
    admin: 'Адмін: admin@school.ua / admin123',
    teacher: 'Викладач: teacher@school.ua / teacher123',
  },

  // Plural forms (used with pluralUk helper)
  plural: {
    student: {
      one: 'учень',
      few: 'учні',
      many: 'учнів',
    },
    group: {
      one: 'група',
      few: 'групи',
      many: 'груп',
    },
    lesson: {
      one: 'заняття',
      few: 'заняття',
      many: 'занять',
    },
    debtor: {
      one: 'боржник',
      few: 'боржники',
      many: 'боржників',
    },
    course: {
      one: 'курс',
      few: 'курси',
      many: 'курсів',
    },
    user: {
      one: 'користувач',
      few: 'користувачі',
      many: 'користувачів',
    },
    hour: {
      one: 'година',
      few: 'години',
      many: 'годин',
    },
    minute: {
      one: 'хвилина',
      few: 'хвилини',
      many: 'хвилин',
    },
    month: {
      one: 'місяць',
      few: 'місяці',
      many: 'місяців',
    },
  },

  // Confirmations
  confirm: {
    archiveCourse: 'Архівувати курс "{title}"?',
    restoreCourse: 'Відновити курс "{title}"?',
    removeStudent: 'Видалити учня "{name}" з групи?',
    deleteCourse: 'Ви впевнені, що хочете видалити курс "{title}"? Цю дію неможливо скасувати.',
  },

  // Course groups section
  courseGroups: {
    activeGroups: 'Активні групи',
    graduateGroups: 'Випущені групи',
    noGroups: 'Немає груп',
    dayTime: 'День/час',
  },

  // Flyer upload
  flyer: {
    title: 'Флаєр',
    titleOptional: 'Флаєр (необов\'язково)',
    formats: 'JPEG/PNG, макс. 5MB',
    changeFlyer: 'Змінити флаєр',
    uploadFlyer: 'Завантажити флаєр',
    deleteFlyer: 'Видалити флаєр',
    openFlyer: 'Відкрити',
    downloadFlyer: 'Завантажити',
    noFlyer: 'Флаєр відсутній',
    uploading: 'Завантаження...',
    deleting: 'Видалення...',
    selectFile: 'Оберіть файл',
    // Error messages
    invalidType: 'Непідтримуваний тип файлу. Дозволяються лише JPEG та PNG',
    tooLarge: 'Файл занадто великий. Максимальний розмір: 5MB',
    noFile: 'Файл не обрано',
    uploadFailed: 'Не вдалося завантажити флаєр',
    deleteFailed: 'Не вдалося видалити флаєр',
    deleteConfirm: 'Видалити флаєр курсу?',
  },
} as const;

export type Translations = typeof uk;
