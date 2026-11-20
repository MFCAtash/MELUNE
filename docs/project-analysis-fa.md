# تحلیل فنی جامع پروژه MELUNE (فارسی)

> سند تاریخی مورخ ۲۰۲۶-۱۱-۱۸ (نسخه ۱.۰). وضعیت فعلی و آخرین تغییرات را در [README](../README.md) و [CHANGELOG](../CHANGELOG.md) ببینید.

## 0) خلاصه اجرایی
--------------------------------------------------------------------------------
MELUNE یک مونوریپوی کامل موسیقی است که از سه لایه اصلی تشکیل شده:
  • یک اپلیکیشن وب مدرن با Next.js 14 (App Router) و React 18
  • یک API سازمان‌یافته با NestJS 10 و Prisma 5 روی PostgreSQL 16
  • یک لایه زیرساخت شامل Redis، MinIO/S3، صف پردازش صدا (ffmpeg)،
    سرویس هوش مصنوعی (FastAPI) و اپ موبایل (Expo/React Native)

نکته متمایزکننده پروژه، تمرکز سنگین روی «تجربه کاربری» است:
  • ۲۱ تم رنگی (۶ تم امضادار: Cyber Lime، Rose Quartz، Emerald Velvet،
    Golden Hour، Neon Tokyo، Aurora Noir)
  • هیرو سه‌بعدی Cover Flow با ۵ کاور
  • پلیر کامل: HLS، اکولایزر، Sleep Timer، Focus Mode، نوار صف پخش،
    Sonic Canvas (تبدیل صدا به تصویر) و خروجی کلیپ
  • PWA با حالت آفلاین و دانلود ترک‌ها در IndexedDB
  • RTL کامل و رابط دوزبانه فارسی/انگلیسی

از منظر مهندسی، پروژه یک نمونه تمیز از معماری لایه‌ای است:
Controller → Service → Prisma → PostgreSQL، با Redis برای کش،
BullMQ برای کارهای سنگین، و Socket.IO/Web Push برای اعلان‌ها.

آمار کد (فقط TS/TSX، بدون node_modules):
  • apps/web/src        : 176 فایل   ≈ 16,294 خط
  • apps/api/src        : 138 فایل   ≈  8,492 خط
  • apps/mobile         :   4 فایل   ≈    322 خط (اسکلت اولیه)
  • packages            :   2 فایل   ≈    786 خط (تایپ‌ها و کلاینت API)
  • مجموع تقریبی        : ~26,000 خط کد دست‌نویس


--------------------------------------------------------------------------------
## 1) ساختار مخزن (Monorepo Layout)
--------------------------------------------------------------------------------
MELUNE/
│
├─ apps/
│   ├─ web/                     ← Next.js 14 — رابط کاربری اصلی
│   ├─ api/                     ← NestJS 10 — REST API + WebSocket + Worker
│   └─ mobile/                  ← Expo 51 / React Native 0.74 (اسکلت)
│
├─ packages/
│   ├─ types/                   ← تایپ‌های مشترک دامنه (TypeScript)
│   ├─ api-client/              ← کلاینت تایپ‌دار فراخوانی API
│   └─ config/                  ← کانفیگ مشترک ESLint
│
├─ services/
│   └─ ai/                      ← FastAPI (Python) — سرویس پیشنهاددهنده
│
├─ infra/
│   └─ docker/                  ← Dockerfile های api / web / worker
│
├─ .github/
│   ├─ workflows/ci.yml         ← پایپ‌لاین اصلی CI
│   ├─ workflows/lockfile.yml   ← تولید دستی lockfile
│   └─ actions/install/         ← اکشن کامپوزیت نصب وابستگی‌ها
│
├─ scripts/                     ← ۱۲ اسکریپت seed / مهاجرت داده / lockfile
├─ docs/                        ← ۸ سند فنی
├─ .infra/                      ← زیرساخت محلی ویندوز (Postgres/Redis دستی)
├─ .db-backup/melune.dump       ← بکاپ دیتابیس (pg_dump، ۶۷ کیلوبایت)
│
├─ docker-compose.yml           ← ۸ سرویس
├─ package.json                 ← ریشه workspace ها
├─ package-lock.json
├─ .env / .env.example
├─ .nvmrc                       ← Node 20
├─ README.md / README-FA.md
└─ CHANGES-*.md                 ← ۲۱ سند تاریخچه تغییرات


مدیریت مونوریپو با npm Workspaces انجام می‌شود (بدون Turborepo/Nx).
ریشه، اسکریپت‌های ارکستراسیون را تعریف می‌کند:

  dev:web / dev:api / start:mobile / build / lint / test / typecheck
  docker:up / docker:down
  prisma:generate / prisma:migrate / prisma:migrate:deploy
  lockfile:generate / lockfile:check

الزام محیطی: Node.js نسخه ۲۰ یا بالاتر (.nvmrc = 20).


