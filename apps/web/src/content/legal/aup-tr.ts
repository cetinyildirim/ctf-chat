import type { LegalSection } from '@/components/legal/LegalDocument';

export const aupTrMeta = {
  title: 'Kabul Edilebilir Kullanım Politikası',
  updated: 'Son güncelleme: 25 Mayıs 2026',
};

export const aupTrIntro = [
  'SYDT Chat; takımınız, topluluğunuz, yarışma organizasyonunuz veya çalışma grubunuz için güvenli bir iletişim alanı sunar. Sunucu oluşturarak veya platformu kullanarak bu politikayı kabul etmiş sayılırsınız.',
  'Aşağıdaki kurallar tüm kullanıcılar, sunucular, kanallar ve paylaşılan içerikler için geçerlidir. Politika, Türkiye Cumhuriyeti mevzuatı ve uluslararası veri koruma ilkeleriyle uyumlu olacak şekilde hazırlanmıştır.',
];

export const aupTrSections: LegalSection[] = [
  {
    id: 'guvenlik',
    title: 'Güvenliğiniz',
    paragraphs: [
      'Platformda herkesin güvende kalması için aşağıdaki içerik ve davranışlara kesinlikle izin verilmez:',
    ],
    subsections: [
      {
        title: 'Şiddet ve yasadışı faaliyet',
        bullets: [
          'Terör örgütlerini, şiddeti veya aşırı ideolojileri teşvik eden, öven veya talimat veren içerik.',
          'Türkiye Cumhuriyeti kanunlarına aykırı suç teşkil eden veya suça teşvik eden paylaşımlar (Türk Ceza Kanunu kapsamındaki suçlar dahil).',
          'Silah, patlayıcı, uyuşturucu veya yasadışı ticaretin örgütlenmesi veya kolaylaştırılması.',
        ],
      },
      {
        title: 'Nefret söylemi ve ayrımcılık',
        bullets: [
          'Irk, etnik köken, milliyet, din, mezhep, cinsiyet, cinsiyet kimliği, cinsel yönelim, yaş, engellilik veya benzeri korunan özelliklere dayalı nefret, aşağılama veya şiddet çağrısı.',
          '5651 sayılı Kanun ve ilgili mevzuat çerçevesinde erişimin engellenmesini gerektiren açık hukuka aykırılık barındıran içerik.',
        ],
      },
      {
        title: 'Zararlı ve hassas içerik',
        bullets: [
          'Kendine zarar verme veya intiharı teşvik eden içerik (yardım hatlarına yönlendirme amaçlı kamu sağlığı bilgilendirmesi hariç).',
          'Rıza olmadan paylaşılan müstehcen içerik, çocukların cinsel istismarını içeren veya ima eden her türlü materyal (anında yetkili mercilere bildirilir).',
          'Gerçek şiddet, işkence veya hayvan istismarı görüntüleri (haber/journalistik bağlam veya sanatsal çerçeve açıkça belirtilmişse istisna değerlendirilir).',
          'Kişilerin özel hayatının gizliliğini ihlal eden ifşalar (doxxing), tehdit veya şantaj.',
        ],
      },
      {
        title: 'Dolandırıcılık ve kötü amaçlı yazılım',
        bullets: [
          'Phishing, sahte yatırım/kripto dolandırıcılığı, piramit şemaları veya Tüketicinin Korunması mevzuatına aykırı ticari aldatma.',
          'Zararlı yazılım, casus yazılım veya kullanıcı cihazına veya hesabına izinsiz erişim sağlayan araçların dağıtımı.',
          'Başkalarının fikri ve sınaî mülkiyet haklarını ihlal eden içerik (telif, marka vb.).',
        ],
      },
    ],
  },
  {
    id: 'adil-kullanim',
    title: 'Adil ve sürdürülebilir kullanım',
    paragraphs: ['Hizmetin kötüye kullanılmasını önlemek için aşağıdaki davranışlar yasaktır:'],
    bullets: [
      'İstenmeyen toplu reklam, spam veya otomatik mesaj botları (açık izin ve resmî entegrasyonlar hariç).',
      'SYDT hesaplarının veya sunucu üyeliklerinin parayla veya başka çıkar karşılığında satılması veya devredilmesi.',
      'Yapay üye sayısı, sahte etkileşim veya platform kaynaklarını (depolama, bant genişliği, API) izinsiz yoğun tüketim.',
      'Kalıcı platform yaptırımından kaçınmak için yedek hesap açma veya yaptırımı atlatma.',
      'SYDT altyapısına yetkisiz erişim, saldırı veya güvenlik testi (önceden yazılı izin alınmadan).',
      'Kullanıcıların açık rızası olmadan kişisel verilerin toplanması; KVKK kapsamında hukuka aykırı veri işleme.',
      'Destek ekibine kasıtlı olarak yanıltıcı bilgi veya sahte ihlal bildirimi gönderme.',
    ],
  },
  {
    id: 'sunucu-sorumlulugu',
    title: 'Sunucu sahipleri ve yöneticiler',
    paragraphs: [
      'Bir sunucu oluşturduğunuzda, o sunucudaki içerik ve moderasyon pratiklerinden bir dereceye kadar sorumlu olursunuz.',
      'Yaş sınırı gerektiren içerik yalnızca uygun şekilde işaretlenmiş ve erişimi kısıtlanmış kanallarda paylaşılmalıdır.',
      'Türkiye’deki kullanıcılar için geçerli vergi, tüketici ve elektronik ticaret yükümlülüklerine uygun ticari faaliyet yürütülmesi sizin sorumluluğunuzdadır.',
    ],
    bullets: [
      'İhlal bildirimlerine makul sürede yanıt verin ve tekrarlayan ihlallerde uygun yaptırım uygulayın.',
      'Resmî makam taleplerine (5651 kapsamındaki barındırma bildirimleri vb.) kanunen izin verilen çerçevede iş birliği yapılır.',
    ],
  },
  {
    id: 'bildirim',
    title: 'İhlal bildirimi',
    paragraphs: [
      'Uygulama içi raporlama araçlarını kullanarak ihlal bildirebilirsiniz. Acil veya hukuki nitelikli durumlarda yerel kolluk kuvvetlerine başvurun.',
      'Telif hakkı ihlali iddiaları için gerekli bilgilerle birlikte platform yöneticisine yazılı başvuru yapılmalıdır.',
    ],
    bullets: [
      'KVKK kapsamında kişisel verilerinizle ilgili talepler için veri sorumlusuna başvuru prosedürümüz geçerlidir.',
      'Ciddi suç unsuru içeren içerikler yetkili mercilerle paylaşılabilir.',
    ],
  },
  {
    id: 'yaptirim',
    title: 'Yaptırımlar ve itiraz',
    bullets: [
      'Politika ihlalleri uyarı, geçici askıya alma, sunucu veya hesap kapatma ile sonuçlanabilir.',
      'Yaptırımın haksız olduğunu düşünüyorsanız, karar gerekçesiyle birlikte yazılı itiraz hakkınız saklıdır; kanıtlarınızı sunmanız beklenir.',
      'Hukuka aykırılığı açık ve ağır olan ihlallerde itiraz süreci, yürürlükteki mevzuat çerçevesinde sınırlı olabilir.',
    ],
  },
  {
    id: 'yetki',
    title: 'Uygulanacak hukuk ve yetki',
    paragraphs: [
      'SYDT Chat hizmetinin işletilmesi ve bu politikanın yorumlanmasında öncelikle Türkiye Cumhuriyeti kanunları esas alınır.',
      'Avrupa Birliği Genel Veri Koruma Tüzüğü (GDPR) ile uyumlu olması gereken durumlarda, veri sahibi hakları KVKK ve GDPR ilkeleri çerçevesinde değerlendirilir.',
      'Tüketici uyuşmazlıklarında Türkiye’deki zorunlu tüketici hakları ve yetkili tüketici hakem heyetleri saklıdır.',
    ],
    bullets: [
      'Veri işleme ve barındırma faaliyetleri için geçerli ikincil düzenlemeler (5651, KVKK, ilgili yönetmelikler) uygulanır.',
      'Platform dışındaki ciddi ihlaller (taciz, dolandırıcılık zinciri vb.), kanıt olduğunda hesap güvenliği için değerlendirilebilir.',
    ],
  },
];

export const aupTrFooter = [
  'Bu metin, topluluk kuralları ve kabul edilebilir kullanım ilkelerinizi açıklamak içindir; özel hukuki danışmanlık yerine geçmez.',
  'Politika güncellenebilir; önemli değişiklikler sunucu sahiplerine ve kayıtlı kullanıcılara makul yollarla duyurulur.',
];
