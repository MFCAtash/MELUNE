# استقرار MELUNE روی Oracle Cloud + Cloudflare (راهنمای کامل فارسی)

> نسخهٔ بهروزشده: ۲۰۲۶-۱۱-۱۹  ·  منبع انگلیسی و همیشه بهروز: [docs/deploy-oracle-cloudflare.md](deploy-oracle-cloudflare.md)

# استقرار MELUNE روی Oracle Cloud + Cloudflare (روش B)

این سند چک‌لیست کامل و گام‌به‌گام روش **B** است: یک VM از Oracle Cloud Always Free که تمام سرویس‌ها (Web، API، Postgres، Redis، MinIO، Worker و Caddy) روی آن با Docker Compose اجرا می‌شوند و Cloudflare دامنه، TLS و CDN را مدیریت می‌کند.

> **نتیجه:** هزینهٔ ماهانه و سالانه صفر است. دامنه از قبل در اختیار شماست (`melune.app` روی Cloudflare) و فقط دو رکورد جدید برای این اپ اضافه می‌شود؛ رکوردهای اپ فعلی (coach زبان) دست‌نخورده می‌مانند. کل ترافیک کاربر از یک origin (همان دامنه) عبور می‌کند، بنابراین مشکل CORS، کوکی cross-site، WebSocket و HLS وجود ندارد.
>
> **دو آدرس نهایی:**
> - اپ: `https://music.melune.app`
> - رسانه: `https://music-media.melune.app`
>
> چرا `music-media` و نه `media.music`؟ گواهی رایگان Universal SSL کلادفلر فقط `melune.app` و یک سطح زیردامنه (`*.melune.app`) را پوشش می‌دهد؛ `media.music.melune.app` دو سطح پایین‌تر است و گواهی لبه نمی‌گیرد. `music-media` یک سطح است و رایگان کار می‌کند.

---

## ۰. معماری نهایی

```
مرورگر
  │  HTTPS (443)
  ▼
Cloudflare  ── TLS لبه، CDN، DNS، HSTS، WAF
  │  HTTPS به origin
  ▼
Oracle VM  ── Caddy :80/:443  (تنها کانتینری که پورت پابلیش می‌کند)
  ├── music.melune.app        → web:3000   (Next.js)
  │     ├── /api/*            → api:4000   (NestJS)
  │     └── /socket.io/*      → api:4000   (WebSocket)
  └── music-media.melune.app  → minio:9000 (فایل‌های صوتی/کاور)
        postgres / redis / worker فقط روی شبکهٔ داخلی Docker
```

| مورد | مقدار |
| --- | --- |
| دامنهٔ اپ | `music.melune.app` |
| دامنهٔ رسانه | `music-media.melune.app` |
| دامنهٔ والد (دست‌نخورده) | `melune.app` — متعلق به پروژهٔ فعلی شما |
| فایل Compose | `docker-compose.prod.yml` |
| فایل محیطی | `.env.production` (روی سرور، هرگز commit نشود) |
| TLS | Cloudflare Origin Certificate (پیشنهادی) یا Let's Encrypt |
| CI/CD | GitHub Actions → SSH به VM |

---

## ۱. پیش‌نیازها

1. **دامنه** — `melune.app` از قبل ثبت شده و zone آن روی Cloudflare فعال است. نیازی به خرید دامنهٔ جدید نیست؛ فقط دو رکورد `music` و `music-media` اضافه می‌شود.
2. **حساب Oracle Cloud** — با کارت بانکی برای تأیید هویت (شارژ نمی‌شود). منطقه‌ای انتخاب کنید که ظرفیت Ampere A1 داشته باشد (مثلاً `eu-frankfurt-1` یا `me-dubai-1`).
3. **حساب GitHub** — مخزن می‌تواند Public باشد (برای نمونه‌کار حرفه‌ای مناسب است).
4. **حساب Cloudflare** — همان حسابی که `melune.app` روی آن است (رایگان).
5. روی سیستم خود: Git، و دسترسی SSH.

> **چرا `music.melune.app`؟** چون `melune.app` و `www` قبلاً به پروژهٔ دیگری سرویس می‌دهند. این روش فقط `music` و `music-media` را اضافه می‌کند و هیچ رکورد یا تنظیم zone-level موجودی را تغییر نمی‌دهد (به‌جز قواعد Cache/WAF که باید به‌صورت host-scoped ساخته شوند — بخش ۵.۴).

