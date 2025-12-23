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
    <div className="auth-page">
      <div className="auth-card">
        <h2 className="brand">Portal RDP</h2>
        <p className="subtitle">{isClient ? 'Inicia sesión como cliente' : 'Inicia sesión para continuar'}</p>
        <form onSubmit={handleSubmit} className="login-form">
          <label>
            <span>Email</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" />
          </label>
          <label>
            <span>Contraseña</span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </label>
          {error && <div className="error">{error}</div>}
          <button type="submit" className="btn" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
        </form>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:12}}>
          <div className="foot">¿Olvidaste tu contraseña? Contacta al administrador.</div>
          <button onClick={() => setIsClient(v => !v)} style={{background:'transparent',border:'none',color:'#9fb1d6',cursor:'pointer'}}>
            {isClient ? 'Volver al login' : '¿Eres cliente? Inicia sesión como cliente'}
          </button>
        </div>
      </div>
    </div>
  )
}
