# SYDT Chat — Sunucu Sağlık ve Özellik Test Checklist'i

Hedef ortam: `https://chat.example.com` · Proje yolu: `/opt/sydt-chat` · Servisler: `sydt-api`, `sydt-web`, `nginx`

Her maddeyi işaretle: `[x]` geçti, `[!]` sorunlu (not düş), `[-]` kapsam dışı.
**★** işaretli maddeler bu dönemde düzeltilen/eklenen özelliklerdir; özellikle kontrol et.

---

## 0. Hazırlık

- [ ] **Test hesapları hazır:**
  - **ADMIN:** Süper yönetici hesabı.
  - **A** ve **B:** İki normal kullanıcı, aynı yarışma sunucusunda ve (takım testleri için) aynı takımda.
  - **C:** Başka takımda bir normal kullanıcı (yetki sızıntısı testleri için).
- [ ] İki ayrı tarayıcı veya profil kullan: biri ADMIN, diğeri A ya da B. Böylece çerezler karışmaz.
- [ ] İstemci makinelerde kök sertifika güvenilir olarak kurulu; adres çubuğunda "güvenli değil" uyarısı yok.
- [ ] Tarayıcıda F12 açık: **Console** sekmesinde kırmızı hata, **Network → WS** sekmesinde socket bağlantısı izlenecek.
- [ ] Test öncesi veritabanı yedeği alındı (bkz. §20).

---

## 1. Altyapı ve servisler (sunucu terminali)

```bash
systemctl status sydt-api sydt-web nginx --no-pager
systemctl is-enabled sydt-api sydt-web nginx
```
- [ ] Üç servis de `active (running)` durumda.
- [ ] Üçü de `enabled`, yani reboot sonrası kendiliğinden kalkıyor.

```bash
journalctl -u sydt-api -p err --since today --no-pager
journalctl -u sydt-web -p err --since today --no-pager
```
- [ ] Beklenmeyen hata yok. Tek tük `401` ve `refresh` kayıtları normaldir.
- [ ] `restart` döngüsü yok: `systemctl status` içindeki süre sürekli sıfırlanmıyor.

```bash
curl -sk https://chat.example.com/health
curl -skI https://chat.example.com/ | head -n 5
curl -sk "https://chat.example.com/socket.io/?EIO=4&transport=polling" | head -c 80; echo
```
- [ ] `/health` isteği `{"ok":true,...}` döndürüyor.
- [ ] Ana sayfa `200` veya `/login`'e yönlendirme (`307`/`302`) döndürüyor.
- [ ] Socket.IO yanıtı `0{"sid":` ile başlıyor; nginx `/socket.io/` yolunu API'ye iletiyor demektir.

```bash
sudo nginx -t
echo | openssl s_client -connect chat.example.com:443 2>/dev/null | openssl x509 -noout -subject -dates
```
- [ ] `nginx -t` çıktısı `syntax is ok` ve `test is successful`.
- [ ] Sertifika geçerlilik tarihleri uygun; `notAfter` yakın değil.
- [ ] `http://chat.example.com` adresi `https`'e yönleniyor.

```bash
node -v
sudo -u sydt -H bash -lc 'cd /opt/sydt-chat && pnpm -v'
df -h /opt
ls -ld /opt/sydt-chat/apps/server/uploads
```
- [ ] Node 20 veya üstü; pnpm **9.15.0** (12 değil).
- [ ] Diskte yeterli boş alan var (en az %20).
- [ ] `uploads` klasörünün sahibi `sydt`.

### Ortam değişkenleri
```bash
sudo grep -E '^(NODE_ENV|COOKIE_SECURE|CORS_ORIGIN|DATABASE_URL|UPLOAD_DIR|ALLOW_BEARER_AUTH)=' /opt/sydt-chat/apps/server/.env
sudo bash -c "grep ^JWT_ACCESS_SECRET= /opt/sydt-chat/apps/server/.env | sha256sum; grep ^JWT_ACCESS_SECRET= /opt/sydt-chat/apps/web/.env.local | sha256sum"
```
- [ ] `NODE_ENV=production`, `COOKIE_SECURE=true`.
- [ ] `CORS_ORIGIN=https://chat.example.com`: tam adres, `*` yok.
- [ ] `ALLOW_BEARER_AUTH` tanımsız ya da `false`.
- [ ] İki `JWT_ACCESS_SECRET` özeti (hash) **aynı**. Farklıysa girişten sonra oturum düşer.
- [ ] JWT secret'ları örnek değer değil, rastgele ve en az 32 karakter.

