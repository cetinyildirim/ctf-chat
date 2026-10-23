# -*- coding: utf-8 -*-
"""Generate SYDT Chat institutional installation Word document."""

from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
OUT = ROOT / "SYDT_Chat_Kurulum_Rehberi.docx"
DEPLOY = ROOT / "deploy"

BG = (18, 24, 32)
BOX = (30, 42, 56)
ACCENT = (14, 165, 160)
TEXT = (236, 242, 248)
MUTED = (148, 163, 184)
TITLE_C = (45, 212, 191)
ARROW = (94, 234, 212)


def font(size: int, bold: bool = False):
    names = (
        ["C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arialbd.ttf"]
        if bold
        else ["C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/arial.ttf"]
    )
    for n in names:
        try:
            return ImageFont.truetype(n, size)
        except OSError:
            continue
    return ImageFont.load_default()


def rounded(draw, xy, fill, outline, radius=12):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=2)


def box(draw, x, y, w, h, lines, accent=False):
    fill = (20, 60, 58) if accent else BOX
    outline = ACCENT if accent else (71, 85, 105)
    rounded(draw, (x, y, x + w, y + h), fill, outline)
    cy = y + 10
    for i, line in enumerate(lines):
        f = font(14, True) if i == 0 else font(11)
        c = TITLE_C if i == 0 and accent else TEXT
        draw.text((x + 10, cy), line, font=f, fill=c)
        cy += 18 if i == 0 else 15


def arrow(draw, x1, y1, x2, y2):
    draw.line((x1, y1, x2, y2), fill=ARROW, width=3)
    if abs(x2 - x1) >= abs(y2 - y1):
        d = 1 if x2 > x1 else -1
        draw.polygon([(x2, y2), (x2 - 10 * d, y2 - 6), (x2 - 10 * d, y2 + 6)], fill=ARROW)
    else:
        d = 1 if y2 > y1 else -1
        draw.polygon([(x2, y2), (x2 - 6, y2 - 10 * d), (x2 + 6, y2 - 10 * d)], fill=ARROW)


def title_bar(draw, w, title, sub):
    draw.rectangle((0, 0, w, 54), fill=(12, 18, 26))
    draw.text((20, 8), title, font=font(18, True), fill=TITLE_C)
    draw.text((20, 32), sub, font=font(11), fill=MUTED)


def save(img, name):
    ASSETS.mkdir(parents=True, exist_ok=True)
    p = ASSETS / name
    img.save(p, "PNG")
    return p


def chart_topology():
    w, h = 1100, 560
    img = Image.new("RGB", (w, h), BG)
    d = ImageDraw.Draw(img)
    title_bar(d, w, "Önerilen Kurumsal Topoloji", "Tek HTTPS origin · Nginx · systemd")
    box(d, 40, 100, 200, 100, ["Kullanıcı", "Tarayıcı", "HTTPS"], True)
    arrow(d, 240, 150, 300, 150)
    box(d, 300, 90, 260, 120, ["Nginx / Reverse Proxy", ":443 TLS sonlandırma", "/api · /socket.io · /"])
    arrow(d, 560, 130, 640, 100)
    arrow(d, 560, 170, 640, 220)
    box(d, 640, 70, 400, 90, ["Next.js Web", "127.0.0.1:3100", "Arayüz + Edge middleware"], True)
    box(d, 640, 200, 400, 110, ["API + Socket.IO", "127.0.0.1:4000", "REST · WebSocket · dosyalar"])
    arrow(d, 840, 310, 840, 360)
    box(d, 560, 360, 480, 140, [
        "Veri",
        "SQLite dosyası → /var/lib/sydt/prod.db",
        "Yüklemeler → /var/lib/sydt/uploads",
        "Gizli anahtarlar → apps/server/.env",
    ])
    return save(img, "install_topology.png")


def chart_steps():
    w, h = 1100, 720
    img = Image.new("RGB", (w, h), BG)
    d = ImageDraw.Draw(img)
    title_bar(d, w, "Kurulum Adım Sırası", "Sırayı atlamayın — her adım bir sonrakine bağlıdır")
    steps = [
        (40, 80, ["1. Sunucu hazırlığı", "OS · Node · pnpm · araçlar"]),
        (400, 80, ["2. Kod yerleştirme", "Kopyala / git clone"]),
        (760, 80, ["3. Ortam dosyaları", ".env · JWT · CORS"]),
        (40, 250, ["4. Veritabanı", "migrate deploy"]),
        (400, 250, ["5. Derleme", "pnpm build"]),
        (760, 250, ["6. Servisler", "systemd / NSSM"]),
        (40, 420, ["7. Ters vekil + TLS", "Nginx · sertifika"]),
        (400, 420, ["8. Doğrulama", "/health · giriş"]),
        (760, 420, ["9. İlk admin", "İlk kayıt = SUPER_ADMIN"]),
        (300, 580, ["10. Yedekleme & izleme", "DB · uploads · log · sertifika"]),
    ]
    for x, y, lines in steps:
        box(d, x, y, 300, 90, lines, accent=True)
    for i in range(2):
        arrow(d, 340 + i * 360, 125, 400 + i * 360, 125)
    arrow(d, 910, 170, 910, 250)
    for i in range(2):
        arrow(d, 760 - i * 360, 295, 700 - i * 360, 295)
    arrow(d, 190, 340, 190, 420)
    for i in range(2):
        arrow(d, 340 + i * 360, 465, 400 + i * 360, 465)
    arrow(d, 910, 510, 910, 560)
    arrow(d, 910, 560, 600, 580)
    return save(img, "install_steps.png")


