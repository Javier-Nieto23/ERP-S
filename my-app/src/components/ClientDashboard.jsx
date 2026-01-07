import { useState, useEffect, useRef } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import StripePaymentModal from './StripePaymentModal'

// Inyectar estilos de animación
const styles = document.createElement('style')
styles.textContent = `
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`
if (!document.querySelector('#censo-animations')) {
  styles.id = 'censo-animations'
  document.head.appendChild(styles)
}

// Componente para el formulario de pago de servicio
function ServicioPaymentForm({ monto, datosEquipo, onSuccess, onError }) {
  const stripe = useStripe()
  const elements = useElements()
  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!stripe || !elements) return

    setProcesando(true)
    setMensaje('')

    try {
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const token = localStorage.getItem('token')

      // Crear Payment Intent
      const resIntent = await fetch(`${API}/servicios/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          monto: monto,
          concepto: 'Servicio de Instalación'
        })
      })

      if (!resIntent.ok) {
        const errorData = await resIntent.json()
        throw new Error(errorData.error || 'Error al crear el pago')
      }

      const { clientSecret, paymentIntentId } = await resIntent.json()

      // Confirmar el pago con Stripe
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)
        }
      })

      if (stripeError) {
        throw new Error(stripeError.message)
      }

      if (paymentIntent.status === 'succeeded') {
        // Confirmar en backend y enviar datos del equipo
        const resConfirm = await fetch(`${API}/servicios/confirm-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ 
            paymentIntentId: paymentIntent.id,
            datosEquipo: datosEquipo || null
          })
        })

        if (!resConfirm.ok) {
          throw new Error('Error al confirmar el pago')
        }

        setMensaje('✓ Pago procesado exitosamente')
        if (onSuccess) onSuccess()
      }
    } catch (err) {
      setMensaje(err.message || 'Error al procesar el pago')
      if (onError) onError(err)
    } finally {
      setProcesando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{
        background: '#f8fafc',
        border: '2px solid #e2e8f0',
        borderRadius: 8,
        padding: 20,
        marginBottom: 16
      }}>
        <CardElement options={{
          style: {
            base: {
              fontSize: '16px',
              color: '#1e293b',
              '::placeholder': { color: '#94a3b8' }
            }
          }
        }} />
      </div>

      {mensaje && (
        <div style={{
          padding: 12,
          background: mensaje.includes('✓') ? '#d1fae5' : '#fee2e2',
          color: mensaje.includes('✓') ? '#065f46' : '#991b1b',
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 14
        }}>
          {mensaje}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || procesando}
        style={{
          width: '100%',
          padding: 16,
          background: procesando ? '#94a3b8' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          fontSize: 18,
          fontWeight: 600,
          cursor: procesando ? 'not-allowed' : 'pointer',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
        }}
      >
        {procesando ? '⏳ Procesando...' : `💳 Pagar $${monto.toLocaleString()} MXN`}
      </button>
    </form>
  )
}

