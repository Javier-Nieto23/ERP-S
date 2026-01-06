// Configuración de pagos
// Para usar Stripe, instala: npm install stripe
// Para usar Mercado Pago, instala: npm install mercadopago

const PLANES = {
  mensual: {
    nombre: 'Plan Mensual',
    dias: 30,
    precio: 299, // MXN
    descripcion: '30 días de acceso completo'
  },
  trimestral: {
    nombre: 'Plan Trimestral',
    dias: 90,
    precio: 799, // MXN (ahorro de ~10%)
    descripcion: '90 días de acceso completo'
  },
  anual: {
    nombre: 'Plan Anual',
    dias: 365,
    precio: 2999, // MXN (ahorro de ~17%)
    descripcion: '365 días de acceso completo'
  }
}

module.exports = { PLANES }
