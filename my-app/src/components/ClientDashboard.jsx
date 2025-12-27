import { useState, useEffect, useRef } from 'react'

export default function ClientDashboard(){
  const [view, setView] = useState('home')
  const [form, setForm] = useState({ marca:'', modelo:'', no_serie:'', codigo_registro:'', memoria_ram:'', disco_duro:'', serie_disco_duro:'', sistema_operativo:'', procesador:'', nombre_usuario_equipo:'', tipo_equipo:'', nombre_equipo:'' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isPolling, setIsPolling] = useState(false)
  const [myRequests, setMyRequests] = useState([])
  const [lastRequestId, setLastRequestId] = useState(null)
  const pollingIntervalRef = useRef(null)
  const pollingTimeoutRef = useRef(null)

  async function fetchMyRequests(){
    try{
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const res = await fetch(`${API}/equipment-requests/mine`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if(res.ok){
        const data = await res.json()
        console.log('Datos recibidos:', data.requests.length, 'solicitudes')
        console.log('isPolling:', isPolling, 'lastRequestId:', lastRequestId)
        
        setMyRequests(data.requests || [])
        
        // Solo llenar formulario si está en polling (esperando datos del software descargado)
        if(data.requests.length > 0){
          const newRequest = data.requests[0]
          console.log('Primera solicitud ID:', newRequest.id, 'Última ID conocida:', lastRequestId)
          
          if(isPolling && newRequest.id !== lastRequestId){
            console.log('¡Nueva solicitud detectada! Llenando formulario...')
            setLastRequestId(newRequest.id)
            
            // Llenar formulario con los datos detectados por el software
            setForm({
              marca: newRequest.marca || '',
              modelo: newRequest.modelo || '',
              no_serie: newRequest.no_serie || '',
              codigo_registro: newRequest.codigo_registro || '',
              memoria_ram: newRequest.memoria_ram || '',
              disco_duro: newRequest.disco_duro || '',
              serie_disco_duro: newRequest.serie_disco_duro || '',
              sistema_operativo: newRequest.sistema_operativo || '',
              procesador: newRequest.procesador || '',
              nombre_usuario_equipo: newRequest.nombre_usuario_equipo || '',
              tipo_equipo: newRequest.tipo_equipo || '',
              nombre_equipo: newRequest.nombre_equipo || ''
            })
            
            setIsPolling(false)
            setSuccess('✓ ¡Censo recibido! Los datos del equipo se han cargado en el formulario.')
            
            // Detener polling
            if(pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
            if(pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current)
          } else {
            console.log('Condición no cumplida para llenar formulario')
          }
        } else {
          console.log('No hay solicitudes disponibles')
        }
      }
    }catch(e){ console.error('Error fetching requests', e) }
  }

  async function handleDownloadAutoTool(){
    setError(''); setSuccess('')
    try{
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      
      console.log('Descargando herramienta automática...')
      
      // Descargar script con token embebido
      const res = await fetch(`${API}/download/census-tool-auto`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      console.log('Respuesta:', res.status, res.statusText)
      
      if (!res.ok) {
        const errorText = await res.text()
        console.error('Error descarga:', errorText)
        setError('Error al descargar la herramienta: ' + res.status)
        return
      }
      
      const blob = await res.blob()
      console.log('Blob creado:', blob.size, 'bytes')
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'censo_equipos.sh'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      setSuccess('✓ Archivo censo_equipos.sh descargado.\n\nPara ejecutarlo:\n1. Abre una terminal en la carpeta de descargas\n2. Ejecuta: chmod +x censo_equipos.sh\n3. Ejecuta: ./censo_equipos.sh\n\nEl censo se ejecutará automáticamente...')
      setIsPolling(true)
      
      // Limpiar polling anterior si existe
      if(pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
      if(pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current)
      
      // Iniciar polling cada 3 segundos
      pollingIntervalRef.current = setInterval(async ()=>{
        console.log('Polling: consultando nuevas solicitudes...')
        await fetchMyRequests()
      }, 3000)
      
      // Detener polling después de 2 minutos
      pollingTimeoutRef.current = setTimeout(()=>{
        if(pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
        setIsPolling(false)
        setError('Tiempo de espera agotado. Por favor, verifica que ejecutaste la herramienta.')
      }, 120000)
      
    }catch(e){
      console.error('Error en handleDownloadAutoTool:', e)
      setError('Error al descargar la herramienta: ' + e.message)
    }
  }

  async function handleCensusSubmit(e){
    e.preventDefault(); setError(''); setSuccess('')
    try{
      const token = localStorage.getItem('token')
      const user = JSON.parse(localStorage.getItem('user'))
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const res = await fetch(`${API}/equipment-requests`, {
        method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
        body: JSON.stringify({ ...form, empresa_id: user.empresa_id })
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Error al solicitar censo')
      
      setSuccess('✓ Solicitud enviada exitosamente. Puedes censar otro equipo.')
      
      // Limpiar formulario
      setForm({ marca:'', modelo:'', no_serie:'', codigo_registro:'', memoria_ram:'', disco_duro:'', serie_disco_duro:'', sistema_operativo:'', procesador:'', nombre_usuario_equipo:'', tipo_equipo:'', nombre_equipo:'' })
      
      // Actualizar lista de solicitudes
      await fetchMyRequests()
      
      // Resetear estado para permitir nuevo censo
      setLastRequestId(null)
      
    }catch(e){ setError('Error de conexión') }
  }
  
  // Cargar solicitudes al montar y cambiar vista
  useEffect(()=>{
    if(view==='census') fetchMyRequests()
  }, [view])

  return (
    <div style={{display:'flex',height:'calc(100vh - 80px)'}}>
      <div style={{width:200,background:'#1e293b',padding:16,color:'white'}}>
        <h3 style={{margin:'0 0 16px 0',fontSize:16}}>Menú</h3>
        <button onClick={()=>setView('home')} style={{display:'block',width:'100%',padding:8,marginBottom:8,background:view==='home'?'#334155':'transparent',border:'none',color:'white',textAlign:'left',cursor:'pointer',borderRadius:4}}>Inicio</button>
        <button onClick={()=>setView('census')} style={{display:'block',width:'100%',padding:8,marginBottom:8,background:view==='census'?'#334155':'transparent',border:'none',color:'white',textAlign:'left',cursor:'pointer',borderRadius:4}}>Censar Equipo</button>
      </div>
      <div style={{flex:1,padding:24,overflow:'auto'}}>
        {view==='home' && (
          <div>
            <h2>Dashboard de Cliente</h2>
            <p>Bienvenido al portal. Usa el menú lateral para censar equipos.</p>
          </div>
        )}
        {view==='census' && (
          <div>
            <h2>Solicitar Censo de Equipo</h2>
            
            {/* Censo Automático */}
            <div style={{background:'#f0fdf4',border:'2px solid #10b981',borderRadius:8,padding:20,marginBottom:20,maxWidth:700}}>
              <h3 style={{margin:'0 0 8px 0',fontSize:18,color:'#047857'}}>⚡ Censo Automático (Recomendado)</h3>
              <p style={{margin:'0 0 16px 0',fontSize:14,color:'#065f46'}}>La forma más rápida y precisa. El software detecta automáticamente todo el hardware.</p>
              <button type='button' onClick={handleDownloadAutoTool} disabled={isPolling} style={{padding:'12px 24px',background:isPolling?'#94a3b8':'#10b981',color:'white',border:'none',borderRadius:6,cursor:isPolling?'not-allowed':'pointer',fontSize:15,fontWeight:600}}>
                {isPolling ? '⏳ Esperando datos del software...' : '🚀 Descargar y Ejecutar Censo Automático'}
              </button>
              {isPolling && (
                <div style={{marginTop:16,padding:16,background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',borderRadius:8,color:'white'}}>
                  <div style={{display:'flex',alignItems:'center',marginBottom:12}}>
                    <div style={{width:40,height:40,border:'4px solid rgba(255,255,255,0.3)',borderTop:'4px solid white',borderRadius:'50%',animation:'spin 1s linear infinite',marginRight:12}}></div>
                    <div>
                      <div style={{fontSize:16,fontWeight:600}}>🔍 Leyendo componentes del equipo...</div>
                      <div style={{fontSize:12,opacity:0.9,marginTop:4}}>Por favor ejecuta el archivo censo_equipos.sh</div>
                    </div>
                  </div>
                  <div style={{fontSize:13,opacity:0.95,lineHeight:1.6}}>
                    <div>✓ Detectando procesador, memoria RAM y disco duro...</div>
                    <div>✓ Identificando sistema operativo...</div>
                    <div>✓ Recopilando números de serie...</div>
                  </div>
                  <style>{
                    `@keyframes spin {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }`
                  }</style>
                </div>
              )}
            </div>
            
            {/* Mis Solicitudes Recientes */}
            {myRequests.length > 0 && (
              <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:8,padding:16,marginBottom:20,maxWidth:700}}>
                <h3 style={{margin:'0 0 12px 0',fontSize:16,color:'#1e293b'}}>📋 Mis Solicitudes Recientes</h3>
                <div style={{maxHeight:200,overflow:'auto'}}>
                  {myRequests.slice(0,3).map(req=>(
                    <div key={req.id} style={{padding:12,marginBottom:8,background:'#f8fafc',borderRadius:4,borderLeft:'3px solid #10b981'}}>
                      <div style={{fontSize:13,color:'#334155',marginBottom:4}}><strong>{req.marca} {req.modelo}</strong> - {req.tipo_equipo}</div>
                      <div style={{fontSize:11,color:'#64748b'}}>Serie: {req.no_serie} | {new Date(req.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Formulario Manual */}
            <h3 style={{fontSize:18,marginBottom:12,marginTop:32}}>Formulario Manual</h3>
            <form onSubmit={handleCensusSubmit} style={{maxWidth:600}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <label>Marca *<br/><input required value={form.marca} onChange={e=>setForm({...form,marca:e.target.value})} style={{width:'100%',padding:8}} /></label>
                <label>Modelo *<br/><input required value={form.modelo} onChange={e=>setForm({...form,modelo:e.target.value})} style={{width:'100%',padding:8}} /></label>
                <label>No. Serie *<br/><input required value={form.no_serie} onChange={e=>setForm({...form,no_serie:e.target.value})} style={{width:'100%',padding:8}} /></label>
                <label>Código Registro<br/><input value={form.codigo_registro} onChange={e=>setForm({...form,codigo_registro:e.target.value})} style={{width:'100%',padding:8}} /></label>
                <label>Memoria RAM<br/><input value={form.memoria_ram} onChange={e=>setForm({...form,memoria_ram:e.target.value})} style={{width:'100%',padding:8}} placeholder="Ej: 8GB" /></label>
                <label>Disco Duro<br/><input value={form.disco_duro} onChange={e=>setForm({...form,disco_duro:e.target.value})} style={{width:'100%',padding:8}} placeholder="Ej: 500GB SSD" /></label>
                <label>Serie Disco Duro<br/><input value={form.serie_disco_duro} onChange={e=>setForm({...form,serie_disco_duro:e.target.value})} style={{width:'100%',padding:8}} /></label>
                <label>Sistema Operativo<br/><input value={form.sistema_operativo} onChange={e=>setForm({...form,sistema_operativo:e.target.value})} style={{width:'100%',padding:8}} placeholder="Ej: Windows 11" /></label>
                <label>Procesador<br/><input value={form.procesador} onChange={e=>setForm({...form,procesador:e.target.value})} style={{width:'100%',padding:8}} placeholder="Ej: Intel i5" /></label>
                <label>Nombre Usuario (Empleado)<br/><input value={form.nombre_usuario_equipo} onChange={e=>setForm({...form,nombre_usuario_equipo:e.target.value})} style={{width:'100%',padding:8}} /></label>
                <label>Tipo de Equipo<br/><input value={form.tipo_equipo} onChange={e=>setForm({...form,tipo_equipo:e.target.value})} style={{width:'100%',padding:8}} placeholder="Ej: Laptop, Desktop" /></label>
                <label>Nombre de Equipo<br/><input value={form.nombre_equipo} onChange={e=>setForm({...form,nombre_equipo:e.target.value})} style={{width:'100%',padding:8}} /></label>
              </div>
              {error && <div style={{color:'#ff6b6b',marginTop:12}}>{error}</div>}
              {success && <div style={{color:'#51cf66',marginTop:12}}>{success}</div>}
              <button type='submit' style={{marginTop:16,padding:'10px 20px',background:'#4f46e5',color:'white',border:'none',borderRadius:6,cursor:'pointer'}}>Enviar Solicitud</button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}