export default function ClientDashboard(){
  const [view, setView] = useState('home')
  const [form, setForm] = useState({ marca:'', modelo:'', no_serie:'', codigo_registro:'', memoria_ram:'', disco_duro:'', serie_disco_duro:'', sistema_operativo:'', procesador:'', nombre_usuario_equipo:'', tipo_equipo:'', nombre_equipo:'', empleado_id:'' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isPolling, setIsPolling] = useState(false)
  const [myRequests, setMyRequests] = useState([])
  const [lastRequestId, setLastRequestId] = useState(null)
  const pollingIntervalRef = useRef(null)
  const pollingTimeoutRef = useRef(null)
  
  // Estados para tickets
  const [tickets, setTickets] = useState([])
  const [ticketForm, setTicketForm] = useState({ titulo: '', descripcion: '', prioridad: 'media' })

  // Estados para el flujo de censo
  const [tipoEquipoSeleccionado, setTipoEquipoSeleccionado] = useState('') // 'laptop' o 'escritorio'
  const [mostrarAvisoLaptop, setMostrarAvisoLaptop] = useState(false)
  const [archivoResponsiva, setArchivoResponsiva] = useState(null)
  
  // Estados para suscripción y pagos
  const [suscripcion, setSuscripcion] = useState(null)
  const [planes, setPlanes] = useState(null)
  const [mostrarPagos, setMostrarPagos] = useState(false)
  const [stripePromise, setStripePromise] = useState(null)
  const [cargandoPago, setCargandoPago] = useState(false)
  const [responsaDescargada, setResponsivaDescargada] = useState(false)
  const [membresiaActiva, setMembresiaActiva] = useState(false)

  // Estados para empleados
  const [empleados, setEmpleados] = useState([])
  const [empleadoForm, setEmpleadoForm] = useState({ id_empleado: '', nombre_empleado: '' })
  const [empleadoEditando, setEmpleadoEditando] = useState(null)

  // Estados para perfil
  const [perfil, setPerfil] = useState(null)

  // Estados para equipos
  const [equipos, setEquipos] = useState([])
  const [equipoAProgramar, setEquipoAProgramar] = useState(null)
  const [fechaCenso, setFechaCenso] = useState('')
  const [userRole, setUserRole] = useState('')

  // Estados para instalación
  const [instalacionStep, setInstalacionStep] = useState(1) // 1: config, 2: censo, 3: pago
  const [instalacionConfig, setInstalacionConfig] = useState({
    tipoEquipo: '',
    numBasesDatos: '',
    nombresBD: [] // Array dinámico para nombres de bases de datos
  })
  const [instalacionForm, setInstalacionForm] = useState({ 
    marca:'', modelo:'', no_serie:'', codigo_registro:'', memoria_ram:'', 
    disco_duro:'', serie_disco_duro:'', sistema_operativo:'', procesador:'', 
    nombre_usuario_equipo:'', tipo_equipo:'', nombre_equipo:'', empleado_id:'' 
  })
  const [mostrarModalEmpleado, setMostrarModalEmpleado] = useState(false)

  // Cargar configuración de Stripe al montar
  useEffect(() => {
    // Obtener rol del usuario desde localStorage
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    setUserRole(user.rol || '')
    
    async function loadStripeConfig() {
      try {
        const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
        const res = await fetch(`${API}/stripe/config`)
        if (res.ok) {
          const { publishableKey } = await res.json()
          setStripePromise(loadStripe(publishableKey))
        }
      } catch (e) {
        console.error('Error loading Stripe config:', e)
      }
    }
    loadStripeConfig()
    
    // Verificar si regresó de un pago
    const urlParams = new URLSearchParams(window.location.search)
    const pagoStatus = urlParams.get('pago')
    if (pagoStatus === 'exitoso') {
      setSuccess('✅ ¡Pago procesado exitosamente! Tu suscripción ha sido activada.')
      setView('perfil')
      // Limpiar URL
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (pagoStatus === 'cancelado') {
      setError('❌ Pago cancelado. No se realizó ningún cargo.')
      setView('perfil')
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  // Verificar membresía al iniciar sesión o refrescar página
  useEffect(() => {
    async function verificarMembresiaInicial() {
      try {
        const token = localStorage.getItem('token')
        const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
        
        const resSuscripcion = await fetch(`${API}/suscripcion/estado`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if(resSuscripcion.ok) {
          const dataSuscripcion = await resSuscripcion.json()
          setSuscripcion(dataSuscripcion.suscripcion)
          
          // Verificar si la membresía está activa
          const esActiva = dataSuscripcion.suscripcion && 
                          dataSuscripcion.suscripcion.estado === 'activa' && 
                          dataSuscripcion.suscripcion.dias_restantes > 0
          setMembresiaActiva(esActiva)
          console.log('🔍 Verificación inicial de membresía:', esActiva ? 'ACTIVA' : 'INACTIVA')
        }
      } catch(e) {
        console.error('Error verificando membresía inicial:', e)
      }
    }
    
    verificarMembresiaInicial()
  }, [])

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
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      
      console.log('Descargando herramienta de detección...')
      
      // Descargar script sin autenticación
      const res = await fetch(`${API}/download/census-tool-auto`)
      
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
      
      setSuccess('✓ Herramienta para Linux descargada.\n\nPara ejecutarlo:\n1. Abre una terminal en la carpeta de descargas\n2. Ejecuta: chmod +x censo_equipos.sh\n3. Ejecuta: ./censo_equipos.sh\n\nSe generará un archivo .txt. Súbelo usando el botón de carga más abajo.')
      
    }catch(e){
      console.error('Error en handleDownloadAutoTool:', e)
      setError('Error al descargar la herramienta: ' + e.message)
    }
  }

  async function handleDownloadWindowsTool(){
    setError(''); setSuccess('')
    try{
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      
      console.log('Descargando herramienta para Windows...')
      
      const res = await fetch(`${API}/download/census-tool-windows`)
      
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
      a.download = 'censo_equipos.bat'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      setSuccess('✓ Herramienta para Windows descargada.\n\nPara ejecutarlo:\n1. Ve a la carpeta de descargas\n2. Haz doble clic en censo_equipos.bat\n\nSe generará un archivo .txt. Súbelo usando el botón de carga más abajo.')
      
    }catch(e){
      console.error('Error en handleDownloadWindowsTool:', e)
      setError('Error al descargar la herramienta: ' + e.message)
    }
  }

  // Funciones para manejo de tipo de equipo
  function handleSeleccionEscritorio(){
    setTipoEquipoSeleccionado('escritorio')
    setForm({...form, tipo_equipo: 'Escritorio'})
  }

  function handleSeleccionLaptop(){
    setMostrarAvisoLaptop(true)
  }

  async function handleDescargarResponsiva(){
    try{
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const res = await fetch(`${API}/download/responsiva-template`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if(!res.ok) throw new Error('Error al descargar responsiva')
      
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'responsiva_laptop.docx'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      setResponsivaDescargada(true)
      setSuccess('✓ Documento descargado. Por favor, llénalo, fírmalo y súbelo.')
    }catch(e){
      setError('Error al descargar documento de responsiva')
    }
  }

  function handleAceptarAvisoLaptop(){
    setTipoEquipoSeleccionado('laptop')
    setForm({...form, tipo_equipo: 'Laptop'})
    setMostrarAvisoLaptop(false)
  }

  function handleArchivoResponsivaChange(e){
    const file = e.target.files[0]
    if(file){
      setArchivoResponsiva(file)
      setSuccess('✓ Archivo de responsiva seleccionado')
    }
  }

  function handleFileUpload(e){
    const file = e.target.files[0]
    if(!file){
      setError('No se seleccionó ningún archivo')
      return
    }
    
    if(!file.name.endsWith('.txt')){
      setError('Por favor selecciona un archivo .txt')
      return
    }
    
    const reader = new FileReader()
    reader.onload = (event) => {
      try{
        const content = event.target.result
        const lines = content.split('\n')
        const data = {}
        
        // Parsear el archivo txt
        lines.forEach(line => {
          if(line.includes('=')){
            const [key, value] = line.split('=')
            if(key && value){
              data[key.trim()] = value.trim()
            }
          }
        })
        
        console.log('Datos parseados:', data)
        
        // Llenar formulario con los datos del archivo
        setForm({
          marca: data.marca || '',
          modelo: data.modelo || '',
          no_serie: data.no_serie || '',
          codigo_registro: '',
          memoria_ram: data.memoria_ram || '',
          disco_duro: data.disco_duro || '',
          serie_disco_duro: data.serie_disco_duro || '',
          sistema_operativo: data.sistema_operativo || '',
          procesador: data.procesador || '',
          nombre_usuario_equipo: data.nombre_usuario_equipo || '',
          tipo_equipo: data.tipo_equipo || '',
          nombre_equipo: data.nombre_equipo || ''
        })
        
        // No mostrar mensaje de éxito aquí, solo cuando se complete el censo
        setError('')
        
      }catch(err){
        console.error('Error al parsear archivo:', err)
        setError('Error al leer el archivo. Asegúrate de que sea el archivo generado por la herramienta.')
      }
    }
    
    reader.onerror = () => {
      setError('Error al leer el archivo')
    }
    
    reader.readAsText(file)
  }

  function handleClearForm(){
    setForm({ marca:'', modelo:'', no_serie:'', codigo_registro:'', memoria_ram:'', disco_duro:'', serie_disco_duro:'', sistema_operativo:'', procesador:'', nombre_usuario_equipo:'', tipo_equipo:'', nombre_equipo:'' })
    setError('')
    setSuccess('✓ Formulario limpiado')
  }

  async function handleCensusSubmit(e){
    e.preventDefault(); setError(''); setSuccess('')
    
    // Validar que si es laptop, se haya subido el archivo de responsiva
    if(form.tipo_equipo === 'Laptop' && !archivoResponsiva){
      setError('Debes subir el archivo de responsiva firmado para laptops')
      return
    }
    
    try{
      const token = localStorage.getItem('token')
      const user = JSON.parse(localStorage.getItem('user'))
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      
      // Crear FormData para enviar archivo y datos
      const formData = new FormData()
      formData.append('marca', form.marca)
      formData.append('modelo', form.modelo)
      formData.append('no_serie', form.no_serie)
      formData.append('codigo_registro', form.codigo_registro)
      formData.append('memoria_ram', form.memoria_ram)
      formData.append('disco_duro', form.disco_duro)
      formData.append('serie_disco_duro', form.serie_disco_duro)
      formData.append('sistema_operativo', form.sistema_operativo)
      formData.append('procesador', form.procesador)
      formData.append('nombre_usuario_equipo', form.nombre_usuario_equipo)
      formData.append('tipo_equipo', form.tipo_equipo)
      formData.append('nombre_equipo', form.nombre_equipo)
      formData.append('empresa_id', user.empresa_id)
      formData.append('empleado_id', form.empleado_id) // Agregar ID del empleado
      
      // Agregar archivo de responsiva si existe
      if(archivoResponsiva){
        formData.append('responsiva', archivoResponsiva)
      }
      
      const res = await fetch(`${API}/equipment-requests`, {
        method:'POST', 
        headers:{ Authorization:`Bearer ${token}` },
        body: formData
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Error al solicitar censo')
      
      setSuccess('✓ Solicitud enviada exitosamente. Puedes censar otro equipo.')
      
      // Limpiar formulario y estados
      setForm({ marca:'', modelo:'', no_serie:'', codigo_registro:'', memoria_ram:'', disco_duro:'', serie_disco_duro:'', sistema_operativo:'', procesador:'', nombre_usuario_equipo:'', tipo_equipo:'', nombre_equipo:'', empleado_id:'' })
      setTipoEquipoSeleccionado('')
      setArchivoResponsiva(null)
      setResponsivaDescargada(false)
      
      // Actualizar lista de solicitudes
      await fetchMyRequests()
      
      // Resetear estado para permitir nuevo censo
      setLastRequestId(null)
      
    }catch(e){ setError('Error de conexión') }
  }
  
  // Cargar solicitudes al montar y cambiar vista
  useEffect(()=>{
    // Limpiar mensajes al cambiar de vista
    setError('')
    setSuccess('')
    
    if(view==='census') {
      fetchMyRequests()
      fetchEmpleados() // Cargar empleados para el combobox
    }
    if(view==='tickets') fetchTickets()
    if(view==='empleados') fetchEmpleados()
    if(view==='perfil') fetchPerfil()
    if(view==='equipos') fetchEquipos()
  }, [view])

  async function fetchTickets(){
    try{
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const res = await fetch(`${API}/tickets/mine`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if(res.ok){
        const data = await res.json()
        setTickets(data.tickets || [])
      }
    }catch(e){ console.error('Error fetching tickets', e) }
  }

  // ==================== EMPLEADOS ====================
  
  async function fetchEmpleados(){
    try{
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const res = await fetch(`${API}/empleados`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if(res.ok){
        const data = await res.json()
        setEmpleados(data.empleados || [])
      }
    }catch(e){ console.error('Error fetching empleados', e) }
  }

  async function handleEmpleadoSubmit(e){
    e.preventDefault(); setError(''); setSuccess('')
    try{
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      
      if(empleadoEditando){
        // Actualizar empleado existente
        const res = await fetch(`${API}/empleados/${empleadoEditando.id}`, {
          method:'PUT',
          headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
          body: JSON.stringify(empleadoForm)
        })
        const data = await res.json()
        if (!res.ok) return setError(data.error || 'Error al actualizar empleado')
        setSuccess('✓ Empleado actualizado exitosamente')
      } else {
        // Crear nuevo empleado
        const res = await fetch(`${API}/empleados`, {
          method:'POST',
          headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
          body: JSON.stringify(empleadoForm)
        })
        const data = await res.json()
        if (!res.ok) return setError(data.error || 'Error al crear empleado')
        setSuccess('✓ Empleado registrado exitosamente')
      }
      
      setEmpleadoForm({ id_empleado: '', nombre_empleado: '' })
      setEmpleadoEditando(null)
      await fetchEmpleados()
    }catch(e){ setError('Error de conexión') }
  }

  function handleEditarEmpleado(empleado){
    setEmpleadoEditando(empleado)
    setEmpleadoForm({ id_empleado: empleado.id_empleado, nombre_empleado: empleado.nombre_empleado })
    window.scrollTo(0, 0)
  }

  function handleCancelarEdicion(){
    setEmpleadoEditando(null)
    setEmpleadoForm({ id_empleado: '', nombre_empleado: '' })
    setError('')
  }

  async function handleEliminarEmpleado(id){
    if(!confirm('¿Estás seguro de eliminar este empleado?')) return
    try{
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const res = await fetch(`${API}/empleados/${id}`, {
        method:'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Error al eliminar empleado')
      setSuccess('✓ Empleado eliminado exitosamente')
      await fetchEmpleados()
    }catch(e){ setError('Error de conexión') }
  }

  // ==================== PERFIL ====================
  
  async function fetchPerfil(){
    try{
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const res = await fetch(`${API}/perfil`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if(res.ok){
        const data = await res.json()
        setPerfil(data.perfil || null)
      }
      
      // También cargar suscripción y planes
      const resSuscripcion = await fetch(`${API}/suscripcion/estado`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if(resSuscripcion.ok){
        const dataSuscripcion = await resSuscripcion.json()
        setSuscripcion(dataSuscripcion.suscripcion)
        // Verificar si la membresía está activa
        const esActiva = dataSuscripcion.suscripcion && 
                        dataSuscripcion.suscripcion.estado === 'activa' && 
                        dataSuscripcion.suscripcion.dias_restantes > 0
        setMembresiaActiva(esActiva)
      }
      
      const resPlanes = await fetch(`${API}/planes`)
      if(resPlanes.ok){
        const dataPlanes = await resPlanes.json()
        setPlanes(dataPlanes.planes)
      }
    }catch(e){ console.error('Error fetching perfil', e) }
  }

  async function fetchEquipos(){
    try{
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const res = await fetch(`${API}/equipos`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if(res.ok){
        const data = await res.json()
        console.log('📦 Equipos recibidos:', data.equipos)
        if(data.equipos && data.equipos.length > 0) {
          console.log('📦 Primer equipo status:', data.equipos[0].status)
        }
        setEquipos(data.equipos || [])
      }
    }catch(e){ console.error('Error fetching equipos', e) }
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

  async function handleProcesarPago(plan){
    setError(''); setSuccess('')
    setCargandoPago(true)
    
    try{
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      
      // Verificar que Stripe esté cargado
      if (!stripePromise) {
        setCargandoPago(false)
        setMostrarPagos(false)
        return setError('❌ Error: Stripe no se ha cargado correctamente. Por favor, recarga la página.')
      }
      
      // Crear sesión de Stripe
      const res = await fetch(`${API}/pagos/crear-sesion`, {
        method:'POST',
        headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
        body: JSON.stringify({ plan })
      })
      
      if (!res.ok) {
        const data = await res.json()
        setCargandoPago(false)
        setMostrarPagos(false)
        return setError(`❌ ${data.error || 'Error al crear sesión de pago'}`)
      }
      
      const data = await res.json()
      
      // Redirigir a Stripe Checkout
      const stripe = await stripePromise
      const { error } = await stripe.redirectToCheckout({
        sessionId: data.sessionId
      })
      
      if (error) {
        setCargandoPago(false)
        setMostrarPagos(false)
        setError(`❌ Error de Stripe: ${error.message}`)
      }
      // Si no hay error, el usuario será redirigido automáticamente
      
    }catch(e){ 
      console.error('Error en handleProcesarPago:', e)
      setCargandoPago(false)
      setMostrarPagos(false)
      setError('❌ Error de conexión al procesar pago. Verifica tu internet e intenta de nuevo.') 
    }
  }

  async function handleTicketSubmit(e){
    e.preventDefault(); setError(''); setSuccess('')
    try{
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const res = await fetch(`${API}/tickets`, {
        method:'POST', 
        headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
        body: JSON.stringify(ticketForm)
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Error al crear ticket')
      setSuccess('✓ Ticket creado exitosamente')
      setTicketForm({ asunto: '', descripcion: '', prioridad: 'media' })
      await fetchTickets()
    }catch(e){ setError('Error de conexión') }
  }

  return (
    <div style={{display:'flex',height:'calc(100vh - 80px)'}}>
      <div style={{width:200,background:'#1e293b',padding:16,color:'white',display:'flex',flexDirection:'column'}}>
        <h3 style={{margin:'0 0 16px 0',fontSize:16}}>Menú</h3>
        <button onClick={()=>setView('home')} style={{display:'block',width:'100%',padding:8,marginBottom:8,background:view==='home'?'#334155':'transparent',border:'none',color:'white',textAlign:'left',cursor:'pointer',borderRadius:4}}>Inicio</button>
        <button onClick={()=>setView('perfil')} style={{display:'block',width:'100%',padding:8,marginBottom:8,background:view==='perfil'?'#334155':'transparent',border:'none',color:'white',textAlign:'left',cursor:'pointer',borderRadius:4}}>👤 Mi Perfil</button>
        <button onClick={()=>setView('empleados')} style={{display:'block',width:'100%',padding:8,marginBottom:8,background:view==='empleados'?'#334155':'transparent',border:'none',color:'white',textAlign:'left',cursor:'pointer',borderRadius:4}}>Empleados</button>
        <button onClick={()=>setView('equipos')} style={{display:'block',width:'100%',padding:8,marginBottom:8,background:view==='equipos'?'#334155':'transparent',border:'none',color:'white',textAlign:'left',cursor:'pointer',borderRadius:4}}>📦 Equipos</button>
        <button onClick={()=>setView('instalacion')} style={{display:'block',width:'100%',padding:8,marginBottom:8,background:view==='instalacion'?'#334155':'transparent',border:'none',color:'white',textAlign:'left',cursor:'pointer',borderRadius:4}}>⬇️ Instalación</button>
        <button 
          onClick={()=>membresiaActiva ? setView('census') : setError('⚠️ Necesitas una membresía activa para censar equipos. Por favor, realiza un pago.')} 
          disabled={!membresiaActiva}
          style={{
            display:'block',
            width:'100%',
            padding:8,
            marginBottom:8,
            background:view==='census'?'#334155':'transparent',
            border:'none',
            color:membresiaActiva?'white':'#94a3b8',
            textAlign:'left',
            cursor:membresiaActiva?'pointer':'not-allowed',
            borderRadius:4,
            opacity:membresiaActiva?1:0.6
          }}
        >
          {membresiaActiva ? '📋 Censar Equipo' : '🔒 Censar Equipo (Bloqueado)'}
        </button>
        <button 
          onClick={()=>membresiaActiva ? setView('tickets') : setError('⚠️ Necesitas una membresía activa para crear tickets. Por favor, realiza un pago.')} 
          disabled={!membresiaActiva}
          style={{
            display:'block',
            width:'100%',
            padding:8,
            marginBottom:8,
            background:view==='tickets'?'#334155':'transparent',
            border:'none',
            color:membresiaActiva?'white':'#94a3b8',
            textAlign:'left',
            cursor:membresiaActiva?'pointer':'not-allowed',
            borderRadius:4,
            opacity:membresiaActiva?1:0.6
          }}
        >
          {membresiaActiva ? '🎫 Tickets' : '🔒 Tickets (Bloqueado)'}
        </button>
        
        {/* Botón de cerrar sesión al final */}
        <button 
          onClick={()=>{
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/';
          }} 
          style={{
            display:'block',
            width:'100%',
            padding:8,
            marginTop:'auto',
            background:'#ef4444',
            border:'none',
            color:'white',
            textAlign:'left',
            cursor:'pointer',
            borderRadius:4,
            fontWeight:600
          }}
        >
          🚪 Cerrar Sesión
        </button>
      </div>
      <div style={{flex:1,padding:24,overflow:'auto'}}>
        {/* Mensajes de éxito y error globales */}
        {success && (
          <div style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            padding: '16px 24px',
            borderRadius: 12,
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            animation: 'slideDown 0.3s ease-out'
          }}>
            <span style={{ fontSize: 24 }}>✓</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>¡Éxito!</div>
              <div style={{ fontSize: 14, opacity: 0.95 }}>{success}</div>
            </div>
            <button
              onClick={() => setSuccess('')}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
                borderRadius: '50%',
                width: 32,
                height: 32,
                cursor: 'pointer',
                fontSize: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>
          </div>
        )}
        
        {error && (
          <div style={{
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: 'white',
            padding: '16px 24px',
            borderRadius: 12,
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
            animation: 'slideDown 0.3s ease-out'
          }}>
            <span style={{ fontSize: 24 }}>⚠</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Error</div>
              <div style={{ fontSize: 14, opacity: 0.95 }}>{error}</div>
            </div>
            <button
              onClick={() => setError('')}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
                borderRadius: '50%',
                width: 32,
                height: 32,
                cursor: 'pointer',
                fontSize: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>
          </div>
        )}
        
        {view==='home' && (
          <div>
            <h2>Dashboard de Cliente</h2>
            <p>Bienvenido al portal. Usa el menú lateral para censar equipos.</p>
          </div>
        )}
        {view==='perfil' && (
          <div>
            <h2>Mi Perfil</h2>
            
            {perfil ? (
              <div style={{maxWidth:900}}>
                {/* Información del Usuario */}
                <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:8,padding:24,marginBottom:24}}>
                  <h3 style={{margin:'0 0 20px 0',fontSize:20,color:'#1e293b',borderBottom:'2px solid #3b82f6',paddingBottom:8}}>
                    👤 Información Personal
                  </h3>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                    <div>
                      <div style={{fontSize:12,color:'#64748b',marginBottom:4}}>Nombre</div>
                      <div style={{fontSize:16,color:'#1e293b',fontWeight:600}}>{perfil.nombre_usuario} {perfil.apellido_usuario}</div>
                    </div>
                    <div>
                      <div style={{fontSize:12,color:'#64748b',marginBottom:4}}>ID Usuario</div>
                      <div style={{fontSize:16,color:'#1e293b',fontWeight:600}}>{perfil.id_usuario || 'N/A'}</div>
                    </div>
                    <div>
                      <div style={{fontSize:12,color:'#64748b',marginBottom:4}}>Email</div>
                      <div style={{fontSize:16,color:'#1e293b',fontWeight:600}}>{perfil.email}</div>
                    </div>
                    <div>
                      <div style={{fontSize:12,color:'#64748b',marginBottom:4}}>Perfil</div>
                      <div style={{fontSize:16,color:'#1e293b',fontWeight:600}}>{perfil.nombre_profile || 'N/A'}</div>
                    </div>
                  </div>
                </div>

                {/* Información de la Empresa */}
                <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:8,padding:24}}>
                  <h3 style={{margin:'0 0 20px 0',fontSize:20,color:'#1e293b',borderBottom:'2px solid #10b981',paddingBottom:8}}>
                    🏢 Información de la Empresa
                  </h3>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                    <div>
                      <div style={{fontSize:12,color:'#64748b',marginBottom:4}}>Nombre de la Empresa</div>
                      <div style={{fontSize:16,color:'#1e293b',fontWeight:600}}>{perfil.nombre_empresa || 'N/A'}</div>
                    </div>
                    <div>
                      <div style={{fontSize:12,color:'#64748b',marginBottom:4}}>ID Empresa</div>
                      <div style={{fontSize:16,color:'#1e293b',fontWeight:600}}>{perfil.id_empresa || 'N/A'}</div>
                    </div>
                    <div>
                      <div style={{fontSize:12,color:'#64748b',marginBottom:4}}>RFC</div>
                      <div style={{fontSize:16,color:'#1e293b',fontWeight:600}}>{perfil.rfc || 'N/A'}</div>
                    </div>
                    <div>
                      <div style={{fontSize:12,color:'#64748b',marginBottom:4}}>Total de Equipos</div>
                      <div style={{fontSize:16,color:'#1e293b',fontWeight:600}}>{perfil.total_equipos !== undefined ? perfil.total_equipos : 'N/A'}</div>
                    </div>
                    {perfil.fecha_pago && (
                      <div style={{gridColumn:'1 / -1'}}>
                        <div style={{fontSize:12,color:'#64748b',marginBottom:4}}>Fecha de Pago</div>
                        <div style={{fontSize:16,color:'#1e293b',fontWeight:600}}>
                          {new Date(perfil.fecha_pago).toLocaleDateString('es-ES')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Información de Suscripción */}
                <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:8,padding:24,marginBottom:24}}>
                  <h3 style={{margin:'0 0 20px 0',fontSize:20,color:'#1e293b',borderBottom:'2px solid #10b981',paddingBottom:8}}>
                    💳 Suscripción y Pagos
                  </h3>
                  
                  {suscripcion ? (
                    <>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16,marginBottom:24}}>
                        <div style={{padding:16,background:suscripcion.estado === 'activa' ? '#d1fae5' : '#fee2e2',borderRadius:8,textAlign:'center'}}>
                          <div style={{fontSize:12,color:'#64748b',marginBottom:4}}>Estado</div>
                          <div style={{fontSize:18,fontWeight:700,color:suscripcion.estado === 'activa' ? '#065f46' : '#991b1b',textTransform:'uppercase'}}>
                            {suscripcion.estado === 'activa' ? '✅ ACTIVA' : suscripcion.estado === 'expirada' ? '⏰ EXPIRADA' : '❌ INACTIVA'}
                          </div>
                        </div>
                        <div style={{padding:16,background:'#dbeafe',borderRadius:8,textAlign:'center'}}>
                          <div style={{fontSize:12,color:'#64748b',marginBottom:4}}>Días Restantes</div>
                          <div style={{fontSize:28,fontWeight:700,color:'#1e40af'}}>
                            {suscripcion.dias_restantes}
                          </div>
                        </div>
                        <div style={{padding:16,background:'#fef3c7',borderRadius:8,textAlign:'center'}}>
                          <div style={{fontSize:12,color:'#64748b',marginBottom:4}}>Vence</div>
                          <div style={{fontSize:14,fontWeight:600,color:'#92400e'}}>
                            {suscripcion.fecha_expiracion ? new Date(suscripcion.fecha_expiracion).toLocaleDateString('es-ES') : 'N/A'}
                          </div>
                        </div>
                      </div>
                      
                      {suscripcion.estado !== 'activa' && (
                        <div style={{padding:16,background:'#fef2f2',border:'2px solid #fca5a5',borderRadius:8,marginBottom:20}}>
                          <p style={{margin:0,color:'#991b1b',fontWeight:600,fontSize:15}}>
                            ⚠️ Tu suscripción ha expirado. Renueva para continuar usando la plataforma.
                          </p>
                        </div>
                      )}
                      
                      <button 
                        onClick={()=>setMostrarPagos(true)}
                        disabled={cargandoPago}
                        style={{
                          padding:'14px 36px',
                          background: cargandoPago 
                            ? '#cbd5e1' 
                            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color:'white',
                          border:'none',
                          borderRadius:10,
                          cursor: cargandoPago ? 'not-allowed' : 'pointer',
                          fontSize:16,
                          fontWeight:700,
                          boxShadow: cargandoPago 
                            ? 'none' 
                            : '0 6px 20px rgba(102, 126, 234, 0.4)',
                          transition:'all 0.3s',
                          opacity: cargandoPago ? 0.6 : 1
                        }}
                        onMouseEnter={(e)=>{
                          if(!cargandoPago){
                            e.currentTarget.style.transform = 'translateY(-2px)'
                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.5)'
                          }
                        }}
                        onMouseLeave={(e)=>{
                          if(!cargandoPago){
                            e.currentTarget.style.transform = 'translateY(0)'
                            e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)'
                          }
                        }}
                      >
                        {cargandoPago ? '⏳ Procesando...' : '💳 Renovar / Extender Suscripción'}
                      </button>
                    </>
                  ) : (
                    <div style={{textAlign:'center',padding:20}}>
                      <p style={{color:'#64748b',margin:0}}>Cargando información de suscripción...</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{padding:40,textAlign:'center',background:'#f8fafc',borderRadius:8,border:'1px solid #e2e8f0'}}>
                <p style={{color:'#64748b',margin:0}}>Cargando perfil...</p>
              </div>
            )}
          </div>
        )}
        {view==='equipos' && (
          <div>
            <h2>📦 Equipos de la Empresa</h2>
            
            {equipos.length === 0 ? (
              <div style={{padding:40,textAlign:'center',background:'#f8fafc',borderRadius:8,border:'1px solid #e2e8f0'}}>
                <p style={{color:'#64748b',margin:0}}>No hay equipos registrados</p>
              </div>
            ) : (
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',background:'white',boxShadow:'0 1px 3px rgba(0,0,0,0.1)',borderRadius:8,overflow:'hidden'}}>
                  <thead>
                    <tr style={{background:'#f1f5f9'}}>
                      
                      <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Tipo</th>
                      <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Marca</th>
                      <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Modelo</th>
                      <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Serie</th>
                      <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Sistema Op.</th>
                      <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Procesador</th>
                      <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>RAM</th>
                      <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Empleado</th>
                      <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Status</th>
                      <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569',borderBottom:'2px solid #e2e8f0'}}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipos.map((eq) => (
                      <tr key={eq.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                        
                        <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{eq.tipo_equipo || 'N/A'}</td>
                        <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{eq.marca || 'N/A'}</td>
                        <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{eq.modelo || 'N/A'}</td>
                        <td style={{padding:12,fontSize:12,color:'#64748b'}}>{eq.numero_serie || 'N/A'}</td>
                        <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{eq.sistema_operativo || 'N/A'}</td>
                        <td style={{padding:12,fontSize:12,color:'#64748b'}}>{eq.procesador || 'N/A'}</td>
                        <td style={{padding:12,fontSize:14,color:'#1e293b'}}>{eq.ram || 'N/A'}</td>
                  
                        <td style={{padding:12,fontSize:14,color:'#1e293b'}}>
                          {eq.nombre_empleado ? (
                            <div>
                              <div style={{fontWeight:600}}>{eq.nombre_empleado}</div>
                              
                            </div>
                          ) : 'Sin asignar'}
                        </td>
                        <td style={{padding:12,fontSize:14}}>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 600,
                            background: 
                              eq.status === 'activo' ? '#d1fae5' : 
                              eq.status === 'pendiente' ? '#fef3c7' : 
                              eq.status === 'registrado' ? '#dbeafe' :
                              eq.status === 'por instalar' ? '#fef08a' :
                              eq.status === 'instalacion programada' ? '#fed7aa' :
                              '#fee2e2',
                            color: 
                              eq.status === 'activo' ? '#065f46' : 
                              eq.status === 'pendiente' ? '#92400e' : 
                              eq.status === 'registrado' ? '#1e40af' :
                              eq.status === 'por instalar' ? '#854d0e' :
                              eq.status === 'instalacion programada' ? '#9a3412' :
                              '#991b1b'
                          }}>
                            {eq.status === 'activo' ? '✓ Activo' : 
                             eq.status === 'pendiente' ? '⏳ Pendiente' : 
                             eq.status === 'registrado' ? '📋 Registrado' :
                             eq.status === 'por instalar' ? '🔧 Por Instalar' :
                             eq.status === 'instalacion programada' ? '📅 Instalación Programada' :
                             eq.status || 'N/A'}
                          </span>
                        </td>
                        <td style={{padding:12}}>
                          {/* Los clientes no pueden programar censos, solo los admins */}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {view==='empleados' && (
          <div>
            <h2>Gestión de Empleados</h2>
            
            {/* Formulario para crear/editar empleado */}
            <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:8,padding:20,marginBottom:24,maxWidth:700}}>
              <h3 style={{margin:'0 0 16px 0',fontSize:18,color:'#1e293b'}}>
                {empleadoEditando ? '✏️ Editar Empleado' : '➕ Registrar Nuevo Empleado'}
              </h3>
              <form onSubmit={handleEmpleadoSubmit}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:12,marginBottom:16}}>
                  <label style={{display:'block'}}>
                    ID Empleado *
                    <input 
                      required 
                      value={empleadoForm.id_empleado} 
                      onChange={e=>setEmpleadoForm({...empleadoForm,id_empleado:e.target.value})} 
                      style={{width:'100%',padding:10,marginTop:4,border:'1px solid #cbd5e1',borderRadius:4}}
                      placeholder="Ej: EMP001"
                    />
                  </label>
                  
                  <label style={{display:'block'}}>
                    Nombre Completo *
                    <input 
                      required 
                      value={empleadoForm.nombre_empleado} 
                      onChange={e=>setEmpleadoForm({...empleadoForm,nombre_empleado:e.target.value})} 
                      style={{width:'100%',padding:10,marginTop:4,border:'1px solid #cbd5e1',borderRadius:4}}
                      placeholder="Ej: Juan Pérez García"
                    />
                  </label>
                </div>
                
                <div style={{display:'flex',gap:12}}>
                  <button type='submit' style={{padding:'10px 24px',background:'#4f46e5',color:'white',border:'none',borderRadius:6,cursor:'pointer',fontWeight:600}}>
                    {empleadoEditando ? '💾 Guardar Cambios' : '➕ Registrar Empleado'}
                  </button>
                  {empleadoEditando && (
                    <button type='button' onClick={handleCancelarEdicion} style={{padding:'10px 24px',background:'#64748b',color:'white',border:'none',borderRadius:6,cursor:'pointer',fontWeight:600}}>
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>
            
            {/* Lista de empleados */}
            <div style={{maxWidth:900}}>
              <h3 style={{fontSize:18,marginBottom:16,color:'#1e293b'}}>📋 Lista de Empleados</h3>
              {empleados.length === 0 ? (
                <div style={{padding:40,textAlign:'center',background:'#f8fafc',borderRadius:8,border:'1px solid #e2e8f0'}}>
                  <p style={{color:'#64748b',margin:0}}>No hay empleados registrados aún</p>
                </div>
              ) : (
                <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:8,overflow:'hidden'}}>
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead>
                      <tr style={{background:'#f1f5f9',borderBottom:'2px solid #e2e8f0'}}>
                        <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569'}}>ID Empleado</th>
                        <th style={{padding:12,textAlign:'left',fontSize:14,fontWeight:600,color:'#475569'}}>Nombre</th>
                        <th style={{padding:12,textAlign:'center',fontSize:14,fontWeight:600,color:'#475569'}}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {empleados.map(empleado=>(
                        <tr key={empleado.id} style={{borderBottom:'1px solid #e2e8f0'}}>
                          <td style={{padding:12,fontSize:14,color:'#1e293b',fontWeight:600}}>{empleado.id_empleado}</td>
                          <td style={{padding:12,fontSize:14,color:'#475569'}}>{empleado.nombre_empleado}</td>
                          <td style={{padding:12,textAlign:'center'}}>
                            <button 
                              onClick={()=>handleEditarEmpleado(empleado)}
                              style={{padding:'6px 12px',background:'#3b82f6',color:'white',border:'none',borderRadius:4,cursor:'pointer',fontSize:13,marginRight:8}}
                            >
                              ✏️ Editar
                            </button>
                            <button 
                              onClick={()=>handleEliminarEmpleado(empleado.id)}
                              style={{padding:'6px 12px',background:'#ef4444',color:'white',border:'none',borderRadius:4,cursor:'pointer',fontSize:13}}
                            >
                              🗑️ Eliminar
                            </button>
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
        {view==='census' && (
          <div>
            <h2>Solicitar Censo de Equipo</h2>
            
            {/* Mensaje de éxito con animación */}
            {success && (
              <div style={{
                background:'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color:'white',
                padding:'20px 24px',
                borderRadius:12,
                marginBottom:24,
                boxShadow:'0 4px 12px rgba(16, 185, 129, 0.3)',
                fontSize:16,
                fontWeight:600,
                display:'flex',
                alignItems:'center',
                gap:12,
                animation:'slideDown 0.5s ease-out',
                border:'2px solid rgba(255,255,255,0.3)'
              }}>
                <span style={{fontSize:24}}>✅</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:18,marginBottom:4}}>¡Censo completado exitosamente!</div>
                  <div style={{fontSize:14,opacity:0.95}}>Los datos del equipo han sido registrados. Puedes censar otro equipo.</div>
                </div>
              </div>
            )}
            
            {/* Mensaje de error */}
            {error && (
              <div style={{
                background:'#fee2e2',
                color:'#991b1b',
                padding:'16px 20px',
                borderRadius:8,
                marginBottom:20,
                border:'2px solid #fca5a5',
                fontSize:14
              }}>
                ⚠️ {error}
              </div>
            )}
            
            {/* Selección de tipo de equipo */}
            {!tipoEquipoSeleccionado && (
              <div style={{maxWidth:700,margin:'40px auto',textAlign:'center'}}>
                <h3 style={{fontSize:24,marginBottom:16,color:'#1e293b'}}>¿Qué tipo de equipo vas a censar?</h3>
                <p style={{fontSize:16,color:'#64748b',marginBottom:32}}>Selecciona el tipo de equipo para continuar</p>
                
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
                  <div 
                    onClick={handleSeleccionEscritorio}
                    style={{
                      padding:40,
                      background:'white',
                      border:'3px solid #e2e8f0',
                      borderRadius:16,
                      cursor:'pointer',
                      transition:'all 0.3s'
                    }}
                    onMouseOver={(e)=>{e.currentTarget.style.transform='scale(1.05)';e.currentTarget.style.borderColor='#3b82f6';e.currentTarget.style.boxShadow='0 10px 30px rgba(59,130,246,0.3)'}}
                    onMouseOut={(e)=>{e.currentTarget.style.transform='scale(1)';e.currentTarget.style.borderColor='#e2e8f0';e.currentTarget.style.boxShadow='none'}}
                  >
                    <div style={{fontSize:80,marginBottom:16}}>🖥️</div>
                    <div style={{fontSize:22,fontWeight:600,color:'#1e293b',marginBottom:8}}>Equipo de Escritorio</div>
                    <div style={{fontSize:14,color:'#64748b'}}>PC de escritorio, torre, workstation</div>
                  </div>
                  
                  <div 
                    onClick={handleSeleccionLaptop}
                    style={{
                      padding:40,
                      background:'white',
                      border:'3px solid #e2e8f0',
                      borderRadius:16,
                      cursor:'pointer',
                      transition:'all 0.3s'
                    }}
                    onMouseOver={(e)=>{e.currentTarget.style.transform='scale(1.05)';e.currentTarget.style.borderColor='#10b981';e.currentTarget.style.boxShadow='0 10px 30px rgba(16,185,129,0.3)'}}
                    onMouseOut={(e)=>{e.currentTarget.style.transform='scale(1)';e.currentTarget.style.borderColor='#e2e8f0';e.currentTarget.style.boxShadow='none'}}
                  >
                    <div style={{fontSize:80,marginBottom:16}}>💻</div>
                    <div style={{fontSize:22,fontWeight:600,color:'#1e293b',marginBottom:8}}>Laptop</div>
                    <div style={{fontSize:14,color:'#64748b'}}>Portátil, notebook, ultrabook</div>
                  </div>
                </div>
              </div>
            )}

            {/* Modal de aviso para laptops */}
            {mostrarAvisoLaptop && (
              <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
                <div style={{background:'white',borderRadius:16,padding:32,maxWidth:600,width:'90%',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
                  <h3 style={{fontSize:24,marginBottom:16,color:'#1e293b'}}>📋 Documento de Responsiva Requerido</h3>
                  <p style={{fontSize:16,color:'#475569',marginBottom:24,lineHeight:1.6}}>
                    Para censar una laptop, es necesario descargar, llenar y firmar un documento de responsiva. 
                    Este documento establece las responsabilidades del usuario respecto al equipo asignado.
                  </p>
                  
                  <div style={{background:'#fef3c7',border:'2px solid #f59e0b',borderRadius:8,padding:16,marginBottom:24}}>
                    <p style={{margin:0,fontSize:14,color:'#92400e'}}>
                      <strong>⚠️ Importante:</strong> Después de descargar el documento, deberás llenarlo con los datos del equipo, 
                      firmarlo y subirlo en el siguiente paso.
                    </p>
                  </div>

                  {!responsaDescargada ? (
                    <button 
                      onClick={handleDescargarResponsiva}
                      style={{width:'100%',padding:'14px 24px',background:'#3b82f6',color:'white',border:'none',borderRadius:8,cursor:'pointer',fontSize:16,fontWeight:600,marginBottom:12}}
                    >
                      📥 Descargar Documento de Responsiva
                    </button>
                  ) : (
                    <div style={{marginBottom:12}}>
                      <div style={{padding:12,background:'#d1fae5',borderRadius:8,marginBottom:12,textAlign:'center',color:'#065f46'}}>
                        ✓ Documento descargado
                      </div>
                      <button 
                        onClick={handleAceptarAvisoLaptop}
                        style={{width:'100%',padding:'14px 24px',background:'#10b981',color:'white',border:'none',borderRadius:8,cursor:'pointer',fontSize:16,fontWeight:600,marginBottom:12}}
                      >
                        ✓ Continuar con el Censo
                      </button>
                    </div>
                  )}
                  
                  <button 
                    onClick={()=>{setMostrarAvisoLaptop(false);setResponsivaDescargada(false)}}
                    style={{width:'100%',padding:'12px 24px',background:'#64748b',color:'white',border:'none',borderRadius:8,cursor:'pointer',fontSize:14}}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Formulario de censo (solo visible después de seleccionar tipo) */}
            {tipoEquipoSeleccionado && (
              <>
                {/* Botón para volver a la selección */}
                <div style={{marginBottom:20}}>
                  <button 
                    onClick={()=>{
                      setTipoEquipoSeleccionado('');
                      setArchivoResponsiva(null);
                      setResponsivaDescargada(false);
                      setForm({...form, tipo_equipo:''});
                    }}
                    style={{padding:'10px 20px',background:'#64748b',color:'white',border:'none',borderRadius:6,cursor:'pointer',fontSize:14,fontWeight:600,display:'flex',alignItems:'center',gap:8}}
                  >
                    ← Volver a selección de tipo de equipo
                  </button>
                </div>

                {/* Censo Automático */}
                <div style={{background:'#f0fdf4',border:'2px solid #10b981',borderRadius:8,padding:20,marginBottom:20,maxWidth:700}}>
                  <h3 style={{margin:'0 0 8px 0',fontSize:18,color:'#047857'}}>⚡ Censo Automático (Recomendado)</h3>
                  <p style={{margin:'0 0 16px 0',fontSize:14,color:'#065f46'}}>Descarga la herramienta para tu sistema operativo, ejecútala y sube el archivo .txt generado.</p>
                  
                  <div style={{display:'flex',gap:12,marginBottom:16}}>
                    <button type='button' onClick={handleDownloadWindowsTool} style={{flex:1,padding:'12px 24px',background:'#0ea5e9',color:'white',border:'none',borderRadius:6,cursor:'pointer',fontSize:15,fontWeight:600}}>
                      🪟 Windows (.bat)
                    </button>
                    <button type='button' onClick={handleDownloadAutoTool} style={{flex:1,padding:'12px 24px',background:'#10b981',color:'white',border:'none',borderRadius:6,cursor:'pointer',fontSize:15,fontWeight:600}}>
                      🐧 Linux (.sh)
                    </button>
                  </div>
                  
                  {/* Campo para subir archivo txt */}
                  <div style={{marginTop:16,padding:16,background:'#e0f2fe',borderRadius:8,border:'2px dashed #0284c7'}}>
                    <label style={{display:'block',marginBottom:8,fontSize:14,fontWeight:600,color:'#0c4a6e'}}>
                      📁 Cargar archivo de censo (.txt)
                    </label>
                    <input 
                      type='file' 
                      accept='.txt' 
                      onChange={handleFileUpload}
                      style={{width:'100%',padding:8,fontSize:14,border:'1px solid #0284c7',borderRadius:4,background:'white',cursor:'pointer'}}
                    />
                    <p style={{margin:'8px 0 0 0',fontSize:12,color:'#075985'}}>Selecciona el archivo .txt generado por la herramienta de censo</p>
                  </div>
                </div>

                {/* Mostrar campo para subir responsiva si es laptop */}
                {tipoEquipoSeleccionado === 'laptop' && (
                  <div style={{background:'#fef3c7',border:'2px solid #f59e0b',borderRadius:8,padding:20,marginBottom:20,maxWidth:700}}>
                    <h3 style={{margin:'0 0 8px 0',fontSize:18,color:'#92400e'}}>📄 Documento de Responsiva Firmado</h3>
                    <p style={{margin:'0 0 16px 0',fontSize:14,color:'#78350f'}}>Por favor, sube el documento de responsiva que descargaste, llenaste y firmaste.</p>
                    
                    <input 
                      type='file' 
                      accept='.txt,.pdf,.jpg,.jpeg,.png' 
                      onChange={handleArchivoResponsivaChange}
                      style={{width:'100%',padding:10,fontSize:14,border:'1px solid #f59e0b',borderRadius:4,background:'white',cursor:'pointer'}}
                    />
                    {archivoResponsiva && (
                      <div style={{marginTop:12,padding:10,background:'#d1fae5',borderRadius:6,color:'#065f46',fontSize:14}}>
                        ✓ Archivo seleccionado: {archivoResponsiva.name}
                      </div>
                    )}
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
                <label>
                  Empleado Asignado *
                  <br/>
                  <select 
                    required
                    value={form.empleado_id} 
                    onChange={e=>{
                      const selectedEmp = empleados.find(emp => emp.id === parseInt(e.target.value));
                      setForm({
                        ...form, 
                        empleado_id: e.target.value,
                        nombre_usuario_equipo: selectedEmp ? `${selectedEmp.id_empleado}` : ''
                      });
                    }} 
                    style={{width:'100%',padding:8,border:'1px solid #cbd5e1',borderRadius:4}}
                  >
                    <option value="">-- Seleccionar Empleado --</option>
                    {empleados.map(emp=>(
                      <option key={emp.id} value={emp.id}>
                        {emp.id_empleado} - {emp.nombre_empleado}
                      </option>
                    ))}
                  </select>
                </label>
                <label>Tipo de Equipo<br/><input value={form.tipo_equipo} onChange={e=>setForm({...form,tipo_equipo:e.target.value})} style={{width:'100%',padding:8}} placeholder="Ej: Laptop, Desktop" /></label>
                <label>Nombre de Equipo<br/><input value={form.nombre_equipo} onChange={e=>setForm({...form,nombre_equipo:e.target.value})} style={{width:'100%',padding:8}} /></label>
              </div>
              {error && <div style={{color:'#ff6b6b',marginTop:12}}>{error}</div>}
              {success && <div style={{color:'#51cf66',marginTop:12}}>{success}</div>}
              <div style={{display:'flex',gap:12,marginTop:16}}>
                <button type='submit' style={{flex:1,padding:'10px 20px',background:'#4f46e5',color:'white',border:'none',borderRadius:6,cursor:'pointer',fontWeight:600}}>Enviar Solicitud</button>
                <button type='button' onClick={handleClearForm} style={{padding:'10px 20px',background:'#64748b',color:'white',border:'none',borderRadius:6,cursor:'pointer',fontWeight:600}}>🗑️ Limpiar</button>
              </div>
            </form>
            </>
            )}
          </div>
        )}
        {view==='tickets' && (
          <div>
            <h2>Mis Tickets de Soporte</h2>
            
            {/* Crear nuevo ticket */}
            <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:8,padding:20,marginBottom:24}}>
              <h3 style={{margin:'0 0 16px 0',fontSize:18,color:'#1e293b'}}>🎫 Crear Nuevo Ticket</h3>
              
              {!ticketForm.titulo ? (
                <>
                  <p style={{color:'#64748b',marginBottom:20}}>Selecciona el tipo de problema que estás experimentando:</p>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))',gap:16,marginBottom:24}}>
                    {[
                      {titulo:'Problema de Internet',emoji:'🌐',color:'#3b82f6',desc:'Sin conexión o conexión lenta'},
                      {titulo:'Equipo no Enciende',emoji:'💻',color:'#ef4444',desc:'El equipo no arranca'},
                      {titulo:'Problema de Impresora',emoji:'🖨️',color:'#8b5cf6',desc:'No imprime o atascos de papel'},
                      {titulo:'Software no Funciona',emoji:'⚠️',color:'#f59e0b',desc:'Error en programas o aplicaciones'},
                      {titulo:'Problemas de Correo',emoji:'📧',color:'#06b6d4',desc:'No puedo enviar o recibir emails'},
                      {titulo:'Contraseña Bloqueada',emoji:'🔒',color:'#ec4899',desc:'Olvidé mi contraseña'},
                      {titulo:'Virus o Malware',emoji:'🦠',color:'#dc2626',desc:'Sospecha de virus o comportamiento extraño'},
                      {titulo:'Pantalla con Problemas',emoji:'🖥️',color:'#14b8a6',desc:'Pantalla no se ve bien'},
                      {titulo:'Teclado o Mouse',emoji:'⌨️',color:'#6366f1',desc:'No responden o funcionan mal'},
                      {titulo:'Solicitud de Software',emoji:'📦',color:'#10b981',desc:'Necesito instalar un programa'},
                      {titulo:'Acceso a Carpetas',emoji:'📁',color:'#f97316',desc:'No puedo acceder a archivos compartidos'},
                      {titulo:'Otro Problema',emoji:'❓',color:'#64748b',desc:'Un problema diferente'}
                    ].map((problema,idx)=>(
                      <div 
                        key={idx}
                        onClick={()=>setTicketForm({...ticketForm,titulo:problema.titulo})}
                        style={{
                          background:'white',
                          border:'2px solid #e2e8f0',
                          borderRadius:12,
                          padding:20,
                          textAlign:'center',
                          cursor:'pointer',
                          transition:'all 0.2s',
                          ':hover':{transform:'translateY(-2px)',borderColor:problema.color}
                        }}
                        onMouseOver={(e)=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.borderColor=problema.color;e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'}}
                        onMouseOut={(e)=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.borderColor='#e2e8f0';e.currentTarget.style.boxShadow='none'}}
                      >
                        <div style={{fontSize:48,marginBottom:12}}>{problema.emoji}</div>
                        <div style={{fontWeight:600,color:'#1e293b',fontSize:15,marginBottom:8}}>{problema.titulo}</div>
                        <div style={{fontSize:12,color:'#64748b',lineHeight:1.4}}>{problema.desc}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <form onSubmit={handleTicketSubmit}>
                  <div style={{background:'#dbeafe',border:'2px solid #3b82f6',borderRadius:8,padding:16,marginBottom:16}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <div>
                        <div style={{fontSize:13,color:'#1e40af',marginBottom:4}}>Problema seleccionado:</div>
                        <div style={{fontSize:18,fontWeight:600,color:'#1e293b'}}>{ticketForm.titulo}</div>
                      </div>
                      <button 
                        type="button"
                        onClick={()=>setTicketForm({titulo:'',descripcion:'',prioridad:'media'})}
                        style={{padding:'8px 16px',background:'#64748b',color:'white',border:'none',borderRadius:6,cursor:'pointer',fontSize:13}}
                      >
                        ← Cambiar
                      </button>
                    </div>
                  </div>
                  
                  <label style={{display:'block',marginBottom:12}}>
                    Descripción Detallada *
                    <textarea 
                      required 
                      value={ticketForm.descripcion} 
                      onChange={e=>setTicketForm({...ticketForm,descripcion:e.target.value})} 
                      style={{width:'100%',padding:10,marginTop:4,border:'1px solid #cbd5e1',borderRadius:4,minHeight:120,fontFamily:'inherit'}}
                      placeholder="Describe con más detalle el problema que estás experimentando"
                    />
                  </label>
                  
                  <label style={{display:'block',marginBottom:16}}>
                    Prioridad
                    <select 
                      value={ticketForm.prioridad} 
                      onChange={e=>setTicketForm({...ticketForm,prioridad:e.target.value})} 
                      style={{width:'100%',padding:10,marginTop:4,border:'1px solid #cbd5e1',borderRadius:4}}
                    >
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  </label>
                  
                  {error && <div style={{color:'#ff6b6b',marginBottom:12}}>{error}</div>}
                  {success && <div style={{color:'#51cf66',marginBottom:12}}>{success}</div>}
                  
                  <button type='submit' style={{padding:'10px 24px',background:'#4f46e5',color:'white',border:'none',borderRadius:6,cursor:'pointer',fontWeight:600}}>
                    📤 Enviar Ticket
                  </button>
                </form>
              )}
            </div>
            
            {/* Lista de tickets */}
            <div style={{maxWidth:900}}>
              <h3 style={{fontSize:18,marginBottom:16,color:'#1e293b'}}>📜 Mis Tickets</h3>
              {tickets.length === 0 ? (
                <div style={{padding:40,textAlign:'center',background:'#f8fafc',borderRadius:8,border:'1px solid #e2e8f0'}}>
                  <p style={{color:'#64748b',margin:0}}>No tienes tickets creados aún</p>
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  {tickets.map(ticket=>(
                    <div key={ticket.id} style={{background:'white',border:'1px solid #e2e8f0',borderRadius:8,padding:16}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',marginBottom:8}}>
                        <h4 style={{margin:0,fontSize:16,color:'#1e293b'}}>{ticket.titulo}</h4>
                        <span style={{
                          padding:'4px 12px',
                          borderRadius:12,
                          fontSize:12,
                          fontWeight:600,
                          background: ticket.estado === 'abierto' ? '#fef3c7' : ticket.estado === 'en_proceso' ? '#dbeafe' : '#d1fae5',
                          color: ticket.estado === 'abierto' ? '#92400e' : ticket.estado === 'en_proceso' ? '#1e40af' : '#065f46'
                        }}>
                          {ticket.estado === 'abierto' ? '🔵 Abierto' : ticket.estado === 'en_proceso' ? '🟡 En Proceso' : '✅ Cerrado'}
                        </span>
                      </div>
                      <p style={{margin:'8px 0',color:'#475569',fontSize:14}}>{ticket.descripcion}</p>
                      <div style={{display:'flex',gap:16,fontSize:13,color:'#64748b',marginTop:12}}>
                        <span>🏷️ Prioridad: <strong style={{textTransform:'capitalize'}}>{ticket.prioridad}</strong></span>
                        <span>📅 {new Date(ticket.created_at).toLocaleDateString('es-ES')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Pago con Stripe */}
      {mostrarPagos && planes && (
        <StripePaymentModal
          planes={planes}
          stripePromise={stripePromise}
          onClose={() => {
            setMostrarPagos(false)
            setCargandoPago(false)
          }}
          onSelectPlan={handleProcesarPago}
          cargandoPago={cargandoPago}
          onPaymentSuccess={(result) => {
            setSuccess(`✅ ${result.mensaje || '¡Pago exitoso!'}`)
            setMostrarPagos(false)
            setCargandoPago(false)
            // Recargar información de suscripción
            fetchSuscripcionEstado()
          }}
          onPaymentError={(mensaje) => {
            setError(mensaje)
            setCargandoPago(false)
          }}
        />
      )}

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
      
      {/* Vista de Instalación */}
      {view==='instalacion' && (
        <div>
          <h2 style={{marginBottom:24}}>⬇️ Solicitud de Instalación</h2>
          
          {/* Indicador de Pasos */}
          <div style={{display:'flex',justifyContent:'center',marginBottom:32,gap:16}}>
            {[
              {num:1,label:'Configuración'},
              {num:2,label:'Censo de Equipo'},
              {num:3,label:'Pago'}
            ].map((paso)=>(
              <div key={paso.num} style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{
                  width:40,
                  height:40,
                  borderRadius:'50%',
                  background:instalacionStep>=paso.num?'#3b82f6':'#e2e8f0',
                  color:instalacionStep>=paso.num?'white':'#94a3b8',
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'center',
                  fontWeight:700,
                  fontSize:16
                }}>
                  {paso.num}
                </div>
                <span style={{fontSize:14,fontWeight:600,color:instalacionStep>=paso.num?'#1e293b':'#94a3b8'}}>
                  {paso.label}
                </span>
                {paso.num<3 && <span style={{color:'#cbd5e1',marginLeft:8}}>→</span>}
              </div>
            ))}
          </div>

          {/* Paso 1: Configuración */}
          {instalacionStep===1 && (
            <div style={{background:'white',borderRadius:12,padding:24,boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}}>
              <h3 style={{fontSize:20,fontWeight:600,color:'#1e293b',marginBottom:20}}>
                Configuración Inicial
              </h3>
              
              <label style={{display:'block',marginBottom:20}}>
                <div style={{fontSize:14,fontWeight:600,color:'#475569',marginBottom:8}}>
                  ¿Es un equipo de escritorio o laptop? *
                </div>
                <select
                  value={instalacionConfig.tipoEquipo}
                  onChange={(e)=>setInstalacionConfig({...instalacionConfig,tipoEquipo:e.target.value})}
                  style={{
                    width:'100%',
                    padding:12,
                    border:'2px solid #e2e8f0',
                    borderRadius:8,
                    fontSize:16,
                    outline:'none',
                    cursor:'pointer'
                  }}
                >
                  <option value="">Selecciona el tipo de equipo</option>
                  <option value="escritorio">Escritorio</option>
                  <option value="laptop">Laptop</option>
                </select>
              </label>

              <label style={{display:'block',marginBottom:20}}>
                <div style={{fontSize:14,fontWeight:600,color:'#475569',marginBottom:8}}>
                  ¿A cuántas bases de datos se va a conectar? *
                </div>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={instalacionConfig.numBasesDatos}
                  onChange={(e)=>{
                    const num = parseInt(e.target.value) || 0
                    setInstalacionConfig({
                      ...instalacionConfig,
                      numBasesDatos:e.target.value,
                      nombresBD: Array(num).fill('').map((_, i) => instalacionConfig.nombresBD[i] || '')
                    })
                  }}
                  placeholder="Número de bases de datos"
                  style={{
                    width:'100%',
                    padding:12,
                    border:'2px solid #e2e8f0',
                    borderRadius:8,
                    fontSize:16,
                    outline:'none'
                  }}
                />
              </label>

              {/* Renderizar inputs dinámicamente según el número de bases de datos */}
              {instalacionConfig.numBasesDatos > 0 && Array.from({ length: parseInt(instalacionConfig.numBasesDatos) || 0 }).map((_, index) => (
                <label key={index} style={{display:'block',marginBottom:20}}>
                  <div style={{fontSize:14,fontWeight:600,color:'#475569',marginBottom:8}}>
                    Nombre de la Base de Datos {index + 1} *
                  </div>
                  <input
                    type="text"
                    value={instalacionConfig.nombresBD[index] || ''}
                    onChange={(e)=>{
                      const newNombres = [...instalacionConfig.nombresBD]
                      newNombres[index] = e.target.value
                      setInstalacionConfig({...instalacionConfig, nombresBD: newNombres})
                    }}
                    placeholder={`Nombre de la base de datos ${index + 1}`}
                    style={{
                      width:'100%',
                      padding:12,
                      border:'2px solid #e2e8f0',
                      borderRadius:8,
                      fontSize:16,
                      outline:'none'
                    }}
                  />
                </label>
              ))}

              <button
                onClick={()=>{
                  if(!instalacionConfig.tipoEquipo || !instalacionConfig.numBasesDatos){
                    setError('Por favor completa todos los campos requeridos')
                    return
                  }
                  // Validar que todos los nombres de BD estén completos
                  const numBD = parseInt(instalacionConfig.numBasesDatos) || 0
                  if(numBD > 0){
                    for(let i = 0; i < numBD; i++){
                      if(!instalacionConfig.nombresBD[i] || instalacionConfig.nombresBD[i].trim() === ''){
                        setError(`Ingresa el nombre de la base de datos ${i + 1}`)
                        return
                      }
                    }
                  }
                  setInstalacionForm({...instalacionForm,tipo_equipo:instalacionConfig.tipoEquipo})
                  setInstalacionStep(2)
                  fetchEmpleados()
                }}
                style={{
                  width:'100%',
                  padding:16,
                  background:'#3b82f6',
                  color:'white',
                  border:'none',
                  borderRadius:8,
                  fontSize:18,
                  fontWeight:600,
                  cursor:'pointer'
                }}
              >
                Continuar al Censo →
              </button>
            </div>
          )}

          {/* Paso 2: Censo del Equipo */}
          {instalacionStep===2 && (
            <div style={{background:'white',borderRadius:12,padding:24,boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}}>
              <h3 style={{fontSize:20,fontWeight:600,color:'#1e293b',marginBottom:20}}>
                Censo del Equipo
              </h3>

              {/* Censo Automático */}
              <div style={{background:'#f0fdf4',border:'2px solid #10b981',borderRadius:8,padding:20,marginBottom:24}}>
                <h4 style={{margin:'0 0 8px 0',fontSize:18,color:'#047857'}}>⚡ Censo Automático (Recomendado)</h4>
                <p style={{margin:'0 0 16px 0',fontSize:14,color:'#065f46'}}>Descarga la herramienta para tu sistema operativo, ejecútala y sube el archivo .txt generado.</p>
                
                <div style={{display:'flex',gap:12,marginBottom:16}}>
                  <button 
                    type='button' 
                    onClick={handleDownloadWindowsTool} 
                    style={{
                      flex:1,
                      padding:'12px 24px',
                      background:'#0ea5e9',
                      color:'white',
                      border:'none',
                      borderRadius:6,
                      cursor:'pointer',
                      fontSize:15,
                      fontWeight:600,
                      display:'flex',
                      alignItems:'center',
                      justifyContent:'center',
                      gap:8
                    }}
                  >
                    🪟 Windows (.bat)
                  </button>
                  <button 
                    type='button' 
                    onClick={handleDownloadAutoTool} 
                    style={{
                      flex:1,
                      padding:'12px 24px',
                      background:'#10b981',
                      color:'white',
                      border:'none',
                      borderRadius:6,
                      cursor:'pointer',
                      fontSize:15,
                      fontWeight:600,
                      display:'flex',
                      alignItems:'center',
                      justifyContent:'center',
                      gap:8
                    }}
                  >
                    🐧 Linux (.sh)
                  </button>
                </div>
                
                {/* Campo para subir archivo txt */}
                <div style={{padding:16,background:'#e0f2fe',borderRadius:8,border:'2px dashed #0284c7'}}>
                  <label style={{display:'block',marginBottom:8,fontSize:14,fontWeight:600,color:'#0c4a6e'}}>
                    📁 Cargar archivo de censo (.txt)
                  </label>
                  <input 
                    type='file' 
                    accept='.txt' 
                    onChange={(e)=>{
                      const file = e.target.files[0]
                      if(!file) return
                      
                      if(!file.name.endsWith('.txt')){
                        setError('Por favor selecciona un archivo .txt')
                        return
                      }
                      
                      const reader = new FileReader()
                      reader.onload = (event) => {
                        try{
                          const content = event.target.result
                          const lines = content.split('\n')
                          const data = {}
                          
                          lines.forEach(line => {
                            if(line.includes('=')){
                              const [key, value] = line.split('=')
                              if(key && value){
                                data[key.trim()] = value.trim()
                              }
                            }
                          })
                          
                          // Llenar formulario de instalación con los datos
                          setInstalacionForm({
                            marca: data.marca || instalacionForm.marca,
                            modelo: data.modelo || instalacionForm.modelo,
                            no_serie: data.no_serie || instalacionForm.no_serie,
                            codigo_registro: data.codigo_registro || instalacionForm.codigo_registro,
                            memoria_ram: data.memoria_ram || instalacionForm.memoria_ram,
                            disco_duro: data.disco_duro || instalacionForm.disco_duro,
                            serie_disco_duro: data.serie_disco_duro || instalacionForm.serie_disco_duro,
                            sistema_operativo: data.sistema_operativo || instalacionForm.sistema_operativo,
                            procesador: data.procesador || instalacionForm.procesador,
                            nombre_usuario_equipo: data.nombre_usuario_equipo || instalacionForm.nombre_usuario_equipo,
                            tipo_equipo: instalacionForm.tipo_equipo, // Mantener el tipo del paso 1
                            nombre_equipo: data.nombre_equipo || instalacionForm.nombre_equipo,
                            empleado_id: instalacionForm.empleado_id
                          })
                          
                          setSuccess('✓ Datos cargados desde archivo')
                          setError('')
                          
                        }catch(err){
                          console.error('Error al parsear archivo:', err)
                          setError('Error al leer el archivo. Asegúrate de que sea el archivo generado por la herramienta.')
                        }
                      }
                      
                      reader.onerror = () => {
                        setError('Error al leer el archivo')
                      }
                      
                      reader.readAsText(file)
                    }}
                    style={{
                      width:'100%',
                      padding:8,
                      fontSize:14,
                      border:'1px solid #0284c7',
                      borderRadius:4,
                      background:'white',
                      cursor:'pointer'
                    }}
                  />
                  <p style={{margin:'8px 0 0 0',fontSize:12,color:'#075985'}}>Selecciona el archivo .txt generado por la herramienta de censo</p>
                </div>
              </div>

              {/* Formulario Manual */}
              <h4 style={{fontSize:16,fontWeight:600,color:'#64748b',marginBottom:16}}>O completa manualmente:</h4>

              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16,marginBottom:20}}>
                <label>
                  <div style={{fontSize:14,fontWeight:600,color:'#475569',marginBottom:8}}>Marca *</div>
                  <input
                    type="text"
                    value={instalacionForm.marca}
                    onChange={(e)=>setInstalacionForm({...instalacionForm,marca:e.target.value})}
                    style={{width:'100%',padding:12,border:'2px solid #e2e8f0',borderRadius:8,fontSize:16}}
                  />
                </label>
                <label>
                  <div style={{fontSize:14,fontWeight:600,color:'#475569',marginBottom:8}}>Modelo *</div>
                  <input
                    type="text"
                    value={instalacionForm.modelo}
                    onChange={(e)=>setInstalacionForm({...instalacionForm,modelo:e.target.value})}
                    style={{width:'100%',padding:12,border:'2px solid #e2e8f0',borderRadius:8,fontSize:16}}
                  />
                </label>
                <label>
                  <div style={{fontSize:14,fontWeight:600,color:'#475569',marginBottom:8}}>Número de Serie *</div>
                  <input
                    type="text"
                    value={instalacionForm.no_serie}
                    onChange={(e)=>setInstalacionForm({...instalacionForm,no_serie:e.target.value})}
                    style={{width:'100%',padding:12,border:'2px solid #e2e8f0',borderRadius:8,fontSize:16}}
                  />
                </label>
                <label>
                  <div style={{fontSize:14,fontWeight:600,color:'#475569',marginBottom:8}}>Código de Registro *</div>
                  <input
                    type="text"
                    value={instalacionForm.codigo_registro}
                    onChange={(e)=>setInstalacionForm({...instalacionForm,codigo_registro:e.target.value})}
                    style={{width:'100%',padding:12,border:'2px solid #e2e8f0',borderRadius:8,fontSize:16}}
                  />
                </label>
                <label>
                  <div style={{fontSize:14,fontWeight:600,color:'#475569',marginBottom:8}}>RAM *</div>
                  <input
                    type="text"
                    value={instalacionForm.memoria_ram}
                    onChange={(e)=>setInstalacionForm({...instalacionForm,memoria_ram:e.target.value})}
                    style={{width:'100%',padding:12,border:'2px solid #e2e8f0',borderRadius:8,fontSize:16}}
                  />
                </label>
                <label>
                  <div style={{fontSize:14,fontWeight:600,color:'#475569',marginBottom:8}}>Disco Duro *</div>
                  <input
                    type="text"
                    value={instalacionForm.disco_duro}
                    onChange={(e)=>setInstalacionForm({...instalacionForm,disco_duro:e.target.value})}
                    style={{width:'100%',padding:12,border:'2px solid #e2e8f0',borderRadius:8,fontSize:16}}
                  />
                </label>
                <label>
                  <div style={{fontSize:14,fontWeight:600,color:'#475569',marginBottom:8}}>Serie Disco Duro</div>
                  <input
                    type="text"
                    value={instalacionForm.serie_disco_duro}
                    onChange={(e)=>setInstalacionForm({...instalacionForm,serie_disco_duro:e.target.value})}
                    style={{width:'100%',padding:12,border:'2px solid #e2e8f0',borderRadius:8,fontSize:16}}
                  />
                </label>
                <label>
                  <div style={{fontSize:14,fontWeight:600,color:'#475569',marginBottom:8}}>Sistema Operativo *</div>
                  <input
                    type="text"
                    value={instalacionForm.sistema_operativo}
                    onChange={(e)=>setInstalacionForm({...instalacionForm,sistema_operativo:e.target.value})}
                    style={{width:'100%',padding:12,border:'2px solid #e2e8f0',borderRadius:8,fontSize:16}}
                  />
                </label>
                <label>
                  <div style={{fontSize:14,fontWeight:600,color:'#475569',marginBottom:8}}>Procesador *</div>
                  <input
                    type="text"
                    value={instalacionForm.procesador}
                    onChange={(e)=>setInstalacionForm({...instalacionForm,procesador:e.target.value})}
                    style={{width:'100%',padding:12,border:'2px solid #e2e8f0',borderRadius:8,fontSize:16}}
                  />
                </label>
                <label>
                  <div style={{fontSize:14,fontWeight:600,color:'#475569',marginBottom:8}}>Nombre Usuario Equipo</div>
                  <input
                    type="text"
                    value={instalacionForm.nombre_usuario_equipo}
                    onChange={(e)=>setInstalacionForm({...instalacionForm,nombre_usuario_equipo:e.target.value})}
                    style={{width:'100%',padding:12,border:'2px solid #e2e8f0',borderRadius:8,fontSize:16}}
                  />
                </label>
                <label>
                  <div style={{fontSize:14,fontWeight:600,color:'#475569',marginBottom:8}}>Nombre del Equipo</div>
                  <input
                    type="text"
                    value={instalacionForm.nombre_equipo}
                    onChange={(e)=>setInstalacionForm({...instalacionForm,nombre_equipo:e.target.value})}
                    style={{width:'100%',padding:12,border:'2px solid #e2e8f0',borderRadius:8,fontSize:16}}
                  />
                </label>
                <label>
                  <div style={{fontSize:14,fontWeight:600,color:'#475569',marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span>Empleado Asignado *</span>
                    <button
                      type="button"
                      onClick={()=>setMostrarModalEmpleado(true)}
                      style={{
                        padding:'4px 12px',
                        background:'#10b981',
                        color:'white',
                        border:'none',
                        borderRadius:6,
                        fontSize:12,
                        cursor:'pointer'
                      }}
                    >
                      + Nuevo
                    </button>
                  </div>
                  <select
                    value={instalacionForm.empleado_id}
                    onChange={(e)=>setInstalacionForm({...instalacionForm,empleado_id:e.target.value})}
                    style={{width:'100%',padding:12,border:'2px solid #e2e8f0',borderRadius:8,fontSize:16,cursor:'pointer'}}
                  >
                    <option value="">Selecciona un empleado</option>
                    {empleados.map(emp=>(
                      <option key={emp.id} value={emp.id}>{emp.nombre_empleado} ({emp.id_empleado})</option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{display:'flex',gap:12}}>
                <button
                  onClick={()=>setInstalacionStep(1)}
                  style={{
                    flex:1,
                    padding:16,
                    background:'#f1f5f9',
                    color:'#475569',
                    border:'none',
                    borderRadius:8,
                    fontSize:16,
                    fontWeight:600,
                    cursor:'pointer'
                  }}
                >
                  ← Atrás
                </button>
                <button
                  onClick={()=>{
                    if(!instalacionForm.marca || !instalacionForm.modelo || !instalacionForm.no_serie || 
                       !instalacionForm.codigo_registro || !instalacionForm.memoria_ram || !instalacionForm.disco_duro ||
                       !instalacionForm.sistema_operativo || !instalacionForm.procesador || !instalacionForm.empleado_id){
                      setError('Por favor completa todos los campos requeridos (*)')
                      return
                    }
                    setInstalacionStep(3)
                  }}
                  style={{
                    flex:1,
                    padding:16,
                    background:'#3b82f6',
                    color:'white',
                    border:'none',
                    borderRadius:8,
                    fontSize:16,
                    fontWeight:600,
                    cursor:'pointer'
                  }}
                >
                  Continuar al Pago →
                </button>
              </div>
            </div>
          )}

          {/* Paso 3: Pago */}
          {instalacionStep===3 && (
            <div style={{background:'white',borderRadius:12,padding:24,boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}}>
              <h3 style={{fontSize:20,fontWeight:600,color:'#1e293b',marginBottom:20}}>
                Pago del Servicio de Instalación
              </h3>

              <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:8,padding:20,marginBottom:24}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                  <span style={{fontSize:16,color:'#64748b'}}>Servicio de Instalación</span>
                  <span style={{fontSize:24,fontWeight:700,color:'#1e293b'}}>$2,500 MXN</span>
                </div>
                <div style={{fontSize:14,color:'#64748b',lineHeight:1.6,marginBottom:12}}>
                  Incluye instalación, configuración de {instalacionConfig.numBasesDatos} base(s) de datos y soporte técnico inicial.
                </div>
                <div style={{background:'white',borderRadius:6,padding:12,fontSize:13,color:'#475569'}}>
                  <div style={{marginBottom:4}}><strong>Equipo:</strong> {instalacionConfig.tipoEquipo}</div>
                  <div style={{marginBottom:4}}><strong>Bases de datos:</strong> {instalacionConfig.numBasesDatos}</div>
                  {instalacionConfig.nombresBD && instalacionConfig.nombresBD.length > 0 && instalacionConfig.nombresBD.map((nombre, index) => (
                    nombre && <div key={index} style={{marginBottom:4}}><strong>BD {index + 1}:</strong> {nombre}</div>
                  ))}
                </div>
              </div>

              {stripePromise && (
                <Elements stripe={stripePromise}>
                  <ServicioPaymentForm
                    monto={2500}
                    datosEquipo={{
                      marca: instalacionForm.marca,
                      modelo: instalacionForm.modelo,
                      numero_serie: instalacionForm.no_serie,
                      codigo_registro: instalacionForm.codigo_registro,
                      memoria_ram: instalacionForm.memoria_ram,
                      disco_duro: instalacionForm.disco_duro,
                      serie_disco_duro: instalacionForm.serie_disco_duro,
                      sistema_operativo: instalacionForm.sistema_operativo,
                      procesador: instalacionForm.procesador,
                      nombre_usuario_equipo: instalacionForm.nombre_usuario_equipo,
                      tipo_equipo: instalacionForm.tipo_equipo,
                      nombre_equipo: instalacionForm.nombre_equipo,
                      empleado_id: instalacionForm.empleado_id
                    }}
                    onSuccess={async()=>{
                      setSuccess('✓ Pago realizado exitosamente. Tu instalación ha sido programada y el equipo registrado.')
                      setInstalacionStep(1)
                      setInstalacionConfig({tipoEquipo:'',numBasesDatos:'',nombresBD:[]})
                      setInstalacionForm({marca:'',modelo:'',no_serie:'',codigo_registro:'',memoria_ram:'',
                        disco_duro:'',serie_disco_duro:'',sistema_operativo:'',procesador:'',
                        nombre_usuario_equipo:'',tipo_equipo:'',nombre_equipo:'',empleado_id:''})
                    }}
                    onError={(err)=>{
                      setError(err.message || 'Error al procesar el pago')
                    }}
                  />
                </Elements>
              )}

              <button
                onClick={()=>setInstalacionStep(2)}
                style={{
                  width:'100%',
                  padding:16,
                  background:'#f1f5f9',
                  color:'#475569',
                  border:'none',
                  borderRadius:8,
                  fontSize:16,
                  fontWeight:600,
                  cursor:'pointer',
                  marginTop:16
                }}
              >
                ← Atrás
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal para Registrar Nuevo Empleado */}
      {mostrarModalEmpleado && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div style={{background:'white',borderRadius:12,padding:24,maxWidth:500,width:'90%',boxShadow:'0 4px 20px rgba(0,0,0,0.2)'}}>
            <h3 style={{fontSize:20,fontWeight:600,color:'#1e293b',marginBottom:20}}>Registrar Nuevo Empleado</h3>
            
            <label style={{display:'block',marginBottom:16}}>
              <div style={{fontSize:14,fontWeight:600,color:'#475569',marginBottom:8}}>ID Empleado *</div>
              <input
                type="text"
                value={empleadoForm.id_empleado}
                onChange={(e)=>setEmpleadoForm({...empleadoForm,id_empleado:e.target.value})}
                style={{width:'100%',padding:12,border:'2px solid #e2e8f0',borderRadius:8,fontSize:16}}
              />
            </label>

            <label style={{display:'block',marginBottom:20}}>
              <div style={{fontSize:14,fontWeight:600,color:'#475569',marginBottom:8}}>Nombre Completo *</div>
              <input
                type="text"
                value={empleadoForm.nombre_empleado}
                onChange={(e)=>setEmpleadoForm({...empleadoForm,nombre_empleado:e.target.value})}
                style={{width:'100%',padding:12,border:'2px solid #e2e8f0',borderRadius:8,fontSize:16}}
              />
            </label>

            <div style={{display:'flex',gap:12}}>
              <button
                onClick={()=>{
                  setMostrarModalEmpleado(false)
                  setEmpleadoForm({id_empleado:'',nombre_empleado:''})
                }}
                style={{
                  flex:1,
                  padding:12,
                  background:'#f1f5f9',
                  color:'#475569',
                  border:'none',
                  borderRadius:8,
                  fontSize:16,
                  fontWeight:600,
                  cursor:'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={async()=>{
                  if(!empleadoForm.id_empleado || !empleadoForm.nombre_empleado){
                    setError('Por favor completa todos los campos')
                    return
                  }
                  try{
                    const token = localStorage.getItem('token')
                    const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
                    const res = await fetch(`${API}/empleados`, {
                      method:'POST',
                      headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
                      body: JSON.stringify(empleadoForm)
                    })
                    const data = await res.json()
                    if (!res.ok) return setError(data.error || 'Error al crear empleado')
                    setSuccess('✓ Empleado registrado exitosamente')
                    setEmpleadoForm({id_empleado:'',nombre_empleado:''})
                    setMostrarModalEmpleado(false)
                    await fetchEmpleados() // Refrescar lista
                  }catch(e){ 
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
                  fontSize:16,
                  fontWeight:600,
                  cursor:'pointer'
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}