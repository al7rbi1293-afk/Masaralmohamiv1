'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { requireOrgIdForUser } from '@/lib/org';

export async function updateOfficeIdentityAction(formData: FormData) {
    const name = String(formData.get('name') || '').trim();

    if (!name) {
        return { success: false, error: 'اسم المكتب مطلوب.' };
    }

    try {
        const orgId = await requireOrgIdForUser();
        const supabase = createSupabaseServerRlsClient();

        const { error } = await supabase
            .from('organizations')
            .update({ name })
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
