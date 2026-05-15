Write-Host ""
Write-Host "========== FLUX DIAGNOSTICO GERAL ==========" -ForegroundColor Cyan

function CheckFile(public\marketplace.html){
 if(Test-Path public\marketplace.html){
   Write-Host "OK ARQUIVO -> public\marketplace.html" -ForegroundColor Green
 }else{
   Write-Host "FALTANDO ARQUIVO -> public\marketplace.html" -ForegroundColor Red
 }
}

function CheckText(,){
 if(Test-Path ){
    = Get-Content  -Raw
   if( -match [regex]::Escape()){
      Write-Host "OK TEXTO ->  em " -ForegroundColor Green
   }else{
      Write-Host "FALTANDO TEXTO ->  em " -ForegroundColor Yellow
   }
 }
}

Write-Host ""
Write-Host "===== HTMLS =====" -ForegroundColor Cyan

CheckFile "public\marketplace.html"
CheckFile "public\marketplace2.html"
CheckFile "public\flux-produto.html"
CheckFile "public\checkout-afiliado.html"
CheckFile "public\perfil-afiliado.html"
CheckFile "public\afiliados.html"
CheckFile "public\empresa.html"
CheckFile "public\feed.html"

Write-Host ""
Write-Host "===== SERVER =====" -ForegroundColor Cyan

CheckFile "server.js"

CheckText "server.js" "/api/ml/produtos"
CheckText "server.js" "/api/ml/item/"
CheckText "server.js" "/api/ml/frete/"
CheckText "server.js" "/api/afiliados/perfis"
CheckText "server.js" "/api/afiliados/perfil/"
CheckText "server.js" "/checkout-afiliado"
CheckText "server.js" "/perfil-afiliado"
CheckText "server.js" "express.static"
CheckText "server.js" "Mongo conectado"

Write-Host ""
Write-Host "===== MARKETPLACE =====" -ForegroundColor Cyan

CheckText "public\marketplace2.html" "openFluxProduct"
CheckText "public\marketplace2.html" "/flux-produto.html"
CheckText "public\marketplace2.html" "marketplace"
CheckText "public\marketplace2.html" "ownerId"
CheckText "public\marketplace2.html" "profile-btn"

Write-Host ""
Write-Host "===== PRODUTO =====" -ForegroundColor Cyan

CheckText "public\flux-produto.html" "checkout-afiliado"
CheckText "public\flux-produto.html" "Comprar"
CheckText "public\flux-produto.html" "/go/ml/"
CheckText "public\flux-produto.html" "fetch"

Write-Host ""
Write-Host "===== CHECKOUT =====" -ForegroundColor Cyan

CheckText "public\checkout-afiliado.html" "Calcular frete"
CheckText "public\checkout-afiliado.html" "Finalizar compra segura"
CheckText "public\checkout-afiliado.html" "/api/ml/frete/"
CheckText "public\checkout-afiliado.html" "/go/ml/"
CheckText "public\checkout-afiliado.html" "Pix"

Write-Host ""
Write-Host "===== PERFIS =====" -ForegroundColor Cyan

CheckText "public\perfil-afiliado.html" "Produtos"
CheckText "public\perfil-afiliado.html" "posts"
CheckText "public\perfil-afiliado.html" "Comprar"

CheckText "public\afiliados.html" "Perfis"
CheckText "public\afiliados.html" "Ver perfil"

Write-Host ""
Write-Host "===== GIT =====" -ForegroundColor Cyan

git status

Write-Host ""
Write-Host "===== ULTIMO COMMIT =====" -ForegroundColor Cyan

git log --oneline -5

Write-Host ""
Write-Host "===== ROTAS ONLINE =====" -ForegroundColor Cyan

try{
  = Invoke-WebRequest "https://flux-beta-production.up.railway.app/versao-flux" -UseBasicParsing
 Write-Host "ONLINE OK -> versao-flux" -ForegroundColor Green
}catch{
 Write-Host "ONLINE ERRO -> versao-flux" -ForegroundColor Red
}

Write-Host ""
Write-Host "===== FINAL =====" -ForegroundColor Cyan
Write-Host "SE EXISTIR MUITO FALTANDO => PRECISA CRIAR"
Write-Host "SE EXISTIR ERRO => PRECISA CORRIGIR"
Write-Host "SE ESTIVER OK => PRONTO PARA 50 PERFIS"

