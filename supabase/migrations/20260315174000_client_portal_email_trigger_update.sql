-- Ensure portal sync trigger runs when client email changes.

drop trigger if exists clients_sync_client_portal_user on public.clients;

create trigger clients_sync_client_portal_user
after insert or update of email, phone, status, org_id
on public.clients
for each row
execute function public.sync_client_portal_user_from_client();