--------------------------------------------------------------------------------
## 2) جدول استک فناوری (خلاصه یک‌نگاهی)
--------------------------------------------------------------------------------
| لایه            | فناوری                                  | نسخه            |
|-----------------|-----------------------------------------|-----------------|
| Runtime         | Node.js                                 | 20+             |
| زبان            | TypeScript                              | 5.5.4           |
| فرانت‌اند       | Next.js (App Router)                    | 14.2.13         |
| UI              | React / React DOM                       | 18.3.1          |
| استایل          | Tailwind CSS + PostCSS + Autoprefixer   | 3.4.13          |
| State (کلاینت)  | Zustand                                 | 4.5.5           |
| State (سرور)    | TanStack Query                          | 5.59            |
| فرم             | React Hook Form + Zod + resolvers       | 7.53 / 3.23     |
| انیمیشن         | Framer Motion                           | 11.9            |
| آیکن            | Lucide React                            | 0.446           |
| استریم صدا      | hls.js                                  | 1.5.17          |
| WebSocket       | socket.io-client                        | 4.7.5           |
| تصویر           | sharp (image optimizer)                 | 0.33.5          |
| جدول داده       | TanStack Table                          | 8.20.5          |
| بک‌اند          | NestJS                                  | 10.4.4          |
| ORM             | Prisma                                  | 5.20.0          |
| دیتابیس         | PostgreSQL                              | 16              |
| کش / صف         | Redis 7 + ioredis + BullMQ              | 5.4 / 5.13      |
| احراز هویت      | Passport-JWT + @nestjs/jwt + bcryptjs   | 0.7 / 10.2 / 2.4|
| اعتبارسنجی      | class-validator + class-transformer     | 0.14 / 0.5      |
| مستندسازی API   | Swagger-compatible decorators (بدون UI) | —               |
| ذخیره‌سازی      | AWS SDK S3 + MinIO (presigned URL)      | 3.658           |
| رمزنگاری WebPush| web-push (VAPID)                        | 3.6.7           |
| Realtime        | Socket.IO + @nestjs/websockets          | 4.7.5           |
| Health          | @nestjs/terminus                        | 10.2.3          |
| Rate limit      | @nestjs/throttler                       | 6.2.1           |
| امنیت HTTP      | helmet + cookie-parser                  | 7.1 / 1.4.7     |
| آپلود/ترنسکد    | ffmpeg (داخل ایمیج worker)              | —               |
| سرویس AI        | Python + FastAPI + Uvicorn              | —               |
| موبایل          | Expo / React Native                     | 51 / 0.74.5     |
| تست API         | Jest + ts-jest + Supertest              | 29.7 / 7.0      |
| تست وب          | Vitest + Testing Library + jsdom        | 2.1 / 16 / 25   |
| تست E2E وب      | Playwright                              | 1.47.2          |
و ابزار کیفیت     | ESLint 8 + Prettier 3 + tsc --noEmit    | —               |


--------------------------------------------------------------------------------
## 3) بخش فرانت‌اند (apps/web)
--------------------------------------------------------------------------------
3.1 فریمورک و معماری
  • Next.js 14.2.13 با App Router و React Server/Client Components
  • reactStrictMode فعال
  • transpilePackages برای پکیج‌های داخلی (@melune/types, api-client)
  • next/image با remotePatterns باز (https + localhost) و optimizer مبتنی بر sharp
  • ساختار پوشه‌ها: src/app (روتینگ)، src/components، src/lib،
    src/store، src/hooks، src/types، src/styles

3.2 مسیرها (Routes)
  عمومی:
    /                          ← لندینگ (Landing)
    /login                     ← ورود
    /register                  ← ثبت‌نام
    /forgot-password           ← فراموشی رمز
    /reset-password            ← بازنشانی رمز
    /onboarding                ← انتخاب سلیقه موسیقی
  اپلیکیشن (Route Group: (app)):
    /home                      ← صفحه اصلی + هیرو Cover Flow
    /search                    ← جست‌وجوی زنده
    /library                   ← کتابخانه شخصی، پلی‌لیست‌ها، دانلودها
    /song/[id]                 ← صفحه ترک
    /album/[id]                ← صفحه آلبوم
    /artist/[id]               ← صفحه هنرمند
    /genre/[id]                ← صفحه ژانر
    /playlist/[slug]           ← صفحه پلی‌لیست
  پنل مدیریت:
    /admin                     ← داشبورد
    /admin/users               ← مدیریت کاربران
    /admin/songs               ← مدیریت ترک‌ها
    /admin/albums              ← مدیریت آلبوم‌ها
    /admin/catalog             ← کاتالوگ
    /admin/analytics           ← تحلیل‌ها

3.3 کامپوننت‌ها (۱۱ گروه)
  admin       ← جدول‌ها، فرم‌های CRUD، نمودارهای مدیریتی
  auth        ← AuthCard / AuthField / AuthSubmitButton
  home        ← هیرو Cover Flow، ردیف‌های محتوا، Ambient
  keyboard    ← میان‌برهای صفحه‌کلید و راهنما
  landing     ← صفحات بازاریابی/معرفی
  library     ← گرید کتابخانه، پلی‌لیست، دانلودها
  player      ← PlayerEngine، نوار پخش، اکولایزر، صف، Sonic Canvas
  pwa         ← ثبت Service Worker و نصب اپ
  search      ← جست‌وجوی زنده و تاریخچه
  shell       ← Sidebar، TopBar، Theme Toggle، Ambient Toggle
  ui          ← اجزای پایه (Button، Modal، Skeleton، …)

3.4 مدیریت وضعیت (State)
  Zustand (۶ استور مستقل، پایدارشده در localStorage):
    auth-store          ← کاربر، accessToken، وضعیت ورود
    player-store        ← ترک جاری، صف، تکرار، شافل، ولوم
    theme-store         ← ۲۱ تم، حالت dark/light
    ambient-theme-store ← حالت Ambient / AMOLED
    locale-store        ← زبان fa/en + RTL
    ui-store            ← مودال‌ها، Sidebar، Focus Mode
  داده‌های سرور با TanStack Query مدیریت می‌شود (کش، refetch،
  optimistic update)، نه داخل Zustand.

3.5 لایه ارتباط با API
  • packages/api-client: کلاس تایپ‌دار روی fetch با credentials: 'include'
  • src/lib/api-client.ts: نمونه singleton + مدیریت ApiError
  • توکن دسترسی در حافظه/استور و refresh token در کوکی HttpOnly
  • مسیرها و DTOها با packages/types مشترک‌اند (single source of truth)

