-- =====================================================================
-- Inspeções de Pista — carga dos lotes lidos dos relatórios iAuditor
-- (pasta "inspeção para o claude"). Gerado a partir da MESMA leitura que o
-- site faz (parser js/iauditor-parser.js + montarRegistroIauditor).
--
-- COMO USAR: rode este script UMA vez no SQL Editor do Supabase, DEPOIS de já
-- ter criado a tabela com supabase/2026-06-09-inspecoes-pista.sql.
--
-- SEGURO PARA REEXECUTAR: cada lote só é inserido se ainda NÃO existir
-- (where not exists ... ip.lote = ...), então lotes já cadastrados são ignorados.
--
-- O link do relatório fica em branco de propósito — anexe depois, lote a lote,
-- pela própria tela (botão Editar). A quantidade de dormentes reprovados de
-- cada lote já vai embutida no campo "observações" (linha "Dormentes reprovados: N"),
-- exatamente como o leitor do site grava.
--
-- Total de lotes no arquivo: 34
-- =====================================================================

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-05-18', '2854', 'MALHA PAULISTA BITOLA LARGA', 'Bitola Larga', 'Cavan SP', '2', null, null, null, null, null, null, null, 'Pendente', 'Darci de Brum', null, '2854-Malha-Paulista-18-05-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 2854-Malha-Paulista-18-05-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Darci de Brum | Fornecedor: Cavan - Santa Lucia | Projeto: Malha Paulista | Tipo de dormente: Bitola larga | USP: Não | Tipo de ombreira: Fast Clip | Lote: 2854 | Data da fabricação: 18 mai. 2026 16:47 -03 | Pista: 2 | Quantidade produzida: 330 | Quantidade reprovada: 2 | Data prevista de cura: 1 jun. 2026 16:47 -03 | Situação do relatório: Concluído
Dormentes reprovados: 2'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '2854');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-05-18', '2855', 'MALHA PAULISTA BITOLA MISTA', 'Bitola Mista', 'Cavan SP', '3', null, null, null, null, null, null, null, 'Pendente', 'Darci de Brum', null, '2855-Malha-Paulista-18-05-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 2855-Malha-Paulista-18-05-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Darci de Brum | Fornecedor: Cavan - Santa Lucia | Projeto: Malha Paulista | Tipo de dormente: Bitola Mista | USP: Sim | Tipo de ombreira: Fast Clip | Lote: 2855 | Data da fabricação: 18 mai. 2026 16:38 -03 | Pista: 3 | Quantidade produzida: 330 | Quantidade reprovada: 3 | Data prevista de cura: 1 jun. 2026 16:39 -03 | Situação do relatório: Concluído
Dormentes reprovados: 3'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '2855');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-05-18', '2989', 'FERRO NORTE', 'Bitola Larga', 'Cavan SP', '4', null, null, null, null, null, null, null, 'Pendente', 'Darci de Brum', null, '2989-Ferro-Norte-18-05-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 2989-Ferro-Norte-18-05-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Darci de Brum | Fornecedor: Cavan - Santa Lucia | Projeto: Ferro Norte | Tipo de dormente: Bitola Larga | USP: Não | Tipo de ombreira: E - Clip | Lote: 2989 | Data da fabricação: 18 mai. 2026 16:26 -03 | Pista: 4 | Quantidade produzida: 275 | Quantidade reprovada: 4 | Data prevista de cura: 1 jun. 2026 16:26 -03 | Situação do relatório: Concluído
Dormentes reprovados: 4'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '2989');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-05-19', '2991', 'MALHA PAULISTA BITOLA MISTA', 'Bitola Mista', 'Cavan SP', '1', null, null, null, null, null, null, null, 'Pendente', 'Darci de Brum', null, '2991-Malha-Paulista-19-05-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 2991-Malha-Paulista-19-05-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Darci de Brum | Fornecedor: Cavan - Santa Lucia | Projeto: Malha Paulista | Tipo de dormente: Bitola mista | USP: Sim | Tipo de ombreira: Fast Clip | Lote: 2991 | Data da fabricação: 19 mai. 2026 09:07 -03 | Pista: 1 | Quantidade produzida: 330 | Quantidade reprovada: 0 | Data prevista de cura: 2 jun. 2026 09:07 -03 | Situação do relatório: Concluído
Dormentes reprovados: 0'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '2991');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-05-19', '2992', 'MALHA PAULISTA BITOLA MISTA', 'Bitola Mista', 'Cavan SP', '3', null, null, null, null, null, null, null, 'Pendente', 'Darci de Brum', null, '2992-Malha-Paulista-19-05-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 2992-Malha-Paulista-19-05-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Darci de Brum | Fornecedor: Cavan - Santa Lucia | Projeto: Malha Paulista | Tipo de dormente: Bitola Mista | USP: Sim | Tipo de ombreira: Fast Clip | Lote: 2992 | Data da fabricação: 19 mai. 2026 14:53 -03 | Pista: 3 | Quantidade produzida: 330 | Quantidade reprovada: 0 | Data prevista de cura: 2 jun. 2026 14:54 -03 | Situação do relatório: Concluído
Dormentes reprovados: 0'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '2992');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-05-19', '2993', 'MALHA PAULISTA BITOLA LARGA', 'Bitola Larga', 'Cavan SP', '2', null, null, null, null, null, null, null, 'Pendente', 'Darci de Brum', null, '2993-Malha-Paulista-19-05-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 2993-Malha-Paulista-19-05-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Darci de Brum | Fornecedor: Cavan - Santa Lucia | Projeto: 2993 | Tipo de dormente: Bitola larga | USP: Não | Tipo de ombreira: Fast Clip | Lote: 2993 | Data da fabricação: 19 mai. 2026 14:55 -03 | Pista: 2 | Quantidade produzida: 330 | Quantidade reprovada: 2 | Data prevista de cura: 2 jun. 2026 14:55 -03 | Situação do relatório: Concluído
Dormentes reprovados: 2'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '2993');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-05-20', '2994', 'FERRO NORTE', 'Bitola Larga', 'Cavan SP', '4', null, null, null, null, null, null, null, 'Pendente', 'Darci de Brum', null, '2994-Ferronorte-20-05-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 2994-Ferronorte-20-05-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Darci de Brum | Fornecedor: Cavan - Santa Lucia | Projeto: Ferronorte | Tipo de dormente: Bitola Larga | USP: Não | Tipo de ombreira: E - Clip | Lote: 2994 | Data da fabricação: 20 mai. 2026 09:54 -03 | Pista: 4 | Quantidade produzida: 275 | Quantidade reprovada: 2 | Data prevista de cura: 3 jun. 2026 09:54 -03 | Situação do relatório: Concluído
Dormentes reprovados: 2'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '2994');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-05-20', '2996', 'MALHA PAULISTA BITOLA MISTA', 'Bitola Mista', 'Cavan SP', '3', null, null, null, null, null, null, null, 'Pendente', 'Darci de Brum', null, '2996-Malha-Paulista-20-05-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 2996-Malha-Paulista-20-05-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Darci de Brum | Fornecedor: Cavan - Santa Lucia | Projeto: Malha Paulista | Tipo de dormente: Bitola Mista | USP: Sim | Tipo de ombreira: Fast Clip | Lote: 2996 | Data da fabricação: 20 mai. 2026 13:26 -03 | Pista: 3 | Quantidade produzida: 330 | Quantidade reprovada: 0 | Data prevista de cura: 3 jun. 2026 13:26 -03 | Situação do relatório: Concluído
Dormentes reprovados: 0'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '2996');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-05-20', '2997', 'MALHA PAULISTA BITOLA LARGA', 'Bitola Larga', 'Cavan SP', '2', null, null, null, null, null, null, null, 'Pendente', 'Darci de Brum', null, '2997-Malha-Paulista-20-05-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 2997-Malha-Paulista-20-05-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Darci de Brum | Fornecedor: Cavan - Santa Lucia | Projeto: Malha Paulista | Tipo de dormente: Bitola Larga | USP: Não | Tipo de ombreira: Fast Clip | Lote: 2997 | Data da fabricação: 20 mai. 2026 10:04 -03 | Pista: 2 | Quantidade produzida: 330 | Quantidade reprovada: 0 | Data prevista de cura: 3 jun. 2026 10:04 -03 | Situação do relatório: Concluído
Dormentes reprovados: 0'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '2997');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-05-21', '2999', 'MALHA PAULISTA BITOLA MISTA', 'Bitola Mista', 'Cavan SP', '1', null, null, null, null, null, null, null, 'Pendente', 'Darci de Brum', null, '2999-Malha-Paulista-21-05-2026-Cavan---Santa-Lucia (1).pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 2999-Malha-Paulista-21-05-2026-Cavan---Santa-Lucia (1).pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Darci de Brum | Fornecedor: Cavan - Santa Lucia | Projeto: Malha Paulista | Tipo de dormente: Bitola Mista | USP: Sim | Tipo de ombreira: Fast Clip | Lote: 2999 | Data da fabricação: 21/05/2026 | Pista: 1 | Quantidade produzida: 330 | Quantidade reprovada: 0 | Data prevista de cura: 04/06/2026 | Situação do relatório: Concluído
Dormentes reprovados: 0'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '2999');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-05-21', '3000', 'MALHA PAULISTA BITOLA MISTA', 'Bitola Mista', 'Cavan SP', '3', null, null, null, null, null, null, null, 'Pendente', 'Robert Chagas', null, '3000-Malhar-Paulista-21-05-2026-Cavan---Santa-Lucia (1).pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 3000-Malhar-Paulista-21-05-2026-Cavan---Santa-Lucia (1).pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Robert Chagas | Fornecedor: Cavan - Santa Lucia | Projeto: Malhar Paulista | Tipo de dormente: BT mista | USP: Sim | Tipo de ombreira: Fast Clip | Lote: 3000 | Data da fabricação: 21 mai. 2026 13:55 -03 | Pista: 3 | Quantidade produzida: 330 | Quantidade reprovada: 1 | Data prevista de cura: 4 jun. 2026 13:56 -03 | Situação do relatório: Concluído
Dormentes reprovados: 1'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '3000');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-05-22', '3004', 'MALHA PAULISTA BITOLA MISTA', 'Bitola Mista', 'Cavan SP', '3', null, null, null, null, null, null, null, 'Pendente', 'Robert Chagas', null, '3004-Malhar-Paulista-22-05-2026-Cavan---Santa-Lucia (1).pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 3004-Malhar-Paulista-22-05-2026-Cavan---Santa-Lucia (1).pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Robert Chagas | Fornecedor: Cavan - Santa Lucia | Projeto: Malhar Paulista | Tipo de dormente: BT mista | USP: Sim | Tipo de ombreira: Fast Clip | Lote: 3004 | Data da fabricação: 22 mai. 2026 11:31 -03 | Pista: 3 | Quantidade produzida: 330 | Quantidade reprovada: 1 | Data prevista de cura: 5 jun. 2026 11:31 -03 | Situação do relatório: Concluído
Dormentes reprovados: 1'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '3004');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-05-22', '3005', 'MALHA PAULISTA BITOLA LARGA', 'Bitola Larga', 'Cavan SP', '2', null, null, null, null, null, null, null, 'Pendente', 'Darci de Brum', null, '3005-Malhar-Paulista-22-05-2026-Cavan---Santa-Lucia (1).pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 3005-Malhar-Paulista-22-05-2026-Cavan---Santa-Lucia (1).pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Darci de Brum | Fornecedor: Cavan - Santa Lucia | Projeto: Malhar Paulista | Tipo de dormente: BT larga | USP: Não | Tipo de ombreira: Fast Clip | Lote: 3005 | Data da fabricação: 22 mai. 2026 13:37 -03 | Pista: 2 | Quantidade produzida: 330 | Quantidade reprovada: 1 | Data prevista de cura: 5 jun. 2026 13:37 -03
Dormentes reprovados: 1'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '3005');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-05-25', '3006', 'FERRO NORTE', 'Bitola Larga', 'Cavan SP', '4', null, null, null, null, null, null, null, 'Pendente', 'Darci de Brum', null, '3006-Ferronorte-25-05-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 3006-Ferronorte-25-05-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Darci de Brum | Fornecedor: Cavan - Santa Lucia | Projeto: Ferronorte | Tipo de dormente: Bitola Larga | USP: Não | Tipo de ombreira: E - Clip | Lote: 3006 | Data da fabricação: 25/05/2026 | Pista: 4 | Quantidade produzida: 270 | Quantidade reprovada: 0 | Data prevista de cura: 08/06/2026 | Situação do relatório: Concluído
Dormentes reprovados: 0'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '3006');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-05-25', '3007', 'MALHA PAULISTA BITOLA MISTA', 'Bitola Mista', 'Cavan SP', '1', null, null, null, null, null, null, null, 'Pendente', 'Darci de Brum', null, '3007-Malha-Paulista-25-05-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 3007-Malha-Paulista-25-05-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Darci de Brum | Fornecedor: Cavan - Santa Lucia | Projeto: Malha Paulista | Tipo de dormente: Bitola Mista | USP: Sim | Tipo de ombreira: Fast Clip | Lote: 3007 | Data da fabricação: 25/05/2026 | Pista: 1 | Quantidade produzida: 330 | Quantidade reprovada: 1 | Data prevista de cura: 08/06/2026 | Situação do relatório: Concluído
Dormentes reprovados: 1'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '3007');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-05-25', '3008', 'MALHA PAULISTA BITOLA MISTA', 'Bitola Mista', 'Cavan SP', '3', null, null, null, null, null, null, null, 'Pendente', 'Darci de Brum', null, '3008-Malha-Paulista-25-05-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 3008-Malha-Paulista-25-05-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Darci de Brum | Fornecedor: Cavan - Santa Lucia | Projeto: Malha Paulista | Tipo de dormente: Bitola Mista | USP: Sim | Tipo de ombreira: Fast Clip | Lote: 3008 | Data da fabricação: 25/05/2026 | Pista: 3 | Quantidade produzida: 330 | Quantidade reprovada: 2 | Data prevista de cura: 08/06/2026 | Situação do relatório: Concluído
Dormentes reprovados: 2'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '3008');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-05-25', '3009', 'MALHA PAULISTA BITOLA LARGA', 'Bitola Larga', 'Cavan SP', '2', null, null, null, null, null, null, null, 'Pendente', 'Darci de Brum', null, '3009-Malha-Paulista-25-05-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 3009-Malha-Paulista-25-05-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Darci de Brum | Fornecedor: Cavan - Santa Lucia | Projeto: Malha Paulista | Tipo de dormente: Bitola Larga | USP: Não | Tipo de ombreira: Fast Clip | Lote: 3009 | Data da fabricação: 25/05/2026 | Pista: 2 | Quantidade produzida: 330 | Quantidade reprovada: 1 | Data prevista de cura: 08/06/2026 | Situação do relatório: Concluído
Dormentes reprovados: 1'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '3009');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-05-26', '3011', 'MALHA PAULISTA BITOLA MISTA', 'Bitola Mista', 'Cavan SP', '1', null, null, null, null, null, null, null, 'Pendente', 'Darci de Brum', null, '3011-Malha-Paulista-26-05-2026-Cavan---Santa-Lucia (1).pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 3011-Malha-Paulista-26-05-2026-Cavan---Santa-Lucia (1).pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Darci de Brum | Fornecedor: Cavan - Santa Lucia | Projeto: Malha Paulista | Tipo de dormente: Bitola Mista | USP: Sim | Tipo de ombreira: Fast Clip | Lote: 3011 | Data da fabricação: 26/05/2026 | Pista: 1 | Quantidade produzida: 330 | Quantidade reprovada: 1 | Data prevista de cura: 09/06/2026 | Situação do relatório: Concluído
Dormentes reprovados: 1'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '3011');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-05-26', '3012', 'MALHA PAULISTA BITOLA MISTA', 'Bitola Mista', 'Cavan SP', '3', null, null, null, null, null, null, null, 'Pendente', 'Darci de Brum', null, '3012-Malha-Paulista-26-05-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 3012-Malha-Paulista-26-05-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Darci de Brum | Fornecedor: Cavan - Santa Lucia | Projeto: Malha Paulista | Tipo de dormente: Bitola Mista | USP: Sim | Tipo de ombreira: Fast Clip | Lote: 3012 | Data da fabricação: 26/05/2026 | Pista: 3 | Quantidade produzida: 330 | Quantidade reprovada: 1 | Data prevista de cura: 09/06/2026 | Situação do relatório: Concluído
Dormentes reprovados: 1'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '3012');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-05-26', '3013', 'MALHA PAULISTA BITOLA LARGA', 'Bitola Larga', 'Cavan SP', '2', null, null, null, null, null, null, null, 'Pendente', 'Darci de Brum', null, '3013-Malha-Paulista-26-05-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 3013-Malha-Paulista-26-05-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Darci de Brum | Fornecedor: Cavan - Santa Lucia | Projeto: Malha Paulista | Tipo de dormente: Bitola Larga | USP: Não | Tipo de ombreira: Fast Clip | Lote: 3013 | Data da fabricação: 26/05/2026 | Pista: 2 | Quantidade produzida: 330 | Quantidade reprovada: 4 | Data prevista de cura: 09/06/2026 | Situação do relatório: Concluído
Dormentes reprovados: 4'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '3013');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-05-27', '3015', 'MALHA PAULISTA BITOLA MISTA', 'Bitola Mista', 'Cavan SP', '1', null, null, null, null, null, null, null, 'Pendente', 'Darci de Brum', null, '3015-Malha-Paulista-27-05-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 3015-Malha-Paulista-27-05-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Darci de Brum | Fornecedor: Cavan - Santa Lucia | Projeto: Malha Paulista | Tipo de dormente: Bitola Mista | USP: Sim | Tipo de ombreira: Fast Clip | Lote: 3015 | Data da fabricação: 27/05/2026 | Pista: 1 | Quantidade produzida: 330 | Quantidade reprovada: 6 | Data prevista de cura: 10/06/2026 | Situação do relatório: Concluído
Dormentes reprovados: 6'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '3015');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-05-27', '3016', 'MALHA PAULISTA BITOLA MISTA', 'Bitola Mista', 'Cavan SP', '3', null, null, null, null, null, null, null, 'Pendente', 'Darci de Brum', null, '3016-Malha-Paulista-27-05-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 3016-Malha-Paulista-27-05-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Darci de Brum | Fornecedor: Cavan - Santa Lucia | Projeto: Malha Paulista | Tipo de dormente: Bitola Mista | USP: Sim | Tipo de ombreira: Fast Clip | Lote: 3016 | Data da fabricação: 27/05/2026 | Pista: 3 | Quantidade produzida: 330 | Quantidade reprovada: 3 | Data prevista de cura: 10/06/2026 | Situação do relatório: Concluído
Dormentes reprovados: 3'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '3016');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-05-28', '3018', 'MALHA PAULISTA BITOLA MISTA', 'Bitola Mista', 'Cavan SP', '1', null, null, null, null, null, null, null, 'Pendente', 'Darci de Brum', null, '3018-Malha-Paulista-28-05-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 3018-Malha-Paulista-28-05-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Darci de Brum | Fornecedor: Cavan - Santa Lucia | Projeto: Malha Paulista | Tipo de dormente: Bitola Mista | USP: Sim | Tipo de ombreira: Fast Clip | Lote: 3018 | Data da fabricação: 28/05/2026 | Pista: 1 | Quantidade produzida: 330 | Quantidade reprovada: 2 | Data prevista de cura: 11/06/2026 | Situação do relatório: Concluído
Dormentes reprovados: 2'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '3018');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-05-28', '3019', 'MALHA PAULISTA BITOLA MISTA', 'Bitola Mista', 'Cavan SP', '3', null, null, null, null, null, null, null, 'Pendente', 'Darci de Brum', null, '3019-Malha-Paulista-28-05-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 3019-Malha-Paulista-28-05-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Darci de Brum | Fornecedor: Cavan - Santa Lucia | Projeto: Malha Paulista | Tipo de dormente: Bitola Mista | USP: Sim | Tipo de ombreira: Fast Clip | Lote: 3019 | Data da fabricação: 28/05/2026 | Pista: 3 | Quantidade produzida: 330 | Quantidade reprovada: 6 | Data prevista de cura: 11/06/2026 | Situação do relatório: Concluído
Dormentes reprovados: 6'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '3019');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-05-30', '3023', 'FERRO NORTE', 'Bitola Larga', 'Cavan SP', '4', null, null, null, null, null, null, null, 'Pendente', 'Erwin Klein', null, '3023-Ferro-Norte-30-05-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 3023-Ferro-Norte-30-05-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Erwin Klein | Fornecedor: Cavan - Santa Lucia | Projeto: Ferro Norte | Tipo de dormente: Bitola Larga | USP: Não | Tipo de ombreira: E - Clip | Lote: 3023 | Data da fabricação: 30 mai. 2026 10:22 -03 | Pista: 4 | Quantidade produzida: 275 | Quantidade reprovada: 0 | Data prevista de cura: 13 jun. 2026 11:06 -03 | Situação do relatório: Concluído
Dormentes reprovados: 0'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '3023');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-05-30', '3024', 'MALHA PAULISTA BITOLA MISTA', 'Bitola Mista', 'Cavan SP', '1', null, null, null, null, null, null, null, 'Pendente', 'Erwin Klein', null, '3024-Malha-Paulista-Bitola-Mista-30-05-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 3024-Malha-Paulista-Bitola-Mista-30-05-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Erwin Klein | Fornecedor: Cavan - Santa Lucia | Projeto: Malha Paulista Bitola Mista | Tipo de dormente: Bitola Mista | USP: Sim | Tipo de ombreira: Fast Clip | Lote: 3024 | Data da fabricação: 30 mai. 2026 09:40 -03 | Pista: 1 | Quantidade produzida: 330 | Quantidade reprovada: 3 | Data prevista de cura: 13 jun. 2026 09:40 -03 | Situação do relatório: Concluído
Dormentes reprovados: 3'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '3024');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-06-01', '3025', 'FERRO NORTE', 'Bitola Larga', 'Cavan SP', '4', null, null, null, null, null, null, null, 'Pendente', 'Darci de Brum', null, '3025-Ferronorte-01-06-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 3025-Ferronorte-01-06-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Darci de Brum | Fornecedor: Cavan - Santa Lucia | Projeto: Ferronorte | Tipo de dormente: Bitola Larga | USP: Não | Tipo de ombreira: E - Clip | Lote: 3025 | Data da fabricação: 01/06/2026 | Pista: 4 | Quantidade produzida: 275 | Quantidade reprovada: 1 | Data prevista de cura: 15/06/2026 | Situação do relatório: Concluído
Dormentes reprovados: 1'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '3025');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-06-01', '3026', 'MALHA PAULISTA BITOLA MISTA', 'Bitola Mista', 'Cavan SP', '1', null, null, null, null, null, null, null, 'Pendente', 'Darci de Brum', null, '3026-Malha-Paulista-01-06-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 3026-Malha-Paulista-01-06-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Darci de Brum | Fornecedor: Cavan - Santa Lucia | Projeto: Malha Paulista | Tipo de dormente: Bitola Mista | USP: Sim | Tipo de ombreira: Fast Clip | Lote: 3026 | Data da fabricação: 01/06/2026 | Pista: 1 | Quantidade produzida: 330 | Quantidade reprovada: 3 | Data prevista de cura: 15/06/2026 | Situação do relatório: Concluído
Dormentes reprovados: 3'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '3026');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-06-02', '3027', 'FERRO NORTE', 'Bitola Larga', 'Cavan SP', '4', null, null, null, null, null, null, null, 'Pendente', 'Darci de Brum', null, '3027-Ferronorte-02-06-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 3027-Ferronorte-02-06-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Darci de Brum | Fornecedor: Cavan - Santa Lucia | Projeto: Ferronorte | Tipo de dormente: Bitola Larga | USP: Não | Tipo de ombreira: E - Clip | Lote: 3027 | Data da fabricação: 02/06/2026 | Pista: 4 | Quantidade produzida: 275 | Quantidade reprovada: 0 | Data prevista de cura: 16/06/2026 | Situação do relatório: Concluído
Dormentes reprovados: 0'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '3027');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-06-02', '3028', 'MALHA PAULISTA BITOLA MISTA', 'Bitola Mista', 'Cavan SP', '3', null, null, null, null, null, null, null, 'Pendente', 'Erwin Klein', null, '3028-Malha-Paulista-Bitola-Mista-02-06-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 3028-Malha-Paulista-Bitola-Mista-02-06-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Erwin Klein | Fornecedor: Cavan - Santa Lucia | Projeto: Malha Paulista Bitola Mista | Tipo de dormente: Bitola Mista | USP: Sim | Tipo de ombreira: Fast Clip | Lote: 3028 | Data da fabricação: 2 jun. 2026 15:13 -03 | Pista: 3 | Quantidade produzida: 330 | Quantidade reprovada: 1 | Data prevista de cura: 16 jun. 2026 15:13 -03 | Situação do relatório: Concluído
Dormentes reprovados: 1'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '3028');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-06-03', '3029', 'FERRO NORTE', 'Bitola Larga', 'Cavan SP', '4', null, null, null, null, null, null, null, 'Pendente', 'Erwin Klein', null, '3029-Ferro-Norte-03-06-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 3029-Ferro-Norte-03-06-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Erwin Klein | Fornecedor: Cavan - Santa Lucia | Projeto: Ferro Norte | Tipo de dormente: Bitola Larga | USP: Não | Tipo de ombreira: E - Clip | Lote: 3029 | Data da fabricação: 3 jun. 2026 10:45 -03 | Pista: 4 | Quantidade produzida: 275 | Quantidade reprovada: 10 | Data prevista de cura: 17 jun. 2026 10:45 -03 | Situação do relatório: Concluído
Dormentes reprovados: 10'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '3029');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-06-03', '3030', 'MALHA PAULISTA BITOLA MISTA', 'Bitola Mista', 'Cavan SP', '1', null, null, null, null, null, null, null, 'Pendente', 'Erwin Klein', null, '3030-Malha-Paulista-Bitola-Mista-03-06-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 3030-Malha-Paulista-Bitola-Mista-03-06-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Erwin Klein | Fornecedor: Cavan - Santa Lucia | Projeto: Malha Paulista Bitola Mista | Tipo de dormente: Bitola Mista | USP: Sim | Tipo de ombreira: Fast Clip | Lote: 3030 | Data da fabricação: 3 jun. 2026 10:18 -03 | Pista: 1 | Quantidade produzida: 330 | Quantidade reprovada: 0 | Data prevista de cura: 17 jun. 2026 10:18 -03 | Situação do relatório: Concluído
Dormentes reprovados: 0'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '3030');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-06-08', '3031', 'MALHA PAULISTA BITOLA MISTA', 'Bitola Mista', 'Cavan SP', '3', null, null, null, null, null, null, null, 'Pendente', 'Darci de Brum', null, '3031-Malha-Paulista-08-06-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 3031-Malha-Paulista-08-06-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Darci de Brum | Fornecedor: Cavan - Santa Lucia | Projeto: Malha Paulista | Tipo de dormente: Bitola Mista | USP: Sim | Tipo de ombreira: Fast Clip | Lote: 3031 | Data da fabricação: 08/06/2026 | Pista: 3 | Quantidade produzida: 330 | Quantidade reprovada: 2 | Data prevista de cura: 22/06/2026 | Situação do relatório: Concluído
Dormentes reprovados: 2'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '3031');