> **محدودیت‌های رایگان که باید بدانید**
> - Always Free: ۴ OCPU و ۲۴ GB RAM از نوع Ampere A1 + ۲۰۰ GB دیسک + ۱۰ TB خروجی ماهانه.
> - Cloudflare Free: حداکثر **۱۰۰ MB** برای هر درخواست (آپلود صوتی از این مسیر عبور می‌کند).
> - Oracle ممکن است نمونهٔ Always Free را در صورت بی‌استفاده بودن reclaim کند؛ مانیتور UptimeRobot + استفادهٔ واقعی این ریسک را کم می‌کند.

---

## ۲. ساخت VM در Oracle Cloud

1. **Compute → Instances → Create instance**
2. نام: `melune-prod`
3. **Image**: Canonical Ubuntu 24.04 (یا 22.04)
4. **Shape**: `Ampere` → `VM.Standard.A1.Flex`
   - اگر ظرفیت داشت: **2 OCPU / 12 GB RAM** (راحت برای build و اجرا)
   - در صورت کمبود ظرفیت: `1 OCPU / 6 GB` هم کافی است (با swap)
5. **Boot volume**: 100 GB (تا ۲۰۰ GB رایگان)
6. **Networking**: VCN جدید با Public Subnet؛ گزینهٔ **Assign a public IPv4 address** فعال.
7. **SSH keys**: کلید عمومی خود را آپلود کنید (یا کلید جدید بسازید و приват را دانلود کنید).
8. پس از ساخت، **Public IP** را یادداشت کنید.

### باز کردن پورت‌ها در OCI

مسیر: **Networking → Virtual Cloud Networks → VCN شما → Security Lists → Default Security List**

Ingress Rules را اضافه کنید:

| Source | Protocol | Port | توضیح |
| --- | --- | --- | --- |
| `0.0.0.0/0` | TCP | `80` | ACME و ریدایرکت HTTP→HTTPS |
| `0.0.0.0/0` | TCP | `443` | HTTPS |
| `IP خودتان/32` | TCP | `22` | SSH (بهتر است محدود باشد) |

> اگر از Network Security Group استفاده می‌کنید، همین قواعد را در NSG هم اضافه کنید. باز کردن UFW روی سرور کافی نیست؛ Security List جلوی آن است.

---

## ۳. اتصال و آماده‌سازی سرور

```bash
ssh -i ~/.ssh/melune.key ubuntu@<PUBLIC_IP>
```

روی سرور:

```bash
sudo apt-get update
sudo apt-get install -y git
sudo git clone https://github.com/<GITHUB_USER>/melune.git /opt/melune
sudo chown -R ubuntu:ubuntu /opt/melune
sudo bash /opt/melune/scripts/deploy/oracle-bootstrap.sh
```

اسکریپت bootstrap این کارها را انجام می‌دهد:

- ساخت ۲ GB swap در صورت کمبود RAM
- نصب Docker Engine + Compose v2 از مخزن رسمی
- افزودن کاربر `ubuntu` به گروه `docker`
- فعال‌سازی UFW برای ۲۲/۸۰/۴۴۳ و اصلاح iptables تصاویر Oracle
- تنظیم محدودیت لاگ Docker

بعد از پایان، یک‌بار خارج و دوباره وارد شوید (یا `newgrp docker`) تا دستور `docker` بدون sudo کار کند.

---

## ۴. آماده‌سازی GitHub و CI/CD

### ۴.۱. اولین push

روی سیستم خودتان در پوشهٔ پروژه:

مخزن git به‌صورت محلی ساخته و کامیت اولیه انجام شده است. فقط remote و push لازم است:

```powershell
cd C:\Users\atash\Desktop\MELUNE
git status                                  # باید clean باشد
git remote add origin https://github.com/<GITHUB_USER>/melune.git
git push -u origin main
```

> اگر از قبل remote دارید: `git remote set-url origin <URL>`.
>
> `.gitignore` از قبل `.env*`، `.db-backup/`، `backups/`، `*.dump`، `node_modules` و `.next` را حذف می‌کند. فایل‌های صوتی دمو (`apps/web/public/audio-full` و `audio-real`) باید commit شوند (هر فایل زیر ۲۰ MB است، ولی حجم کل مخزن ~۳۴۰ MB می‌شود؛ push اول ممکن است چند دقیقه طول بکشد).

### ۴.۲. Secrets و Variables در GitHub

مسیر: **Repository → Settings → Secrets and variables → Actions**

**Secrets:**

