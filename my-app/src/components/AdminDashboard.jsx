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
  const [censosProgramados, setCensosProgramados] = useState([])
  const [mesActual, setMesActual] = useState(new Date())
  const [estadisticas, setEstadisticas] = useState({
    licenciasPendientes: 0,
    ticketsActivos: 0,
    empleados: 0,
    completados: 0
  })
  const [servicioTab, setServicioTab] = useState('instalaciones')
  const [empresaFiltro, setEmpresaFiltro] = useState('todas')
  
  // Estados para instalaciones
  const [equiposPorInstalar, setEquiposPorInstalar] = useState([])
  const [instalacionesProgramadas, setInstalacionesProgramadas] = useState([])
  const [equipoAProgramarInstalacion, setEquipoAProgramarInstalacion] = useState(null)
  const [fechaInstalacion, setFechaInstalacion] = useState('')
  const [equipoEnInstalacion, setEquipoEnInstalacion] = useState(null)

  // Función para obtener días del mes en formato calendario
  function getDiasDelMes(fecha) {
    const año = fecha.getFullYear();
    const mes = fecha.getMonth();
    const primerDia = new Date(año, mes, 1);
    const ultimoDia = new Date(año, mes + 1, 0);
    const diasEnMes = ultimoDia.getDate();
    const primerDiaSemana = primerDia.getDay(); // 0 = domingo
    
    // Ajustar para que lunes sea el primer día (0)
    const primerDiaAjustado = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1;
    
    // Días del mes anterior para llenar
    const diasMesAnterior = new Date(año, mes, 0).getDate();
    const dias = [];
    
    // Días del mes anterior
    for (let i = primerDiaAjustado - 1; i >= 0; i--) {
      dias.push({
        dia: diasMesAnterior - i,
        esMesActual: false
      });
    }
    
    // Días del mes actual
    for (let i = 1; i <= diasEnMes; i++) {
      dias.push({
        dia: i,
        esMesActual: true
      });
    }
    
    // Días del próximo mes para completar la última fila
    const diasRestantes = 42 - dias.length; // 6 filas x 7 días = 42
    for (let i = 1; i <= diasRestantes; i++) {
      dias.push({
        dia: i,
        esMesActual: false
      });
    }
    
    return dias;
  }

  // Función para obtener censos de un día específico
  function getCensosDelDia(dia) {
    if (!dia.esMesActual) return [];
    
    const año = mesActual.getFullYear();
    const mes = mesActual.getMonth();
    const fechaDia = new Date(año, mes, dia.dia);
    
    return censosProgramados.filter(censo => {
      const fechaCenso = new Date(censo.dia_agendado);
      return fechaCenso.getDate() === dia.dia &&
             fechaCenso.getMonth() === mes &&
             fechaCenso.getFullYear() === año;
    });
  }

  // Función para obtener instalaciones de un día específico
  function getInstalacionesDelDia(dia) {
    if (!dia.esMesActual) return [];
    
    const año = mesActual.getFullYear();
    const mes = mesActual.getMonth();
    const fechaDia = new Date(año, mes, dia.dia);
    
    return instalacionesProgramadas.filter(instalacion => {
      const fechaInstalacion = new Date(instalacion.dia_agendado);
      return fechaInstalacion.getDate() === dia.dia &&
             fechaInstalacion.getMonth() === mes &&
             fechaInstalacion.getFullYear() === año;
    });
  }

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

  async function fetchCensosProgramados(){
    try{
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const res = await fetch(`${API}/admin/censos-programados`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if(res.ok){
        const data = await res.json()
        setCensosProgramados(data.censos || [])
      }
    }catch(e){ console.error('Error al obtener censos:', e) }
  }

  async function fetchEquiposPorInstalar(){
    try{
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const res = await fetch(`${API}/admin/equipos-por-instalar`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if(res.ok){
        const data = await res.json()
        setEquiposPorInstalar(data.equipos || [])
      }
    }catch(e){ console.error('Error al obtener equipos por instalar:', e) }
  }

  async function fetchInstalacionesProgramadas(){
    try{
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const res = await fetch(`${API}/admin/instalaciones-programadas`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if(res.ok){
        const data = await res.json()
        setInstalacionesProgramadas(data.instalaciones || [])
      }
    }catch(e){ console.error('Error al obtener instalaciones programadas:', e) }
  }

  async function handleProgramarInstalacion(){
    setError(''); setSuccess('')
    
    if(!fechaInstalacion){
      setError('La fecha es requerida')
      return
    }
    
    try{
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      
      const res = await fetch(`${API}/admin/programar-instalacion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          equipo_id: equipoAProgramarInstalacion.id,
          dia_agendado: fechaInstalacion
        })
      })
      
      const data = await res.json()
      if(!res.ok) return setError(data.error || 'Error al programar instalación')
      
      setSuccess('✓ Instalación programada exitosamente')
      setEquipoAProgramarInstalacion(null)
      setFechaInstalacion('')
      await fetchEquiposPorInstalar()
      await fetchInstalacionesProgramadas()
    }catch(e){
      setError('Error de conexión')
    }
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
    if(view==='home') {
      fetchCensosProgramados()
      fetchInstalacionesProgramadas()
    }
    if(view==='instalaciones') fetchEquiposPorInstalar()
  }, [view])

  return (
    <div style={{display:'flex',height:'calc(100vh - 80px)'}}>
      <div style={{width:200,background:'#1e293b',padding:16,color:'white'}}>
        <h3 style={{margin:'0 0 16px 0',fontSize:16}}>Menú</h3>
        <button onClick={()=>setView('home')} style={{display:'block',width:'100%',padding:8,marginBottom:8,background:view==='home'?'#334155':'transparent',border:'none',color:'white',textAlign:'left',cursor:'pointer',borderRadius:4}}>Inicio</button>
        <button onClick={()=>setView('equipos')} style={{display:'block',width:'100%',padding:8,marginBottom:8,background:view==='equipos'?'#334155':'transparent',border:'none',color:'white',textAlign:'left',cursor:'pointer',borderRadius:4}}>📦 Solicitudes de Censo</button>
        <button onClick={()=>setView('instalaciones')} style={{display:'block',width:'100%',padding:8,marginBottom:8,background:view==='instalaciones'?'#334155':'transparent',border:'none',color:'white',textAlign:'left',cursor:'pointer',borderRadius:4}}>🔧 Instalación</button>
      </div>
      <div style={{flex:1,padding:24,overflow:'auto'}}>
        {view==='home' && (
          <div>
            <h2 style={{marginBottom:24,display:'flex',alignItems:'center',gap:8}}>
              📅 Calendario de Censos Programados
            </h2>
            
            {/* Header del Calendario */}
            <div style={{background:'white',borderRadius:12,padding:24,boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
                <div style={{display:'flex',gap:8}}>
                  <button
                    onClick={() => setMesActual(new Date(mesActual.getFullYear(), mesActual.getMonth() - 1))}
                    style={{
                      padding:'8px 12px',
                      background:'#f1f5f9',
                      border:'1px solid #e2e8f0',
                      borderRadius:6,
                      cursor:'pointer',
                      fontSize:16
                    }}
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => setMesActual(new Date(mesActual.getFullYear(), mesActual.getMonth() + 1))}
                    style={{
                      padding:'8px 12px',
                      background:'#f1f5f9',
                      border:'1px solid #e2e8f0',
                      borderRadius:6,
                      cursor:'pointer',
                      fontSize:16
                    }}
                  >
                    ›
                  </button>
                  <button
                    onClick={() => setMesActual(new Date())}
                    style={{
                      padding:'8px 16px',
                      background:'#f1f5f9',
                      border:'1px solid #e2e8f0',
                      borderRadius:6,
                      cursor:'pointer',
                      fontSize:14,
                      fontWeight:600
                    }}
                  >
                    Hoy
                  </button>
                </div>
                
                <div style={{fontSize:20,fontWeight:700,color:'#1e293b'}}>
                  {mesActual.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
                </div>
                
                <select
                  style={{
                    padding:'8px 16px',
                    background:'white',
                    border:'1px solid #e2e8f0',
                    borderRadius:6,
                    fontSize:14,
                    fontWeight:600,
                    cursor:'pointer'
                  }}
                  value="mensual"
                  onChange={() => {}}
                >
                  <option value="mensual">Mensual</option>
                </select>
              </div>
              
              {/* Días de la semana */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(7, 1fr)',gap:8,marginBottom:8}}>
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(dia => (
                  <div key={dia} style={{
                    textAlign:'center',
                    fontSize:14,
                    fontWeight:600,
                    color:'#64748b',
                    padding:8
                  }}>
                    {dia}
                  </div>
                ))}
              </div>
              
              {/* Grid de días */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(7, 1fr)',gap:8}}>
                {getDiasDelMes(mesActual).map((diaObj, index) => {
                  const censos = getCensosDelDia(diaObj);
                  const instalaciones = getInstalacionesDelDia(diaObj);
                  const hoy = new Date();
                  const esHoy = diaObj.esMesActual && 
                               diaObj.dia === hoy.getDate() &&
                               mesActual.getMonth() === hoy.getMonth() &&
                               mesActual.getFullYear() === hoy.getFullYear();
                  
                  return (
                    <div
                      key={index}
                      style={{
                        minHeight:100,
                        padding:8,
                        background: diaObj.esMesActual ? 'white' : '#f8fafc',
                        border: esHoy ? '2px solid #10b981' : '1px solid #e2e8f0',
                        borderRadius:8,
                        position:'relative'
                      }}
                    >
                      <div style={{
                        fontSize:14,
                        fontWeight: esHoy ? 700 : 600,
                        color: diaObj.esMesActual ? '#1e293b' : '#94a3b8',
                        marginBottom:4
                      }}>
                        {diaObj.dia}
                      </div>
                      
                      {(censos.length > 0 || instalaciones.length > 0) && (
                        <div style={{display:'flex',flexDirection:'column',gap:2}}>
                          {/* Mostrar censos */}
                          {censos.slice(0, 2).map((censo, i) => {
                            const colorStatus = censo.status === 'registrado' ? '#3b82f6' : '#10b981';
                            return (
                              <div
                                key={`censo-${i}`}
                                title={`Censo: ${censo.marca} ${censo.modelo} - ${censo.nombre_empresa} (${censo.status})`}
                                style={{
                                  padding:'2px 6px',
                                  background: colorStatus,
                                  color:'white',
                                  fontSize:11,
                                  borderRadius:4,
                                  overflow:'hidden',
                                  textOverflow:'ellipsis',
                                  whiteSpace:'nowrap',
                                  cursor:'pointer'
                                }}
                              >
                                📋 {new Date(censo.dia_agendado).toLocaleTimeString('es-MX', {hour: '2-digit', minute: '2-digit'})} {censo.marca}
                              </div>
                            );
                          })}
                          
                          {/* Mostrar instalaciones */}
                          {instalaciones.slice(0, 2).map((instalacion, i) => {
                            return (
                              <div
                                key={`inst-${i}`}
                                title={`Instalación: ${instalacion.marca} ${instalacion.modelo} - ${instalacion.nombre_empresa}`}
                                style={{
                                  padding:'2px 6px',
                                  background: '#f59e0b',
                                  color:'white',
                                  fontSize:11,
                                  borderRadius:4,
                                  overflow:'hidden',
                                  textOverflow:'ellipsis',
                                  whiteSpace:'nowrap',
                                  cursor:'pointer'
                                }}
                              >
                                🔧 {new Date(instalacion.dia_agendado).toLocaleTimeString('es-MX', {hour: '2-digit', minute: '2-digit'})} {instalacion.marca}
                              </div>
                            );
                          })}
                          
                          {(censos.length + instalaciones.length) > 4 && (
                            <div style={{
                              fontSize:10,
                              color:'#64748b',
                              fontWeight:600,
                              marginTop:2
                            }}>
                              +{(censos.length + instalaciones.length) - 4} más
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Leyenda */}
              <div style={{
                marginTop:24,
                paddingTop:16,
                borderTop:'1px solid #e2e8f0',
                display:'flex',
                gap:24,
                flexWrap:'wrap'
              }}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:16,height:16,background:'#10b981',borderRadius:4}}></div>
                  <span style={{fontSize:14,color:'#64748b'}}>Censo Programado</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:16,height:16,background:'#3b82f6',borderRadius:4}}></div>
                  <span style={{fontSize:14,color:'#64748b'}}>Censo Registrado</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:16,height:16,background:'#f59e0b',borderRadius:4}}></div>
                  <span style={{fontSize:14,color:'#64748b'}}>Instalación Programada</span>
                </div>
              </div>
            </div>
            
            {/* Tarjetas de Estadísticas */}
            <div style={{
              display:'grid',
              gridTemplateColumns:'repeat(auto-fit, minmax(250px, 1fr))',
              gap:16,
              marginTop:24
            }}>
              {/* Licencias Pendientes */}
              <div style={{
                background:'white',
                borderRadius:12,
                padding:20,
                boxShadow:'0 1px 3px rgba(0,0,0,0.1)',
                display:'flex',
                alignItems:'center',
                gap:16
              }}>
                <div style={{
                  width:48,
                  height:48,
                  borderRadius:12,
                  background:'#dbeafe',
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'center',
                  fontSize:24
                }}>
                  🔑
                </div>
                <div>
                  <div style={{fontSize:32,fontWeight:700,color:'#1e293b'}}>
                    {estadisticas.licenciasPendientes}
                  </div>
                  <div style={{fontSize:14,color:'#64748b'}}>
                    Licencias Pendientes
                  </div>
                </div>
              </div>
              
              {/* Tickets Activos */}
              <div style={{
                background:'white',
                borderRadius:12,
                padding:20,
                boxShadow:'0 1px 3px rgba(0,0,0,0.1)',
                display:'flex',
                alignItems:'center',
                gap:16
              }}>
                <div style={{
                  width:48,
                  height:48,
                  borderRadius:12,
                  background:'#fef3c7',
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'center',
                  fontSize:24
                }}>
                  🎫
                </div>
                <div>
                  <div style={{fontSize:32,fontWeight:700,color:'#1e293b'}}>
                    {estadisticas.ticketsActivos}
                  </div>
                  <div style={{fontSize:14,color:'#64748b'}}>
                    Tickets Activos
                  </div>
                </div>
              </div>
              
            
              
              {/* Completados */}
              <div style={{
                background:'white',
                borderRadius:12,
                padding:20,
                boxShadow:'0 1px 3px rgba(0,0,0,0.1)',
                display:'flex',
                alignItems:'center',
                gap:16
              }}>
                <div style={{
                  width:48,
                  height:48,
                  borderRadius:12,
                  background:'#d1fae5',
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'center',
                  fontSize:24
                }}>
                  ✓
                </div>
                <div>
                  <div style={{fontSize:32,fontWeight:700,color:'#1e293b'}}>
                    {estadisticas.completados}
                  </div>
                  <div style={{fontSize:14,color:'#64748b'}}>
                    Completados
                  </div>
                </div>
              </div>
            </div>
            
            {/* Sección de Servicios Pendientes */}
            <div style={{
              background:'white',
              borderRadius:12,
              padding:24,
              boxShadow:'0 1px 3px rgba(0,0,0,0.1)',
              marginTop:24
            }}>
              <div style={{marginBottom:20}}>
                <h3 style={{
                  fontSize:20,
                  fontWeight:600,
                  color:'#1e293b',
                  margin:'0 0 8px 0',
                  display:'flex',
                  alignItems:'center',
                  gap:8
                }}>
                  🔧 Servicios Pendientes
                </h3>
                <p style={{
                  margin:0,
                  fontSize:14,
                  color:'#64748b'
                }}>
                  Instalaciones, censos de equipos y activaciones de licencias
                </p>
              </div>
              
              {/* Filtro por empresa */}
              <div style={{
                background:'#f8fafc',
                padding:16,
                borderRadius:8,
                marginBottom:16
              }}>
                <label style={{
                  display:'flex',
                  alignItems:'center',
                  gap:8,
                  fontSize:14,
                  color:'#475569'
                }}>
                  <span style={{fontWeight:600}}>⚡ Filtrar por empresa:</span>
                  <select
                    value={empresaFiltro}
                    onChange={(e) => setEmpresaFiltro(e.target.value)}
                    style={{
                      padding:'8px 12px',
                      border:'1px solid #e2e8f0',
                      borderRadius:6,
                      background:'white',
                      fontSize:14,
                      cursor:'pointer',
                      minWidth:200
                    }}
                  >
                    <option value="todas">Todas las empresas</option>
                  </select>
                </label>
              </div>
              
              {/* Pestañas */}
              <div style={{
                display:'flex',
                gap:8,
                borderBottom:'2px solid #e2e8f0',
                marginBottom:20
              }}>
                <button
                  onClick={() => setServicioTab('instalaciones')}
                  style={{
                    padding:'12px 24px',
                    background: servicioTab === 'instalaciones' ? 'white' : 'transparent',
                    border:'none',
                    borderBottom: servicioTab === 'instalaciones' ? '2px solid #3b82f6' : '2px solid transparent',
                    color: servicioTab === 'instalaciones' ? '#3b82f6' : '#64748b',
                    fontWeight:600,
                    fontSize:14,
                    cursor:'pointer',
                    marginBottom:-2,
                    display:'flex',
                    alignItems:'center',
                    gap:8,
                    transition:'all 0.2s'
                  }}
                >
                  ⬇️ Instalaciones
                </button>
                <button
                  onClick={() => setServicioTab('censos')}
                  style={{
                    padding:'12px 24px',
                    background: servicioTab === 'censos' ? 'white' : 'transparent',
                    border:'none',
                    borderBottom: servicioTab === 'censos' ? '2px solid #3b82f6' : '2px solid transparent',
                    color: servicioTab === 'censos' ? '#3b82f6' : '#64748b',
                    fontWeight:600,
                    fontSize:14,
                    cursor:'pointer',
                    marginBottom:-2,
                    display:'flex',
                    alignItems:'center',
                    gap:8,
                    transition:'all 0.2s'
                  }}
                >
                  📋 Censos
                </button>
                <button
                  onClick={() => setServicioTab('activaciones')}
                  style={{
                    padding:'12px 24px',
                    background: servicioTab === 'activaciones' ? 'white' : 'transparent',
                    border:'none',
                    borderBottom: servicioTab === 'activaciones' ? '2px solid #3b82f6' : '2px solid transparent',
                    color: servicioTab === 'activaciones' ? '#3b82f6' : '#64748b',
                    fontWeight:600,
                    fontSize:14,
                    cursor:'pointer',
                    marginBottom:-2,
                    display:'flex',
                    alignItems:'center',
                    gap:8,
                    transition:'all 0.2s'
                  }}
                >
                  🔄 Activaciones
                </button>
              </div>
              
              {/* Contenido de las pestañas */}
              {servicioTab === 'instalaciones' && (
                <>
                  {instalacionesProgramadas.length === 0 ? (
                    <div style={{
                      padding:40,
                      textAlign:'center',
                      background:'#f8fafc',
                      borderRadius:8,
                      border:'1px solid #e2e8f0'
                    }}>
                      <div style={{fontSize:48,marginBottom:16}}>🔧</div>
                      <p style={{
                        fontSize:16,
                        fontWeight:600,
                        color:'#1e293b',
                        margin:'0 0 8px 0'
                      }}>
                        No hay instalaciones programadas
                      </p>
                      <p style={{
                        fontSize:14,
                        color:'#64748b',
                        margin:0
                      }}>
                        Las instalaciones programadas aparecerán aquí
                      </p>
                    </div>
                  ) : (
                    <div style={{overflowX:'auto'}}>
                      <table style={{width:'100%',borderCollapse:'collapse'}}>
                        <thead>
                          <tr style={{background:'#f8fafc'}}>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Empresa</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Equipo</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Modelo</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Serie</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Fecha Programada</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Estado</th>
                            <th style={{padding:12,textAlign:'center',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {instalacionesProgramadas.map((instalacion, idx) => (
                            <tr key={idx} style={{borderBottom:'1px solid #e2e8f0'}}>
                              <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{instalacion.nombre_empresa}</td>
                              <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{instalacion.marca}</td>
                              <td style={{padding:12,fontSize:14,color:'#64748b'}}>{instalacion.modelo}</td>
                              <td style={{padding:12,fontSize:14,color:'#64748b',fontFamily:'monospace'}}>{instalacion.numero_serie}</td>
                              <td style={{padding:12,fontSize:14,color:'#64748b'}}>
                                {new Date(instalacion.dia_agendado).toLocaleString('es-MX', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </td>
                              <td style={{padding:12}}>
                                <span style={{
                                  display:'inline-block',
                                  padding:'4px 12px',
                                  background:'#fed7aa',
                                  color:'#9a3412',
                                  fontSize:12,
                                  fontWeight:600,
                                  borderRadius:12
                                }}>
                                  Programada
                                </span>
                              </td>
                              <td style={{padding:12,textAlign:'center'}}>
                                <button
                                  onClick={async () => {
                                    // Buscar el equipo completo para abrirlo en modal de instalación
                                    const token = localStorage.getItem('token')
                                    const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
                                    try {
                                      const res = await fetch(`${API}/admin/equipos`, {
                                        headers: { Authorization: `Bearer ${token}` }
                                      })
                                      if (res.ok) {
                                        const data = await res.json()
                                        const equipoCompleto = data.equipos.find(e => e.id === instalacion.equipo_id)
                                        if (equipoCompleto) {
                                          setEquipoEnInstalacion(equipoCompleto)
                                          setView('instalaciones')
                                        }
                                      }
                                    } catch(e) {
                                      console.error('Error:', e)
                                    }
                                  }}
                                  style={{
                                    padding:'8px 16px',
                                    background:'#f59e0b',
                                    color:'white',
                                    border:'none',
                                    borderRadius:6,
                                    fontSize:13,
                                    fontWeight:600,
                                    cursor:'pointer',
                                    display:'inline-flex',
                                    alignItems:'center',
                                    gap:6
                                  }}
                                >
                                  ✓ Realizar Instalación
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
              
              {servicioTab === 'censos' && (
                <>
                  {censosProgramados.filter(c => c.status === 'programado').length === 0 ? (
                    <div style={{
                      padding:40,
                      textAlign:'center',
                      background:'#f8fafc',
                      borderRadius:8,
                      border:'1px solid #e2e8f0'
                    }}>
                      <div style={{fontSize:48,marginBottom:16}}>📋</div>
                      <p style={{
                        fontSize:16,
                        fontWeight:600,
                        color:'#1e293b',
                        margin:'0 0 8px 0'
                      }}>
                        No hay censos pendientes
                      </p>
                      <p style={{
                        fontSize:14,
                        color:'#64748b',
                        margin:0
                      }}>
                        Los censos de equipos aparecerán aquí
                      </p>
                    </div>
                  ) : (
                    <div style={{overflowX:'auto'}}>
                      <table style={{width:'100%',borderCollapse:'collapse'}}>
                        <thead>
                          <tr style={{background:'#f8fafc'}}>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Empresa</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Equipo</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Modelo</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Serie</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Fecha Programada</th>
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Estado</th>
                            <th style={{padding:12,textAlign:'center',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {censosProgramados.filter(c => c.status === 'programado').map((censo, idx) => (
                            <tr key={idx} style={{borderBottom:'1px solid #e2e8f0'}}>
                              <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{censo.nombre_empresa}</td>
                              <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{censo.marca}</td>
                              <td style={{padding:12,fontSize:14,color:'#64748b'}}>{censo.modelo}</td>
                              <td style={{padding:12,fontSize:14,color:'#64748b',fontFamily:'monospace'}}>{censo.numero_serie}</td>
                              <td style={{padding:12,fontSize:14,color:'#64748b'}}>
                                {new Date(censo.dia_agendado).toLocaleString('es-MX', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </td>
                              <td style={{padding:12}}>
                                <span style={{
                                  display:'inline-block',
                                  padding:'4px 12px',
                                  background:'#fef3c7',
                                  color:'#92400e',
                                  fontSize:12,
                                  fontWeight:600,
                                  borderRadius:12
                                }}>
                                  Programado
                                </span>
                              </td>
                              <td style={{padding:12,textAlign:'center'}}>
                                <button
                                  onClick={async () => {
                                    // Buscar el equipo completo y abrir modal de censo
                                    const token = localStorage.getItem('token')
                                    const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
                                    try {
                                      const res = await fetch(`${API}/admin/equipos`, {
                                        headers: { Authorization: `Bearer ${token}` }
                                      })
                                      if (res.ok) {
                                        const data = await res.json()
                                        const equipoCompleto = data.equipos.find(e => e.id === censo.equipo_id)
                                        if (equipoCompleto) {
                                          setEquipoEnCenso(equipoCompleto)
                                          setView('equipos')
                                        }
                                      }
                                    } catch(e) {
                                      console.error('Error:', e)
                                    }
                                  }}
                                  style={{
                                    padding:'8px 16px',
                                    background:'#10b981',
                                    color:'white',
                                    border:'none',
                                    borderRadius:6,
                                    fontSize:13,
                                    fontWeight:600,
                                    cursor:'pointer',
                                    display:'inline-flex',
                                    alignItems:'center',
                                    gap:6
                                  }}
                                >
                                  ✓ Realizar Censo
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
              
              {servicioTab === 'activaciones' && (
                <div style={{
                  padding:40,
                  textAlign:'center',
                  background:'#f8fafc',
                  borderRadius:8,
                  border:'1px solid #e2e8f0'
                }}>
                  <div style={{fontSize:48,marginBottom:16}}>🔄</div>
                  <p style={{
                    fontSize:16,
                    fontWeight:600,
                    color:'#1e293b',
                    margin:'0 0 8px 0'
                  }}>
                    No hay activaciones pendientes
                  </p>
                  <p style={{
                    fontSize:14,
                    color:'#64748b',
                    margin:0
                  }}>
                    Las activaciones de licencias aparecerán aquí
                  </p>
                </div>
              )}
            </div>
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
                {equipos.filter(eq => eq.status !== 'pendiente' && eq.status !== 'programado' && eq.status !== 'por instalar' && eq.status !== 'instalacion programada').length > 0 && (
                  <div>
                    <h3 style={{fontSize:18,fontWeight:600,color:'#1e293b',marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
                      <span style={{display:'inline-block',width:12,height:12,borderRadius:'50%',background:'#10b981'}}></span>
                      Otros Equipos ({equipos.filter(eq => eq.status !== 'pendiente' && eq.status !== 'programado' && eq.status !== 'por instalar' && eq.status !== 'instalacion programada').length})
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
                          {equipos.filter(eq => eq.status !== 'pendiente' && eq.status !== 'programado' && eq.status !== 'por instalar' && eq.status !== 'instalacion programada').map((eq) => (
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
      
      {/* Vista de Instalaciones */}
      {view==='instalaciones' && (
        <div>
          <h2 style={{marginBottom:24,display:'flex',alignItems:'center',gap:8}}>
            🔧 Gestión de Instalaciones
          </h2>
          
          {error && <div style={{padding:12,background:'#fee2e2',color:'#991b1b',borderRadius:8,marginBottom:16}}>{error}</div>}
          {success && <div style={{padding:12,background:'#d1fae5',color:'#065f46',borderRadius:8,marginBottom:16}}>{success}</div>}
          
          {/* Equipos por instalar */}
          <div style={{background:'white',borderRadius:12,padding:24,boxShadow:'0 1px 3px rgba(0,0,0,0.1)',marginBottom:24}}>
            <h3 style={{fontSize:18,fontWeight:600,color:'#1e293b',marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
              📦 Equipos Por Instalar ({equiposPorInstalar.length})
            </h3>
            
            {equiposPorInstalar.length === 0 ? (
              <div style={{padding:40,textAlign:'center',background:'#f8fafc',borderRadius:8,border:'1px solid #e2e8f0'}}>
                <div style={{fontSize:48,marginBottom:16}}>🔧</div>
                <p style={{
                  fontSize:16,
                  fontWeight:600,
                  color:'#1e293b',
                  margin:'0 0 8px 0'
                }}>
                  No hay equipos por instalar
                </p>
                <p style={{
                  fontSize:14,
                  color:'#64748b',
                  margin:0
                }}>
                  Los equipos solicitados para instalación aparecerán aquí
                </p>
              </div>
            ) : (
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{background:'#f8fafc'}}>
                      <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Empresa</th>
                      <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Tipo</th>
                      <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Marca</th>
                      <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Modelo</th>
                      <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Serie</th>
                      <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Empleado</th>
                      <th style={{padding:12,textAlign:'center',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equiposPorInstalar.map((eq) => (
                      <tr key={eq.id} style={{borderBottom:'1px solid #e2e8f0'}}>
                        <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{eq.nombre_empresa || 'N/A'}</td>
                        <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{eq.tipo_equipo || 'N/A'}</td>
                        <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{eq.marca || 'N/A'}</td>
                        <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{eq.modelo || 'N/A'}</td>
                        <td style={{padding:12,fontSize:12,color:'#64748b',fontFamily:'monospace'}}>{eq.numero_serie || 'N/A'}</td>
                        <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{eq.nombre_empleado || 'Sin asignar'}</td>
                        <td style={{padding:12,textAlign:'center'}}>
                          <button
                            onClick={() => setEquipoAProgramarInstalacion(eq)}
                            style={{
                              padding:'8px 16px',
                              background:'#f59e0b',
                              color:'white',
                              border:'none',
                              borderRadius:6,
                              fontSize:13,
                              fontWeight:600,
                              cursor:'pointer',
                              display:'inline-flex',
                              alignItems:'center',
                              gap:6
                            }}
                          >
                            📅 Programar Instalación
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          {/* Instalaciones Programadas */}
          <div style={{background:'white',borderRadius:12,padding:24,boxShadow:'0 1px 3px rgba(0,0,0,0.1)',marginBottom:24}}>
            <h3 style={{fontSize:18,fontWeight:600,color:'#1e293b',marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
              <span style={{display:'inline-block',width:12,height:12,borderRadius:'50%',background:'#f59e0b'}}></span>
              Instalaciones Programadas ({instalacionesProgramadas.length})
            </h3>
            
            {instalacionesProgramadas.length === 0 ? (
              <div style={{padding:40,textAlign:'center',background:'#f8fafc',borderRadius:8,border:'1px solid #e2e8f0'}}>
                <div style={{fontSize:48,marginBottom:16}}>📅</div>
                <p style={{
                  fontSize:16,
                  fontWeight:600,
                  color:'#1e293b',
                  margin:'0 0 8px 0'
                }}>
                  No hay instalaciones programadas
                </p>
                <p style={{
                  
                  fontSize:14,
                  color:'#64748b',
                  margin:0
                }}>
                  Las instalaciones programadas aparecerán aquí
                </p>
              </div>
            ) : (
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{background:'#f8fafc'}}>
                      <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Empresa</th>
                      <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Tipo</th>
                      <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Marca</th>
                      <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Modelo</th>
                      <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Serie</th>
                      <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Fecha Programada</th>
                      <th style={{padding:12,textAlign:'center',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {instalacionesProgramadas.map((instalacion) => (
                      <tr key={instalacion.id} style={{borderBottom:'1px solid #e2e8f0'}}>
                        <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{instalacion.nombre_empresa || 'N/A'}</td>
                        <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{instalacion.tipo_equipo || 'N/A'}</td>
                        <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{instalacion.marca || 'N/A'}</td>
                        <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{instalacion.modelo || 'N/A'}</td>
                        <td style={{padding:12,fontSize:12,color:'#64748b',fontFamily:'monospace'}}>{instalacion.numero_serie || 'N/A'}</td>
                        <td style={{padding:12,fontSize:14,color:'#64748b'}}>
                          {new Date(instalacion.dia_agendado).toLocaleString('es-MX', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td style={{padding:12,textAlign:'center'}}>
                          <span style={{
                            display:'inline-block',
                            padding:'4px 12px',
                            background:'#fed7aa',
                            color:'#9a3412',
                            fontSize:12,
                            fontWeight:600,
                            borderRadius:12
                          }}>
                            Programada
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Modal para programar instalación */}
      {equipoAProgramarInstalacion && (
        <div style={{
          position:'fixed',
          top:0,
          left:0,
          right:0,
          bottom:0,
          background:'rgba(0,0,0,0.5)',
          display:'flex',
          alignItems:'center',
          justifyContent:'center',
          zIndex:1000
        }}>
          <div style={{
            background:'white',
            borderRadius:12,
            padding:32,
            width:'90%',
            maxWidth:500,
            boxShadow:'0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{fontSize:20,fontWeight:700,color:'#1e293b',marginBottom:24}}>
              📅 Programar Instalación
            </h3>
            
            <div style={{marginBottom:24,padding:16,background:'#f8fafc',borderRadius:8,border:'1px solid #e2e8f0'}}>
              <div style={{fontSize:14,color:'#64748b',marginBottom:8}}>
                <strong style={{color:'#1e293b'}}>Empresa:</strong> {equipoAProgramarInstalacion.nombre_empresa || 'N/A'}
              </div>
              <div style={{fontSize:14,color:'#64748b',marginBottom:8}}>
                <strong style={{color:'#1e293b'}}>Equipo:</strong> {equipoAProgramarInstalacion.marca} {equipoAProgramarInstalacion.modelo}
              </div>
              <div style={{fontSize:14,color:'#64748b',marginBottom:8}}>
                <strong style={{color:'#1e293b'}}>Serie:</strong> {equipoAProgramarInstalacion.numero_serie || 'N/A'}
              </div>
              <div style={{fontSize:14,color:'#64748b'}}>
                <strong style={{color:'#1e293b'}}>Empleado:</strong> {equipoAProgramarInstalacion.nombre_empleado || 'Sin asignar'}
              </div>
            </div>
            
            {error && <div style={{padding:12,background:'#fee2e2',color:'#991b1b',borderRadius:8,marginBottom:16}}>{error}</div>}
            
            <div style={{marginBottom:24}}>
              <label style={{display:'block',fontSize:14,fontWeight:600,color:'#1e293b',marginBottom:8}}>
                Fecha y Hora de Instalación *
              </label>
              <input
                type="datetime-local"
                value={fechaInstalacion}
                onChange={(e) => setFechaInstalacion(e.target.value)}
                style={{
                  width:'100%',
                  padding:12,
                  border:'2px solid #e2e8f0',
                  borderRadius:8,
                  fontSize:14,
                  color:'#1e293b'
                }}
              />
            </div>
            
            <div style={{display:'flex',gap:12}}>
              <button
                onClick={() => {
                  setEquipoAProgramarInstalacion(null)
                  setFechaInstalacion('')
                  setError('')
                }}
                style={{
                  flex:1,
                  padding:12,
                  background:'#f1f5f9',
                  color:'#475569',
                  border:'none',
                  borderRadius:8,
                  fontSize:14,
                  fontWeight:600,
                  cursor:'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleProgramarInstalacion}
                style={{
                  flex:1,
                  padding:12,
                  background:'#f59e0b',
                  color:'white',
                  border:'none',
                  borderRadius:8,
                  fontSize:14,
                  fontWeight:600,
                  cursor:'pointer'
                }}
              >
                Programar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal para Realizar Instalación */}
      {equipoEnInstalacion && (
        <div style={{
          position:'fixed',
          top:0,
          left:0,
          right:0,
          bottom:0,
          background:'rgba(0,0,0,0.5)',
          display:'flex',
          alignItems:'center',
          justifyContent:'center',
          zIndex:1000,
          padding:20,
          overflow:'auto'
        }}>
          <div style={{
            background:'white',
            borderRadius:12,
            padding:32,
            width:'90%',
            maxWidth:600,
            boxShadow:'0 20px 25px -5px rgba(0,0,0,0.1)',
            maxHeight:'90vh',
            overflow:'auto'
          }}>
            <h3 style={{fontSize:20,fontWeight:700,color:'#1e293b',marginBottom:24}}>
              ✓ Completar Instalación
            </h3>
            
            {/* Información del Equipo */}
            <div style={{padding:20,background:'#f8fafc',borderRadius:8,border:'2px solid #e2e8f0',marginBottom:20}}>
              <h4 style={{margin:'0 0 16px 0',fontSize:16,color:'#1e293b',fontWeight:600}}>
                Detalles del Equipo
              </h4>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,fontSize:14}}>
                <div>
                  <div style={{color:'#64748b',marginBottom:4,fontSize:12,fontWeight:600}}>Empresa</div>
                  <div style={{color:'#1e293b'}}>{equipoEnInstalacion.nombre_empresa || 'N/A'}</div>
                </div>
                <div>
                  <div style={{color:'#64748b',marginBottom:4,fontSize:12,fontWeight:600}}>Tipo</div>
                  <div style={{color:'#1e293b'}}>{equipoEnInstalacion.tipo_equipo || 'N/A'}</div>
                </div>
                <div>
                  <div style={{color:'#64748b',marginBottom:4,fontSize:12,fontWeight:600}}>Marca</div>
                  <div style={{color:'#1e293b'}}>{equipoEnInstalacion.marca || 'N/A'}</div>
                </div>
                <div>
                  <div style={{color:'#64748b',marginBottom:4,fontSize:12,fontWeight:600}}>Modelo</div>
                  <div style={{color:'#1e293b'}}>{equipoEnInstalacion.modelo || 'N/A'}</div>
                </div>
                <div>
                  <div style={{color:'#64748b',marginBottom:4,fontSize:12,fontWeight:600}}>Serie</div>
                  <div style={{color:'#1e293b'}}>{equipoEnInstalacion.numero_serie || 'N/A'}</div>
                </div>
                <div>
                  <div style={{color:'#64748b',marginBottom:4,fontSize:12,fontWeight:600}}>Empleado</div>
                  <div style={{color:'#1e293b'}}>{equipoEnInstalacion.nombre_empleado || 'Sin asignar'}</div>
                </div>
              </div>
            </div>

            {error && <div style={{padding:12,background:'#fee2e2',color:'#991b1b',borderRadius:8,marginBottom:16}}>{error}</div>}
            {success && <div style={{padding:12,background:'#d1fae5',color:'#065f46',borderRadius:8,marginBottom:16}}>{success}</div>}
            
            <div style={{marginBottom:20,padding:16,background:'#fef3c7',borderRadius:8,border:'1px solid #fbbf24'}}>
              <p style={{margin:0,fontSize:14,color:'#92400e',lineHeight:1.5}}>
                ℹ️ Al completar la instalación, el equipo pasará a estado <strong>"Activo"</strong> y estará disponible para el cliente.
              </p>
            </div>
            
            <div style={{display:'flex',gap:12}}>
              <button
                onClick={() => {
                  setEquipoEnInstalacion(null)
                  setError('')
                  setSuccess('')
                }}
                style={{
                  flex:1,
                  padding:12,
                  background:'#f1f5f9',
                  color:'#475569',
                  border:'none',
                  borderRadius:8,
                  fontSize:14,
                  fontWeight:600,
                  cursor:'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  setError('')
                  setSuccess('')
                  try {
                    const token = localStorage.getItem('token')
                    const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
                    
                    // Actualizar status del equipo a 'activo'
                    const res = await fetch(`${API}/equipos/${equipoEnInstalacion.id}/status`, {
                      method: 'PUT',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                      },
                      body: JSON.stringify({ status: 'activo' })
                    })
                    
                    if (!res.ok) {
                      const data = await res.json()
                      return setError(data.error || 'Error al completar instalación')
                    }
                    
                    setSuccess('✓ Instalación completada exitosamente')
                    setTimeout(() => {
                      setEquipoEnInstalacion(null)
                      fetchEquiposPorInstalar()
                      fetchInstalacionesProgramadas()
                    }, 1500)
                  } catch(e) {
                    setError('Error de conexión')
                  }
                }}
                style={{
                  flex:1,
                  padding:12,
                  background:'#10b981',
                  color:'white',
                  border:'none',
                  borderRadius:8,
                  fontSize:14,
                  fontWeight:600,
                  cursor:'pointer'
                }}
              >
                ✓ Completar Instalación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
