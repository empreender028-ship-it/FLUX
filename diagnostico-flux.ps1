Write-Host "===== DIAGNOSTICO FLUX AFILIADOS =====" -ForegroundColor Cyan

="https://flux-beta-production.up.railway.app"

function Test-URL(,,){
 try{
   = Invoke-WebRequest  -UseBasicParsing -TimeoutSec 20
   = .Content -match 
  if(){
   Write-Host "OK  - " -ForegroundColor Green
  }else{
   Write-Host "ERRO -  abriu, mas nao achou: " -ForegroundColor Yellow
  }
 }catch{
  Write-Host "FALHOU -  => " -ForegroundColor Red
 }
}

Test-URL "VERSAO FLUX" "/versao-flux" "ok"
Test-URL "MARKETPLACE" "/marketplace2.html?t=diag" "FLUX"
Test-URL "PRODUTO AFILIADO" "/flux-produto.html?id=MLB6778297770&t=diag" "Produto"
Test-URL "CHECKOUT AFILIADO" "/checkout-afiliado.html?id=MLB6778297770&t=diag" "Checkout"
Test-URL "API PRODUTO REAL" "/api/ml/item/MLB6778297770" "produto"
Test-URL "API FRETE REAL" "/api/ml/frete/MLB6778297770?cep=15400000" "ok"
Test-URL "API 50 PERFIS" "/api/afiliados/perfis?limit=50" "perfis"
Test-URL "PAGINA AFILIADOS" "/afiliados.html?t=diag" "Perfis"

Write-Host "===== FIM DO DIAGNOSTICO =====" -ForegroundColor Cyan
