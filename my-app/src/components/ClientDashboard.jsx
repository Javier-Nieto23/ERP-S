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

/**
 * ServicioPaymentForm - Formulario de pago para servicios de instalación
 * Integrado con Stripe para procesar pagos de servicios individuales
 * 
 * @param {number} monto - Monto del servicio a pagar
 * @param {Object} datosEquipo - Información del equipo asociado al servicio
 * @param {Function} onSuccess - Callback cuando el pago es exitoso
 * @param {Function} onError - Callback cuando ocurre un error
 */
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
        console.log('📤 Enviando datosEquipo al backend:', datosEquipo)
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

/**
 * ClientDashboard - Panel principal del cliente
 * 
 * Funcionalidades:
 * - Registro de equipos con carga de archivos (responsivas)
 * - Visualización de calendario de censos programados
 * - Gestión de empleados de la empresa
 * - Sistema de tickets de soporte con categorías jerárquicas
 * - Subida de archivos adjuntos en tickets (imágenes y logs)
 * - Integración con Stripe para pagos de membresías y servicios
 * - Gestión de solicitudes de instalación de equipos
 * 
 * Vistas disponibles:
 * - home: Dashboard principal con calendario
 * - equipos: Registro y gestión de equipos
 * - empleados: Gestión de empleados
 * - tickets: Sistema de soporte con categorías
 * - instalaciones: Solicitudes de instalación
 */
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
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('')
  const [subcategoriaSeleccionada, setSubcategoriaSeleccionada] = useState('')
  const [descripcionTicket, setDescripcionTicket] = useState('')
  const [archivosTicket, setArchivosTicket] = useState([])
  const [archivosTicketsPorId, setArchivosTicketsPorId] = useState({})
  const [mostrarNotificacionTicket, setMostrarNotificacionTicket] = useState(false)
  const [mostrarNotificacionInstalacion, setMostrarNotificacionInstalacion] = useState(false)

  /**
   * Categorías jerárquicas de tickets de soporte
   * Cada categoría principal contiene múltiples subcategorías específicas
   * Iconos visuales para identificación rápida
   */
  const categoriasTickets = {
    'Error Conexión a base de datos': {
      emoji: '🔌',
      color: '#ef4444',
      subcategorias: [
        'Error al conectar a la base de datos',
        'Desconexión con la base de datos',
        'Desconexión al abrir SEER Tráfico'
      ]
    },
    'Error Ejecutando SEER Tráfico': {
      emoji: '⚠️',
      color: '#f59e0b',
      subcategorias: [
        'Ejecutable SEER Tráfico no abre',
        'Error con el importador de datos',
        'Error con el XML',
        'Botón Entrar deshabilitado',
        'Error SQL Native Client 12'
      ]
    },
    'Error Portal web': {
      emoji: '🌐',
      color: '#3b82f6',
      subcategorias: [
        'Error al conectar con la base de datos',
        'Error tiempo de espera',
        'Error con la versión',
        'Configuración función .log'
      ]
    },
    'Error en Actualización de bases de datos': {
      emoji: '🔄',
      color: '#8b5cf6',
      subcategorias: [
        'Error al ejecutar base de datos modelo',
        'Error al ejecutar actualizador',
        'Error con la Fecha de versión',
        'No se reconoce base de datos modelo'
      ]
    }
  }

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
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [mesActual, setMesActual] = useState(new Date())
  const [diaSeleccionado, setDiaSeleccionado] = useState(null)

  // Estados para instalación
  const [tipoInstalacion, setTipoInstalacion] = useState('') // 'propia' o 'asesor'
  const [instalacionStep, setInstalacionStep] = useState(0) // 0: selección tipo, 1: config, 2: censo, 3: pago
  const [pagoInstalacionPropiaExitoso, setPagoInstalacionPropiaExitoso] = useState(false)
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

  // Estados para precios de servicios
  const [preciosServicios, setPreciosServicios] = useState({})

  // Función para obtener días del mes en formato calendario
  /**
   * Genera array de días para renderizar calendario mensual
   * Crea matriz de 6x7 (42 días) incluyendo días de meses adyacentes
   * 
   * @param {Date} fecha - Fecha del mes a mostrar
   * @returns {Array} Array de objetos con {dia, esMesActual}
   */
  function getDiasDelMes(fecha) {
    const year = fecha.getFullYear()
    const month = fecha.getMonth()
    const primerDia = new Date(year, month, 1)
    const ultimoDia = new Date(year, month + 1, 0)
    const diasEnMes = ultimoDia.getDate()
    const primerDiaSemana = primerDia.getDay()
    const ajuste = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1
    
    const dias = []
    
    // Días del mes anterior
    const ultimoDiaMesAnterior = new Date(year, month, 0).getDate()
    for (let i = ajuste - 1; i >= 0; i--) {
      dias.push({
        dia: ultimoDiaMesAnterior - i,
        esMesActual: false,
        fecha: new Date(year, month - 1, ultimoDiaMesAnterior - i)
      })
    }
    
    // Días del mes actual
    for (let i = 1; i <= diasEnMes; i++) {
      dias.push({
        dia: i,
        esMesActual: true,
        fecha: new Date(year, month, i)
      })
    }
    
    // Días del siguiente mes para completar la grilla
    const diasRestantes = 42 - dias.length
    for (let i = 1; i <= diasRestantes; i++) {
      dias.push({
        dia: i,
        esMesActual: false,
        fecha: new Date(year, month + 1, i)
      })
    }
    
    return dias
  }

  // Función para obtener equipos de un día específico
  function getEquiposDelDia(diaObj) {
    if (!diaObj.esMesActual) return []
    
    const equiposFiltrados = equipos.filter(eq => {
      if (!eq.dia_agendado) return false
      const fechaAgendada = new Date(eq.dia_agendado)
      return fechaAgendada.getDate() === diaObj.dia &&
             fechaAgendada.getMonth() === mesActual.getMonth() &&
             fechaAgendada.getFullYear() === mesActual.getFullYear()
    })
    
    // Debug
    if (equiposFiltrados.length > 0) {
      console.log('📅 Equipos del día', diaObj.dia, ':', equiposFiltrados)
    }
    
    return equiposFiltrados
  }

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

    // Cargar precios de servicios
    async function loadPreciosServicios() {
      try {
        const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
        const res = await fetch(`${API}/precios-servicios`)
        if (res.ok) {
          const { servicios } = await res.json()
          const preciosMap = {}
          servicios.forEach(servicio => {
            preciosMap[servicio.codigo_servicio] = servicio
          })
          setPreciosServicios(preciosMap)
        }
      } catch (e) {
        console.error('Error loading precios:', e)
      }
    }
    loadPreciosServicios()
    
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
        
        // Cargar equipos para el calendario
        const resEquipos = await fetch(`${API}/equipos`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if(resEquipos.ok) {
          const dataEquipos = await resEquipos.json()
          setEquipos(dataEquipos.equipos || [])
          console.log('📅 Equipos cargados para calendario:', dataEquipos.equipos?.length || 0)
          console.log('📅 Equipos completos:', dataEquipos.equipos)
          // Verificar cuántos tienen dia_agendado
          const conFecha = dataEquipos.equipos?.filter(eq => eq.dia_agendado) || []
          console.log('📅 Equipos con dia_agendado:', conFecha.length)
          if (conFecha.length > 0) {
            console.log('📅 Primer equipo con fecha:', conFecha[0])
          }
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
            setSuccess('Datos cargados exitosamente.\n\nRevisa y completa el formulario.')
            
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
      
      setSuccess('Herramienta descargada exitosamente.\n\nEjecuta en terminal:\nchmod +x censo_equipos.sh\n./censo_equipos.sh\n\nSubir el archivo .txt generado.')
      
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
      
      setSuccess('Herramienta descargada exitosamente.\n\nEjecuta: censo_equipos.bat\n\nSubir el archivo .txt generado.')
      
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
      
      setSuccess('Censo registrado exitosamente.\n\nPuedes registrar otro equipo.')
      
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

  /**
   * Carga archivos adjuntos de un ticket específico
   * Se ejecuta al hacer hover sobre un ticket en la lista
   * 
   * @param {number} ticketId - ID del ticket
   */
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

  /**
   * Descarga un archivo adjunto de un ticket
   * Crea blob y activa descarga automática en el navegador
   * 
   * @param {number} archivoId - ID del archivo en base de datos
   * @param {string} nombreArchivo - Nombre original del archivo
   */
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
      } else {
        setError('Error al descargar el archivo')
      }
    } catch (e) {
      setError('Error de conexión al descargar archivo')
    }
  }

  /**
   * Envía nuevo ticket de soporte al backend
   * Soporta subida de hasta 5 archivos adjuntos (imágenes y logs)
   * Utiliza FormData para enviar archivos junto con datos del ticket
   * 
   * @param {Event} e - Evento del formulario
   */
  async function handleTicketSubmit(e){
    e.preventDefault()
    setError('')
    setSuccess('')
    
    if(!categoriaSeleccionada || !subcategoriaSeleccionada || !descripcionTicket){
      setError('Por favor completa todos los campos requeridos')
      return
    }
    
    try{
      const token = localStorage.getItem('token')
      const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      
      // Crear FormData para incluir archivos
      const formData = new FormData()
      formData.append('asunto', `${categoriaSeleccionada} - ${subcategoriaSeleccionada}`)
      formData.append('descripcion', descripcionTicket)
      formData.append('prioridad', 'alta')
      formData.append('categoria', categoriaSeleccionada)
      formData.append('subcategoria', subcategoriaSeleccionada)
      
      // Agregar archivos si hay
      if(archivosTicket.length > 0){
        archivosTicket.forEach(archivo => {
          formData.append('archivos', archivo)
        })
      }
      
      const res = await fetch(`${API}/tickets`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      })
      
      const data = await res.json()
      if(!res.ok) return setError(data.error || 'Error al crear ticket')
      
      // Mostrar notificación animada
      setMostrarNotificacionTicket(true)
      setTimeout(() => setMostrarNotificacionTicket(false), 3000)
      
      setSuccess('✓ Ticket creado exitosamente')
      setCategoriaSeleccionada('')
      setSubcategoriaSeleccionada('')
      setDescripcionTicket('')
      setArchivosTicket([])
      await fetchTickets()
    }catch(e){
      setError('Error de conexión')
    }
  }

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
      {/* Notificación de Ticket Creado */}
      {mostrarNotificacionInstalacion && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          color: 'white',
          padding: '16px 24px',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(59,130,246,0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          zIndex: 10001,
          minWidth: 360,
          animation: 'slideInBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}>>
          <style>{`
            @keyframes slideInBounce {
              0% {
                transform: translateX(500px) scale(0.5);
                opacity: 0;
              }
              50% {
                transform: translateX(-20px) scale(1.05);
              }
              100% {
                transform: translateX(0) scale(1);
                opacity: 1;
              }
            }
          `}</style>
          <div style={{
            fontSize: 32,
            animation: 'pulse 1.5s infinite'
          }}>>
            <style>{`
              @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.15); }
              }
            `}</style>
            🚀
          </div>
          <div style={{flex: 1}}>>
            <div style={{
              fontWeight: 700,
              fontSize: 16,
              marginBottom: 4,
              letterSpacing: '0.3px'
            }}>>
              ¡Solicitud de Instalación Enviada!
            </div>
            <div style={{
              fontSize: 13,
              opacity: 0.95
            }}>>
              Tu equipo ha sido registrado y la instalación programada
            </div>
          </div>
          <div style={{
            fontSize: 24,
            cursor: 'pointer',
            opacity: 0.8,
            transition: 'opacity 0.2s'
          }}
          onClick={() => setMostrarNotificacionInstalacion(false)}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
          >
            ⚙️
          </div>
        </div>
      )}

      {/* Notificación de ticket creado */}
      {mostrarNotificacionTicket && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: 'white',
          padding: '16px 24px',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(16,185,129,0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          zIndex: 10000,
          minWidth: 320,
          animation: 'slideInBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}>
          <style>{`
            @keyframes slideInBounce {
              0% {
                transform: translateX(500px) scale(0.5);
                opacity: 0;
              }
              50% {
                transform: translateX(-20px) scale(1.05);
              }
              100% {
                transform: translateX(0) scale(1);
                opacity: 1;
              }
            }
          `}</style>
          <div style={{
            fontSize: 28,
            animation: 'bounce 1s infinite'
          }}>
            <style>{`
              @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-5px); }
              }
            `}</style>
            ✅
          </div>
          <div style={{flex: 1}}>
            <div style={{
              fontWeight: 700,
              fontSize: 15,
              marginBottom: 4,
              letterSpacing: '0.3px'
            }}>
              ¡Ticket Creado con Éxito!
            </div>
            <div style={{
              fontSize: 12,
              opacity: 0.9
            }}>
              Tu ticket ha sido registrado correctamente
            </div>
          </div>
          <div style={{
            fontSize: 24,
            cursor: 'pointer',
            opacity: 0.8,
            transition: 'opacity 0.2s'
          }}
          onClick={() => setMostrarNotificacionTicket(false)}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
          >
            🎫
          </div>
        </div>
      )}
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
            }}>Portal Cliente</div>
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
              placeholder="Buscar"
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
            title={!sidebarExpanded ? 'Inicio' : ''}
          >
            <span style={{fontSize: 20, minWidth: 20}}>🏠</span>
            {sidebarExpanded && (
              <span style={{
                whiteSpace: 'nowrap',
                opacity: sidebarExpanded ? 1 : 0,
                transition: 'opacity 0.3s ease 0.1s'
              }}>Inicio</span>
            )}
          </button>

          <button 
            onClick={() => setView('perfil')} 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarExpanded ? 'flex-start' : 'center',
              gap: 12,
              width: sidebarExpanded ? '100%' : 48,
              height: 48,
              margin: sidebarExpanded ? '0 0 4px 0' : '0 auto 8px',
              padding: sidebarExpanded ? '10px 12px' : '0',
              background: view === 'perfil' ? 'white' : 'transparent',
              border: 'none',
              borderRadius: 8,
              color: view === 'perfil' ? '#1e293b' : '#64748b',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: view === 'perfil' ? 500 : 400,
              transition: 'all 0.2s',
              boxShadow: view === 'perfil' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
            onMouseEnter={(e) => {
              if(view !== 'perfil') {
                e.currentTarget.style.background = '#f1f5f9';
              }
            }}
            onMouseLeave={(e) => {
              if(view !== 'perfil') {
                e.currentTarget.style.background = 'transparent';
              }
            }}
            title={!sidebarExpanded ? 'Mi Perfil' : ''}
          >
            <span style={{fontSize: 20, minWidth: 20}}>👤</span>
            {sidebarExpanded && (
              <span style={{
                whiteSpace: 'nowrap',
                opacity: sidebarExpanded ? 1 : 0,
                transition: 'opacity 0.3s ease 0.1s'
              }}>Mi Perfil</span>
            )}
          </button>

          <button 
            onClick={() => setView('empleados')} 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarExpanded ? 'flex-start' : 'center',
              gap: 12,
              width: sidebarExpanded ? '100%' : 48,
              height: 48,
              margin: sidebarExpanded ? '0 0 4px 0' : '0 auto 8px',
              padding: sidebarExpanded ? '10px 12px' : '0',
              background: view === 'empleados' ? 'white' : 'transparent',
              border: 'none',
              borderRadius: 8,
              color: view === 'empleados' ? '#1e293b' : '#64748b',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: view === 'empleados' ? 500 : 400,
              transition: 'all 0.2s',
              boxShadow: view === 'empleados' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
            onMouseEnter={(e) => {
              if(view !== 'empleados') {
                e.currentTarget.style.background = '#f1f5f9';
              }
            }}
            onMouseLeave={(e) => {
              if(view !== 'empleados') {
                e.currentTarget.style.background = 'transparent';
              }
            }}
            title={!sidebarExpanded ? 'Empleados' : ''}
          >
            <span style={{fontSize: 20, minWidth: 20}}>👥</span>
            {sidebarExpanded && (
              <span style={{
                whiteSpace: 'nowrap',
                opacity: sidebarExpanded ? 1 : 0,
                transition: 'opacity 0.3s ease 0.1s'
              }}>Empleados</span>
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
            title={!sidebarExpanded ? 'Equipos' : ''}
          >
            <span style={{fontSize: 20, minWidth: 20}}>📦</span>
            {sidebarExpanded && (
              <span style={{
                whiteSpace: 'nowrap',
                opacity: sidebarExpanded ? 1 : 0,
                transition: 'opacity 0.3s ease 0.1s'
              }}>Equipos</span>
            )}
          </button>

          <button 
            onClick={() => {setView('instalacion'); setTipoInstalacion(''); setInstalacionStep(0); setPagoInstalacionPropiaExitoso(false);}} 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarExpanded ? 'flex-start' : 'center',
              gap: 12,
              width: sidebarExpanded ? '100%' : 48,
              height: 48,
              margin: sidebarExpanded ? '0 0 4px 0' : '0 auto 8px',
              padding: sidebarExpanded ? '10px 12px' : '0',
              background: view === 'instalacion' ? 'white' : 'transparent',
              border: 'none',
              borderRadius: 8,
              color: view === 'instalacion' ? '#1e293b' : '#64748b',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: view === 'instalacion' ? 500 : 400,
              transition: 'all 0.2s',
              boxShadow: view === 'instalacion' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
            onMouseEnter={(e) => {
              if(view !== 'instalacion') {
                e.currentTarget.style.background = '#f1f5f9';
              }
            }}
            onMouseLeave={(e) => {
              if(view !== 'instalacion') {
                e.currentTarget.style.background = 'transparent';
              }
            }}
            title={!sidebarExpanded ? 'Instalación' : ''}
          >
            <span style={{fontSize: 20, minWidth: 20}}>⬇️</span>
            {sidebarExpanded && (
              <span style={{
                whiteSpace: 'nowrap',
                opacity: sidebarExpanded ? 1 : 0,
                transition: 'opacity 0.3s ease 0.1s'
              }}>Instalación</span>
            )}
          </button>

          <button 
            onClick={() => membresiaActiva ? setView('census') : setError('⚠️ Necesitas una membresía activa para censar equipos. Por favor, realiza un pago.')} 
            disabled={!membresiaActiva}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarExpanded ? 'flex-start' : 'center',
              gap: 12,
              width: sidebarExpanded ? '100%' : 48,
              height: 48,
              margin: sidebarExpanded ? '0 0 4px 0' : '0 auto 8px',
              padding: sidebarExpanded ? '10px 12px' : '0',
              background: view === 'census' ? 'white' : 'transparent',
              border: 'none',
              borderRadius: 8,
              color: membresiaActiva ? (view === 'census' ? '#1e293b' : '#64748b') : '#94a3b8',
              cursor: membresiaActiva ? 'pointer' : 'not-allowed',
              fontSize: 15,
              fontWeight: view === 'census' ? 500 : 400,
              transition: 'all 0.2s',
              boxShadow: view === 'census' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              opacity: membresiaActiva ? 1 : 0.6
            }}
            onMouseEnter={(e) => {
              if(view !== 'census' && membresiaActiva) {
                e.currentTarget.style.background = '#f1f5f9';
              }
            }}
            onMouseLeave={(e) => {
              if(view !== 'census' && membresiaActiva) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
            title={!sidebarExpanded ? (membresiaActiva ? 'Censar Equipo' : 'Bloqueado') : ''}
          >
            <span style={{fontSize: 20, minWidth: 20}}>{membresiaActiva ? '📋' : '🔒'}</span>
            {sidebarExpanded && (
              <span style={{
                whiteSpace: 'nowrap',
                opacity: sidebarExpanded ? 1 : 0,
                transition: 'opacity 0.3s ease 0.1s'
              }}>
                {membresiaActiva ? 'Censar Equipo' : 'Censar (Bloqueado)'}
              </span>
            )}
          </button>

          <button 
            onClick={() => membresiaActiva ? setView('tickets') : setError('⚠️ Necesitas una membresía activa para crear tickets. Por favor, realiza un pago.')} 
            disabled={!membresiaActiva}
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
              color: membresiaActiva ? (view === 'tickets' ? '#1e293b' : '#64748b') : '#94a3b8',
              cursor: membresiaActiva ? 'pointer' : 'not-allowed',
              fontSize: 15,
              fontWeight: view === 'tickets' ? 500 : 400,
              transition: 'all 0.2s',
              boxShadow: view === 'tickets' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              opacity: membresiaActiva ? 1 : 0.6
            }}
            onMouseEnter={(e) => {
              if(view !== 'tickets' && membresiaActiva) {
                e.currentTarget.style.background = '#f1f5f9';
              }
            }}
            onMouseLeave={(e) => {
              if(view !== 'tickets' && membresiaActiva) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
            title={!sidebarExpanded ? (membresiaActiva ? 'Tickets' : 'Bloqueado') : ''}
          >
            <span style={{fontSize: 20, minWidth: 20}}>{membresiaActiva ? '🎫' : '🔒'}</span>
            {sidebarExpanded && (
              <span style={{
                whiteSpace: 'nowrap',
                opacity: sidebarExpanded ? 1 : 0,
                transition: 'opacity 0.3s ease 0.1s'
              }}>
                {membresiaActiva ? 'Tickets' : 'Tickets (Bloqueado)'}
              </span>
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
      <div style={{flex:1,padding:24,overflow:'auto'}}>
        
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
            <h2 style={{marginBottom:24,display:'flex',alignItems:'center',gap:8,fontSize:28,fontWeight:700,color:'#1e293b'}}>
              🏠 Panel de Control
            </h2>
            
            {/* Recuadros informativos de suscripción */}
            <div style={{
              display:'grid',
              gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))',
              gap:20,
              marginBottom:32
            }}>
              {/* Recuadro 1: Plan Actual */}
              <div style={{
                background:'white',
                borderRadius:12,
                padding:24,
                boxShadow:'0 1px 3px rgba(0,0,0,0.1)',
                border:'2px solid #e2e8f0',
                display:'flex',
                alignItems:'center',
                gap:16
              }}>
                <div style={{
                  width:56,
                  height:56,
                  borderRadius:12,
                  background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'center',
                  fontSize:28,
                  flexShrink:0
                }}>
                  📋
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,color:'#64748b',marginBottom:4,fontWeight:500}}>Plan Actual</div>
                  <div style={{fontSize:20,fontWeight:700,color:'#1e293b'}}>
                    {(() => {
                      if (!suscripcion) return ;
                      
                      const dias = parseInt(suscripcion.dias_agregados);
                      if (isNaN(dias) || dias <= 0) return 'Sin Plan Activo';
                      
                      if (dias >= 365) return 'Plan Anual';
                      if (dias >= 90) return 'Plan Trimestral';
                      if (dias >= 30) return 'Plan Mensual';
                      return 'Plan Personalizado';
                    })()}
                  </div>
                  <div style={{fontSize:12,color:'#64748b',marginTop:4}}>
                    {suscripcion?.estado === 'activa' ? '✓ Activo' : '⚠ Inactivo'}
                  </div>
                </div>
              </div>

              {/* Recuadro 2: Días Restantes */}
              <div style={{
                background:'white',
                borderRadius:12,
                padding:24,
                boxShadow:'0 1px 3px rgba(0,0,0,0.1)',
                border:'2px solid #e2e8f0',
                display:'flex',
                alignItems:'center',
                gap:16
              }}>
                <div style={{
                  width:56,
                  height:56,
                  borderRadius:12,
                  background:'#dbeafe',
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'center',
                  fontSize:28,
                  flexShrink:0
                }}>
                  ⏰
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,color:'#64748b',marginBottom:4,fontWeight:500}}>Días Restantes</div>
                  <div style={{fontSize:28,fontWeight:700,color:'#1e40af'}}>
                    {suscripcion?.dias_restantes || 0}
                  </div>
                  <div style={{fontSize:12,color:'#64748b',marginTop:4}}>
                    días de servicio
                  </div>
                </div>
              </div>

              {/* Recuadro 3: Fecha de Vencimiento */}
              <div style={{
                background:'white',
                borderRadius:12,
                padding:24,
                boxShadow:'0 1px 3px rgba(0,0,0,0.1)',
                border:'2px solid #e2e8f0',
                display:'flex',
                alignItems:'center',
                gap:16
              }}>
                <div style={{
                  width:56,
                  height:56,
                  borderRadius:12,
                  background:'#fef3c7',
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'center',
                  fontSize:28,
                  flexShrink:0
                }}>
                  📅
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,color:'#64748b',marginBottom:4,fontWeight:500}}>Vencimiento</div>
                  <div style={{fontSize:16,fontWeight:700,color:'#92400e'}}>
                    {suscripcion?.fecha_expiracion 
                      ? new Date(suscripcion.fecha_expiracion).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })
                      : 'No disponible'}
                  </div>
                  <div style={{fontSize:12,color:'#64748b',marginTop:4}}>
                    fecha límite
                  </div>
                </div>
              </div>
            </div>

            {/* Calendario de Equipos Agendados */}
            <div style={{background:'white',borderRadius:12,padding:24,boxShadow:'0 1px 3px rgba(0,0,0,0.1)',border:'1px solid #e2e8f0'}}>
              <h3 style={{fontSize:20,fontWeight:700,color:'#1e293b',marginBottom:20,display:'flex',alignItems:'center',gap:8}}>
                📅 Calendario de Equipos Programados
              </h3>
              
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
                  const equiposDia = getEquiposDelDia(diaObj);
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
                      
                      {equiposDia.length > 0 && (
                        <div style={{display:'flex',flexDirection:'column',gap:2}}>
                          {equiposDia.slice(0, 3).map((equipo, i) => {
                            // Definir color según status
                            let bgColor = '#3b82f6'; // azul por defecto
                            let emoji = '📦';
                            
                            if (equipo.status === 'programado' || equipo.status === 'instalacion programada') {
                              bgColor = '#f59e0b'; // naranja
                              emoji = '📅';
                            } else if (equipo.status === 'registrado') {
                              bgColor = '#10b981'; // verde
                              emoji = '✅';
                            } else if (equipo.status === 'en_proceso') {
                              bgColor = '#8b5cf6'; // morado
                              emoji = '⚙️';
                            } else if (equipo.status === 'completado') {
                              bgColor = '#059669'; // verde oscuro
                              emoji = '✔️';
                            }
                            
                            return (
                              <div
                                key={i}
                                title={`${equipo.marca} ${equipo.modelo} - ${equipo.status}`}
                                style={{
                                  padding:'2px 6px',
                                  background: bgColor,
                                  color:'white',
                                  fontSize:11,
                                  borderRadius:4,
                                  overflow:'hidden',
                                  textOverflow:'ellipsis',
                                  whiteSpace:'nowrap',
                                  cursor:'pointer',
                                  fontWeight:600
                                }}
                              >
                                {emoji} {equipo.marca}
                              </div>
                            );
                          })}
                          
                          {equiposDia.length > 3 && (
                            <div style={{
                              fontSize:10,
                              color:'#64748b',
                              fontWeight:600,
                              marginTop:2
                            }}>
                              +{equiposDia.length - 3} más
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
                  <div style={{width:16,height:16,background:'#f59e0b',borderRadius:4}}></div>
                  <span style={{fontSize:14,color:'#64748b'}}>📅 Programado</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:16,height:16,background:'#10b981',borderRadius:4}}></div>
                  <span style={{fontSize:14,color:'#64748b'}}>✅ Registrado</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:16,height:16,background:'#8b5cf6',borderRadius:4}}></div>
                  <span style={{fontSize:14,color:'#64748b'}}>⚙️ En Proceso</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:16,height:16,background:'#059669',borderRadius:4}}></div>
                  <span style={{fontSize:14,color:'#64748b'}}>✔️ Completado</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:16,height:16,background:'#3b82f6',borderRadius:4}}></div>
                  <span style={{fontSize:14,color:'#64748b'}}>📦 Otros</span>
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
                        📅 Equipos del {diaSeleccionado.dia} de {mesActual.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
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
                      const equiposDia = getEquiposDelDia(diaSeleccionado);

                      if (equiposDia.length === 0) {
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
                              No hay equipos programados
                            </p>
                            <p style={{
                              fontSize:15,
                              color:'#64748b',
                              margin:0
                            }}>
                              Este día no tiene equipos agendados
                            </p>
                          </div>
                        );
                      }

                      return (
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
                            <div style={{width:12,height:12,background:'#3b82f6',borderRadius:'50%'}}></div>
                            Equipos Programados ({equiposDia.length})
                          </h4>
                          <div style={{display:'flex',flexDirection:'column',gap:12}}>
                            {equiposDia.map((equipo, idx) => {
                              // Definir colores según status
                              let bgColor = '#f0f9ff';
                              let borderColor = '#bfdbfe';
                              let badgeBg = '#3b82f6';
                              let statusText = equipo.status || 'N/A';
                              let emoji = '📦';
                              
                              if (equipo.status === 'programado' || equipo.status === 'instalacion programada') {
                                bgColor = '#fef3c7';
                                borderColor = '#fcd34d';
                                badgeBg = '#f59e0b';
                                statusText = '📅 Programado';
                                emoji = '📅';
                              } else if (equipo.status === 'registrado') {
                                bgColor = '#d1fae5';
                                borderColor = '#6ee7b7';
                                badgeBg = '#10b981';
                                statusText = '✅ Registrado';
                                emoji = '✅';
                              } else if (equipo.status === 'en_proceso') {
                                bgColor = '#ede9fe';
                                borderColor = '#c4b5fd';
                                badgeBg = '#8b5cf6';
                                statusText = '⚙️ En Proceso';
                                emoji = '⚙️';
                              } else if (equipo.status === 'completado') {
                                bgColor = '#d1fae5';
                                borderColor = '#34d399';
                                badgeBg = '#059669';
                                statusText = '✔️ Completado';
                                emoji = '✔️';
                              }
                              
                              return (
                                <div
                                  key={idx}
                                  style={{
                                    padding:20,
                                    background:bgColor,
                                    border:`2px solid ${borderColor}`,
                                    borderRadius:10,
                                    display:'flex',
                                    justifyContent:'space-between',
                                    alignItems:'center',
                                    gap:16
                                  }}
                                >
                                  <div style={{flex:1}}>
                                    <div style={{fontSize:16,fontWeight:700,color:'#1e293b',marginBottom:6}}>
                                      {emoji} {equipo.marca} {equipo.modelo}
                                    </div>
                                    <div style={{fontSize:14,color:'#64748b',marginBottom:4}}>
                                      📦 Tipo: {equipo.tipo_equipo || 'N/A'}
                                    </div>
                                    <div style={{fontSize:14,color:'#64748b',marginBottom:4}}>
                                      🔢 Serie: {equipo.numero_serie || 'N/A'}
                                    </div>
                                    {equipo.dia_agendado && (
                                      <div style={{fontSize:14,fontWeight:600,color:'#3b82f6'}}>
                                        🕐 {new Date(equipo.dia_agendado).toLocaleTimeString('es-MX', {hour: '2-digit', minute: '2-digit'})}
                                      </div>
                                    )}
                                  </div>
                                  <div style={{display:'flex',flexDirection:'column',gap:8,alignItems:'flex-end'}}>
                                    <span style={{
                                      padding:'6px 12px',
                                      background: badgeBg,
                                      color:'white',
                                      fontSize:12,
                                      borderRadius:12,
                                      fontWeight:600
                                    }}>
                                      {statusText}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </>
            )}
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
          <div style={{maxWidth:1200,margin:'0 auto'}}>
            {/* Header */}
            <div style={{marginBottom:32}}>
              <h2 style={{
                fontSize:32,
                fontWeight:700,
                color:'#1e293b',
                marginBottom:8,
                display:'flex',
                alignItems:'center',
                gap:12
              }}>
                📋 Solicitar Censo de Equipo
              </h2>
              <p style={{fontSize:16,color:'#64748b',margin:0}}>
                Registra equipos de manera automática o manual
              </p>
            </div>
            
            {/* Mensaje de éxito con animación - Toast en esquina superior derecha */}
            {success && (
              <div style={{
                position:'fixed',
                top:20,
                right:20,
                background:'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color:'white',
                padding:'16px 20px',
                borderRadius:12,
                maxWidth:400,
                boxShadow:'0 10px 25px rgba(16, 185, 129, 0.4)',
                fontSize:14,
                fontWeight:600,
                display:'flex',
                alignItems:'flex-start',
                gap:12,
                animation:'slideInRight 0.5s ease-out',
                border:'2px solid rgba(255,255,255,0.3)',
                zIndex:9999
              }}>
                <style>
                  {`
                    @keyframes slideInRight {
                      from {
                        opacity: 0;
                        transform: translateX(100%);
                      }
                      to {
                        opacity: 1;
                        transform: translateX(0);
                      }
                    }
                  `}
                </style>
                <span style={{fontSize:20,flexShrink:0}}>✅</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:15,marginBottom:4,fontWeight:700}}>¡Éxito!</div>
                  <div style={{fontSize:13,opacity:0.95,lineHeight:1.4,whiteSpace:'pre-line'}}>{success}</div>
                </div>
                <button
                  onClick={() => setSuccess('')}
                  style={{
                    background:'transparent',
                    border:'none',
                    color:'white',
                    fontSize:18,
                    cursor:'pointer',
                    padding:0,
                    marginLeft:8,
                    opacity:0.7,
                    transition:'opacity 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.opacity = 1}
                  onMouseLeave={(e) => e.target.style.opacity = 0.7}
                >
                  ✕
                </button>
              </div>
            )}
            
            {/* Mensaje de error */}
            {error && (
              <div style={{
                position:'fixed',
                top:20,
                right:20,
                background:'#fee2e2',
                color:'#991b1b',
                padding:'16px 20px',
                borderRadius:12,
                maxWidth:400,
                boxShadow:'0 10px 25px rgba(239, 68, 68, 0.3)',
                fontSize:14,
                fontWeight:600,
                display:'flex',
                alignItems:'flex-start',
                gap:12,
                border:'2px solid #fca5a5',
                zIndex:9999,
                animation:'slideInRight 0.5s ease-out'
              }}>
                <span style={{fontSize:20,flexShrink:0}}>⚠️</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:15,marginBottom:4,fontWeight:700}}>Error</div>
                  <div style={{fontSize:13,lineHeight:1.4}}>{error}</div>
                </div>
                <button
                  onClick={() => setError('')}
                  style={{
                    background:'transparent',
                    border:'none',
                    color:'#991b1b',
                    fontSize:18,
                    cursor:'pointer',
                    padding:0,
                    marginLeft:8,
                    opacity:0.7,
                    transition:'opacity 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.opacity = 1}
                  onMouseLeave={(e) => e.target.style.opacity = 0.7}
                >
                  ✕
                </button>
              </div>
            )}
            
            {/* Selección de tipo de equipo */}
            {!tipoEquipoSeleccionado && (
              <div style={{
                background:'white',
                borderRadius:16,
                padding:40,
                boxShadow:'0 1px 3px rgba(0,0,0,0.1)',
                border:'1px solid #e2e8f0'
              }}>
                <h3 style={{
                  fontSize:24,
                  fontWeight:700,
                  marginBottom:12,
                  color:'#1e293b',
                  textAlign:'center'
                }}>
                  ¿Qué tipo de equipo vas a censar?
                </h3>
                <p style={{
                  fontSize:16,
                  color:'#64748b',
                  marginBottom:40,
                  textAlign:'center'
                }}>
                  Selecciona el tipo de equipo para continuar
                </p>
                
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
              <div style={{
                background:'white',
                borderRadius:16,
                padding:40,
                boxShadow:'0 1px 3px rgba(0,0,0,0.1)',
                border:'1px solid #e2e8f0'
              }}>
                {/* Botón para volver a la selección */}
                <button 
                  onClick={()=>{
                    setTipoEquipoSeleccionado('');
                    setArchivoResponsiva(null);
                    setResponsivaDescargada(false);
                    setForm({...form, tipo_equipo:''});
                  }}
                  style={{
                    padding:'10px 20px',
                    background:'#f1f5f9',
                    color:'#475569',
                    border:'1px solid #e2e8f0',
                    borderRadius:8,
                    cursor:'pointer',
                    fontSize:14,
                    fontWeight:600,
                    marginBottom:24,
                    display:'flex',
                    alignItems:'center',
                    gap:8,
                    transition:'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#e2e8f0';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#f1f5f9';
                  }}
                >
                  ← Volver a selección de tipo de equipo
                </button>

                {/* Censo Automático */}
                <div style={{
                  background:'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                  border:'2px solid #10b981',
                  borderRadius:12,
                  padding:24,
                  marginBottom:32
                }}>
                  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                    <span style={{fontSize:28}}>⚡</span>
                    <h3 style={{margin:0,fontSize:20,fontWeight:700,color:'#047857'}}>
                      Censo Automático (Recomendado)
                    </h3>
                  </div>
                  <p style={{margin:'0 0 20px 0',fontSize:14,color:'#065f46',lineHeight:1.6}}>
                    Descarga la herramienta para tu sistema operativo, ejecútala y sube el archivo .txt generado.
                  </p>
                  
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20}}>
                    <button 
                      type='button' 
                      onClick={handleDownloadWindowsTool} 
                      style={{
                        padding:'14px 24px',
                        background:'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                        color:'white',
                        border:'none',
                        borderRadius:10,
                        cursor:'pointer',
                        fontSize:15,
                        fontWeight:600,
                        display:'flex',
                        alignItems:'center',
                        justifyContent:'center',
                        gap:8,
                        transition:'all 0.2s',
                        boxShadow:'0 4px 12px rgba(14, 165, 233, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 6px 16px rgba(14, 165, 233, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 4px 12px rgba(14, 165, 233, 0.3)';
                      }}
                    >
                      🪟 Windows (.bat)
                    </button>
                    <button 
                      type='button' 
                      onClick={handleDownloadAutoTool} 
                      style={{
                        padding:'14px 24px',
                        background:'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color:'white',
                        border:'none',
                        borderRadius:10,
                        cursor:'pointer',
                        fontSize:15,
                        fontWeight:600,
                        display:'flex',
                        alignItems:'center',
                        justifyContent:'center',
                        gap:8,
                        transition:'all 0.2s',
                        boxShadow:'0 4px 12px rgba(16, 185, 129, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                      }}
                    >
                      🐧 Linux (.sh)
                    </button>
                  </div>
                  
                  {/* Campo para subir archivo txt */}
                  <div style={{
                    padding:20,
                    background:'white',
                    borderRadius:10,
                    border:'2px dashed #0284c7'
                  }}>
                    <label style={{
                      marginBottom:12,
                      fontSize:15,
                      fontWeight:600,
                      color:'#0c4a6e',
                      display:'flex',
                      alignItems:'center',
                      gap:8
                    }}>
                      <span style={{fontSize:20}}>📁</span>
                      Cargar archivo de censo (.txt)
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
                <div style={{marginTop:32}}>
                  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
                    <span style={{fontSize:24}}>✍️</span>
                    <h3 style={{margin:0,fontSize:20,fontWeight:700,color:'#1e293b'}}>
                      Formulario Manual
                    </h3>
                  </div>
                  <form onSubmit={handleCensusSubmit}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                      <label style={{display:'flex',flexDirection:'column',gap:6}}>
                        <span style={{fontSize:14,fontWeight:600,color:'#475569'}}>Marca *</span>
                        <input 
                          required 
                          value={form.marca} 
                          onChange={e=>setForm({...form,marca:e.target.value})} 
                          style={{
                            width:'100%',
                            padding:'10px 12px',
                            border:'2px solid #e2e8f0',
                            borderRadius:8,
                            fontSize:14,
                            outline:'none',
                            transition:'border-color 0.2s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                      </label>
                      <label style={{display:'flex',flexDirection:'column',gap:6}}>
                        <span style={{fontSize:14,fontWeight:600,color:'#475569'}}>Modelo *</span>
                        <input 
                          required 
                          value={form.modelo} 
                          onChange={e=>setForm({...form,modelo:e.target.value})} 
                          style={{
                            width:'100%',
                            padding:'10px 12px',
                            border:'2px solid #e2e8f0',
                            borderRadius:8,
                            fontSize:14,
                            outline:'none',
                            transition:'border-color 0.2s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                      </label>
                      <label style={{display:'flex',flexDirection:'column',gap:6}}>
                        <span style={{fontSize:14,fontWeight:600,color:'#475569'}}>No. Serie *</span>
                        <input 
                          required 
                          value={form.no_serie} 
                          onChange={e=>setForm({...form,no_serie:e.target.value})} 
                          style={{
                            width:'100%',
                            padding:'10px 12px',
                            border:'2px solid #e2e8f0',
                            borderRadius:8,
                            fontSize:14,
                            outline:'none',
                            transition:'border-color 0.2s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                      </label>
                      <label style={{display:'flex',flexDirection:'column',gap:6}}>
                        <span style={{fontSize:14,fontWeight:600,color:'#475569'}}>Código Registro</span>
                        <input 
                          value={form.codigo_registro} 
                          onChange={e=>setForm({...form,codigo_registro:e.target.value})} 
                          style={{
                            width:'100%',
                            padding:'10px 12px',
                            border:'2px solid #e2e8f0',
                            borderRadius:8,
                            fontSize:14,
                            outline:'none',
                            transition:'border-color 0.2s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                      </label>
                      <label style={{display:'flex',flexDirection:'column',gap:6}}>
                        <span style={{fontSize:14,fontWeight:600,color:'#475569'}}>Memoria RAM</span>
                        <input 
                          value={form.memoria_ram} 
                          onChange={e=>setForm({...form,memoria_ram:e.target.value})} 
                          placeholder="Ej: 8GB"
                          style={{
                            width:'100%',
                            padding:'10px 12px',
                            border:'2px solid #e2e8f0',
                            borderRadius:8,
                            fontSize:14,
                            outline:'none',
                            transition:'border-color 0.2s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                      </label>
                      <label style={{display:'flex',flexDirection:'column',gap:6}}>
                        <span style={{fontSize:14,fontWeight:600,color:'#475569'}}>Disco Duro</span>
                        <input 
                          value={form.disco_duro} 
                          onChange={e=>setForm({...form,disco_duro:e.target.value})} 
                          placeholder="Ej: 500GB SSD"
                          style={{
                            width:'100%',
                            padding:'10px 12px',
                            border:'2px solid #e2e8f0',
                            borderRadius:8,
                            fontSize:14,
                            outline:'none',
                            transition:'border-color 0.2s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                      </label>
                      <label style={{display:'flex',flexDirection:'column',gap:6}}>
                        <span style={{fontSize:14,fontWeight:600,color:'#475569'}}>Serie Disco Duro</span>
                        <input 
                          value={form.serie_disco_duro} 
                          onChange={e=>setForm({...form,serie_disco_duro:e.target.value})} 
                          style={{
                            width:'100%',
                            padding:'10px 12px',
                            border:'2px solid #e2e8f0',
                            borderRadius:8,
                            fontSize:14,
                            outline:'none',
                            transition:'border-color 0.2s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                      </label>
                      <label style={{display:'flex',flexDirection:'column',gap:6}}>
                        <span style={{fontSize:14,fontWeight:600,color:'#475569'}}>Sistema Operativo</span>
                        <input 
                          value={form.sistema_operativo} 
                          onChange={e=>setForm({...form,sistema_operativo:e.target.value})} 
                          placeholder="Ej: Windows 11"
                          style={{
                            width:'100%',
                            padding:'10px 12px',
                            border:'2px solid #e2e8f0',
                            borderRadius:8,
                            fontSize:14,
                            outline:'none',
                            transition:'border-color 0.2s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                      </label>
                      <label style={{display:'flex',flexDirection:'column',gap:6}}>
                        <span style={{fontSize:14,fontWeight:600,color:'#475569'}}>Procesador</span>
                        <input 
                          value={form.procesador} 
                          onChange={e=>setForm({...form,procesador:e.target.value})} 
                          placeholder="Ej: Intel i5"
                          style={{
                            width:'100%',
                            padding:'10px 12px',
                            border:'2px solid #e2e8f0',
                            borderRadius:8,
                            fontSize:14,
                            outline:'none',
                            transition:'border-color 0.2s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                      </label>
                      <label style={{display:'flex',flexDirection:'column',gap:6}}>
                        <span style={{fontSize:14,fontWeight:600,color:'#475569'}}>Empleado Asignado *</span>
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
                          style={{
                            width:'100%',
                            padding:'10px 12px',
                            border:'2px solid #e2e8f0',
                            borderRadius:8,
                            fontSize:14,
                            outline:'none',
                            cursor:'pointer',
                            transition:'border-color 0.2s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        >
                          <option value="">-- Seleccionar Empleado --</option>
                          {empleados.map(emp=>(
                            <option key={emp.id} value={emp.id}>
                              {emp.id_empleado} - {emp.nombre_empleado}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label style={{display:'flex',flexDirection:'column',gap:6}}>
                        <span style={{fontSize:14,fontWeight:600,color:'#475569'}}>Tipo de Equipo</span>
                        <input 
                          value={form.tipo_equipo} 
                          onChange={e=>setForm({...form,tipo_equipo:e.target.value})} 
                          placeholder="Ej: Laptop, Escritorio"
                          style={{
                            width:'100%',
                            padding:'10px 12px',
                            border:'2px solid #e2e8f0',
                            borderRadius:8,
                            fontSize:14,
                            outline:'none',
                            transition:'border-color 0.2s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                      </label>
                      <label style={{display:'flex',flexDirection:'column',gap:6}}>
                        <span style={{fontSize:14,fontWeight:600,color:'#475569'}}>Nombre de Equipo</span>
                        <input 
                          value={form.nombre_equipo} 
                          onChange={e=>setForm({...form,nombre_equipo:e.target.value})} 
                          style={{
                            width:'100%',
                            padding:'10px 12px',
                            border:'2px solid #e2e8f0',
                            borderRadius:8,
                            fontSize:14,
                            outline:'none',
                            transition:'border-color 0.2s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                      </label>
                    </div>
                    <div style={{display:'flex',gap:12,marginTop:24}}>
                      <button 
                        type='submit' 
                        style={{
                          flex:1,
                          padding:'12px 24px',
                          background:'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                          color:'white',
                          border:'none',
                          borderRadius:10,
                          cursor:'pointer',
                          fontWeight:600,
                          fontSize:16,
                          boxShadow:'0 4px 12px rgba(79, 70, 229, 0.3)',
                          transition:'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 6px 16px rgba(79, 70, 229, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.3)';
                        }}
                      >
                        📤 Enviar Solicitud
                      </button>
                      <button 
                        type='button' 
                        onClick={handleClearForm} 
                        style={{
                          padding:'12px 24px',
                          background:'#64748b',
                          color:'white',
                          border:'none',
                          borderRadius:10,
                          cursor:'pointer',
                          fontWeight:600,
                          fontSize:16,
                          boxShadow:'0 4px 12px rgba(100, 116, 139, 0.3)',
                          transition:'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = '#475569';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = '#64748b';
                        }}
                      >
                        🗑️ Limpiar
                      </button>
                    </div>
                  </form>
                </div>
              </div>
              )}
          </div>
            
        )}
        {view==='tickets' && (
          <div>
            <h2 style={{marginBottom:24,fontSize:28,fontWeight:700,color:'#1e293b'}}>
              🎫 Mis Tickets de Soporte
            </h2>
            
            {/* Crear nuevo ticket */}
            <div style={{background:'white',borderRadius:12,padding:24,boxShadow:'0 1px 3px rgba(0,0,0,0.1)',marginBottom:24,border:'1px solid #e2e8f0'}}>
              <h3 style={{fontSize:20,fontWeight:600,color:'#1e293b',marginBottom:20}}>
                📝 Crear Nuevo Ticket
              </h3>
              
              {!categoriaSeleccionada ? (
                <>
                  <p style={{fontSize:14,color:'#64748b',marginBottom:16}}>
                    Selecciona el tipo de problema que estás experimentando:
                  </p>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))',gap:16}}>
                    {Object.entries(categoriasTickets).map(([categoria, info]) => (
                      <div
                        key={categoria}
                        onClick={() => setCategoriaSeleccionada(categoria)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-4px)'
                          e.currentTarget.style.borderColor = info.color
                          e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.borderColor = '#e2e8f0'
                          e.currentTarget.style.boxShadow = 'none'
                        }}
                        style={{
                          background:'white',
                          border:'2px solid #e2e8f0',
                          borderRadius:12,
                          padding:20,
                          textAlign:'center',
                          cursor:'pointer',
                          transition:'all 0.3s'
                        }}
                      >
                        <div style={{fontSize:48,marginBottom:12}}>{info.emoji}</div>
                        <div style={{fontSize:15,fontWeight:600,color:'#1e293b',lineHeight:1.3}}>
                          {categoria}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : !subcategoriaSeleccionada ? (
                <>
                  <div style={{background:'#dbeafe',border:'2px solid #3b82f6',borderRadius:8,padding:16,marginBottom:20}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <div style={{display:'flex',alignItems:'center',gap:12}}>
                        <div style={{fontSize:32}}>{categoriasTickets[categoriaSeleccionada].emoji}</div>
                        <div>
                          <div style={{fontSize:13,color:'#1e40af',marginBottom:4}}>Categoría seleccionada:</div>
                          <div style={{fontSize:18,fontWeight:600,color:'#1e293b'}}>{categoriaSeleccionada}</div>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setCategoriaSeleccionada('')}
                        style={{padding:'8px 16px',background:'#64748b',color:'white',border:'none',borderRadius:6,cursor:'pointer',fontSize:13,fontWeight:600}}
                      >
                        ← Cambiar
                      </button>
                    </div>
                  </div>
                  
                  <p style={{fontSize:14,color:'#64748b',marginBottom:16}}>
                    Ahora selecciona el problema específico:
                  </p>
                  
                  <div style={{display:'flex',flexDirection:'column',gap:12}}>
                    {categoriasTickets[categoriaSeleccionada].subcategorias.map((subcat) => (
                      <div
                        key={subcat}
                        onClick={() => setSubcategoriaSeleccionada(subcat)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f8fafc'
                          e.currentTarget.style.borderColor = categoriasTickets[categoriaSeleccionada].color
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'white'
                          e.currentTarget.style.borderColor = '#e2e8f0'
                        }}
                        style={{
                          background:'white',
                          border:'2px solid #e2e8f0',
                          borderRadius:8,
                          padding:16,
                          cursor:'pointer',
                          transition:'all 0.2s',
                          display:'flex',
                          alignItems:'center',
                          gap:12
                        }}
                      >
                        <div style={{
                          width:12,
                          height:12,
                          borderRadius:'50%',
                          background:categoriasTickets[categoriaSeleccionada].color
                        }}></div>
                        <div style={{fontSize:15,fontWeight:500,color:'#1e293b'}}>{subcat}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <form onSubmit={handleTicketSubmit}>
                  <div style={{background:'#dbeafe',border:'2px solid #3b82f6',borderRadius:8,padding:16,marginBottom:20}}>
                    <div style={{display:'flex',alignItems:'start',justifyContent:'space-between'}}>
                      <div>
                        <div style={{fontSize:13,color:'#1e40af',marginBottom:8}}>Problema seleccionado:</div>
                        <div style={{fontSize:16,fontWeight:600,color:'#1e293b',marginBottom:4}}>
                          {categoriasTickets[categoriaSeleccionada].emoji} {categoriaSeleccionada}
                        </div>
                        <div style={{fontSize:14,color:'#475569'}}>
                          → {subcategoriaSeleccionada}
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => {
                          setCategoriaSeleccionada('')
                          setSubcategoriaSeleccionada('')
                        }}
                        style={{padding:'8px 16px',background:'#64748b',color:'white',border:'none',borderRadius:6,cursor:'pointer',fontSize:13,fontWeight:600}}
                      >
                        ← Cambiar
                      </button>
                    </div>
                  </div>
                  
                  <label style={{display:'block',marginBottom:20}}>
                    <div style={{fontSize:14,fontWeight:600,color:'#1e293b',marginBottom:8}}>
                      Descripción Detallada del Problema *
                    </div>
                    <textarea 
                      required 
                      value={descripcionTicket} 
                      onChange={(e) => setDescripcionTicket(e.target.value)} 
                      style={{
                        width:'100%',
                        padding:12,
                        border:'2px solid #e2e8f0',
                        borderRadius:8,
                        minHeight:120,
                        fontFamily:'inherit',
                        fontSize:14,
                        resize:'vertical'
                      }}
                      placeholder="Describe con el mayor detalle posible el problema que estás experimentando. Incluye pasos para reproducirlo, mensajes de error, etc."
                    />
                  </label>
                  
                  <div style={{marginBottom:20}}>
                    <div style={{fontSize:14,fontWeight:600,color:'#1e293b',marginBottom:8}}>
                      Archivos Adjuntos (Opcional)
                    </div>
                    <div style={{
                      border:'2px dashed #cbd5e1',
                      borderRadius:8,
                      padding:20,
                      background:'#f8fafc',
                      textAlign:'center'
                    }}>
                      <input 
                        type="file" 
                        multiple
                        onChange={(e) => setArchivosTicket(Array.from(e.target.files))}
                        style={{display:'none'}}
                        id="archivo-ticket-input"
                        accept="image/*,.el,.err,.log,.txt"
                      />
                      <label htmlFor="archivo-ticket-input" style={{cursor:'pointer'}}>
                        <div style={{fontSize:32,marginBottom:8}}>📎</div>
                        <div style={{fontSize:14,color:'#475569',marginBottom:4}}>
                          Haz clic para seleccionar archivos
                        </div>
                        <div style={{fontSize:12,color:'#64748b',fontStyle:'italic',lineHeight:1.5}}>
                          Puede apoyarnos subiendo imágenes del problema, también con el archivo .el y .err que se genera dentro de la carpeta SEER Tráfico
                        </div>
                      </label>
                      {archivosTicket.length > 0 && (
                        <div style={{marginTop:16,textAlign:'left'}}>
                          <div style={{fontSize:13,fontWeight:600,color:'#1e293b',marginBottom:8}}>
                            Archivos seleccionados:
                          </div>
                          {archivosTicket.map((archivo, idx) => (
                            <div key={idx} style={{
                              fontSize:12,
                              color:'#475569',
                              padding:'4px 8px',
                              background:'white',
                              borderRadius:4,
                              marginBottom:4,
                              display:'flex',
                              alignItems:'center',
                              gap:8
                            }}>
                              <span>📄</span>
                              <span>{archivo.name}</span>
                              <span style={{color:'#94a3b8'}}>({(archivo.size / 1024).toFixed(1)} KB)</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {error && <div style={{padding:12,background:'#fee2e2',color:'#991b1b',borderRadius:8,marginBottom:16}}>{error}</div>}
                  {success && <div style={{padding:12,background:'#d1fae5',color:'#065f46',borderRadius:8,marginBottom:16}}>{success}</div>}
                  
                  <div style={{display:'flex',gap:12}}>
                    <button
                      type="button"
                      onClick={() => {
                        setCategoriaSeleccionada('')
                        setSubcategoriaSeleccionada('')
                        setDescripcionTicket('')
                        setArchivosTicket([])
                      }}
                      style={{
                        flex:1,
                        padding:14,
                        background:'#f1f5f9',
                        color:'#475569',
                        border:'none',
                        borderRadius:8,
                        fontSize:15,
                        fontWeight:600,
                        cursor:'pointer'
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      style={{
                        flex:2,
                        padding:14,
                        background:'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        color:'white',
                        border:'none',
                        borderRadius:8,
                        fontSize:15,
                        fontWeight:600,
                        cursor:'pointer',
                        boxShadow:'0 4px 12px rgba(59, 130, 246, 0.3)'
                      }}
                    >
                      📤 Crear Ticket
                    </button>
                  </div>
                </form>
              )}
            </div>
            
            {/* Lista de tickets */}
            <div style={{background:'white',borderRadius:12,padding:24,boxShadow:'0 1px 3px rgba(0,0,0,0.1)',border:'1px solid #e2e8f0'}}>
              <h3 style={{fontSize:18,fontWeight:600,color:'#1e293b',marginBottom:16}}>
                📋 Mis Tickets
              </h3>
              
              {tickets.length === 0 ? (
                <div style={{padding:40,textAlign:'center',background:'#f8fafc',borderRadius:8,border:'1px solid #e2e8f0'}}>
                  <div style={{fontSize:48,marginBottom:16}}>🎫</div>
                  <p style={{
                    fontSize:16,
                    fontWeight:600,
                    color:'#1e293b',
                    margin:'0 0 8px 0'
                  }}>
                    No tienes tickets creados aún
                  </p>
                  <p style={{
                    fontSize:14,
                    color:'#64748b',
                    margin:0
                  }}>
                    Crea un ticket para reportar cualquier problema técnico
                  </p>
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  {tickets.map(ticket=>(
                    <div key={ticket.id} style={{
                      background:'white',
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
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',marginBottom:12}}>
                        <div style={{flex:1}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
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
                          </div>
                          <p style={{margin:'8px 0',color:'#475569',fontSize:14}}>{ticket.descripcion}</p>
                          <div style={{display:'flex',gap:16,fontSize:12,color:'#94a3b8',marginTop:12}}>
                            <span>📅 {new Date(ticket.created_at).toLocaleDateString('es-MX')}</span>
                          </div>
                          
                          {/* Mostrar archivos adjuntos */}
                          {archivosTicketsPorId[ticket.id] && archivosTicketsPorId[ticket.id].length > 0 && (
                            <div style={{
                              marginTop:12,
                              padding:12,
                              background:'#f8fafc',
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
                                      background:'white',
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
                                      e.currentTarget.style.background = 'white'
                                      e.currentTarget.style.borderColor = '#cbd5e1'
                                    }}
                                  >
                                    <span>📄</span>
                                    <span style={{flex:1,textAlign:'left',color:'#475569'}}>
                                      {archivo.nombre_original}
                                    </span>
                                    <span style={{color:'#94a3b8',fontSize:11}}>
                                      {archivo.tamano_archivo ? `${(archivo.tamano_archivo / 1024).toFixed(1)} KB` : ''}
                                    </span>
                                    <span>⬇️</span>
                                  </button>
                                ))}
                              </div>
                            </div>
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
          
          {/* Step 0: Selección de Tipo de Instalación */}
          {instalacionStep === 0 && (
            <div style={{maxWidth:800,margin:'0 auto'}}>
              <h3 style={{marginBottom:16,textAlign:'center',color:'#1e293b'}}>
                ¿Cómo deseas instalar SEER Tráfico?
              </h3>
              <p style={{marginBottom:32,textAlign:'center',color:'#64748b'}}>
                Selecciona la opción que mejor se adapte a tus necesidades
              </p>
              
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
                {/* Opción: Instalación Propia */}
                <div 
                  onClick={()=>{setTipoInstalacion('propia'); setInstalacionStep(1);}}
                  style={{
                    border:'2px solid #e2e8f0',
                    borderRadius:12,
                    padding:24,
                    cursor:'pointer',
                    transition:'all 0.2s',
                    background:'white',
                    boxShadow:'0 1px 3px rgba(0,0,0,0.1)'
                  }}
                  onMouseEnter={(e)=>{
                    e.currentTarget.style.borderColor='#3b82f6';
                    e.currentTarget.style.boxShadow='0 4px 12px rgba(59,130,246,0.2)';
                  }}
                  onMouseLeave={(e)=>{
                    e.currentTarget.style.borderColor='#e2e8f0';
                    e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,0.1)';
                  }}
                >
                  <div style={{fontSize:48,textAlign:'center',marginBottom:16}}>💻</div>
                  <h4 style={{fontSize:20,fontWeight:700,marginBottom:12,textAlign:'center',color:'#1e293b'}}>
                    Instalación por mi cuenta
                  </h4>
                  <p style={{fontSize:14,color:'#64748b',marginBottom:16,lineHeight:1.6}}>
                    Descarga los archivos de instalación y realiza la configuración por tu cuenta. 
                    Incluye guía de instalación completa.
                  </p>
                  <div style={{background:'#f1f5f9',padding:12,borderRadius:8,marginBottom:12}}>
                    <div style={{fontSize:12,color:'#64748b',marginBottom:4}}>Precio</div>
                    <div style={{fontSize:24,fontWeight:700,color:'#3b82f6'}}>
                      ${preciosServicios.instalacion_propia?.precio || 500} MXN
                    </div>
                  </div>
                  <ul style={{fontSize:13,color:'#64748b',paddingLeft:20,marginBottom:0}}>
                    <li>Archivos de instalación</li>
                    <li>Guía paso a paso</li>
                    <li>Soporte por correo</li>
                  </ul>
                </div>

                {/* Opción: Instalación con Asesor */}
                <div 
                  onClick={()=>{setTipoInstalacion('asesor'); setInstalacionStep(1);}}
                  style={{
                    border:'2px solid #e2e8f0',
                    borderRadius:12,
                    padding:24,
                    cursor:'pointer',
                    transition:'all 0.2s',
                    background:'white',
                    boxShadow:'0 1px 3px rgba(0,0,0,0.1)'
                  }}
                  onMouseEnter={(e)=>{
                    e.currentTarget.style.borderColor='#10b981';
                    e.currentTarget.style.boxShadow='0 4px 12px rgba(16,185,129,0.2)';
                  }}
                  onMouseLeave={(e)=>{
                    e.currentTarget.style.borderColor='#e2e8f0';
                    e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,0.1)';
                  }}
                >
                  <div style={{fontSize:48,textAlign:'center',marginBottom:16}}>👨‍💼</div>
                  <h4 style={{fontSize:20,fontWeight:700,marginBottom:12,textAlign:'center',color:'#1e293b'}}>
                    Instalación con Asesor
                  </h4>
                  <p style={{fontSize:14,color:'#64748b',marginBottom:16,lineHeight:1.6}}>
                    Un asesor técnico se encarga de todo el proceso: instalación, configuración y 
                    soporte personalizado.
                  </p>
                  <div style={{background:'#f1f5f9',padding:12,borderRadius:8,marginBottom:12}}>
                    <div style={{fontSize:12,color:'#64748b',marginBottom:4}}>Precio</div>
                    <div style={{fontSize:24,fontWeight:700,color:'#10b981'}}>
                      ${preciosServicios.instalacion_asesor?.precio || 2500} MXN
                    </div>
                  </div>
                  <ul style={{fontSize:13,color:'#64748b',paddingLeft:20,marginBottom:0}}>
                    <li>Instalación completa</li>
                    <li>Configuración personalizada</li>
                    <li>Soporte técnico inicial</li>
                    <li>Programación flexible</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Pasos siguientes (solo si se seleccionó un tipo) */}
          {instalacionStep > 0 && (
            <>
              {/* Indicador de Pasos */}
              <div style={{display:'flex',justifyContent:'center',marginBottom:32,gap:16}}>
                {tipoInstalacion === 'asesor' ? (
                  // 3 pasos para instalación con asesor
                  [
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
                    </div>
                  ))
                ) : (
                  // 1 paso para instalación propia (solo pago)
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{
                      width:40,
                      height:40,
                      borderRadius:'50%',
                      background:'#3b82f6',
                      color:'white',
                      display:'flex',
                      alignItems:'center',
                      justifyContent:'center',
                      fontWeight:700,
                      fontSize:16
                    }}>
                      1
                    </div>
                    <span style={{fontSize:14,fontWeight:600,color:'#1e293b'}}>
                      Pago y Descarga
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
          
          {/* Step 1: Pago y Descarga (para instalación propia) */}
          {instalacionStep === 1 && tipoInstalacion === 'propia' && (
            <div style={{maxWidth:700,margin:'0 auto'}}>
              {!pagoInstalacionPropiaExitoso ? (
                // Mostrar formulario de pago
                <div style={{background:'white',borderRadius:12,padding:24,boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}}>
                  <h3 style={{fontSize:20,fontWeight:600,color:'#1e293b',marginBottom:20,textAlign:'center'}}>
                    Pago del Servicio de Instalación Propia
                  </h3>
                  
                  <div style={{background:'#f8fafc',padding:20,borderRadius:8,marginBottom:24}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                      <span style={{fontSize:16,color:'#64748b'}}>Servicio de Instalación Propia</span>
                      <span style={{fontSize:24,fontWeight:700,color:'#3b82f6'}}>
                        ${preciosServicios.instalacion_propia?.precio || 500} MXN
                      </span>
                    </div>
                    <div style={{fontSize:14,color:'#64748b',marginTop:12}}>
                      {preciosServicios.instalacion_propia?.descripcion || 'Incluye archivos de instalación, guía completa paso a paso, y soporte por correo electrónico.'}
                    </div>
                  </div>

                  {stripePromise ? (
                    <Elements stripe={stripePromise}>
                      <ServicioPaymentForm
                        monto={preciosServicios.instalacion_propia?.precio || 500}
                        datosEquipo={null}
                        onSuccess={()=>{
                          setPagoInstalacionPropiaExitoso(true)
                          setSuccess('✓ Pago realizado exitosamente. Se ha enviado una notificación a clientes@caast.net')
                        }}
                        onError={(msg)=>setError(msg)}
                      />
                    </Elements>
                  ) : (
                    <div style={{padding:20,textAlign:'center',color:'#64748b'}}>
                      Cargando sistema de pagos...
                    </div>
                  )}

                  <div style={{textAlign:'center',marginTop:16}}>
                    <button 
                      onClick={()=>{setInstalacionStep(0); setTipoInstalacion(''); setPagoInstalacionPropiaExitoso(false);}}
                      style={{
                        padding:'12px 24px',
                        background:'transparent',
                        border:'2px solid #e2e8f0',
                        borderRadius:8,
                        cursor:'pointer',
                        fontSize:14,
                        color:'#64748b',
                        fontWeight:600
                      }}
                    >
                      ← Volver
                    </button>
                  </div>
                </div>
              ) : (
                // Mostrar pantalla de descarga después del pago exitoso
                <div style={{background:'white',borderRadius:12,padding:32,boxShadow:'0 1px 3px rgba(0,0,0,0.1)',textAlign:'center'}}>
                  <div style={{fontSize:64,marginBottom:16}}>✅</div>
                  <h3 style={{fontSize:24,fontWeight:700,color:'#10b981',marginBottom:12}}>
                    ¡Pago exitoso!
                  </h3>
                  <p style={{fontSize:16,color:'#64748b',marginBottom:24}}>
                    Descarga los archivos de instalación y sigue la guía paso a paso
                  </p>

                  {/* Mensaje de notificación por correo */}
                  <div style={{background:'#dbeafe',border:'2px solid #3b82f6',padding:16,borderRadius:8,marginBottom:24,textAlign:'left'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                      <span style={{fontSize:20}}>📧</span>
                      <div style={{fontSize:14,fontWeight:600,color:'#1e40af'}}>
                        Notificación enviada
                      </div>
                    </div>
                    <div style={{fontSize:14,color:'#1e40af',lineHeight:1.5}}>
                      Se ha enviado una notificación sobre tu compra a <strong>clientes@caast.net</strong>. 
                      Nuestro equipo será notificado de tu adquisición del instalador.
                    </div>
                  </div>

                  <div style={{display:'grid',gap:16,marginBottom:24}}>
                    {/* Botón Instalador */}
                    <div style={{background:'#f8fafc',padding:20,borderRadius:8,textAlign:'left',border:'2px solid #e2e8f0'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:16,fontWeight:600,color:'#1e293b',marginBottom:4}}>
                            📦 Instalador SEER Tráfico
                          </div>
                          <div style={{fontSize:14,color:'#64748b'}}>
                            Archivo de instalación (simulación)
                          </div>
                        </div>
                        <button 
                          onClick={()=>{
                            window.open('/api/descargas/instalador-seer-trafico.txt', '_blank')
                          }}
                          style={{
                            padding:'10px 20px',
                            background:'#3b82f6',
                            color:'white',
                            border:'none',
                            borderRadius:8,
                            cursor:'pointer',
                            fontWeight:600,
                            fontSize:14
                          }}
                        >
                          Descargar
                        </button>
                      </div>
                    </div>

                    {/* Botón Guía */}
                    <div style={{background:'#f8fafc',padding:20,borderRadius:8,textAlign:'left',border:'2px solid #e2e8f0'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:16,fontWeight:600,color:'#1e293b',marginBottom:4}}>
                            📄 Guía de Instalación
                          </div>
                          <div style={{fontSize:14,color:'#64748b'}}>
                            Manual completo con instrucciones (simulación)
                          </div>
                        </div>
                        <button 
                          onClick={()=>{
                            window.open('/api/descargas/guia-instalacion.txt', '_blank')
                          }}
                          style={{
                            padding:'10px 20px',
                            background:'#3b82f6',
                            color:'white',
                            border:'none',
                            borderRadius:8,
                            cursor:'pointer',
                            fontWeight:600,
                            fontSize:14
                          }}
                        >
                          Descargar
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{background:'#eff6ff',padding:16,borderRadius:8,marginBottom:24,textAlign:'left'}}>
                    <div style={{fontSize:14,fontWeight:600,color:'#1e40af',marginBottom:8}}>
                      💡 ¿Necesitas ayuda?
                    </div>
                    <div style={{fontSize:14,color:'#1e40af'}}>
                      Si tienes problemas con la instalación, escríbenos a <strong>soporte@seertrafico.com</strong>
                    </div>
                  </div>

                  <button 
                    onClick={()=>{
                      setInstalacionStep(0);
                      setTipoInstalacion('');
                      setPagoInstalacionPropiaExitoso(false);
                      setView('equipos');
                    }}
                    style={{
                      width:'100%',
                      padding:16,
                      background:'#10b981',
                      color:'white',
                      border:'none',
                      borderRadius:8,
                      cursor:'pointer',
                      fontSize:16,
                      fontWeight:600
                    }}
                  >
                    Finalizar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Configuración (solo para asesor) */}
          {instalacionStep === 1 && tipoInstalacion === 'asesor' && (
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

              <div style={{display:'flex',gap:12,marginTop:8}}>
                <button
                  onClick={()=>{
                    setInstalacionStep(0);
                    setTipoInstalacion('');
                    setInstalacionConfig({tipoEquipo:'',numBasesDatos:'',nombresBD:[]});
                  }}
                  style={{
                    padding:'12px 24px',
                    background:'transparent',
                    border:'2px solid #e2e8f0',
                    borderRadius:8,
                    cursor:'pointer',
                    fontSize:14,
                    color:'#64748b',
                    fontWeight:600
                  }}
                >
                  ← Volver
                </button>
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
                    flex:1,
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
            </div>
          )}

          {/* Paso 2: Censo del Equipo (solo para asesor) */}
          {instalacionStep===2 && tipoInstalacion === 'asesor' && (
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
                {/* Solo mostrar código de registro si NO es instalación con asesor */}
                {tipoInstalacion !== 'asesor' && (
                  <label>
                    <div style={{fontSize:14,fontWeight:600,color:'#475569',marginBottom:8}}>Código de Registro *</div>
                    <input
                      type="text"
                      value={instalacionForm.codigo_registro}
                      onChange={(e)=>setInstalacionForm({...instalacionForm,codigo_registro:e.target.value})}
                      style={{width:'100%',padding:12,border:'2px solid #e2e8f0',borderRadius:8,fontSize:16}}
                    />
                  </label>
                )}
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
                    // Validar campos requeridos (código de registro solo si NO es con asesor)
                    const camposRequeridos = !instalacionForm.marca || !instalacionForm.modelo || 
                      !instalacionForm.no_serie || !instalacionForm.memoria_ram || !instalacionForm.disco_duro ||
                      !instalacionForm.sistema_operativo || !instalacionForm.procesador || !instalacionForm.empleado_id;
                    
                    const codigoRequerido = tipoInstalacion !== 'asesor' && !instalacionForm.codigo_registro;
                    
                    if(camposRequeridos || codigoRequerido){
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

          {/* Paso 3: Pago (solo para asesor) */}
          {instalacionStep===3 && tipoInstalacion === 'asesor' && (
            <div style={{background:'white',borderRadius:12,padding:24,boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}}>
              <h3 style={{fontSize:20,fontWeight:600,color:'#1e293b',marginBottom:20}}>
                Pago del Servicio de Instalación
              </h3>

              <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:8,padding:20,marginBottom:24}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                  <span style={{fontSize:16,color:'#64748b'}}>Servicio de Instalación</span>
                  <span style={{fontSize:24,fontWeight:700,color:'#1e293b'}}>
                    ${preciosServicios.instalacion_asesor?.precio || 2500} MXN
                  </span>
                </div>
                <div style={{fontSize:14,color:'#64748b',lineHeight:1.6,marginBottom:12}}>
                  {preciosServicios.instalacion_asesor?.descripcion || `Incluye instalación, configuración de ${instalacionConfig.numBasesDatos} base(s) de datos y soporte técnico inicial.`}
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
                    monto={preciosServicios.instalacion_asesor?.precio || 2500}
                    datosEquipo={{
                      marca: instalacionForm.marca,
                      modelo: instalacionForm.modelo,
                      numero_serie: instalacionForm.no_serie,
                      // No incluir código de registro si es instalación con asesor
                      ...(tipoInstalacion !== 'asesor' && { codigo_registro: instalacionForm.codigo_registro }),
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
                      setMostrarNotificacionInstalacion(true)
                      setTimeout(() => setMostrarNotificacionInstalacion(false), 4000)
                      
                      // Resetear formularios
                      setInstalacionStep(1)
                      setInstalacionConfig({tipoEquipo:'',numBasesDatos:'',nombresBD:[]})
                      setInstalacionForm({marca:'',modelo:'',no_serie:'',codigo_registro:'',memoria_ram:'',
                        disco_duro:'',serie_disco_duro:'',sistema_operativo:'',procesador:'',
                        nombre_usuario_equipo:'',tipo_equipo:'',nombre_equipo:'',empleado_id:''})
                      
                      // Cambiar a la vista de equipos y refrescar la lista
                      setView('equipos')
                      await fetchEquipos()
                    }}
                    onError={(err)=>{
                      setError(err.message || 'Error al procesar el pago')
                    }}
                  />
                </Elements>
              )}

              <div style={{display:'flex',gap:12,marginTop:16}}>
                <button
                  onClick={()=>{
                    setInstalacionStep(0);
                    setTipoInstalacion('');
                    setInstalacionConfig({tipoEquipo:'',numBasesDatos:'',nombresBD:[]});
                    setInstalacionForm({marca:'',modelo:'',no_serie:'',codigo_registro:'',memoria_ram:'',
                      disco_duro:'',serie_disco_duro:'',sistema_operativo:'',procesador:'',
                      nombre_usuario_equipo:'',tipo_equipo:'',nombre_equipo:'',empleado_id:''});
                  }}
                  style={{
                    padding:'12px 24px',
                    background:'transparent',
                    border:'2px solid #e2e8f0',
                    borderRadius:8,
                    cursor:'pointer',
                    fontSize:14,
                    color:'#64748b',
                    fontWeight:600
                  }}
                >
                  ← Volver al Inicio
                </button>
                <button
                  onClick={()=>setInstalacionStep(2)}
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
              </div>
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
    </div>
  )
}
