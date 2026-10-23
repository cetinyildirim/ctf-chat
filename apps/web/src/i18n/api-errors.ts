import type { Locale } from './dict';
import { getCurrentLocale } from './current-locale';

/**
 * Turkish renderings of the English messages the API (and the shared zod schemas) produce.
 * Keys must match the server text exactly; unknown messages are shown as-is.
 */
const EXACT_TR: Record<string, string> = {
  // Generic HTTP
  'Bad request': 'Geçersiz istek',
  Unauthorized: 'Oturum açmanız gerekiyor',
  Forbidden: 'Bu işlem için yetkiniz yok',
  'Not found': 'Bulunamadı',
  Conflict: 'Çakışma oluştu',
  'Too many requests': 'Çok fazla istek gönderildi, lütfen biraz bekleyin',
  'Route not found': 'İstenen adres bulunamadı',
  'Internal server error': 'Sunucu hatası oluştu',
  'Validation failed': 'Girilen bilgiler geçersiz',
  'Unknown error': 'Bilinmeyen hata',
  'CSRF validation failed': 'Güvenlik doğrulaması başarısız; sayfayı yenileyip tekrar deneyin',
  'Not allowed': 'İzin verilmiyor',
  'You do not have permission to perform this action': 'Bu işlemi yapmaya yetkiniz yok',

  // Auth / session
  'Authentication required': 'Oturum açmanız gerekiyor',
  'Invalid credentials': 'Kullanıcı adı/e-posta veya parola hatalı',
  'Invalid or expired session': 'Oturumunuz geçersiz veya süresi dolmuş',
  'Invalid refresh token': 'Oturum yenilenemedi; tekrar giriş yapın',
  'No refresh token': 'Oturum yenilenemedi; tekrar giriş yapın',
  'Refresh token expired': 'Oturum süresi doldu; tekrar giriş yapın',
  'Refresh token rejected': 'Oturum yenilenemedi; tekrar giriş yapın',
  'Session user not found': 'Oturumdaki kullanıcı bulunamadı',
  'Current password is incorrect': 'Mevcut parola hatalı',
  'New password must be different from the current password': 'Yeni parola mevcut paroladan farklı olmalı',
  'Account suspended': 'Hesabınız askıya alındı',
  'Your account is suspended': 'Hesabınız askıya alındı',
  'Your account is deactivated': 'Hesabınız pasifleştirildi; yöneticinizle iletişime geçin',

  // Admin user management
  'Username is already taken': 'Bu kullanıcı adı zaten kullanılıyor',
  'Email is already in use': 'Bu e-posta adresi zaten kullanılıyor',
  'You cannot manage a user with an equal or higher role': 'Sizinle aynı veya daha yüksek roldeki bir kullanıcıyı yönetemezsiniz',
  'You cannot grant a role equal to or above your own': 'Kendi rolünüze eşit veya daha yüksek bir rol veremezsiniz',
  'You cannot change your own role': 'Kendi rolünüzü değiştiremezsiniz',
  'You cannot deactivate yourself': 'Kendi hesabınızı pasifleştiremezsiniz',
  'At least one super admin must remain': 'Sistemde en az bir süper yönetici kalmalı',
  'Role does not belong to this server': 'Seçilen rol bu sunucuya ait değil',
  'Membership not found': 'Kullanıcı bu sunucunun üyesi değil',
  'Target server required': 'Hedef sunucu seçilmedi',
  'Source server required': 'Kaynak sunucu seçilmedi',
  'Source and target must differ': 'Kaynak ve hedef sunucu farklı olmalı',
  'Nothing to update': 'Değiştirilecek bir bilgi yok',
  'You are temporarily muted': 'Geçici olarak susturuldunuz',
  'Too many auth attempts, slow down.': 'Çok fazla giriş denemesi yapıldı, lütfen biraz bekleyin.',
  'Too many sensitive auth operations.': 'Çok fazla hassas hesap işlemi yapıldı, lütfen biraz bekleyin.',

  // Rate limits
  'Too many admin actions, slow down.': 'Çok fazla yönetim işlemi yapıldı, lütfen biraz bekleyin.',
  'Too many file downloads, slow down.': 'Çok fazla dosya indirildi, lütfen biraz bekleyin.',
  'Too many invite attempts, slow down.': 'Çok fazla davet denemesi yapıldı, lütfen biraz bekleyin.',
  'Too many tickets opened, slow down.': 'Çok fazla destek talebi açıldı, lütfen biraz bekleyin.',
  'Slow down - too many replies.': 'Yavaşlayın, çok fazla yanıt gönderdiniz.',
  'Slow down — too many messages.': 'Yavaşlayın, çok fazla mesaj gönderdiniz.',

  // Servers / members / roles
  'Server not found': 'Sunucu bulunamadı',
  'Member not found': 'Üye bulunamadı',
  'User not found': 'Kullanıcı bulunamadı',
  'Not a member of this server': 'Bu sunucunun üyesi değilsiniz',
  'User is not a member of this server': 'Kullanıcı bu sunucunun üyesi değil',
  'Missing server permission': 'Bu sunucuda gerekli yetkiye sahip değilsiniz',
  'Missing permission to ban users': 'Kullanıcı yasaklama yetkiniz yok',
  'Missing permission to mute users': 'Kullanıcı susturma yetkiniz yok',
  'Cannot assign role with permissions you lack': 'Sahip olmadığınız yetkileri içeren bir rol atayamazsınız',
  'Cannot delete Default role': 'Varsayılan rol silinemez',
  'Cannot delete the last server': 'Son kalan sunucu silinemez',
  'Cannot ban yourself': 'Kendinizi yasaklayamazsınız',
  'Invalid role for this server': 'Bu sunucu için geçersiz rol',
  'Invalid server role': 'Geçersiz sunucu rolü',
  'Banned from this server': 'Bu sunucudan yasaklandınız',
  'You are banned from this server': 'Bu sunucudan yasaklandınız',
  'serverId required': 'Sunucu seçilmedi',
  'serverId query required': 'Sunucu seçilmedi',
  'Slug already in use': 'Bu kısa ad zaten kullanılıyor',
  'Invalid slug format': 'Kısa ad biçimi geçersiz',
  'Username or user id required': 'Kullanıcı adı veya kullanıcı kimliği gerekli',

  // Invites
  'Invite not found': 'Davet bulunamadı',
  'This invite has expired or reached its use limit': 'Bu davetin süresi dolmuş veya kullanım sınırına ulaşmış',
  'Could not generate invite code': 'Davet kodu oluşturulamadı',
  'Ambiguous invite code; specify the competition server': 'Davet kodu birden fazla sunucuyla eşleşiyor; yarışma sunucusunu belirtin',

  // Categories / channels
  'Category not found': 'Kategori bulunamadı',
  'Category has no server': 'Kategori bir sunucuya bağlı değil',
  'A category with this key already exists': 'Bu anahtara sahip bir kategori zaten var',
  'Channel not found': 'Kanal bulunamadı',
  'Channel not in this server': 'Kanal bu sunucuya ait değil',
  'A channel with this name already exists': 'Bu isimde bir kanal zaten var',
  'Channel is locked': 'Kanal kilitli',
  'Invalid channel type': 'Geçersiz kanal türü',
  'Cannot delete DM channels': 'Özel mesaj kanalları silinemez',
  'Not a team category': 'Bu bir takım kategorisi değil',
  'Only team members can add channels here': 'Buraya yalnızca takım üyeleri kanal ekleyebilir',
  'Only staff may post in announcement channels': 'Duyuru kanallarına yalnızca yetkililer yazabilir',
  'Name required': 'İsim gerekli',

  // Messages / reactions / DMs
  'Message not found': 'Mesaj bulunamadı',
  'Cannot edit other messages': 'Başkalarının mesajlarını düzenleyemezsiniz',
  'Add text or attach at least one file': 'Bir metin yazın veya en az bir dosya ekleyin',
  'Invalid reply target': 'Yanıtlanan mesaj geçersiz',
  'Could not react': 'Tepki eklenemedi',
  'Cannot send an empty message': 'Boş mesaj gönderilemez',
  'Cannot message yourself': 'Kendinize mesaj gönderemezsiniz',
  'Direct messages are limited to your team and staff': 'Özel mesajlar yalnızca takım arkadaşlarınız ve yetkililerle sınırlıdır',
  'Direct messages require a shared server': 'Özel mesaj için bu kullanıcıyla ortak bir sunucuda bulunmanız gerekir',
  'DM slot conflict — contact admin': 'Özel mesaj kanalında çakışma var; yöneticiye başvurun',

  // Uploads / files
  'File too large': 'Dosya çok büyük',
  'Too many files': 'Çok fazla dosya seçildi',
  'File type not allowed': 'Bu dosya türüne izin verilmiyor',
  'Only JPEG, PNG, GIF, or WebP images are allowed': 'Yalnızca JPEG, PNG, GIF veya WebP görselleri yüklenebilir',
  'File missing': 'Dosya bulunamadı',
  'No file': 'Dosya seçilmedi',
  'Image file required': 'Bir görsel dosyası seçin',
  'CSV file required': 'Bir CSV dosyası seçin',
  'Invalid plain text file': 'Geçersiz metin dosyası',
  'Invalid text file': 'Geçersiz metin dosyası',
  'Could not detect file type': 'Dosya türü tespit edilemedi',
  'File content does not match declared type': 'Dosya içeriği uzantısıyla uyuşmuyor',

  // Friends / reports
  'Already friends': 'Zaten arkadaşsınız',
  'Request already sent': 'İstek zaten gönderildi',
  'Not pending': 'Bekleyen bir istek yok',
  'Cannot report yourself': 'Kendinizi şikâyet edemezsiniz',
  'Invalid target': 'Geçersiz hedef',

  // Teams
  'Team not found': 'Takım bulunamadı',
  'Team not in server': 'Takım bu sunucuda değil',
  'Invalid team invite code': 'Takım davet kodu geçersiz',
  'Captain must belong to team': 'Kaptan takımın üyesi olmalı',
  'User is not on this team': 'Kullanıcı bu takımda değil',
  'You are already on a team in this server': 'Bu sunucuda zaten bir takımdasınız',
  'You are already on a different team in this competition': 'Bu yarışmada zaten başka bir takımdasınız',
  'This team is not attached to a competition': 'Bu takım bir yarışmaya bağlı değil',
  'Only the team captain can manage the team logo': 'Takım logosunu yalnızca takım kaptanı yönetebilir',
  'Only the team captain can view the invite code': 'Davet kodunu yalnızca takım kaptanı görebilir',
  'No teams or members were imported.': 'Hiç takım veya üye içe aktarılmadı.',
  'userId or username required': 'Kullanıcı kimliği veya kullanıcı adı gerekli',

  // Challenges / competition / CTFd
  'Challenge not found': 'Görev bulunamadı',
  'Hint not found': 'İpucu bulunamadı',
  'Only team members can request hints': 'Yalnızca takım üyeleri ipucu alabilir',
  'Unknown challenge for this competition': 'Bu yarışmada böyle bir görev yok',
  'Competition must start before it ends': 'Yarışmanın başlangıcı bitişinden önce olmalı',
  'startsAt must be before endsAt': 'Başlangıç zamanı bitiş zamanından önce olmalı',
  'No challenges found in CSV. Use CTFd challenges export.': 'CSV içinde görev bulunamadı. CTFd görev dışa aktarımını kullanın.',
  'No channels were imported.': 'Hiç kanal içe aktarılmadı.',
  'CTFd URL is required': 'CTFd adresi gerekli',
  'CTFd request timed out': 'CTFd isteği zaman aşımına uğradı',
  'CTFd redirect loop': 'CTFd yönlendirme döngüsüne girdi',
  'Invalid URL': 'Geçersiz adres',
  'URL must use http or https': 'Adres http veya https ile başlamalı',
  'URL host could not be resolved': 'Adresin sunucusu çözümlenemedi',
  'URL host is not allowed': 'Bu adrese izin verilmiyor',

  // Tickets
  'Ticket not found': 'Destek talebi bulunamadı',
  'Ticket is closed': 'Destek talebi kapalı',
  'Ticket is already assigned': 'Destek talebi zaten atanmış',
  'Only resolved or closed tickets can be reopened': 'Yalnızca çözülmüş veya kapatılmış talepler yeniden açılabilir',
  'Only organizers may post internal notes': 'Dahili notları yalnızca organizatörler yazabilir',
  'Assignee is not a member of this competition': 'Atanan kişi bu yarışmanın üyesi değil',
  'Unknown ticket category': 'Bilinmeyen talep kategorisi',
  'This category requires a challenge': 'Bu kategori için bir görev seçilmeli',
  'Cannot relate a ticket to itself': 'Bir talep kendisiyle ilişkilendirilemez',
  'Related ticket not found': 'İlişkili talep bulunamadı',
  'Relation not found': 'İlişki bulunamadı',
  'Tickets belong to different competitions': 'Talepler farklı yarışmalara ait',
  'Tag not found': 'Etiket bulunamadı',
  'A tag with this name already exists': 'Bu isimde bir etiket zaten var',
  'No bulk action supplied': 'Toplu işlem seçilmedi',
  'No matching tickets': 'Eşleşen talep yok',
  'No changes supplied': 'Değişiklik yapılmadı',
  'Missing ticket assign permission': 'Talep atama yetkiniz yok',
  'Missing ticket category permission': 'Talep kategorisi değiştirme yetkiniz yok',
  'Missing ticket challenge permission': 'Talep görevini değiştirme yetkiniz yok',
  'Missing ticket manage permission': 'Talep yönetme yetkiniz yok',
  'Missing ticket priority permission': 'Talep önceliği değiştirme yetkiniz yok',
  'Missing ticket status permission': 'Talep durumu değiştirme yetkiniz yok',
  'Missing ticket tag permission': 'Talep etiketi değiştirme yetkiniz yok',
  'Title too short': 'Başlık çok kısa',
  'Describe the issue (min 10 chars)': 'Sorunu açıklayın (en az 10 karakter)',
  'Explain why the ticket is reopened': 'Talebin neden yeniden açıldığını açıklayın',
  'Key must be UPPER_SNAKE_CASE': 'Anahtar BÜYÜK_HARF_VE_ALT_ÇİZGİ biçiminde olmalı',

  // Surveys
  'Survey already submitted': 'Anket zaten gönderildi',
  'Invalid question': 'Geçersiz soru',
  'Invalid option': 'Geçersiz seçenek',
  'Option selection required': 'Bir seçenek seçmelisiniz',
  'Single choice allows one option': 'Tek seçimli soruda yalnızca bir seçenek işaretlenebilir',
  'Text answer required': 'Metin yanıtı gerekli',
  'Text questions cannot have options': 'Metin sorularında seçenek olamaz',
  'Missing answer for required question': 'Zorunlu bir soru yanıtlanmadı',

  // Backups
  'A backup is already running': 'Zaten çalışan bir yedekleme var',
  'Invalid backup name': 'Geçersiz yedek adı',

  // Shared form schemas
  'Enter your email or username': 'E-posta veya kullanıcı adınızı girin',
  'Identifier too long': 'Kullanıcı adı/e-posta çok uzun',
  'Minimum 8 characters': 'En az 8 karakter',
  'Minimum 3 characters': 'En az 3 karakter',
  'Minimum 2 characters': 'En az 2 karakter',
  'Maximum 24 characters': 'En fazla 24 karakter',
  'Letters, digits, _ . - only': 'Yalnızca harf, rakam ve _ . - kullanılabilir',
  'Too long': 'Çok uzun',
  'Add an uppercase letter': 'Bir büyük harf ekleyin',
  'Add a lowercase letter': 'Bir küçük harf ekleyin',
  'Add a digit': 'Bir rakam ekleyin',
  'Passwords do not match': 'Parolalar eşleşmiyor',
  'Enter your current password': 'Mevcut parolanızı girin',
  'Slug: lowercase letters, numbers, hyphens': 'Kısa ad: küçük harf, rakam ve tire',

  // zod defaults
  Required: 'Zorunlu alan',
  'Invalid email': 'Geçersiz e-posta adresi',
  'Invalid url': 'Geçersiz adres',
  'Invalid input': 'Geçersiz değer',
  'Expected string, received null': 'Bu alan boş bırakılamaz',

  // Transport (axios)
  'Network Error': 'Sunucuya ulaşılamıyor; bağlantınızı kontrol edin',
  'canceled': 'İstek iptal edildi',
};

