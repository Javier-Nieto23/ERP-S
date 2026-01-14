import { useState, useEffect, useRef } from 'react'

/**
 * ChatModal - Componente de chat en tiempo real
 * Permite conversación entre cliente y administrador
 * Se actualiza automáticamente cada 3 segundos
 */
function ChatModal({ ticketId, ticketTitulo, usuarioActual, onClose }) {
  const [mensajes, setMensajes] = useState([])
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const mensajesEndRef = useRef(null)
  const pollingIntervalRef = useRef(null)

  console.log('ChatModal montado con:', { ticketId, ticketTitulo, usuarioActual })

  // Auto-scroll al último mensaje
  const scrollToBottom = () => {
    mensajesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Cargar mensajes del chat
  async function cargarMensajes() {
    try {
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const res = await fetch(`${API}/chat/${ticketId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        console.log('Mensajes recibidos:', data.mensajes)
        console.log('Usuario actual:', usuarioActual)
        setMensajes(data.mensajes || [])
        scrollToBottom()
      }
    } catch (e) {
      console.error('Error cargando mensajes:', e)
    }
  }

  // Enviar mensaje
  async function enviarMensaje(e) {
    e.preventDefault()
    if (!nuevoMensaje.trim()) return

    setEnviando(true)
    setError('')

    try {
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const res = await fetch(`${API}/chat/enviar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ticket_id: ticketId,
          mensaje: nuevoMensaje.trim()
        })
      })

      if (res.ok) {
        setNuevoMensaje('')
        await cargarMensajes()
      } else {
        const data = await res.json()
        setError(data.error || 'Error al enviar mensaje')
      }
    } catch (e) {
      setError('Error de conexión')
    } finally {
      setEnviando(false)
    }
  }

  // Cargar mensajes al montar y configurar polling
  useEffect(() => {
    cargarMensajes()
    
    // Polling cada 3 segundos para actualizar mensajes
    pollingIntervalRef.current = setInterval(cargarMensajes, 3000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [ticketId])

  useEffect(() => {
    scrollToBottom()
  }, [mensajes])

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: 20
      }}
      onClick={(e) => {
        // Cerrar al hacer click en el fondo
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div style={{
        background: 'white',
        borderRadius: 16,
        width: '100%',
        maxWidth: 600,
        height: '80vh',
        maxHeight: 700,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: 20,
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
              💬 Chat de Soporte
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, opacity: 0.9 }}>
              {ticketTitulo}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              fontSize: 24,
              cursor: 'pointer',
              width: 36,
              height: 36,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          >
            ×
          </button>
        </div>

        {/* Área de mensajes */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 20,
          background: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          {mensajes.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: 40,
              color: '#64748b'
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
              <p style={{ margin: 0, fontSize: 15 }}>
                No hay mensajes aún. ¡Inicia la conversación!
              </p>
            </div>
          ) : (
            mensajes.map((msg) => {
              // Comparar por usuario_id Y rol para determinar si es mi mensaje
              const esMio = (msg.usuario_id === usuarioActual.id && msg.rol === usuarioActual.rol)
              
              console.log('Mensaje:', {
                msg_usuario_id: msg.usuario_id,
                msg_rol: msg.rol,
                usuarioActual_id: usuarioActual.id,
                usuarioActual_rol: usuarioActual.rol,
                esMio: esMio
              })
              
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    justifyContent: esMio ? 'flex-end' : 'flex-start',
                    alignItems: 'flex-end',
                    gap: 8
                  }}
                >
                  {!esMio && (
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: 14,
                      fontWeight: 600,
                      flexShrink: 0
                    }}>
                      {msg.rol === 'admin' ? '👤' : '👨'}
                    </div>
                  )}
                  <div style={{
                    maxWidth: '70%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: esMio ? 'flex-end' : 'flex-start'
                  }}>
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: esMio 
                        ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                        : 'white',
                      color: esMio ? 'white' : '#1e293b',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      wordBreak: 'break-word'
                    }}>
                      {!esMio && (
                        <div style={{
                          fontSize: 11,
                          fontWeight: 600,
                          marginBottom: 4,
                          opacity: 0.8
                        }}>
                          {msg.nombre_usuario || 'Soporte'}
                        </div>
                      )}
                      <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                        {msg.mensaje}
                      </div>
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: '#94a3b8',
                      marginTop: 4,
                      paddingLeft: 4,
                      paddingRight: 4
                    }}>
                      {new Date(msg.created_at).toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                  {esMio && (
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: 14,
                      fontWeight: 600,
                      flexShrink: 0
                    }}>
                      Tú
                    </div>
                  )}
                </div>
              )
            })
          )}
          <div ref={mensajesEndRef} />
        </div>

        {/* Input de mensaje */}
        <form onSubmit={enviarMensaje} style={{
          padding: 16,
          background: 'white',
          borderTop: '1px solid #e2e8f0'
        }}>
          {error && (
            <div style={{
              padding: 8,
              background: '#fee2e2',
              color: '#991b1b',
              borderRadius: 6,
              fontSize: 13,
              marginBottom: 12
            }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            <input
              type="text"
              value={nuevoMensaje}
              onChange={(e) => setNuevoMensaje(e.target.value)}
              placeholder="Escribe tu mensaje..."
              disabled={enviando}
              style={{
                flex: 1,
                padding: '12px 16px',
                border: '2px solid #e2e8f0',
                borderRadius: 24,
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
            />
            <button
              type="submit"
              disabled={enviando || !nuevoMensaje.trim()}
              style={{
                padding: '0 24px',
                background: enviando || !nuevoMensaje.trim()
                  ? '#cbd5e1'
                  : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 24,
                fontSize: 14,
                fontWeight: 600,
                cursor: enviando || !nuevoMensaje.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: enviando || !nuevoMensaje.trim()
                  ? 'none'
                  : '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}
            >
              {enviando ? '⏳' : '📤'} Enviar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ChatModal
