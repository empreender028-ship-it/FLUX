const fs = require("fs");

let s = fs.readFileSync("server.js","utf8");

if(!s.includes("express-rate-limit")){

s = s.replace(
`const multer = require("multer");`,
`const multer = require("multer");
const rateLimit = require("express-rate-limit");`
);

s = s.replace(
`const app = express();`,
`const app = express();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 400,
  standardHeaders:true,
  legacyHeaders:false,
  message:{
    erro:"muitas_requisicoes"
  }
});

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders:true,
  legacyHeaders:false,
  message:{
    erro:"muitas_tentativas"
  }
});

app.use("/api/", apiLimiter);
app.use("/api/login", authLimiter);
app.use("/api/register", authLimiter);`
);

}

fs.writeFileSync("server.js",s,"utf8");

console.log("RATE LIMIT APLICADO.");
