import express from 'express';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { enviarCodigoDeVerificacion } from '../services/notificationService.js';

const router = express.Router();

// --- RUTA: POST /api/auth/register ---
router.post('/register', async (req, res) => {
  try {
    const { nombre, telefono, password, preguntaSecreta, respuestaSecreta } = req.body;
    
    // Convertimos el email a minúsculas al recibirlo
    const correo = req.body.correo.toLowerCase();

    if (!nombre || !correo || !telefono || !password || !preguntaSecreta || !respuestaSecreta) {
      return res.status(400).json({ msg: 'Por favor, ingresa todos los campos.' });
    }

    const userExistente = await User.findOne({ correo });
    if (userExistente) {
      return res.status(400).json({ msg: 'El correo ya está registrado.' });
    }

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expiracion = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const hashedAnswer = await bcrypt.hash(respuestaSecreta, salt);

    const newUser = new User({
      nombre,
      correo,
      telefono,
      password: hashedPassword,
      preguntaSecreta,
      respuestaSecretaCifrada: hashedAnswer,
      codigoVerificacion: codigo,
      codigoExpiracion: expiracion,
      isVerified: false
    });

    await newUser.save();
    
    await enviarCodigoDeVerificacion(correo, codigo);

    res.status(201).json({ msg: 'Usuario registrado. Te hemos enviado un código a tu email.' });

  } catch (error) {
    console.error('Error en el registro:', error);
    res.status(500).json({ msg: 'Error del servidor.' });
  }
});

// --- RUTA: POST /api/auth/verify (Verificación de cuenta) ---
router.post('/verify', async (req, res) => {
  try {
    const { codigo } = req.body;
    const correo = req.body.correo.toLowerCase();

    if (!correo || !codigo) {
      return res.status(400).json({ msg: 'Faltan datos.' });
    }

    const user = await User.findOne({ correo: correo });
    if (!user) { 
      return res.status(400).json({ msg: 'Usuario no encontrado.' }); 
    }
    if (user.codigoVerificacion !== codigo) { 
      return res.status(400).json({ msg: 'Código incorrecto.' }); 
    }
    if (user.codigoExpiracion < new Date()) { 
      return res.status(400).json({ msg: 'El código ha expirado.' }); 
    }

    user.isVerified = true;
    user.codigoVerificacion = null;
    user.codigoExpiracion = null;
    await user.save();

    res.status(200).json({ msg: 'Usuario verificado con éxito.' });

  } catch (error) {
    console.error('Error en la verificación:', error);
    res.status(500).json({ msg: 'Error del servidor.' });
  }
});

// --- RUTA: POST /api/auth/login ---
router.post('/login', async (req, res) => {
  try {
    const { password } = req.body;
    const correo = req.body.correo.toLowerCase();

    if (!correo || !password) {
      return res.status(400).json({ msg: 'Por favor, ingresa correo y contraseña.' });
    }

    const user = await User.findOne({ correo: correo });
    if (!user) { 
      return res.status(400).json({ msg: 'Credenciales inválidas.' }); 
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) { 
      return res.status(400).json({ msg: 'Credenciales inválidas.' }); 
    }

    if (!user.isVerified) {
      return res.status(401).json({ 
        msg: 'Tu cuenta no ha sido verificada. Por favor, revisa tu correo.' 
      });
    }

    const payload = { 
      user: { 
        id: user._id, 
        nombre: user.nombre,
        correo: user.correo
      } 
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' }, // Token válido por 7 días
      (err, token) => {
        if (err) throw err;
        res.status(200).json({ 
          msg: 'Inicio de sesión exitoso', 
          token: token,
          user: {
            id: user._id,
            nombre: user.nombre,
            correo: user.correo
          }
        });
      }
    );

  } catch (error) {
    console.error('Error en el login:', error);
    res.status(500).json({ msg: 'Error del servidor.' });
  }
});

// --- GOOGLE OAUTH 2.0 ---

// Ruta 1: Inicia el flujo de Google
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false
  })
);

