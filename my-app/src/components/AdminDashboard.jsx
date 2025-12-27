import { useEffect, useState } from 'react'

export default function AdminDashboard(){
  const [view, setView] = useState('home')
  const [requests, setRequests] = useState([])
  const [error, setError] = useState('')

  async function fetchEquipmentRequests(){
    try{
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const res = await fetch(`${API}/equipment-requests`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setRequests(data.requests)
      else setError(data.error || 'Error al obtener solicitudes')
    }catch(e){ setError('Error de conexión') }
  }

  useEffect(()=>{ if(view==='census') fetchEquipmentRequests() }, [view])

  return (
    <div style={{display:'flex',height:'calc(100vh - 80px)'}}>
      <div style={{width:200,background:'#1e293b',padding:16,color:'white'}}>
        <h3 style={{margin:'0 0 16px 0',fontSize:16}}>Menú</h3>
        <button onClick={()=>setView('home')} style={{display:'block',width:'100%',padding:8,marginBottom:8,background:view==='home'?'#334155':'transparent',border:'none',color:'white',textAlign:'left',cursor:'pointer',borderRadius:4}}>Inicio</button>
        <button onClick={()=>setView('census')} style={{display:'block',width:'100%',padding:8,marginBottom:8,background:view==='census'?'#334155':'transparent',border:'none',color:'white',textAlign:'left',cursor:'pointer',borderRadius:4}}>Solicitudes de Censo</button>
      </div>
      <div style={{flex:1,padding:24,overflow:'auto'}}>
        {view==='home' && (
          <div>
            <h2>Dashboard de Administrador</h2>
            <p>Bienvenido. Usa el menú lateral para revisar solicitudes de censo de equipos.</p>
          </div>
        )}
        {view==='census' && (
          <div>
            <h2>Solicitudes de Censo de Equipos</h2>
            {error && <div style={{color:'#ff6b6b',marginBottom:12}}>{error}</div>}
            <table style={{width:'100%',borderCollapse:'collapse',marginTop:16}}>
              <thead>
                <tr style={{background:'#f1f5f9',textAlign:'left'}}>
                  <th style={{padding:8,border:'1px solid #e2e8f0'}}>ID</th>
                  <th style={{padding:8,border:'1px solid #e2e8f0'}}>Cliente</th>
                  <th style={{padding:8,border:'1px solid #e2e8f0'}}>Empresa</th>
                  <th style={{padding:8,border:'1px solid #e2e8f0'}}>Marca</th>
                  <th style={{padding:8,border:'1px solid #e2e8f0'}}>Modelo</th>
                  <th style={{padding:8,border:'1px solid #e2e8f0'}}>No. Serie</th>
                  <th style={{padding:8,border:'1px solid #e2e8f0'}}>Usuario Equipo</th>
                  <th style={{padding:8,border:'1px solid #e2e8f0'}}>Tipo</th>
                  <th style={{padding:8,border:'1px solid #e2e8f0'}}>Status</th>
                  <th style={{padding:8,border:'1px solid #e2e8f0'}}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(r=> (
                  <tr key={r.id}>
                    <td style={{padding:8,border:'1px solid #e2e8f0'}}>{r.id}</td>
                    <td style={{padding:8,border:'1px solid #e2e8f0'}}>{r.cliente_nombre}<br/><small>{r.cliente_email}</small></td>
                    <td style={{padding:8,border:'1px solid #e2e8f0'}}>{r.nombre_empresa}</td>
                    <td style={{padding:8,border:'1px solid #e2e8f0'}}>{r.marca}</td>
                    <td style={{padding:8,border:'1px solid #e2e8f0'}}>{r.modelo}</td>
                    <td style={{padding:8,border:'1px solid #e2e8f0'}}>{r.no_serie}</td>
                    <td style={{padding:8,border:'1px solid #e2e8f0'}}>{r.nombre_usuario_equipo}</td>
                    <td style={{padding:8,border:'1px solid #e2e8f0'}}>{r.tipo_equipo}</td>
                    <td style={{padding:8,border:'1px solid #e2e8f0'}}><span style={{padding:'2px 8px',background:r.status==='pendiente'?'#fef3c7':'#d1fae5',borderRadius:4,fontSize:12}}>{r.status}</span></td>
                    <td style={{padding:8,border:'1px solid #e2e8f0'}}>{new Date(r.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {requests.length === 0 && <p style={{marginTop:16,color:'#64748b'}}>No hay solicitudes de censo pendientes.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
