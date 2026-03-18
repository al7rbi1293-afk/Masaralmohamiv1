import 'server-only';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { requireOwner } from '@/lib/org';
import { v4 as uuidv4 } from 'uuid';

/**
 * Mock Najiz Service
 * This service returns mocked data simulating responses from the Saudi Ministry of Justice API (Najiz).
 */

const COURTS = [
  'المحكمة العامة بالرياض',
  'المحكمة الجزائية بجدة',
  'محكمة الأحوال الشخصية بالدمام',
  'المحكمة التجارية بالرياض',
  'المحكمة العمالية بمكة المكرمة'
];

const CIRCUITS = [
  'الدائرة القضائية الأولى',
  'الدائرة القضائية الثانية',
  'الدائرة القضائية الثالثة',
  'الدائرة القضائية الرابعة'
];

const CASE_STATUSES = ['منظورة', 'مكتملة', 'محكومة', 'قيد التدقيق'];

export async function syncCaseDetails(matterId: string, caseNumber: string) {
  const { orgId } = await requireOwner();
  const supabase = createSupabaseServerRlsClient();

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  const courtName = COURTS[Math.floor(Math.random() * COURTS.length)];
  const courtCircuit = CIRCUITS[Math.floor(Math.random() * CIRCUITS.length)];
  const status = CASE_STATUSES[Math.floor(Math.random() * CASE_STATUSES.length)];
  
  const filingDate = new Date();
  filingDate.setMonth(filingDate.getMonth() - (Math.floor(Math.random() * 12) + 1));

  // Upsert Najiz Case
  const { data: existingCase } = await supabase
    .from('najiz_cases')
    .select('id')
    .eq('tenant_id', orgId)
    .eq('matter_id', matterId)
    .single();

  const caseId = existingCase?.id || uuidv4();

  const { error } = await supabase
    .from('najiz_cases')
    .upsert({
      id: caseId,
      tenant_id: orgId,
      matter_id: matterId,
      case_number: caseNumber,
      court_name: courtName,
      court_circuit: courtCircuit,
      filing_date: filingDate.toISOString(),
      status: status,
      last_sync_at: new Date().toISOString()
    }, { onConflict: 'matter_id' });

  if (error) {
    console.error('Error syncing case details:', error);
    throw new Error('فشل تحديث بيانات القضية من ناجز');
  }

  // Update matter with najiz case number if not already set
  await supabase
    .from('matters')
    .update({ najiz_case_number: caseNumber })
    .eq('id', matterId)
    .eq('tenant_id', orgId);

  return { ok: true, caseId, courtName, courtCircuit, status };
}

export async function syncHearings(matterId: string, caseNumber: string) {
  const { orgId } = await requireOwner();
  const supabase = createSupabaseServerRlsClient();

  // First ensure case exists
  let { data: currCase } = await supabase
    .from('najiz_cases')
    .select('id')
    .eq('matter_id', matterId)
    .single();
    
  if (!currCase) {
    await syncCaseDetails(matterId, caseNumber);
    const { data: newCase } = await supabase
      .from('najiz_cases')
      .select('id')
      .eq('matter_id', matterId)
      .single();
    currCase = newCase;
  }
  
  const najizCaseId = currCase?.id;
  if (!najizCaseId) throw new Error('لا توجد قضية مسجلة');

  // Simulate delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  const hearingsCount = Math.floor(Math.random() * 3) + 1; // 1 to 3 hearings
  const mockHearings = Array.from({ length: hearingsCount }).map((_, i) => {
    const sessionDate = new Date();
    sessionDate.setDate(sessionDate.getDate() + Math.floor(Math.random() * 30));
    
    return {
      id: uuidv4(),
      tenant_id: orgId,
      najiz_case_id: najizCaseId,
      session_date: sessionDate.toISOString(),
      session_time: `${Math.floor(Math.random() * (14 - 8 + 1) + 8)}:00`,
      session_number: `1445/${i + 1}`,
      link: Math.random() > 0.5 ? 'https://najiz.sa/virtual-hearing/mock' : null,
      status: 'مجدولة'
    };
  });

  const { error } = await supabase.from('najiz_hearings').insert(mockHearings);

  if (error) {
    console.error('Error syncing hearings:', error);
    throw new Error('فشل جلب الجلسات من ناجز');
  }

  return { ok: true, count: hearingsCount };
}

export async function validatePoA(clientId: string, poaNumber: string) {
  const { orgId } = await requireOwner();
  const supabase = createSupabaseServerRlsClient();

  await new Promise(resolve => setTimeout(resolve, 1200));

  const isRevoked = Math.random() > 0.8; // 20% chance revoked
  const status = isRevoked ? 'REVOKED' : 'VALID';

  const issueDate = new Date();
  issueDate.setMonth(issueDate.getMonth() - Math.floor(Math.random() * 24));
  
  const expiryDate = new Date(issueDate);
  expiryDate.setFullYear(expiryDate.getFullYear() + 5);

  const { data: existingPoa } = await supabase
    .from('power_of_attorneys')
    .select('id')
    .eq('tenant_id', orgId)
    .eq('client_id', clientId)
    .eq('poa_number', poaNumber)
    .single();

  const poaId = existingPoa?.id || uuidv4();

  const { error } = await supabase
    .from('power_of_attorneys')
    .upsert({
      id: poaId,
      tenant_id: orgId,
      client_id: clientId,
      poa_number: poaNumber,
      status: status,
      issue_date: issueDate.toISOString(),
      expiry_date: expiryDate.toISOString(),
      last_sync_at: new Date().toISOString()
    });

  if (error) {
    console.error('Error validating PoA:', error);
    throw new Error('فشل التحقق من حالة الوكالة');
  }

  return { ok: true, status, isRevoked };
}