3.6 فرم‌ها و اعتبارسنجی
  • React Hook Form + zodResolver
  • اسکیمای مشترک در src/lib/auth-schemas.ts
  • AuthField با forwardRef پیاده‌سازی شده تا ref فرم‌ها حفظ شود
    (باگ «همیشه Required» قبلاً به همین دلیل بود و رفع شد)
  • صفحه ورود شامل نمایش حساب دمو و دکمه Quick demo login است

3.7 سیستم طراحی و تم‌ها
  • Tailwind با توکن‌های معنایی: background, surface, surfaceElevated,
    border, foreground, muted, primary
  • ۲۱ تم:
      کلاسیک : dark, light, royal, aurora, noir-rose, emerald, sunset,
               cyber, champagne, ice, mocha, violet
      مناسبتی: nowruz, yalda, christmas
      امضادار: cyber-lime, rose-quartz, emerald-velvet, golden-hour,
               neon-tokyo, aurora-noir
  • هر تم مجموعه‌ای از متغیرهای CSS را بازتعریف می‌کند؛ هیچ کامپوننتی
    رنگ hard-code ندارد
  • منوی تم ۲۱ آیتمی در Theme Toggle با پیش‌نمایش گرادیانت
  • Ambient Mode: استخراج رنگ غالب کاور (Canvas + k-means سبک) و
    تزریق آن به پس‌زمینه؛ همراه با Beat Pulse
  • AMOLED Mode: پس‌زمینه کاملاً مشکی برای صرفه‌جویی انرژی

3.8 هیرو سه‌بعدی Cover Flow (چیدمان انتخابی کاربر)
  • فایل: src/components/home/hero-cover-fan.tsx + قواعد .hero-fan* در globals.css
  • ۵ کاور در یک صحنه perspective
  • هندسه کاملاً در CSS و بر اساس data-i:
      مرکز      : عرض ۹۲px
      مجاور     : عرض ۸۲px، rotateY 24deg
      بیرونی    : عرض ۷۴px، rotateY 42deg
      فاصله‌ها  : --br (روشنایی) با falloff
      بریک‌پوینت: 1400px → 108/96/86، 1536px → 118/104/92
  • Hover: spread × 1.08، بالا آمدن ۷px، rotateY → 45% مقدار،
    سایه/هاله هم‌رنگ تم
  • prefers-reduced-motion: نمایش استاتیک سه‌بعدی بدون انیمیشن
  • z-index به‌گونه‌ای تنظیم شده که هیرو هرگز روی منوی تم نیفتد
    (clipLeft/clipRight = 0 تأیید شده)

3.9 موتور پخش (PlayerEngine)
  • پشتیبانی HLS با hls.js و fallback به audioUrl ساده
  • اگر پلی‌لیست HLS خطای fatal بدهد، به‌صورت خودکار به MP3 برمی‌گردد
  • اگر نسخه آفلاین در IndexedDB موجود باشد، همان اول پخش می‌شود
  • Media Session API: کنترل از لاک‌اسکرین/نوتیفیکیشن سیستم
  • اکولایزر ۱۰ باندی (Web Audio API، BiquadFilter)
  • Sleep Timer و Focus Timer (Pomodoro) با شمارش معکوس
  • Queue Strip و امکان جابه‌جایی/حذف ترک
  • Wake Lock برای جلوگیری از خاموشی صفحه
  • Sonic Canvas: تحلیل FFT و رندر بصری + خروجی کلیپ
  • Share Card: تولید تصویر اشتراک‌گذاری از ترک جاری
  • پیش‌بارگذاری هوشمند و مدیریت crossOrigin

3.10 PWA و آفلاین
  • manifest.webmanifest: name/short_name = MELUNE، start_url=/home،
    display=standalone، theme/background = #0A0A0F، آیکن ۱۹۲/۵۱۲
  • Service Worker دستی: public/sw.js با کش melune-shell-v2
      - پیش‌کش پوسته و صفحه آفلاین
      - stale-while-revalidate برای assets
      - fallback به IndexedDB برای درخواست‌های صوتی
  • دانلود ترک برای آفلاین در IndexedDB (offline-store.ts)
  • Web Push با VAPID (سمت کلاینت: lib/push.ts)
  • نصب‌پذیری (Add to Home Screen) و بنر نصب

3.11 بین‌المللی‌سازی و RTL
  • دو زبان: فارسی (پیش‌فرض) و انگلیسی
  • دیکشنری‌های src/lib/i18n و سوییچ زبان در Shell
  • direction=rtl برای فارسی، تنظیم فونت‌ها و فاصله‌ها
  • اعداد و تاریخ فارسی در نمایش

3.12 دسترس‌پذیری و کیبورد
  • aria-label/title روی کنترل‌های آیکنی
  • فوکوس‌رینگ، نقش‌های ARIA در مودال‌ها
  • میان‌برهای صفحه‌کلید (Space, ←/→, M, /, …) با راهنمای Keyboard
  • احترام به prefers-reduced-motion و prefers-color-scheme

3.13 بهینه‌سازی عملکرد
  • Server Components برای کاهش JS اولیه
  • next/image + sharp + lazy loading
  • Code splitting طبیعی App Router
  • useDebounce برای جست‌وجو
  • کش ۳۰ ثانیه‌ای نتایج جست‌وجو در سمت API
  • Skeleton ها برای پرهیز از layout shift


--------------------------------------------------------------------------------
## 4) بخش بک‌اند (apps/api)
--------------------------------------------------------------------------------
4.1 Bootstrap (src/main.ts)
  1. helmet() برای هدرهای امنیتی
  2. cookieParser() برای refresh token
  3. CORS با credentials و لیست origin از env (پشتیبانی چند origin)
  4. ValidationPipe سراسری:
       whitelist: true
       forbidNonWhitelisted: true
       transform: true
  5. setGlobalPrefix("api")
  6. راه‌اندازی روی PORT (پیش‌فرض ۴۰۰۰)
  7. Logger محدود به error/warn/log