| نام | مقدار |
| --- | --- |
| `DEPLOY_SSH_KEY` | محتوای کامل کلید خصوصی SSH (شامل `-----BEGIN ...-----`) |
| `DEPLOY_HOST` | IP عمومی VM |
| `DEPLOY_USER` | `ubuntu` |
| `DEPLOY_PATH` | `/opt/melune` |
| `DEPLOY_PORT` | `22` (اختیاری) |

**Variables:**

| نام | مقدار |
| --- | --- |
| `PUBLIC_URL` | `https://music.melune.app` |

> اگر مخزن Private است، روی سرور یک **Deploy Key** (read-only) بسازید و به GitHub اضافه کنید تا `git fetch` در دیپلوی کار کند. برای مخزن Public همان HTTPS کافی است.

### ۴.۳. رفتار workflow

فایل `.github/workflows/deploy.yml`:

- به‌صورت خودکار بعد از موفقیت workflow `CI` روی شاخهٔ `main` اجرا می‌شود.
- با `workflow_dispatch` می‌توانید یک branch/tag/SHA مشخص را deploy یا rollback کنید.
- روی سرور: `git fetch` → `git checkout <sha>` → `docker compose build` → `up -d` → انتظار healthy شدن `api` و `web` → smoke test روی `/api/health`، `/`، `/robots.txt` و `/sitemap.xml`.
- در صورت خطا، لاگ کانتینرها به‌عنوان artifact آپلود می‌شود.

---

## ۵. تنظیم Cloudflare

### ۵.۱. zone موجود

`melune.app` از قبل در Cloudflare فعال است و به پروژهٔ دیگری سرویس می‌دهد. **هیچ رکورد `@` یا `www` را تغییر ندهید.** فقط دو رکورد جدید اضافه کنید.

اگر zone هنوز Active نیست، همان مسیر **Add a site** → تغییر nameserver در registrar را طی کنید؛ ولی برای این اپ لازم نیست دامنهٔ جدیدی اضافه کنید.

### ۵.۲. رکوردهای DNS

در **DNS → Records**:

| Type | Name | Content | Proxy |
| --- | --- | --- | --- |
| `A` | `music` | `<PUBLIC_IP>` | **Proxied** (نارنجی) |
| `CNAME` | `music-media` | `music.melune.app` | **Proxied** (نارنجی) |

> `music-media` باید یک سطح زیر `melune.app` بماند؛ `media.music.melune.app` گواهی رایگان نمی‌گیرد.
>
> برای اولین صدور گواهی Let's Encrypt (گزینهٔ جایگزین) فقط همین دو رکورد را موقتاً **DNS only** (خاکستری) کنید. با روش پیشنهادی Origin Certificate نیازی به این کار نیست.

### ۵.۳. SSL/TLS

1. **SSL/TLS → Overview → Full (strict)**
   - هرگز `Flexible` نگذارید؛ باعث redirect loop می‌شود.
2. **Edge Certificates**:
   - Always Use HTTPS: **ON**
   - Automatic HTTPS Rewrites: **ON**
   - Minimum TLS Version: **TLS 1.2**
   - TLS 1.3: **ON**
   - HSTS: بعد از تست کامل HTTPS روشن کنید (۶ ماه، include subdomains).
3. **Origin Server → Create Certificate**:
   - Private key type: RSA (2048)
   - Hostnames (دقیقاً این دو): `music.melune.app`, `music-media.melune.app`
   - Validity: 15 years
   - فایل certificate را با نام `origin.pem` و private key را `origin.key` ذخیره کنید.

> **هشدار دربارهٔ تنظیمات zone-level:** چون `melune.app` میزبان پروژهٔ دیگری هم هست، HSTS و «Always Use HTTPS» و Cache Rules را کورکورانه عوض نکنید. هدر HSTS را خود Caddy فقط برای `music.melune.app` می‌فرستد. قواعد Cache/WAF را حتماً با شرط `http.host eq "music.melune.app"` محدود کنید (بخش ۵.۴) تا روی اپ فعلی اثر نگذارند.

### ۵.۴. WebSocket و Cache

1. **Network → WebSockets: ON** (پیش‌فرض روشن است).
2. **Caching → Cache Rules** — حتماً با شرط host تا به اپ والد آسیب نزند:
   - اگر `http.host eq "music.melune.app" and starts_with(http.request.uri.path, "/api/")` → **Bypass cache**
   - اگر `http.host eq "music.melune.app" and starts_with(http.request.uri.path, "/socket.io/")` → **Bypass cache**
   - اگر `http.host eq "music.melune.app" and starts_with(http.request.uri.path, "/_next/static/")` → **Cache everything** (اختیاری، برای سرعت)
   - اگر `http.host eq "music-media.melune.app"` → **Cache everything** (اختیاری؛ خود Caddy هم `immutable` می‌فرستد)
