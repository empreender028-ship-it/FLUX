const mongoose = require("mongoose");

const EmpresaSchema = new mongoose.Schema({

  nome: {
    type: String,
    required: true
  },

  email: {
    type: String,
    required: true,
    unique: true
  },

  senha: {
    type: String,
    required: true
  },

  plano: {
    type: String,
    default: "gratuito"
  },

  logo: {
    type: String,
    default: ""
  },

  capa: {
    type: String,
    default: ""
  },

  descricao: {
    type: String,
    default: ""
  },

  whatsapp: {
    type: String,
    default: ""
  },

  instagram: {
    type: String,
    default: ""
  },

  site: {
    type: String,
    default: ""
  },

  estoque: {
    type: Number,
    default: 0
  },

  vendas: {
    type: Number,
    default: 0
  },

  marketplaceAtivo: {
    type: Boolean,
    default: true
  },

  premium: {
    type: Boolean,
    default: false
  },

  criadoEm: {
    type: Date,
    default: Date.now
  }

});

module.exports = mongoose.model("Empresa", EmpresaSchema);