4.2 ماژول‌ها (۱۹ ماژول دامنه)
  admin           ← CRUD مدیریتی، آمار، کنترل نقش
  analytics       ← DAU، ژانرهای برتر، retention، گروه‌بندی داده
  auth            ← ثبت‌نام/ورود/refresh/logout/reset/verify
  catalog         ← زیرماژول‌های songs/albums/artists/genres
  common          ← فیلترها، اینترسپتورها، utils (slugify)
  config          ← اعتبارسنجی env
  discover        ← فیدهای کشف (تازه‌ها، محبوب‌ها، پیشنهادها)
  health          ← Terminus: DB و Redis
  library         ← likes / playlists / saved-items / history
  mail            ← سرویس ایمیل (stub با لاگ)
  notifications   ← اعلان درون‌برنامه‌ای + Gateway سوکت
  prisma          ← PrismaService سراسری
  push            ← Web Push با VAPID
  queue           ← BullMQ (audio-transcode) + worker
  recommendations ← content-based + collaborative + hybrid
  redis           ← RedisService + CacheService (getOrSet)
  search          ← جست‌وجوی ترکیبی + تاریخچه
  storage         ← S3/MinIO + presigned URL
  users           ← پروفایل کاربر

4.3 چرخه یک درخواست
  HTTP → ThrottlerGuard (۱۰۰/دقیقه) → JwtAuthGuard (سراسری)
       → RolesGuard (در صورت نیاز) → Controller
       → Service → Prisma → PostgreSQL / Redis / S3
       → Interceptor → پاسخ JSON استاندارد
  خطاها با Exception Filter به شکل یکسان برمی‌گردند.

4.4 احراز هویت و نشست
  • ثبت‌نام: بررسی یکتایی email/username، هش با bcrypt (cost=12)
  • ورود: bcrypt.compare + صدور accessToken (JWT) + refreshToken
  • accessToken: عمر کوتاه (پیش‌فرض 15m)، در Authorization: Bearer
  • refreshToken: عمر 7d، در کوکی HttpOnly با path=/api/auth
  • ذخیره refresh در DB به‌صورت SHA-256 hash (توکن خام ذخیره نمی‌شود)
  • چرخش (rotation): هر refresh، توکن قبلی revoked و توکن جدید صادر می‌شود
  • revoke همه نشست‌ها هنگام تغییر رمز
  • Password reset: توکن یک‌بارمصرف با TTL، هش‌شده، ابطال قبلی‌ها
  • Email verification: توکن ۲۴ ساعته
  • JWT Strategy با passport-jwt و اعتبارسنجی payload
  • @Public() برای مسیرهای آزاد، بقیه به‌صورت پیش‌فرض محافظت‌شده

4.5 کاتالوگ، کتابخانه و کشف
  • Songs/Albums/Artists/Genres با صفحه‌بندی و فیلتر
  • Like، Playlist (با slug یکتا)، PlaylistSong (ترتیب)، LibraryItem
    (نوع: SONG/ALBUM/PLAYLIST/ARTIST)، ListeningHistory
  • Discover: فیدهای تازه، پرطرفدار، «برای تو» با کش Redis
  • شمارش پخش و محبوبیت در سرویس analytics/discover

4.6 جست‌وجو (Hybrid Search)
  • جست‌وجوی واژه‌ای: ILIKE '%q%'
  • جست‌وجوی متنی: to_tsvector('simple', col) @@ plainto_tsquery(...)
  • جست‌وجوی فازی: similarity() و عملگر % با افزونه pg_trgm
  • رتبه‌بندی: GREATEST(similarity, ts_rank)
  • ایندکس‌های GIN روی ستون‌های متنی (trigram)
  • کش ۳۰ ثانیه‌ای برای quick search در Redis
  • محدودیت‌ها: QUICK_LIMIT=5، HISTORY_LIMIT=8
  • SearchHistory برای پیشنهادهای بعدی کاربر

4.7 سیستم پیشنهاددهنده
  • Content-based: بردار TF روی ویژگی‌های ترک (ژانر/هنرمند/تگ) + cosine
  • Collaborative: item-item بر پایه هم‌وقوعی در ListeningHistory/Like
  • Hybrid: ترکیب وزنی
      HYBRID_CONTENT_WEIGHT=0.6
      HYBRID_COLLABORATIVE_WEIGHT=0.4
  • سرویس TF-IDF جداگانه برای امتیازدهی متنی
  • خروجی نهایی با کش و fallback به محبوب‌ترین‌ها برای کاربر تازه

4.8 صف پردازش و استریم تطبیقی
  • BullMQ روی Redis با صف audio-transcode
  • worker جداگانه (start:worker) داخل ایمیج worker با ffmpeg
  • تولید سه کیفیت HLS: 128k / 192k / 320k
  • خروجی m3u8 + سگمنت‌ها، ذخیره در S3/MinIO
  • آپلود مستقیم با presigned URL (کلاینت → S3، بدون عبور از API)
  • فیلدهای Song: audioUrl و hlsPlaylistUrl

4.9 Realtime و اعلان
  • Socket.IO Gateway با namespace «notifications»
  • احراز هویت JWT در handshake و اتصال هر کاربر به room اختصاصی
  • رویدادهای اعلان: لایک، پلی‌لیست، سیستم
  • Notification در DB + PushSubscription برای Web Push
  • polling سبک درون‌برنامه‌ای به‌عنوان fallback

