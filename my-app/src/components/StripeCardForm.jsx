import { useState } from 'react'
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js'

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#1e293b',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSmoothing: 'antialiased',
      fontSize: '16px',
      '::placeholder': {
        color: '#94a3b8',
      },
    },
    invalid: {
      color: '#ef4444',
      iconColor: '#ef4444',
    },
  },
  hidePostalCode: false,
}

export default function StripeCardForm({ 
  plan, 
  planDetails,
  onSuccess, 
  onCancel,
  onError 
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [cardComplete, setCardComplete] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [paymentResult, setPaymentResult] = useState(null)

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!stripe || !elements) {
      onError('Stripe no está listo. Por favor recarga la página.')
      return
    }

    if (!cardComplete) {
      onError('Por favor completa los datos de la tarjeta')
      return
    }

    setProcessing(true)

    try {
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

      console.log('🔵 Paso 1: Creando Payment Intent para plan:', plan)
      console.log('🔵 URL del API:', API)
      console.log('🔵 Token:', token ? 'Presente' : 'Ausente')

      // 1. Crear Payment Intent en el backend
      const intentResponse = await fetch(`${API}/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan })
      })

      console.log('🔵 Respuesta del servidor - Status:', intentResponse.status)
      console.log('🔵 Content-Type:', intentResponse.headers.get('content-type'))

      // Verificar si es HTML en lugar de JSON
      const contentType = intentResponse.headers.get('content-type')
      if (contentType && contentType.includes('text/html')) {
        const htmlText = await intentResponse.text()
        console.error('❌ El servidor devolvió HTML:', htmlText.substring(0, 500))
        throw new Error('Error del servidor. Verifica que el backend esté corriendo en ' + API)
      }

      if (!intentResponse.ok) {
        const errorData = await intentResponse.json()
        console.error('❌ Error creando Payment Intent:', errorData)
        throw new Error(errorData.error || 'Error al crear intención de pago')
      }

      const { clientSecret, paymentIntentId } = await intentResponse.json()
      console.log('✅ Payment Intent creado:', paymentIntentId)

      console.log('🔵 Paso 2: Confirmando pago con Stripe...')

      // 2. Confirmar el pago con Stripe
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
        },
      })

      if (error) {
        console.error('❌ Error confirmando pago:', error)
        throw new Error(error.message)
      }

      console.log('✅ Pago confirmado en Stripe:', paymentIntent.status)

      console.log('🔵 Paso 3: Registrando pago en base de datos...')

      // 3. Confirmar el pago en el backend
      const confirmResponse = await fetch(`${API}/stripe/confirm-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ paymentIntentId: paymentIntent.id })
      })

      if (!confirmResponse.ok) {
        const errorData = await confirmResponse.json()
        console.error('❌ Error confirmando en backend:', errorData)
        throw new Error(errorData.error || 'Error al confirmar pago')
      }

      const result = await confirmResponse.json()
      console.log('✅ Pago completado exitosamente:', result)
      
      // Verificar que el pago fue completado exitosamente
      if (result.success && result.pago && result.pago.estado_pago === 'completado') {
        console.log('✅ Estado del pago confirmado como completado')
        
        setProcessing(false)
        setPaymentSuccess(true)
        setPaymentResult(result)
        
        // Esperar 3 segundos para mostrar el éxito y luego recargar la página
        setTimeout(() => {
          console.log('🔄 Recargando página para actualizar membresía...')
          window.location.reload()
        }, 3000)
      } else {
        throw new Error('El pago no se completó correctamente')
      }

    } catch (err) {
  // Si el pago fue exitoso, mostrar pantalla de éxito
  if (paymentSuccess && paymentResult) {
    return (
      <div style={{ width: '100%', textAlign: 'center', padding: 40 }}>
        <div style={{
          width: 80,
          height: 80,
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          animation: 'scaleIn 0.5s ease-out'
        }}>
          <span style={{ fontSize: 40, color: 'white' }}>✓</span>
        </div>
        
        <h2 style={{ 
          fontSize: 28, 
          fontWeight: 800, 
          color: '#10b981',
          margin: '0 0 12px',
          animation: 'fadeIn 0.6s ease-out 0.2s both'
        }}>
          ¡Pago Exitoso!
        </h2>
        
        <p style={{ 
          fontSize: 16, 
          color: '#64748b', 
          margin: '0 0 24px',
          animation: 'fadeIn 0.6s ease-out 0.3s both'
        }}>
          {paymentResult.mensaje || 'Tu suscripción ha sido activada correctamente'}
        </p>
        
        <div style={{
          background: '#f0fdf4',
          border: '2px solid #86efac',
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
          animation: 'fadeIn 0.6s ease-out 0.4s both'
        }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 14, color: '#64748b', marginBottom: 4 }}>Plan</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
              {planDetails.nombre}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 14, color: '#64748b', marginBottom: 4 }}>Monto</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
              ${planDetails.precio} MXN
            </div>
          </div>
          <div>
            <div style={{ fontSize: 14, color: '#64748b', marginBottom: 4 }}>Días agregados</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981' }}>
              {planDetails.dias} días
            </div>
          </div>
        </div>
        
        <p style={{ fontSize: 13, color: '#94a3b8' }}>
          Redirigiendo automáticamente...
        </p>
        
        <style>
          {`
            @keyframes scaleIn {
              from {
                transform: scale(0);
                opacity: 0;
              }
              to {
                transform: scale(1);
                opacity: 1;
              }
            }
            @keyframes fadeIn {
              from {
                opacity: 0;
                transform: translateY(10px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}
        </style>
      </div>
    )
  }

      console.error('💥 Error processing payment:', err)
      setProcessing(false)
      onError(err.message || 'Error al procesar el pago')
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
      <div style={{
        background: 'white',
        border: '2px solid #e2e8f0',
        borderRadius: 12,
        padding: 24,
        marginBottom: 24
      }}>
        {/* Plan seleccionado */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 8,
          padding: 20,
          marginBottom: 24,
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 4 }}>Plan seleccionado</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{planDetails.nombre}</div>
              <div style={{ fontSize: 14, opacity: 0.9, marginTop: 4 }}>
                {planDetails.dias} días de acceso
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 36, fontWeight: 900 }}>${planDetails.precio}</div>
              <div style={{ fontSize: 14, opacity: 0.9 }}>MXN</div>
            </div>
          </div>
        </div>

        {/* Título */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#1e293b' }}>
            💳 Información de Pago
          </h3>
          <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>
            Ingresa los datos de tu tarjeta de forma segura
          </p>
        </div>

        {/* Stripe Card Element */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ 
            display: 'block', 
            fontSize: 14, 
            fontWeight: 600, 
            color: '#475569',
            marginBottom: 8 
          }}>
            Datos de la Tarjeta
            <span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8', marginLeft: 8 }}>
              (Número, Fecha MM/AA, CVC, Código Postal)
            </span>
          </label>
          <div style={{
            padding: '16px',
            border: '2px solid #e2e8f0',
            borderRadius: 8,
            background: 'white',
            transition: 'border-color 0.2s'
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
          >
            <CardElement 
              options={CARD_ELEMENT_OPTIONS}
              onChange={(e) => setCardComplete(e.complete)}
            />
          </div>
          <div style={{ 
            marginTop: 6, 
            fontSize: 12, 
            color: '#94a3b8',
            display: 'flex',
            gap: 16 
          }}>
            <span>💳 16 dígitos</span>
            <span>📅 MM/AA</span>
            <span>🔒 CVC (3-4 dígitos)</span>
            <span>📍 Código Postal</span>
          </div>
        </div>

        {/* Mensaje de seguridad */}
        <div style={{
          display: 'flex',
          alignItems: 'start',
          gap: 12,
          padding: 12,
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: 6,
          fontSize: 13,
          color: '#166534'
        }}>
          <span style={{ fontSize: 16 }}>🔒</span>
          <div>
            <strong>Pago 100% Seguro</strong>
            <div style={{ marginTop: 2, opacity: 0.9 }}>
              Procesado por Stripe con encriptación de nivel bancario. 
              No almacenamos datos de tu tarjeta.
            </div>
          </div>
        </div>
      </div>

      {/* Botones */}
      <div style={{
        display: 'flex',
        gap: 12,
        justifyContent: 'flex-end'
      }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={processing}
          style={{
            padding: '12px 24px',
            background: '#f1f5f9',
            color: '#475569',
            border: 'none',
            borderRadius: 8,
            cursor: processing ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: 14,
            opacity: processing ? 0.5 : 1
          }}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!stripe || processing || !cardComplete}
          style={{
            padding: '12px 32px',
            background: (!stripe || processing || !cardComplete)
              ? '#cbd5e1'
              : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: (!stripe || processing || !cardComplete) ? 'not-allowed' : 'pointer',
            fontWeight: 700,
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: (!stripe || processing || !cardComplete) 
              ? 'none' 
              : '0 4px 12px rgba(16, 185, 129, 0.3)'
          }}
        >
          {processing ? (
            <>
              <div style={{
                width: 16,
                height: 16,
                border: '2px solid white',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} />
              Procesando...
            </>
          ) : (
            <>
              💳 Pagar ${planDetails.precio} MXN
            </>
          )}
        </button>
      </div>

      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </form>
  )
}
