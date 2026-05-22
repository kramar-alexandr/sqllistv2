# SQLLISTv2 — CLAUDE.md

Контекст проекта для AI-агента. Читай этот файл целиком перед любой работой.

---

## Что это

React + Node.js приложение — список заказов ORVC из MSSQL (HansaWorld / Standard ERP).
Замена старой версии на Tabulator (gc_sql_lists), которая загружала 2000 записей сразу.

**Ключевое отличие от старой версии:**
- Загружает только видимые строки (TanStack Virtual + постраничный SQL)
- Нет ограничения на количество записей — весь ORVC
- Live sync без полной перезагрузки — точечное обновление через diff topIds

---

## Запуск

```bash
# Терминал 1 — сервер (порт из .env, сейчас 3006)
cd server && npm run dev

# Терминал 2 — клиент (порт 5173, Vite dev server)
cd client && npm run dev
```

Открыть: `http://localhost:5173/list/ORVC/html/list-2.html?compno=1&salesman=ABC&salesgroup=GRP&user=ABC`

**URL структура:** `/list/{TABLE}/html/list-2.html`
- Таблица читается из пути: `/list/ORVC/...` → компонент `ORVCList`
- Каждая новая таблица — отдельный компонент, добавляется в `App.tsx`
- Prod: `https://hansa.goldencatch.fishing/list/ORVC/html/list-2.html`

**URL-параметры:**
| Параметр | Описание |
|---|---|
| `compno` | Номер компании (default: 1) |
| `salesman` | Фильтр по менеджеру |
| `salesgroup` | Фильтр по группе менеджеров |
| `user` | Код текущего пользователя (используется для фильтра "Свои") |
| `searchstr` | Полнотекстовый поиск (FTS + LIKE fallback) |

**Первый запуск:**
```bash
cd server && npm install
cd client && npm install
cp .env.example server/.env   # заполнить реальными данными
```

---

## Структура проекта

```
SQLLISTv2/
├── server/
│   ├── src/
│   │   ├── server.js          # Fastify сервер, порт 3001, CORS включён
│   │   ├── db.js              # Knex (MSSQL) — берёт конфиг из .env
│   │   └── routes/
│   │       └── orvc.js        # Все 4 API endpoint'а
│   ├── package.json
│   └── .env                   # НЕ в git — DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT
└── client/
    ├── vite.config.ts          # proxy /api → localhost:3001
    ├── src/
    │   ├── App.tsx             # QueryClientProvider + читает URL params
    │   ├── App.css             # Все стили (нет внешних UI-библиотек)
    │   ├── main.tsx
    │   ├── types/orvc.ts       # TypeScript типы: ORVCRow, ORVCFilters, FilterMode, ответы API
    │   ├── api/orvc.ts         # fetch-функции для 4 endpoint'ов
    │   ├── hooks/
    │   │   ├── useORVCList.ts  # Главный хук: count query + useQueries для страниц + row lookup
    │   │   └── useLiveSync.ts  # 5s polling /sync, invalidate page 0 при изменении topIds
    │   └── components/
    │       ├── ORVCList.tsx    # Корневой компонент: filterMode state, строит ORVCFilters
    │       ├── FilterPanel.tsx # Радиокнопки статусов + чекбокс "Свои"
    │       ├── VirtualTable.tsx # useVirtualizer + useORVCList + useLiveSync
    │       ├── TableRow.tsx    # Одна строка + SkeletonRow, ROW_HEIGHT=22px
    │       └── OrderModal.tsx  # Детали заказа + отгрузки по клику на ℹ
    └── package.json
```

---

## API (server/src/routes/orvc.js)

Все endpoint'ы принимают одинаковый набор filter-параметров:

**Общие параметры фильтрации:**
| Параметр | Тип | Описание |
|---|---|---|
| `compno` | number | Номер компании |
| `salesgroup` | string | `WHERE SALESGROUP = ?` |
| `salesman` | string | `WHERE SALESMAN = ?` |
| `ownsalesman` | string | `WHERE SALESMAN = ?` (для "Свои") |
| `filter` | string | Выражение: `CLOSED==0 and CUSTOMSTATUSFLAG==1` |
| `searchstr` | string | Full-text search (FTS + LIKE fallback) |

**Endpoint'ы:**

```
GET /api/v2/orvc/count
→ { total: number }
Только COUNT(*). Используется для виртуального размера списка.

GET /api/v2/orvc/rows?offset=0&limit=50&orderBy=SERNR&order=desc
→ { data: ORVCRow[], offset: number, limit: number }
Страница данных. Максимум 200 строк за запрос.
Всегда делает LEFT JOIN SHVC для поля SORTING.

GET /api/v2/orvc/sync
→ { total: number, topIds: number[] }
Дешёвый endpoint для live sync. COUNT + TOP 100 SERNR DESC.
Клиент сравнивает topIds с предыдущим ответом — если изменились,
инвалидирует page 0 через React Query.

GET /api/v2/orvc/order?sernr=123&compno=1
→ { sernr, compno, order: ORVCRow|null, shipments: SHVCRow[] }
Детали одного заказа + его отгрузки из SHVC.
```