4.10 ایمیل
  • MailService فعلاً stub است و فقط URL بازیابی/تأیید را لاگ می‌کند
  • نقطه اتصال آماده برای Nodemailer/SES در فاز بعد

4.11 مدیریت و تحلیل
  • Admin: CRUD کاربران/ترک/آلبوم/کاتالوگ با کنترل نقش
  • Analytics: کاربران فعال روزانه، ژانرهای برتر، retention،
    شمارش پخش، روند رشد
  • خروجی‌ها با groupBy/raw query بهینه شده‌اند

4.12 پیکربندی و اعتبارسنجی محیط
  • env.validation.ts قبل از بالا آمدن سرور اجرا می‌شود
  • JWT_ACCESS_SECRET حداقل ۳۲ کاراکتر
  • قالب TTLها بررسی می‌شود (مثلاً 15m/7d)
  • CORS_ORIGIN باید URL مطلق باشد؛ چند مقدار با کاما
  • جفت‌های کلیدی (مثل MinIO) باید با هم تنظیم شوند


--------------------------------------------------------------------------------
## 5) دیتابیس (PostgreSQL 16 + Prisma 5)
--------------------------------------------------------------------------------
5.1 مشخصات
  • موتور: PostgreSQL 16 (تصویر postgres:16-alpine)
  • ORM: Prisma 5.20 با generator client
  • افزونه: pg_trgm (برای جست‌وجوی فازی)
  • دو مایگریشن رسمی در apps/api/prisma/migrations
  • پوشه prisma/sql برای اسکریپت‌های تکمیلی
  • بکاپ: .db-backup/melune.dump (pg_dump فرمت custom)

5.2 مدل‌ها (۱۷ مدل + ۲ enum)
  هویت و دسترسی:
    User                 ← id, email, username, password, role, avatar,
                           bio, emailVerified, deletedAt (soft delete)
    RefreshToken         ← tokenHash, expiresAt, revokedAt, userId
    PasswordResetToken   ← tokenHash, expiresAt, usedAt
    EmailVerificationToken← tokenHash, expiresAt, usedAt
    enum Role            ← USER | ARTIST | ADMIN
  کاتالوگ:
    Genre                ← name, slug
    Artist               ← name, slug, bio, imageUrl
    Album                ← title, slug, releaseDate, coverUrl, artistId
    Song                 ← title, duration, audioUrl, hlsPlaylistUrl,
                           coverUrl, playCount, genreId, artistId, albumId
  تعامل کاربر:
    Like                 ← کاربر × ترک (کلید مرکب)
    Playlist             ← title, slug, isPublic, ownerId
    PlaylistSong         ← ترتیب ترک‌ها در پلی‌لیست
    enum LibraryItemType ← SONG | ALBUM | PLAYLIST | ARTIST
    LibraryItem          ← آیتم ذخیره‌شده با نوع
    ListeningHistory     ← تاریخ پخش برای پیشنهاد و آمار
    SearchHistory        ← تاریخ جست‌وجو
  اعلان:
    Notification         ← type, payload, readAt, userId
    PushSubscription     ← endpoint, p256dh, auth

5.3 ایندکس‌ها و بهینه‌سازی
  • unique روی email/username/slug
  • ایندکس روی کلیدهای خارجی و فیلدهای مرتب‌سازی
  • GIN + pg_trgm روی title/name برای similarity و LIKE سریع
  • کوئری‌های سنگین جست‌وجو با رتبه‌بندی ترکیبی
  • کش نتایج پرتکرار در Redis برای کاهش بار DB

5.4 الگوهای داده
  • Soft delete با deletedAt در User
  • کلیدهای UUID
  • createdAt/updatedAt خودکار
  • cascade delete در روابط وابسته
  • شمارنده playCount برای محبوبیت (به‌روزرسانی در سرویس پخش)


--------------------------------------------------------------------------------
## 6) سرویس هوش مصنوعی (services/ai)
--------------------------------------------------------------------------------
  • Python + FastAPI + Uvicorn
  • فایل‌ها: app/main.py، app/config.py، tests/test_health.py،
    requirements.txt، Dockerfile، .env.example
  • endpoints:
      GET /health      ← بررسی سلامت
      POST /recommend  ← پروکسی/واسط پیشنهاد (به API اصلی)
  • جایگاه معماری: میکروسرویس مستقل، قابل توسعه با مدل‌های embedding
  • در CI و docker-compose به‌عنوان سرویس اختیاری/آینده‌دار حضور دارد


--------------------------------------------------------------------------------
## 7) اپلیکیشن موبایل (apps/mobile)
--------------------------------------------------------------------------------
  • Expo SDK 51 + React Native 0.74.5 + React 18.2
  • ماژول‌ها: expo-av (پخش)، expo-secure-store (توکن)، expo-status-bar
  • از packages/types و api-client استفاده می‌کند
  • اسکریپت‌ها: start / android / ios / web / typecheck
  • وضعیت: اسکلت اولیه (فاز ۱۰) — در CI خارج از محدوده است


--------------------------------------------------------------------------------
## 8) پکیج‌های مشترک
--------------------------------------------------------------------------------
  packages/types
    ← قراردادهای دامنه: User, Song, Album, Artist, Playlist, DTOها،
      پاسخ‌های صفحه‌بندی‌شده؛ تنها منبع حقیقت برای تایپ‌ها
  packages/api-client
    ← کلاس ApiClient روی fetch، ساخت URL، هدرها، credentials،
      نرمال‌سازی خطا (ApiError)؛ مصرف‌شده در web و mobile
  packages/config
    ← eslint-base.js مشترک برای یکدستی قواعد