### Veritabanı
```bash
sudo -u sydt -H bash -lc 'cd /opt/sydt-chat/apps/server && pnpm exec prisma migrate status'
```
- [ ] Çıktıda `Database schema is up to date` yazıyor.
- [ ] ★ `20260928000000_dm_last_read` migration'ı uygulanmış.

---

## 2. Kimlik doğrulama ve oturum

- [ ] Giriş ekranında demo hesap listesi **görünmüyor**.
- [ ] ★ Doğru bilgilerle giriş yapınca sayfa ana ekrana **kendiliğinden** geçiyor; login ekranında takılı kalmıyor.
- [ ] ★ İlk açılışta boş, siyah ekran yok; yükleme ekranı gösterilip içerik geliyor.
- [ ] Yanlış şifre girince genel "Invalid credentials" mesajı çıkıyor; kullanıcının var olup olmadığı belli olmuyor.
- [ ] Kayıt ekranı çalışıyor, ya da Admin → kayıt ayarı kapalıysa kayıt engelleniyor.
- [ ] Kayıt sonrası kendiliğinden giriş yapılıp yönlendiriliyor.
- [ ] Sayfa yenilenince (F5) oturum korunuyor.
- [ ] 15 dakikadan uzun bekledikten sonra bir işlem yapınca oturum sessizce yenileniyor; tekrar giriş istenmiyor.
- [ ] Çıkış yapınca `/login` açılıyor; geri tuşuyla korumalı sayfaya dönülemiyor.
- [ ] Profil → **Tüm cihazlardan çıkış** diğer tarayıcıdaki oturumu da düşürüyor.
- [ ] Profil → şifre değiştirme çalışıyor; eski şifreyle giriş reddediliyor.
- [ ] Çıkış yapılmışken `/admin` veya `/channels/...` adresine gidince `/login`'e yönlendiriliyor.

---

## 3. Yarışma sunucuları, davetler, üyelik

- [ ] Sol menüde sunucu simgeleri görünüyor; tıklayınca aktif sunucu değişiyor.
- [ ] ADMIN yeni sunucu oluşturabiliyor (sol menüde `+`).
- [ ] Sunucu simgesine sağ tıklayınca bağlam menüsü açılıyor: bildirim modu, görünüm, davet oluştur, ayarlar, sil.
- [ ] **Davet oluştur** bağlantıyı panoya kopyalıyor.
- [ ] Yeni kullanıcı davet bağlantısını (`/invite/<kod>`) açınca önizleme görüyor, kabul edince sunucuya katılıyor.
- [ ] Süresi dolmuş veya silinmiş davet reddediliyor.
- [ ] Hiç sunucusu olmayan kullanıcıya karşılama ve katılma ekranı gösteriliyor.
- [ ] Sunucuya özel profil (takma ad, avatar) değiştirilip kaldırılabiliyor.

---

## 4. Kanallar ve kategoriler

- [ ] Kanal kenar çubuğu kategorilere göre gruplu; kategoriler açılıp kapanıyor.
- [ ] Başkasının takım kanalları **C kullanıcısına görünmüyor**; URL ile açmaya çalışınca erişim reddediliyor.
- [ ] Personel kanalları (STAFF, ORGANIZER, LOGS) normal kullanıcıya görünmüyor.
- [ ] Duyuru kanalına normal kullanıcı yazamıyor; personel yazabiliyor.
- [ ] Kilitli kanalda normal kullanıcının mesaj kutusu kapalı.
- [ ] Kanal bazlı bildirim modu (Tümü / Sadece bahsetme / Hiçbiri) kaydediliyor ve etkisi görülüyor.
- [ ] Okunmamış kanal göstergesi çalışıyor; kanala girince siliniyor.
- [ ] Kanal ve kategori logosu yüklenip kaldırılabiliyor.

---

## 5. Mesajlaşma (A ve B aynı kanalda)

