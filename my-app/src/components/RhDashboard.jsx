import { useEffect, useState } from 'react'
import '../styles/LoginForm.css'

export default function RhDashboard(){
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({ nombre_usuario:'', apellido_usuario:'', email:'', password:'', rol:'user' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function fetchUsers(){
    try{
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const res = await fetch(`${API}/users`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setUsers(data.users)
      else setError(data.error || 'Error al obtener usuarios')
    }catch(e){ setError('Error de conexión') }
  }

  useEffect(()=>{ fetchUsers() }, [])

  async function handleSubmit(e){
    e.preventDefault(); setError(''); setSuccess('')
    try{
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const res = await fetch(`${API}/users`, {
        method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Error creando usuario')
      setSuccess('Usuario creado')
      setForm({ nombre_usuario:'', apellido_usuario:'', email:'', password:'', rol:'user' })
      fetchUsers()
    }catch(e){ setError('Error de conexión') }
  }

  return (
    <div style={{padding:24}}>
      <h2>RH Dashboard — Gestión de usuarios</h2>
      <div style={{display:'flex',gap:24}}>
        <form onSubmit={handleSubmit} style={{minWidth:320}}>
          <label>Nombre<br/><input value={form.nombre_usuario} onChange={e=>setForm({...form,nombre_usuario:e.target.value})} /></label>
          <label>Apellido<br/><input value={form.apellido_usuario} onChange={e=>setForm({...form,apellido_usuario:e.target.value})} /></label>
          <label>Email<br/><input type='email' value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></label>
          <label>Contraseña<br/><input type='password' value={form.password} onChange={e=>setForm({...form,password:e.target.value})} /></label>
          <label>Rol<br/>
            <select value={form.rol} onChange={e=>setForm({...form,rol:e.target.value})}>
              <option value='user'>user</option>
              <option value='admin'>admin</option>
              <option value='rh'>rh</option>
            </select>
          </label>
          {error && <div className='error'>{error}</div>}
          {success && <div style={{color:'#b7f2c9',marginTop:8}}>{success}</div>}
          <button className='btn' style={{marginTop:8}}>Crear usuario</button>
        </form>

        <div style={{flex:1}}>
          <h3>Usuarios</h3>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr><th>Id</th><th>Nombre</th><th>Email</th><th>Rol</th></tr></thead>
            <tbody>
              {users.map(u=> (
                <tr key={u.id}><td>{u.id}</td><td>{u.nombre_usuario} {u.apellido_usuario}</td><td>{u.email}</td><td>{u.rol}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
