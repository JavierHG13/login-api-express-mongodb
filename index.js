import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import passport from 'passport';
import dotenv from 'dotenv';
import './src/utils/passport-google-strategy.js'
import authRoutes from './src/routes/authRoutes.js';

dotenv.config();

const app = express();

// Configuración CORS para producción
app.use(cors({
  origin: [
    'https://air-design.netlify.app', // Tu dominio de Netlify
    'http://localhost:3000',        // Desarrollo local
    'http://localhost:5173'         // Vite development
  ],
  credentials: true
}));

app.use(express.json());
app.use(passport.initialize());

// Rutas
app.use('/api/auth', authRoutes);

// Conexión a MongoDB
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || '';

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

// Ruta raíz
app.get('/', (req, res) => {
  res.send('¡Mi API de autenticación está en línea!');
});