- [ ] A mesaj gönderince B'de **sayfa yenilemeden** anında görünüyor.
- [ ] "Yazıyor…" göstergesi çıkıp kayboluyor.
- [ ] Mesaj düzenleme ve silme çalışıyor, diğer tarafta anında güncelleniyor.
- [ ] Başkasının mesajı düzenlenemiyor.
- [ ] Emoji tepkisi ekleme ve kaldırma çalışıyor.
- [ ] Yanıtlama (reply) çalışıyor; alıntı görünüyor.
- [ ] Sabitleme (pin): sağ panelde **Sabitlenenler** listesinde görünüyor.
- [ ] `@kullanıcı` yazınca öneri listesi açılıyor; bahsedilen kişiye bildirim ve ses gidiyor.
- [ ] Kod bloğu renklendiriliyor ve kopyala düğmesi çalışıyor.
- [ ] Mesaj kutusundaki yardım (markdown ipuçları) açılıyor.
- [ ] Yukarı kaydırınca eski mesajlar yükleniyor (sayfalama).
- [ ] Çevrimiçi / çevrimdışı durum noktaları güncelleniyor.

### Dosya ekleri
- [ ] Resim ve izinli dosya (PDF vb.) yüklenip indirilebiliyor.
- [ ] Uzantısı değiştirilmiş zararlı dosya reddediliyor: 500 değil 400 dönüyor ve anlaşılır bir mesaj çıkıyor.
- [ ] Yükleme limitinin üstündeki dosya reddediliyor.
- [ ] Ek bağlantısı, kanala erişimi olmayan kullanıcıda açılmıyor.

---

## 6. Bildirimler ve ses ★

- [ ] ★ Ses, ilk tıklamadan sonra çalışıyor. Tarayıcılar kullanıcı etkileşimi olmadan ses çalmaya izin vermez.
- [ ] ★ Network → WS sekmesinde bağlantı `wss://chat.example.com/socket.io/...` adresine gidiyor; `localhost:4000` değil.
- [ ] Zil simgesindeki okunmamış sayısı doğru; sayfa yenilenince korunuyor.
- [ ] ★ `/notifications` sayfasında bir bildirime tıklayınca **"Maximum update depth exceeded" hatası çıkmıyor**.
- [ ] **Tümünü okundu say** çalışıyor.
- [ ] Ayarlar → Bildirimler: ses kapatılınca ses gelmiyor.
- [ ] Rahatsız etmeyin (DND) açıkken ses gelmiyor.
- [ ] Tarayıcı bildirim izni verilince masaüstü bildirimi geliyor.

---

## 7. Arkadaşlar ve özel mesaj (DM) ★

- [ ] A, B'ye arkadaşlık isteği gönderebiliyor (üye önerisinden seçerek veya kullanıcı adıyla).
- [ ] ★ B'de alttan baloncuk, ses ve bildirim kutusunda "A size arkadaşlık isteği gönderdi" satırı çıkıyor.
- [ ] ★ B'nin sol menüsündeki **Arkadaşlar** simgesinde rozet var (bekleyen istek).
- [ ] B kabul edince ★ A'ya "B arkadaşlık isteğinizi kabul etti" bildirimi gidiyor.
- [ ] Reddetme ve arkadaşlıktan çıkarma çalışıyor.
- [ ] **Mesaj** düğmesi DM sohbetini açıyor.
- [ ] ★ A, B'ye DM atınca, B başka bir sayfadaysa:
  - "A size mesaj gönderdi" baloncuğu ve ses geliyor.
  - Zilde tek bir satır var; birden çok mesajda "A size 3 mesaj gönderdi" diye güncelleniyor, satır sayısı artmıyor.
  - Sol menüdeki Arkadaşlar rozetinde sayı var.
  - Arkadaşlar sayfasında satır vurgulu; "N yeni mesaj" etiketi ve Mesaj düğmesinde kırmızı sayı görünüyor.
- [ ] ★ B DM'yi açınca üç sayaç da sıfırlanıyor: rozet, zil ve Arkadaşlar sayfası.
- [ ] ★ B DM'yi açık tutarken gelen mesajlar baloncuk çıkarmıyor ve sayaç artmıyor.
- [ ] Sayfa yenilemesi ve farklı cihaz arasında okunmamış sayıları korunuyor.
- [ ] Takım veya personel dışındaki biriyle DM kuralı uygulanıyor ve uygun hata mesajı çıkıyor.

---

## 8. Takımlar