---

## Колонки ORVC (возвращаемые в /rows)

```javascript
['SERNR', 'OKFLAG', 'SHIPMARK', 'INVMARK', 'ORDDATE', 'LOCATION',
 'CUSTORDNR', 'CUSTCODE', 'ADDR0', 'OFFICIALSERNR', 'LASTSHIPDATE',
 'ORDERCLASS', 'SUM4', 'CUSTOMSTATUSFLAGTEXT', 'CUSTOMSTATUSFLAG',
 'FEEDBACKSTATUS', 'WAITINGFORITEMSDATE', 'WAITINGFORITEMSTIME',
 'TRANSPORTNUMBER', 'PHONE', 'NPPHONE', 'rdbCOMMENT', 'SALESMAN',
 'COMMENT2', 'COMMENT3', 'COMMENT4',
 'SHVC_filtered.SORTING'   // ← из LEFT JOIN SHVC
]
```

**Трансформации на сервере перед отдачей:**
- `ORDDATE`, `LASTSHIPDATE` → `YYYY-MM-DD`
- `OKFLAG`, `SHIPMARK`, `INVMARK`: `0→''`, `1→'✓'`, `18→'✓'`

---

## Фильтры (ORVCList.tsx → FILTER_EXPR)

```typescript
const FILTER_EXPR: Record<FilterMode, string> = {
  main:            'CLOSED==0 and CUSTOMSTATUSFLAG<>9 and CUSTOMSTATUSFLAG<>10',
  all:             '',
  new:             'CLOSED==0 and CUSTOMSTATUSFLAG==0',
  open:            'CLOSED==0 and CUSTOMSTATUSFLAG==1',
  confirmed:       'CLOSED==0 and CUSTOMSTATUSFLAG==2',
  nocall:          'CLOSED==0 and CUSTOMSTATUSFLAG==3',
  changed:         'CLOSED==0 and CUSTOMSTATUSFLAG==4',
  vsborke:         'CLOSED==0 and CUSTOMSTATUSFLAG==5',
  sobran:          'CLOSED==0 and CUSTOMSTATUSFLAG==6',
  otpravlen:       'CLOSED==0 and CUSTOMSTATUSFLAG==7',
  dostavlen:       'CLOSED==0 and CUSTOMSTATUSFLAG==8',
  complete:        'CLOSED==0 and CUSTOMSTATUSFLAG==9',
  canceled:        'CLOSED==0 and CUSTOMSTATUSFLAG==10',
  pending_payment: 'CLOSED==0 and CUSTOMSTATUSFLAG==11',
  pending_stock:   'CLOSED==0 and CUSTOMSTATUSFLAG==12',
  no_stock:        'CLOSED==0 and CUSTOMSTATUSFLAG==13',
  approved:        'CLOSED==0 and CUSTOMSTATUSFLAG==14',
  sorting:         'CLOSED==0 and SHVC_filtered.SORTING==`ОТГРУЖЕНО`',
};
```

Выражения парсятся в `applyFilterExpr()` в [server/src/routes/orvc.js](server/src/routes/orvc.js).
Поддерживаемые операторы: `==`, `!=`, `<>`, `like`. Несколько значений одного поля через `<>` → `whereNotIn`.

---

## Цветовая индикация строк (TableRow.tsx)

```typescript
const STATUS_CLASS: Record<number, string> = {
  1: 'row-red', 3: 'row-red', 4: 'row-red', 12: 'row-red', 13: 'row-red',
  2: 'row-yellow',
  5: 'row-green', 6: 'row-green', 7: 'row-green', 8: 'row-green', 11: 'row-green',
};
```

Флаг `0`, `9`, `10`, `14` — нет подсветки (белый фон).
Выбранная строка: класс `row-selected` (синий, override всех цветов).

---

## Архитектура виртуального скролла

### Концепция

```
total (из /count) → useVirtualizer({ count: total })
                         ↓
               virtualItems[] — только видимые + overscan=8
                         ↓
         visiblePageIndices = Set(Math.floor(item.index / 50))
                         ↓
         useQueries(visiblePageIndices) — TanStack Query per page
                         ↓
         rowMap: Map<rowIndex, ORVCRow> — lookup для рендера
```

### Ключевые константы (useORVCList.ts)

```typescript
PAGE_SIZE = 50        // строк на страницу SQL
STALE_TIME = 8_000    // страница считается свежей 8с
REFETCH_MS = 10_000   // фоновый перезапрос каждые 10с
```

