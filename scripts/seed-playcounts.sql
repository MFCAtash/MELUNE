UPDATE songs SET "playCount" = CASE
  WHEN slug='bad-guy' THEN 4200
  WHEN slug='waka-waka' THEN 3100
  WHEN slug='hips-dont-lie' THEN 2800
  WHEN slug='ocean-eyes' THEN 2400
  WHEN slug='booye-gandom' THEN 2100
  WHEN slug='whenever-wherever' THEN 1900
  WHEN slug='mordab' THEN 1600
  WHEN slug='dele-man' THEN 1500
  WHEN slug='dokhtar-e-shah-pariyon' THEN 1300
  WHEN slug='parandeh-ye-mohajer' THEN 1200
  WHEN slug='happier-than-ever' THEN 1100
  WHEN slug='marde-tanha' THEN 900
  WHEN slug='adama' THEN 800
  WHEN slug='ghazal' THEN 750
  WHEN slug='bavar-kon' THEN 700
  WHEN slug='doostet-daram' THEN 650
  WHEN slug='yaraneh' THEN 600
  WHEN slug='shah-kavir' THEN 500
  WHEN slug='sargozasht' THEN 450
  WHEN slug='to-kojai' THEN 400
  WHEN slug='mast' THEN 350
  ELSE "playCount"
END;
