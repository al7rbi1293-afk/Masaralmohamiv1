import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // using service role to bypass auth for a quick test, or we can just simulate the exact insert
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const orgId = process.argv[2];
    const userId = process.argv[3];

    const { data, error } = await supabase
        .from('matters')
        .insert({
            org_id: orgId,
            client_id: null,
            title: 'Test Matter',
            status: 'new',
            summary: null,
            case_type: null,
            claims: null,
            assigned_user_id: userId,
            is_private: false,
        })
        .select()
        .single();

    if (error) {
        console.error('Insert Error:', error);
    } else {
        console.log('Inserted Matter:', data);
    }
}

run();
