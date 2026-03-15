alter table public.matter_communications
  drop constraint if exists matter_communications_user_id_fkey;

alter table public.matter_communications
  add constraint matter_communications_user_id_fkey
  foreign key (user_id) references public.app_users(id) on delete set null;