- [ ] `/team` sayfası kendi takımını ve üyeleri gösteriyor.
- [ ] Kullanıcı takım kurabiliyor ya da davet koduyla katılabiliyor (önce önizleme gösteriliyor).
- [ ] Takımdan ayrılma çalışıyor.
- [ ] Takım logosu yükleme ve kaldırma çalışıyor.
- [ ] Admin: takım oluşturma, düzenleme, silme, üye atama ve çıkarma, kaptan belirleme, davet kodunu yenileme çalışıyor.
- [ ] Takım CTFd bağlantısı ayarlandıysa sıralama ve puan görünüyor.

---

## 9. Destek talepleri (tickets)

- [ ] A (normal kullanıcı) talep açabiliyor: kategori, önem derecesi, açıklama, ek dosya.
- [ ] ★ Organizatörlerde yeni talep için baloncuk, ses ve zil bildirimi geliyor; aynı talep için **çift** ses veya baloncuk yok.
- [ ] Organizatör talebi üstlenebiliyor (claim); A'ya "atandı" veya durum bildirimi gidiyor.
- [ ] Yorum ve yanıt karşılıklı anında görünüyor; karşı tarafa bildirim gidiyor.
- [ ] Durum (çözüldü, kapatıldı, yeniden açıldı) ve önem değişikliği çalışıyor, olay geçmişine yazılıyor.
- [ ] "Kritiğe yükselt" ve kritik talep bildirimi çalışıyor.
- [ ] Birden fazla takım aynı sorunu bildirince "N takım aynı sorunu bildirdi" bildirimi geliyor.
- [ ] Talep ilişkilendirme (relations) ekleme ve kaldırma çalışıyor.
- [ ] Talepten duyuru yayınlama (announce) çalışıyor.
- [ ] Toplu işlem (bulk) çalışıyor.
- [ ] Filtreler çalışıyor: Tümü / Açık / **Benimkiler** / arama.
- [ ] `/tickets/ops` operasyon ekranı, istatistikler ve rapor açılıyor.
- [ ] C kullanıcısı A'nın talebini göremiyor; URL ile açmayı deneyince `403` veya `404` alıyor.
- [ ] Okundu işareti (read) çalışıyor; okunmamış talep vurgusu kayboluyor.

---

## 10. Duyurular ve toplu iletişim ★

- [ ] ★ Admin → İletişim → **Duyuru**: normal kullanıcılarda baloncuk, ses ve zil kaydı geliyor.
- [ ] ★ Bildirime tıklayınca `/notifications?announcement=…` açılıyor ve duyuru detayı görünüyor; hata yok.
- [ ] Duyuruyu yayınlayan admin kendi duyurusu için bildirim almıyor.
- [ ] Sunucuya özel duyuru (Sunucu ayarları → Duyurular) yalnızca o sunucunun üyelerine gidiyor.
- [ ] İleri tarihli (zamanlanmış) duyuru, vakti gelince yayınlanıyor.
- [ ] **Toplu DM** gönderimi çalışıyor.
- [ ] İletişim geçmişi listesinde gönderimler görünüyor.
- [ ] Başlık 4 karakterden, gövde 10 karakterden kısaysa doğrulama mesajı çıkıyor.

---

## 11. Olaylar (incidents)

Olay = altyapı/servis kesintisi kaydı (ör. "CTFd erişilemiyor", "web challenge'ı çöktü"). Sadece yetkililere açık: moderatör görür, yarışma yöneticisi ve süper yönetici durumunu değiştirir. Menüde ikonu yok; **Ctrl+K → Incidents** veya doğrudan `/incidents` adresiyle açılır. Arayüzde yeni olay oluşturma formu yok (yalnızca API ile oluşturulabiliyor).

- [ ] Yönetici hesabıyla `/incidents` listesi ve detay sayfası açılıyor; normal yarışmacı hesabıyla erişilemiyor.
- [ ] Detay sayfasında durum/önem değişikliği kaydediliyor; başka bir yetkili sekmede anlık güncelleniyor.
- [ ] (Olay varsa) Başka sunucunun olayı bu sunucuda bildirim üretmiyor.

---

## 12. Görevler (challenges) ve ipuçları

- [ ] `/challenges` listesi açılıyor; kategori ve **zorluk** filtreleri çalışıyor.
- [ ] Görev detay sayfası açılıyor.
- [ ] İpucu açma (unlock) çalışıyor ve tekrar açınca çift kayıt oluşmuyor.

---

## 13. Skor tablosu ve CTFd ★

