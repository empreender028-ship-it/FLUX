const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema({

  usuario: {
    type: String,
    required: true
  },

  fotoPerfil: {
    type: String,
    default: ""
  },

  texto: {
    type: String,
    default: ""
  },

  imagem: {
    type: String,
    default: ""
  },

  video: {
    type: String,
    default: ""
  },

  likes: {
    type: Number,
    default: 0
  },

  comentarios: [
    {
      usuario: String,
      texto: String,
      criadoEm: {
        type: Date,
        default: Date.now
      }
    }
  ],

  compartilhamentos: {
    type: Number,
    default: 0
  },

  visualizacoes: {
    type: Number,
    default: 0
  },

  destaque: {
    type: Boolean,
    default: false
  },

  criadoEm: {
    type: Date,
    default: Date.now
  }

});

module.exports = mongoose.model("Post", PostSchema);