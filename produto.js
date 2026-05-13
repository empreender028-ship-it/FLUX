const mongoose = require("mongoose");

const ProdutoSchema = new mongoose.Schema({

  nome: {
    type: String,
    required: true
  },

  descricao: {
    type: String,
    default: ""
  },

  preco: {
    type: Number,
    required: true
  },

  precoPromocional: {
    type: Number,
    default: 0
  },

  estoque: {
    type: Number,
    default: 0
  },

  categoria: {
    type: String,
    default: "geral"
  },

  imagem: {
    type: String,
    default: ""
  },

  video: {
    type: String,
    default: ""
  },

  tamanhos: {
    type: [String],
    default: []
  },

  cores: {
    type: [String],
    default: []
  },

  vendido: {
    type: Number,
    default: 0
  },

  destaque: {
    type: Boolean,
    default: false
  },

  ativo: {
    type: Boolean,
    default: true
  },

  criadoEm: {
    type: Date,
    default: Date.now
  }

});

module.exports = mongoose.model("Produto", ProdutoSchema);