// Ruta 2: Google regresa aquí (callback)
router.get(
  '/google/callback',
  passport.authenticate('google', { 
    failureRedirect: process.env.FRONTEND_URL + '/login',
    session: false 
  }),
  (req, res) => {
    try {
      const { user, token } = req.user;
      
      // Redireccionar al frontend con el token en la URL
      res.redirect(`${process.env.FRONTEND_URL}/dashboard?token=${token}`);
    } catch (error) {
      console.error('Error en callback de Google:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
    }
  }
);

// --- RUTAS DE RECUPERACIÓN DE CONTRASEÑA ---

// Ruta: POST /api/auth/forgot-password (Paso 1: Pedir la pregunta)
router.post('/forgot-password', async (req, res) => {
  try {
    const correo = req.body.correo.toLowerCase();
    const user = await User.findOne({ correo });

    if (!user) { 
      return res.status(404).json({ msg: 'Usuario no encontrado.' }); 
    }

    res.status(200).json({ 
      preguntaSecreta: user.preguntaSecreta,
      correo: user.correo
    });

  } catch (error) {
    console.error('Error en forgot-password:', error);
    res.status(500).json({ msg: 'Error del servidor.' });
  }
});

// Ruta: POST /api/auth/verify-answer (Paso 2: Opción A - Pregunta)
router.post('/verify-answer', async (req, res) => {
  try {
    const { respuestaSecreta, nuevaPassword } = req.body;
    const correo = req.body.correo.toLowerCase();

    if (!correo || !respuestaSecreta || !nuevaPassword) { 
      return res.status(400).json({ msg: 'Faltan datos.' }); 
    }

    const user = await User.findOne({ correo });
    if (!user) { 
      return res.status(404).json({ msg: 'Usuario no encontrado.' }); 
    }

    const isMatch = await bcrypt.compare(respuestaSecreta, user.respuestaSecretaCifrada);
    if (!isMatch) { 
      return res.status(400).json({ msg: 'Respuesta secreta incorrecta.' }); 
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(nuevaPassword, salt);
    user.codigoVerificacion = null;
    user.codigoExpiracion = null;
    await user.save();

    res.status(200).json({ msg: 'Contraseña actualizada con éxito.' });

  } catch (error) {
    console.error('Error en verify-answer:', error);
    res.status(500).json({ msg: 'Error del servidor.' });
  }
});

// Ruta: POST /api/auth/send-reset-code (Paso 2: Opción B - Email)
router.post('/send-reset-code', async (req, res) => {
  try {
    const correo = req.body.correo.toLowerCase();
    const user = await User.findOne({ correo });
    if (!user) { 
      return res.status(404).json({ msg: 'Usuario no encontrado.' }); 
    }

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    user.codigoVerificacion = codigo;
    user.codigoExpiracion = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await enviarCodigoDeVerificacion(correo, codigo); 

    res.status(200).json({ msg: 'Código de recuperación enviado a tu email.' });

  } catch (error) {
    console.error('Error en send-reset-code:', error);
    res.status(500).json({ msg: 'Error del servidor.' });
  }
});

// Ruta: POST /api/auth/reset-with-code (Paso 3: Resetear con código)
router.post('/reset-with-code', async (req, res) => {
  try {
    const { codigo, nuevaPassword } = req.body;
    const correo = req.body.correo.toLowerCase();

    if (!correo || !codigo || !nuevaPassword) { 
      return res.status(400).json({ msg: 'Faltan datos.' }); 
    }

    const user = await User.findOne({ correo });
    if (!user) { 
      return res.status(404).json({ msg: 'Usuario no encontrado.' }); 
    }

    if (user.codigoVerificacion !== codigo) { 
      return res.status(400).json({ msg: 'Código incorrecto.' }); 
    }
    if (user.codigoExpiracion < new Date()) { 
      return res.status(400).json({ msg: 'El código ha expirado.' }); 
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(nuevaPassword, salt);
    user.codigoVerificacion = null;
    user.codigoExpiracion = null;
    await user.save();

    res.status(200).json({ msg: 'Contraseña actualizada con éxito.' });

  } catch (error) {
    console.error('Error en reset-with-code:', error);
    res.status(500).json({ msg: 'Error del servidor.' });
  }
});

// --- RUTA ADICIONAL: Verificar token ---
router.post('/verify-token', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ msg: 'No hay token, autorización denegada.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ msg: 'Token no válido.' });
    }

    res.status(200).json({
      user: {
        id: user._id,
        nombre: user.nombre,
        correo: user.correo
      }
    });
  } catch (error) {
    console.error('Error en verify-token:', error);
    res.status(401).json({ msg: 'Token no válido.' });
  }
});

// --- RUTA ADICIONAL: Reenviar código de verificación ---
router.post('/resend-verification', async (req, res) => {
  try {
    const correo = req.body.correo.toLowerCase();
    const user = await User.findOne({ correo });

    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ msg: 'El usuario ya está verificado.' });
    }

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expiracion = new Date(Date.now() + 10 * 60 * 1000);

    user.codigoVerificacion = codigo;
    user.codigoExpiracion = expiracion;
    await user.save();

    await enviarCodigoDeVerificacion(correo, codigo);

    res.status(200).json({ msg: 'Código de verificación reenviado a tu email.' });

  } catch (error) {
    console.error('Error en resend-verification:', error);
    res.status(500).json({ msg: 'Error del servidor.' });
  }
});

export default router