3. **Speed → Brotli: ON** (zone-level؛ اگر از قبل روشن است دست نزنید).

### ۵.۵. امنیت (اختیاری ولی توصیه‌شده)

- **Security → WAF → Rate limiting rule** با شرط `http.host eq "music.melune.app" and starts_with(http.request.uri.path, "/api/auth/")` (مثلاً ۲۰ درخواست در دقیقه per IP).
- **Bot Fight Mode** را برای مسیرهای API روشن نکنید؛ ممکن است کلاینت‌های قانونی را چالش کند.
- **HSTS Preload** zone-level است و روی اپ والد هم اثر می‌گذارد؛ فعال نکنید مگر اینکه برای کل zone بخواهید. هدر HSTS این اپ را Caddy می‌فرستد.

---

## ۶. ساخت فایل `.env.production`

### ۶.۱. روش خودکار (پیشنهادی)

روی سرور، از ریشهٔ مخزن:

```bash
cd /opt/melune
chmod +x scripts/deploy/*.sh
./scripts/deploy/configure-domain.sh music.melune.app
```

این اسکریپت:

- `DOMAIN`، `MEDIA_DOMAIN` و همهٔ URLهای عمومی را یک‌جا ست می‌کند،
- رمز Postgres، `JWT_ACCESS_SECRET` و کلیدهای MinIO را با `openssl` تصادفی می‌سازد،
- اگر `infra/caddy/origin.pem` و `origin.key` موجود باشند، `CADDYFILE=Caddyfile.origin` می‌گذارد،
- خروجی را با `docker compose config` اعتبارسنجی می‌کند.

> اگر فایل از قبل وجود دارد و می‌خواهید بازنویسی شود: `--force` (اسرار جدید ساخته می‌شوند؛ دیتابیس موجود دیگر باز نمی‌شود مگر رمز قبلی را جایگزین کنید).

### ۶.۲. روش دستی

```bash
cd /opt/melune
cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production
```

جاهای `CHANGE_ME` را پر کنید. مقادیر کلیدی باید دقیقاً این‌ها باشند:

```ini
DOMAIN=music.melune.app
MEDIA_DOMAIN=music-media.melune.app
ACME_EMAIL=admin@melune.app
CADDYFILE=Caddyfile.origin

POSTGRES_USER=melune
POSTGRES_PASSWORD=<hex تصادفی>
POSTGRES_DB=melune
DATABASE_URL=postgresql://melune:<همان رمز>@postgres:5432/melune?schema=public&connection_limit=10&pool_timeout=20

JWT_ACCESS_SECRET=<hex ۹۶ کاراکتری>

NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_SITE_URL=https://music.melune.app
API_INTERNAL_URL=http://api:4000
CORS_ORIGIN=https://music.melune.app
WEB_APP_URL=https://music.melune.app

STORAGE_ENDPOINT=https://music-media.melune.app
STORAGE_PUBLIC_URL=https://music-media.melune.app/melune-music
STORAGE_ACCESS_KEY=<hex تصادفی>
STORAGE_SECRET_KEY=<hex تصادفی>
STORAGE_BUCKET=melune-music

MAIL_FROM=noreply@melune.app
```

**قواعد حساس:**

- رمز Postgres را فقط با حروف/اعداد/`-`/`_` بسازید؛ چون داخل URL قرار می‌گیرد.
- `NEXT_PUBLIC_API_URL` باید **خالی** بماند (same-origin).
- `CORS_ORIGIN` را بدون فاصله و بدون `/` انتهایی بنویسید.
- `DATABASE_URL` و `POSTGRES_PASSWORD` باید دقیقاً یکسان باشند.

### کلیدهای Web Push (اختیاری)

روی سیستم خودتان (Node 20 نصب باشد):

```bash
cd C:\Users\atash\Desktop\MELUNE
npm run generate:vapid --workspace=apps/api
```

خروجی را در `VAPID_PUBLIC_KEY` و `VAPID_PRIVATE_KEY` قرار دهید. اگر خالی بمانند، Web Push غیرفعال می‌شود (خطا نمی‌دهد).

---

## ۷. قرار دادن گواهی Origin روی سرور

در Cloudflare فایل‌های `origin.pem` و `origin.key` را ساخته‌اید. روی سرور:

