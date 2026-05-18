const fs = require("fs");
let s = fs.readFileSync("public/empresa.html","utf8");

s = s.replaceAll("const baseViews = 42800;", "const baseViews = 0;");
s = s.replaceAll("compact(baseViews)", "compact(0)");

fs.writeFileSync("public/empresa.html",s,"utf8");
console.log("VIEWS 42.8K REMOVIDO FORCADO.");
