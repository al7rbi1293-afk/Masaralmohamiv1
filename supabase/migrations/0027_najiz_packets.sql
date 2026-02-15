create extension if not exists pgcrypto;
-- Step 12.4: Najiz-ready workspace packets
-- 1) najiz_packets
create table if not exists public.najiz_packets (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.organizations(id) on delete cascade,
    matter_id uuid references public.matters(id) on delete
    set null,
        title text not null,
        status text not null default 'preparing' check (
            status in (
                'preparing',
                'review',
                'ready',
                'submitted_manual'
            )
        ),
        requirements jsonb not null default '[]'::jsonb,
        notes text,
        submitted_at timestamptz,
        created_by uuid not null references auth.users(id),
        created_at timestamptz not null default now()
);
create index if not exists idx_najiz_packets_org on public.najiz_packets (org_id);
create index if not exists idx_najiz_packets_org_matter on public.najiz_packets (org_id, matter_id);
grant select,
    insert,
    update,
    delete on public.najiz_packets to authenticated;
alter table public.najiz_packets enable row level security;
create policy najiz_packets_select_member on public.najiz_packets for
select to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = najiz_packets.org_id
                and m.user_id = auth.uid()
        )
    );
create policy najiz_packets_insert_member on public.najiz_packets for
insert to authenticated with check (
        najiz_packets.created_by = auth.uid()
        and exists (
            select 1
            from public.memberships m
            where m.org_id = najiz_packets.org_id
                and m.user_id = auth.uid()
        )
    );
create policy najiz_packets_update_member on public.najiz_packets for
update to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = najiz_packets.org_id
                and m.user_id = auth.uid()
        )
    ) with check (
        exists (
            select 1
            from public.memberships m
            where m.org_id = najiz_packets.org_id
                and m.user_id = auth.uid()
        )
    );
create policy najiz_packets_delete_owner on public.najiz_packets for delete to authenticated using (
    najiz_packets.created_by = auth.uid()
    or exists (
        select 1
        from public.memberships m
        where m.org_id = najiz_packets.org_id
            and m.user_id = auth.uid()
            and m.role = 'owner'
    )
);
-- 2) najiz_packet_items
create table if not exists public.najiz_packet_items (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.organizations(id) on delete cascade,
    packet_id uuid not null references public.najiz_packets(id) on delete cascade,
    item_type text not null check (item_type in ('document', 'field', 'note')),
    label text not null,
    value text,
    document_id uuid references public.documents(id) on delete
    set null,
        done boolean default false,
        created_at timestamptz not null default now()
);
create index if not exists idx_najiz_packet_items_packet on public.najiz_packet_items (packet_id);
grant select,
    insert,
    update,
    delete on public.najiz_packet_items to authenticated;
alter table public.najiz_packet_items enable row level security;
create policy najiz_packet_items_select_member on public.najiz_packet_items for
select to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = najiz_packet_items.org_id
                and m.user_id = auth.uid()
        )
    );
create policy najiz_packet_items_insert_member on public.najiz_packet_items for
insert to authenticated with check (
        exists (
            select 1
            from public.memberships m
            where m.org_id = najiz_packet_items.org_id
                and m.user_id = auth.uid()
        )
    );
create policy najiz_packet_items_update_member on public.najiz_packet_items for
update to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = najiz_packet_items.org_id
                and m.user_id = auth.uid()
        )
    ) with check (
        exists (
            select 1
            from public.memberships m
            where m.org_id = najiz_packet_items.org_id
                and m.user_id = auth.uid()
        )
    );
create policy najiz_packet_items_delete_member on public.najiz_packet_items for delete to authenticated using (
    exists (
        select 1
        from public.memberships m
        where m.org_id = najiz_packet_items.org_id
            and m.user_id = auth.uid()
    )
);