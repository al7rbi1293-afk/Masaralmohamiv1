export const WELCOME_EMAIL_SUBJECT = 'مرحباً بك في مسار المحامي - خطواتك الأولى';

export const WELCOME_EMAIL_HTML = (name: string) => `
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

            <div class="section">
                <h2>تجربتك تبدأ الآن</h2>
                <p>تم تفعيل نسختك التجريبية كاملة المزايا. فلسفتنا بسيطة: <strong>"جرّب الآن، واقتنع، ثم ادفع لاحقاً"</strong>.</p>
                <p>استكشف النظام، أضف قضاياك، وجرّب سهولة الإدارة. نحن واثقون أن "مسار" سيكون شريكك الأفضل.</p>
                <a href="https://masaralmohamiproject-pied.vercel.app/app" class="btn">الدخول إلى المنصة</a>
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
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; text-align: right; direction: rtl;">
    <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #0f172a; margin-bottom: 15px;">شكراً لثقتك، ${name} 👋</h2>
        <p>تم استلام دفعتك بنجاح وتفعيل اشتراكك في باقة <strong>${planName}</strong>.</p>
        <p>مرفق في هذا البريد فاتورة الاشتراك الرسمية بقيمة <strong>${amount}</strong>.</p>
    </div>

    <div style="margin-top: 30px; text-align: center; font-size: 14px; color: #64748b;">
        <p>نسعد بخدمتك دائماً.</p>
        <p>فريق مسار المحامي</p>
    </div>
</body>
</html>
`;