--------------------------------------------------------------------------------
## 9) زیرساخت و DevOps
--------------------------------------------------------------------------------
9.1 docker-compose.yml — ۸ سرویس روی شبکه melune-network
  postgres        ← postgres:16-alpine، پورت 5432، volume، healthcheck
  redis           ← redis:7-alpine، پورت 6379، volume، healthcheck
  minio           ← ذخیره‌سازی S3-compatible (نسخه pin شده)
  minio-init      ← ساخت bucket و سیاست دسترسی
  api             ← ایمیج api.Dockerfile، پورت 4000
  web             ← ایمیج web.Dockerfile، پورت 3000
  transcode-worker← ایمیج worker.Dockerfile (ffmpeg + BullMQ)
  ai              ← سرویس FastAPI
  نکته: تصاویر pin شده‌اند (بدون :latest) تا ارتقای ناخواسته رخ ندهد.

9.2 Dockerfile ها (infra/docker)
  همه multi-stage، بر پایه node:20-alpine، با کاربر غیر root و HEALTHCHECK:
  api.Dockerfile
    deps   : کپی همه package.json ها + npm ci --workspace=apps/api
    build  : prisma generate + nest build
    runtime: فقط dist + node_modules لازم + Prisma engine
  web.Dockerfile
    deps/build/runtime؛ next build و اجرای standalone/next start
  worker.Dockerfile
    نصب ffmpeg + کد API + اجرای start:worker

9.3 اجرای محلی روی ویندوز (بدون Docker)
  پوشه .infra شامل باینری‌های portable است:
    pgsql16/        ← PostgreSQL 16
    pgdata/         ← data directory
    redis-win/      ← Redis برای ویندوز
    logs/           ← لاگ سرویس‌ها
  اسکریپت‌های راه‌اندازی/توقف در ریشه و README مربوطه
  پورت‌های فعال: 5432 (DB) · 6379 (Redis) · 4000 (API) · 3000 (Web)

9.4 پیکربندی محیط (.env.example)
  DATABASE_URL=postgresql://melune:melune_dev_password@localhost:5432/melune_music
  POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB
  REDIS_URL=redis://localhost:6379
  JWT_ACCESS_SECRET (≥32 char) / JWT_ACCESS_EXPIRES_IN=15m /
  JWT_REFRESH_EXPIRES_IN=7d
  CORS_ORIGIN، MAIL_FROM، تنظیمات MinIO/S3، کلیدهای VAPID،
  وزن‌های HYBRID_CONTENT_WEIGHT و HYBRID_COLLABORATIVE_WEIGHT

9.5 اسکریپت‌های داده (scripts/)
  bootstrap-lockfile.sh، check-lockfile.mjs
  seed-catalog.mjs، seed-covers.mjs، resolve-real-songs.mjs
  seed-artists.sql، seed-playcounts.sql، localize-audio-urls.sql،
  localize-real.sql، fix-shadmehr-album.sql
  catalog-data.json، real-catalog.json
  ← ابزار مهاجرت داده از کاتالوگ نمونه به کاتالوگ واقعی و بومی‌سازی URLها


--------------------------------------------------------------------------------
## 10) CI/CD (.github)
--------------------------------------------------------------------------------
10.1 ci.yml — تریگرها: push/PR روی main + workflow_dispatch
  • permissions: contents: read (اصل حداقل دسترسی)
  • concurrency با cancel-in-progress (جلوگیری از اجرای هم‌زمان)
  • env های CI-only (هیچ اعتبارنامه واقعی)
  • Node 20

  Job ها به ترتیب وابستگی:
   1) lockfile
      ← بررسی وجود/هم‌خوانی package-lock.json با package.json ها
   2) schema-drift
      ← prisma migrate diff --exit-code
      ← تضمین اینکه schema.prisma با مایگریشن‌ها یکی است
   3) api
      ← سرویس‌های postgres و redis
      ← prisma migrate deploy روی DB تست
      ← lint + typecheck + jest + e2e + build
      ← آپلود artifact پوشش تست
   4) web
      ← lint + typecheck + vitest + next build
   5) web-e2e
      ← Playwright در برابر API ماک‌شده روی پورت 4310

10.2 lockfile.yml
  ← گردش‌کار دستی برای بازتولید lockfile در محیط تمیز

10.3 .github/actions/install
  ← اکشن کامپوزیت مشترک: setup-node + cache + npm ci

نکته: apps/mobile و services/ai طبق README خارج از محدوده CI هستند.


--------------------------------------------------------------------------------
## 11) مانیتورینگ، لاگ و سلامت
--------------------------------------------------------------------------------
  • GET /api/health با @nestjs/terminus
      - Postgres: اجباری (critical)
      - Redis: نرم (soft/optional)
  • HEALTHCHECK در همه Dockerfile ها و در compose
  • Logger استاندارد Nest با سطوح error/warn/log
  • لاگ درخواست‌ها/خطاها از طریق فیلترها و اینترسپتورها
  • صف BullMQ قابل مشاهده از Redis
  • وضعیت فعلی: بدون Sentry/OpenTelemetry/Prometheus/Grafana
    (نقطه توسعه آینده؛ ساختار ماژولار اجازه تزریق آسان را می‌دهد)


--------------------------------------------------------------------------------
## 12) تست‌نویسی
--------------------------------------------------------------------------------
12.1 بک‌اند — Jest + ts-jest + Supertest
  ۲۴ فایل unit spec:
    admin, analytics, auth, albums, artists, genres, songs, slugify,
    env.validation, discover, history, likes, playlists, saved-items,
    notifications.gateway, notifications.service, push,
    collaborative, hybrid-recommendations, recommendations, search,
    storage, users
  ۸ فایل e2e:
    auth, catalog, library, search, users, admin, discover, health
  پوشش: منطق احراز هویت، قواعد دسترسی، جست‌وجو، پیشنهادها،
  صفحه‌بندی، اعتبارسنجی env، و مسیرهای HTTP کامل

