<#
.SYNOPSIS
  Gera a carga SQL da página Data books a partir da planilha "Controle Databooks".

.DESCRIPTION
  Lê as abas DORMENTE MADEIRA, DORMENTE CONCRETO e OMBREIRAS e escreve um SQL que
  substitui, numa única transação, as linhas de origem 'planilha' de
  public.controle_data_books. As linhas de origem 'pasta' (arquivos da pasta
  Databook_Cavan que não estavam na planilha) não são tocadas.
  Cada linha preenchida da planilha vira um registro; as linhas vazias do fim das
  tabelas (só com o ano) são ignoradas.

  O link de cada linha é o endereço ESCRITO na célula: primeiro LINK HTTPS, depois
  LINK RELATÓRIO. Os hyperlinks "por trás" das células não são usados, porque na
  aba DORMENTE CONCRETO eles ficaram deslocados e abrem arquivos de outros data
  books. Quando LINK RELATÓRIO traz um nome de arquivo em vez de endereço, esse
  nome vira o campo data_book.

  O SQL gerado contém links internos do SharePoint e o repositório é público:
  não versionar o arquivo de saída. Aplicar a partir da raiz do repositório com
    .tools\supabase-cli\bin\supabase.exe db query --linked --file <saida.sql>

.EXAMPLE
  .\scripts\importar-controle-data-books.ps1 -Planilha "$HOME\Downloads\Controle Databooks.xlsx" -Saida "$env:TEMP\carga-data-books.sql"
#>
param(
  [Parameter(Mandatory = $true)][string]$Planilha,
  [Parameter(Mandatory = $true)][string]$Saida,
  # Nome exibido na página como origem dos dados. Padrão: nome do arquivo.
  [string]$NomeFonte
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
$NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
$NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships'
$INV = [Globalization.CultureInfo]::InvariantCulture
$MESES = @('Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro')

# Colunas esperadas em cada aba (cabeçalhos comparados sem acento, caixa e espaços extras).
$AREAS = @(
  @{ id = 'dormente_madeira'; aba = 'DORMENTE MADEIRA'; colunas = [ordered]@{
      ano = 'ANO'; mes = 'MES'; inspecionado_por = 'INSPECIONADO POR'; numero_pedido = 'NUMERO PEDIDO'
      fornecedor = 'FORNECEDOR'; link_relatorio = 'LINK RELATORIO' } },
  @{ id = 'dormente_concreto'; aba = 'DORMENTE CONCRETO'; colunas = [ordered]@{
      ano = 'ANO'; mes = 'MES'; lote = 'LOTE'; fornecedor = 'FORNECEDOR'
      link_relatorio = 'LINK RELATORIO'; link_https = 'LINK HTTPS' } },
  @{ id = 'ombreiras'; aba = 'OMBREIRAS'; colunas = [ordered]@{
      subcomponente = 'SUB-COMPONENTE'; lote = 'LOTE'; data_referencia = 'DATA'; nota_fiscal = 'NOTA FISCAL'
      certificado = 'CERTIFICADO'; quantidade = 'QUANTIDADE'; link_relatorio = 'LINK RELATORIO' } }
)

function Normalizar-Cabecalho([string]$texto) {
  $semAcento = $texto.Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}', ''
  return ($semAcento -replace '\s+', ' ').Trim().ToUpperInvariant()
}

function Ler-Xml($zip, [string]$caminho) {
  $entrada = $zip.GetEntry($caminho)
  if (-not $entrada) { return $null }
  $fluxo = $entrada.Open()
  try {
    $doc = New-Object System.Xml.XmlDocument
    $doc.PreserveWhitespace = $true
    $doc.Load($fluxo)
    return $doc
  } finally { $fluxo.Dispose() }
}

function Novo-Ns($doc) {
  $nm = New-Object System.Xml.XmlNamespaceManager($doc.NameTable)
  $nm.AddNamespace('m', $NS_MAIN)
  $nm.AddNamespace('r', $NS_REL)
  $nm.AddNamespace('p', $NS_PKG)
  # A vírgula impede o PowerShell de desenrolar o gerenciador (ele é enumerável).
  return , $nm
}

function Indice-Coluna([string]$ref) {
  $n = 0
  foreach ($ch in ($ref -replace '[0-9]', '').ToCharArray()) { $n = $n * 26 + ([int][char]$ch - 64) }
  return $n
}

