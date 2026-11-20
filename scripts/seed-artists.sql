-- Seed the 7 featured artists (userId NULL = system/demo artist profile)
INSERT INTO artists (id, name, slug, bio, "imageUrl", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'Billie Eilish', 'billie-eilish', 'خواننده و ترانه‌سرای آمریکایی؛ ستاره پاپ آلترناتیو جهان با سبک تاریک و مینیمال و چند جایزه گرامی.', 'http://localhost:3000/covers/artist-billie-eilish.svg', now(), now()),
  (gen_random_uuid(), 'Shakira', 'shakira', 'خواننده کلمبیایی؛ ملکه پاپ لاتین با سبک و رقص منحصربه‌فرد، فروش بیش از ۹۰ میلیون آلبوم در جهان.', 'http://localhost:3000/covers/artist-shakira.svg', now(), now()),
  (gen_random_uuid(), 'Ebi', 'ebi', 'ابراهیم حامدی «ابی»؛ صدای ماندگار موسیقی پاپ ایران با دهه‌ها فعالیت و میلیون‌ها طرفدار در سراسر جهان.', 'http://localhost:3000/covers/artist-ebi.svg', now(), now()),
  (gen_random_uuid(), 'Googoosh', 'googoosh', 'گوگوش؛ مهم‌ترین خواننده زن تاریخ موسیقی ایران و نماد پنجاه سال ترانه فارسی.', 'http://localhost:3000/covers/artist-googoosh.svg', now(), now()),
  (gen_random_uuid(), 'Dariush', 'dariush', 'داریوش رفیعی؛ صدای اعتراض و امید ایران با بیش از پنج دهه ترانه برای آزادی و انسان.', 'http://localhost:3000/covers/artist-dariush.svg', now(), now()),
  (gen_random_uuid(), 'Hayedeh', 'hayedeh', 'هایده؛ صدای آشنای آسمان شب ایران، استاد ردیف و آواز اصیل با ترانه‌های جاودانه عاشقانه.', 'http://localhost:3000/covers/artist-hayedeh.svg', now(), now()),
  (gen_random_uuid(), 'Shadmehr Aghili', 'shadmehr-aghili', 'شادمهر عقیلی؛ آهنگساز، نوازنده ویلن و خواننده محبوب نسل جدید موسیقی پاپ ایران.', 'http://localhost:3000/covers/artist-shadmehr-aghili.svg', now(), now())
ON CONFLICT (slug) DO NOTHING;
