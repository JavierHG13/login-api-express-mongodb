import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // URL de callback para producción
      callbackURL: `${process.env.BACKEND_URL || 'https://localhost:3000'}/api/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ 
          $or: [
            { googleId: profile.id },
            { correo: profile.emails[0].value.toLowerCase() }
          ]
        });

        if (user) {
          if (!user.googleId) {
            user.googleId = profile.id;
          }
          user.isVerified = true;
          await user.save();
        } else {
          const temporaryPassword = await bcrypt.hash(profile.id + Date.now(), 10);
          user = new User({
            googleId: profile.id,
            nombre: profile.displayName,
            correo: profile.emails[0].value.toLowerCase(),
            password: temporaryPassword,
            isVerified: true,
            telefono: 'No proporcionado',
            preguntaSecreta: 'Registro con Google',
            respuestaSecretaCifrada: await bcrypt.hash('google-oauth-default', 10)
          });
          await user.save();
        }

        const payload = { 
          user: { 
            id: user.id,
            nombre: user.nombre,
            correo: user.correo
          } 
        };
        
        const token = jwt.sign(payload, process.env.JWT_SECRET, { 
          expiresIn: '7d' 
        });

        return done(null, { user, token });
      } catch (err) {
        console.error('Error en Google OAuth:', err.message);
        return done(err, null);
      }
    }
  )
);