require("dotenv").config();
const mongoose = require("mongoose");

async function main(){
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const posts = await db.collection("posts")
    .find({ produtoId: { $exists: true } })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  console.log(posts.map(p => ({
    descricao: p.descricao,
    produtoNome: p.produtoNome,
    produtoPreco: p.produtoPreco,
    produtoLink: p.produtoLink
  })));

  process.exit();
}

main();
