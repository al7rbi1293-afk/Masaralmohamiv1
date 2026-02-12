# Pilot Playbook (First 10 Offices)

## Pilot Objective
Launch the current marketing + trial flow safely and measure early conversion quality for the first 10 law offices.

## Onboarding Steps (Manual)
1. Share the landing URL with target office.
2. Ask office admin to start 14-day trial from section `#trial`.
3. Confirm account reached `/app` successfully.
4. Track trial start in logs (`trial_started`).
5. At expiry or early interest, collect activation intent using:
   - `/app/expired` form
   - `/contact` form
6. Follow up manually via `masar.almohami@outlook.sa`.

## Suggested Arabic Email Templates

### 1) Welcome after signup
**Subject:** مرحبًا بكم في مسار المحامي — بداية التجربة المجانية  
**Body:**  
مرحبًا بكم،  
تم تفعيل تجربتكم المجانية في مسار المحامي لمدة 14 يوم.  
يمكنكم الآن الدخول والبدء من خلال: [رابط المنصة]  
إذا احتجتم أي مساعدة في الإعداد، يسعدنا خدمتكم عبر: masar.almohami@outlook.sa

### 2) Two days before trial ends
**Subject:** تذكير: تبقّى يومان على انتهاء تجربة مسار المحامي  
**Body:**  
مرحبًا،  
نود تذكيركم أن تجربتكم في مسار المحامي ستنتهي خلال يومين.  
إذا رغبتم في تفعيل النسخة الكاملة، يمكنكم إرسال طلب التفعيل مباشرة من داخل المنصة أو عبر البريد: masar.almohami@outlook.sa

### 3) Trial ended + activation request
**Subject:** انتهت التجربة — جاهزون لتفعيل النسخة الكاملة  
**Body:**  
مرحبًا،  
انتهت التجربة المجانية لحسابكم في مسار المحامي.  
للتفعيل والانتقال للنسخة الكاملة، ردوا على هذه الرسالة أو أرسلوا طلب التفعيل من صفحة انتهاء التجربة.  
فريقنا جاهز لإكمال الإعداد معكم.

## Metrics to Track
1. `trial_started` per day.
2. `contact_request_created` per day.
3. Conversion rate:
   - `contact_request_created / trial_started`.

## Pilot Rhythm
- Daily: monitor logs and respond to new activation requests.
- Weekly: summarize trials started, requests received, and blockers from offices.