insert into public.inspecoes_pista
  (data_inspecao, lote, projeto, bitola, fornecedor, pista, trecho_posicao, molde, cavidade, atividade, itens_inspecionados, nao_conformidades, acoes_corretivas, resultado, responsavel, link_relatorio, arquivo_origem, observacoes)
select '2026-06-08', '3032', 'FERRO NORTE', 'Bitola Larga', 'Cavan SP', '4', null, null, null, null, null, null, null, 'Pendente', 'Darci de Brum', null, '3032-Ferronorte-08-06-2026-Cavan---Santa-Lucia.pdf', 'Registro importado do leitor de relatórios iAuditor.
Arquivo: 3032-Ferronorte-08-06-2026-Cavan---Santa-Lucia.pdf
Tipo de relatório: Inspeção de pista | Dormente de Concreto
Metadados lidos: Tipo de relatório: Inspeção de pista | Dormente de Concreto | Responsável: Darci de Brum | Fornecedor: Cavan - Santa Lucia | Projeto: Ferronorte | Tipo de dormente: Bitola Larga | USP: Não | Tipo de ombreira: E - Clip | Lote: 3032 | Data da fabricação: 08/06/2026 | Pista: 4 | Quantidade produzida: 275 | Quantidade reprovada: 0 | Data prevista de cura: 22/06/2026 | Situação do relatório: Concluído
Dormentes reprovados: 0'
where not exists (select 1 from public.inspecoes_pista ip where ip.lote = '3032');
