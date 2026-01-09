import { useState } from 'react'
import '../styles/LoginForm.css'

export default function LoginForm({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isClient, setIsClient] = useState(false)

  const passwordPattern = /^(?=.{4,8}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email) return setError('Ingrese un email')
    if (!passwordPattern.test(password)) return setError('La contraseña debe tener entre 4 y 8 caracteres, 1 minúscula, 1 mayúscula y 1 dígito')

    setLoading(true)
    try {
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const endpoint = isClient ? '/auth/login-client' : '/auth/login'
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Credenciales inválidas')
        setLoading(false)
        return
      }

      // store token and user
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      if (onLogin) onLogin({ token: data.token, user: data.user })
    } catch (err) {
      console.error('login error', err)
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      height: '100vh',
      width: '100vw',
      margin: 0,
      padding: 0,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflow: 'hidden',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0
    }}>
      {/* Panel izquierdo con formulario */}
      <div style={{
        flex: '0 0 50%',
        maxWidth: '640px',
        background: 'white',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '80px 60px'
      }}>
        <div style={{maxWidth: 440, width: '100%'}}>
          <div style={{marginBottom: 48}}>
            <div style={{
              width: 55,
              height: 56,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
              fontSize: 28
            }}>📊</div>
            <h2 style={{
              fontSize: 32,
              fontWeight: 600,
              color: '#1e293b',
              margin: 0,
              marginBottom: 8
            }}>Servicios SEER Trafico</h2>
            <p style={{
              fontSize: 16,
              color: '#94a3b8',
              margin: 0
            }}>{isClient ? 'Inicia sesión como cliente' : 'Acceso al sistema administrativo'}</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{marginBottom: 20}}>
              <label style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 500,
                color: '#475569',
                marginBottom: 8
              }}>Email</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="tu@correo.com"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: 15,
                  border: '2px solid #e2e8f0',
                  borderRadius: 8,
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            <div style={{marginBottom: 24}}>
              <label style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 500,
                color: '#475569',
                marginBottom: 8
              }}>Contraseña</label>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: 15,
                  border: '2px solid #e2e8f0',
                  borderRadius: 8,
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            {error && (
              <div style={{
                padding: '12px 16px',
                background: '#fee2e2',
                color: '#dc2626',
                borderRadius: 8,
                fontSize: 14,
                marginBottom: 20
              }}>{error}</div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: loading ? '#94a3b8' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                marginBottom: 20
              }}
              onMouseEnter={(e) => !loading && (e.target.style.transform = 'translateY(-1px)')}
              onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
            >
              {loading ? 'Entrando...' : 'Iniciar sesión'}
            </button>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              fontSize: 13,
              color: '#64748b'
            }}>
              <div>¿Olvidaste tu contraseña? Contacta al administrador.</div>
              <button 
                type="button"
                onClick={() => setIsClient(v => !v)} 
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#667eea',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  textAlign: 'left',
                  padding: 0
                }}
              >
                {isClient ? '← Volver al login de administrador' : '¿Eres cliente? Inicia sesión aquí →'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Panel derecho con fondo decorativo abstracto */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 35%, #f093fb 70%, #667eea 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Círculos decorativos estilo burbujas */}
        <div style={{
          position: 'absolute',
          top: '15%',
          right: '20%',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 70%)',
          borderRadius: '50%',
          filter: 'blur(40px)'
        }}></div>
        <div style={{
          position: 'absolute',
          top: '50%',
          right: '10%',
          width: '250px',
          height: '250px',
          background: 'radial-gradient(circle, rgba(240,147,251,0.4) 0%, rgba(240,147,251,0) 70%)',
          borderRadius: '50%',
          filter: 'blur(30px)'
        }}></div>
        <div style={{
          position: 'absolute',
          bottom: '20%',
          left: '15%',
          width: '350px',
          height: '350px',
          background: 'radial-gradient(circle, rgba(102,126,234,0.3) 0%, rgba(102,126,234,0) 70%)',
          borderRadius: '50%',
          filter: 'blur(50px)'
        }}></div>
        <div style={{
          position: 'absolute',
          top: '30%',
          left: '25%',
          width: '200px',
          height: '200px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%)',
          borderRadius: '50%',
          filter: 'blur(25px)'
        }}></div>
        <div style={{
          position: 'absolute',
          bottom: '35%',
          right: '30%',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(118,75,162,0.3) 0%, rgba(118,75,162,0) 70%)',
          borderRadius: '50%',
          filter: 'blur(45px)'
        }}></div>
      </div>
    </div>
  )
}