### Константы Live Sync (useLiveSync.ts)

```typescript
SYNC_INTERVAL = 5_000   // опрос /sync каждые 5с
```

Sync сравнивает первые 20 элементов topIds. Если изменились:
- `queryClient.invalidateQueries(['orvc', 'page', 0, fKey])` → страница 0 перезапрашивается
- `queryClient.setQueryData(['orvc', 'count', fKey], { total })` → высота скролла обновляется

Удалённые записи из середины списка обнаруживаются автоматически через `refetchInterval: 10_000` на страницах — после перезапроса страница содержит актуальные данные со смещёнными строками.

---

## База данных (MSSQL)

Таблица **ORVC** — заказы. Ключевые поля:
- `SERNR` — уникальный номер заказа (PK)
- `compno` — номер компании (обязателен в WHERE для multi-company)
- `CLOSED` — `0` = открыт, `1` = закрыт
- `CUSTOMSTATUSFLAG` — статус (0-14)
- `CUSTOMSTATUSFLAGTEXT` — текстовое описание статуса
- `SALESMAN` — код менеджера
- `SALESGROUP` — группа менеджеров

Таблица **SHVC** — отгрузки. JOIN к ORVC:
```sql
LEFT JOIN (
  SELECT compno, ORDERNR, SORTING,
         ROW_NUMBER() OVER (PARTITION BY compno, ORDERNR ORDER BY SORTING) AS rn
  FROM SHVC WHERE SORTING IS NOT NULL AND SORTING != ''
) SHVC_filtered
ON SHVC_filtered.compno = ORVC.compno
AND SHVC_filtered.ORDERNR = ORVC.SERNR
AND SHVC_filtered.rn = 1
```
Берём только первую отгрузку с SORTING (для колонки "Отгр." в списке).

**Search** по ORVC использует Full-Text Search (CONTAINS) для текстовых полей + LIKE для SERNR, CUSTORDNR, PHONE, NPPHONE.

---

## Query Keys (TanStack Query)

```typescript
['orvc', 'count', filterKey]          // COUNT query
['orvc', 'page', pageIndex, filterKey] // страница данных
['orvc', 'order', sernr, compno]       // детали заказа
```

`filterKey` = `JSON.stringify` отсортированных непустых filter-параметров.
При смене фильтров filterKey меняется → все старые страницы автоматически игнорируются (новые запросы с новым ключом).

---

## Стили (App.css)

Единый CSS-файл, без UI-библиотек. Ширины колонок объявлены классами `.tc-*` и **должны совпадать** с массивом `COLUMNS` в `VirtualTable.tsx`. При добавлении колонки нужно синхронно изменить оба места.

Текущие ширины:
```
tc-info: 28px | tc-sernr: 62px | tc-mark: 28px (×3) | tc-date: 76px
tc-location: 78px | tc-custordnr: 100px | tc-custcode: 96px
tc-addr: 220px | tc-officialsernr: 116px | tc-orderclass: 58px
tc-sum: 80px | tc-status: 120px | tc-sorting: 44px
```

---

## Зависимости

**Server:**
- `fastify` ^5 + `@fastify/cors` — HTTP сервер
- `knex` + `mssql` — SQL-запросы к MSSQL
- `dotenv` — конфиг из .env

**Client:**
- `@tanstack/react-virtual` ^3 — виртуальный скролл
- `@tanstack/react-query` ^5 — кеш, фоновые запросы, stale/refetch
- `react` ^18 + `vite` ^5 + `typescript` ^5

---

## Окружение (.env в server/)

```
PORT=3001
DB_HOST=...
DB_PORT=1433
DB_USER=...
DB_PASSWORD=...
DB_NAME=...
```

---

## GitLab

Репозиторий: `git@git.erpjs.biz:golden-catch/sqllistv2.git`
Группа: `golden-catch`, видимость: Internal

Старый проект (Tabulator, не React): `git@git.erpjs.biz:golden-catch/gc_sql_lists.git`
Там же живут SQL-индексы (`sql/ORVC_optimization_indexes.sql`) и `static/ORVC/` со старым HTML.

---

## Известные ограничения и точки роста

- Сортировка сейчас жёстко `SERNR DESC`. Добавить сортировку по клику на заголовок: нужно пробросить `orderBy`/`order` через state в `ORVCList` → `filters` → `useORVCList`.
- Поиск (searchstr) пока не реализован в UI — поле есть в `ORVCFilters` и API, нужно добавить `<input>` в `ORVCList`.
- При добавлении новых таблиц (SHVC, CUVC и т.д.) — создавать отдельный файл `routes/shvc.js` по образцу `routes/orvc.js`, добавлять в `server.js` через `server.register(shvcRoutes, { prefix: '/api/v2' })`.
