const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  nombre: {
    type: String,
    required: true
  },
  correo: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  telefono: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: function() { return !this.googleId; }
  },
  googleId: {
    type: String
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  codigoVerificacion: {
    type: String,
    default: null
  },
  codigoExpiracion: {
    type: Date,
    default: null
  },
  
  // --- NUEVOS CAMPOS ---
  preguntaSecreta: {
    type: String,
    required: true // La hacemos obligatoria en el registro
  },
  respuestaSecretaCifrada: { // Nunca guardamos la respuesta en texto plano
    type: String,
    required: true
  }
  // ---------------------

}, {
  timestamps: true 
});

module.exports = mongoose.model('User', userSchema);