// server/src/services/notificationService.js
const nodemailer = require('nodemailer');

// --- Configuración de Nodemailer (Gmail) ---
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // La contraseña de aplicación de 16 letras
  },
});

// --- Función para enviar el CÓDIGO ---
const enviarCodigoDeVerificacion = async (correo, codigo) => {
  const mensaje = `Tu código de verificación para ${process.env.FRONTEND_URL} es: ${codigo}. Es válido por 10 minutos.`;

  try {
    await transporter.sendMail({
      from: `"Tu App de Login" <${process.env.EMAIL_USER}>`,
      to: correo,
      subject: 'Código de Verificación de Cuenta',
      text: mensaje,
    });
    console.log(`✅ Email enviado a ${correo}`);
  } catch (error) {
    console.error('❌ Error enviando email. Revisa EMAIL_PASS y EMAIL_USER en el .env:', error);
    throw new Error('Error al enviar el email de verificación. Revisa la configuración de Gmail.');
  }
};

module.exports = { enviarCodigoDeVerificacion };