12.2 فرانت‌اند — Vitest + Testing Library + jsdom
  ۲۸ فایل تست واحد برای استورها، هوک‌ها، utils و کامپوننت‌ها
  ۳ فایل Playwright:
    e2e/login.spec.ts
    e2e/player.spec.ts
    e2e/playlist.spec.ts
  شبیه‌ساز API: e2e/utils/mock-api.ts برای تست مستقل از بک‌اند

12.3 کیفیت کد
  ESLint 8 (+ config های Next و TS)، Prettier 3،
  tsc --noEmit در هر دو اپ (وضعیت فعلی: ۰ خطا)
  اجرای سراسری: npm run lint / typecheck / test


--------------------------------------------------------------------------------
## 13) مستندسازی
--------------------------------------------------------------------------------
docs/ (۸ سند تخصصی):
  architecture.md   ← معماری، مرز ماژول‌ها، فازها
  api.md            ← مرجع endpoint ها، قواعد احراز هویت
  database.md       ← مدل داده، مایگریشن‌ها، دلیل نبود ستون tsvector
  deployment.md     ← Docker، محیط، متغیرها
  design-system.md  ← توکن‌ها، تم‌ها، اجزای UI
  development.md    ← راه‌اندازی محلی، اسکریپت‌ها، عیب‌یابی
  ai.md             ← سرویس FastAPI و قرارداد پیشنهاد
  lockfile.md       ← سیاست قفل وابستگی‌ها

به‌علاوه:
  README.md و README-FA.md (شرح کامل، دمو، پورت‌ها، تست)
  ۲۱ فایل CHANGES-*.md ← تاریخچه تصمیم‌ها و اصلاحات امنیتی/CI
  README های داخلی برای mobile، infra و سرویس‌ها
  کامنت‌های توضیحی در نقاط حساس (مثلاً دلیل wildcard در next/image)


--------------------------------------------------------------------------------
## 14) امنیت — لایه به لایه
--------------------------------------------------------------------------------
لایه شبکه/HTTP
  • helmet: CSP، X-Frame-Options، nosniff، HSTS و …
  • CORS محدود به origin های مجاز، با credentials
  • کوکی refresh: HttpOnly + SameSite + Secure در تولید + path محدود

احراز هویت
  • bcrypt با cost=12 برای رمز عبور
  • access token کوتاه‌عمر، refresh token چرخشی
  • ذخیره refresh فقط به‌صورت SHA-256 (درز DB بی‌فایده است)
  • revoke صریح در logout و تغییر رمز
  • توکن‌های reset/verify یک‌بارمصرف، هش‌شده و دارای TTL
  • JwtAuthGuard سراسری + استثنای صریح @Public()

مجوزدهی
  • RolesGuard و enum Role (USER/ARTIST/ADMIN)
  • کنترل مالکیت منابع (پلی‌لیست/کتابخانه) در Service
  • مسیرهای /admin جداگانه و محافظت‌شده

ورودی و داده
  • ValidationPipe با whitelist + forbidNonWhitelisted
  • DTO های class-validator روی همه ورودی‌ها
  • Prisma با پارامترسازی کوئری (بدون string concat خطرناک)
  • کوئری‌های raw جست‌وجو با پارامتر bind شده
  • اعتبارسنجی env قبل از بوت (fail-fast)

محدودسازی نرخ
  • ThrottlerGuard سراسری: ۱۰۰ درخواست در دقیقه
  • مسیرهای auth: ۵ درخواست در دقیقه برای هر IP
  • کاهش سطح حمله brute-force و enumeration

زیرساخت
  • کانتینرها با کاربر غیر root
  • تصاویر pin شده
  • .dockerignore برای جلوگیری از کپی .env و data
  • secrets از env، بدون hard-code در کد
  • presigned URL با انقضای کوتاه برای آپلود/دانلود

ریسک‌های شناخته‌شده (با آگاهی)
  • MailService هنوز stub است (نیاز به SMTP واقعی)
  • next/image همه https ها را مجاز می‌کند (بازه امنیتی بازتر)
  • توکن access در حافظه کلاینت نگه‌داری می‌شود (XSS → سرقت)
  • نبود WAF/rate-limit توزیع‌شده در لبه


--------------------------------------------------------------------------------
## 15) عملکرد و مقیاس‌پذیری
--------------------------------------------------------------------------------
  • کش Redis با getOrSet و TTL برای جست‌وجو/کشف
  • HLS تطبیقی برای شبکه‌های ضعیف + fallback MP3
  • presigned upload برای حذف گلوگاه API در آپلود
  • صف مستقل برای ترنسکد (مقیاس افقی worker)
  • ایندکس‌های trigram برای جست‌وجوی فازی سریع
  • صفحه‌بندی اجباری روی لیست‌ها
  • Query caching در TanStack Query و optimistic updates
  • PWA/IndexedDB برای پخش بدون شبکه
  • code splitting و Server Components در Next


--------------------------------------------------------------------------------
## 16) تجربه کاربری و ویژگی‌های شاخص
--------------------------------------------------------------------------------
  • ۲۱ تم با پیش‌نمایش و ذخیره انتخاب
  • هیرو Cover Flow سه‌بعدی با ۵ کاور (بدون انسداد منو)
  • Ambient Mode: پس‌زمینه هم‌رنگ کاور + Beat Pulse
  • AMOLED Mode
  • اکولایزر ۱۰ باندی و ذخیره پروفایل
  • Sleep Timer / Focus Timer
  • Sonic Canvas و خروجی کلیپ تصویری
  • Share Card برای اشتراک‌گذاری ترک
  • صف پخش قابل ویرایش + شافل/تکرار
  • جست‌وجوی زنده + تاریخچه + پیشنهاد
  • کتابخانه با Like/Playlist/ذخیره‌سازی/تاریخچه
  • دانلود آفلاین و پخش از IndexedDB
  • اعلان Real-time + Web Push
  • Onboarding سلیقه موسیقی
  • رابط فارسی RTL + انگلیسی LTR
  • دسترس‌پذیری: ARIA، فوکوس، کاهش انیمیشن


