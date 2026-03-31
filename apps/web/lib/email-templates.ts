const SUPPORT_EMAIL = 'masar.almohami@outlook.sa';
const EMAIL_BRAND_NAME = 'مسار المحامي';
const EMAIL_BRAND_TAGLINE = 'إدارة قانونية أكثر وضوحاً وتنظيماً.';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderEmailShell(params: {
  subject: string;
  preheader: string;
  eyebrow: string;
  title: string;
  intro: string;
  bodyHtml: string;
  footerHtml?: string;
}) {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(params.subject)}</title>
    <style>
        body { margin: 0; padding: 24px 0; background: #eef2f7; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0f172a; direction: rtl; }
        .preheader { display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; overflow: hidden; mso-hide: all; }
        .wrapper { max-width: 680px; margin: 0 auto; padding: 0 16px; }
        .card { background: #ffffff; border: 1px solid #dbe4ee; border-radius: 26px; overflow: hidden; box-shadow: 0 24px 50px rgba(15, 23, 42, 0.08); }
        .hero { background: linear-gradient(135deg, #0f172a 0%, #102a43 58%, #0f766e 100%); color: #ffffff; padding: 28px 28px 24px; }
        .brand { font-size: 13px; letter-spacing: 0.4px; opacity: 0.92; margin-bottom: 14px; }
        .eyebrow { display: inline-block; padding: 6px 12px; border-radius: 999px; background: rgba(255,255,255,0.14); font-size: 12px; line-height: 1.2; margin-bottom: 16px; }
        .hero h1 { margin: 0; font-size: 28px; line-height: 1.45; font-weight: 800; }
        .hero p { margin: 12px 0 0; font-size: 15px; line-height: 1.95; color: rgba(255,255,255,0.92); }
        .content { padding: 28px; }
        .content p { margin: 0 0 16px; font-size: 15px; line-height: 1.95; color: #334155; }
        .panel { margin: 22px 0; padding: 20px 22px; border-radius: 20px; border: 1px solid #dbeafe; background: linear-gradient(180deg, #f8fbff 0%, #f8fafc 100%); }
        .panel-success { border-color: #bbf7d0; background: linear-gradient(180deg, #f7fffb 0%, #ecfdf5 100%); }
        .panel-muted { border-color: #e2e8f0; background: #f8fafc; }
        .panel-title { margin: 0 0 12px; font-size: 16px; line-height: 1.6; color: #0f172a; font-weight: 800; }
        .meta-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .meta-table td { padding: 10px 0; vertical-align: top; }
        .meta-table td:first-child { color: #64748b; width: 34%; }
        .meta-table td:last-child { color: #0f172a; font-weight: 700; }
        .meta-table tr + tr td { border-top: 1px solid #e2e8f0; }
        .steps, .list { margin: 0; padding-right: 18px; color: #475569; }
        .steps li, .list li { margin: 0 0 10px; line-height: 1.9; }
        .cta { margin: 24px 0 0; text-align: center; }
        .btn { display: inline-block; padding: 14px 24px; border-radius: 12px; background: #10b981; color: #ffffff !important; text-decoration: none; font-weight: 800; }
        .link-box { margin-top: 14px; border: 1px solid #dbeafe; border-radius: 14px; background: #ffffff; padding: 14px; direction: ltr; text-align: left; word-break: break-all; font-size: 13px; color: #0f172a; }
        .code-box { display: inline-block; direction: ltr; font-size: 30px; line-height: 1; letter-spacing: 8px; font-weight: 800; color: #065f46; background: #ffffff; border: 1px dashed #10b981; border-radius: 16px; padding: 16px 22px; }
        .note { padding: 16px 18px; border-radius: 16px; background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; font-size: 14px; line-height: 1.9; }
        .footer { padding: 0 28px 28px; color: #64748b; font-size: 12px; line-height: 1.9; }
        .footer a, .content a { color: #0f766e; text-decoration: none; }
    </style>
</head>
<body>
    <span class="preheader">${escapeHtml(params.preheader)}</span>
    <div class="wrapper">
        <div class="card">
            <div class="hero">
                <div class="brand">${EMAIL_BRAND_NAME}</div>
                <span class="eyebrow">${escapeHtml(params.eyebrow)}</span>
                <h1>${escapeHtml(params.title)}</h1>
                <p>${escapeHtml(params.intro)}</p>
            </div>
            <div class="content">
                ${params.bodyHtml}
            </div>
            <div class="footer">
                ${params.footerHtml ?? `
                <p style="margin:0 0 6px;">هذه رسالة آلية من ${EMAIL_BRAND_NAME}.</p>
                <p style="margin:0 0 6px;">للدعم: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
                <p style="margin:0;">${EMAIL_BRAND_TAGLINE}</p>
                `}
            </div>
        </div>
    </div>
</body>
</html>
`;
}

export const WELCOME_EMAIL_SUBJECT = 'مرحباً بك في مسار المحامي - خطواتك الأولى';

export const WELCOME_EMAIL_HTML = (name: string, verificationLink: string) => `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; direction: rtl; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f9fafb; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #0f172a; margin: 0; }
        .content { background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .btn { display: inline-block; background-color: #10b981; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }
        .footer { text-align: center; margin-top: 30px; font-size: 0.85em; color: #666; }
        .section { margin-bottom: 25px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
        .section:last-child { border-bottom: none; }
        h2 { color: #1e293b; font-size: 1.2em; margin-top: 0; }
        ul { padding-right: 20px; }
        li { margin-bottom: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>مسار المحامي</h1>
            <p>إدارة مكتب المحاماة... على مسار واحد.</p>
        </div>
        
        <div class="content">
            <p>أهلاً بك 👋 ${name}</p>
            <p>سعداء جداً بانضمامك لعائلة "مسار المحامي". لقد خطوت الخطوة الأولى نحو تنظيم مكتبك بطريقة احترافية وعصرية.</p>

            <div class="section" style="text-align: center; padding: 20px; background-color: #ecfdf5; border-radius: 12px; border: 1px solid #10b981;">
                <h2 style="color: #065f46;">تفعيل حسابك</h2>
                <p>يرجى الضغط على الزر أدناه لتأكيد بريدك الإلكتروني والدخول إلى النظام:</p>
                <a href="${verificationLink}" class="btn">تفعيل الحساب والدخول</a>
            </div>

            <div class="section">
                <h2>تجربتك تبدأ الآن</h2>
                <p>تم تفعيل نسختك التجريبية كاملة المزايا. فلسفتنا بسيطة: <strong>"جرّب الآن، واقتنع، ثم ادفع لاحقاً"</strong>.</p>
                <p>استكشف النظام، أضف قضاياك، وجرّب سهولة الإدارة. نحن واثقون أن "مسار" سيكون شريكك الأفضل.</p>
            </div>

            <div class="section">
                <h2>كيف يعمل الاشتراك والتجديد؟</h2>
                <p>نقدم خطط مرنة تناسب حجم مكتبك:</p>
                <ul>
                    <li><strong>المحامي المستقل:</strong> 250 ريال/شهرياً.</li>
                    <li><strong>مكتب صغير (1-5 مستخدمين):</strong> 500 ريال/شهرياً.</li>
                    <li><strong>مكتب متوسط (6-10 مستخدمين):</strong> 750 ريال/شهرياً.</li>
                </ul>
                <p>يمكنك الاشتراك <strong>سنوياً</strong> للحصول على خصم خاص (شهرين مجاناً).</p>
            </div>

            <div class="section">
                <h2>طرق الدفع والتفعيل</h2>
                <p>حالياً، نعتمد <strong>التحويل البنكي المباشر</strong> لضمان التوثيق:</p>
                <ol>
                    <li>عند انتهاء التجربة، ستظهر لك فاتورة في لوحة التحكم.</li>
                    <li>قم بالتحويل إلى حسابنا البنكي (سيزودك النظام بالتفاصيل).</li>
                    <li>ارفع إيصال التحويل عبر المنصة.</li>
                    <li>سيتم تفعيل اشتراكك فوراً بعد مراجعة الإيصال (خلال ساعات العمل).</li>
                </ol>
            </div>

            <p>نحن هنا لدعمك في أي وقت. لا تتردد في مراسلتنا.</p>
            <p>مع خالص التحية،<br>فريق مسار المحامي</p>
        </div>

        <div class="footer">
            <p>&copy; 2025 مسار المحامي. جميع الحقوق محفوظة.</p>
            <p>Masar.almohami@outlook.sa</p>
        </div>
    </div>
</body>
</html>
`;

export const INVOICE_EMAIL_HTML = (name: string, planName: string, amount: string) => `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>فاتورة الاشتراك - مسار المحامي</title>
</head>
<body style="margin:0; padding:24px 0; background:#f1f5f9; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:#0f172a; direction:rtl;">
    <div style="max-width:680px; margin:0 auto; padding:0 16px;">
        <div style="background:linear-gradient(135deg, #0f172a 0%, #102a43 55%, #0f766e 100%); border-radius:24px 24px 0 0; padding:28px 28px 22px; color:#ffffff;">
            <div style="font-size:13px; letter-spacing:0.4px; opacity:0.9; margin-bottom:10px;">مسار المحامي</div>
            <h1 style="margin:0; font-size:28px; line-height:1.5; font-weight:700;">فاتورة اشتراككم جاهزة</h1>
            <p style="margin:10px 0 0; font-size:15px; line-height:1.9; color:rgba(255,255,255,0.92);">
                تم استلام الدفعة بنجاح وتأكيد تفعيل الاشتراك على المنصة، ومرفق مع هذه الرسالة ملف الفاتورة بصيغة PDF.
            </p>
        </div>

        <div style="background:#ffffff; border:1px solid #e2e8f0; border-top:none; border-radius:0 0 24px 24px; padding:28px; box-shadow:0 20px 45px rgba(15, 23, 42, 0.08);">
            <p style="margin:0 0 18px; font-size:16px; line-height:1.9;">الأستاذ/ة <strong>${name}</strong>،</p>
            <p style="margin:0 0 22px; font-size:15px; line-height:1.95; color:#334155;">
                نشكركم على ثقتكم في <strong>مسار المحامي</strong>. تم تفعيل اشتراككم بنجاح على باقة
                <strong>${planName}</strong>، ويمكنكم الآن الاستفادة من خدمات المنصة بشكل كامل.
            </p>

            <div style="border:1px solid #dbeafe; background:linear-gradient(180deg, #f8fbff 0%, #f8fafc 100%); border-radius:20px; padding:20px 22px; margin:0 0 24px;">
                <div style="font-size:13px; color:#0369a1; margin-bottom:14px; font-weight:700;">ملخص الفاتورة</div>
                <table role="presentation" style="width:100%; border-collapse:collapse; font-size:14px;">
                    <tr>
                        <td style="padding:8px 0; color:#64748b;">الخدمة</td>
                        <td style="padding:8px 0; color:#0f172a; font-weight:600; text-align:left;">اشتراك منصة مسار المحامي</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0; color:#64748b; border-top:1px solid #e2e8f0;">الباقة</td>
                        <td style="padding:8px 0; color:#0f172a; font-weight:600; text-align:left; border-top:1px solid #e2e8f0;">${planName}</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0; color:#64748b; border-top:1px solid #e2e8f0;">إجمالي المبلغ</td>
                        <td style="padding:8px 0; color:#0f172a; font-weight:700; text-align:left; border-top:1px solid #e2e8f0;">${amount}</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0; color:#64748b; border-top:1px solid #e2e8f0;">حالة الاشتراك</td>
                        <td style="padding:8px 0; text-align:left; border-top:1px solid #e2e8f0;">
                            <span style="display:inline-block; background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; border-radius:999px; padding:6px 12px; font-size:12px; font-weight:700;">
                                مفعل
                            </span>
                        </td>
                    </tr>
                </table>
            </div>

            <div style="border-right:4px solid #10b981; background:#f8fafc; border-radius:16px; padding:16px 18px; margin:0 0 24px;">
                <p style="margin:0; font-size:14px; line-height:1.9; color:#475569;">
                    مرفق في هذه الرسالة <strong>ملف الفاتورة الرسمية PDF</strong>، ويمكن الاحتفاظ به لأغراض المراجعة المالية أو الأرشفة الداخلية.
                </p>
            </div>

            <p style="margin:0 0 12px; font-size:15px; line-height:1.9; color:#334155;">
                إذا احتجتم إلى أي مساعدة بخصوص الاشتراك أو الفاتورة، يسعد فريقنا بخدمتكم عبر البريد:
                <a href="mailto:masar.almohami@outlook.sa" style="color:#0f766e; text-decoration:none; font-weight:600;">masar.almohami@outlook.sa</a>
            </p>
            <p style="margin:0; font-size:15px; line-height:1.9; color:#334155;">
                مع خالص التقدير،
                <br />
                <strong>فريق مسار المحامي</strong>
            </p>
        </div>

        <div style="text-align:center; color:#64748b; font-size:12px; line-height:1.8; padding:18px 10px 0;">
            <p style="margin:0;">هذه الرسالة صادرة آلياً بعد تفعيل الاشتراك وسداد الفاتورة.</p>
            <p style="margin:4px 0 0;">مسار المحامي - إدارة قانونية أكثر وضوحاً وتنظيماً.</p>
        </div>
    </div>
</body>
</html>
`;

export const PASSWORD_RESET_EMAIL_SUBJECT = 'استعادة كلمة المرور - مسار المحامي';

export const PASSWORD_RESET_EMAIL_HTML = (params: {
  name: string;
  code: string;
  siteUrl: string;
}) => `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #0f172a; direction: rtl; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #f8fafc; }
        .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; }
        .title { font-size: 20px; margin: 0 0 10px; }
        .muted { color: #475569; font-size: 14px; margin: 0 0 14px; }
        .codeWrap { margin: 18px 0; text-align: center; }
        .code { display: inline-block; font-size: 28px; letter-spacing: 6px; padding: 12px 16px; border-radius: 10px; background: #ecfdf5; border: 1px solid #10b981; color: #065f46; font-weight: 700; }
        .hint { font-size: 13px; color: #64748b; margin-top: 10px; }
        .footer { margin-top: 18px; font-size: 12px; color: #64748b; text-align: center; }
        a { color: #10b981; text-decoration: none; }
    </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1 class="title">استعادة كلمة المرور</h1>
      <p class="muted">مرحباً ${params.name}،</p>
      <p class="muted">استخدم الرمز التالي لإعادة تعيين كلمة المرور داخل الموقع. إذا لم تطلب استعادة كلمة المرور، تجاهل هذه الرسالة.</p>

      <div class="codeWrap">
        <div class="code">${params.code}</div>
        <div class="hint">يفضل إدخال الرمز خلال دقائق قليلة.</div>
      </div>

      <p class="muted">افتح صفحة "نسيت كلمة المرور" ثم أدخل الرمز:</p>
      <p class="muted"><a href="${params.siteUrl}/forgot-password">${params.siteUrl}/forgot-password</a></p>
    </div>

    <div class="footer">
      <p>الدعم: <a href="mailto:masar.almohami@outlook.sa">masar.almohami@outlook.sa</a></p>
    </div>
  </div>
</body>
</html>
`;

export const NEW_SIGNUP_ALERT_SUBJECT = 'تسجيل جديد في مسار المحامي';

export const NEW_SIGNUP_ALERT_HTML = (params: {
  fullName: string;
  email: string;
  phone?: string | null;
  firmName?: string | null;
  source: string;
  createdAt: string;
}) => `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>تنبيه تسجيل جديد</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #0f172a; max-width: 620px; margin: 0 auto; padding: 20px; text-align: right; direction: rtl;">
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
        <h2 style="margin-top: 0;">تم تسجيل مستخدم جديد</h2>
        <p style="margin: 4px 0;"><strong>الاسم:</strong> ${params.fullName}</p>
        <p style="margin: 4px 0;"><strong>البريد:</strong> ${params.email}</p>
        <p style="margin: 4px 0;"><strong>الجوال:</strong> ${params.phone || 'غير مذكور'}</p>
        <p style="margin: 4px 0;"><strong>اسم المكتب:</strong> ${params.firmName || 'غير مذكور'}</p>
        <p style="margin: 4px 0;"><strong>المصدر:</strong> ${params.source}</p>
        <p style="margin: 4px 0;"><strong>وقت التسجيل:</strong> ${params.createdAt}</p>
    </div>
</body>
</html>
`;

export const CLIENT_PORTAL_WELCOME_EMAIL_SUBJECT = 'مرحباً بك في بوابة العميل | مسار المحامي';

export const CLIENT_PORTAL_WELCOME_EMAIL_TEXT = (params: {
  clientName: string;
  portalUrl: string;
}) => [
  `مرحباً ${params.clientName}،`,
  '',
  'تم إنشاء وصولك إلى بوابة العميل في مسار المحامي بنجاح.',
  'يمكنك من خلال البوابة متابعة القضايا والمستندات والفواتير المرتبطة بك بشكل آمن وسريع.',
  '',
  'خطوات الدخول:',
  '1. افتح رابط بوابة العميل.',
  '2. أدخل بريدك الإلكتروني المسجل.',
  '3. استخدم رمز التحقق الذي سيصلك على هذا البريد لإتمام الدخول.',
  '',
  `رابط البوابة: ${params.portalUrl}`,
  '',
  'إذا لم تكن تتوقع هذه الرسالة، يرجى التواصل مع مكتب المحامي مباشرة.',
  '',
  'مع التحية،',
  EMAIL_BRAND_NAME,
].join('\n');

export const CLIENT_PORTAL_WELCOME_EMAIL_HTML = (params: {
  clientName: string;
  portalUrl: string;
}) =>
  renderEmailShell({
    subject: CLIENT_PORTAL_WELCOME_EMAIL_SUBJECT,
    preheader: 'تم تجهيز وصولك إلى بوابة العميل، ويمكنك تسجيل الدخول خلال لحظات.',
    eyebrow: 'بوابة العميل',
    title: 'تم تجهيز وصولك إلى بوابة العميل',
    intro: 'لديك الآن طريقة آمنة ومباشرة لمتابعة القضايا والمستندات والفواتير الخاصة بك.',
    bodyHtml: `
      <p>مرحباً <strong>${escapeHtml(params.clientName)}</strong>،</p>
      <p>تمت إضافتك بنجاح إلى بوابة العميل. صُممت هذه البوابة لتسهيل متابعتك مع المكتب بشكل مهني وواضح، مع الاعتماد على تسجيل دخول آمن باستخدام رمز تحقق يرسل إلى بريدك الإلكتروني.</p>

      <div class="panel panel-success">
        <h2 class="panel-title">ماذا ستجد داخل البوابة؟</h2>
        <ul class="list">
          <li>متابعة القضايا والحالة الحالية لكل ملف.</li>
          <li>الوصول إلى المستندات والمرفقات المرتبطة بك.</li>
          <li>مراجعة الفواتير والحالات المالية ذات الصلة.</li>
        </ul>
      </div>

      <div class="panel">
        <h2 class="panel-title">خطوات الدخول</h2>
        <ol class="steps">
          <li>افتح رابط بوابة العميل من الزر أدناه أو عبر الرابط المباشر.</li>
          <li>أدخل بريدك الإلكتروني المسجل لدينا.</li>
          <li>سيصلك رمز تحقق على البريد نفسه لإتمام تسجيل الدخول.</li>
        </ol>
        <div class="cta">
          <a class="btn" href="${escapeHtml(params.portalUrl)}">الدخول إلى بوابة العميل</a>
        </div>
        <div class="link-box">${escapeHtml(params.portalUrl)}</div>
      </div>

      <div class="note">
        إذا لم تكن تتوقع هذه الرسالة أو كانت لديك أي ملاحظة على بيانات الدخول، يرجى التواصل مع مكتب المحامي مباشرة للتحقق.
      </div>
    `,
    footerHtml: `
      <p style="margin:0 0 6px;">أُرسلت هذه الرسالة بعد إضافتك إلى بوابة العميل من قبل المكتب.</p>
      <p style="margin:0 0 6px;">للاستفسارات التقنية: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
      <p style="margin:0;">${EMAIL_BRAND_TAGLINE}</p>
    `,
  });

export const TEAM_INVITATION_EMAIL_SUBJECT = `مرحباً بك في فريق المكتب | ${EMAIL_BRAND_NAME}`;

function getTeamRoleLabel(role: 'owner' | 'lawyer' | 'assistant') {
  if (role === 'owner') return 'مالك';
  if (role === 'assistant') return 'مساعد';
  return 'محامٍ';
}

export const TEAM_INVITATION_EMAIL_TEXT = (params: {
  recipientName?: string | null;
  recipientEmail: string;
  orgName: string;
  role: 'owner' | 'lawyer' | 'assistant';
  inviteUrl: string;
  signInUrl: string;
  forgotPasswordUrl: string;
  expiresAtLabel: string;
  invitedByName?: string | null;
}) =>
  [
    `مرحباً ${params.recipientName?.trim() || 'بك'}،`,
    '',
    `تمت دعوتك للانضمام إلى فريق ${params.orgName} على منصة ${EMAIL_BRAND_NAME} بدور ${getTeamRoleLabel(params.role)}${params.invitedByName?.trim() ? ` بواسطة ${params.invitedByName.trim()}` : ''}.`,
    `البريد المدعو: ${params.recipientEmail}`,
    `صلاحية رابط الدعوة: ${params.expiresAtLabel}`,
    '',
    'ابدأ من هنا:',
    `1. افتح رابط تسجيل الدخول التالي: ${params.signInUrl}`,
    '2. سجّل الدخول بالبريد المدعو نفسه.',
    '3. بعد الدخول سيتم فتح صفحة الدعوة وإكمال الانضمام إلى المكتب.',
    '',
    `رابط الدعوة المباشر: ${params.inviteUrl}`,
    `إذا لم تكن تعرف كلمة المرور استخدم: ${params.forgotPasswordUrl}`,
    '',
    'إذا لم يكن لديك حساب بعد، سيظهر لك خيار إنشاء حساب بالبريد نفسه بعد فتح رابط تسجيل الدخول.',
    '',
    'مع التحية،',
    EMAIL_BRAND_NAME,
  ].join('\n');

export const TEAM_INVITATION_EMAIL_HTML = (params: {
  recipientName?: string | null;
  recipientEmail: string;
  orgName: string;
  role: 'owner' | 'lawyer' | 'assistant';
  inviteUrl: string;
  signInUrl: string;
  forgotPasswordUrl: string;
  expiresAtLabel: string;
  invitedByName?: string | null;
}) =>
  renderEmailShell({
    subject: TEAM_INVITATION_EMAIL_SUBJECT,
    preheader: `تم تجهيز دعوتك للانضمام إلى ${params.orgName} ويمكنك تسجيل الدخول الآن.`,
    eyebrow: 'دعوة فريق',
    title: `مرحباً بك في فريق ${params.orgName}`,
    intro: 'يمكنك الدخول إلى المنصة عبر الرابط أدناه، ثم قبول الدعوة والبدء في العمل خلال دقائق.',
    bodyHtml: `
      <p>مرحباً <strong>${escapeHtml(params.recipientName?.trim() || 'بك')}</strong>،</p>
      <p>
        تمت دعوتك للانضمام إلى فريق <strong>${escapeHtml(params.orgName)}</strong> على منصة
        <strong>${EMAIL_BRAND_NAME}</strong> بدور <strong>${escapeHtml(getTeamRoleLabel(params.role))}</strong>
        ${params.invitedByName?.trim() ? ` بواسطة <strong>${escapeHtml(params.invitedByName.trim())}</strong>` : ''}.
      </p>

      <div class="panel panel-success">
        <h2 class="panel-title">ابدأ من هنا</h2>
        <ol class="steps">
          <li>افتح رابط تسجيل الدخول من الزر أدناه.</li>
          <li>سجّل الدخول باستخدام البريد المدعو نفسه.</li>
          <li>بعد الدخول ستنتقل مباشرة إلى صفحة قبول الدعوة داخل المنصة.</li>
        </ol>
        <div class="cta">
          <a class="btn" href="${escapeHtml(params.signInUrl)}">تسجيل الدخول وقبول الدعوة</a>
        </div>
        <div class="link-box">${escapeHtml(params.signInUrl)}</div>
      </div>

      <div class="panel">
        <h2 class="panel-title">تفاصيل الدعوة</h2>
        <table class="meta-table">
          <tr>
            <td>البريد المدعو</td>
            <td>${escapeHtml(params.recipientEmail)}</td>
          </tr>
          <tr>
            <td>الدور</td>
            <td>${escapeHtml(getTeamRoleLabel(params.role))}</td>
          </tr>
          <tr>
            <td>صلاحية الرابط</td>
            <td>${escapeHtml(params.expiresAtLabel)}</td>
          </tr>
        </table>
      </div>

      <div class="panel panel-muted">
        <h2 class="panel-title">خيارات إضافية</h2>
        <p>إذا لم تكن تعرف كلمة المرور الحالية، يمكنك إعادة تعيينها من الرابط التالي:</p>
        <div class="link-box">${escapeHtml(params.forgotPasswordUrl)}</div>
        <p style="margin-top:16px;">ويمكنك أيضًا فتح رابط الدعوة المباشر:</p>
        <div class="link-box">${escapeHtml(params.inviteUrl)}</div>
      </div>

      <div class="note">
        إذا لم يكن لديك حساب بعد، سيفتح لك رابط تسجيل الدخول صفحة الدخول نفسها مع خيار إنشاء حساب بالبريد الإلكتروني المدعو.
      </div>
    `,
    footerHtml: `
      <p style="margin:0 0 6px;">أُرسلت هذه الرسالة بعد إضافتك إلى فريق المكتب على ${EMAIL_BRAND_NAME}.</p>
      <p style="margin:0 0 6px;">للدعم: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
      <p style="margin:0;">${EMAIL_BRAND_TAGLINE}</p>
    `,
  });

export const CLIENT_PORTAL_OTP_EMAIL_SUBJECT = 'رمز التحقق للدخول إلى بوابة العميل | مسار المحامي';

export const CLIENT_PORTAL_OTP_EMAIL_TEXT = (params: {
  code: string;
  ttlMinutes: number;
  portalUrl: string;
}) => [
  'مرحباً،',
  '',
  'تلقّينا طلب دخول إلى بوابة العميل باستخدام بريدك الإلكتروني.',
  `رمز التحقق الخاص بك هو: ${params.code}`,
  `صلاحية الرمز: ${params.ttlMinutes} دقائق.`,
  '',
  `رابط بوابة العميل: ${params.portalUrl}`,
  '',
  'إذا لم تطلب هذا الرمز، يمكنك تجاهل هذه الرسالة بأمان.',
  '',
  'مع التحية،',
  EMAIL_BRAND_NAME,
].join('\n');

export const CLIENT_PORTAL_OTP_EMAIL_HTML = (params: {
  code: string;
  ttlMinutes: number;
  portalUrl: string;
}) =>
  renderEmailShell({
    subject: CLIENT_PORTAL_OTP_EMAIL_SUBJECT,
    preheader: `رمز التحقق الخاص بك هو ${params.code} وصلاحيته ${params.ttlMinutes} دقائق.`,
    eyebrow: 'تحقق آمن',
    title: 'رمز التحقق للدخول إلى بوابة العميل',
    intro: 'استخدم الرمز التالي لإتمام الدخول الآمن إلى حسابك في بوابة العميل.',
    bodyHtml: `
      <p>تلقّينا طلب دخول إلى بوابة العميل باستخدام بريدك الإلكتروني. يرجى إدخال الرمز التالي في صفحة تسجيل الدخول لإتمام العملية:</p>

      <div class="panel panel-success" style="text-align:center;">
        <h2 class="panel-title" style="margin-bottom:16px;">رمز التحقق</h2>
        <div class="code-box">${escapeHtml(params.code)}</div>
        <p style="margin:16px 0 0; font-size:14px; color:#065f46;">هذا الرمز صالح لمدة <strong>${escapeHtml(String(params.ttlMinutes))} دقائق</strong>.</p>
      </div>

      <div class="panel panel-muted">
        <h2 class="panel-title">قبل المتابعة</h2>
        <ul class="list">
          <li>أدخل الرمز كما هو تماماً في صفحة تسجيل الدخول.</li>
          <li>يمكنك طلب رمز جديد إذا انتهت المهلة المحددة.</li>
          <li>إذا لم تطلب هذا الرمز، تجاهل الرسالة ولن يتم الدخول إلى حسابك.</li>
        </ul>
        <div class="cta">
          <a class="btn" href="${escapeHtml(params.portalUrl)}">فتح بوابة العميل</a>
        </div>
        <div class="link-box">${escapeHtml(params.portalUrl)}</div>
      </div>
    `,
  });

export const CLIENT_PORTAL_MATTER_EVENT_EMAIL_SUBJECT = 'تحديث جديد على قضيتك في بوابة العميل | مسار المحامي';

const CLIENT_PORTAL_EVENT_TYPE_LABELS: Record<string, string> = {
  hearing: 'جلسة',
  call: 'اتصال',
  note: 'ملاحظة',
  email: 'بريد إلكتروني',
  meeting: 'اجتماع',
  other: 'تحديث',
};

export const CLIENT_PORTAL_MATTER_EVENT_EMAIL_TEXT = (params: {
  clientName: string;
  matterTitle: string;
  eventType: string;
  eventDateLabel?: string | null;
  note?: string | null;
  portalUrl: string;
}) => [
  `مرحباً ${params.clientName}،`,
  '',
  'تمت إضافة تحديث جديد على خط سير قضيتك من قبل فريق المكتب.',
  `القضية: ${params.matterTitle}`,
  `نوع التحديث: ${CLIENT_PORTAL_EVENT_TYPE_LABELS[params.eventType] || params.eventType}`,
  params.eventDateLabel ? `تاريخ الحدث: ${params.eventDateLabel}` : '',
  params.note?.trim() ? `ملاحظات: ${params.note.trim()}` : '',
  '',
  `يمكنك الاطلاع على التفاصيل من خلال بوابة العميل: ${params.portalUrl}`,
  '',
  'مع التحية،',
  EMAIL_BRAND_NAME,
].filter(Boolean).join('\n');

export const CLIENT_PORTAL_MATTER_EVENT_EMAIL_HTML = (params: {
  clientName: string;
  matterTitle: string;
  eventType: string;
  eventDateLabel?: string | null;
  note?: string | null;
  portalUrl: string;
}) =>
  renderEmailShell({
    subject: CLIENT_PORTAL_MATTER_EVENT_EMAIL_SUBJECT,
    preheader: `تمت إضافة ${CLIENT_PORTAL_EVENT_TYPE_LABELS[params.eventType] || 'تحديث'} جديد على قضيتك.`,
    eyebrow: 'تحديث قضية',
    title: 'تحديث جديد على خط سير القضية',
    intro: 'أضاف المكتب حدثًا جديدًا على قضيتك. يمكنك متابعة التفاصيل مباشرة من البوابة.',
    bodyHtml: `
      <p>مرحباً <strong>${escapeHtml(params.clientName)}</strong>،</p>
      <p>نحيطك علماً بأنه تمت إضافة تحديث جديد على خط سير قضيتك من قبل فريق المكتب.</p>

      <div class="panel panel-success">
        <h2 class="panel-title">تفاصيل التحديث</h2>
        <table role="presentation" class="meta-table">
          <tr>
            <td>القضية</td>
            <td>${escapeHtml(params.matterTitle)}</td>
          </tr>
          <tr>
            <td>نوع التحديث</td>
            <td>${escapeHtml(CLIENT_PORTAL_EVENT_TYPE_LABELS[params.eventType] || params.eventType)}</td>
          </tr>
          ${params.eventDateLabel ? `
          <tr>
            <td>تاريخ الحدث</td>
            <td>${escapeHtml(params.eventDateLabel)}</td>
          </tr>
          ` : ''}
        </table>
      </div>

      ${params.note?.trim() ? `
      <div class="panel panel-muted">
        <h2 class="panel-title">ملاحظة المكتب</h2>
        <p style="margin:0; white-space:pre-line;">${escapeHtml(params.note.trim())}</p>
      </div>
      ` : ''}

      <div class="panel">
        <h2 class="panel-title">المتابعة عبر البوابة</h2>
        <p>يمكنك متابعة حالة القضية وخطها الزمني والمستندات من خلال الرابط التالي:</p>
        <div class="cta">
          <a class="btn" href="${escapeHtml(params.portalUrl)}">فتح بوابة العميل</a>
        </div>
        <div class="link-box">${escapeHtml(params.portalUrl)}</div>
      </div>
    `,
  });

export const TASK_REMINDER_EMAIL_SUBJECT = (taskTitle: string) => `تنبيه مهمة | ${taskTitle}`;

export const TASK_REMINDER_EMAIL_TEXT = (params: {
  recipientName?: string | null;
  taskTitle: string;
  matterTitle?: string | null;
  dueLabel?: string | null;
  statusLabel: string;
  message?: string | null;
}) =>
  [
    `مرحباً ${params.recipientName?.trim() || 'عميلنا الكريم'}،`,
    '',
    'نود تذكيرك بالمهمة التالية:',
    `عنوان المهمة: ${params.taskTitle}`,
    params.matterTitle ? `القضية / الملف: ${params.matterTitle}` : '',
    params.dueLabel ? `موعد الاستحقاق: ${params.dueLabel}` : '',
    `الحالة الحالية: ${params.statusLabel}`,
    params.message?.trim() ? '' : '',
    params.message?.trim() ? 'ملاحظة إضافية:' : '',
    params.message?.trim() ? params.message.trim() : '',
    '',
    'مع التحية،',
    EMAIL_BRAND_NAME,
  ].filter(Boolean).join('\n');

export const TASK_REMINDER_EMAIL_HTML = (params: {
  recipientName?: string | null;
  taskTitle: string;
  matterTitle?: string | null;
  dueLabel?: string | null;
  statusLabel: string;
  message?: string | null;
}) =>
  renderEmailShell({
    subject: TASK_REMINDER_EMAIL_SUBJECT(params.taskTitle),
    preheader: `تذكير بالمهمة "${params.taskTitle}" وحالتها الحالية ${params.statusLabel}.`,
    eyebrow: 'تنبيه مهمة',
    title: 'تذكير بمهمة تحتاج إلى المتابعة',
    intro: 'أرسل لك المكتب هذا التذكير للمحافظة على وضوح الخطوات القادمة وسهولة المتابعة.',
    bodyHtml: `
      <p>مرحباً <strong>${escapeHtml(params.recipientName?.trim() || 'عميلنا الكريم')}</strong>،</p>
      <p>نود تذكيرك بالمهمة الموضحة أدناه. تم إعداد هذا التنبيه لمساعدتك على متابعة المتطلبات في الوقت المناسب.</p>

      <div class="panel">
        <h2 class="panel-title">ملخص المهمة</h2>
        <table role="presentation" class="meta-table">
          <tr>
            <td>عنوان المهمة</td>
            <td>${escapeHtml(params.taskTitle)}</td>
          </tr>
          ${params.matterTitle ? `
          <tr>
            <td>القضية / الملف</td>
            <td>${escapeHtml(params.matterTitle)}</td>
          </tr>
          ` : ''}
          ${params.dueLabel ? `
          <tr>
            <td>موعد الاستحقاق</td>
            <td>${escapeHtml(params.dueLabel)}</td>
          </tr>
          ` : ''}
          <tr>
            <td>الحالة الحالية</td>
            <td>${escapeHtml(params.statusLabel)}</td>
          </tr>
        </table>
      </div>

      ${params.message?.trim() ? `
      <div class="panel panel-muted">
        <h2 class="panel-title">ملاحظة من المكتب</h2>
        <p style="margin:0; white-space:pre-line;">${escapeHtml(params.message.trim())}</p>
      </div>
      ` : ''}

      <div class="note">
        هذه الرسالة مخصصة للتذكير والمتابعة. إذا احتجت إلى توضيح إضافي، يرجى الرد على المكتب عبر القنوات المعتمدة لديكم.
      </div>
    `,
  });

export const CLIENT_QUESTION_EMAIL_SUBJECT = 'سؤال جديد من العميل | مسار المحامي';

export const CLIENT_QUESTION_EMAIL_HTML = (params: {
  clientName: string;
  matterTitle: string;
  question: string;
  platformUrl: string;
}) =>
  renderEmailShell({
    subject: CLIENT_QUESTION_EMAIL_SUBJECT,
    preheader: `أرسل العميل ${params.clientName} استفساراً جديداً بخصوص القضية ${params.matterTitle}.`,
    eyebrow: 'استفسار جديد',
    title: 'سؤال جديد من العميل',
    intro: 'تم استلام استفسار جديد بخصوص إحدى القضايا عبر بوابة العميل.',
    bodyHtml: `
      <div class="panel">
        <h2 class="panel-title">تفاصيل الاستفسار</h2>
        <table role="presentation" class="meta-table">
          <tr>
            <td>العميل</td>
            <td>${escapeHtml(params.clientName)}</td>
          </tr>
          <tr>
            <td>القضية</td>
            <td>${escapeHtml(params.matterTitle)}</td>
          </tr>
        </table>
      </div>

      <div class="panel panel-muted">
        <h2 class="panel-title">نص السؤال</h2>
        <p style="margin:0; white-space:pre-line;">${escapeHtml(params.question)}</p>
      </div>

      <div class="cta">
        <a class="btn" href="${escapeHtml(params.platformUrl)}">الرد على الاستفسار</a>
      </div>
    `,
  });

export const LAWYER_REPLY_EMAIL_SUBJECT = 'رد جديد على استفسارك | مسار المحامي';

export const LAWYER_REPLY_EMAIL_HTML = (params: {
  matterTitle: string;
  reply: string;
  portalUrl: string;
}) =>
  renderEmailShell({
    subject: LAWYER_REPLY_EMAIL_SUBJECT,
    preheader: `تم الرد على استفسارك بخصوص القضية ${params.matterTitle}.`,
    eyebrow: 'رد جديد',
    title: 'رد جديد من المحامي',
    intro: 'قام المحامي بالرد على استفسارك الأخير عبر بوابة العميل.',
    bodyHtml: `
      <div class="panel">
        <h2 class="panel-title">القضية</h2>
        <p style="margin:0;">${escapeHtml(params.matterTitle)}</p>
      </div>

      <div class="panel panel-success">
        <h2 class="panel-title">إجابة المحامي</h2>
        <p style="margin:0; white-space:pre-line;">${escapeHtml(params.reply)}</p>
      </div>

      <div class="cta">
        <a class="btn" href="${escapeHtml(params.portalUrl)}">فتح بوابة العميل</a>
      </div>
    `,
  });

function formatDaysLeftLabel(daysLeft: number) {
  if (daysLeft <= 1) return 'يوم واحد';
  if (daysLeft === 2) return 'يومان';
  return `${daysLeft} أيام`;
}

function buildTrialTimeRemainingLabel(daysLeft: number) {
  if (daysLeft <= 1) return 'تبقّى يوم واحد';
  if (daysLeft === 2) return 'تبقّى يومان';
  return `تبقّى ${formatDaysLeftLabel(daysLeft)}`;
}

export const TRIAL_ENDING_SOON_EMAIL_SUBJECT = (daysLeft: number) =>
  `${buildTrialTimeRemainingLabel(daysLeft)} قبل انتهاء التجربة | ${EMAIL_BRAND_NAME}`;

export const TRIAL_ENDING_SOON_EMAIL_TEXT = (params: {
  recipientName?: string | null;
  orgName?: string | null;
  daysLeft: number;
  endsAtLabel?: string | null;
  upgradeUrl: string;
  supportEmail?: string | null;
}) =>
  [
    `مرحباً ${params.recipientName?.trim() || 'عميلنا الكريم'}،`,
    '',
    `نود إشعاركم بأن الفترة التجريبية الخاصة بـ ${params.orgName?.trim() || EMAIL_BRAND_NAME} لم يتبقَ عليها سوى ${formatDaysLeftLabel(params.daysLeft)}.`,
    params.endsAtLabel ? `تاريخ انتهاء التجربة: ${params.endsAtLabel}` : '',
    '',
    'لضمان استمرار الوصول إلى القضايا والمستندات وسير العمل دون انقطاع، نوصي بإرسال طلب التفعيل الآن.',
    `رابط الترقية: ${params.upgradeUrl}`,
    `للدعم المباشر: ${params.supportEmail?.trim() || SUPPORT_EMAIL}`,
    '',
    'مع خالص التقدير،',
    EMAIL_BRAND_NAME,
  ].filter(Boolean).join('\n');

export const TRIAL_ENDING_SOON_EMAIL_HTML = (params: {
  recipientName?: string | null;
  orgName?: string | null;
  daysLeft: number;
  endsAtLabel?: string | null;
  upgradeUrl: string;
  supportEmail?: string | null;
}) =>
  renderEmailShell({
    subject: TRIAL_ENDING_SOON_EMAIL_SUBJECT(params.daysLeft),
    preheader: `${buildTrialTimeRemainingLabel(params.daysLeft)} قبل انتهاء التجربة الخاصة بـ ${params.orgName?.trim() || EMAIL_BRAND_NAME}.`,
    eyebrow: 'تنبيه الاشتراك',
    title: 'تجربتكم المجانية تقترب من نهايتها',
    intro: 'هذه رسالة تذكير احترافية حتى تتمكنوا من استكمال العمل على المنصة دون أي توقف أو تعطيل لسير المكتب.',
    bodyHtml: `
      <p>مرحباً <strong>${escapeHtml(params.recipientName?.trim() || 'عميلنا الكريم')}</strong>،</p>
      <p>
        نحيطكم علماً بأن الفترة التجريبية الخاصة بـ
        <strong>${escapeHtml(params.orgName?.trim() || EMAIL_BRAND_NAME)}</strong>
        لم يتبقَ عليها سوى <strong>${escapeHtml(formatDaysLeftLabel(params.daysLeft))}</strong>.
        ${params.endsAtLabel ? `موعد الانتهاء المتوقع هو <strong>${escapeHtml(params.endsAtLabel)}</strong>.` : ''}
      </p>

      <div class="panel">
        <h2 class="panel-title">ملخص الحالة الحالية</h2>
        <table role="presentation" class="meta-table">
          <tr>
            <td>الجهة</td>
            <td>${escapeHtml(params.orgName?.trim() || EMAIL_BRAND_NAME)}</td>
          </tr>
          <tr>
            <td>المدة المتبقية</td>
            <td>${escapeHtml(formatDaysLeftLabel(params.daysLeft))}</td>
          </tr>
          ${params.endsAtLabel ? `
          <tr>
            <td>تاريخ الانتهاء</td>
            <td>${escapeHtml(params.endsAtLabel)}</td>
          </tr>
          ` : ''}
        </table>
      </div>

      <div class="panel panel-success">
        <h2 class="panel-title">لماذا يفضل التفعيل الآن؟</h2>
        <ul class="list">
          <li>استمرار الوصول إلى القضايا والعملاء والمستندات دون انقطاع.</li>
          <li>تفادي توقف الفريق عن المتابعة عند انتهاء الفترة التجريبية.</li>
          <li>تسريع إجراءات التفعيل قبل آخر يوم وبدون ضغط تشغيلي.</li>
        </ul>
      </div>

      <div class="cta">
        <a class="btn" href="${escapeHtml(params.upgradeUrl)}">طلب التفعيل الآن</a>
      </div>

      <div class="panel panel-muted">
        <h2 class="panel-title">تحتاجون مساعدة سريعة؟</h2>
        <p style="margin:0;">
          يمكنكم التواصل مباشرة عبر البريد:
          <a href="mailto:${escapeHtml(params.supportEmail?.trim() || SUPPORT_EMAIL)}">${escapeHtml(params.supportEmail?.trim() || SUPPORT_EMAIL)}</a>
        </p>
      </div>
    `,
  });

export const TRIAL_EXPIRED_EMAIL_SUBJECT = `انتهت التجربة المجانية | ${EMAIL_BRAND_NAME}`;

export const TRIAL_EXPIRED_EMAIL_TEXT = (params: {
  recipientName?: string | null;
  orgName?: string | null;
  endedAtLabel?: string | null;
  upgradeUrl: string;
  supportEmail?: string | null;
}) =>
  [
    `مرحباً ${params.recipientName?.trim() || 'عميلنا الكريم'}،`,
    '',
    `نود إشعاركم بانتهاء الفترة التجريبية الخاصة بـ ${params.orgName?.trim() || EMAIL_BRAND_NAME}.`,
    params.endedAtLabel ? `تاريخ انتهاء التجربة: ${params.endedAtLabel}` : '',
    'بياناتكم ما تزال محفوظة، ويمكنكم إعادة تفعيل الوصول مباشرة عبر طلب الاشتراك.',
    '',
    `رابط التفعيل: ${params.upgradeUrl}`,
    `للدعم المباشر: ${params.supportEmail?.trim() || SUPPORT_EMAIL}`,
    '',
    'مع خالص التقدير،',
    EMAIL_BRAND_NAME,
  ].filter(Boolean).join('\n');

export const TRIAL_EXPIRED_EMAIL_HTML = (params: {
  recipientName?: string | null;
  orgName?: string | null;
  endedAtLabel?: string | null;
  upgradeUrl: string;
  supportEmail?: string | null;
}) =>
  renderEmailShell({
    subject: TRIAL_EXPIRED_EMAIL_SUBJECT,
    preheader: `انتهت الفترة التجريبية الخاصة بـ ${params.orgName?.trim() || EMAIL_BRAND_NAME} ويمكن إعادة التفعيل مباشرة.`,
    eyebrow: 'انتهاء التجربة',
    title: 'انتهت الفترة التجريبية لحسابكم',
    intro: 'تم حفظ بياناتكم كما هي، ويمكنكم استعادة الوصول الكامل إلى المنصة فور إرسال طلب التفعيل.',
    bodyHtml: `
      <p>مرحباً <strong>${escapeHtml(params.recipientName?.trim() || 'عميلنا الكريم')}</strong>،</p>
      <p>
        انتهت الفترة التجريبية الخاصة بـ <strong>${escapeHtml(params.orgName?.trim() || EMAIL_BRAND_NAME)}</strong>
        ${params.endedAtLabel ? ` بتاريخ <strong>${escapeHtml(params.endedAtLabel)}</strong>` : ''}.
        ولضمان عودة الوصول الكامل إلى المنصة، يمكنكم طلب التفعيل مباشرة من خلال الرابط أدناه.
      </p>

      <div class="panel">
        <h2 class="panel-title">ما الذي يحدث الآن؟</h2>
        <ul class="list">
          <li>تم حفظ بيانات المكتب والقضايا والمستندات دون حذف.</li>
          <li>يمكن استعادة الوصول بمجرد إكمال طلب الاشتراك.</li>
          <li>فريقنا جاهز لمساعدتكم في اختيار الباقة المناسبة وتسريع التفعيل.</li>
        </ul>
      </div>

      <div class="cta">
        <a class="btn" href="${escapeHtml(params.upgradeUrl)}">استكمال التفعيل</a>
      </div>

      <div class="panel panel-muted">
        <h2 class="panel-title">للتواصل المباشر</h2>
        <p style="margin:0;">
          يمكنكم الرد على هذه الرسالة أو التواصل عبر:
          <a href="mailto:${escapeHtml(params.supportEmail?.trim() || SUPPORT_EMAIL)}">${escapeHtml(params.supportEmail?.trim() || SUPPORT_EMAIL)}</a>
        </p>
      </div>
    `,
  });

export const LOGIN_OTP_EMAIL_SUBJECT = 'رمز التحقق لتسجيل الدخول | مسار المحامي';

export const LOGIN_OTP_EMAIL_TEXT = (params: {
  name: string;
  code: string;
  ttlMinutes: number;
}) =>
  [
    `مرحباً ${params.name || 'عميلنا الكريم'}،`,
    '',
    'تلقّينا طلب تسجيل دخول إلى حسابك في مسار المحامي.',
    `رمز التحقق الخاص بك هو: ${params.code}`,
    `صلاحية الرمز: ${params.ttlMinutes} دقائق.`,
    '',
    'إذا لم تكن أنت من يحاول الدخول، يرجى تغيير كلمة المرور فوراً وعدم مشاركة الرمز مع أي شخص.',
  ].join('\n');

export const LOGIN_OTP_EMAIL_HTML = (params: {
  name: string;
  code: string;
  ttlMinutes: number;
}) =>
  renderEmailShell({
    subject: LOGIN_OTP_EMAIL_SUBJECT,
    preheader: `رمز التحقق الخاص بك هو ${params.code} وصلاحيته ${params.ttlMinutes} دقائق.`,
    eyebrow: 'تحقق ثنائي',
    title: 'رمز الدخول إلى حسابك',
    intro: 'تمت مطابقة كلمة المرور بنجاح. أدخل الرمز التالي في صفحة تسجيل الدخول لإتمام العملية.',
    bodyHtml: `
      <p>مرحباً <strong>${escapeHtml(params.name || 'عميلنا الكريم')}</strong>،</p>
      <p>تلقّينا طلب تسجيل دخول إلى حسابك في مسار المحامي. كمستوى أمان إضافي، يُرجى إدخال رمز التحقق التالي لإكمال العملية:</p>

      <div class="panel panel-success" style="text-align:center;">
        <h2 class="panel-title" style="margin-bottom:16px;">رمز التحقق</h2>
        <div class="code-box">${escapeHtml(params.code)}</div>
        <p style="margin:16px 0 0; font-size:14px; color:#065f46;">هذا الرمز صالح لمدة <strong>${escapeHtml(String(params.ttlMinutes))} دقائق</strong>.</p>
      </div>

      <div class="panel panel-muted">
        <h2 class="panel-title">ملاحظات هامّة</h2>
        <ul class="list">
          <li>أدخل الرمز كما هو تماماً في صفحة تسجيل الدخول.</li>
          <li>يمكنك طلب رمز جديد إذا انتهت المهلة المحددة.</li>
          <li>إذا لم تكن أنت من يحاول الدخول، يرجى تغيير كلمة المرور فوراً.</li>
        </ul>
      </div>

      <div class="note">
        لأمان حسابك: لا تشارك هذا الرمز مع أي شخص. فريق مسار المحامي لن يطلب منك الرمز أبداً.
      </div>
    `,
  });

export const PARTNER_WELCOME_EMAIL_SUBJECT = 'تم تفعيل حسابك في شركاء النجاح | مسار المحامي';

export const PARTNER_WELCOME_EMAIL_HTML = (params: {
  fullName: string;
  partnerCode: string;
  referralLink: string;
  actionLabel: string;
  actionUrl: string;
  actionHint: string;
  partnerPortalUrl: string;
  supportEmail: string;
  siteUrl: string;
  logoUrl: string;
}) => `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>${PARTNER_WELCOME_EMAIL_SUBJECT}</title>
    <style>
        body { margin: 0; background: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0f172a; direction: rtl; }
        .wrapper { max-width: 640px; margin: 0 auto; padding: 28px 16px; }
        .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; overflow: hidden; box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08); }
        .hero { background: linear-gradient(135deg, #0f172a 0%, #111827 55%, #0f766e 100%); color: #ffffff; padding: 28px 28px 24px; text-align: right; }
        .hero img { display: block; width: 150px; max-width: 100%; margin: 0 0 18px auto; }
        .hero .eyebrow { display: inline-block; padding: 6px 12px; border-radius: 999px; background: rgba(255,255,255,0.12); font-size: 12px; letter-spacing: 0.2px; }
        .hero h1 { margin: 14px 0 8px; font-size: 28px; line-height: 1.4; }
        .hero p { margin: 0; font-size: 15px; line-height: 1.9; color: rgba(255,255,255,0.92); }
        .content { padding: 28px; }
        .content p { margin: 0 0 16px; font-size: 15px; line-height: 1.9; color: #334155; }
        .highlight { background: linear-gradient(180deg, #f8fafc 0%, #ecfdf5 100%); border: 1px solid #bbf7d0; border-radius: 18px; padding: 20px; margin: 22px 0; }
        .label { font-size: 13px; color: #0f766e; margin-bottom: 8px; font-weight: 700; }
        .code { display: inline-block; direction: ltr; font-size: 24px; font-weight: 800; letter-spacing: 2px; color: #065f46; background: #ffffff; border: 1px dashed #10b981; border-radius: 14px; padding: 14px 18px; }
        .linkbox { margin-top: 16px; background: #ffffff; border: 1px solid #d1fae5; border-radius: 14px; padding: 14px; }
        .linkbox a { color: #0f766e; text-decoration: none; word-break: break-all; }
        .actions { margin: 26px 0 12px; text-align: center; }
        .btn { display: inline-block; padding: 14px 22px; border-radius: 12px; background: #10b981; color: #ffffff !important; text-decoration: none; font-weight: 700; }
        .tips { margin: 22px 0 0; padding: 18px 20px; border-radius: 18px; background: #f8fafc; border: 1px solid #e2e8f0; }
        .tips h2 { margin: 0 0 12px; font-size: 17px; color: #0f172a; }
        .tips ul { margin: 0; padding-right: 18px; color: #475569; }
        .tips li { margin: 0 0 8px; line-height: 1.8; }
        .footer { padding: 0 28px 28px; color: #64748b; font-size: 13px; line-height: 1.8; }
        .footer a { color: #0f766e; text-decoration: none; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="card">
            <div class="hero">
                <img src="${params.logoUrl}" alt="شعار مسار المحامي" />
                <span class="eyebrow">شركاء النجاح</span>
                <h1>مرحباً ${params.fullName}، تم اعتمادك وتفعيلك بنجاح</h1>
                <p>شكراً لك على انضمامك إلى برنامج شركاء النجاح. سعداء بثقتك، ونتطلع لأن تكون جزءاً من نمو مسار المحامي خلال المرحلة القادمة.</p>
            </div>

            <div class="content">
                <p>يسرّنا إبلاغك بأن حسابك في <strong>شركاء النجاح</strong> أصبح مفعلاً، ويمكنك بدء مشاركة رابطك الإحالي وكودك الخاص من الآن.</p>

                <div class="highlight">
                    <div class="label">كود الشريك الخاص بك</div>
                    <div class="code">${params.partnerCode}</div>

                    <div class="label" style="margin-top:16px;">رابط الإحالة الخاص بك</div>
                    <div class="linkbox">
                        <a href="${params.referralLink}">${params.referralLink}</a>
                    </div>
                </div>

                <div class="actions">
                    <a class="btn" href="${params.actionUrl}">${params.actionLabel}</a>
                </div>
                <p style="text-align:center; color:#64748b; font-size:13px; margin-top:0;">${params.actionHint}</p>
                <p style="text-align:center; color:#64748b; font-size:13px;">بوابة الشريك: <a href="${params.partnerPortalUrl}" style="color:#0f766e; text-decoration:none;">${params.partnerPortalUrl}</a></p>

                <div class="tips">
                    <h2>توصيات سريعة للانطلاق</h2>
                    <ul>
                        <li>شارك الرابط مباشرة مع العملاء المحتملين أو ضمن حملاتك التسويقية.</li>
                        <li>يمكنك استخدام الكود نفسه يدويًا عند التسجيل إذا لم يُستخدم الرابط مباشرة.</li>
                        <li>تُحتسب العمولة فقط على الاشتراكات المؤهلة بعد الدفع الناجح.</li>
                    </ul>
                </div>
            </div>

            <div class="footer">
                <p>نقدّر شراكتك مقدمًا، ونسعد بدعمك في أي وقت عبر <a href="mailto:${params.supportEmail}">${params.supportEmail}</a>.</p>
                <p>مع خالص الشكر،<br />فريق مسار المحامي<br /><a href="${params.siteUrl}">${params.siteUrl}</a></p>
            </div>
        </div>
    </div>
</body>
</html>
`;