def chart_env():
    w, h = 1100, 520
    img = Image.new("RGB", (w, h), BG)
    d = ImageDraw.Draw(img)
    title_bar(d, w, "Ortam Değişkenleri İlişkisi", "Web ve API aynı JWT_ACCESS_SECRET’ı paylaşmalı")
    box(d, 60, 100, 420, 280, [
        "apps/server/.env",
        "NODE_ENV=production",
        "COOKIE_SECURE=true  ← zorunlu",
        "CORS_ORIGIN=https://sydt…",
        "JWT_ACCESS_SECRET=…",
        "JWT_REFRESH_SECRET=…",
        "DATABASE_URL=file:/var/lib/…",
        "UPLOAD_DIR=/var/lib/…/uploads",
    ], True)
    box(d, 620, 100, 420, 280, [
        "apps/web/.env.local",
        "(build öncesi)",
        "NEXT_PUBLIC_API_ORIGIN=",
        "  http://127.0.0.1:4000",
        "JWT_ACCESS_SECRET=…",
        "  ← API ile BİREBİR AYNI",
        "",
        "Değişince web yeniden build",
    ], True)
    arrow(d, 480, 220, 620, 220)
    d.text((470, 400), "Uyarı: JWT uyuşmazlığı Edge oturum kontrolünü bozar.", font=font(13), fill=(251, 146, 60))
    return save(img, "install_env.png")


def set_run(run, size=11, bold=False, color=None, name="Calibri"):
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:eastAsia"), name)
    run.font.size = Pt(size)
    run.bold = bold
    if color:
        run.font.color.rgb = color


def H(doc, text, level=1):
    p = doc.add_heading(text, level=level)
    for run in p.runs:
        run.font.color.rgb = RGBColor(0x0F, 0x76, 0x6E) if level <= 1 else RGBColor(0x13, 0x4E, 0x4A)
    return p


