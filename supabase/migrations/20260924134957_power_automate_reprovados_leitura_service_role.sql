-- A Edge Function power-automate-reprovados lê as reprovas da Cavan com o
-- service_role para o Power Automate levá-las à aba REPROVADOS_CAVAN do Excel.
-- A tabela reprovados nunca havia concedido leitura a esse papel, e toda
-- chamada falhava com "permission denied" (42501). Só leitura: a integração
-- não grava nada no banco.
grant select on table public.reprovados to service_role;
