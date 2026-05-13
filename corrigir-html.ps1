$files = Get-ChildItem public -Filter *.html -Recurse

foreach($f in $files){

$c = Get-Content $f.FullName -Raw

$c = $c.Replace("Ã¡","á")
$c = $c.Replace("Ã©","é")
$c = $c.Replace("Ã­","í")
$c = $c.Replace("Ã³","ó")
$c = $c.Replace("Ãº","ú")
$c = $c.Replace("Ã£","ã")
$c = $c.Replace("Ãµ","õ")
$c = $c.Replace("Ã§","ç")
$c = $c.Replace("Ãª","ê")
$c = $c.Replace("Ã´","ô")
$c = $c.Replace("Â","")

Set-Content $f.FullName $c -Encoding UTF8

}

Write-Host "HTML LIMPOS"
