# إعداد البريد الإلكتروني (SMTP Setup)

لحل مشكلة "غير مفعل"، يجب إضافة المتغيرات التالية في إعدادات Vercel.

## الخطوات

1. اذهب إلى لوحة تحكم Vercel.
2. اختر المشروع **Masaralmohamiproject**.
3. اذهب إلى **Settings** > **Environment Variables**.
4. أضف المتغيرات التالية (واحد تلو الآخر):

| Variable Name | Value (القيمة) |
| :--- | :--- |
| `SMTP_HOST` | `smtp.office365.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `masar.almohami@outlook.sa` |
| `SMTP_PASS` | (كلمة مرور بريدك الإلكتروني) |
| `SMTP_FROM` | `Masar Al-Mohami <masar.almohami@outlook.sa>` |

## ملاحظات هامة

- إذا كان حسابك في Outlook مفعل عليه "التحقق بخطوتين" (2FA)، يجب إنشاء **App Password** واستخدامه بدل كلمة المرور العادية.
- بعد إضافة المتغيرات، يجب عليك **إعادة نشر المشروع (Redeploy)** لكي تعمل الإعدادات.