const PATTERNS_TR: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^File type not allowed: (.+)$/, (m) => `Bu dosya türüne izin verilmiyor: ${m[1]}`],
  [/^Detected file type not allowed: (.+)$/, (m) => `Tespit edilen dosya türüne izin verilmiyor: ${m[1]}`],
  [/^File content rejected: (.+)$/, (m) => `Dosya içeriği reddedildi: ${m[1]}`],
  [/^File failed the security scan: (.+)$/, (m) => `Dosya güvenlik taramasından geçemedi: ${m[1]}`],
  [/^File "(.+)" exceeds (?:the )?upload limit$/, (m) => `"${m[1]}" dosyası yükleme sınırını aşıyor`],
  [/^At most (\d+) files per message$/, (m) => `Bir mesaja en fazla ${m[1]} dosya eklenebilir`],
  [/^Message too long \(max (\d+)\)$/, (m) => `Mesaj çok uzun (en fazla ${m[1]} karakter)`],
  [/^Cannot move ticket from (\w+) to (\w+)$/, (m) => `Talep ${m[1]} durumundan ${m[2]} durumuna taşınamaz`],
  [/^(.+) has no server scope$/, (m) => `${m[1]} bir sunucuya bağlı değil`],
  [/^CTFd redirect left LAN host \((.+)\)$/, (m) => `CTFd yerel ağ dışına yönlendirdi (${m[1]})`],
  [/^timeout of \d+ms exceeded$/, () => 'Sunucu zamanında yanıt vermedi; tekrar deneyin'],
  [/^Request failed with status code (\d+)$/, (m) => `İstek başarısız oldu (HTTP ${m[1]})`],
  [/^String must contain at least (\d+) character\(s\)$/, (m) => `En az ${m[1]} karakter olmalı`],
  [/^String must contain at most (\d+) character\(s\)$/, (m) => `En fazla ${m[1]} karakter olabilir`],
  [/^Number must be greater than or equal to (-?\d+)$/, (m) => `En az ${m[1]} olmalı`],
  [/^Number must be less than or equal to (-?\d+)$/, (m) => `En fazla ${m[1]} olabilir`],
  [/^Array must contain at least (\d+) element\(s\)$/, (m) => `En az ${m[1]} öğe seçilmeli`],
  [/^Array must contain at most (\d+) element\(s\)$/, (m) => `En fazla ${m[1]} öğe seçilebilir`],
  [/^Invalid enum value\./, () => 'Geçersiz seçim'],
  [/^Expected (\w+), received (\w+)$/, () => 'Geçersiz değer türü'],
];

function translateTr(message: string): string {
  const exact = EXACT_TR[message];
  if (exact) return exact;
  // "<file name>: <upload error>" from ticket attachments
  const prefixed = message.match(/^(.+?): (.+)$/);
  for (const [re, render] of PATTERNS_TR) {
    const m = message.match(re);
    if (m) return render(m);
  }
  if (prefixed && EXACT_TR[prefixed[2]!]) return `${prefixed[1]}: ${EXACT_TR[prefixed[2]!]}`;
  return message;
}

export function translateApiMessage(message: string, locale: Locale): string {
  if (locale !== 'tr' || !message) return message;
  return translateTr(message);
}

/** Localizes a form-validation message in the active locale. */
export function localizeMessage(message: string | undefined): string {
  return translateApiMessage(message ?? '', getCurrentLocale());
}