--------------------------------------------------------------------------------
## 17) جریان‌های کلیدی (End-to-End)
--------------------------------------------------------------------------------
ورود:
  Login Page → POST /api/auth/login → bcrypt.compare → JWT + refresh
  → کوکی HttpOnly + access در استور → redirect به /home

پخش یک ترک:
  کلیک → player-store → بررسی IndexedDB (آفلاین؟) → HLS یا MP3
  → Media Session → ثبت ListeningHistory → به‌روزرسانی playCount

جست‌وجو:
  تایپ (debounce) → GET /api/search/quick → Redis (TTL 30s)
  → در صورت miss: ILIKE + tsvector + similarity → نتایج رتبه‌بندی‌شده

آپلود و ترنسکد (مدیر/هنرمند):
  درخواست presigned URL → آپلود مستقیم به MinIO/S3
  → ثبت Song → افزودن job به BullMQ → worker با ffmpeg سه رندیشن HLS
  → به‌روزرسانی hlsPlaylistUrl → قابل پخش تطبیقی

اعلان:
  رویداد در API → Notification در DB → emit به room کاربر
  → دریافت در کلاینت (Socket) یا Web Push در نبود اپ


--------------------------------------------------------------------------------
## 18) اجرا و راه‌اندازی
--------------------------------------------------------------------------------
پیش‌نیازها:
  Node.js 20+، npm، PostgreSQL 16، Redis 7 (یا Docker)

روش Docker (توصیه‌شده):
  cp .env.example .env        # سپس مقادیر را تنظیم کنید
  npm run docker:up           # ۸ سرویس
  docker compose down         # توقف

روش محلی ویندوز (وضعیت فعلی):
  .infra/pgsql16  روی 5432
  .infra/redis-win روی 6379
  API : npm run dev:api   → http://localhost:4000/api
  Web : npm run dev:web   → http://localhost:3000

دیتابیس:
  npm run prisma:migrate:deploy
  npm run prisma:generate
  بازیابی بکاپ: pg_restore -d melune_music .db-backup/melune.dump

حساب دمو:
  email    : demo@melune.app
  password : melune12345
  (دکمه Quick demo login نیز در صفحه ورود موجود است)

تست:
  npm run test          # همه workspace ها
  npm run test:cov      # پوشش API
  npm run test:e2e      # e2e بک‌اند
  npm run --workspace=apps/web test:e2e   # Playwright


--------------------------------------------------------------------------------
## 19) محدودیت‌ها، بدهی فنی و نقشه راه
--------------------------------------------------------------------------------
  • apps/mobile اسکلت است (فاز ۱۰) و در CI نیست
  • services/ai حداقلی است؛ مدل واقعی embedding/ML ندارد
  • MailService stub است؛ ارسال واقعی ایمیل پیاده نشده
  • Swagger UI فعال نیست (فقط decorator ها)
  • مانیتورینگ فقط health check است؛ observability کامل نیست
  • تست پوشش UI محدود به ۳ سناریوی Playwright
  • next/image همه دامنه‌های https را می‌پذیرد
  • توکن دسترسی در حافظه است (ریسک XSS)
  • وابستگی به ffmpeg برای HLS (نیاز به منابع worker)
  • نبود صف retry پیشرفته/dead-letter سفارشی

مسیر پیشنهادی بعدی:
  1. اتصال SMTP واقعی + قالب‌های ایمیل
  2. Sentry + OpenTelemetry + داشبورد Grafana
  3. تکمیل اپ موبایل و هم‌ترازی فیچرها
  4. مدل پیشنهاد مبتنی بر embedding در سرویس AI
  5. انتقال توکن به کوکی HttpOnly کامل + CSRF token
  6. محدودکردن دامنه‌های تصویر و افزودن CSP دقیق‌تر
  7. گسترش تست‌های E2E و پوشش شاخه‌ها


--------------------------------------------------------------------------------
## 20) جمع‌بندی
--------------------------------------------------------------------------------
MELUNE یک نمونه کامل و جدی از یک پلتفرم استریم مدرن است:
معماری مونوریپو با مرزهای روشن، فرانت‌اند تجربه‌محور با Next.js،
بک‌اند ماژولار با NestJS، داده‌ی رابطه‌ای با PostgreSQL + Prisma،
کش و صف با Redis/BullMQ، استریم تطبیقی HLS، جست‌وجوی فازی واقعی،
پیشنهاددهنده هیبریدی، PWA آفلاین، ۲۱ تم، پلیر حرفه‌ای،
و یک پایپ‌لاین CI با کنترل drift اسکیما.

نقاط قوت اصلی:
  ✔ جداسازی مسئولیت‌ها و تایپ‌های مشترک
  ✔ امنیت لایه‌ای (هش، چرخش توکن، rate limit، validation)
  ✔ تجربه کاربری متمایز (تم‌ها، هیرو، Ambient، Sonic Canvas)
  ✔ زیرساخت قابل اجرا هم با Docker و هم به‌صورت محلی
  ✔ تست و مستندسازی در سطح قابل قبول برای این مرحله

نقاط قابل بهبود:
  ✘ تکمیل سرویس ایمیل، موبایل و AI
  ✘ observability حرفه‌ای
  ✘ سخت‌تر کردن مرزهای امنیتی کلاینت

---
پایان سند — MELUNE Project Technical Analysis
مسیر پروژه: MELUNE/
