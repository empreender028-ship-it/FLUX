require("dotenv").config();
const mongoose = require("mongoose");

mongoose.connect(process.env.MONGO_URI).then(async()=>{
  const db = mongoose.connection.db;
  const posts = await db.collection("posts").find({}).toArray();

  let atualizados = 0;

  for(const p of posts){
    const likedBy = Array.isArray(p.likedBy)
      ? [...new Set(p.likedBy.filter(Boolean).map(String))]
      : [];

    await db.collection("posts").updateOne(
      {_id:p._id},
      {$set:{
        likedBy,
        likes:likedBy.length
      }}
    );

    atualizados++;
  }

  console.log("LIKES REAIS RECALCULADOS:", atualizados);
  process.exit();
});
