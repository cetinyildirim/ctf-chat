import type { LegalSection } from '@/components/legal/LegalDocument';

export const aupTrMeta = {
  title: 'SYDT Chat Kullanım Kuralları',
  updated: 'Son güncelleme: 2 Ekim 2026',
};

export const aupTrIntro = [
  'SYDT Chat; CTF yarışmalarında yarışmacılar, takımlar, organizatörler ve destek ekibi arasındaki iletişim için kullanılan bir platformdur. Sohbet kanalları, özel mesajlar, destek talepleri, duyurular, anketler, takım yönetimi ve canlı skor tablosu bu kuralların kapsamındadır.',
  'Hesap oluşturarak, giriş yaparak veya bir sunucuya katılarak bu kuralları okuduğunuzu ve kabul ettiğinizi beyan edersiniz. Kurallar tüm kullanıcılar için geçerlidir; yetkililer için ek yükümlülükler ayrıca belirtilmiştir. Yarışma organizatörleri kendi yarışmalarına özel ek kurallar duyurabilir; bu ek kurallar da bağlayıcıdır.',
];

export const aupTrSections: LegalSection[] = [
  {
    id: 'ozet',
    title: 'Kısaca temel kurallar',
    bullets: [
      'Hesabınızı yalnızca siz kullanın; parolanızı ve takım davet kodunuzu kimseyle paylaşmayın.',
      'Flag, çözüm veya ipucunu kendi takımınız dışında hiç kimseyle paylaşmayın.',
      'Yalnızca organizatörlerin hedef olarak gösterdiği sistemlere saldırın; SYDT Chat, CTFd ve yarışma altyapısı hedef değildir.',
      'Herkese saygılı davranın; taciz, hakaret, nefret söylemi ve tehdit yasaktır.',
      'Kanalları amacına uygun kullanın; spam, flood ve gereksiz etiketleme yapmayın.',
      'Sorunlarınızı doğru kategoride destek talebi açarak bildirin; yetkililere özel mesajla ısrar etmeyin.',
      'Zararlı yazılım veya izin verilmeyen türde dosya yüklemeyin.',
      'Onay gerektiren duyuruları okuyun; onayladığınız duyurudaki kurallardan sorumlu olursunuz.',
      'Yaptırımları yeni hesap açarak veya başka bir yolla atlatmaya çalışmayın.',
      'Platformda bir güvenlik açığı bulursanız istismar etmeyin; destek talebiyle organizatörlere bildirin.',
    ],
  },
  {
    id: 'roller',
    title: '1. Roller ve tanımlar',
    paragraphs: [
      'Platformdaki yetkiler rollere göre belirlenir. Bir kullanıcı platform genelinde bir role, her sunucuda ise ayrıca sunucu rollerine sahip olabilir.',
    ],
    bullets: [
      'Süper yönetici: Platformun tamamından, sistem ayarlarından ve yedeklemeden sorumludur.',
      'Yönetici: Yarışma ve sunucu yapılandırmasını, takımları, duyuruları ve moderasyonu yönetir.',
      'Moderatör: Kanallardaki düzeni sağlar, kullanıcıları susturabilir ve ihlal bildirimlerini inceler.',
      'Soru yazarı: Görevleri hazırlar, görevlerle ilgili destek taleplerini yanıtlar.',
      'Takım kaptanı: Takımını temsil eder, takım logosunu ve davet kodunu yönetir.',
      'Takım üyesi: Yarışmaya takımı adına katılan kullanıcıdır.',
      'İzleyici / gözlemci: Yarışmayı takip eden, yarışmaya katılmayan kullanıcıdır.',
      'Bu metinde "yetkili" ifadesi; süper yönetici, yönetici, moderatör ve soru yazarını birlikte ifade eder.',
    ],
  },
  {
    id: 'hesap',
    title: '2. Hesap ve kimlik',
    bullets: [
      'Her kişi yalnızca bir hesap kullanabilir. Hesap paylaşmak, başkası adına hesap açmak veya başkasının hesabını kullanmak yasaktır.',
      'Kullanıcı adı 3–24 karakter olmalı ve yalnızca harf, rakam, alt çizgi (_), nokta (.) ve tire (-) içermelidir. Kullanıcı adı ve görünen ad; hakaret, müstehcenlik, siyasi propaganda, reklam veya başka birini taklit eden ifadeler içeremez.',
      'Yetkili, organizatör veya başka bir takım/kullanıcı gibi görünmeye çalışmak (kimlik taklidi) yasaktır.',
      'Parolanız en az 8 karakter olmalı; büyük harf, küçük harf ve rakam içermelidir. Parolanızı başka hizmetlerde kullanmamanız önerilir.',
      'Ortak kullanılan bilgisayarlarda işiniz bitince oturumu kapatın. Hesabınızla yapılan tüm işlemlerden siz sorumlusunuz.',
      'Hesabınızın ele geçirildiğinden şüpheleniyorsanız parolanızı hemen değiştirin ve organizatörlere bildirin.',
      'Kayıt sırasında veya sonrasında girilen takım davet kodları yalnızca ilgili takımın üyeleri tarafından kullanılabilir.',
    ],
  },
  {
    id: 'davranis',
    title: '3. Genel davranış kuralları',
    paragraphs: ['Platformun tamamında (kanallar, özel mesajlar, destek talepleri, profil alanları) aşağıdakiler yasaktır:'],
    subsections: [
      {
        title: 'Saygısız ve zarar verici davranışlar',
        bullets: [
          'Hakaret, küfür, aşağılama, alay, taciz, ısrarlı rahatsız etme ve tehdit.',
          'Irk, etnik köken, din, mezhep, cinsiyet, cinsel yönelim, yaş, engellilik veya benzeri özelliklere dayalı nefret söylemi ve ayrımcılık.',
          'Başkalarının kişisel bilgilerini (adres, telefon, kimlik bilgisi, fotoğraf vb.) izinsiz paylaşmak (ifşa / doxxing).',
          'Şantaj, kışkırtma, diğer kullanıcıları ihlale yönlendirme.',
        ],
      },
      {
        title: 'Hukuka aykırı ve uygunsuz içerik',
        bullets: [
          'Türkiye Cumhuriyeti kanunlarına göre suç teşkil eden veya suça teşvik eden her türlü içerik; terör ve şiddeti öven veya özendiren paylaşımlar.',
          'Müstehcen, cinsel içerikli veya şiddet görüntüsü içeren paylaşımlar; çocukların istismarını içeren veya ima eden her türlü materyal (yetkili mercilere derhal bildirilir).',
          'Kendine zarar vermeyi veya intiharı teşvik eden içerik.',
          'Siyasi propaganda, ticari reklam, dolandırıcılık, oltalama (phishing) ve sahte bağlantılar.',
          'Telif hakkı veya diğer fikri mülkiyet haklarını ihlal eden içerik.',
        ],
      },
    ],
  },
  {
    id: 'yarisma',
    title: '4. Yarışma dürüstlüğü',
    paragraphs: [
      'CTF yarışmalarında adil rekabet esastır. Aşağıdaki kurallar yarışma süresince tüm yarışmacılar ve takımlar için geçerlidir.',
    ],
    subsections: [
      {
        title: 'Paylaşım yasakları',
        bullets: [
          'Flag, çözüm adımı, exploit, ipucu veya görevle ilgili kritik bilgi yalnızca kendi takım kanalınızda ve takım arkadaşlarınızla paylaşılabilir.',
          'Genel sohbet, görev tartışma kanalları ve diğer ortak alanlarda çözüme götüren bilgi (spoiler) paylaşmak yasaktır.',
          'Başka takımlarla iş birliği yapmak, flag alışverişi yapmak veya başka bir takıma yardım etmek yasaktır.',
          'Çözüm yazıları (writeup) yalnızca yarışma bittikten sonra ve organizatörlerin izin verdiği şekilde yayımlanabilir.',
        ],
      },
      {
        title: 'Saldırı kapsamı',
        bullets: [
          'Yalnızca organizatörlerin görev kapsamında hedef olarak belirttiği sistemlere saldırı yapılabilir.',
          'SYDT Chat, CTFd skor sistemi, yarışma ağı ve altyapısı, diğer takımların cihazları ve hesapları hedef değildir; bunlara yönelik tarama, saldırı, hizmet engelleme (DoS) veya yetkisiz erişim girişimi kesinlikle yasaktır.',
          'Flag gönderim sistemine kaba kuvvet (brute force) denemesi yapmak, otomatik araçlarla aşırı istek göndermek yasaktır.',
          'Görevde amaçlanmayan bir açık veya altyapı hatası fark ederseniz bunu istismar etmeyin; destek talebiyle bildirin.',
        ],
      },
      {
        title: 'Takım ve hesap düzeni',
        bullets: [
          'Bir kullanıcı aynı yarışmada yalnızca bir takımda yer alabilir.',
          'Takım dışından kişilerden yardım almak, hesabı başkasına kullandırmak veya birden fazla hesapla yarışmak yasaktır.',
          'İpuçları yalnızca sistem üzerinden alınır; ipucu bedeli takım puanından düşülür. Yetkililerden destek talebi veya özel mesaj yoluyla ipucu istenemez.',
        ],
      },
    ],
  },
  {
    id: 'kanallar',
    title: '5. Kanallar ve mesajlaşma',
    subsections: [
      {
        title: 'Kanal türleri ve amaçları',
        bullets: [
          'Duyuru kanalları: Yalnızca yetkililer yazar; yarışmacılar için okuma amaçlıdır.',
          'Genel sohbet kanalları: Tüm katılımcılara açık, konu dışına çıkmadan ve saygı çerçevesinde kullanılır.',
          'Görev tartışma kanalları: Görevle ilgili genel sorular içindir; çözüm, flag veya spoiler içeremez.',
          'Takım kanalları: Yalnızca takım üyeleri ve yetkililer görebilir; takım içi çalışma için kullanılır.',
          'Yetkili kanalları: Organizasyon iç koordinasyonu içindir; içerikleri gizlidir ve dışarıya aktarılamaz.',
          'Kilitli kanallara yalnızca yetkililer yazabilir.',
        ],
      },
      {
        title: 'Mesaj kuralları',
        bullets: [
          'Mesajlar en fazla 4.000 karakter olabilir. Kısa sürede çok sayıda mesaj göndermek (flood) yasaktır; sistem 10 saniyede 30 mesajı aşan gönderimleri otomatik olarak engeller.',
          'Aynı mesajı birden çok kanala göndermek, anlamsız mesajlar, zincir mesajlar ve reklam spam sayılır.',
          '@ ile etiketleme yalnızca gerçekten ilgili kişiye ulaşmak için kullanılmalıdır; yetkilileri veya kullanıcıları gereksiz yere tekrar tekrar etiketlemek yasaktır.',
          'Kendi mesajlarınızı düzenleyebilir ve silebilirsiniz. Yetkililer kurallara aykırı mesajları silebilir veya önemli mesajları sabitleyebilir.',
          'Tepki (emoji) özelliği alay etmek veya taciz amacıyla kullanılamaz.',
        ],
      },
      {
        title: 'Özel mesajlar ve arkadaşlık',
        bullets: [
          'Aynı sunucuda bulunduğunuz kullanıcılara ve yetkililere, arkadaş olarak eklemeden özel mesaj gönderebilirsiniz.',
          'Farklı takımlar arasında soru çözümü, flag veya ipucu paylaşmak yarışma kurallarının ihlalidir ve özel mesajlar için de geçerlidir.',
          'Özel mesajlar da bu kurallara tabidir; özel mesaj yoluyla taciz, spam veya yarışma bilgisi sızdırmak yasaktır.',
          'Yetkililere destek konuları için özel mesaj yerine destek talebi açılmalıdır.',
          'Arkadaşlık istekleri ısrarlı veya rahatsız edici şekilde gönderilemez.',
        ],
      },
    ],
  },
  {
    id: 'dosyalar',
    title: '6. Dosya paylaşımı',
    bullets: [
      'Mesajlara görsel (JPEG, PNG, GIF, WebP), PDF, düz metin, ZIP, Word/Excel belgeleri, ses ve video dosyaları eklenebilir.',
      'HTML, JavaScript ve SVG gibi tarayıcıda çalışabilen dosyalar güvenlik nedeniyle yüklenemez. Dosya içeriği uzantısıyla uyuşmayan dosyalar reddedilir.',
      'Dosya boyutu sınırı platform yöneticisi tarafından belirlenir (varsayılan 100 MB). Destek talebi mesajlarına en fazla 5 dosya eklenebilir.',
      'Yüklenen dosyalar güvenlik taramasından geçirilebilir; zararlı içerik tespit edilen dosyalar otomatik olarak silinir ve reddedilir.',
      'Zararlı yazılım, virüs, exploit kiti veya başkalarının cihazına zarar verebilecek dosyalar paylaşmak yasaktır. Yarışma görev dosyaları yalnızca organizatörlerin resmî kanallarından dağıtılır.',
      'Görev dosyalarını, flag içeren ekran görüntülerini veya çözüm çıktılarını ortak kanallarda paylaşmak yasaktır.',
      'Kişisel veri içeren belgeleri (kimlik, öğrenci belgesi vb.) yalnızca organizatörler talep ettiğinde ve destek talebi üzerinden paylaşın.',
    ],
  },
  {
    id: 'destek',
    title: '7. Destek talepleri',
    paragraphs: [
      'Destek talepleri; görevlerdeki hatalar, teknik sorunlar, flag gönderim ve puan sorunları, hesap/takım işlemleri gibi konularda organizatörlere ulaşmanın resmî yoludur.',
    ],
    bullets: [
      'Talebinizi doğru kategoride açın; görevle ilgili kategorilerde ilgili görevi seçin. Başlık en az 4, açıklama en az 10 karakter olmalıdır.',
      'Sorunu açık ve eksiksiz anlatın: ne yaptığınızı, ne beklediğinizi ve ne ile karşılaştığınızı yazın. Her talepte tek bir konu ele alın.',
      'Aynı konu için birden fazla talep açmayın; yinelenen talepler yetkililer tarafından birleştirilebilir veya kapatılabilir. Sistem dakikada 10 talebi aşan açılışları engeller.',
      'Destek talepleri ipucu veya çözüm istemek için kullanılamaz. Görev açıklaması netleştirmeleri gerekirse tüm takımlara duyuru olarak yapılır.',
      'Talebiniz "Yarışmacı yanıtı bekleniyor" durumuna alındıysa en kısa sürede yanıt verin.',
      'Çözülen veya kapatılan bir talebi yalnızca gerekçe yazarak yeniden açabilirsiniz; gereksiz yeniden açma yapmayın.',
      'Yetkililerle yazışmalarda saygılı olun. Yetkililerin talep içindeki dahili notları yalnızca yetkililer görebilir.',
      'Organizatörler yarışmanın durumuna göre talep açmayı geçici olarak kısıtlayabilir veya kapatabilir.',
    ],
  },
  {
    id: 'duyurular',
    title: '8. Duyurular, anketler ve bildirimler',
    bullets: [
      'Duyurular, yarışmaya ilişkin resmî bilgilendirmelerdir. Duyurularda bildirilen kural ve değişiklikler bağlayıcıdır.',
      'Onay gerektiren duyurular ekranda "Tamam" ile onaylanmadan kapatılamaz. Onayladığınız duyurunun içeriğini okumuş ve kabul etmiş sayılırsınız.',
      'Zorunlu anketler gönderilmeden platformu kullanmaya devam edemezsiniz. Anketleri dürüstçe yanıtlayın.',
      'Kanal bildirim tercihlerinizi değiştirebilirsiniz; duyurular ve size yönelik moderasyon bildirimleri bu tercihlerden bağımsız olarak iletilir.',
    ],
  },
  {
    id: 'takimlar',
    title: '9. Takımlar',
    bullets: [
      'Takım adı ve takım logosu genel davranış kurallarına uygun olmalıdır; hakaret, müstehcenlik, siyasi veya ticari içerik barındıramaz.',
      'Takım logosunu yalnızca takım kaptanı yükleyebilir, değiştirebilir veya kaldırabilir. Başkasına ait logo veya marka izinsiz kullanılamaz.',
      'Takım davet kodunu yalnızca takım kaptanı görebilir. Kaptan, kodu yalnızca kendi takım üyeleriyle paylaşmakla yükümlüdür.',
      'Takım kanalları takım içi çalışma içindir; içerikleri takım dışına aktarılmamalıdır.',
      'Takıma katılım, kaptanın paylaştığı davet koduyla yapılır. Üye çıkarma ve kaptan değişikliği gibi işlemler organizatörler tarafından yapılır; bu talepler destek talebiyle iletilir.',
    ],
  },
  {
    id: 'profil',
    title: '10. Profil ve kişisel veriler',
    bullets: [
      'Profil fotoğrafı, görünen ad ve diğer profil alanları genel davranış kurallarına uygun olmalıdır.',
      'Başkalarına ait fotoğrafları veya kişisel bilgileri profilinizde kullanamazsınız.',
      'Platform; mesajlarınızı, destek taleplerinizi, yüklediğiniz dosyaları ve hesap bilgilerinizi hizmetin sunulması, güvenliğin sağlanması ve yarışmanın yürütülmesi amacıyla işler.',
      'Kişisel verileriniz 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında korunur. Verilerinize ilişkin talepleriniz için organizatörlere başvurabilirsiniz.',
    ],
  },
  {
    id: 'yetkililer',
    title: '11. Yetkililerin yükümlülükleri',
    paragraphs: ['Yetkililer, yukarıdaki tüm kurallara ek olarak aşağıdaki yükümlülüklere uyar:'],
    bullets: [
      'Tüm takımlara eşit ve tarafsız davranmak; hiçbir takıma resmî ipuçları dışında yardım etmemek.',
      'Görev içeriklerini, flag bilgilerini, yetkili kanallarındaki yazışmaları ve destek taleplerindeki dahili notları gizli tutmak.',
      'Moderasyon yetkilerini (mesaj silme, susturma, uzaklaştırma, askıya alma) yalnızca kural ihlallerinde, orantılı şekilde ve mümkün olduğunda gerekçe belirterek kullanmak.',
      'Destek taleplerine makul sürede yanıt vermek ve talepleri doğru durumda tutmak.',
      'Kullanıcıların kişisel verilerine yalnızca görev gereği erişmek ve bu verileri üçüncü kişilerle paylaşmamak.',
      'Yönetim işlemlerinin tamamı işlem kayıtlarına (audit log) yazılır ve denetlenebilir.',
      'Süper yöneticiler, sistem yedeklerini güvenli şekilde saklamak ve yetkisiz kişilerle paylaşmamakla yükümlüdür.',
    ],
  },
  {
    id: 'bildirim',
    title: '12. İhlal ve güvenlik açığı bildirimi',
    bullets: [
      'Kurallara aykırı davranan bir kullanıcıyı, profil kartındaki "Bildir" seçeneğiyle yetkililere bildirebilirsiniz.',
      'Yarışmayla ilgili sorunları (görev hatası, altyapı sorunu, puan hatası vb.) destek talebiyle bildirin.',
      'SYDT Chat platformunda bir güvenlik açığı fark ederseniz açığı istismar etmeden, ayrıntılarıyla birlikte organizatörlere bildirin. İyi niyetle ve sorumlu şekilde yapılan bildirimler yaptırım gerektirmez.',
      'Kasıtlı olarak yanlış, yanıltıcı veya kötü niyetli bildirimde bulunmak yasaktır.',
      'Acil veya suç teşkil eden durumlarda yetkili kolluk kuvvetlerine de başvurabilirsiniz.',
    ],
  },
  {
    id: 'yaptirim',
    title: '13. Moderasyon ve yaptırımlar',
    paragraphs: [
      'Kural ihlallerinde, ihlalin ağırlığına ve tekrarına göre aşağıdaki yaptırımlar tek başına veya birlikte uygulanabilir. Ağır ihlallerde kademeli sıra izlenmeden doğrudan ağır yaptırım uygulanabilir.',
    ],
    bullets: [
      'Uyarı: Yetkili tarafından sözlü veya yazılı uyarı yapılır.',
      'Mesaj veya içerik silme: Kurallara aykırı mesaj, dosya veya profil içeriği kaldırılır.',
      'Susturma: Belirlenen süre boyunca mesaj gönderemezsiniz. Susturma süresi ve gerekçesi size bildirim olarak iletilir; süre dolduğunda kısıtlama otomatik olarak kalkar.',
      'Sunucudan uzaklaştırma: İlgili sunucuya erişiminiz kaldırılır ve davet bağlantılarıyla tekrar katılamazsınız.',
      'Hesabın askıya alınması: Platformu belirlenen süre boyunca (1 saat, 1 gün, 3 gün, 7 gün, 30 gün) veya süresiz olarak kullanamazsınız. Askıya alma anında oturumunuz kapatılır; süre ve gerekçe giriş ekranında gösterilir. Süreli askıya almalar süre dolunca otomatik olarak kalkar.',
      'Yarışma yaptırımları: Organizatörler kopya, flag paylaşımı veya altyapıya saldırı gibi durumlarda puan düşürme veya takımın yarışmadan diskalifiye edilmesi kararı verebilir.',
      'Yaptırımdan kaçmak amacıyla yeni hesap açmak veya başka bir kullanıcının hesabını kullanmak ek ve daha ağır yaptırım sebebidir.',
      'Suç teşkil eden durumlar ve ilgili kayıtlar, yasal zorunluluk halinde yetkili mercilerle paylaşılabilir.',
    ],
  },
  {
    id: 'itiraz',
    title: '14. İtiraz',
    bullets: [
      'Bir yaptırımın hatalı olduğunu düşünüyorsanız, yaptırımın bildirildiği tarihten itibaren makul süre içinde organizatörlere gerekçeli olarak itiraz edebilirsiniz. Hesabınız askıdaysa itirazınızı organizatörlerin duyurduğu iletişim kanalları üzerinden yazılı olarak iletin.',
      'İtirazlar, mümkün olduğunda yaptırımı uygulayan kişi dışındaki bir yetkili tarafından değerlendirilir. İtiraz süresince yaptırım devam eder.',
      'Yarışma sırasında verilen puan ve diskalifiye kararlarına ilişkin itirazlar, yarışma organizasyonunun ilan ettiği kurallara göre sonuçlandırılır.',
    ],
  },
  {
    id: 'kayit',
    title: '15. Kayıtlar, güvenlik ve veri saklama',
    bullets: [
      'Platform güvenliği ve denetim amacıyla giriş işlemleri, yönetim işlemleri ve moderasyon kararları kayıt altına alınır.',
      'Sistem verileri (veritabanı ve yüklenen dosyalar) düzenli olarak yedeklenir. Sildiğiniz mesaj ve dosyalar, yedeklerin saklama süresi boyunca yedeklerde bulunmaya devam edebilir.',
      'Yarışma iletişimi; itirazların değerlendirilmesi, yarışma sonrası raporlama ve olası hukuki süreçler için organizatörlerin belirlediği süre boyunca saklanabilir.',
      'Platforma otomatik araçlarla (bot, betik) erişmek, verileri toplu olarak çekmek veya platformun hız sınırlarını aşmaya çalışmak yasaktır.',
    ],
  },
  {
    id: 'hukuk',
    title: '16. Uygulanacak hukuk',
    paragraphs: [
      'Bu kuralların uygulanmasında Türkiye Cumhuriyeti mevzuatı, özellikle 5651 sayılı Kanun, 6698 sayılı KVKK ve Türk Ceza Kanunu esas alınır.',
      'Bu kurallarda yer almayan konularda yarışma organizasyonunun ilan ettiği kurallar ve yetkililerin kararları geçerlidir.',
    ],
  },
];

export const aupTrFooter = [
  'Kurallar ihtiyaç halinde güncellenebilir. Önemli değişiklikler platform içinde duyuru olarak yayımlanır; güncellemeden sonra platformu kullanmaya devam etmeniz güncel kuralları kabul ettiğiniz anlamına gelir.',
  'Sorularınız için destek talebi açabilir veya yarışma organizatörlerine başvurabilirsiniz.',
];
