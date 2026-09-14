-- Preserva registros operacionais ao excluir contas do Supabase Auth.
-- Os campos de autoria são opcionais e passam a ON DELETE SET NULL.

alter table public.conprem_ensaios_dormentes
  drop constraint conprem_ensaios_dormentes_atualizado_por_fkey,
  add constraint conprem_ensaios_dormentes_atualizado_por_fkey
    foreign key (atualizado_por) references auth.users(id) on delete set null,
  drop constraint conprem_ensaios_dormentes_criado_por_fkey,
  add constraint conprem_ensaios_dormentes_criado_por_fkey
    foreign key (criado_por) references auth.users(id) on delete set null;

alter table public.conprem_ensaios_liberacao
  drop constraint conprem_ensaios_liberacao_atualizado_por_fkey,
  add constraint conprem_ensaios_liberacao_atualizado_por_fkey
    foreign key (atualizado_por) references auth.users(id) on delete set null,
  drop constraint conprem_ensaios_liberacao_criado_por_fkey,
  add constraint conprem_ensaios_liberacao_criado_por_fkey
    foreign key (criado_por) references auth.users(id) on delete set null;

alter table public.conprem_producao_lotes
  drop constraint conprem_producao_lotes_atualizado_por_fkey,
  add constraint conprem_producao_lotes_atualizado_por_fkey
    foreign key (atualizado_por) references auth.users(id) on delete set null,
  drop constraint conprem_producao_lotes_criado_por_fkey,
  add constraint conprem_producao_lotes_criado_por_fkey
    foreign key (criado_por) references auth.users(id) on delete set null;

alter table public.conprem_reprovados
  drop constraint conprem_reprovados_atualizado_por_fkey,
  add constraint conprem_reprovados_atualizado_por_fkey
    foreign key (atualizado_por) references auth.users(id) on delete set null,
  drop constraint conprem_reprovados_criado_por_fkey,
  add constraint conprem_reprovados_criado_por_fkey
    foreign key (criado_por) references auth.users(id) on delete set null;

alter table public.ensaios_liberacao
  drop constraint ensaios_liberacao_atualizado_por_fkey,
  add constraint ensaios_liberacao_atualizado_por_fkey
    foreign key (atualizado_por) references auth.users(id) on delete set null,
  drop constraint ensaios_liberacao_criado_por_fkey,
  add constraint ensaios_liberacao_criado_por_fkey
    foreign key (criado_por) references auth.users(id) on delete set null;

alter table public.producao_lotes
  drop constraint producao_lotes_atualizado_por_fkey,
  add constraint producao_lotes_atualizado_por_fkey
    foreign key (atualizado_por) references auth.users(id) on delete set null,
  drop constraint producao_lotes_criado_por_fkey,
  add constraint producao_lotes_criado_por_fkey
    foreign key (criado_por) references auth.users(id) on delete set null;

alter table public.reprovados
  drop constraint reprovados_atualizado_por_fkey,
  add constraint reprovados_atualizado_por_fkey
    foreign key (atualizado_por) references auth.users(id) on delete set null,
  drop constraint reprovados_criado_por_fkey,
  add constraint reprovados_criado_por_fkey
    foreign key (criado_por) references auth.users(id) on delete set null;