# Resolve os "../" que o Excel grava quando o link é relativo à pasta da planilha
# e codifica espaços. Devolve '' quando o texto não é um endereço https.
function Resolver-Url([string]$texto) {
  $t = $texto.Trim()
  if ($t -notmatch '^(https://[^/?#\s]+)([^?#]*)(.*)$') { return '' }
  $origem = $Matches[1]; $caminho = $Matches[2]; $resto = $Matches[3]
  $partes = New-Object System.Collections.Generic.List[string]
  foreach ($seg in $caminho.Split('/')) {
    if ($seg -eq '..') { if ($partes.Count) { $partes.RemoveAt($partes.Count - 1) } }
    elseif ($seg -ne '' -and $seg -ne '.') { $partes.Add($seg) }
  }
  $barraFinal = if ($caminho.EndsWith('/') -and $partes.Count) { '/' } else { '' }
  return ($origem + '/' + ($partes -join '/') + $barraFinal + $resto) -replace ' ', '%20'
}

function Sql([object]$valor) {
  if ($null -eq $valor -or ($valor -is [string] -and $valor -eq '')) { return 'null' }
  if ($valor -is [int] -or $valor -is [long]) { return $valor.ToString($INV) }
  if ($valor -is [double] -or $valor -is [decimal]) { return $valor.ToString('0.##########', $INV) }
  return "'" + ([string]$valor).Replace("'", "''") + "'"
}

$caminhoPlanilha = (Resolve-Path -LiteralPath $Planilha).Path
if (-not $NomeFonte) { $NomeFonte = [IO.Path]::GetFileName($caminhoPlanilha) }
$sha256 = (Get-FileHash -LiteralPath $caminhoPlanilha -Algorithm SHA256).Hash.ToLowerInvariant()
$zip = [IO.Compression.ZipFile]::OpenRead($caminhoPlanilha)

