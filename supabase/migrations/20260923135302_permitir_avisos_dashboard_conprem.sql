-- O quadro da Conprem usa uma chave própria. Preserve a chave da Cavan e
-- permita somente essas duas áreas para gravação por administradores.
alter policy "avisos_dashboard_insert_admin"
on public.avisos_dashboard
with check ((select public.eh_admin()) and chave in ('dashboard', 'dashboard-conprem'));

alter policy "avisos_dashboard_update_admin"
on public.avisos_dashboard
using ((select public.eh_admin()) and chave in ('dashboard', 'dashboard-conprem'))
with check ((select public.eh_admin()) and chave in ('dashboard', 'dashboard-conprem'));

alter policy "avisos_dashboard_delete_admin"
on public.avisos_dashboard
using ((select public.eh_admin()) and chave in ('dashboard', 'dashboard-conprem'));
