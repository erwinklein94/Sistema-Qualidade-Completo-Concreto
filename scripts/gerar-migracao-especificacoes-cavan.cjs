// Emite SQL para revisão; não conecta nem grava no banco.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const ctx = vm.createContext({ window: {}, document: { addEventListener() {} } });
for (const file of ['js/especificacoes-cavan.js', 'js/especificacoes-dormentes.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx);
}
const { campos, padroes, revisao } = vm.runInContext('({ campos: CAMPOS, padroes: ESPEC_PADROES_DORMENTES, revisao: ESPEC_CAVAN.revisao })', ctx);
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const records = Object.values(padroes).map(r => Object.fromEntries(campos.map(k => [k, r[k] ?? null])));
const payload = JSON.stringify(records);
const assignments = campos.map(k => `${k} = v_reg.${k}`).join(',\n        ');
const columns = campos.join(', ');
const values = campos.map(k => `v_reg.${k}`).join(', ');
process.stdout.write(`-- Gerada a partir dos modelos Cavan revisados em 08/09/2026.
-- Escopo: cinco projetos/bitolas identificados; preserva IDs, criação,
-- RLS e metadados. Não altera as tabelas de produção/Conprem.
-- Campos TEXT seguem o cadastro consultivo: incluem unidade, fonte e pendências.
begin;
set local lock_timeout = '10s';

-- A auditoria foi excluída intencionalmente pelo responsável pelo site.
-- Retira somente o gatilho obsoleto deste cadastro quando o destino não existe.
-- Mantém o preenchimento dos metadados de criação/atualização.
do $auditoria$
begin
  if to_regclass('public.auditoria_alteracoes') is null then
    drop trigger if exists trg_espec_dormentes_registrar_auditoria
      on public.especificacoes_dormentes;
  end if;
end;
$auditoria$;

alter table public.especificacoes_dormentes
  ${campos.map(k => `add column if not exists ${k} text`).join(',\n  ')};

comment on column public.especificacoes_dormentes.momento_positivo_apoio_trilho is 'Carga de ensaio em kN; não confundir com momento fletor em kN·m.';
comment on column public.especificacoes_dormentes.momento_negativo_apoio_trilho is 'Carga de ensaio em kN.';
comment on column public.especificacoes_dormentes.momento_positivo_centro is 'Carga de ensaio em kN.';
comment on column public.especificacoes_dormentes.momento_negativo_centro is 'Carga de ensaio em kN.';

do $cavan$
declare
  v_json jsonb;
  v_reg public.especificacoes_dormentes%rowtype;
  v_count integer;
begin
  -- Evita inserção concorrente de modelos enquanto os registros são revisados.
  lock table public.especificacoes_dormentes in share row exclusive mode;
  for v_json in select value from jsonb_array_elements(${quote(payload)}::jsonb)
  loop
    v_reg := jsonb_populate_record(null::public.especificacoes_dormentes, v_json);
    select count(*) into v_count from public.especificacoes_dormentes
      where upper(btrim(projeto)) = v_reg.projeto and upper(btrim(bitola)) = upper(v_reg.bitola);
    if v_count > 1 then
      raise exception 'Especificações duplicadas para % / %; revisar antes da migração.', v_reg.projeto, v_reg.bitola;
    elsif v_count = 1 then
      update public.especificacoes_dormentes set
        ${assignments}
      where upper(btrim(projeto)) = v_reg.projeto and upper(btrim(bitola)) = upper(v_reg.bitola)
        and revisao_fonte is distinct from ${quote(revisao)};
    else
      insert into public.especificacoes_dormentes (${columns})
        values (${values});
    end if;
  end loop;
end;
$cavan$;

notify pgrst, 'reload schema';
commit;
`);
