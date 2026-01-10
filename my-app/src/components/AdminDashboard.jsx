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
  const [empresasExpandidas, setEmpresasExpandidas] = useState({})
  const [censoTab, setCensoTab] = useState('disponibles')
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [diaSeleccionado, setDiaSeleccionado] = useState(null)
  
  // Estados para instalaciones
  const [equiposPorInstalar, setEquiposPorInstalar] = useState([])
  const [instalacionesProgramadas, setInstalacionesProgramadas] = useState([])
  const [equipoAProgramarInstalacion, setEquipoAProgramarInstalacion] = useState(null)
  const [fechaInstalacion, setFechaInstalacion] = useState('')
  const [equipoEnInstalacion, setEquipoEnInstalacion] = useState(null)

  // Estados para tickets
  const [tickets, setTickets] = useState([])
  const [archivosTicketsPorId, setArchivosTicketsPorId] = useState({})

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

  // Función para mapear status a tipo de servicio
  function getServicioPorStatus(status) {
    const servicios = {
      'programado': 'Censo Programado',
      'instalacion programada': 'Instalación Programada',
      'por instalar': 'Por Instalar',
      'registrado': 'Censo de Equipo',
      'en_proceso': 'En Proceso',
      'completado': 'Servicio Completado',
      'activo': 'Equipo Activo',
      'pendiente': 'Servicio Pendiente'
    }
    return servicios[status?.toLowerCase()] || 'Servicio General'
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

  async function fetchTickets(){
    try{
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const res = await fetch(`${API}/tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if(res.ok){
        const data = await res.json()
        setTickets(data.tickets || [])
      } else {
        setError('Error al obtener tickets')
      }
    }catch(e){ setError('Error de conexión') }
  }

  async function fetchArchivosTicket(ticketId) {
    try {
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const res = await fetch(`${API}/tickets/${ticketId}/archivos`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (res.ok) {
        const data = await res.json()
        setArchivosTicketsPorId(prev => ({
          ...prev,
          [ticketId]: data.archivos || []
        }))
      }
    } catch (e) {
      console.error('Error al cargar archivos del ticket:', e)
    }
  }

  async function descargarArchivo(archivoId, nombreArchivo) {
    try {
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const res = await fetch(`${API}/tickets/archivos/${archivoId}/descargar`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = nombreArchivo
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        setSuccess('Archivo descargado')
      } else {
        setError('Error al descargar el archivo')
      }
    } catch (e) {
      setError('Error de conexión al descargar archivo')
    }
  }

  async function cambiarStatusTicket(ticketId, nuevoStatus) {
    try {
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const res = await fetch(`${API}/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ status: nuevoStatus })
      })
      
      if (res.ok) {
        setSuccess('Status del ticket actualizado')
        fetchTickets()
      } else {
        setError('Error al actualizar el ticket')
      }
    } catch (e) {
      setError('Error de conexión')
    }
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
    if(view==='tickets') fetchTickets()
  }, [view])

  return (
    <div style={{
      display:'flex',
      height:'100vh',
      width:'100vw',
      margin:0,
      padding:0,
      background:'white',
      fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      position:'fixed',
      top:0,
      left:0,
      right:0,
      bottom:0,
      overflow:'hidden'
    }}>
      {/* Barra lateral con animación de expansión */}
      <div 
        style={{
          width: sidebarExpanded ? 280 : 80,
          background: '#e8e8e8',
          display: 'flex',
          flexDirection: 'column',
          alignItems: sidebarExpanded ? 'stretch' : 'center',
          padding: '20px 0',
          gap: 8,
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          overflow: 'hidden',
          height: '100vh',
          flexShrink: 0
        }}
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
      >
        {/* Logo */}
        <div style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarExpanded ? 'flex-start' : 'center',
          padding: sidebarExpanded ? '0 20px' : '0',
          marginBottom: 32,
          gap: 12,
          transition: 'all 0.3s ease'
        }}>
          <div style={{
            width: 48,
            height: 48,
            minWidth: 48,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24
          }}>📊</div>
          {sidebarExpanded && (
            <div style={{
              fontSize: 18,
              fontWeight: 600,
              color: '#1e293b',
              whiteSpace: 'nowrap',
              opacity: sidebarExpanded ? 1 : 0,
              transition: 'opacity 0.3s ease 0.1s'
            }}>Portal RDP</div>
          )}
        </div>

        {/* Barra de búsqueda - solo cuando está expandido */}
        {sidebarExpanded && (
          <div style={{
            margin: '0 16px 20px',
            display: 'flex',
            alignItems: 'center',
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '8px 12px',
            gap: 8,
            opacity: sidebarExpanded ? 1 : 0,
            transition: 'opacity 0.3s ease 0.15s'
          }}>
            <span style={{fontSize: 16, color: '#94a3b8'}}>🔍</span>
            <input 
              type="text" 
              placeholder="Search"
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                width: '100%',
                fontSize: 14,
                color: '#64748b'
              }}
            />
          </div>
        )}

        {/* Iconos/Menú de navegación */}
        <nav style={{flex: 1, width: '100%', padding: sidebarExpanded ? '0 12px' : '0'}}>
          <button 
            onClick={() => setView('home')} 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarExpanded ? 'flex-start' : 'center',
              gap: 12,
              width: sidebarExpanded ? '100%' : 48,
              height: 48,
              margin: sidebarExpanded ? '0 0 4px 0' : '0 auto 8px',
              padding: sidebarExpanded ? '10px 12px' : '0',
              background: view === 'home' ? 'white' : 'transparent',
              border: 'none',
              borderRadius: 8,
              color: view === 'home' ? '#1e293b' : '#64748b',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: view === 'home' ? 500 : 400,
              transition: 'all 0.2s',
              boxShadow: view === 'home' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
            onMouseEnter={(e) => {
              if(view !== 'home') {
                e.currentTarget.style.background = '#f1f5f9';
              }
            }}
            onMouseLeave={(e) => {
              if(view !== 'home') {
                e.currentTarget.style.background = 'transparent';
              }
            }}
            title={!sidebarExpanded ? 'Dashboard' : ''}
          >
            <span style={{fontSize: 20, minWidth: 20}}>🏠</span>
            {sidebarExpanded && (
              <span style={{
                whiteSpace: 'nowrap',
                opacity: sidebarExpanded ? 1 : 0,
                transition: 'opacity 0.3s ease 0.1s'
              }}>Dashboard</span>
            )}
          </button>

          <button 
            onClick={() => setView('equipos')} 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarExpanded ? 'flex-start' : 'center',
              gap: 12,
              width: sidebarExpanded ? '100%' : 48,
              height: 48,
              margin: sidebarExpanded ? '0 0 4px 0' : '0 auto 8px',
              padding: sidebarExpanded ? '10px 12px' : '0',
              background: view === 'equipos' ? 'white' : 'transparent',
              border: 'none',
              borderRadius: 8,
              color: view === 'equipos' ? '#1e293b' : '#64748b',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: view === 'equipos' ? 500 : 400,
              transition: 'all 0.2s',
              boxShadow: view === 'equipos' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
            onMouseEnter={(e) => {
              if(view !== 'equipos') {
                e.currentTarget.style.background = '#f1f5f9';
              }
            }}
            onMouseLeave={(e) => {
              if(view !== 'equipos') {
                e.currentTarget.style.background = 'transparent';
              }
            }}
            title={!sidebarExpanded ? 'Solicitudes de Censo' : ''}
          >
            <span style={{fontSize: 20, minWidth: 20}}>📦</span>
            {sidebarExpanded && (
              <span style={{
                whiteSpace: 'nowrap',
                opacity: sidebarExpanded ? 1 : 0,
                transition: 'opacity 0.3s ease 0.1s'
              }}>Solicitudes de Censo</span>
            )}
          </button>

          <button 
            onClick={() => setView('instalaciones')} 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarExpanded ? 'flex-start' : 'center',
              gap: 12,
              width: sidebarExpanded ? '100%' : 48,
              height: 48,
              margin: sidebarExpanded ? '0 0 4px 0' : '0 auto 8px',
              padding: sidebarExpanded ? '10px 12px' : '0',
              background: view === 'instalaciones' ? 'white' : 'transparent',
              border: 'none',
              borderRadius: 8,
              color: view === 'instalaciones' ? '#1e293b' : '#64748b',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: view === 'instalaciones' ? 500 : 400,
              transition: 'all 0.2s',
              boxShadow: view === 'instalaciones' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
            onMouseEnter={(e) => {
              if(view !== 'instalaciones') {
                e.currentTarget.style.background = '#f1f5f9';
              }
            }}
            onMouseLeave={(e) => {
              if(view !== 'instalaciones') {
                e.currentTarget.style.background = 'transparent';
              }
            }}
            title={!sidebarExpanded ? 'Instalaciones' : ''}
          >
            <span style={{fontSize: 20, minWidth: 20}}>🔧</span>
            {sidebarExpanded && (
              <span style={{
                whiteSpace: 'nowrap',
                opacity: sidebarExpanded ? 1 : 0,
                transition: 'opacity 0.3s ease 0.1s'
              }}>Instalación</span>
            )}
          </button>

          <button 
            onClick={() => setView('tickets')} 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarExpanded ? 'flex-start' : 'center',
              gap: 12,
              width: sidebarExpanded ? '100%' : 48,
              height: 48,
              margin: sidebarExpanded ? '0 0 4px 0' : '0 auto 8px',
              padding: sidebarExpanded ? '10px 12px' : '0',
              background: view === 'tickets' ? 'white' : 'transparent',
              border: 'none',
              borderRadius: 8,
              color: view === 'tickets' ? '#1e293b' : '#64748b',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: view === 'tickets' ? 500 : 400,
              transition: 'all 0.2s',
              boxShadow: view === 'tickets' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
            onMouseEnter={(e) => {
              if(view !== 'tickets') {
                e.currentTarget.style.background = '#f1f5f9';
              }
            }}
            onMouseLeave={(e) => {
              if(view !== 'tickets') {
                e.currentTarget.style.background = 'transparent';
              }
            }}
            title={!sidebarExpanded ? 'Tickets' : ''}
          >
            <span style={{fontSize: 20, minWidth: 20}}>🎫</span>
            {sidebarExpanded && (
              <span style={{
                whiteSpace: 'nowrap',
                opacity: sidebarExpanded ? 1 : 0,
                transition: 'opacity 0.3s ease 0.1s'
              }}>Tickets de Soporte</span>
            )}
          </button>
        </nav>

        {/* Logout */}
        <div style={{
          width: '100%',
          padding: sidebarExpanded ? '12px' : '0',
          borderTop: '1px solid #d1d5db'
        }}>
          <button
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.reload();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarExpanded ? 'flex-start' : 'center',
              gap: 12,
              width: sidebarExpanded ? '100%' : 48,
              height: 48,
              margin: sidebarExpanded ? '0' : '0 auto',
              padding: sidebarExpanded ? '10px 12px' : '0',
              background: 'transparent',
              border: 'none',
              borderRadius: 8,
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            title={!sidebarExpanded ? 'Cerrar sesión' : ''}
          >
            <span style={{fontSize: 18, minWidth: 18}}>🚪</span>
            {sidebarExpanded && (
              <span style={{
                whiteSpace: 'nowrap',
                opacity: sidebarExpanded ? 1 : 0,
                transition: 'opacity 0.3s ease 0.1s'
              }}>Cerrar sesión</span>
            )}
          </button>
        </div>
      </div>

      {/* Contenido principal */}
      <div style={{flex:1,padding:32,overflow:'auto',background:'#f8fafc',height:'100vh'}}>
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
                        position:'relative',
                        cursor: diaObj.esMesActual ? 'pointer' : 'default',
                        transition: 'all 0.2s ease',
                        transform: 'scale(1)'
                      }}
                      onMouseEnter={(e) => {
                        if (diaObj.esMesActual) {
                          e.currentTarget.style.transform = 'scale(1.05)';
                          e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.15)';
                          e.currentTarget.style.background = '#f0f9ff';
                          e.currentTarget.style.borderColor = '#3b82f6';
                          e.currentTarget.style.zIndex = '10';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (diaObj.esMesActual) {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.boxShadow = 'none';
                          e.currentTarget.style.background = 'white';
                          e.currentTarget.style.borderColor = esHoy ? '#10b981' : '#e2e8f0';
                          e.currentTarget.style.zIndex = '1';
                        }
                      }}
                      onClick={() => {
                        if (diaObj.esMesActual) {
                          setDiaSeleccionado(diaObj);
                        }
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
                                title={`${censo.nombre_empresa} - ${getServicioPorStatus(censo.status)}`}
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
                                📋 {new Date(censo.dia_agendado).toLocaleTimeString('es-MX', {hour: '2-digit', minute: '2-digit'})} {censo.nombre_empresa}  
                              </div>
                            );
                          })}
                          
                          {/* Mostrar instalaciones */}
                          {instalaciones.slice(0, 2).map((instalacion, i) => {
                            return (
                              <div
                                key={`inst-${i}`}
                                title={`${instalacion.nombre_empresa} - ${getServicioPorStatus(instalacion.status)}`}
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
                                🔧 {new Date(instalacion.dia_agendado).toLocaleTimeString('es-MX', {hour: '2-digit', minute: '2-digit'})} {instalacion.nombre_empresa}
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
            
            {/* Modal de detalle del día seleccionado */}
            {diaSeleccionado && (
              <>
                {/* Backdrop difuminado */}
                <div 
                  onClick={() => setDiaSeleccionado(null)}
                  style={{
                    position:'fixed',
                    top:0,
                    left:0,
                    right:0,
                    bottom:0,
                    background:'rgba(0,0,0,0.5)',
                    backdropFilter:'blur(4px)',
                    zIndex:1000,
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'center',
                    padding:20
                  }}
                >
                  {/* Modal */}
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      background:'white',
                      borderRadius:16,
                      padding:32,
                      boxShadow:'0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                      maxWidth:800,
                      width:'100%',
                      maxHeight:'85vh',
                      overflowY:'auto',
                      position:'relative',
                      animation:'modalSlideIn 0.3s ease-out'
                    }}
                  >
                    <style>
                      {`
                        @keyframes modalSlideIn {
                          from {
                            opacity: 0;
                            transform: translateY(-20px) scale(0.95);
                          }
                          to {
                            opacity: 1;
                            transform: translateY(0) scale(1);
                          }
                        }
                      `}
                    </style>
                    
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
                      <h3 style={{fontSize:24,fontWeight:700,color:'#1e293b',margin:0,display:'flex',alignItems:'center',gap:10}}>
                        📅 Agenda del {diaSeleccionado.dia} de {mesActual.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                      </h3>
                      <button
                        onClick={() => setDiaSeleccionado(null)}
                        style={{
                          padding:'8px 12px',
                          background:'#f1f5f9',
                          border:'1px solid #e2e8f0',
                          borderRadius:8,
                          cursor:'pointer',
                          fontSize:16,
                          fontWeight:600,
                          color:'#64748b',
                          transition:'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = '#ef4444';
                          e.target.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = '#f1f5f9';
                          e.target.style.color = '#64748b';
                        }}
                      >
                        ✕
                      </button>
                    </div>

                {(() => {
                  const censos = getCensosDelDia(diaSeleccionado);
                  const instalaciones = getInstalacionesDelDia(diaSeleccionado);
                  const total = censos.length + instalaciones.length;

                  if (total === 0) {
                    return (
                      <div style={{
                        padding:80,
                        textAlign:'center',
                        background:'#f8fafc',
                        borderRadius:12,
                        border:'1px solid #e2e8f0'
                      }}>
                        <div style={{fontSize:80,marginBottom:20}}>📭</div>
                        <p style={{
                          fontSize:20,
                          fontWeight:600,
                          color:'#1e293b',
                          margin:'0 0 8px 0'
                        }}>
                          No hay actividades programadas
                        </p>
                        <p style={{
                          fontSize:15,
                          color:'#64748b',
                          margin:0
                        }}>
                          Este día no tiene censos ni instalaciones agendadas
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div>
                      {/* Censos del día */}
                      {censos.length > 0 && (
                        <div style={{marginBottom: instalaciones.length > 0 ? 32 : 0}}>
                          <h4 style={{
                            fontSize:16,
                            fontWeight:600,
                            color:'#1e293b',
                            marginBottom:16,
                            display:'flex',
                            alignItems:'center',
                            gap:8
                          }}>
                            <div style={{width:12,height:12,background:'#3b82f6',borderRadius:'50%'}}></div>
                            Censos Programados ({censos.length})
                          </h4>
                          <div style={{display:'flex',flexDirection:'column',gap:12}}>
                            {censos.map((censo, idx) => (
                              <div
                                key={idx}
                                style={{
                                  padding:20,
                                  background:'#f0f9ff',
                                  border:'2px solid #bfdbfe',
                                  borderRadius:10,
                                  display:'flex',
                                  justifyContent:'space-between',
                                  alignItems:'center',
                                  gap:16
                                }}
                              >
                                <div style={{flex:1}}>
                                  <div style={{fontSize:16,fontWeight:700,color:'#1e293b',marginBottom:6}}>
                                    🏢 {censo.nombre_empresa}
                                  </div>
                                  <div style={{fontSize:14,color:'#3b82f6',marginBottom:4,fontWeight:600}}>
                                    📋 {getServicioPorStatus(censo.status)}
                                  </div>
                                  <div style={{fontSize:14,color:'#64748b',marginBottom:4}}>
                                    💻 {censo.marca} {censo.modelo}
                                  </div>
                                  <div style={{fontSize:14,color:'#64748b',marginBottom:4}}>
                                    👤 {censo.nombre_empleado || 'Sin asignar'}
                                  </div>
                                  <div style={{fontSize:14,fontWeight:600,color:'#3b82f6'}}>
                                    🕐 {new Date(censo.dia_agendado).toLocaleTimeString('es-MX', {hour: '2-digit', minute: '2-digit'})}
                                  </div>
                                </div>
                                <div style={{display:'flex',flexDirection:'column',gap:8,alignItems:'flex-end'}}>
                                  <span style={{
                                    padding:'6px 12px',
                                    background: censo.status === 'registrado' ? '#3b82f6' : '#10b981',
                                    color:'white',
                                    fontSize:12,
                                    borderRadius:12,
                                    fontWeight:600
                                  }}>
                                    {censo.status === 'registrado' ? '📋 Registrado' : '✓ Programado'}
                                  </span>
                                  <button
                                    onClick={() => {
                                      setEquipoEnCenso(censo);
                                      setDiaSeleccionado(null);
                                    }}
                                    style={{
                                      padding:'10px 20px',
                                      background:'#3b82f6',
                                      color:'white',
                                      border:'none',
                                      borderRadius:8,
                                      fontSize:14,
                                      fontWeight:600,
                                      cursor:'pointer',
                                      transition:'all 0.2s',
                                      whiteSpace:'nowrap'
                                    }}
                                    onMouseEnter={(e) => e.target.style.background = '#2563eb'}
                                    onMouseLeave={(e) => e.target.style.background = '#3b82f6'}
                                  >
                                    ✓ Realizar Censo
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Instalaciones del día */}
                      {instalaciones.length > 0 && (
                        <div>
                          <h4 style={{
                            fontSize:16,
                            fontWeight:600,
                            color:'#1e293b',
                            marginBottom:16,
                            display:'flex',
                            alignItems:'center',
                            gap:8
                          }}>
                            <div style={{width:12,height:12,background:'#f59e0b',borderRadius:'50%'}}></div>
                            Instalaciones Programadas ({instalaciones.length})
                          </h4>
                          <div style={{display:'flex',flexDirection:'column',gap:12}}>
                            {instalaciones.map((instalacion, idx) => (
                              <div
                                key={idx}
                                style={{
                                  padding:20,
                                  background:'#fffbeb',
                                  border:'2px solid #fde68a',
                                  borderRadius:10,
                                  display:'flex',
                                  justifyContent:'space-between',
                                  alignItems:'center',
                                  gap:16
                                }}
                              >
                                <div style={{flex:1}}>
                                  <div style={{fontSize:16,fontWeight:700,color:'#1e293b',marginBottom:6}}>
                                    🏢 {instalacion.nombre_empresa}
                                  </div>
                                  <div style={{fontSize:14,color:'#f59e0b',marginBottom:4,fontWeight:600}}>
                                    🔧 {getServicioPorStatus(instalacion.status)}
                                  </div>
                                  <div style={{fontSize:14,color:'#64748b',marginBottom:4}}>
                                    💻 {instalacion.marca} {instalacion.modelo}
                                  </div>
                                  <div style={{fontSize:14,color:'#64748b',marginBottom:4}}>
                                    👤 {instalacion.nombre_empleado || 'Sin asignar'}
                                  </div>
                                  <div style={{fontSize:14,fontWeight:600,color:'#f59e0b'}}>
                                    🕐 {new Date(instalacion.dia_agendado).toLocaleTimeString('es-MX', {hour: '2-digit', minute: '2-digit'})}
                                  </div>
                                </div>
                                <div style={{display:'flex',flexDirection:'column',gap:8,alignItems:'flex-end'}}>
                                  <span style={{
                                    padding:'6px 12px',
                                    background:'#f59e0b',
                                    color:'white',
                                    fontSize:12,
                                    borderRadius:12,
                                    fontWeight:600
                                  }}>
                                    🔧 Instalación
                                  </span>
                                  <button
                                    onClick={() => {
                                      setEquipoEnInstalacion(instalacion);
                                      setDiaSeleccionado(null);
                                    }}
                                    style={{
                                      padding:'10px 20px',
                                      background:'#f59e0b',
                                      color:'white',
                                      border:'none',
                                      borderRadius:8,
                                      fontSize:14,
                                      fontWeight:600,
                                      cursor:'pointer',
                                      transition:'all 0.2s',
                                      whiteSpace:'nowrap'
                                    }}
                                    onMouseEnter={(e) => e.target.style.background = '#d97706'}
                                    onMouseLeave={(e) => e.target.style.background = '#f59e0b'}
                                  >
                                    🔧 Realizar Instalación
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
                  </div>
                </div>
              </>
            )}
            
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
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Código de Registro</th>
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
                              <td style={{padding:12,fontSize:12,color:'#64748b'}}>{instalacion.codigo_registro || 'N/A'}</td>
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
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Código de Registro</th>
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
                              <td style={{padding:12,fontSize:12,color:'#64748b'}}>{censo.codigo_registro || 'N/A'}</td>
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
            <p style={{color:'#64748b',marginBottom:24}}>Solicitudes de censo de equipos pendientes y asignadas</p>
            {error && <div style={{padding:12,background:'#fee2e2',color:'#991b1b',borderRadius:8,marginBottom:16}}>{error}</div>}
            {success && <div style={{padding:12,background:'#d1fae5',color:'#065f46',borderRadius:8,marginBottom:16}}>{success}</div>}
            
            {/* Pestañas de Solicitudes de Censo */}
            <div style={{
              display:'flex',
              gap:0,
              borderBottom:'1px solid #e2e8f0',
              marginBottom:24,
              background:'white'
            }}>
              <button
                onClick={() => setCensoTab('porProgramar')}
                style={{
                  padding:'12px 20px',
                  background: 'transparent',
                  border:'none',
                  borderBottom: censoTab === 'porProgramar' ? '3px solid #3b82f6' : '3px solid transparent',
                  color: censoTab === 'porProgramar' ? '#1e293b' : '#64748b',
                  fontWeight: censoTab === 'porProgramar' ? 600 : 500,
                  fontSize:14,
                  cursor:'pointer',
                  transition:'all 0.2s',
                  display:'flex',
                  alignItems:'center',
                  gap:8
                }}
              >
                <span style={{fontSize:18}}>📋</span> Por Programar
              </button>
              <button
                onClick={() => setCensoTab('programados')}
                style={{
                  padding:'12px 20px',
                  background: 'transparent',
                  border:'none',
                  borderBottom: censoTab === 'programados' ? '3px solid #3b82f6' : '3px solid transparent',
                  color: censoTab === 'programados' ? '#1e293b' : '#64748b',
                  fontWeight: censoTab === 'programados' ? 600 : 500,
                  fontSize:14,
                  cursor:'pointer',
                  transition:'all 0.2s',
                  display:'flex',
                  alignItems:'center',
                  gap:8
                }}
              >
                <span style={{fontSize:18}}>📅</span> Programados
              </button>
              <button
                onClick={() => setCensoTab('historial')}
                style={{
                  padding:'12px 20px',
                  background: 'transparent',
                  border:'none',
                  borderBottom: censoTab === 'historial' ? '3px solid #3b82f6' : '3px solid transparent',
                  color: censoTab === 'historial' ? '#1e293b' : '#64748b',
                  fontWeight: censoTab === 'historial' ? 600 : 500,
                  fontSize:14,
                  cursor:'pointer',
                  transition:'all 0.2s',
                  display:'flex',
                  alignItems:'center',
                  gap:8
                }}
              >
                <span style={{fontSize:18}}>🕐</span> Historial
              </button>
            </div>

            {/* Contenido basado en la pestaña activa */}
            
            {/* Por Programar - Equipos Pendientes */}
            {censoTab === 'porProgramar' && (
              equipos.length === 0 ? (
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
                            <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Código de Instalacion</th>
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
                              <td style={{padding:12,fontSize:12,color:'#64748b'}}>{eq.codigo_registro || 'N/A'}</td>
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

              </>
            ))}

            {/* Programados - Equipos Programados */}
            {censoTab === 'programados' && (
              equipos.filter(eq => eq.status === 'programado').length === 0 ? (
                <div style={{
                  padding:40,
                  textAlign:'center',
                  background:'#f8fafc',
                  borderRadius:8,
                  border:'1px solid #e2e8f0'
                }}>
                  <div style={{fontSize:48,marginBottom:16}}>📅</div>
                  <p style={{
                    fontSize:16,
                    fontWeight:600,
                    color:'#1e293b',
                    margin:'0 0 8px 0'
                  }}>
                    No hay censos programados
                  </p>
                </div>
              ) : (
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',background:'white',boxShadow:'0 1px 3px rgba(0,0,0,0.1)',borderRadius:8,overflow:'hidden'}}>
                    <thead>
                      <tr style={{background:'#f1f5f9'}}>
                        <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Empresa</th>
                        <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Tipo</th>
                        <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Marca</th>
                        <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Modelo</th>
                        <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Serie</th>
                        <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Código de Registro</th>
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
                          <td style={{padding:12,fontSize:12,color:'#64748b'}}>{eq.codigo_registro || 'N/A'}</td>
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
              )
            )}

            {/* Historial - Equipos Registrados con formato expandible */}
            {censoTab === 'historial' && (
              equipos.filter(eq => eq.status !== 'pendiente' && eq.status !== 'programado' && eq.status !== 'por instalar' && eq.status !== 'instalacion programada').length > 0 ? (
                <div>
                  <h3 style={{fontSize:18,fontWeight:600,color:'#1e293b',marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
                    <span style={{display:'inline-block',width:12,height:12,borderRadius:'50%',background:'#10b981'}}></span>
                    Registro de equipos ({equipos.filter(eq => eq.status !== 'pendiente' && eq.status !== 'programado' && eq.status !== 'por instalar' && eq.status !== 'instalacion programada').length})
                  </h3>
                  <div style={{overflowX:'auto'}}>
                    <div style={{background:'white',boxShadow:'0 1px 3px rgba(0,0,0,0.1)',borderRadius:8,overflow:'hidden'}}>
                      {(() => {
                        // Agrupar equipos por empresa
                        const equiposFiltrados = equipos.filter(eq => eq.status !== 'pendiente' && eq.status !== 'programado' && eq.status !== 'por instalar' && eq.status !== 'instalacion programada')
                        const empresasMap = {}
                        equiposFiltrados.forEach(eq => {
                          const nombreEmpresa = eq.nombre_empresa || 'Sin Empresa'
                          if (!empresasMap[nombreEmpresa]) {
                            empresasMap[nombreEmpresa] = []
                          }
                            empresasMap[nombreEmpresa].push(eq)
                          })
                          
                          return Object.keys(empresasMap).map((nombreEmpresa, idx) => (
                            <div key={idx} style={{borderBottom: idx < Object.keys(empresasMap).length - 1 ? '1px solid #e2e8f0' : 'none'}}>
                              {/* Fila de empresa */}
                              <div 
                                onClick={() => {
                                  setEmpresasExpandidas(prev => ({
                                    ...prev,
                                    [nombreEmpresa]: !prev[nombreEmpresa]
                                  }))
                                }}
                                style={{
                                  padding: 16,
                                  background: '#f8fafc',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 12,
                                  transition: 'background 0.2s',
                                  ':hover': { background: '#f1f5f9' }
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                onMouseOut={(e) => e.currentTarget.style.background = '#f8fafc'}
                              >
                                <span style={{
                                  fontSize: 16,
                                  transition: 'transform 0.2s',
                                  transform: empresasExpandidas[nombreEmpresa] ? 'rotate(180deg)' : 'rotate(0deg)',
                                  display: 'inline-block'
                                }}>
                                  ▼
                                </span>
                                <span style={{fontSize: 15, fontWeight: 600, color: '#1e293b'}}>
                                  {nombreEmpresa}
                                </span>
                                <span style={{
                                  marginLeft: 'auto',
                                  fontSize: 13,
                                  color: '#64748b',
                                  background: '#e2e8f0',
                                  padding: '4px 10px',
                                  borderRadius: 12,
                                  fontWeight: 600
                                }}>
                                  {empresasMap[nombreEmpresa].length} {empresasMap[nombreEmpresa].length === 1 ? 'equipo' : 'equipos'}
                                </span>
                              </div>
                              
                              {/* Equipos de la empresa (colapsable) */}
                              {empresasExpandidas[nombreEmpresa] && (
                                <div style={{background: 'white'}}>
                                  {empresasMap[nombreEmpresa].map((eq, eqIdx) => (
                                    <div 
                                      key={eq.id} 
                                      style={{
                                        padding: '12px 16px 12px 52px',
                                        borderBottom: eqIdx < empresasMap[nombreEmpresa].length - 1 ? '1px solid #f1f5f9' : 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 16,
                                        background: 'white'
                                      }}
                                    >
                                      <div style={{flex: 1}}>
                                        <div style={{fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 4}}>
                                          {eq.nombre_equipo || `${eq.marca || 'N/A'} ${eq.modelo || 'N/A'}`}
                                        </div>
                                        <div style={{fontSize: 13, color: '#64748b'}}>
                                          Empleado: {eq.nombre_empleado || 'Sin asignar'}
                                        </div>
                                      </div>
                                      <div>
                                        <span style={{
                                          padding: '4px 12px',
                                          borderRadius: 12,
                                          fontSize: 12,
                                          fontWeight: 600,
                                          background: eq.status === 'activo' ? '#d1fae5' : eq.status === 'registrado' ? '#dbeafe' : '#fee2e2',
                                          color: eq.status === 'activo' ? '#065f46' : eq.status === 'registrado' ? '#1e40af' : '#991b1b'
                                        }}>
                                          {eq.status === 'activo' ? '✓ Activo' : eq.status === 'registrado' ? '📋 Registrado' : eq.status || 'N/A'}
                                        </span>
                                      </div>
                                      <div>
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
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                        })()}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    padding:40,
                    textAlign:'center',
                    background:'#f8fafc',
                    borderRadius:8,
                    border:'1px solid #e2e8f0'
                  }}>
                    <div style={{fontSize:48,marginBottom:16}}>🕐</div>
                    <p style={{
                      fontSize:16,
                      fontWeight:600,
                      color:'#1e293b',
                      margin:'0 0 8px 0'
                    }}>
                      No hay equipos en el historial
                    </p>
                  </div>
                )
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
        <div style={{width:'100%',height:'100%'}}>
          <h2 style={{marginBottom:24,display:'flex',alignItems:'center',gap:8,fontSize:28,fontWeight:700,color:'#1e293b'}}>
            🔧 Gestión de Instalaciones
          </h2>
          
          {error && <div style={{padding:12,background:'#fee2e2',color:'#991b1b',borderRadius:8,marginBottom:16}}>{error}</div>}
          {success && <div style={{padding:12,background:'#d1fae5',color:'#065f46',borderRadius:8,marginBottom:16}}>{success}</div>}
          
          {/* Equipos por instalar */}
          <div style={{background:'white',borderRadius:12,padding:24,boxShadow:'0 1px 3px rgba(0,0,0,0.1)',marginBottom:24,border:'1px solid #e2e8f0'}}>
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
                      <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Código de Registro</th>
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
                        <td style={{padding:12,fontSize:12,color:'#64748b'}}>{eq.codigo_registro || 'N/A'}</td>
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
          <div style={{background:'white',borderRadius:12,padding:24,boxShadow:'0 1px 3px rgba(0,0,0,0.1)',marginBottom:24,border:'1px solid #e2e8f0'}}>
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
              
                <div>
                  <div style={{color:'#64748b',marginBottom:4,fontSize:12,fontWeight:600}}>Código de </div>
                  <div style={{color:'#1e293b'}}>{equipoEnInstalacion.codigo_registro || 'Sin asignar'}</div>
                </div>
              </div>
            </div>

            {error && <div style={{padding:12,background:'#fee2e2',color:'#991b1b',borderRadius:8,marginBottom:16}}>{error}</div>}
            {success && <div style={{padding:12,background:'#d1fae5',color:'#065f46',borderRadius:8,marginBottom:16}}>{success}</div>}
            
            <div style={{marginBottom:20,padding:16,background:'#fef3c7',borderRadius:8,border:'1px solid #fbbf24'}}>
              <p style={{margin:0,fontSize:14,color:'#92400e',lineHeight:1.5}}>
                ℹ️ Favor de revisar la informacion del equipo al realizar la instalación, una vez finalizado el servicio el equipo pasará a la lista de equipos a censar para realizar la activacion.
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

      {/* Vista de Tickets de Soporte */}
      {view==='tickets' && (
        <div style={{width:'100%',height:'100%'}}>
          <h2 style={{marginBottom:24,display:'flex',alignItems:'center',gap:8,fontSize:28,fontWeight:700,color:'#1e293b'}}>
            🎫 Tickets de Soporte
          </h2>
          
          {error && <div style={{padding:12,background:'#fee2e2',color:'#991b1b',borderRadius:8,marginBottom:16}}>{error}</div>}
          {success && <div style={{padding:12,background:'#d1fae5',color:'#065f46',borderRadius:8,marginBottom:16}}>{success}</div>}
          
          {/* Lista de Tickets */}
          <div style={{background:'white',borderRadius:12,padding:24,boxShadow:'0 1px 3px rgba(0,0,0,0.1)',border:'1px solid #e2e8f0'}}>
            <h3 style={{fontSize:18,fontWeight:600,color:'#1e293b',marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
              📋 Todos los Tickets ({tickets.length})
            </h3>
            
            {tickets.length === 0 ? (
              <div style={{padding:40,textAlign:'center',background:'#f8fafc',borderRadius:8,border:'1px solid #e2e8f0'}}>
                <div style={{fontSize:48,marginBottom:16}}>🎫</div>
                <p style={{fontSize:16,fontWeight:600,color:'#1e293b',margin:'0 0 8px 0'}}>
                  No hay tickets de soporte
                </p>
                <p style={{fontSize:14,color:'#64748b',margin:0}}>
                  Los tickets creados por clientes aparecerán aquí
                </p>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                {tickets.map(ticket => (
                  <div 
                    key={ticket.id} 
                    style={{
                      background:'#fafafa',
                      border:'2px solid #e2e8f0',
                      borderRadius:10,
                      padding:20,
                      transition:'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
                      // Cargar archivos al hacer hover
                      if (!archivosTicketsPorId[ticket.id]) {
                        fetchArchivosTicket(ticket.id)
                      }
                    }}
                    onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                  >
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',marginBottom:16}}>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,flexWrap:'wrap'}}>
                          <h4 style={{margin:0,fontSize:16,fontWeight:600,color:'#1e293b'}}>
                            {ticket.asunto || ticket.titulo}
                          </h4>
                          <span style={{
                            padding:'4px 10px',
                            borderRadius:12,
                            fontSize:11,
                            fontWeight:600,
                            background: ticket.status === 'abierto' ? '#fef3c7' : ticket.status === 'en_proceso' ? '#dbeafe' : '#d1fae5',
                            color: ticket.status === 'abierto' ? '#92400e' : ticket.status === 'en_proceso' ? '#1e40af' : '#065f46'
                          }}>
                            {ticket.status === 'abierto' ? '🔔 Abierto' : ticket.status === 'en_proceso' ? '⚙️ En Proceso' : '✅ Resuelto'}
                          </span>
                          {ticket.categoria && (
                            <span style={{
                              padding:'4px 10px',
                              borderRadius:12,
                              fontSize:11,
                              fontWeight:600,
                              background:'#e0e7ff',
                              color:'#3730a3'
                            }}>
                              {ticket.categoria}
                            </span>
                          )}
                        </div>
                        
                        <p style={{margin:'8px 0',color:'#475569',fontSize:14}}>{ticket.descripcion}</p>
                        
                        <div style={{display:'flex',gap:16,fontSize:12,color:'#94a3b8',marginTop:12,flexWrap:'wrap'}}>
                          <span>👤 {ticket.cliente_nombre || 'Usuario'}</span>
                          {ticket.nombre_empresa && <span>🏢 {ticket.nombre_empresa}</span>}
                          <span>📅 {new Date(ticket.created_at).toLocaleDateString('es-MX')}</span>
                        </div>
                        
                        {/* Mostrar archivos adjuntos */}
                        {archivosTicketsPorId[ticket.id] && archivosTicketsPorId[ticket.id].length > 0 && (
                          <div style={{
                            marginTop:16,
                            padding:12,
                            background:'white',
                            borderRadius:8,
                            border:'1px solid #e2e8f0'
                          }}>
                            <div style={{fontSize:12,fontWeight:600,color:'#64748b',marginBottom:8}}>
                              📎 Archivos adjuntos ({archivosTicketsPorId[ticket.id].length})
                            </div>
                            <div style={{display:'flex',flexDirection:'column',gap:6}}>
                              {archivosTicketsPorId[ticket.id].map(archivo => (
                                <button
                                  key={archivo.id}
                                  onClick={() => descargarArchivo(archivo.id, archivo.nombre_original)}
                                  style={{
                                    display:'flex',
                                    alignItems:'center',
                                    gap:8,
                                    padding:'8px 12px',
                                    background:'#f8fafc',
                                    border:'1px solid #cbd5e1',
                                    borderRadius:6,
                                    cursor:'pointer',
                                    transition:'all 0.2s',
                                    fontSize:12
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#f1f5f9'
                                    e.currentTarget.style.borderColor = '#94a3b8'
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#f8fafc'
                                    e.currentTarget.style.borderColor = '#cbd5e1'
                                  }}
                                >
                                  <span>📄</span>
                                  <span style={{flex:1,textAlign:'left',color:'#475569'}}>
                                    {archivo.nombre_original}
                                  </span>
                                  {archivo.subido_por && (
                                    <span style={{color:'#94a3b8',fontSize:11}}>
                                      Subido por: Usuario #{archivo.subido_por}
                                    </span>
                                  )}
                                  {archivo.tamano_archivo && (
                                    <span style={{color:'#94a3b8',fontSize:11}}>
                                      {(archivo.tamano_archivo / 1024).toFixed(1)} KB
                                    </span>
                                  )}
                                  <span>⬇️</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Botones de acción */}
                      <div style={{display:'flex',gap:8,marginLeft:16,flexDirection:'column'}}>
                        {ticket.status === 'abierto' && (
                          <button
                            onClick={() => cambiarStatusTicket(ticket.id, 'en_proceso')}
                            style={{
                              padding:'6px 12px',
                              background:'#3b82f6',
                              color:'white',
                              border:'none',
                              borderRadius:6,
                              fontSize:12,
                              fontWeight:600,
                              cursor:'pointer',
                              whiteSpace:'nowrap'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#2563eb'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#3b82f6'}
                          >
                            ⚙️ En Proceso
                          </button>
                        )}
                        {ticket.status === 'en_proceso' && (
                          <button
                            onClick={() => cambiarStatusTicket(ticket.id, 'resuelto')}
                            style={{
                              padding:'6px 12px',
                              background:'#10b981',
                              color:'white',
                              border:'none',
                              borderRadius:6,
                              fontSize:12,
                              fontWeight:600,
                              cursor:'pointer',
                              whiteSpace:'nowrap'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#059669'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#10b981'}
                          >
                            ✅ Resolver
                          </button>
                        )}
                        {ticket.status === 'resuelto' && (
                          <button
                            onClick={() => cambiarStatusTicket(ticket.id, 'abierto')}
                            style={{
                              padding:'6px 12px',
                              background:'#f59e0b',
                              color:'white',
                              border:'none',
                              borderRadius:6,
                              fontSize:12,
                              fontWeight:600,
                              cursor:'pointer',
                              whiteSpace:'nowrap'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#d97706'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#f59e0b'}
                          >
                            🔄 Reabrir
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
