'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { requireOrgIdForUser } from '@/lib/org';
import { verifyCsrfToken } from '@/lib/csrf';

export async function updateOfficeIdentityAction(formData: FormData) {
    const isCsrfValid = await verifyCsrfToken(formData);
    if (!isCsrfValid) {
        return { success: false, error: 'تعذر الحفظ (غير مصرح).' };
    }
    const name = String(formData.get('name') || '').trim();

    if (!name) {
        return { success: false, error: 'اسم المكتب مطلوب.' };
    }

    try {
        const orgId = await requireOrgIdForUser();
        const supabase = createSupabaseServerRlsClient();

        const updateData: any = { name };

        const logo = formData.get('logo') as File | null;
        if (logo && logo.size > 0) {
            // Validate size (5MB max) and type
            if (logo.size > 5 * 1024 * 1024) {
                return { success: false, error: 'يجب ألا يتجاوز حجم الشعار 5 ميجابايت.' };
            }

            const ext = logo.name.split('.').pop() || 'png';
            const fileName = `office-logos/${orgId}-${Date.now()}.${ext}`;

            const { error: uploadError } = await supabase.storage
                .from('public_assets')
                .upload(fileName, logo, { upsert: true });

            if (uploadError) {
                console.error('Logo upload error:', uploadError);
                return { success: false, error: 'تعذر رفع الشعار.' };
            }

            const { data: publicUrlData } = supabase.storage
                .from('public_assets')
                .getPublicUrl(fileName);

            updateData.logo_url = publicUrlData.publicUrl;
        }

        const { error } = await supabase
            .from('organizations')
            .update(updateData)
            .eq('id', orgId);

        if (error) {
            console.error('Error updating organization:', error);
            return { success: false, error: 'تعذر حفظ الإعدادات.' };
        }

        revalidatePath('/app/settings', 'layout');
        revalidatePath('/app/settings/office');

        return { success: true };
    } catch (error) {
        console.error('Update office identity error:', error);
        return { success: false, error: 'حدث خطأ غير متوقع أثناء الحفظ.' };
    }
}
