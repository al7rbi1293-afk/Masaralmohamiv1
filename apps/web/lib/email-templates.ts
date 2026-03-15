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
                    <li><strong>محامي مستقل:</strong> 250 ريال/شهرياً.</li>
                    <li><strong>مكتب صغير (1-5 مستخدمين):</strong> 500 ريال/شهرياً.</li>
                    <li><strong>مكتب متوسط (6-25 مستخدم):</strong> 750 ريال/شهرياً.</li>
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