def P(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(8)
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
    r = p.add_run(text)
    set_run(r, 11)
    return p


def B(doc, items):
    for item in items:
        p = doc.add_paragraph(style="List Bullet")
        r = p.add_run(item)
        set_run(r, 11)
        p.paragraph_format.space_after = Pt(2)


def N(doc, items):
    for item in items:
        p = doc.add_paragraph(style="List Number")
        r = p.add_run(item)
        set_run(r, 11)
        p.paragraph_format.space_after = Pt(2)


def code(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(8)
    r = p.add_run(text)
    set_run(r, 9, name="Consolas")
    r.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)


def warn(doc, text):
    p = doc.add_paragraph()
    r = p.add_run("⚠ " + text)
    set_run(r, 11, True, RGBColor(0xC2, 0x41, 0x0C))
    p.paragraph_format.space_after = Pt(8)


def tip(doc, text):
    p = doc.add_paragraph()
    r = p.add_run("💡 " + text)
    set_run(r, 11, color=RGBColor(0x0F, 0x76, 0x6E))
    p.paragraph_format.space_after = Pt(8)


def img(doc, path: Path, width=6.3):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run().add_picture(str(path), width=Inches(width))
    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = cap.add_run(f"Şekil: {path.stem.replace('_', ' ')}")
    set_run(r, 9, color=RGBColor(0x64, 0x74, 0x8B))


def table(doc, headers, rows):
    t = doc.add_table(rows=1 + len(rows), cols=len(headers))
    t.style = "Table Grid"
    for i, h in enumerate(headers):
        t.rows[0].cells[i].text = h
        for p in t.rows[0].cells[i].paragraphs:
            for run in p.runs:
                set_run(run, 10, True)
    for ri, row in enumerate(rows):
        for ci, val in enumerate(row):
            t.rows[ri + 1].cells[ci].text = val
            for p in t.rows[ri + 1].cells[ci].paragraphs:
                for run in p.runs:
                    set_run(run, 9)
    doc.add_paragraph()


def build(charts: dict[str, Path]) -> Path:
    doc = Document()
    sec = doc.sections[0]
    sec.top_margin = Cm(2)
    sec.bottom_margin = Cm(2)
    sec.left_margin = Cm(2.2)
    sec.right_margin = Cm(2.2)

    for _ in range(2):
        doc.add_paragraph()
    t = doc.add_paragraph()
    t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = t.add_run("SYDT Chat")
    set_run(r, 36, True, RGBColor(0x0F, 0x76, 0x6E))
    s = doc.add_paragraph()
    s.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = s.add_run("Kurumsal Sunucu Kurulum Rehberi")
    set_run(r, 20, True, RGBColor(0x33, 0x41, 0x55))
    m = doc.add_paragraph()
    m.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = m.add_run(
        "Adım adım üretim (production) kurulumu\n"
        "Hedef kitle: sistem yöneticisi / DevOps / IT operasyon\n"
        "Sürüm 0.1 · Node ≥ 20 · pnpm 9.15 · Linux önerilir"
    )
    set_run(r, 11, color=RGBColor(0x47, 0x55, 0x69))
    doc.add_page_break()

    H(doc, "İçindekiler", 1)
    for item in [
        "1. Bu rehber ne işe yarar?",
        "2. Mimari ve topoloji seçimi",
        "3. Önkoşullar ve kapasite",
        "4. Adım 1 — İşletim sistemi ve paketler",
        "5. Adım 2 — Uygulama kullanıcısı ve dizinler",
        "6. Adım 3 — Kaynak kodu yerleştirme",
        "7. Adım 4 — Ortam değişkenleri (.env)",
        "8. Adım 5 — Veritabanı kurulumu",
        "9. Adım 6 — Derleme (build)",
        "10. Adım 7 — Servis olarak çalıştırma",
        "11. Adım 8 — Nginx + HTTPS",
        "12. Adım 9 — Doğrulama checklist",
        "13. Adım 10 — İlk yönetici ve platform ayarları",
        "14. Windows Server notları",
        "15. Yedekleme, güncelleme, felaket kurtarma",
        "16. Güvenlik sertleştirme",
        "17. Sık karşılaşılan hatalar",
        "18. Ek dosyalar ve sözlük",
    ]:
        P(doc, item)
    doc.add_page_break()

    # 1
    H(doc, "1. Bu rehber ne işe yarar?", 1)
    P(
        doc,
        "Bu belge, SYDT Chat’i kurum içi bir sunucuya üretim ortamında kurmak için gereken her adımı "
        "sıra ile anlatır. Repo içinde hazır Docker / Compose dosyası yoktur; kurulum Node.js süreçleri + "
        "ters vekil (Nginx veya kurumsal eşdeğeri) ile yapılır. Örnek systemd ve Nginx dosyaları "
        "docs/deploy/ altında verilmiştir.",
    )
    img(doc, charts["steps"])
    warn(
        doc,
        "Kesinlikle production sunucuda `pnpm seed` çalıştırmayın. Seed demo hesaplar ve bilinen parolalar üretir.",
    )

    # 2
    H(doc, "2. Mimari ve topoloji seçimi", 1)
    P(
        doc,
        "Üretimde önerilen model: tarayıcı yalnızca tek bir HTTPS adresine gider (ör. https://sydt.kurum.local). "
        "Nginx TLS’i sonlandırır; /api ve /socket.io isteklerini API sürecine (4000), diğerlerini Web sürecine (3100) iletir.",
    )
    img(doc, charts["topology"])
    H(doc, "2.1 Neden tek origin?", 2)
    B(
        doc,
        [
            "Çerezler (sydt_at, sydt_rt, sydt_csrf) same-site kalır; giriş sorunları azalır.",
            "Socket.IO WebSocket yükseltmesi aynı host üzerinden sorunsuz akar.",
            "CORS yapılandırması sadeleşir: CORS_ORIGIN = tam web URL’si.",
        ],
    )
    H(doc, "2.2 Portlar", 2)
    table(
        doc,
        ["Servis", "Port", "Dışarı açık mı?"],
        [
            ["Nginx HTTPS", "443", "Evet (veya kurumsal WAF arkası)"],
            ["Nginx HTTP → HTTPS", "80", "İsteğe bağlı yönlendirme"],
            ["Next.js Web", "3100", "Hayır — yalnızca localhost"],
            ["API + Socket.IO", "4000", "Hayır — yalnızca localhost"],
            ["Sağlık", "4000/health veya /health", "Nginx üzerinden açılabilir"],
        ],
    )

    # 3
    H(doc, "3. Önkoşullar ve kapasite", 1)
    H(doc, "3.1 Yazılım sürümleri", 2)
    table(
        doc,
        ["Bileşen", "Gereksinim"],
        [
            ["Node.js", "≥ 20 (LTS önerilir, örn. 20 veya 22)"],
            ["pnpm", "9.15.0 (packageManager alanı ile sabitlenmiş)"],
            ["Git", "Kaynak almak için (veya zip kopyası)"],
            ["Nginx (veya IIS ARR / HAProxy)", "TLS + WebSocket destekli ters vekil"],
            ["Sertifika", "Kurumsal CA veya Let’s Encrypt"],
        ],
    )
    H(doc, "3.2 Donanım (başlangıç önerisi)", 2)
    B(
        doc,
        [
            "CPU: 2–4 vCPU",
            "RAM: en az 4 GB (8 GB rahat)",
            "Disk: 20 GB+ uygulama; yükleme ve DB için ayrı birim tercih edilir",
            "Ağ: iç DNS kaydı (sydt.kurum.local) ve firewall kuralı",
        ],
    )
    H(doc, "3.3 Veritabanı gerçeği", 2)
    P(
        doc,
        "Mevcut sürüm Prisma sağlayıcısı olarak SQLite kullanır (schema.prisma). Şema Postgres’e taşınabilir "
        "tasarlanmıştır ancak production’da hazır Postgres yapılandırması ve migration kilidi SQLite’tır. "
        "Kurumsal tek instance kurulum için SQLite yeterlidir. Çoklu API instance / yüksek eşzamanlı yazma "
        "ihtiyacında PostgreSQL’e geçiş ayrı bir proje adımıdır.",
    )
    tip(doc, "SQLite dosyasını mutlak yolda tutun ve düzenli yedekleyin (aşağıdaki yedekleme bölümü).")

    # 4
    H(doc, "4. Adım 1 — İşletim sistemi ve paketler", 1)
    P(doc, "Aşağıdaki komutlar Ubuntu/Debian örneğidir. RHEL/Alma için dnf eşdeğerlerini kullanın.")
    H(doc, "4.1 Sistem güncellemesi ve derleme araçları", 2)
    P(
        doc,
        "argon2 yerel (native) modül derler. Windows’tan kopyalanmış node_modules Linux’ta çalışmaz; "
        "bağımlılıklar hedef sunucuda kurulmalıdır.",
    )
    code(
        doc,
        "sudo apt update && sudo apt upgrade -y\n"
        "sudo apt install -y build-essential python3 git curl ca-certificates",
    )
    H(doc, "4.2 Node.js 20+", 2)
    code(
        doc,
        "# Örnek: NodeSource veya nvm / resmi tarball\n"
        "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -\n"
        "sudo apt install -y nodejs\n"
        "node -v   # v20.x veya üzeri olmalı",
    )
    H(doc, "4.3 Corepack ile pnpm 9.15.0", 2)
    code(
        doc,
        "sudo corepack enable\n"
        "sudo corepack prepare pnpm@9.15.0 --activate\n"
        "pnpm -v   # 9.15.0",
    )
    H(doc, "4.4 Nginx", 2)
    code(doc, "sudo apt install -y nginx\nsudo systemctl enable --now nginx")

    # 5
    H(doc, "5. Adım 2 — Uygulama kullanıcısı ve dizinler", 1)
    N(
        doc,
        [
            "Ayrı bir sistem kullanıcısı oluşturun (root ile çalıştırmayın).",
            "Uygulama kodu ve veri dizinlerini ayırın.",
            "Veri dizinine yazma izni verin.",
        ],
    )
    code(
        doc,
        "sudo useradd --system --create-home --home-dir /opt/sydt-chat --shell /usr/sbin/nologin sydt\n"
        "sudo mkdir -p /opt/sydt-chat /var/lib/sydt/uploads\n"
        "sudo chown -R sydt:sydt /opt/sydt-chat /var/lib/sydt",
    )
    table(
        doc,
        ["Yol", "Amaç"],
        [
            ["/opt/sydt-chat", "Kaynak kod + build çıktısı"],
            ["/var/lib/sydt/prod.db", "SQLite veritabanı dosyası"],
            ["/var/lib/sydt/uploads", "Mesaj / ticket / logo dosyaları"],
            ["/etc/nginx/sites-available/sydt", "Ters vekil yapılandırması"],
            ["/etc/systemd/system/sydt-*.service", "Servis birimleri"],
        ],
    )

    # 6
    H(doc, "6. Adım 3 — Kaynak kodu yerleştirme", 1)
    H(doc, "6.1 Git ile", 2)
    code(
        doc,
        "sudo -u sydt -H bash -lc '\n"
        "  cd /opt/sydt-chat\n"
        "  # Örnek: kurumsal git\n"
        "  git clone <KURUMSAL_REPO_URL> .\n"
        "  # veya release arşivini buraya açın\n"
        "'",
    )
    H(doc, "6.2 Bağımlılık kurulumu", 2)
    code(
        doc,
        "sudo -u sydt -H bash -lc '\n"
        "  cd /opt/sydt-chat\n"
        "  pnpm install --frozen-lockfile\n"
        "'",
    )
    tip(
        doc,
        "pnpm-lock.yaml yoksa `pnpm install` yeterli. Üretimde mümkünse kilit dosyası ile kurun.",
    )
    warn(
        doc,
        "Geliştirme makinesindeki node_modules klasörünü sunucuya kopyalamayın. OS/CPU native modülleri kırılır.",
    )

    # 7
    H(doc, "7. Adım 4 — Ortam değişkenleri (.env)", 1)
    img(doc, charts["env"])
    H(doc, "7.1 API ortamı", 2)
    code(
        doc,
        "sudo -u sydt -H bash -lc '\n"
        "  cd /opt/sydt-chat/apps/server\n"
        "  cp .env.example .env\n"
        "  nano .env\n"
        "'",
    )
    P(doc, "Üretim için önerilen minimum içerik:")
    code(
        doc,
        "NODE_ENV=production\n"
        "PORT=4000\n"
        "DATABASE_URL=\"file:/var/lib/sydt/prod.db\"\n"
        "JWT_ACCESS_SECRET=<EN_AZ_32_KARAKTER_RASTGELE>\n"
        "JWT_REFRESH_SECRET=<FARKLI_EN_AZ_32_KARAKTER_RASTGELE>\n"
        "ACCESS_TOKEN_TTL=900\n"
        "REFRESH_TOKEN_TTL=2592000\n"
        "CORS_ORIGIN=https://sydt.kurum.local\n"
        "COOKIE_DOMAIN=\n"
        "COOKIE_SECURE=true\n"
        "SERVER_INVITE_TTL_DAYS=7\n"
        "LOG_LEVEL=info\n"
        "UPLOAD_DIR=/var/lib/sydt/uploads\n"
        "UPLOAD_MAX_MB=25\n"
        "# ALLOW_BEARER_AUTH satırını eklemeyin (veya false bırakın)",
    )
    P(doc, "Güçlü sır üretmek için:")
    code(
        doc,
        "openssl rand -base64 48\n"
        "openssl rand -base64 48",
    )
    warn(
        doc,
        "NODE_ENV=production iken COOKIE_SECURE=false ise API süreç başlamadan çıkar. "
        "CORS_ORIGIN içinde * kullanılamaz. JWT_REFRESH_SECRET, ACCESS ile aynı olmamalı.",
    )
    H(doc, "7.2 Web ortamı (build öncesi kritik)", 2)
    code(
        doc,
        "sudo -u sydt -H bash -lc '\n"
        "  cd /opt/sydt-chat/apps/web\n"
        "  cp .env.local.example .env.local\n"
        "  nano .env.local\n"
        "'",
    )
    code(
        doc,
        "NEXT_PUBLIC_API_ORIGIN=http://127.0.0.1:4000\n"
        "JWT_ACCESS_SECRET=<API_ILE_AYNI_ACCESS_SECRET>",
    )
    B(
        doc,
        [
            "NEXT_PUBLIC_API_ORIGIN: Next sunucusunun API’ye ulaştığı adres (genelde localhost). "
            "Tarayıcıya gömülür (CSP connect-src + Socket istemcisi + rewrite hedefi).",
            "Nginx /api ve /socket.io’yu doğrudan API’ye verdiğinizde bile Next rewrite’ları için "
            "build sırasında bu değerin doğru olması gerekir.",
            "JWT_ACCESS_SECRET web Edge middleware oturum doğrulaması için API ile birebir aynı olmalıdır.",
            "Bu değerleri değiştirdikten sonra web’i yeniden `pnpm build` edin.",
        ],
    )
    H(doc, "7.3 CORS_ORIGIN nasıl yazılır?", 2)
    P(
        doc,
        "Tarayıcıda kullanıcıların açtığı tam kök adres olmalıdır. Sonunda / olmamalı. "
        "Birden fazla origin gerekirse virgülle ayırın (örn. https://sydt.kurum.local,https://sydt-yedek.kurum.local).",
    )

    # 8
    H(doc, "8. Adım 5 — Veritabanı kurulumu", 1)
    P(
        doc,
        "Üretimde `prisma migrate deploy` kullanın (`pnpm db:migrate`). `db:push` şema senkronu içindir; "
        "acil durum dışında production’da tercih etmeyin.",
    )
    code(
        doc,
        "sudo -u sydt -H bash -lc '\n"
        "  cd /opt/sydt-chat\n"
        "  # Prisma client üret\n"
        "  pnpm db:generate\n"
        "  # Versionlu migration uygula\n"
        "  pnpm db:migrate\n"
        "  # Durum kontrol\n"
        "  pnpm db:migrate:status\n"
        "'",
    )
    tip(doc, "İlk migrate, /var/lib/sydt/prod.db dosyasını oluşturur. Dizinin sydt kullanıcısına yazılabilir olduğundan emin olun.")
    warn(doc, "pnpm seed ÇALIŞTIRMAYIN. İlk yönetici hesabı bir sonraki adımda kayıt formu ile oluşur.")

    # 9
    H(doc, "9. Adım 6 — Derleme (build)", 1)
    code(
        doc,
        "sudo -u sydt -H bash -lc '\n"
        "  cd /opt/sydt-chat\n"
        "  pnpm build\n"
        "'",
    )
    P(
        doc,
        "Bu komut sırasıyla shared paketini, sunucu TypeScript derlemesini (dist/) ve Next.js üretim "
        "derlemesini (.next/) üretir. Hata alırsanız çıktıyı kaydedin; en sık nedenler: eksik .env, "
        "Node sürümü, native derleme bağımlılığı.",
    )

    # 10
    H(doc, "10. Adım 7 — Servis olarak çalıştırma", 1)
    H(doc, "10.1 Manuel duman testi (önce bunu yapın)", 2)
    code(
        doc,
        "# Terminal 1 — API (WorkingDirectory önemli)\n"
        "sudo -u sydt -H bash -lc 'cd /opt/sydt-chat/apps/server && node dist/index.js'\n"
        "\n"
        "# Terminal 2 — Web\n"
        "sudo -u sydt -H bash -lc 'cd /opt/sydt-chat/apps/web && pnpm start'\n"
        "\n"
        "# Terminal 3 — sağlık\n"
        "curl -s http://127.0.0.1:4000/health\n"
        "# Beklenen: {\"ok\":true,\"ts\":\"...\"}",
    )
    H(doc, "10.2 systemd (Linux — önerilen)", 2)
    P(
        doc,
        "Örnek birimler docs/deploy/sydt-api.service ve docs/deploy/sydt-web.service dosyalarındadır. "
        "Kopyalayıp yolları doğrulayın:",
    )
    code(
        doc,
        "sudo cp /opt/sydt-chat/docs/deploy/sydt-api.service /etc/systemd/system/\n"
        "sudo cp /opt/sydt-chat/docs/deploy/sydt-web.service /etc/systemd/system/\n"
        "sudo systemctl daemon-reload\n"
        "sudo systemctl enable --now sydt-api sydt-web\n"
        "sudo systemctl status sydt-api sydt-web\n"
        "journalctl -u sydt-api -f",
    )
    tip(
        doc,
        "API için WorkingDirectory=/opt/sydt-chat/apps/server olmalıdır; aksi halde göreli yollar ve dotenv yüklemesi sapar. "
        "EnvironmentFile ile .env okutmak en güvenli yöntemdir.",
    )
    H(doc, "10.3 Web servisinde pnpm yolu", 2)
    P(
        doc,
        "systemd biriminde ExecStart=/usr/bin/pnpm start örneği vardır. Sunucuda `which pnpm` ile gerçek yolu bulun; "
        "gerekirse tam yolu yazın veya `npx pnpm start` / `node node_modules/next/dist/bin/next start -p 3100` kullanın.",
    )

    # 11
    H(doc, "11. Adım 8 — Nginx + HTTPS", 1)
    P(doc, "Örnek yapılandırma: docs/deploy/nginx-sydt.conf")
    N(
        doc,
        [
            "server_name ve ssl_certificate yollarını kurumunuza göre düzenleyin.",
            "Dosyayı sites-available altına kopyalayın, sites-enabled’a bağlayın.",
            "nginx -t ile sözdizimini doğrulayın, reload edin.",
            "DNS A/AAAA kaydının bu sunucuya işaret ettiğini kontrol edin.",
            "Firewall’da 80/443’ü açın; 3100 ve 4000’i dışarıya kapatın.",
        ],
    )
    code(
        doc,
        "sudo cp /opt/sydt-chat/docs/deploy/nginx-sydt.conf /etc/nginx/sites-available/sydt\n"
        "sudo nano /etc/nginx/sites-available/sydt   # domain + sertifika\n"
        "sudo ln -sf /etc/nginx/sites-available/sydt /etc/nginx/sites-enabled/sydt\n"
        "sudo nginx -t && sudo systemctl reload nginx",
    )
    H(doc, "11.1 WebSocket kritik ayarları", 2)
    B(
        doc,
        [
            "location /socket.io/ içinde Upgrade ve Connection header’ları şarttır.",
            "proxy_read_timeout uzun tutulmalıdır (ör. 86400) — aksi halde canlı sohbet kopar.",
            "Uygulama trust proxy = 1 kullanır; X-Forwarded-Proto ve X-Forwarded-For iletin.",
        ],
    )
    H(doc, "11.2 İstemci gövde boyutu", 2)
    P(
        doc,
        "Dosya yüklemeleri için Nginx client_max_body_size, API UPLOAD_MAX_MB değerinizden büyük olmalıdır "
        "(örnek conf’ta 25m).",
    )

    # 12
    H(doc, "12. Adım 9 — Doğrulama checklist", 1)
    table(
        doc,
        ["Kontrol", "Nasıl", "Beklenen"],
        [
            ["API ayakta", "curl http://127.0.0.1:4000/health", '{"ok":true,...}'],
            ["HTTPS açılıyor", "Tarayıcıda https://sydt.kurum.local", "Login ekranı"],
            ["Sertifika", "Kilit ikonu / kurumsal CA", "Uyarı yok"],
            ["API proxy", "https://…/health veya /api/…", "200"],
            ["WebSocket", "Giriş sonrası sohbet", "Anlık mesaj / presence"],
            ["Çerez Secure", "DevTools → Application → Cookies", "Secure bayrağı açık"],
            ["CORS hatası yok", "Tarayıcı konsolu", "CORS / CSRF kırmızı hata yok"],
            ["Yükleme dizini", "ls /var/lib/sydt/uploads", "Yazılabilir"],
        ],
    )

    # 13
    H(doc, "13. Adım 10 — İlk yönetici ve platform ayarları", 1)
    N(
        doc,
        [
            "Tarayıcıda https://sydt.kurum.local/register adresini açın.",
            "İlk kayıt olan kullanıcı, sistemde henüz SUPER_ADMIN yoksa otomatik SUPER_ADMIN olur.",
            "Güçlü bir parola seçin; kurum parola politikasına uyun.",
            "/admin paneline girin: Platform markası, yükleme limiti, kayıt varsayılan sunucusu.",
            "Gerekirse sunucu oluşturun / mevcut varsayılan sunucuyu (SYDT 26) düzenleyin.",
            "Roller, kategoriler, kanallar, davet kodları ve (varsa) CTFd entegrasyonunu yapılandırın.",
            "Test için ikinci bir seyirci/yarışmacı hesabı ile davet akışını doğrulayın.",
        ],
    )
    tip(
        doc,
        "Boot sırasında sistem gerekirse varsayılan bir yarışma sunucusu (slug: sydt-26) oluşturur. "
        "Admin’den marka ve kayıt sunucusunu kurumunuza göre güncelleyin.",
    )

    # 14
    H(doc, "14. Windows Server notları", 1)
    P(
        doc,
        "Geliştirme Windows’ta yapılmış olsa da kurumsal üretim için Linux tercih edilir. "
        "Windows Server kullanmanız gerekiyorsa:",
    )
    B(
        doc,
        [
            "Node 20+ ve pnpm’i kurun (Corepack veya npm i -g pnpm@9.15.0).",
            "Visual Studio Build Tools (C++) — argon2 derlemesi için.",
            "Kod: C:\\apps\\sydt-chat gibi bir yola koyun.",
            "DATABASE_URL için mutlak yol: file:C:/data/sydt/prod.db (ileri eğik çizgi tercih edin).",
            "UPLOAD_DIR=C:\\data\\sydt\\uploads",
            "Süreç yönetimi: NSSM veya Windows Service Wrapper ile node dist/index.js ve pnpm start.",
            "Ters vekil: IIS + ARR + WebSocket protokolü veya Nginx for Windows.",
            "HTTPS bağlayıcı ve kurumsal sertifika IIS/Nginx’te.",
            "Windows Firewall: yalnızca 443 (ve gerekirse 80); 3100/4000’i dışarı kapatın.",
        ],
    )
    warn(doc, "Aynı makinede hem geliştirme seed DB’sini hem production DB’sini karıştırmayın.")

    # 15
    H(doc, "15. Yedekleme, güncelleme, felaket kurtarma", 1)
    H(doc, "15.1 Ne yedeklenmeli?", 2)
    table(
        doc,
        ["Varlık", "Neden"],
        [
            ["/var/lib/sydt/prod.db", "Tüm iş verisi (SQLite)"],
            ["/var/lib/sydt/uploads", "Ekler, logolar"],
            ["apps/server/.env", "Gizli anahtarlar (şifreli saklayın)"],
            ["apps/web/.env.local", "Build/JWT eşlemesi"],
            ["Nginx/systemd conf", "Hızlı yeniden kurulum"],
        ],
    )
    H(doc, "15.2 SQLite yedekleme örneği", 2)
    code(
        doc,
        "# Servisleri kısa süre durdurmak en güvenlisidir\n"
        "sudo systemctl stop sydt-web sydt-api\n"
        "sudo -u sydt cp /var/lib/sydt/prod.db /backup/sydt/prod-$(date +%F).db\n"
        "sudo tar czf /backup/sydt/uploads-$(date +%F).tgz -C /var/lib/sydt uploads\n"
        "sudo systemctl start sydt-api sydt-web",
    )
    H(doc, "15.3 Güncelleme prosedürü", 2)
    N(
        doc,
        [
            "Bakım penceresi planlayın; kullanıcıları bilgilendirin.",
            "Yedek alın.",
            "sudo systemctl stop sydt-web sydt-api",
            "sudo -u sydt git pull (veya yeni release’i açın)",
            "sudo -u sydt pnpm install --frozen-lockfile",
            "Ortam değişkenleri değiştiyse .env’leri güncelleyin",
            "sudo -u sydt pnpm db:generate && sudo -u sydt pnpm db:migrate",
            "sudo -u sydt pnpm build",
            "sudo systemctl start sydt-api sydt-web",
            "Checklist’i (bölüm 12) tekrar çalıştırın",
        ],
    )

    # 16
    H(doc, "16. Güvenlik sertleştirme", 1)
    B(
        doc,
        [
            "Uygulamayı root ile çalıştırmayın.",
            "3100 ve 4000 portlarını yalnızca 127.0.0.1’de dinleyin / firewall’da dışarıya kapatın.",
            "COOKIE_SECURE=true ve geçerli TLS zorunlu.",
            "ALLOW_BEARER_AUTH production’da kapalı kalsın.",
            "JWT sırlarını parola kasasında tutun; git’e commit etmeyin.",
            ".env dosya izni: chmod 600, sahip sydt.",
            "OS güncellemeleri ve Node güvenlik yamalarını izleyin.",
            "Nginx’te gereksiz method/server_tokens kapatma, rate limit (ek) kurum politikasına göre.",
            "Düzenli yedek + geri dönüş tatbikatı.",
            "İlk SUPER_ADMIN hesabını paylaşmayın; kişiselleştirilmiş admin hesapları kullanın.",
        ],
    )

    # 17
    H(doc, "17. Sık karşılaşılan hatalar", 1)
    table(
        doc,
        ["Belirti", "Olası neden", "Çözüm"],
        [
            ["API hemen çıkıyor: COOKIE_SECURE must be true", "Prod’da secure kapalı", "COOKIE_SECURE=true + HTTPS"],
            ["CORS hatası", "CORS_ORIGIN tarayıcı URL’siyle uyuşmuyor", "Tam origin yazın, / eklemeyin"],
            ["Giriş oluyor ama hemen atıyor", "Secure çerez HTTP’de / JWT uyuşmazlığı", "HTTPS + aynı ACCESS secret"],
            ["Socket bağlanmıyor", "Nginx WebSocket yok", "Upgrade header + /socket.io location"],
            ["argon2 / native hata", "Build tools yok / yanlış OS modül", "build-essential; pnpm install yerinde"],
            ["DB readonly / unable to open", "Dizin izni / yanlış cwd", "chown sydt; mutlak DATABASE_URL"],
            ["Yükleme 413", "Nginx body limit", "client_max_body_size artır"],
            ["Sayfa açılır API 502", "API down / yanlış upstream", "systemctl status sydt-api"],
            ["Build sonrası eski API URL", "NEXT_PUBLIC_* değişti rebuild yok", "Web’i yeniden build"],
        ],
    )

    # 18
    H(doc, "18. Ek dosyalar ve sözlük", 1)
    H(doc, "18.1 Bu paketle gelen dosyalar", 2)
    table(
        doc,
        ["Dosya", "İçerik"],
        [
            ["docs/deploy/nginx-sydt.conf", "Örnek Nginx + TLS + WebSocket"],
            ["docs/deploy/sydt-api.service", "systemd API birimi"],
            ["docs/deploy/sydt-web.service", "systemd Web birimi"],
            ["apps/server/.env.example", "API ortam şablonu"],
            ["apps/web/.env.local.example", "Web ortam şablonu"],
        ],
    )
    H(doc, "18.2 Sözlük", 2)
    table(
        doc,
        ["Terim", "Anlam"],
        [
            ["Ters vekil (reverse proxy)", "Dış dünyanın tek giriş kapısı; TLS ve yönlendirme"],
            ["Origin", "Şema+host+port (https://sydt.kurum.local)"],
            ["migrate deploy", "Kayıtlı Prisma migration’larını uygular"],
            ["WorkingDirectory", "Süreç çalışırken geçerli dizin — göreli yollar buna bağlı"],
            ["httpOnly Secure çerez", "JS’in okuyamadığı, yalnızca HTTPS’te giden oturum çerezi"],
            ["WebSocket upgrade", "HTTP bağlantısının gerçek zamanlı kanala yükseltilmesi"],
        ],
    )

    doc.add_paragraph()
    end = doc.add_paragraph()
    end.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = end.add_run(
        "— SYDT Chat Kurulum Rehberi —\n"
        "Kurulum sonrası ürün kullanımı için: docs/SYDT_Chat_Urun_Tanitim_Dokumani.docx"
    )
    set_run(r, 10, color=RGBColor(0x64, 0x74, 0x8B))

    doc.save(OUT)
    return OUT


def main():
    charts = {
        "topology": chart_topology(),
        "steps": chart_steps(),
        "env": chart_env(),
    }
    path = build(charts)
    print(f"Wrote {path}")


if __name__ == "__main__":
    main()
