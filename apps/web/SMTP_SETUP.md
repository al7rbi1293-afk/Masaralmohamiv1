# إعداد البريد الإلكتروني (SMTP Setup)

تم الحصول على بيانات الاعتماد الجديدة لحساب Gmail. يجب تحديث الإعدادات في Vercel لضمان عمل البريد الإلكتروني.

## البيانات المطلوبة (Copy & Paste)

انسخ هذه القيم وأضفها في إعدادات Vercel:

| Variable Name | Value (القيمة) |
| :--- | :--- |
| `SMTP_USER` | `Masar.almohami@gmail.com` |
| `SMTP_PASS` | `nylirwhwzwbeukkw` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |

## خطوات التحديث

1. اذهب إلى **[صفحة إعدادات Vercel](https://vercel.com/dashboard)** > اختر المشروع.
2. اذهب إلى **Settings** > **Environment Variables**.
3. قم بتعديل المتغيرات السابقة (Edit) أو إضافتها إذا لم تكن موجودة.
4. **هام جداً**: بعد التحديث، اذهب إلى تبويب **Deployments** > اضغط على الثلاث نقاط بجانب آخر نشر > اختر **Redeploy**.

بعد ذلك سيعمل البريد الإلكتروني 100%.
