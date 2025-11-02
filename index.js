const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const passport = require('passport');
require('dotenv').config();

const app = express();

// Configuración CORS para producción
app.use(cors({
  origin: [
    'https://milogino.netlify.app', // Tu dominio de Netlify
    'http://localhost:3000',      // Desarrollo local
    'http://localhost:5173'       // Vite development
  ],
  credentials: true
}));

app.use(express.json());
app.use(passport.initialize());

// Importar rutas
const authRoutes = require('.src/routes/authRoutes');
app.use('/api/auth', authRoutes);

// Conexión a MongoDB
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ Conectado a MongoDB Atlas');
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Error al conectar a MongoDB:', err);
  });

app.get('/', (req, res) => {
  res.send('¡Mi API de autenticación está en línea!');
});