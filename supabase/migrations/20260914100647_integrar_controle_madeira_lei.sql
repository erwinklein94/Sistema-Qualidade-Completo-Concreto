-- Integra somente as telas úteis do Controle_madeira_de_lei:
-- Dashboard e Registros. Contas, autenticação e fluxos de fornecedor não migram.
create table public.madeira_lei_registros (
  id uuid primary key,
  excel_id text,
  data_ref date,
  semana smallint check (semana is null or semana between 1 and 53),
  fiscal text,
  fornecedor text not null,
  local text,
  pedido text not null,
  pedido_id uuid,
  vol_pedido numeric not null default 0 check (vol_pedido >= 0),
  vol_fabricar numeric not null default 0 check (vol_fabricar >= 0),
  vol_pronto numeric not null default 0 check (vol_pronto >= 0),
  vol_inspecionado numeric not null default 0 check (vol_inspecionado >= 0),
  vol_liberado numeric not null default 0 check (vol_liberado >= 0),
  vol_transportado numeric not null default 0 check (vol_transportado >= 0),
  origem_integracao text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index madeira_lei_registros_excel_id
  on public.madeira_lei_registros (excel_id)
  where excel_id is not null;
create index madeira_lei_registros_data
  on public.madeira_lei_registros (data_ref desc, created_at desc);
create index madeira_lei_registros_pedido
  on public.madeira_lei_registros (pedido);
create index madeira_lei_registros_fornecedor
  on public.madeira_lei_registros (fornecedor);

create table public.madeira_lei_sincronizacao (
  id boolean primary key default true check (id),
  finalizada_em timestamptz,
  projeto_origem text not null default 'rgafzmmnpjlrxfjkabsl'
);

alter table public.madeira_lei_registros enable row level security;
alter table public.madeira_lei_sincronizacao enable row level security;
revoke all on table public.madeira_lei_registros from anon, authenticated;
revoke all on table public.madeira_lei_sincronizacao from anon, authenticated;
grant select on table public.madeira_lei_registros to authenticated;
grant select on table public.madeira_lei_sincronizacao to authenticated;

create policy madeira_lei_registros_leitura
on public.madeira_lei_registros for select to authenticated
using ((select public.usuario_ativo()));

create policy madeira_lei_sincronizacao_leitura
on public.madeira_lei_sincronizacao for select to authenticated
using ((select public.usuario_ativo()));

comment on table public.madeira_lei_registros is
'Registros operacionais migrados do projeto Recebimento_DM_Lei. Somente leitura no site integrado.';
comment on column public.madeira_lei_registros.pedido_id is
'Identificador do pedido no projeto Supabase de origem; preservado sem chave estrangeira.';

insert into public.madeira_lei_registros (
  id, excel_id, data_ref, semana, fiscal, fornecedor, local, pedido,
  pedido_id, vol_pedido, vol_fabricar, vol_pronto, vol_inspecionado,
  vol_liberado, vol_transportado, origem_integracao, created_at, updated_at
) values
  ('4b371b93-bc5c-4515-9a06-2a1111cb907d', 'EST-0001', '2026-07-17', 29, 'Walter', 'Tres Guri', 'Marcelandia', '4502044120', '2975431a-1ab8-4275-8606-4ff5d82ba206', 10000, 5425, 4575, 2660, 0, 2660, 'power_automate_excel', '2026-07-22 22:35:34.043995+00', '2026-08-12 12:02:12.325307+00'),
  ('58a5a304-cd8f-49d7-8436-418f688eb718', 'EST-0002', '2026-07-17', 29, 'Walter', 'Tres Guri', 'Marcelandia', '4502044124', '77df1ae3-5ff2-452c-a079-797e0ba97199', 2500, 2500, 0, 0, 0, 0, 'power_automate_excel', '2026-07-22 22:35:36.720021+00', '2026-08-12 12:02:14.802549+00'),
  ('617e0100-b65d-4ef4-bfa9-c614f9023d63', 'EST-0003', '2026-07-17', 29, 'Ivan Souza', 'Pandolfi', 'Enéias Marques', '4502028987', '0005a7ee-11b6-41d3-a941-bbe842a107b4', 10500, 1456, 780, 0, 0, 8596, 'power_automate_excel', '2026-07-22 22:35:38.519861+00', '2026-08-12 12:02:16.172074+00'),
  ('b4c3180f-9879-415e-9f57-761e746136c4', 'EST-0004', '2026-07-17', 29, 'Ivan Souza', 'Pandolfi', 'Enéias Marques', '4502040200', '58eea77a-aa8b-40ba-9a76-d9f51a468bb5', 10000, 6706, 0, 0, 0, 3294, 'power_automate_excel', '2026-07-22 22:35:40.258458+00', '2026-08-12 12:02:18.266716+00'),
  ('8f4347ea-b65a-4fbc-abb0-cb8258184717', 'EST-0005', '2026-07-17', 29, 'Walter', 'Tres Guri', 'Marcelandia', '4502045548', '29db96c3-072f-42c8-b189-1bfbbf6ff996', 3920, 3920, 0, 0, 0, 0, 'power_automate_excel', '2026-07-22 22:35:42.105002+00', '2026-08-12 12:02:20.037208+00'),
  ('c10a6410-c998-434b-a20f-a511773fa6c4', 'EST-0006', '2026-07-19', 29, 'Walter', 'Tres Guri', 'Marcelandia', '4502043462', '974939d4-359a-4238-ba6d-e215618559b9', 199, 0, 199, 0, 0, 0, 'power_automate_excel', '2026-07-22 22:35:44.309147+00', '2026-08-12 12:02:21.32419+00'),
  ('2816d911-f63d-46e7-a5f8-f7d98dab94fd', 'EST-0007', '2026-07-19', 29, 'Walter', 'Tres Guri', 'Marcelandia', '4502045769', '07d57485-4910-4422-8a82-29427742d79c', 429, 0, 429, 0, 0, 0, 'power_automate_excel', '2026-07-22 22:35:46.617407+00', '2026-08-12 12:02:22.645839+00'),
  ('cff607b1-49f6-4d28-8500-6baa077e4fd8', 'EST-0008', '2026-07-19', 29, 'Walter', 'Tres Guri', 'Marcelandia', '4502045762', '1f7bcb92-932c-43c3-826c-54ff9a5f4865', 1030, 1030, 0, 0, 0, 0, 'power_automate_excel', '2026-07-22 22:35:48.253569+00', '2026-08-12 12:02:23.987289+00'),
  ('29a5b118-138c-44a1-8875-1b18c845be8c', 'EST-0009', '2026-07-19', 29, 'Walter', 'Tres Guri', 'Marcelandia', '4502045767', '30f7593d-e657-4308-a84d-3825608071a2', 1339, 1339, 0, 0, 0, 0, 'power_automate_excel', '2026-07-22 22:35:49.686342+00', '2026-08-12 12:02:25.206019+00'),
  ('df5752b4-78ab-417f-8064-53f52dcaa187', 'EST-0010', '2026-07-19', 29, 'Walter', 'Tres Guri', 'Marcelandia', '4502045765', '7c4c2a2b-954d-4059-a871-0e7e72843dcc', 721, 721, 0, 0, 0, 0, 'power_automate_excel', '2026-07-22 22:35:51.010716+00', '2026-08-12 12:02:26.366532+00'),
  ('5821f1fb-fca8-44d0-ade3-4daa613e9561', 'EST-0011', '2026-07-19', 29, 'Walter', 'Granoski', 'Itaúba', '4502044118', '8760f8dd-3f5e-4194-ad2d-54ae34b79621', 10000, 55, 9945, 7900, 3770, 3416, 'power_automate_excel', '2026-07-22 22:35:53.509691+00', '2026-08-12 12:02:27.700369+00'),
  ('857a3723-dad3-4e67-a40e-2da08a22a68d', 'EST-0012', '2026-07-19', 29, 'Walter', 'Granoski', 'Itaúba', '4502038724', 'a49722fb-338a-422a-ae0d-99eae0a3c2f7', 70, 70, 0, 0, 0, 0, 'power_automate_excel', '2026-07-22 22:35:55.222498+00', '2026-08-12 12:02:29.28147+00'),
  ('d03b45c2-d3d5-42de-940f-aa87cd1cfb6c', 'EST-0013', '2026-07-19', 29, 'Walter', 'Granoski', 'Itaúba', '4502038723', 'd48ecabd-3350-4c9a-9df0-8b456622c855', 22, 22, 0, 0, 0, 0, 'power_automate_excel', '2026-07-22 22:35:57.015668+00', '2026-08-12 12:02:30.693412+00'),
  ('3075626a-0639-46c6-9fc0-949befde9ca6', 'EST-0014', '2026-07-19', 29, 'Walter', 'Granoski', 'Itaúba', '4502044123', '5c96806b-1cbb-49d6-b0ea-484e1756a2a4', 2500, 2500, 0, 0, 0, 1106, 'power_automate_excel', '2026-07-22 22:35:58.044506+00', '2026-08-12 12:02:31.972016+00'),
  ('9585f0e3-51e3-4e2c-97d5-a607f062054c', 'EST-0015', '2026-07-19', 29, 'Walter', 'Granoski', 'Itaúba', '4502021894', '8e8a4812-13cc-45b8-8c1a-ad1d9b792fe0', 69, 69, 0, 0, 0, 0, 'power_automate_excel', '2026-07-22 22:35:59.901051+00', '2026-08-12 12:02:34.000808+00'),
  ('db658a57-096d-4247-8245-ff61f7a1cc17', 'EST-0016', '2026-07-19', 29, 'Walter', 'Granoski', 'Itaúba', '4502028893', '4b5293b4-78d5-49d1-a3c4-14b8db423097', 95, 95, 0, 0, 0, 0, 'power_automate_excel', '2026-07-22 22:36:01.771861+00', '2026-08-12 12:02:35.201819+00'),
  ('eb5f10fa-a5e4-4912-9b29-4dab42ae1f59', 'EST-0017', '2026-07-19', 29, 'Walter', 'Granoski', 'Itaúba', '4502045766', '75e6b854-827a-4d8b-bafb-d54c1689cce1', 1339, 1339, 0, 0, 0, 0, 'power_automate_excel', '2026-07-22 22:36:02.687315+00', '2026-08-12 12:02:36.50425+00'),
  ('5063520f-f76f-4d5e-ae1f-12ea63fc531e', 'EST-0018', '2026-07-19', 29, 'Walter', 'Granoski', 'Itaúba', '4550003173', 'f7444c69-afd6-4f83-aac2-e37f2603ca17', 59, 59, 0, 0, 0, 0, 'power_automate_excel', '2026-07-22 22:36:04.174471+00', '2026-08-12 12:02:37.826964+00'),
  ('e248787f-133a-4b25-96fb-e84f988066fa', 'EST-0019', '2026-07-19', 29, 'Walter', 'Granoski', 'Itaúba', '4502025290', 'e7cc7052-1703-4b51-b344-ee06a2ec32a5', 126, 126, 0, 0, 0, 0, 'power_automate_excel', '2026-07-22 22:36:05.474048+00', '2026-08-12 12:02:39.269275+00'),
  ('cc280f78-5fb7-4b38-9357-9e6df5145fe9', 'EST-0020', '2026-07-19', 29, 'Walter', 'Granoski', 'Itaúba', '4502033649', 'e7d60178-99f5-46e0-965d-66dc787ea95b', 174, 174, 0, 0, 0, 0, 'power_automate_excel', '2026-07-22 22:36:06.849733+00', '2026-08-12 12:02:45.100407+00'),
  ('8579a79d-78a8-4993-bd0e-70e0377df06d', 'EST-0021', '2026-07-19', 29, 'Walter', 'Granoski', 'Itaúba', '4502045764', '0a4de862-2997-4773-a6ed-ed6b4af5ab4c', 618, 491, 127, 0, 0, 0, 'power_automate_excel', '2026-07-22 22:36:07.884993+00', '2026-08-12 12:02:46.710687+00'),
  ('a36f86b5-4b9b-4a97-bfaa-ccd57a05e5df', 'EST-0022', '2026-07-19', 29, 'Walter', 'Granoski', 'Itaúba', '4502045547', 'b5ddd7ff-f2c4-4187-a0d7-36aafa0c27fb', 2092, 2092, 0, 0, 0, 0, 'power_automate_excel', '2026-07-22 22:36:09.239486+00', '2026-08-12 12:02:48.02131+00'),
  ('c23a3ea8-2ef3-4a09-b199-8240b280a9d9', 'EST-0023', '2026-07-20', 30, 'Ivan Souza', 'Pandolfi', 'Enéias Marques', '4502028987', '0005a7ee-11b6-41d3-a941-bbe842a107b4', 10500, 0, 0, 0, 0, 10500, 'power_automate_excel', '2026-07-22 22:36:11.104522+00', '2026-08-12 12:02:49.233945+00'),
  ('a2fc2bf5-8aa8-4e32-9a7e-9e9abc9bd99d', 'EST-0024', '2026-07-20', 30, 'Ivan Souza', 'Pandolfi', 'Enéias Marques', '4502040200', '58eea77a-aa8b-40ba-9a76-d9f51a468bb5', 10000, 7028, 0, 0, 0, 2972, 'power_automate_excel', '2026-07-22 22:36:13.091016+00', '2026-08-12 12:02:50.498022+00'),
  ('ce11fbe7-ac6f-43c0-86c9-d303806cf122', 'EST-0025', '2026-07-21', 30, 'Ivan Souza', 'Pandolfi', 'Enéias Marques', '4502040200', '58eea77a-aa8b-40ba-9a76-d9f51a468bb5', 10000, 6720, 0, 0, 420, 2860, 'power_automate_excel', '2026-07-22 22:36:14.988753+00', '2026-08-12 12:02:51.692352+00'),
  ('c3487935-96dc-4001-a5a0-e8e1b7aee425', 'EST-0026', '2026-07-22', 30, 'Walter', 'Granoski', 'Itaúba', '4502048179', 'abea83fd-640f-42e5-9633-b45580554dcc', 441, 441, 0, 0, 0, 0, 'power_automate_excel', '2026-07-22 22:36:17.291347+00', '2026-08-12 12:02:52.980609+00'),
  ('46df3094-a0c7-4bcc-bf55-367f27aed2f8', 'EST-0027', '2026-07-22', 30, 'Walter', 'Tres Guri', 'Marcelandia', '4502044120', '2975431a-1ab8-4275-8606-4ff5d82ba206', 10000, 4831, 5169, 5019, 2359, 2660, 'power_automate_excel', '2026-07-22 22:36:18.694223+00', '2026-08-12 12:02:55.068418+00'),
  ('60f929b5-787c-4f1e-aca1-f7618b0c8b48', 'EST-0028', '2026-07-22', 30, 'Walter', 'Tres Guri', 'Marcelandia', '4502043462', '974939d4-359a-4238-ba6d-e215618559b9', 199, 0, 199, 199, 199, 0, 'power_automate_excel', '2026-07-22 22:36:19.660927+00', '2026-08-12 12:02:56.726354+00'),
  ('af15bc49-39a1-4a88-b8c6-b71aa99ec5d1', 'EST-0029', '2026-07-22', 30, 'Walter', 'Tres Guri', 'Marcelandia', '4502045769', '07d57485-4910-4422-8a82-29427742d79c', 429, 0, 429, 429, 429, 0, 'power_automate_excel', '2026-07-22 22:36:21.015875+00', '2026-08-12 12:02:59.200432+00'),
  ('c754c4f0-26e2-44f5-9e7b-594a0e689479', 'EST-0030', '2026-07-22', 30, 'Walter', 'Granoski', 'Itaúba', '4502044118', '8760f8dd-3f5e-4194-ad2d-54ae34b79621', 10000, 55, 9945, 8919, 4789, 3416, 'power_automate_excel', '2026-07-22 22:36:22.344214+00', '2026-08-12 12:03:00.421066+00'),
  ('3b6d1a79-8ca5-46aa-b092-d123eeb6eb21', 'EST-0031', '2026-07-22', 30, 'Walter', 'Granoski', 'Itaúba', '4502045764', '0a4de862-2997-4773-a6ed-ed6b4af5ab4c', 618, 387, 231, 231, 231, 0, 'power_automate_excel', '2026-07-22 22:36:23.911516+00', '2026-08-12 12:03:02.72356+00'),
  ('7f1805b3-dfd9-494e-9dec-07d0ee6b0e4a', 'EST-0032', '2026-07-22', 30, 'Ivan Souza', 'Pandolfi', 'Enéias Marques', '4502040200', '58eea77a-aa8b-40ba-9a76-d9f51a468bb5', 10000, 6104, 3896, 3896, 0, 3896, 'power_automate_excel', '2026-07-22 22:36:25.325085+00', '2026-08-12 12:03:04.31562+00'),
  ('7e535441-d453-45b2-a45e-5100a93568c8', 'EST-0033', '2026-07-23', 30, 'Ivan Souza', 'Pandolfi', 'Enéias Marques', '4502040200', '58eea77a-aa8b-40ba-9a76-d9f51a468bb5', 10000, 5796, 4204, 4204, 0, 4204, 'power_automate_excel', '2026-07-22 22:36:26.969913+00', '2026-08-12 12:03:05.541643+00'),
  ('b56f194f-0c7a-4516-9299-cbc73108177a', 'EST-0034', '2026-07-23', 30, 'Walter', 'Tres Guri', 'Marcelandia', '4502044120', '2975431a-1ab8-4275-8606-4ff5d82ba206', 10000, 4608, 5392, 5392, 2732, 2660, 'power_automate_excel', '2026-07-22 22:36:27.964838+00', '2026-08-12 12:03:06.783028+00'),
  ('df8d875d-f374-4536-8848-dd84ba122224', 'EST-0035', '2026-07-23', 30, 'Walter', 'Tres Guri', 'Marcelandia', '4502045769', '07d57485-4910-4422-8a82-29427742d79c', 429, 0, 429, 429, 222, 207, 'power_automate_excel', '2026-07-22 22:36:29.732933+00', '2026-08-12 12:03:08.104543+00'),
  ('908f3235-b7b4-4195-90a0-6b6c869247c2', 'EST-0036', '2026-07-23', 30, 'Walter', 'Granoski', 'Itaúba', '4502044118', '8760f8dd-3f5e-4194-ad2d-54ae34b79621', 10000, 55, 9945, 8919, 4075, 3416, 'power_automate_excel', '2026-07-22 22:36:31.117854+00', '2026-08-12 12:03:10.099964+00'),
  ('b5bb3e69-e94b-4317-a13d-ee5579514ba7', 'EST-0037', '2026-07-23', 30, 'Walter', 'Granoski', 'Itaúba', '4502044123', '5c96806b-1cbb-49d6-b0ea-484e1756a2a4', 2500, 2500, 0, 0, 0, 1820, 'power_automate_excel', '2026-07-22 22:36:32.199819+00', '2026-08-12 12:03:12.219203+00'),
  ('79a3c1ce-5d26-48b7-a3e5-d195c26f8d2b', 'EST-0038', '2026-07-23', 30, 'Walter', 'Granoski', 'Itaúba', '4502045764', '0a4de862-2997-4773-a6ed-ed6b4af5ab4c', 618, 38, 580, 580, 580, 0, 'power_automate_excel', '2026-07-22 22:36:33.650467+00', '2026-08-12 12:03:13.696072+00'),
  ('67070163-2b23-49f2-a27d-a5059e86b912', 'EST-0039', '2026-07-27', 31, 'Ivan Souza', 'Pandolfi', 'Enéias Marques', '4502040200', '58eea77a-aa8b-40ba-9a76-d9f51a468bb5', 10000, 4872, 4722, 5128, 150, 4978, 'power_automate_excel', '2026-07-22 22:36:35.310504+00', '2026-08-12 12:03:15.641781+00'),
  ('40438e39-3d1e-46c3-b4f7-120b5e209d84', 'EST-0040', '2026-07-28', 31, 'Walter', 'Tres Guri', 'Marcelandia', '4502045769', '07d57485-4910-4422-8a82-29427742d79c', 429, 0, 429, 429, 0, 429, 'power_automate_excel', '2026-07-22 22:36:36.665332+00', '2026-08-12 12:03:16.849836+00'),
  ('11cfd084-4a08-4cad-9cdb-5f287eef6336', 'EST-0041', '2026-07-28', 31, 'Walter', 'Granoski', 'Itaúba', '4502044118', '8760f8dd-3f5e-4194-ad2d-54ae34b79621', 10000, 55, 9945, 8919, 2899, 3808, 'power_automate_excel', '2026-07-22 22:36:37.61873+00', '2026-08-12 12:03:18.486182+00'),
  ('ad4335c6-e565-42c9-8abf-945f3ef57b1e', 'EST-0042', '2026-07-28', 31, 'Walter', 'Granoski', 'Itaúba', '4502044123', '5c96806b-1cbb-49d6-b0ea-484e1756a2a4', 2500, 2500, 0, 0, 0, 2212, 'power_automate_excel', '2026-07-22 22:36:38.646638+00', '2026-08-12 12:03:19.767289+00'),
  ('f6b080c4-ffac-4d7e-bdd0-7a2be6987c8f', 'EST-0043', '2026-07-28', 31, 'Walter', 'Granoski', 'Itaúba', '4502045547', 'b5ddd7ff-f2c4-4187-a0d7-36aafa0c27fb', 2092, 2092, 0, 0, 0, 392, 'power_automate_excel', '2026-07-22 22:36:39.69899+00', '2026-08-12 12:03:21.584528+00'),
  ('7b8fa72f-b2d2-4184-b3a8-2693913bdb5e', 'EST-0044', '2026-07-30', 31, 'Walter', 'Tres Guri', 'Marcelandia', '4502044120', '2975431a-1ab8-4275-8606-4ff5d82ba206', 10000, 4108, 5892, 5392, 1458, 3038, 'power_automate_excel', '2026-07-22 22:36:41.108663+00', '2026-08-12 12:03:23.055535+00'),
  ('a4961ec8-7e4e-4d89-9878-ad7b2a3def63', 'EST-0045', '2026-07-30', 31, 'Walter', 'Tres Guri', 'Marcelandia', '4502044124', '77df1ae3-5ff2-452c-a079-797e0ba97199', 2500, 2500, 0, 0, 0, 504, 'power_automate_excel', '2026-07-22 22:36:42.443921+00', '2026-08-12 12:03:25.078715+00'),
  ('eeeef499-a3a0-4c09-8d7c-fffe9eb5c936', 'EST-0046', '2026-07-30', 31, 'Walter', 'Tres Guri', 'Marcelandia', '4502045548', '29db96c3-072f-42c8-b189-1bfbbf6ff996', 3920, 3920, 0, 0, 0, 392, 'power_automate_excel', '2026-07-22 22:36:43.931845+00', '2026-08-12 12:03:27.276386+00'),
  ('04df1845-76c1-4f2b-bcc1-ed44bdb57bf4', 'EST-0047', '2026-07-30', 31, 'Walter', 'Tres Guri', 'Marcelandia', '4502043462', '974939d4-359a-4238-ba6d-e215618559b9', 199, 0, 199, 199, 0, 199, 'power_automate_excel', '2026-07-22 22:36:44.91292+00', '2026-08-12 12:03:29.215818+00'),
  ('0459acfa-d41d-4ea0-9a03-9411f8cde6d2', 'EST-0048', '2026-07-30', 31, 'Walter', 'Granoski', 'Itaúba', '4502044118', '8760f8dd-3f5e-4194-ad2d-54ae34b79621', 10000, 55, 9945, 8919, 2563, 3856, 'power_automate_excel', '2026-07-22 22:36:45.886358+00', '2026-08-12 12:03:30.638744+00'),
  ('352874c1-ca3e-4de2-9c29-9bb71f09f8d3', 'EST-0049', '2026-07-30', 31, 'Walter', 'Granoski', 'Itaúba', '4502044123', '5c96806b-1cbb-49d6-b0ea-484e1756a2a4', 2500, 2500, 0, 0, 0, 2500, 'power_automate_excel', '2026-07-22 22:36:46.829685+00', '2026-08-12 12:03:31.762404+00'),
  ('1b73a917-51e4-492e-b359-64ae2795ea92', 'EST-0050', '2026-08-01', 31, 'Ivan Souza', 'Pandolfi', 'Enéias Marques', '4502040200', '58eea77a-aa8b-40ba-9a76-d9f51a468bb5', 10000, 4620, 5380, 5380, 0, 5380, 'power_automate_excel', '2026-07-22 22:36:48.209601+00', '2026-08-12 12:03:33.035032+00'),
  ('3a3a8d90-9e9c-48d8-b880-169ffba1a5eb', 'EST-0051', '2026-08-03', 32, 'Ivan Souza', 'Pandolfi', 'Enéias Marques', '4502050286', '7dc00064-4dfc-4c37-9262-53c84ec1ae7f', 11666, 10083, 1583, 1583, 0, 1583, 'power_automate_excel', '2026-07-22 22:36:50.029896+00', '2026-08-12 12:03:34.376376+00'),
  ('c21ac199-d0dc-4745-804b-7ca3852e7c60', 'EST-0052', '2026-08-04', 32, 'Walter', 'Tres Guri', 'Marcelandia', '4502044120', '2975431a-1ab8-4275-8606-4ff5d82ba206', 10000, 4108, 5892, 5392, 716, 3780, 'power_automate_excel', '2026-07-22 22:36:51.794664+00', '2026-08-12 12:03:35.737609+00'),
  ('89f24cd5-04a6-4f24-9766-11ff30ea3195', 'EST-0053', '2026-08-04', 32, 'Walter', 'Granoski', 'Itaúba', '4502044118', '8760f8dd-3f5e-4194-ad2d-54ae34b79621', 10000, 55, 9945, 8919, 1387, 5032, 'power_automate_excel', '2026-07-22 22:36:53.094932+00', '2026-08-12 12:03:36.900556+00'),
  ('555948fc-afa7-4814-bf4c-ba27fc79a5e2', 'EST-0054', '2026-08-04', 32, 'Walter', 'Granoski', 'Itaúba', '4502028893', '4b5293b4-78d5-49d1-a3c4-14b8db423097', 95, 90, 5, 5, 5, 0, 'power_automate_excel', '2026-07-22 22:36:54.118959+00', '2026-08-12 12:03:38.048927+00'),
  ('26e6a2d7-3f9f-4f3b-8df8-138ee5ce9416', 'EST-0055', '2026-08-04', 32, 'Walter', 'Granoski', 'Itaúba', '4502045766', '75e6b854-827a-4d8b-bafb-d54c1689cce1', 1339, 716, 623, 623, 623, 0, 'power_automate_excel', '2026-07-22 22:36:55.166959+00', '2026-08-12 12:03:39.801089+00'),
  ('ebd78598-ed52-48bb-bc34-f979a924a867', 'EST-0056', '2026-08-04', 32, 'Walter', 'Granoski', 'Itaúba', '4550003173', 'f7444c69-afd6-4f83-aac2-e37f2603ca17', 59, 10, 49, 49, 49, 0, 'power_automate_excel', '2026-07-22 22:36:56.282325+00', '2026-08-12 12:03:40.993076+00'),
  ('359baae7-6127-4ef8-a19c-064c7f297bb1', 'EST-0057', '2026-08-04', 32, 'Walter', 'Granoski', 'Itaúba', '4502033649', 'e7d60178-99f5-46e0-965d-66dc787ea95b', 174, 120, 54, 54, 54, 0, 'power_automate_excel', '2026-07-22 22:36:57.270941+00', '2026-08-12 12:03:42.132723+00'),
  ('43003632-ea0e-41b5-910e-cf46181faa28', 'EST-0058', '2026-08-04', 32, 'Walter', 'Granoski', 'Itaúba', '4502045764', '0a4de862-2997-4773-a6ed-ed6b4af5ab4c', 618, 108, 510, 510, 510, 0, 'power_automate_excel', '2026-07-22 22:36:58.243654+00', '2026-08-12 12:03:44.181392+00'),
  ('98ddeb0e-d07c-4bcb-8321-36e02f8dd760', 'EST-0059', '2026-08-11', 33, 'Walter', 'Estância', 'Cláudia', '4502054851', '48fef4cf-4e3e-437d-83d8-79ce703ea2ce', 10000, 8780, 1220, 0, 0, 0, 'power_automate_excel', '2026-07-22 22:37:00.243293+00', '2026-08-12 12:03:45.713377+00'),
  ('a7a08af6-b351-4a53-8ec2-53c2fa838eaf', 'EST-0060', '2026-08-11', 33, 'Walter', 'Tres Guri', 'Marcelandia', '4502044120', '2975431a-1ab8-4275-8606-4ff5d82ba206', 10000, 4108, 5892, 5808, 1018, 4790, 'power_automate_excel', '2026-07-22 22:37:01.283563+00', '2026-08-12 12:03:47.216593+00'),
  ('fd36866e-e691-4c1f-9d3a-62bc75b160ac', 'EST-0061', '2026-08-11', 33, 'Walter', 'Tres Guri', 'Marcelandia', '4502044124', '77df1ae3-5ff2-452c-a079-797e0ba97199', 2500, 2500, 0, 0, 0, 1024, 'power_automate_excel', '2026-07-22 22:37:02.053193+00', '2026-08-12 12:03:48.443383+00'),
  ('ef8928c1-f834-455f-bcb9-87ee1af5520c', 'EST-0062', '2026-08-11', 33, 'Walter', 'Granoski', 'Itaúba', '4502044118', '8760f8dd-3f5e-4194-ad2d-54ae34b79621', 10000, 55, 9945, 8919, 858, 5424, 'power_automate_excel', '2026-07-22 22:37:02.982293+00', '2026-08-12 12:03:50.647983+00'),
  ('97d8d6a9-516e-4c6a-bb10-7d7064f63274', 'EST-0063', '2026-08-11', 33, 'Walter', 'Granoski', 'Itaúba', '4502028893', '4b5293b4-78d5-49d1-a3c4-14b8db423097', 95, 0, 95, 95, 0, 95, 'power_automate_excel', '2026-07-22 22:37:03.958608+00', '2026-08-12 12:03:52.040206+00'),
  ('4347a22c-23f1-4ddb-9c79-fb9a21968ef3', 'EST-0064', '2026-08-11', 33, 'Walter', 'Granoski', 'Itaúba', '4502045766', '75e6b854-827a-4d8b-bafb-d54c1689cce1', 1339, 543, 796, 796, 253, 543, 'power_automate_excel', '2026-07-22 22:37:04.871234+00', '2026-08-12 12:03:53.248998+00'),
  ('45a1bf4d-a968-451d-9d42-40188e655d00', 'EST-0065', '2026-08-11', 33, 'Walter', 'Granoski', 'Itaúba', '4502025290', 'e7cc7052-1703-4b51-b344-ee06a2ec32a5', 126, 32, 94, 94, 0, 0, 'power_automate_excel', '2026-07-22 22:37:05.909875+00', '2026-08-12 12:03:54.622004+00'),
  ('d8e43d2a-1c93-40bb-89e6-8dd12f93f149', 'EST-0066', '2026-08-11', 33, 'Walter', 'Granoski', 'Itaúba', '4502045547', 'b5ddd7ff-f2c4-4187-a0d7-36aafa0c27fb', 2092, 2092, 0, 0, 0, 784, 'power_automate_excel', '2026-07-22 22:37:07.242102+00', '2026-08-12 12:03:55.857487+00'),
  ('4bbe3749-ffd7-40ef-b574-ecd5dba1278f', 'EST-0067', '2026-08-11', 33, 'Walter', 'Granoski', 'Itaúba', '4502048179', 'abea83fd-640f-42e5-9633-b45580554dcc', 441, 0, 441, 0, 0, 441, 'power_automate_excel', '2026-07-22 22:37:08.293401+00', '2026-08-12 12:03:57.374392+00'),
  ('110f76db-86af-4724-8c8c-006710d4ccd6', 'EST-0068', null, null, null, '0', null, '0', '1845f571-8062-47f4-b5c6-ea663ff51f14', 0, 0, 0, 0, 0, 0, 'power_automate_excel', '2026-07-22 22:37:09.626696+00', '2026-07-22 22:55:41.539728+00'),
  ('0f2f5df2-f81d-434c-a29e-2b62441a7e48', 'EST-0069', null, null, null, '0', null, '0', '1845f571-8062-47f4-b5c6-ea663ff51f14', 0, 0, 0, 0, 0, 0, 'power_automate_excel', '2026-07-22 22:37:11.014712+00', '2026-07-22 22:55:42.58083+00'),
  ('9a76844f-93bf-4c78-8501-d14856bcc749', null, '2026-08-12', null, 'Ivan Souza', 'Pandolfi', 'Enéias Marques', '4502050286', '7dc00064-4dfc-4c37-9262-53c84ec1ae7f', 11666, 8081, 3585, 3585, 0, 3585, 'site_fiscal_direto', '2026-08-17 10:45:10.654682+00', '2026-08-17 10:45:10.654682+00'),
  ('58862e18-3a57-4c86-b908-c52cce848953', null, '2026-08-14', null, 'Walter', 'Tres Guri', 'Marcelandia', '4502044120', '2975431a-1ab8-4275-8606-4ff5d82ba206', 10000, 4108, 5892, 5808, 598, 4790, 'site_fiscal_direto', '2026-08-17 11:18:09.070896+00', '2026-08-17 11:18:09.070896+00'),
  ('997bf1e4-ae8f-4d46-adb6-b211c5d11f8f', null, '2026-08-14', null, 'Walter', 'Tres Guri', 'Marcelandia', '4502044124', '77df1ae3-5ff2-452c-a079-797e0ba97199', 2500, 2500, 0, 0, 0, 1624, 'site_fiscal_direto', '2026-08-17 11:19:06.853575+00', '2026-08-17 11:19:06.853575+00'),
  ('81571f3e-5fae-4368-afe6-26b588de06ae', null, '2026-08-14', null, 'Walter', 'Granoski', 'Itaúba', '4502044118', '8760f8dd-3f5e-4194-ad2d-54ae34b79621', 10000, 55, 9945, 8919, 74, 6208, 'site_fiscal_direto', '2026-08-17 11:21:25.496645+00', '2026-08-17 11:21:25.496645+00'),
  ('71540566-3586-4f38-a6e4-67607809a736', null, '2026-08-14', null, 'Walter', 'Estância', 'Cláudia', '4502054851', '48fef4cf-4e3e-437d-83d8-79ce703ea2ce', 10000, 8580, 1420, 0, 0, 0, 'site_fiscal_direto', '2026-08-17 11:22:26.116373+00', '2026-08-17 11:22:26.116373+00'),
  ('bef8105b-c190-4b2e-95b4-78ffdd21b79b', null, '2026-08-17', null, 'Ivan Souza', 'Pandolfi', 'Enéias Marques', '4502050286', '7dc00064-4dfc-4c37-9262-53c84ec1ae7f', 11666, 7437, 4229, 4229, 0, 4229, 'site_fiscal_direto', '2026-08-20 13:39:25.142167+00', '2026-08-20 13:39:25.142167+00'),
  ('b5457313-85a7-48a6-9062-5438d68f36e0', null, '2026-08-17', null, 'Ivan Souza', 'Pandolfi', 'Enéias Marques', '4502040200', '58eea77a-aa8b-40ba-9a76-d9f51a468bb5', 10000, 2142, 7858, 7858, 0, 7858, 'site_fiscal_direto', '2026-08-20 13:49:17.535939+00', '2026-08-20 13:49:17.535939+00'),
  ('95fdeafb-978e-4d0c-bbb6-c1d48c71dc81', null, '2026-08-18', null, 'Walter', 'Tres Guri', 'Marcelandia', '4502044120', '2975431a-1ab8-4275-8606-4ff5d82ba206', 10000, 2892, 7108, 5808, 276, 4790, 'site_fiscal_direto', '2026-08-20 13:50:38.361285+00', '2026-08-20 13:50:38.361285+00'),
  ('50ab13e4-311f-4fb4-9c4d-980f9c3a34d7', null, '2026-08-18', null, 'Walter', 'Tres Guri', 'Marcelandia', '4502045548', '29db96c3-072f-42c8-b189-1bfbbf6ff996', 3920, 3920, 0, 0, 0, 714, 'site_fiscal_direto', '2026-08-20 13:51:44.251938+00', '2026-08-20 13:51:44.251938+00'),
  ('3b0a793e-fef6-4642-ab18-0332ae617dc1', null, '2026-08-18', null, 'Walter', 'Granoski', 'Itaúba', '4502045766', '75e6b854-827a-4d8b-bafb-d54c1689cce1', 1339, 543, 796, 796, 597, 742, 'site_fiscal_direto', '2026-08-20 13:52:39.167453+00', '2026-08-20 13:52:39.167453+00'),
  ('76a96cd5-3731-4c11-a6ab-63f3e1092a7f', null, '2026-08-21', null, 'Walter', 'Tres Guri', 'Marcelandia', '4502044120', '2975431a-1ab8-4275-8606-4ff5d82ba206', 10000, 2308, 7692, 7692, 2294, 4790, 'site_fiscal_direto', '2026-08-21 14:22:50.430341+00', '2026-08-21 14:22:50.430341+00'),
  ('dcccc4aa-5f3c-40ed-b345-df3f17960991', null, '2026-08-21', null, 'Walter', 'Tres Guri', 'Marcelandia', '4502044124', '77df1ae3-5ff2-452c-a079-797e0ba97199', 2500, 2500, 0, 0, 0, 1806, 'site_fiscal_direto', '2026-08-21 14:23:40.315073+00', '2026-08-21 14:23:40.315073+00'),
  ('51166537-a981-442e-8855-701357a96563', null, '2026-08-21', null, 'Walter', 'Tres Guri', 'Marcelandia', '4502045762', '1f7bcb92-932c-43c3-826c-54ff9a5f4865', 1030, 1030, 0, 0, 0, 360, 'site_fiscal_direto', '2026-08-21 14:24:18.270406+00', '2026-08-21 14:24:18.270406+00'),
  ('308bfecb-77a2-43c9-a299-ef2dcbf6d11c', null, '2026-08-21', null, 'Walter', 'Tres Guri', 'Marcelandia', '4502045767', '30f7593d-e657-4308-a84d-3825608071a2', 1339, 669, 640, 640, 0, 0, 'site_fiscal_direto', '2026-08-21 14:25:03.01685+00', '2026-08-21 14:25:03.01685+00'),
  ('60080a86-62dc-4a9b-b6fa-f9275b8888dc', null, '2026-08-21', null, 'Walter', 'Tres Guri', 'Marcelandia', '4502045765', '7c4c2a2b-954d-4059-a871-0e7e72843dcc', 721, 0, 721, 721, 0, 0, 'site_fiscal_direto', '2026-08-21 14:25:42.978277+00', '2026-08-21 14:25:42.978277+00'),
  ('fc2f5ede-1dea-4d3d-af24-a3a1bfe4ff80', null, '2026-08-21', null, 'Walter', 'Granoski', 'Itaúba', '4502045766', '75e6b854-827a-4d8b-bafb-d54c1689cce1', 1339, 0, 1339, 1339, 345, 994, 'site_fiscal_direto', '2026-08-21 14:26:33.065225+00', '2026-08-21 14:26:33.065225+00'),
  ('ee48905c-b4c1-4bb9-8a08-9fc356fa1740', null, '2026-08-21', null, 'Walter', 'Estância', 'Cláudia', '4502054851', '48fef4cf-4e3e-437d-83d8-79ce703ea2ce', 10000, 8704, 1296, 1296, 1296, 0, 'site_fiscal_direto', '2026-08-21 14:27:20.924072+00', '2026-08-21 14:27:20.924072+00'),
  ('08c9ffcf-0a57-4b2f-911a-b298d356d999', null, '2026-08-25', null, 'Walter', 'Tres Guri', 'Marcelandia', '4502044120', '2975431a-1ab8-4275-8606-4ff5d82ba206', 10000, 2308, 7692, 7692, 1874, 5210, 'site_fiscal_direto', '2026-08-25 18:56:48.07258+00', '2026-08-25 18:56:48.07258+00'),
  ('950cd061-2cf4-479f-8e79-22abd68dd381', null, '2026-08-25', null, 'Walter', 'Tres Guri', 'Marcelandia', '4502045762', '1f7bcb92-932c-43c3-826c-54ff9a5f4865', 1030, 1030, 0, 0, 0, 648, 'site_fiscal_direto', '2026-08-25 18:59:31.023795+00', '2026-08-25 18:59:31.023795+00'),
  ('876e0cda-0753-4484-8259-2a31013130ea', null, '2026-08-25', null, 'Walter', 'Tres Guri', 'Marcelandia', '4502045767', '30f7593d-e657-4308-a84d-3825608071a2', 1339, 699, 640, 352, 0, 0, 'site_fiscal_direto', '2026-08-25 19:00:37.929327+00', '2026-08-25 19:00:37.929327+00'),
  ('11e67786-a523-4e95-898a-39b42ffaa3ba', null, '2026-08-25', null, 'Walter', 'Granoski', 'Itaúba', '4502044118', '8760f8dd-3f5e-4194-ad2d-54ae34b79621', 10000, 55, 9945, 8919, 2240, 6208, 'site_fiscal_direto', '2026-08-25 19:01:48.690521+00', '2026-08-25 19:01:48.690521+00'),
  ('8dec923c-742b-4ad0-855d-d0e0f4254106', null, '2026-08-25', null, 'Walter', 'Granoski', 'Itaúba', '4502033649', 'e7d60178-99f5-46e0-965d-66dc787ea95b', 174, 34, 140, 140, 140, 0, 'site_fiscal_direto', '2026-08-25 19:02:24.843804+00', '2026-08-25 19:02:24.843804+00'),
  ('91024986-aec9-4a5c-b9f5-7969d0a98705', null, '2026-08-25', null, 'Walter', 'Granoski', 'Itaúba', '4502045764', '0a4de862-2997-4773-a6ed-ed6b4af5ab4c', 618, 0, 618, 618, 618, 0, 'site_fiscal_direto', '2026-08-25 19:03:03.396996+00', '2026-08-25 19:03:03.396996+00');

insert into public.madeira_lei_sincronizacao (id, finalizada_em)
values (true, '2026-08-12 12:04:02.789+00');
