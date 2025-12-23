import { useEffect, useState } from 'react'
import './App.css'
import LoginForm from './components/LoginForm'
import AdminDashboard from './components/AdminDashboard'
import UserDashboard from './components/UserDashboard'
import RhDashboard from './components/RhDashboard'
import ClientDashboard from './components/ClientDashboard'

function App() {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem('token')
    const user = localStorage.getItem('user')
    return token && user ? { token, user: JSON.parse(user) } : null
  })

  useEffect(() => {
    // future: validate token expiry
  }, [])

  function handleLogout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setAuth(null)
  }

  if (!auth) return <LoginForm onLogin={({ token, user }) => setAuth({ token, user })} />

  if (auth.user && auth.user.rol === 'admin') {
    return (
      <div>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:12}}>
          <h1>Portal RDP</h1>
          <div>
            <button onClick={handleLogout}>Cerrar sesión</button>
          </div>
        </div>
        <AdminDashboard />
      </div>
    )
  }

  if (auth.user && auth.user.rol === 'rh') {
    return (
      <div>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:12}}>
          <h1>Portal RDP</h1>
          <div>
            <button onClick={handleLogout}>Cerrar sesión</button>
          </div>
        </div>
        <RhDashboard />
      </div>
    )
  }

  if (auth.user && auth.user.rol === 'cliente') {
    return (
      <div>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:12}}>
          <h1>Portal RDP</h1>
          <div>
            <button onClick={handleLogout}>Cerrar sesión</button>
          </div>
        </div>
        <ClientDashboard />
      </div>
    )
  }

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:12}}>
        <h1>Portal RDP</h1>
        <div>
          <button onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </div>
      <UserDashboard />
    </div>
  )
}

export default App