```bash
cd /opt/melune/infra/caddy
nano origin.pem     # محتوای certificate
nano origin.key     # محتوای private key
chmod 644 origin.pem
chmod 600 origin.key
```

> پوشهٔ `infra/caddy` به‌صورت read-only داخل کانتینر Caddy مانت می‌شود؛ نیازی به rebuild نیست. فقط Caddy را restart کنید.

---

## ۸. اولین اجرا

قبل از `up`، یک تصمیم TLS بگیرید:

- **مسیر پیشنهادی:** اول Origin Certificate را بسازید (بخش ۵.۳) و `origin.pem`/`origin.key` را در `infra/caddy` بگذارید؛ `CADDYFILE=Caddyfile.origin` می‌شود و از همان ابتدا می‌توانید Proxy را نارنجی نگه دارید.
- **مسیر جایگزین (Let's Encrypt):** `CADDYFILE=Caddyfile` بگذارید و تا صدور گواهی، رکوردهای `music` و `music-media` را خاکستری (DNS only) کنید. بعد از صدور، Origin Certificate بسازید، فایل‌ها را بگذارید و `CADDYFILE=Caddyfile.origin` را ست و Caddy را restart کنید.

```bash
cd /opt/melune
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

> build اول روی ۲ هستهٔ ARM حدود ۱۰ تا ۲۰ دقیقه طول می‌کشد. برای اینکه قطع شدن SSH آن را متوقف نکند از `tmux` استفاده کنید:
> ```bash
> sudo apt-get install -y tmux
> tmux new -s deploy
> # ... دستورات build/up ...
> # Ctrl+B سپس D برای خروج
> ```

بررسی وضعیت:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f caddy
```

انتظار می‌رود:

- `migrate` با کد ۰ خارج شده باشد.
- `minio-init` با کد ۰ خارج شده باشد.
- `api` و `web` وضعیت `healthy` داشته باشند.
- `caddy` در حال اجرا باشد.

تست سریع:

```bash
curl -I https://music.melune.app
curl -s https://music.melune.app/api/health
curl -I https://music.melune.app/robots.txt
curl -I https://music-media.melune.app   # انتظار 404 تمیز از MinIO، نه 502
```

> اگر `525` یا `526` گرفتید یعنی گواهی Origin به Caddy نرسیده یا حالت SSL روی `Flexible` است — بخش ۱۴.

---

## ۹. بازگرداندن دیتابیس و اصلاح URLها

برای اینکه سایت از همان ابتدا محتوا داشته باشد، dump دمو را روی سرور بازگردانید.

روی سیستم خودتان:

```powershell
scp -i ~/.ssh/melune.key C:\Users\atash\Desktop\MELUNE\.db-backup\melune.dump ubuntu@<PUBLIC_IP>:/tmp/melune.dump
```

روی سرور:

```bash
cd /opt/melune
APP_DIR=/opt/melune ./scripts/deploy/restore-postgres.sh --yes /tmp/melune.dump
./scripts/deploy/fix-media-urls.sh              # فقط شمارش
./scripts/deploy/fix-media-urls.sh --apply      # اعمال
```

`fix-media-urls.sh` این تبدیل‌ها را انجام می‌دهد:

- `http://localhost:3000/...` → `https://music.melune.app/...`
- `http://localhost:9000/melune/...` → `https://music-media.melune.app/melune-music/...`

بعد از restore، API و worker را restart کنید:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml restart api transcode-worker
```

### حساب مدیر

حساب‌های دمو (`admin@melune.app` / `melune12345` و `demo@melune.app`) را قبل از عمومی شدن حذف یا ایمن کنید:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  psql -U melune -d melune -c "DELETE FROM users WHERE email IN ('admin@melune.app','demo@melune.app');"
```

سپس در سایت ثبت‌نام کنید و حساب خودتان را مدیر کنید:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  psql -U melune -d melune -c "UPDATE users SET role='ADMIN' WHERE email='you@example.com';"
```

> خروجی این دستور باید `UPDATE 1` باشد.

---

## ۱۰. چک‌لیست تأیید نهایی

### دامنه و TLS

- [ ] `https://music.melune.app` باز می‌شود و قفل TLS معتبر است.
- [ ] `https://music-media.melune.app` پاسخ می‌دهد (۴۰۴ تمیز، نه ۵۰۲).
- [ ] رکوردهای `@` و `www` اپ والد (coach) هنوز کار می‌کنند و تغییری نکرده‌اند.
- [ ] در Cloudflare حالت **Full (strict)** فعال است.
- [ ] هدر `Strict-Transport-Security` روی `music.melune.app` دیده می‌شود (بدون تغییر HSTS zone-level).

### API و اپ

- [ ] `GET https://music.melune.app/api/health` پاسخ `{"status":"ok",...}` می‌دهد.
- [ ] ثبت‌نام و ورود کار می‌کند و کوکی `melune_refresh_token` با `Secure` ست می‌شود.
- [ ] در DevTools → Network، درخواست‌ها به `https://music.melune.app/api/...` می‌روند (نه `localhost:4000`).
- [ ] اعلان‌های realtime: در Console مرورگر اتصال `/socket.io/?EIO=4&transport=websocket` با وضعیت `101 Switching Protocols` دیده می‌شود.
- [ ] پخش صدا و دانلود آفلاین کار می‌کند (CORS روی `music-media` درست است).
- [ ] آپلود کاور (< 10 MB) و فایل صوتی (< 95 MB) کار می‌کند.

### SEO

- [ ] `https://music.melune.app/robots.txt` شامل `Sitemap: https://music.melune.app/sitemap.xml` است.
- [ ] `https://music.melune.app/sitemap.xml` معتبر است.
- [ ] `https://music.melune.app/opengraph-image` تصویر ۱۲۰۰×۶۳۰ برمی‌گرداند.
- [ ] پیش‌نمایش لینک در تلگرام/Twitter/LinkedIn درست است.

### پایداری

- [ ] UptimeRobot روی `https://music.melune.app/api/health` هر ۵ دقیقه.
- [ ] cron بکاپ دیتابیس اجرا شده و فایل dump ساخته است.
- [ ] فضای دیسک (`df -h`) کمتر از ۸۰٪ است.
- [ ] `docker compose ... ps` همهٔ سرویس‌های ضروری را healthy نشان می‌دهد.

---

## ۱۱. Google Search Console و Bing

1. **Search Console** را باز کنید. اگر از قبل یک property از نوع **Domain** برای `melune.app` دارید، همان `music.melune.app` را هم پوشش می‌دهد و نیازی به property جدید نیست.
2. اگر property ندارید: **Add property → URL prefix** → `https://music.melune.app` و با رکورد TXT یا فایل HTML تأیید کنید. (property از نوع Domain نیازمند TXT روی `@` است و ممکن است با پروژهٔ والد تداخل داشته باشد.)
3. بعد از تأیید: **Sitemaps → Add new sitemap** → `https://music.melune.app/sitemap.xml`
4. برای سرعت ایندکس، URLهای اصلی را با **URL Inspection → Request indexing** ثبت کنید:
   - `https://music.melune.app/`
   - `https://music.melune.app/home`
5. **Bing Webmaster Tools** هم همان دامنه و sitemap را بپذیرد (اختیاری ولی مفید).

> فایل `robots.ts` مسیرهای `/admin`، `/library`، `/onboarding`، `/api`، `/reset-password` و `/forgot-password` را می‌بندد. `sitemap.ts` فقط صفحات عمومی را لیست می‌کند.

---

## ۱۲. بکاپ، مانیتورینگ و نگهداری

### بکاپ دیتابیس

```bash
chmod +x /opt/melune/scripts/deploy/*.sh
sudo mkdir -p /var/backups/melune
sudo chown ubuntu:ubuntu /var/backups/melune
```

cron (روزی ۰۳:۱۵ UTC):

```bash
crontab -e
```

```cron
15 3 * * * APP_DIR=/opt/melune /opt/melune/scripts/deploy/backup-postgres.sh >> /var/log/melune-backup.log 2>&1
0 4 * * 0  APP_DIR=/opt/melune /opt/melune/scripts/deploy/backup-minio.sh   >> /var/log/melune-backup.log 2>&1
```

- `RETENTION_DAYS` پیش‌فرض ۱۴ روز است.
- برای بکاپ آفسایت، `rclone` نصب کنید و `RCLONE_REMOTE` را ست کنید (مثلاً Backblaze B2).

### UptimeRobot

- Monitor type: **HTTP(s)**
- URL: `https://music.melune.app/api/health`
- Interval: 5 minutes
- Alert contact: ایمیل/تلگرام

### به‌روزرسانی ایمیج‌ها

ماهانه:

```bash
cd /opt/melune
docker compose --env-file .env.production -f docker-compose.prod.yml pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
docker image prune -f
```

> ایمیج‌های `postgres`، `redis`، `minio` و `caddy` در compose پین شده‌اند؛ برای ارتقای نسخه، تگ را آگاهانه تغییر دهید و ابتدا بکاپ بگیرید.

---

## ۱۳. دیپلوی خودکار و Rollback

### دیپلوی عادی

```powershell
git add .
git commit -m "feat: ..."
git push origin main
```

CI اجرا می‌شود؛ اگر سبز شد، `Deploy production` به‌طور خودکار اجرا می‌شود.

### دیپلوی دستی یک نسخهٔ خاص

GitHub → Actions → **Deploy production** → Run workflow → `ref` را مثلاً `v1.2.0` یا یک SHA بگذارید.

### Rollback

سریع‌ترین راه: همان workflow را با `ref=<SHA قبلی>` اجرا کنید.

یا روی سرور:

```bash
cd /opt/melune
git log --oneline -10
git checkout <SHA>
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

> **هشدار:** مهاجرت‌های Prisma فقط به جلو می‌روند. اگر نسخهٔ جدید migration داشته باشد، rollback کد به نسخهٔ قدیمی ممکن است با schema جدید سازگار نباشد. در تغییرات دیتابیسی، همیشه بکاپ قبل از deploy و یک برنامهٔ forward-fix داشته باشید.

---

## ۱۴. عیب‌یابی سریع

| نشانه | علت احتمالی | راه‌حل |
| --- | --- | --- |
| `502 Bad Gateway` | `web` یا `api` بالا نیست | `docker compose ... ps` و `logs web/api` |
| `525 SSL handshake failed` | گواهی Origin لود نشده یا حالت SSL اشتباه | `CADDYFILE=Caddyfile.origin`، وجود `origin.pem/key`، حالت Full (strict) |
| `526 Invalid SSL certificate` | گواهی Origin منقضی/نادرست | گواهی را دوباره بسازید و Caddy را restart کنید |
| redirect loop | Cloudflare روی `Flexible` است | حالت را `Full (strict)` کنید |
| صدور گواهی Let's Encrypt شکست می‌خورد | رکوردها Proxied هستند | موقتاً DNS-only کنید یا از Origin Certificate استفاده کنید |
| WebSocket وصل نمی‌شود | `CORS_ORIGIN` اشتباه یا Cache روی `/socket.io` | `CORS_ORIGIN=https://music.melune.app` باشد؛ Cache Rule را Bypass کنید |
| آپلود ۴۰۳ | هاست presigned با `STORAGE_ENDPOINT` یکی نیست | `STORAGE_ENDPOINT=https://music-media.melune.app` و Host preservation در Caddy |
| آپلود بالای ۱۰۰ MB شکست می‌خورد | محدودیت Cloudflare Free | فایل را زیر ۹۵ MB نگه دارید یا به R2 مهاجرت کنید |
| همهٔ کاربران `429` می‌گیرند | IP واقعی به API نمی‌رسد | `trust proxy` و `ClientIpThrottlerGuard` باید فعال باشند (`CF-Connecting-IP`) |
| `migrate` خطا می‌دهد | `DATABASE_URL` یا رمز اشتباه | `logs migrate`؛ تطابق `POSTGRES_PASSWORD` و `DATABASE_URL` |
| build با `JavaScript heap out of memory` می‌میرد | RAM کم | swap را چک کنید؛ `NODE_OPTIONS=--max-old-space-size=2048` |
| دیسک پر شده | ایمیج/لاگ زیاد | `docker system df`، `docker image prune -a`، `journalctl --vacuum-size=200M` |

### دستورات پرکاربرد

```bash
cd /opt/melune
COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml"

$COMPOSE ps
$COMPOSE logs --tail=200 api
$COMPOSE logs --tail=200 web
$COMPOSE logs --tail=200 caddy
$COMPOSE restart api
$COMPOSE up -d --build
$COMPOSE down            # سرویس‌ها را متوقف می‌کند؛ volume ها باقی می‌مانند
docker stats
df -h
free -h
```

> هرگز `docker compose down -v` را روی production اجرا نکنید؛ volume دیتابیس و MinIO را پاک می‌کند.

---

## ۱۵. نکات امنیتی قبل از عمومی شدن

1. **حساب‌های دمو را حذف کنید** (بخش ۹).
2. `JWT_ACCESS_SECRET` واقعی و تصادفی باشد (حداقل ۳۲ کاراکتر؛ پیشنهاد ۹۶).
3. رمز Postgres و MinIO تصادفی و طولانی باشند؛ فایل `.env.production` با `chmod 600`.
4. MinIO console روی اینترنت باز نیست (پورت ۹۰۰۱ پابلیش نشده). برای دسترسی، از تونل SSH استفاده کنید:
   ```bash
   ssh -L 9001:localhost:9001 ubuntu@<IP>
   # سپس روی سرور: docker compose ... exec minio ... یا یک port-forward موقت
   ```
5. SSH را به IP خودتان محدود کنید و ورود با رمز را غیرفعال نگه دارید (فقط کلید).
6. `fail2ban` فعال است (bootstrap).
7. **پست الکترونیک**: `MailService` فعلاً stub است و ایمیل بازیابی رمز را فقط در لاگ می‌نویسد. قبل از عمومی شدن، یک provider واقعی (Resend/Postmark/SES) وصل کنید، وگرنه کاربران نمی‌توانند رمز خود را بازیابی کنند.
8. **آپلود ۱۰۰ MB**: سقف Cloudflare Free است. `UPLOAD_RULES` هم دقیقاً ۱۰۰ MB است؛ برای اطمینان بیشتر آن را به ۹۵ MB کاهش دهید یا از R2 استفاده کنید.
9. محتوای دمو (کاورها/صداها) ممکن است حق نشر داشته باشد؛ قبل از انتشار عمومی، فایل‌های نمونه را با محتوای دارای مجوز جایگزین کنید.

---

## ۱۶. هزینهٔ نهایی

| مورد | هزینه |
| --- | --- |
| Oracle Always Free (VM + دیسک + ترافیک) | ۰ |
| Cloudflare Free (DNS + TLS + CDN + WAF پایه) | ۰ |
| GitHub Free (repo + Actions) | ۰ |
| دامنه | ۰ — `melune.app` از قبل خریداری شده و تمدید آن جداست |
| **جمع هزینهٔ اضافه برای این اپ** | **۰** |

---

## ۱۷. فایل‌های اضافه‌شده در این روش

| فایل | نقش |
| --- | --- |
| `docker-compose.prod.yml` | استک کامل production؛ فقط Caddy پورت پابلیش می‌کند |
| `infra/caddy/Caddyfile` | TLS خودکار Let's Encrypt |
| `infra/caddy/Caddyfile.origin` | TLS با Cloudflare Origin Certificate |
| `infra/caddy/site.caddy` | روت‌ها، هدرهای امنیتی، پروکسی API/Socket/Media |
| `.env.production.example` | نمونهٔ کامل متغیرهای production |
| `.github/workflows/deploy.yml` | CI/CD با SSH + smoke test |
| `apps/web/src/lib/site.ts` | منبع واحد نام/URL سایت |
| `apps/web/src/app/sitemap.ts` | sitemap |
| `apps/web/src/app/robots.ts` | robots |
| `apps/web/src/app/opengraph-image.tsx` | تصویر OG/Twitter |
| `apps/web/src/app/layout.tsx` | متادیتای کامل + JSON-LD |
| `scripts/deploy/oracle-bootstrap.sh` | آماده‌سازی VM |
| `scripts/deploy/backup-postgres.sh` | بکاپ روزانه |
| `scripts/deploy/backup-minio.sh` | بکاپ رسانه |
| `scripts/deploy/restore-postgres.sh` | بازگردانی dump |
| `scripts/deploy/fix-media-urls.sh` | اصلاح URLهای localhost |
| `scripts/deploy/configure-domain.sh` | ساخت `.env.production` با دامنه و اسرار تصادفی |

---

## ۱۸. ترتیب اجرای خلاصه (Cheat Sheet)

```text
1.  ساخت VM در Oracle (Ubuntu 24.04، Ampere 2/12) + یادداشت Public IP
2.  باز کردن 80/443/22 در OCI Security List
3.  ssh ubuntu@IP → clone repo → oracle-bootstrap.sh
4.  git push به GitHub + تنظیم Secrets/Variables (PUBLIC_URL=https://music.melune.app)
5.  Cloudflare: افزودن رکورد A music و CNAME music-media، Full (strict)
6.  ساخت Origin Certificate (music + music-media) → origin.pem/key روی سرور
7.  ./scripts/deploy/configure-domain.sh music.melune.app
8.  docker compose ... build && up -d
9.  restore dump → fix-media-urls.sh --apply
10. حذف حساب‌های دمو → ساخت حساب مدیر
11. تست https / media / api / socket / upload
12. Search Console + sitemap + UptimeRobot + cron بکاپ
13. push نهایی → دیپلوی خودکار GitHub Actions
```