```bash
# SYDT sunucusundan CTFd erişimi (Content-Type başlığı şart)
curl -sS --max-time 10 http://ctfd.example.com/api/v1/scoreboard \
  -H "Authorization: Token <ANAHTAR>" -H "Content-Type: application/json" -H "Accept: application/json" | head -c 200; echo
```
- [ ] curl çıktısı `{"success": true, "data": [...]}`. `/login`'e yönlendirme varsa anahtar geçersiz demektir.
- [ ] ★ Sunucu ayarları → Entegrasyonlar: `http://ctfd.example.com` (özel IP) **kabul ediliyor**.
- [ ] ★ **Bağlantıyı test et** "Bağlantı başarılı — N takım" diyor. Başarısızsa mesajdaki parantez içi ayrıntıyı not al.
- [ ] `/scoreboard` CTFd sıralamasını gösteriyor; "Son güncelleme" zamanı ilerliyor.
- [ ] CTFd istatistikleri (görev ve çözüm sayıları) görünüyor.
- [ ] Anahtar kaldırılınca skor tablosu "anahtar gerekli" uyarısı veriyor.

---

## 14. Sunucu ayarları panelleri (ADMIN)

- [ ] **Genel:** ad, logo, banner değişikliği kaydediliyor.
- [ ] **Roller:** rol oluştur, düzenle, sil; üyeye rol ata. Yetki etkisi görülüyor: yetkisi alınan kullanıcı ilgili işlemi yapamıyor.
- [ ] **Üyeler:** liste, arama, düzenleme.
- [ ] **Yasaklılar:** üyeyi yasakla ve yasağı kaldır. Yasaklı kullanıcı sunucuya erişemiyor ve socket odasına alınmıyor.
- [ ] **Emojiler:** yükle, kullan, sil.
- [ ] **Kategoriler ve Kanallar:** oluştur, düzenle, sil, sırala.
- [ ] **Talepler:** talep kategorileri, etiketler, yarışma ayarları.
- [ ] **İçe aktarma:**
  - CTFd `challenges.csv`: önizleme sonra uygulama; kanallar oluşuyor.
  - CTFd takımlar CSV: önizleme sonra uygulama; takımlar ve üyeler oluşuyor.
- [ ] **Entegrasyonlar:**
  - Tema rengi ve vurgu rengi uygulanıyor.
  - E-posta ayarı kaydediliyor.
  - Webhook ekle, sil, etkinleştir. Webhook adresi özel IP ise güvenlik gereği **reddedilmeli**.

---

## 15. Admin paneli

- [ ] **Genel bakış:** KPI kartları, sistem bilgisi, etkinlik akışı yükleniyor.
- [ ] **Moderasyon:** kullanıcı susturma (mute) ve yasaklama.
  - Yasaklanan kullanıcının oturumu düşüyor.
  - Mute geçmişi görünüyor.
- [ ] Kullanıcının rolü değişince o kullanıcının oturumu yenileniyor ve yeni yetki geçerli oluyor.
- [ ] **Raporlar:** kullanıcı raporu (profil kartından **Raporla**) admin listesine düşüyor ve durumu güncellenebiliyor.
- [ ] **Denetim kaydı (audit):** işlemler listeleniyor, eylem filtresi çalışıyor.
- [ ] **Anketler:**
  - Anket oluşturma, düzenleme, silme ve istatistikler çalışıyor.
  - Kullanıcıya anket penceresi (SurveyGate) çıkıyor; yanıtı kaydediliyor.
- [ ] **Sayfalar:** statik sayfa oluşturunca `/p/<slug>` adresinde görünüyor.
- [ ] **Markalama:** platform adı ve logosu değişiyor; giriş ekranına da yansıyor.
- [ ] **Yükleme limiti** ayarı değişince yeni limit uygulanıyor.
- [ ] **Kayıt ayarı** (açık / kapalı) uygulanıyor.

---

## 16. Profil ve kişisel ayarlar

- [ ] Profil: görünen ad ve avatar değişikliği kaydediliyor ve diğer kullanıcılarda da görünüyor.
- [ ] ★ **Açık tema:** dialoglar, formlar ve metinler okunaklı; koyu kutu kalmamış. Koyu temaya dönüş de düzgün.
- [ ] Dil (TR / EN) değişince arayüz ve bildirim başlıkları o dilde gösteriliyor.
- [ ] Varsayılan bildirim modu değişikliği kaydediliyor.
- [ ] Kullanıcı kartında ortak arkadaşlar sekmesi çalışıyor.

