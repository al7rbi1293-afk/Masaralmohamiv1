import { z } from 'zod';
import { DEFAULT_PHONE_COUNTRY_CODE } from '@/lib/phone';

export const partnerApplicationSchema = z.object({
  full_name: z
    .string({ required_error: 'الاسم الرباعي مطلوب.' })
    .trim()
    .min(10, 'يرجى إدخال الاسم الرباعي كاملًا.')
    .max(140, 'الاسم طويل جدًا.'),
  whatsapp_country: z
    .string()
    .trim()
    .toUpperCase()
    .max(8, 'رمز الدولة غير صالح.')
    .optional()
    .default(DEFAULT_PHONE_COUNTRY_CODE),
  whatsapp_number: z
    .string({ required_error: 'رقم الواتساب مطلوب.' })
    .trim()
    .min(1, 'رقم الواتساب مطلوب.')
    .max(24, 'رقم الواتساب طويل جدًا.'),
  email: z
    .string({ required_error: 'البريد الإلكتروني مطلوب.' })
    .trim()
    .email('يرجى إدخال بريد إلكتروني صحيح.')
    .max(255, 'البريد الإلكتروني طويل جدًا.'),
  city: z
    .string({ required_error: 'المدينة مطلوبة.' })
    .trim()
    .min(2, 'يرجى إدخال المدينة.')
    .max(120, 'اسم المدينة طويل جدًا.'),
  marketing_experience: z
    .string({ required_error: 'نبذة الخبرة مطلوبة.' })
    .trim()
    .min(20, 'يرجى كتابة نبذة أوضح عن خبرتك التسويقية.')
    .max(4000, 'نبذة الخبرة طويلة جدًا.'),
  audience_notes: z
    .string()
    .trim()
    .max(2000, 'وصف الجمهور طويل جدًا.')
    .optional(),
  accepted_terms: z
    .boolean()
    .refine((value) => value === true, 'يجب الموافقة على الشروط والأحكام.'),
  website: z.string().trim().max(0, 'تم رفض الطلب.'),
});

export const referralCaptureSchema = z.object({
  ref: z.string().trim().min(3).max(80).optional(),
  session_id: z.string().trim().max(128).optional(),
  landing_page: z.string().trim().max(1000).optional(),
  utm_source: z.string().trim().max(200).optional(),
  utm_medium: z.string().trim().max(200).optional(),
  utm_campaign: z.string().trim().max(200).optional(),
});

export const adminApplicationActionSchema = z.object({
  id: z.string().uuid('المعرّف غير صالح.'),
  action: z.enum(['approve', 'reject', 'needs_review']),
  admin_notes: z.string().trim().max(2000).optional(),
});

export const adminPartnerActionSchema = z.object({
  id: z.string().uuid('المعرّف غير صالح.'),
  action: z.enum(['regenerate_code', 'deactivate', 'reactivate']),
});

export const adminCommissionActionSchema = z.object({
  id: z.string().uuid('المعرّف غير صالح.'),
  action: z.enum(['approve', 'mark_payable', 'mark_paid', 'reverse']),
  notes: z.string().trim().max(2000).optional(),
});

export const adminPayoutActionSchema = z.object({
  id: z.string().uuid('المعرّف غير صالح.'),
  action: z.enum(['mark_processing', 'mark_paid', 'mark_failed', 'cancel']),
  reference_number: z.string().trim().max(255).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const tapCreateChargeSchema = z.object({
  plan_code: z.string().trim().min(1, 'الخطة مطلوبة.').max(40, 'الخطة غير صالحة.'),
  billing_period: z.enum(['monthly', 'yearly']),
  currency: z.string().trim().length(3).optional(),
});
