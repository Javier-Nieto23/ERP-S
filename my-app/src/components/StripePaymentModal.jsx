import { useState } from 'react'
import { Elements } from '@stripe/react-stripe-js'
import StripeCardForm from './StripeCardForm'

export default function StripePaymentModal({ 
  planes, 
  onClose, 
  onSelectPlan,
  cargandoPago,
  stripePromise,
  onPaymentSuccess,
  onPaymentError
}) {
  const [planSeleccionado, setPlanSeleccionado] = useState(null)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [metodoSeleccionado, setMetodoSeleccionado] = useState(null) // 'checkout' o 'card'

  const handleConfirmarPago = () => {
    if (planSeleccionado && metodoSeleccionado === 'checkout' && onSelectPlan) {
      onSelectPlan(planSeleccionado)
    } else if (planSeleccionado && metodoSeleccionado === 'card') {
      setMostrarFormulario(true)
    }
  }

  const handleVolverAPlanes = () => {
    setMostrarFormulario(false)
    setMetodoSeleccionado(null)
  }

  if (!planes) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 16,
          maxWidth: 900,
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          animation: 'slideUp 0.3s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>
          {`
            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translateY(30px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}
        </style>

        {/* Header */}
        <div
          style={{
            padding: '24px 32px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'white' }}>
              💳 Selecciona tu Plan
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.9)' }}>
              Pago seguro procesado por Stripe
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={cargandoPago}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '50%',
              width: 40,
              height: 40,
              cursor: cargandoPago ? 'not-allowed' : 'pointer',
              fontSize: 20,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              opacity: cargandoPago ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (!cargandoPago) e.currentTarget.style.background = 'rgba(255,255,255,0.3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
            }}
          >
            ✕
          </button>
        </div>

        {/* Body - Plans or Card Form */}
        <div style={{ padding: 32 }}>
          {cargandoPago ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div
                style={{
                  width: 60,
                  height: 60,
                  border: '4px solid #f3f4f6',
                  borderTop: '4px solid #667eea',
                  borderRadius: '50%',
                  margin: '0 auto 20px',
                  animation: 'spin 1s linear infinite'
                }}
              />
              <style>
                {`
                  @keyframes spin {
                    to { transform: rotate(360deg); }
                  }
                `}
              </style>
              <h3 style={{ fontSize: 20, color: '#1e293b', margin: '0 0 8px' }}>
                Procesando tu pago...
              </h3>
              <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
                {metodoSeleccionado === 'checkout' 
                  ? 'Serás redirigido a Stripe en unos segundos'
                  : 'Por favor espera...'}
              </p>
            </div>
          ) : mostrarFormulario ? (
            /* Formulario de tarjeta */
            <Elements stripe={stripePromise}>
              <StripeCardForm
                plan={planSeleccionado}
                planDetails={planes[planSeleccionado]}
                onSuccess={(result) => {
                  onPaymentSuccess(result)
                  onClose()
                }}
                onError={onPaymentError}
                onCancel={handleVolverAPlanes}
              />
            </Elements>
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 20,
                  marginBottom: 24
                }}
              >
                {Object.entries(planes).map(([key, plan]) => {
                  const isSelected = planSeleccionado === key
                  return (
                    <div
                      key={key}
                      style={{
                        border: isSelected ? '3px solid #667eea' : '2px solid #e2e8f0',
                        borderRadius: 12,
                        padding: 24,
                        cursor: 'pointer',
                        background: isSelected ? '#f8f9ff' : 'white',
                        transition: 'all 0.3s',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                      onClick={() => setPlanSeleccionado(key)}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = '#cbd5e1'
                          e.currentTarget.style.transform = 'translateY(-2px)'
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = '#e2e8f0'
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = 'none'
                        }
                      }}
                    >
                      {isSelected && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 12,
                            right: 12,
                            background: '#667eea',
                            color: 'white',
                            borderRadius: '50%',
                            width: 28,
                            height: 28,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14,
                            fontWeight: 'bold'
                          }}
                        >
                          ✓
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          color: '#1e293b',
                          marginBottom: 12
                        }}
                      >
                        {plan.nombre}
                      </div>
                      <div
                        style={{
                          fontSize: 40,
                          fontWeight: 900,
                          color: '#667eea',
                          marginBottom: 8,
                          lineHeight: 1
                        }}
                      >
                        ${plan.precio}
                        <span style={{ fontSize: 16, color: '#64748b', fontWeight: 400 }}>
                          {' '}MXN
                        </span>
                      </div>
                      <div style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
                        {plan.dias} días de acceso
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: '#059669',
                          fontWeight: 600,
                          background: '#d1fae5',
                          padding: '6px 12px',
                          borderRadius: 6,
                          display: 'inline-block'
                        }}
                      >
                        ${(plan.precio / plan.dias).toFixed(2)} / día
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Selector de método de pago */}
              {planSeleccionado && (
                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: 16, color: '#1e293b', fontWeight: 600 }}>
                    Elige cómo pagar
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => setMetodoSeleccionado('card')}
                      style={{
                        padding: 16,
                        border: metodoSeleccionado === 'card' ? '3px solid #667eea' : '2px solid #e2e8f0',
                        borderRadius: 8,
                        background: metodoSeleccionado === 'card' ? '#f8f9ff' : 'white',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ fontSize: 24, marginBottom: 8 }}>💳</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
                        Pagar con Tarjeta
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        Ingresa los datos aquí
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMetodoSeleccionado('checkout')}
                      style={{
                        padding: 16,
                        border: metodoSeleccionado === 'checkout' ? '3px solid #667eea' : '2px solid #e2e8f0',
                        borderRadius: 8,
                        background: metodoSeleccionado === 'checkout' ? '#f8f9ff' : 'white',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ fontSize: 24, marginBottom: 8 }}>🌐</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
                        Stripe Checkout
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        Página de pago de Stripe
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Info sobre Stripe */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 24
                }}
              >
                <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
                  <span style={{ fontSize: 24 }}>🔒</span>
                  <div>
                    <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                      Pago Seguro
                    </h4>
                    <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
                      {metodoSeleccionado === 'checkout' 
                        ? 'Serás redirigido a Stripe Checkout, la plataforma de pagos más segura del mundo.'
                        : 'Procesado por Stripe con encriptación de nivel bancario.'} 
                      {' '}Aceptamos tarjetas de crédito y débito. Tus datos están protegidos.
                    </p>
                  </div>
                </div>
              </div>

              {/* Botón de confirmación */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  onClick={onClose}
                  style={{
                    padding: '12px 24px',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e2e8f0'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f1f5f9'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmarPago}
                  disabled={!planSeleccionado || !metodoSeleccionado}
                  style={{
                    padding: '12px 32px',
                    background: (planSeleccionado && metodoSeleccionado)
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : '#cbd5e1',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    cursor: (planSeleccionado && metodoSeleccionado) ? 'pointer' : 'not-allowed',
                    fontWeight: 600,
                    fontSize: 14,
                    transition: 'all 0.2s',
                    boxShadow: (planSeleccionado && metodoSeleccionado) ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (planSeleccionado && metodoSeleccionado) {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (planSeleccionado && metodoSeleccionado) {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
                    }
                  }}
                >
                  {!planSeleccionado 
                    ? 'Selecciona un Plan' 
                    : !metodoSeleccionado 
                    ? 'Elige Método de Pago'
                    : '💳 Continuar al Pago'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