try {
  # ---------- textos compartilhados ----------
  $compartilhados = New-Object System.Collections.Generic.List[string]
  $ss = Ler-Xml $zip 'xl/sharedStrings.xml'
  if ($ss) {
    $nmS = Novo-Ns $ss
    foreach ($si in $ss.SelectNodes('/m:sst/m:si', $nmS)) {
      # <t> direto ou runs <r><t>; <rPh> (fonético) fica de fora.
      $compartilhados.Add((($si.SelectNodes('m:t | m:r/m:t', $nmS) | ForEach-Object { $_.InnerText }) -join ''))
    }
  }

  # ---------- estilos: formato numérico de cada célula ----------
  $estilos = Ler-Xml $zip 'xl/styles.xml'
  $nmE = Novo-Ns $estilos
  $formatos = @{}
  foreach ($f in $estilos.SelectNodes('/m:styleSheet/m:numFmts/m:numFmt', $nmE)) { $formatos[[int]$f.numFmtId] = $f.formatCode }
  $xfs = New-Object System.Collections.Generic.List[object]
  foreach ($xf in $estilos.SelectNodes('/m:styleSheet/m:cellXfs/m:xf', $nmE)) {
    $id = [int]$xf.numFmtId
    $ehData = ($id -ge 14 -and $id -le 22) -or ($id -ge 27 -and $id -le 36) -or ($id -ge 45 -and $id -le 47) -or ($id -ge 50 -and $id -le 58)
    $casas = $null
    if ($id -eq 1 -or $id -eq 3) { $casas = 0 } elseif ($id -eq 2 -or $id -eq 4) { $casas = 2 }
    if ($formatos.ContainsKey($id)) {
      $codigo = $formatos[$id] -replace '"[^"]*"', '' -replace '\[[^\]]*\]', ''
      if ($codigo -match '[dDyY]' -or ($codigo -match 'm' -and $codigo -match '[hs]')) { $ehData = $true }
      elseif ($codigo -match '^[#,]*0(\.(0+))?$') { $casas = if ($Matches[2]) { $Matches[2].Length } else { 0 } }
    }
    $xfs.Add(@{ data = $ehData; casas = $casas })
  }

  # ---------- abas ----------
  $wb = Ler-Xml $zip 'xl/workbook.xml'
  $nmW = Novo-Ns $wb
  $wbRels = Ler-Xml $zip 'xl/_rels/workbook.xml.rels'
  $nmWR = Novo-Ns $wbRels
  $abas = @{}
  foreach ($s in $wb.SelectNodes('/m:workbook/m:sheets/m:sheet', $nmW)) {
    $rid = $s.GetAttribute('id', $NS_REL)
    $alvo = $wbRels.SelectSingleNode("/p:Relationships/p:Relationship[@Id='$rid']", $nmWR).GetAttribute('Target')
    $abas[(Normalizar-Cabecalho $s.GetAttribute('name'))] = if ($alvo.StartsWith('/')) { $alvo.TrimStart('/') } else { 'xl/' + $alvo }
  }

  $registros = New-Object System.Collections.Generic.List[object]
  $avisos = New-Object System.Collections.Generic.List[string]
  $resumo = [ordered]@{}

  foreach ($area in $AREAS) {
    $chaveAba = Normalizar-Cabecalho $area.aba
    if (-not $abas.ContainsKey($chaveAba)) { throw "A planilha não tem a aba '$($area.aba)'." }
    $caminhoAba = $abas[$chaveAba]
    $xml = Ler-Xml $zip $caminhoAba
    $nmX = Novo-Ns $xml

    # hyperlinks só para avisar sobre células com link e sem endereço escrito
    $comHyperlink = @{}
    foreach ($h in $xml.SelectNodes('/m:worksheet/m:hyperlinks/m:hyperlink', $nmX)) {
      $ref = $h.GetAttribute('ref')
      if ($ref -match '^([A-Z]+)(\d+):([A-Z]+)(\d+)$') {
        $c1 = Indice-Coluna $Matches[1]; $l1 = [int]$Matches[2]; $c2 = Indice-Coluna $Matches[3]; $l2 = [int]$Matches[4]
        for ($ln = $l1; $ln -le $l2; $ln++) { for ($cn = $c1; $cn -le $c2; $cn++) { $comHyperlink["$cn|$ln"] = $true } }
      } elseif ($ref -match '^([A-Z]+)(\d+)$') {
        $comHyperlink["$(Indice-Coluna $Matches[1])|$($Matches[2])"] = $true
      }
    }

    $linhas = New-Object System.Collections.Generic.List[object]
    foreach ($row in $xml.SelectNodes('/m:worksheet/m:sheetData/m:row', $nmX)) {
      $celulas = @{}
      $numeroLinha = [int]$row.GetAttribute('r')
      foreach ($c in $row.SelectNodes('m:c', $nmX)) {
        $ref = $c.GetAttribute('r')
        $coluna = Indice-Coluna $ref
        $tipo = $c.GetAttribute('t')
        $s = $c.GetAttribute('s')
        $xf = if ($s) { $xfs[[int]$s] } else { $xfs[0] }
        $v = $c.SelectSingleNode('m:v', $nmX)
        $bruto = if ($v) { $v.InnerText } else { $null }
        $cel = @{ ref = $ref; texto = ''; numero = $null; data = $null; hyperlink = $comHyperlink.ContainsKey("$coluna|$numeroLinha") }
        switch ($tipo) {
          's' { $cel.texto = $compartilhados[[int]$bruto] }
          'str' { if ($null -ne $bruto) { $cel.texto = $bruto } }
          'inlineStr' { $cel.texto = (($c.SelectNodes('m:is//m:t', $nmX) | ForEach-Object { $_.InnerText }) -join '') }
          'b' { $cel.texto = if ($bruto -eq '1') { 'VERDADEIRO' } else { 'FALSO' } }
          'e' { $cel.texto = ''; $cel.erro = $bruto }
          default {
            if ($null -ne $bruto -and $bruto -ne '') {
              $n = [double]::Parse($bruto, $INV)
              $cel.numero = $n
              if ($xf.data) {
                $cel.data = [DateTime]::FromOADate($n).ToString('yyyy-MM-dd', $INV)
                $cel.texto = $cel.data
              } elseif ($null -ne $xf.casas) {
                $cel.texto = [Math]::Round($n, [int]$xf.casas, [MidpointRounding]::AwayFromZero).ToString('F' + $xf.casas, $INV)
              } elseif ($n -eq [Math]::Floor($n) -and [Math]::Abs($n) -lt 1e15) {
                $cel.texto = ([decimal]$n).ToString('0', $INV)
              } else {
                $cel.texto = $n.ToString('0.##########', $INV)
              }
            }
          }
        }
        $cel.texto = ([string]$cel.texto).Trim()
        $celulas[$coluna] = $cel
      }
      $linhas.Add(@{ numero = $numeroLinha; celulas = $celulas })
    }

    # localiza o cabeçalho nas primeiras linhas
    $mapa = $null; $linhaCabecalho = 0
    foreach ($l in ($linhas | Select-Object -First 10)) {
      $nomes = @{}
      foreach ($k in $l.celulas.Keys) { $nomes[(Normalizar-Cabecalho $l.celulas[$k].texto)] = $k }
      $faltando = @($area.colunas.Values | Where-Object { -not $nomes.ContainsKey($_) })
      if (-not $faltando.Count) {
        $mapa = @{}
        foreach ($campo in $area.colunas.Keys) { $mapa[$campo] = $nomes[$area.colunas[$campo]] }
        $linhaCabecalho = $l.numero
        break
      }
    }
    if (-not $mapa) { throw "Aba '$($area.aba)': cabeçalho não encontrado. Esperado: $($area.colunas.Values -join ', ')." }

    $contagem = @{ registros = 0; comLink = 0; ignoradas = 0 }
    foreach ($l in $linhas) {
      if ($l.numero -le $linhaCabecalho) { continue }
      $cel = @{}
      foreach ($campo in $mapa.Keys) {
        $valor = $l.celulas[$mapa[$campo]]
        $cel[$campo] = if ($valor) { $valor } else { @{ texto = ''; numero = $null; data = $null; hyperlink = $false } }
      }
      $preenchidos = @($cel.Keys | Where-Object { $_ -ne 'ano' -and $cel[$_].texto -ne '' })
      if (-not $preenchidos.Count) { $contagem.ignoradas++; continue }

      $reg = [ordered]@{
        area = $area.id; ano = $null; mes = $null; fornecedor = $null; inspecionado_por = $null; numero_pedido = $null
        lote = $null; subcomponente = $null; data_referencia = $null; nota_fiscal = $null; certificado = $null
        quantidade = $null; data_book = $null; link = $null; fonte_aba = $area.aba; fonte_linha = $l.numero
      }
      foreach ($campo in @('mes', 'fornecedor', 'inspecionado_por', 'numero_pedido', 'lote', 'subcomponente', 'nota_fiscal', 'certificado')) {
        if ($cel.ContainsKey($campo) -and $cel[$campo].texto -ne '') { $reg[$campo] = $cel[$campo].texto }
      }
      if ($cel.ContainsKey('ano')) {
        $a = $cel.ano
        if ($null -ne $a.numero -and $a.numero -ge 1990 -and $a.numero -le 2100 -and $a.numero -eq [Math]::Floor($a.numero)) { $reg.ano = [int]$a.numero }
        elseif ($a.texto -match '^\d{4}$') { $reg.ano = [int]$a.texto }
        else { $avisos.Add("$($area.aba) linha $($l.numero): ano inválido '$($a.texto)'.") }
      }
      if ($reg.mes -and $MESES -notcontains $reg.mes) { $avisos.Add("$($area.aba) linha $($l.numero): mês fora da lista '$($reg.mes)'.") }
      if ($cel.ContainsKey('data_referencia')) {
        $d = $cel.data_referencia
        if ($d.data) { $reg.data_referencia = $d.data }
        elseif ($d.texto -ne '') {
          $data = [DateTime]::MinValue
          if ([DateTime]::TryParseExact($d.texto, @('dd/MM/yyyy', 'd/M/yyyy', 'yyyy-MM-dd'), $INV, 'None', [ref]$data)) { $reg.data_referencia = $data.ToString('yyyy-MM-dd', $INV) }
          else { $avisos.Add("$($area.aba) linha $($l.numero): data não reconhecida '$($d.texto)'.") }
        }
      }
      if ($cel.ContainsKey('quantidade')) {
        $q = $cel.quantidade
        if ($null -ne $q.numero) { $reg.quantidade = [double]$q.numero }
        elseif ($q.texto -ne '') { $avisos.Add("$($area.aba) linha $($l.numero): quantidade não numérica '$($q.texto)'.") }
      }

      $textoRelatorio = $cel.link_relatorio.texto
      $candidatos = @()
      if ($cel.ContainsKey('link_https')) { $candidatos += $cel.link_https }
      $candidatos += $cel.link_relatorio
      foreach ($candidato in $candidatos) {
        $url = Resolver-Url $candidato.texto
        if ($url) { $reg.link = $url; break }
      }
      if ($textoRelatorio -ne '' -and -not (Resolver-Url $textoRelatorio)) { $reg.data_book = $textoRelatorio }
      foreach ($candidato in $candidatos) {
        if ($candidato.texto -ne '' -and -not (Resolver-Url $candidato.texto) -and $candidato -ne $cel.link_relatorio) {
          $avisos.Add("$($area.aba) linha $($l.numero): '$($candidato.texto)' não é um endereço https.")
        }
      }
      if (-not $reg.link -and @($candidatos | Where-Object { $_.hyperlink }).Count) {
        $avisos.Add("$($area.aba) linha $($l.numero): célula com hyperlink, mas sem endereço escrito; ficou sem link.")
      }
      if ($reg.link -and $reg.link -notmatch '^https://[a-z0-9-]+\.sharepoint\.com/') {
        $avisos.Add("$($area.aba) linha $($l.numero): link fora do SharePoint '$($reg.link)'.")
      }

      $registros.Add($reg)
      $contagem.registros++
      if ($reg.link) { $contagem.comLink++ }
    }
    $resumo[$area.id] = $contagem
  }

  # ---------- SQL ----------
  $colunas = @('area', 'ano', 'mes', 'fornecedor', 'inspecionado_por', 'numero_pedido', 'lote', 'subcomponente', 'data_referencia',
    'nota_fiscal', 'certificado', 'quantidade', 'data_book', 'link', 'fonte_aba', 'fonte_linha')
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine('-- Carga da página Data books (public.controle_data_books).')
  [void]$sb.AppendLine("-- Gerada por scripts/importar-controle-data-books.ps1 em $((Get-Date).ToString('yyyy-MM-dd HH:mm', $INV)).")
  [void]$sb.AppendLine("-- Fonte: $NomeFonte (SHA-256 $sha256).")
  [void]$sb.AppendLine('-- Contém links internos do SharePoint: não versionar.')
  [void]$sb.AppendLine('begin;')
  [void]$sb.AppendLine("delete from public.controle_data_books where origem = 'planilha';")
  [void]$sb.AppendLine("insert into public.controle_data_books ($($colunas -join ', '), fonte_arquivo, fonte_sha256) values")
  $fonte = "$(Sql $NomeFonte), $(Sql $sha256)"
  for ($i = 0; $i -lt $registros.Count; $i++) {
    $r = $registros[$i]
    $valores = ($colunas | ForEach-Object { Sql $r[$_] }) -join ', '
    $fim = if ($i -lt $registros.Count - 1) { ',' } else { ';' }
    [void]$sb.AppendLine("($valores, $fonte)$fim")
  }
  # Confere o que entrou antes de confirmar: se algo divergir, nada é gravado.
  [void]$sb.AppendLine('do $conferencia$')
  [void]$sb.AppendLine('begin')
  foreach ($id in $resumo.Keys) {
    $esperado = $resumo[$id]
    [void]$sb.AppendLine("  if (select count(*) from public.controle_data_books where origem = 'planilha' and area = '$id') <> $($esperado.registros)")
    [void]$sb.AppendLine("     or (select count(*) from public.controle_data_books where origem = 'planilha' and area = '$id' and link is not null) <> $($esperado.comLink) then")
    [void]$sb.AppendLine("    raise exception 'Carga de $id divergente do arquivo.';")
    [void]$sb.AppendLine('  end if;')
  }
  [void]$sb.AppendLine('end $conferencia$;')
  [void]$sb.AppendLine('commit;')
  [IO.File]::WriteAllText($Saida, $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))
} finally {
  $zip.Dispose()
}

Write-Host "Fonte: $NomeFonte"
Write-Host "SHA-256: $sha256"
foreach ($id in $resumo.Keys) {
  Write-Host ("{0}: {1} registros, {2} com link, {3} linhas vazias ignoradas" -f $id, $resumo[$id].registros, $resumo[$id].comLink, $resumo[$id].ignoradas)
}
if ($avisos.Count) {
  Write-Host "Avisos ($($avisos.Count)):" -ForegroundColor Yellow
  $avisos | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
}
Write-Host "SQL gerado em: $Saida"
