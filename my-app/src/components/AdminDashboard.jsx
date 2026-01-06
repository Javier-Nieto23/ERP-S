import { useEffect, useState } from 'react'

export default function AdminDashboard(){
  const [view, setView] = useState('home')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [equipos, setEquipos] = useState([])
  const [equipoAProgramar, setEquipoAProgramar] = useState(null)
  const [fechaCenso, setFechaCenso] = useState('')
  const [equipoEnCenso, setEquipoEnCenso] = useState(null)
  const [codigoCopiado, setCodigoCopiado] = useState(false)
  const [licencia, setLicencia] = useState('')
  const [equipoVisualizando, setEquipoVisualizando] = useState(null)
  const [noSoyRobot, setNoSoyRobot] = useState(false)
  const [licenciaReal, setLicenciaReal] = useState('')
  const [codigoRegCopiado, setCodigoRegCopiado] = useState(false)
  const [licenciaCopiada, setLicenciaCopiada] = useState(false)

  async function fetchEquipos(){
    try{
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const res = await fetch(`${API}/admin/equipos`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if(res.ok){
        const data = await res.json()
        setEquipos(data.equipos || [])
      } else {
        setError('Error al obtener equipos')
      }
    }catch(e){ setError('Error de conexión') }
  }

  async function handleVisualizarEquipo(equipo){
    setEquipoVisualizando(equipo)
    setNoSoyRobot(false)
    setLicenciaReal('')
    setCodigoRegCopiado(false)
    setLicenciaCopiada(false)
  }

  async function handleVerificarNoRobot(){
    try{
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      
      const res = await fetch(`${API}/equipos/${equipoVisualizando.id}/licencia`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if(res.ok){
        const data = await res.json()
        setLicenciaReal(data.licencia || 'N/A')
        setNoSoyRobot(true)
      } else {
        setError('Error al obtener licencia')
      }
    }catch(e){ setError('Error de conexión') }
  }

  async function handleProgramarCenso(e){
    e.preventDefault()
    setError(''); setSuccess('')
    
    try{
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      
      const res = await fetch(`${API}/agenda/programar-censo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          equipo_id: equipoAProgramar.id,
          dia_agendado: fechaCenso
        })
      })
      
      const data = await res.json()
      if(!res.ok) return setError(data.error || 'Error al programar censo')
      
      setSuccess('✓ Censo programado exitosamente')
      setEquipoAProgramar(null)
      setFechaCenso('')
      await fetchEquipos()
    }catch(e){
      setError('Error de conexión')
    }
  }

  async function handleVerificarCenso(){
    setError(''); setSuccess('')
    
    if(!licencia || licencia.trim() === ''){
      setError('La licencia es requerida');
      return;
    }
    
    try{
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      
      const res = await fetch(`${API}/agenda/verificar-censo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          equipo_id: equipoEnCenso.id,
          codigo: equipoEnCenso.codigo_registro,
          licencia: licencia
        })
      })
      
      const data = await res.json()
      if(!res.ok) return setError(data.error || 'Error al verificar censo')
      
      setSuccess('✓ Censo verificado exitosamente')
      setEquipoEnCenso(null)
      setLicencia('')
      await fetchEquipos()
    }catch(e){
      setError('Error de conexión')
    }
  }

  useEffect(()=>{ 
    if(view==='equipos') fetchEquipos()
  }, [view])

  return (
    <div style={{display:'flex',height:'calc(100vh - 80px)'}}>
      <div style={{width:200,background:'#1e293b',padding:16,color:'white'}}>
        <h3 style={{margin:'0 0 16px 0',fontSize:16}}>Menú</h3>
        <button onClick={()=>setView('home')} style={{display:'block',width:'100%',padding:8,marginBottom:8,background:view==='home'?'#334155':'transparent',border:'none',color:'white',textAlign:'left',cursor:'pointer',borderRadius:4}}>Inicio</button>
        <button onClick={()=>setView('equipos')} style={{display:'block',width:'100%',padding:8,marginBottom:8,background:view==='equipos'?'#334155':'transparent',border:'none',color:'white',textAlign:'left',cursor:'pointer',borderRadius:4}}>📦 Equipos Registrados</button>
      </div>
      <div style={{flex:1,padding:24,overflow:'auto'}}>
        {view==='home' && (
          <div>
            <h2>Dashboard de Administrador</h2>
            <p>Bienvenido. Usa el menú lateral para gestionar los equipos registrados.</p>
          </div>
        )}
        {view==='equipos' && (
          <div>
            <h2>📦 Solicitudes de Censo </h2>
            {error && <div style={{padding:12,background:'#fee2e2',color:'#991b1b',borderRadius:8,marginBottom:16}}>{error}</div>}
            {success && <div style={{padding:12,background:'#d1fae5',color:'#065f46',borderRadius:8,marginBottom:16}}>{success}</div>}
            
            {equipos.length === 0 ? (
              <div style={{padding:40,textAlign:'center',background:'#f8fafc',borderRadius:8,border:'1px solid #e2e8f0'}}>
                <p style={{color:'#64748b',margin:0}}>No hay equipos registrados</p>
              </div>
            ) : (
              <>
                {/* Equipos Pendientes */}
                {equipos.filter(eq => eq.status === 'pendiente').length > 0 && (
                  <div style={{marginBottom:32}}>
                    <h3 style={{fontSize:18,fontWeight:600,color:'#1e293b',marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
                      <span style={{display:'inline-block',width:12,height:12,borderRadius:'50%',background:'#fbbf24'}}></span>
                      Equipos Pendientes ({equipos.filter(eq => eq.status === 'pendiente').length})
                    </h3>
                    <div style={{overflowX:'auto'}}>
                      <table style={{width:'100%',borderCollapse:'collapse',background:'white',boxShadow:'0 1px 3px rgba(0,0,0,0.1)',borderRadius:8,overflow:'hidden'}}>
                        <thead>
                          <tr style={{background:'#f1f5f9'}}>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Empresa</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Tipo</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Marca</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Modelo</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Serie</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Empleado</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Status</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {equipos.filter(eq => eq.status === 'pendiente').map((eq) => (
                            <tr key={eq.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                              <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{eq.nombre_empresa || 'N/A'}</td>
                              <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{eq.tipo_equipo || 'N/A'}</td>
                              <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{eq.marca || 'N/A'}</td>
                              <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{eq.modelo || 'N/A'}</td>
                              <td style={{padding:12,fontSize:12,color:'#64748b'}}>{eq.numero_serie || 'N/A'}</td>
                              <td style={{padding:12,fontSize:14,color:'#1e293b'}}>
                                {eq.nombre_empleado || 'Sin asignar'}
                              </td>
                              <td style={{padding:12,fontSize:14}}>
                                <span style={{
                                  padding: '4px 12px',
                                  borderRadius: 12,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  background: '#fef3c7',
                                  color: '#92400e'
                                }}>
                                  ⏳ Pendiente
                                </span>
                              </td>
                              <td style={{padding:12}}>
                                <button
                                  onClick={() => {
                                    setEquipoAProgramar(eq)
                                    setFechaCenso('')
                                  }}
                                  style={{
                                    padding: '6px 12px',
                                    background: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseOver={(e) => e.target.style.background = '#2563eb'}
                                  onMouseOut={(e) => e.target.style.background = '#3b82f6'}
                                >
                                  📅 Programar Censo
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Equipos Programados */}
                {equipos.filter(eq => eq.status === 'programado').length > 0 && (
                  <div style={{marginBottom:32}}>
                    <h3 style={{fontSize:18,fontWeight:600,color:'#1e293b',marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
                      <span style={{display:'inline-block',width:12,height:12,borderRadius:'50%',background:'#3b82f6'}}></span>
                      Equipos Programados ({equipos.filter(eq => eq.status === 'programado').length})
                    </h3>
                    <div style={{overflowX:'auto'}}>
                      <table style={{width:'100%',borderCollapse:'collapse',background:'white',boxShadow:'0 1px 3px rgba(0,0,0,0.1)',borderRadius:8,overflow:'hidden'}}>
                        <thead>
                          <tr style={{background:'#f1f5f9'}}>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Empresa</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Tipo</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Marca</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Modelo</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Serie</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Empleado</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Fecha Programada</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Status</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {equipos.filter(eq => eq.status === 'programado').map((eq) => (
                            <tr key={eq.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                              <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{eq.nombre_empresa || 'N/A'}</td>
                              <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{eq.tipo_equipo || 'N/A'}</td>
                              <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{eq.marca || 'N/A'}</td>
                              <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{eq.modelo || 'N/A'}</td>
                              <td style={{padding:12,fontSize:12,color:'#64748b'}}>{eq.numero_serie || 'N/A'}</td>
                              <td style={{padding:12,fontSize:14,color:'#1e293b'}}>
                                {eq.nombre_empleado || 'Sin asignar'}
                              </td>
                              <td style={{padding:12,fontSize:13,color:'#1e293b'}}>
                                {eq.dia_agendado ? new Date(eq.dia_agendado).toLocaleString('es-MX', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }) : 'N/A'}
                              </td>
                              <td style={{padding:12,fontSize:14}}>
                                <span style={{
                                  padding: '4px 12px',
                                  borderRadius: 12,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  background: '#dbeafe',
                                  color: '#1e40af'
                                }}>
                                  📅 Programado
                                </span>
                              </td>
                              <td style={{padding:12}}>
                                <button
                                  onClick={() => setEquipoEnCenso(eq)}
                                  style={{
                                    padding: '6px 12px',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseOver={(e) => e.target.style.background = '#059669'}
                                  onMouseOut={(e) => e.target.style.background = '#10b981'}
                                >
                                  ✓ Realizar Censo
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Equipos Activos y otros status */}
                {equipos.filter(eq => eq.status !== 'pendiente' && eq.status !== 'programado').length > 0 && (
                  <div>
                    <h3 style={{fontSize:18,fontWeight:600,color:'#1e293b',marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
                      <span style={{display:'inline-block',width:12,height:12,borderRadius:'50%',background:'#10b981'}}></span>
                      Otros Equipos ({equipos.filter(eq => eq.status !== 'pendiente' && eq.status !== 'programado').length})
                    </h3>
                    <div style={{overflowX:'auto'}}>
                      <table style={{width:'100%',borderCollapse:'collapse',background:'white',boxShadow:'0 1px 3px rgba(0,0,0,0.1)',borderRadius:8,overflow:'hidden'}}>
                        <thead>
                          <tr style={{background:'#f1f5f9'}}>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Empresa</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Tipo</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Marca</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Modelo</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Serie</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Empleado</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Status</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {equipos.filter(eq => eq.status !== 'pendiente' && eq.status !== 'programado').map((eq) => (
                            <tr key={eq.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                              <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{eq.nombre_empresa || 'N/A'}</td>
                              <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{eq.tipo_equipo || 'N/A'}</td>
                              <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{eq.marca || 'N/A'}</td>
                              <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{eq.modelo || 'N/A'}</td>
                              <td style={{padding:12,fontSize:12,color:'#64748b'}}>{eq.numero_serie || 'N/A'}</td>
                              <td style={{padding:12,fontSize:14,color:'#1e293b'}}>
                                {eq.nombre_empleado || 'Sin asignar'}
                              </td>
                              <td style={{padding:12,fontSize:14}}>
                                <span style={{
                                  padding: '4px 12px',
                                  borderRadius: 12,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  background: eq.status === 'activo' ? '#d1fae5' : '#fee2e2',
                                  color: eq.status === 'activo' ? '#065f46' : '#991b1b'
                                }}>
                                  {eq.status === 'activo' ? '✓ Activo' : eq.status || 'N/A'}
                                </span>
                              </td>
                              <td style={{padding:12}}>
                                {eq.status === 'registrado' && (
                                  <button
                                    onClick={() => handleVisualizarEquipo(eq)}
                                    title="Ver información"
                                    style={{
                                      padding: '6px 12px',
                                      background: '#8b5cf6',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: 6,
                                      fontSize: 12,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      transition: 'all 0.2s'
                                    }}
                                    onMouseOver={(e) => e.target.style.background = '#7c3aed'}
                                    onMouseOut={(e) => e.target.style.background = '#8b5cf6'}
                                  >
                                    👁️ Ver
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal para Programar Censo */}
      {equipoAProgramar && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: 12,
            padding: 32,
            maxWidth: 500,
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{margin: '0 0 24px 0', fontSize: 24, color: '#1e293b'}}>
              📅 Programar Censo de Equipo
            </h3>
            
            <div style={{marginBottom: 24, padding: 16, background: '#f1f5f9', borderRadius: 8}}>
              <div style={{fontSize: 14, color: '#64748b', marginBottom: 4}}>Equipo a censar:</div>
              <div style={{fontSize: 16, fontWeight: 600, color: '#1e293b'}}>
                {equipoAProgramar.marca} {equipoAProgramar.modelo}
              </div>
              <div style={{fontSize: 14, color: '#64748b', marginTop: 4}}>
                Serie: {equipoAProgramar.numero_serie}
              </div>
              <div style={{fontSize: 14, color: '#64748b', marginTop: 4}}>
                Empresa: {equipoAProgramar.nombre_empresa}
              </div>
            </div>

            <form onSubmit={handleProgramarCenso}>
              <label style={{display: 'block', marginBottom: 24}}>
                <span style={{display: 'block', fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 8}}>
                  Fecha y Hora del Censo *
                </span>
                <input
                  type="datetime-local"
                  required
                  value={fechaCenso}
                  onChange={e => setFechaCenso(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  style={{
                    width: '100%',
                    padding: 12,
                    border: '2px solid #e2e8f0',
                    borderRadius: 8,
                    fontSize: 16,
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
              </label>

              <div style={{display: 'flex', gap: 12}}>
                <button
                  type="button"
                  onClick={() => {
                    setEquipoAProgramar(null)
                    setFechaCenso('')
                  }}
                  style={{
                    flex: 1,
                    padding: 12,
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: 12,
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Programar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Realizar Censo */}
      {equipoEnCenso && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: 12,
            padding: 32,
            maxWidth: 600,
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{margin: '0 0 24px 0', fontSize: 24, color: '#1e293b'}}>
              ✓ Realizar Censo de Equipo
            </h3>
            
            <div style={{marginBottom: 24, padding: 20, background: '#f8fafc', borderRadius: 8, border: '2px solid #e2e8f0'}}>
              <h4 style={{margin: '0 0 16px 0', fontSize: 18, color: '#1e293b', fontWeight: 600}}>
                Información del Equipo
              </h4>
              
              <div style={{marginBottom: 16}}>
                <label style={{display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 600}}>
                  Código de Registro
                </label>
                <div style={{display: 'flex', gap: 8}}>
                  <input
                    type="text"
                    value={equipoEnCenso.codigo_registro || 'N/A'}
                    readOnly
                    style={{
                      flex: 1,
                      padding: 10,
                      border: '2px solid #e2e8f0',
                      borderRadius: 6,
                      fontSize: 14,
                      color: '#1e293b',
                      background: '#f8fafc',
                      cursor: 'default'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(equipoEnCenso.codigo_registro || '').then(() => {
                        setCodigoCopiado(true);
                        setTimeout(() => setCodigoCopiado(false), 2000);
                      }).catch(() => {
                        setError('Error al copiar');
                      });
                    }}
                    style={{
                      padding: '10px 16px',
                      background: codigoCopiado ? '#10b981' : '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => !codigoCopiado && (e.target.style.background = '#2563eb')}
                    onMouseOut={(e) => !codigoCopiado && (e.target.style.background = '#3b82f6')}
                  >
                    {codigoCopiado ? '✓ Código Copiado' : '📋 Copiar'}
                  </button>
                </div>
              </div>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
                <div>
                  <div style={{fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 600}}>Empresa</div>
                  <div style={{fontSize: 14, color: '#1e293b'}}>{equipoEnCenso.nombre_empresa || 'N/A'}</div>
                </div>
                
                <div>
                  <div style={{fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 600}}>Tipo de Equipo</div>
                  <div style={{fontSize: 14, color: '#1e293b'}}>{equipoEnCenso.tipo_equipo || 'N/A'}</div>
                </div>
                
                <div>
                  <div style={{fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 600}}>Marca</div>
                  <div style={{fontSize: 14, color: '#1e293b'}}>{equipoEnCenso.marca || 'N/A'}</div>
                </div>
                
                <div>
                  <div style={{fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 600}}>Modelo</div>
                  <div style={{fontSize: 14, color: '#1e293b'}}>{equipoEnCenso.modelo || 'N/A'}</div>
                </div>
                
                <div>
                  <div style={{fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 600}}>Número de Serie</div>
                  <div style={{fontSize: 14, color: '#1e293b'}}>{equipoEnCenso.numero_serie || 'N/A'}</div>
                </div>
                
                <div>
                  <div style={{fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 600}}>Empleado Asignado</div>
                  <div style={{fontSize: 14, color: '#1e293b'}}>{equipoEnCenso.nombre_empleado || 'Sin asignar'}</div>
                </div>
                
                {equipoEnCenso.sistema_operativo && (
                  <div>
                    <div style={{fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 600}}>Sistema Operativo</div>
                    <div style={{fontSize: 14, color: '#1e293b'}}>{equipoEnCenso.sistema_operativo}</div>
                  </div>
                )}
                
                {equipoEnCenso.procesador && (
                  <div>
                    <div style={{fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 600}}>Procesador</div>
                    <div style={{fontSize: 14, color: '#1e293b'}}>{equipoEnCenso.procesador}</div>
                  </div>
                )}
                
                {equipoEnCenso.ram && (
                  <div>
                    <div style={{fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 600}}>RAM</div>
                    <div style={{fontSize: 14, color: '#1e293b'}}>{equipoEnCenso.ram}</div>
                  </div>
                )}
                
                {equipoEnCenso.disco_duro && (
                  <div>
                    <div style={{fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 600}}>Disco Duro</div>
                    <div style={{fontSize: 14, color: '#1e293b'}}>{equipoEnCenso.disco_duro}</div>
                  </div>
                )}
              </div>
            </div>

            <div style={{marginBottom: 24}}>
              <label style={{display: 'block', fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 8}}>
                Licencia del Equipo *
              </label>
              <input
                type="text"
                required
                value={licencia}
                onChange={e => setLicencia(e.target.value)}
                placeholder="Ingrese la licencia del equipo"
                style={{
                  width: '100%',
                  padding: 12,
                  border: '2px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 14,
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            {error && <div style={{padding:12,background:'#fee2e2',color:'#991b1b',borderRadius:8,marginBottom:16}}>{error}</div>}

            <div style={{display: 'flex', gap: 12}}>
              <button
                type="button"
                onClick={() => {
                  setEquipoEnCenso(null)
                  setLicencia('')
                }}
                style={{
                  flex: 1,
                  padding: 12,
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleVerificarCenso}
                style={{
                  flex: 1,
                  padding: 12,
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = '#059669'}
                onMouseOut={(e) => e.target.style.background = '#10b981'}
              >
                ✓ Verificado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Visualizar Equipo */}
      {equipoVisualizando && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: 12,
            padding: 32,
            maxWidth: 650,
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{margin: '0 0 24px 0', fontSize: 24, color: '#1e293b'}}>
              👁️ Información del Equipo
            </h3>
            
            {/* Código de Registro */}
            <div style={{marginBottom: 20}}>
              <label style={{display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 600}}>
                Código de Registro
              </label>
              <div style={{display: 'flex', gap: 8}}>
                <input
                  type="text"
                  value={equipoVisualizando.codigo_registro || 'N/A'}
                  readOnly
                  style={{
                    flex: 1,
                    padding: 10,
                    border: '2px solid #e2e8f0',
                    borderRadius: 6,
                    fontSize: 14,
                    color: '#1e293b',
                    background: '#f8fafc',
                    cursor: 'default'
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(equipoVisualizando.codigo_registro || '').then(() => {
                      setCodigoRegCopiado(true);
                      setTimeout(() => setCodigoRegCopiado(false), 2000);
                    });
                  }}
                  style={{
                    padding: '10px 16px',
                    background: codigoRegCopiado ? '#10b981' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => !codigoRegCopiado && (e.target.style.background = '#2563eb')}
                  onMouseOut={(e) => !codigoRegCopiado && (e.target.style.background = '#3b82f6')}
                >
                  {codigoRegCopiado ? '✓ Copiado' : '📋 Copiar'}
                </button>
              </div>
            </div>

            {/* Licencia con No soy robot */}
            <div style={{marginBottom: 24}}>
              <label style={{display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 600}}>
                Licencia del Equipo
              </label>
              <div style={{display: 'flex', gap: 8, marginBottom: 8}}>
                <input
                  type="text"
                  value={noSoyRobot ? licenciaReal : '••••••••••••••••'}
                  readOnly
                  style={{
                    flex: 1,
                    padding: 10,
                    border: '2px solid #e2e8f0',
                    borderRadius: 6,
                    fontSize: 14,
                    color: '#1e293b',
                    background: '#f8fafc',
                    cursor: 'default',
                    letterSpacing: noSoyRobot ? 'normal' : '2px'
                  }}
                />
                {noSoyRobot && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(licenciaReal || '').then(() => {
                        setLicenciaCopiada(true);
                        setTimeout(() => setLicenciaCopiada(false), 2000);
                      });
                    }}
                    style={{
                      padding: '10px 16px',
                      background: licenciaCopiada ? '#10b981' : '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => !licenciaCopiada && (e.target.style.background = '#2563eb')}
                    onMouseOut={(e) => !licenciaCopiada && (e.target.style.background = '#3b82f6')}
                  >
                    {licenciaCopiada ? '✓ Copiado' : '📋 Copiar'}
                  </button>
                )}
              </div>
              {!noSoyRobot && (
                <button
                  type="button"
                  onClick={handleVerificarNoRobot}
                  style={{
                    padding: '8px 16px',
                    background: '#f97316',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.background = '#ea580c'}
                  onMouseOut={(e) => e.target.style.background = '#f97316'}
                >
                  🤖 No soy robot - Ver Licencia
                </button>
              )}
            </div>

            {/* Información del Equipo */}
            <div style={{padding: 20, background: '#f8fafc', borderRadius: 8, border: '2px solid #e2e8f0', marginBottom: 20}}>
              <h4 style={{margin: '0 0 16px 0', fontSize: 16, color: '#1e293b', fontWeight: 600}}>
                Detalles del Equipo
              </h4>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14}}>
                <div>
                  <div style={{color: '#64748b', marginBottom: 4, fontSize: 12, fontWeight: 600}}>Empresa</div>
                  <div style={{color: '#1e293b'}}>{equipoVisualizando.nombre_empresa || 'N/A'}</div>
                </div>
                <div>
                  <div style={{color: '#64748b', marginBottom: 4, fontSize: 12, fontWeight: 600}}>Tipo</div>
                  <div style={{color: '#1e293b'}}>{equipoVisualizando.tipo_equipo || 'N/A'}</div>
                </div>
                <div>
                  <div style={{color: '#64748b', marginBottom: 4, fontSize: 12, fontWeight: 600}}>Marca</div>
                  <div style={{color: '#1e293b'}}>{equipoVisualizando.marca || 'N/A'}</div>
                </div>
                <div>
                  <div style={{color: '#64748b', marginBottom: 4, fontSize: 12, fontWeight: 600}}>Modelo</div>
                  <div style={{color: '#1e293b'}}>{equipoVisualizando.modelo || 'N/A'}</div>
                </div>
                <div>
                  <div style={{color: '#64748b', marginBottom: 4, fontSize: 12, fontWeight: 600}}>Serie</div>
                  <div style={{color: '#1e293b'}}>{equipoVisualizando.numero_serie || 'N/A'}</div>
                </div>
                <div>
                  <div style={{color: '#64748b', marginBottom: 4, fontSize: 12, fontWeight: 600}}>Empleado</div>
                  <div style={{color: '#1e293b'}}>{equipoVisualizando.nombre_empleado || 'Sin asignar'}</div>
                </div>
                {equipoVisualizando.sistema_operativo && (
                  <div>
                    <div style={{color: '#64748b', marginBottom: 4, fontSize: 12, fontWeight: 600}}>Sistema Operativo</div>
                    <div style={{color: '#1e293b'}}>{equipoVisualizando.sistema_operativo}</div>
                  </div>
                )}
                {equipoVisualizando.procesador && (
                  <div>
                    <div style={{color: '#64748b', marginBottom: 4, fontSize: 12, fontWeight: 600}}>Procesador</div>
                    <div style={{color: '#1e293b'}}>{equipoVisualizando.procesador}</div>
                  </div>
                )}
                {equipoVisualizando.ram && (
                  <div>
                    <div style={{color: '#64748b', marginBottom: 4, fontSize: 12, fontWeight: 600}}>RAM</div>
                    <div style={{color: '#1e293b'}}>{equipoVisualizando.ram}</div>
                  </div>
                )}
                {equipoVisualizando.disco_duro && (
                  <div>
                    <div style={{color: '#64748b', marginBottom: 4, fontSize: 12, fontWeight: 600}}>Disco Duro</div>
                    <div style={{color: '#1e293b'}}>{equipoVisualizando.disco_duro}</div>
                  </div>
                )}
              </div>
            </div>

            {error && <div style={{padding:12,background:'#fee2e2',color:'#991b1b',borderRadius:8,marginBottom:16}}>{error}</div>}

            <button
              type="button"
              onClick={() => {
                setEquipoVisualizando(null)
                setNoSoyRobot(false)
                setLicenciaReal('')
                setCodigoRegCopiado(false)
                setLicenciaCopiada(false)
              }}
              style={{
                width: '100%',
                padding: 12,
                background: '#f1f5f9',
                color: '#475569',
                border: 'none',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