---

## 17. Herkese açık sayfalar

- [ ] `/legal/kabul-edilebilir-kullanim` ve `/legal/acceptable-use` açılıyor.
- [ ] `/p/<slug>` sayfaları giriş yapmadan da açılıyor (tasarım gereğiyse).

---

## 18. Güvenlik kontrolleri

```bash
curl -skI https://chat.example.com/login | grep -iE 'x-frame-options|content-security-policy|x-content-type-options|referrer-policy'
curl -sk -X POST https://chat.example.com/api/auth/logout -o /dev/null -w "%{http_code}\n"
```
- [ ] Güvenlik başlıkları mevcut: `X-Frame-Options: DENY`, CSP, `nosniff`.
- [ ] CSRF token'ı olmadan yapılan POST reddediliyor (`403` veya `401`).
- [ ] F12 → Application → Cookies: `sydt_at` ve `sydt_rt` çerezleri `HttpOnly` ve `Secure`.
- [ ] Test kullanıcısıyla art arda yanlış şifre denenince sonunda `429` (hız sınırı) dönüyor. Bunu admin hesabıyla deneme.
- [ ] `Authorization: Bearer …` başlığıyla API isteği production'da reddediliyor.
- [ ] C kullanıcısı başka takımın kanalını, talebini veya ekini ID'yi elle yazarak açamıyor.
- [ ] Yasaklı kullanıcı giriş yapamıyor.
- [ ] Webhook adresine `http://127.0.0.1`, `http://169.254.169.254` veya özel IP yazılınca reddediliyor.
- [ ] `security:regression` betiklerini **canlı sunucuda çalıştırma**. Bu betikler demo ve seed hesaplarına dayanır; yalnızca test ortamında çalıştırılmalı.

---

## 19. Kararlılık ve performans

- [ ] İlk sayfa yüklemesi makul sürüyor (yaklaşık 3 saniyenin altında), sonraki gezinmeler hızlı.
- [ ] `sudo systemctl restart sydt-api` sonrası açık sekmelerde socket kendiliğinden yeniden bağlanıyor; mesajlar tekrar anlık geliyor.
- [ ] `sudo systemctl restart sydt-web` sonrası sayfa yenilenince sorunsuz açılıyor.
- [ ] `sudo reboot` sonrası üç servis de kendiliğinden kalkıyor ve `/health` isteği `ok` dönüyor.
- [ ] 10–15 dakika boyunca aktif kullanım sırasında Console'da hata birikmiyor; bellek kullanımı sürekli artmıyor (`systemctl status` → Memory).
- [ ] İki farklı ağ veya istemci makineden aynı anda erişim sorunsuz.

---

## 20. Yedekleme ve geri dönüş

```bash
sudo grep ^DATABASE_URL= /opt/sydt-chat/apps/server/.env
sudo systemctl stop sydt-api
sudo cp <DB_DOSYASI> <DB_DOSYASI>.bak-$(date +%F-%H%M)
sudo tar czf /root/sydt-uploads-$(date +%F).tgz -C /opt/sydt-chat/apps/server uploads
sudo systemctl start sydt-api
```
- [ ] Veritabanı dosyası yedeklendi ve yedeğin boyutu 0 değil.
- [ ] `uploads` klasörü yedeklendi.
- [ ] `.env` ve `.env.local` dosyalarının kopyası güvenli bir yerde.
- [ ] Yedekten geri dönüş bir kez denendi (test ortamında veya planlı bakımda).
- [ ] Düzenli yedek için cron veya plan belirlendi.

---

## Sorun bulunca toplanacak bilgiler

1. Hangi madde, hangi kullanıcı (rolü) ve hangi tarayıcı.
2. Ekrandaki hata mesajı; varsa baloncuktaki parantez içi ayrıntı.
3. F12 → Console'daki kırmızı satırlar; F12 → Network'teki başarısız isteğin adresi ve durum kodu.
4. Sunucu logları:
   ```bash
   journalctl -u sydt-api --since "10 min ago" --no-pager | tail -n 80
   journalctl -u sydt-web --since "10 min ago" --no-pager | tail -n 40
   sudo tail -n 50 /var/log/nginx/error.log
   ```
