param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"

function Get-DaxBlock {
    param([string]$Text, [string]$Name, [string]$NextMarker)
    $pattern = "VAR $Name\s*=\s*`"(?<value>[\s\S]*?)`"\s*$NextMarker"
    $match = [regex]::Match($Text, $pattern)
    if (-not $match.Success) {
        throw "Bloco $Name nao encontrado."
    }
    return $match.Groups["value"].Value
}

function Build-Demo {
    param([string]$Source, [string]$Output, [string]$PeerHref, [string]$PeerLabel)
    $dax = Get-Content -LiteralPath $Source -Raw -Encoding UTF8
    $css = Get-DaxBlock $dax "Css" "// --------------------------------------------------------------------------\s*// Estrutura"
    $html = Get-DaxBlock $dax "HtmlBase" "// --------------------------------------------------------------------------\s*// JavaScript"
    $scriptMatch = [regex]::Match($dax, 'VAR Script\s*=\s*"(?<before>[\s\S]*?const D=)"\s*&\s*JsonDados\s*&\s*"(?<after>;[\s\S]*?</script>)"\s*RETURN')
    if (-not $scriptMatch.Success) {
        throw "Bloco Script nao encontrado em $Source."
    }
    $script = $scriptMatch.Groups["before"].Value + "window.DEMO_DATA" + $scriptMatch.Groups["after"].Value
    $peer = "<a class='demoPeer' href='$PeerHref'>$PeerLabel</a>"
    $html = $html.Replace("<nav class='nav'>", "<nav class='nav'>$peer")
    $extraCss = @"
<style>
.demoPeer{display:block;margin:2px 11px 10px;padding:9px 10px;border:1px solid #6f5b00;border-radius:4px;color:#ffda3a;text-decoration:none;font-size:11px;font-weight:800;text-align:center}.demoPeer:hover{background:#38320e}.demoFlag{position:fixed;right:18px;bottom:14px;z-index:60;padding:6px 9px;border:1px solid #6f5b00;border-radius:4px;background:#211f16;color:#ffda3a;font-size:10px;font-weight:800;box-shadow:0 6px 18px rgba(0,0,0,.3)}
@media(max-width:820px){.demoPeer{font-size:0;padding:9px 4px}.demoPeer:after{content:'\21C4';font-size:16px}}
</style>
"@
    $document = "<!doctype html>`n$css`n$extraCss`n$html`n<script src='demo-data.js'></script>`n$script`n<div class='demoFlag'>DADOS SINTETICOS</div>"
    Set-Content -LiteralPath $Output -Value $document -Encoding UTF8
}

$sourceDir = Join-Path $ProjectRoot "src\powerbi"
Build-Demo (Join-Path $sourceDir "04_HTML_PRODUCAO_OTIMIZADO.dax") (Join-Path $PSScriptRoot "dashboard_demo.html") "analise_critica.html" "ABRIR ANALISE CRITICA"
Build-Demo (Join-Path $sourceDir "04_HTML_ANALISE_CRITICA_TESTE.dax") (Join-Path $PSScriptRoot "analise_critica.html") "dashboard_demo.html" "ABRIR PRODUCAO"

Write-Host "Demonstracoes geradas a partir dos HTMLs reais."
