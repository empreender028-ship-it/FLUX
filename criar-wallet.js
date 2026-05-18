require("dotenv").config();
const mongoose = require("mongoose");

async function main(){
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  await db.collection("wallets").updateOne(
    { userId: "6a0a683d51bef6c9701e0e47" },
    {
      $set: {
        userId: "6a0a683d51bef6c9701e0e47",
        saldoDisponivel: 100,
        saldoPendente: 0,
        totalRecebido: 100,
        totalGasto: 0,
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    },
    { upsert: true }
  );

  const wallet = await db.collection("wallets").findOne({
    userId: "6a0a683d51bef6c9701e0e47"
  });

  console.log(wallet);
  process.exit();
}

main();
