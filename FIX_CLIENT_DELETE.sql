-- السماح لجميع أعضاء المكتب (owner, admin, member) بحذف العملاء
drop policy if exists clients_delete_member on public.clients;
create policy clients_delete_member
on public.clients
for delete
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = clients.org_id
      and m.user_id = auth.uid()
  )
);

-- تعديل مفاتيح الربط لتفعيل (الحذف المتتالي - Cascade Delete) 
-- لحذف جميع البيانات المرتبطة (القضايا، الفواتير، عروض الأسعار) تلقائياً عند حذف العميل

alter table public.matters drop constraint if exists matters_client_id_fkey;
alter table public.matters add constraint matters_client_id_fkey
  foreign key (client_id) references public.clients(id) on delete cascade;

alter table public.quotes drop constraint if exists quotes_client_id_fkey;
alter table public.quotes add constraint quotes_client_id_fkey
  foreign key (client_id) references public.clients(id) on delete cascade;

alter table public.invoices drop constraint if exists invoices_client_id_fkey;
alter table public.invoices add constraint invoices_client_id_fkey
  foreign key (client_id) references public.clients(id) on delete cascade;
