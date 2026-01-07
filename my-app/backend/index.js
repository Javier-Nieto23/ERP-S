require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, pool } = require('./db');
const multer = require('multer');
const fs = require('fs');
const { PLANES } = require('./payment-config');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// IMPORTANTE: El webhook de Stripe debe estar ANTES de express.json()
// porque necesita el body raw
app.use(cors());

// Webhook de Stripe (debe ir antes de express.json())
app.post('/pagos/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Manejar el evento de pago completado
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { empresa_id, usuario_id, plan, dias } = session.metadata;

    const planSeleccionado = PLANES[plan];

    try {
      // Calcular fecha de expiración
      const ahora = new Date();
      const fecha_expiracion = new Date(ahora);
      fecha_expiracion.setDate(fecha_expiracion.getDate() + parseInt(dias));

      // Registrar pago en tabla pagos
      await query(
        `INSERT INTO pagos 
         (empresa_id_pago, usuario_id, monto, moneda, metodo_pago, referencia_pago, estado_pago, dias_agregados, fecha_pago, fecha_expiracion, datos_pago) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          parseInt(empresa_id),
          parseInt(usuario_id),
          planSeleccionado.precio,
          'MXN',
          'stripe',
          session.payment_intent,
          'completado',
          parseInt(dias),
          ahora,
          fecha_expiracion,
          JSON.stringify({ plan: plan, nombre_plan: planSeleccionado.nombre, session_id: session.id })
        ]
      );

      console.log('✅ Pago procesado exitosamente para empresa:', empresa_id);

    } catch (err) {
      console.error('Error procesando pago webhook:', err);
    }
  }

  res.status(200).json({ received: true });
});

// Ahora sí, aplicar express.json() para las demás rutas
app.use(express.json());

// Configurar multer para guardar archivos de responsiva
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads', 'responsivas');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'responsiva-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

function verifyToken(req, res, next) {
  const auth = req.headers['authorization'] || '';
  console.log('[verifyToken] Authorization header:', auth ? 'presente' : 'ausente');
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    console.log('[verifyToken] Error: formato de token inválido');
    return res.status(401).json({ error: 'missing token' });
  }
  const token = parts[1];
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      console.log('[verifyToken] Error al verificar token:', err.message);
      return res.status(401).json({ error: 'invalid token' });
    }
    console.log('[verifyToken] Token válido para usuario:', payload.email);
    req.user = payload;
    next();
  });
}

// Middleware para verificar membresía activa
async function verificarMembresia(req, res, next) {
  try {
    const empresa_id = req.user.empresa_id;
    
    // Si no es cliente, permitir acceso (admins, RH, etc)
    if (req.user.rol !== 'cliente') {
      return next();
    }
    
    if (!empresa_id) {
      return res.status(400).json({ 
        error: 'No se encontró empresa asociada',
        membresia_requerida: true 
      });
    }

    // Verificar si tiene membresía activa
    // Solo considera válidos los pagos con estado_pago = 'completado'
    // Si estado_pago es NULL o cualquier otro valor, se considera inactivo
    const result = await query(
      `SELECT fecha_expiracion 
       FROM pagos 
       WHERE empresa_id_pago = $1 
         AND estado_pago = 'completado' 
         AND estado_pago IS NOT NULL
       ORDER BY fecha_expiracion DESC 
       LIMIT 1`,
      [empresa_id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ 
        error: 'No tienes una membresía activa. Por favor, realiza un pago para acceder a este servicio.',
        membresia_activa: false,
        membresia_requerida: true 
      });
    }

    const pago = result.rows[0];
    const ahora = new Date();
    const fecha_expiracion = new Date(pago.fecha_expiracion);

    if (fecha_expiracion < ahora) {
      return res.status(403).json({ 
        error: 'Tu membresía ha expirado. Por favor, renueva tu suscripción para continuar.',
        membresia_activa: false,
        membresia_expirada: true,
        fecha_expiracion: pago.fecha_expiracion
      });
    }

    // Membresía activa, continuar
    console.log('[verificarMembresia] ✅ Membresía activa para empresa:', empresa_id);
    next();

  } catch (err) {
    console.error('[verificarMembresia] Error:', err);
    return res.status(500).json({ error: 'Error al verificar membresía' });
  }
}

app.post('/webhook/frontend', (req, res) => {
  console.log('[webhook/frontend] received:', JSON.stringify(req.body));
  res.json({status: 'ok', path: '/webhook/frontend', received: req.body});
});

app.post('/webhook/backend', (req, res) => {
  console.log('[webhook/backend] received:', JSON.stringify(req.body));
  res.json({status: 'ok', path: '/webhook/backend', received: req.body});
});

app.get('/health', (req, res) => res.send('ok'));

app.post('/auth/login', (req, res) => {
  (async () => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: 'email and password required' });

      const result = await query('SELECT * FROM usuarios_internos WHERE email = $1', [email]);
      const user = result.rows[0];
      if (!user) return res.status(401).json({ error: 'invalid credentials' });

      const match = bcrypt.compareSync(password, user.password);
      if (!match) return res.status(401).json({ error: 'invalid credentials' });

      const token = jwt.sign({ id: user.id, email: user.email, rol: user.rol }, JWT_SECRET, { expiresIn: '8h' });
      return res.json({ token, user: { id: user.id, email: user.email, rol: user.rol, nombre_usuario: user.nombre_usuario } });
    } catch (err) {
      console.error('auth error', err);
      return res.status(500).json({ error: 'server error' });
    }
  })();
});

// List users (only RH role)
app.get('/users', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'rh') return res.status(403).json({ error: 'forbidden' });
    const result = await query('SELECT id, nombre_usuario, apellido_usuario, email, rol, activo, created_at FROM usuarios_internos ORDER BY id DESC');
    return res.json({ users: result.rows });
  } catch (err) {
    console.error('list users error', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Create user (only RH role)
app.post('/users', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'rh') return res.status(403).json({ error: 'forbidden' });
    const { nombre_usuario, apellido_usuario, email, password, rol } = req.body || {};
    if (!email || !password || !nombre_usuario) return res.status(400).json({ error: 'missing fields' });
    // password rules: max 8, min 4, 1 lowercase, 1 uppercase, 1 digit
    const pwRegex = /^(?=.{4,8}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/;
    if (!pwRegex.test(password)) return res.status(400).json({ error: 'password rules not met' });

    const hashed = bcrypt.hashSync(password, 10);
    const insert = await query('INSERT INTO usuarios_internos (nombre_usuario, apellido_usuario, email, password, rol, activo) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, nombre_usuario, apellido_usuario, email, rol, activo, created_at',
      [nombre_usuario, apellido_usuario, email, hashed, rol || 'user', true]);
    return res.status(201).json({ user: insert.rows[0] });
  } catch (err) {
    console.error('create user error', err);
    if (err.code === '23505') return res.status(409).json({ error: 'email exists' });
    return res.status(500).json({ error: 'server error' });
  }
});

// Client login: authenticate against usuarios_empresas
app.post('/auth/login-client', (req, res) => {
  (async () => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: 'email and password required' });

      const result = await query('SELECT * FROM usuarios_empresas WHERE email = $1', [email]);
      const user = result.rows[0];
      if (!user) return res.status(401).json({ error: 'invalid credentials' });

      const match = bcrypt.compareSync(password, user.password);
      if (!match) return res.status(401).json({ error: 'invalid credentials' });

      const token = jwt.sign({ id: user.id, email: user.email, rol: 'cliente', empresa_id: user.empresa_id }, JWT_SECRET, { expiresIn: '8h' });
      return res.json({ token, user: { id: user.id, email: user.email, rol: 'cliente', nombre_usuario: user.nombre_usuario, empresa_id: user.empresa_id } });
    } catch (err) {
      console.error('client auth error', err);
      return res.status(500).json({ error: 'server error' });
    }
  })();
});

// Equipment census request (clients only) - con archivo de responsiva para laptops
app.post('/equipment-requests', verifyToken, verificarMembresia, upload.single('responsiva'), async (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'cliente') return res.status(403).json({ error: 'forbidden' });
    const { marca, modelo, no_serie, codigo_registro, memoria_ram, disco_duro, serie_disco_duro, sistema_operativo, procesador, nombre_usuario_equipo, tipo_equipo, nombre_equipo, empleado_id } = req.body || {};
    if (!marca || !modelo || !no_serie) return res.status(400).json({ error: 'missing required fields' });

    // Extraer empresa_id del token (está en req.user)
    const empresa_id = req.user.empresa_id;

    console.log('===== DEBUG INICIO =====');
    console.log('Tipo de equipo:', tipo_equipo);
    console.log('Archivo recibido:', req.file ? req.file.filename : 'NO HAY ARCHIVO');
    console.log('Empresa ID:', empresa_id);

    // Usar empresa_id como id_equipo para crear relación 1:N
    const id_equipo = empresa_id;
    console.log('ID Equipo asignado (empresa_id):', id_equipo);

    // Manejo del archivo de responsiva
    if (tipo_equipo && tipo_equipo.toLowerCase().includes('laptop')) {
      console.log('Es laptop, procesando responsiva...');
      
      if (!req.file) {
        console.log('ERROR: No se recibió archivo para laptop');
        return res.status(400).json({ error: 'Se requiere archivo de responsiva para laptops' });
      }
      
      // Guardar o actualizar el archivo de responsiva en la tabla documentos
      const archivo_responsiva = req.file.filename;
      console.log('Nombre de archivo a guardar:', archivo_responsiva);
      
      // Verificar si ya existe un documento para esta empresa
      const docExistente = await query('SELECT id FROM documentos WHERE empresa_id = $1', [empresa_id]);
      console.log('Documento existente:', docExistente.rows.length > 0 ? 'SÍ' : 'NO');
      
      if (docExistente.rows.length > 0) {
        // Actualizar el documento existente
        console.log('Actualizando documento existente...');
        const updateResult = await query(
          'UPDATE documentos SET archivo_responsiva = $1 WHERE empresa_id = $2 RETURNING *',
          [archivo_responsiva, empresa_id]
        );
        console.log('Documento actualizado:', updateResult.rows[0]);
      } else {
        // Crear nuevo documento
        console.log('Creando nuevo documento...');
        const insertResult = await query(
          'INSERT INTO documentos (empresa_id, archivo_responsiva) VALUES ($1, $2) RETURNING *',
          [empresa_id, archivo_responsiva]
        );
        console.log('Documento creado:', insertResult.rows[0]);
      }
      
      console.log('Archivo de responsiva guardado en documentos:', archivo_responsiva);
    } else {
      console.log('No es laptop, no se requiere responsiva');
    }

    // Guardar directamente en la tabla equipos (solo con empleado_id, sin empresa_id)
    // El status inicial será 'pendiente' cuando se realiza un censo
    const insert = await query(
      'INSERT INTO equipos (id_equipo, empleado_id, tipo_equipo, marca, modelo, numero_serie, sistema_operativo, procesador, ram, disco_duro, codigo_registro, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *',
      [id_equipo, empleado_id ? parseInt(empleado_id) : null, tipo_equipo || '', marca, modelo, no_serie, sistema_operativo || '', procesador || '', memoria_ram || '', disco_duro || '', codigo_registro || '', 'pendiente']
    );

    console.log('Equipo guardado en tabla equipos con status pendiente:', insert.rows[0]);

    // Actualizar empresas.id_equipo con el id de la empresa (relación 1:N)
    await query(
      'UPDATE empresas SET id_equipo = $1 WHERE id = $2',
      [empresa_id, empresa_id]
    );
    console.log('Empresa actualizada con id_equipo:', empresa_id);

    // También guardar en equipment_requests para historial
    await query(
      'INSERT INTO equipment_requests (cliente_id, empresa_id, marca, modelo, no_serie, codigo_registro, memoria_ram, disco_duro, serie_disco_duro, sistema_operativo, procesador, nombre_usuario_equipo, tipo_equipo, nombre_equipo, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)',
      [req.user.id, empresa_id, marca, modelo, no_serie, codigo_registro || '', memoria_ram || '', disco_duro || '', serie_disco_duro || '', sistema_operativo || '', procesador || '', nombre_usuario_equipo || '', tipo_equipo || '', nombre_equipo || '', 'pendiente']
    );

    console.log('===== DEBUG FIN =====');
    return res.status(201).json({ equipo: insert.rows[0], message: 'Equipo registrado exitosamente' });
  } catch (err) {
    console.error('equipment registration error', err);
    console.error('Error details:', err.message);
    return res.status(500).json({ error: 'server error', details: err.message });
  }
});

// List equipment census requests (admin only)
app.get('/equipment-requests', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'admin') return res.status(403).json({ error: 'forbidden' });
    const result = await query('SELECT er.*, ue.nombre_usuario as cliente_nombre, ue.email as cliente_email, e.nombre_empresa FROM equipment_requests er LEFT JOIN usuarios_empresas ue ON er.cliente_id = ue.id LEFT JOIN empresas e ON er.empresa_id = e.id ORDER BY er.created_at DESC');
    return res.json({ requests: result.rows });
  } catch (err) {
    console.error('list equipment requests error', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Descargar documento de responsiva de equipo (plantilla Word)
app.get('/download/responsiva-template', verifyToken, (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'cliente') return res.status(403).json({ error: 'forbidden' });
    
    const filePath = path.join(__dirname, 'plantillas', 'responsiva_laptop.docx');
    
    // Verificar si el archivo existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo de plantilla no encontrado. Por favor contacta al administrador.' });
    }
    
    // Enviar el archivo Word
    res.download(filePath, 'responsiva_laptop.docx', (err) => {
      if (err) {
        console.error('Error al descargar responsiva:', err);
        if (!res.headersSent) {
          return res.status(500).json({ error: 'Error al descargar el archivo' });
        }
      }
    });

  } catch (err) {
    console.error('Error al generar responsiva:', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// ==================== EMPLEADOS ====================

// Crear empleado (cliente)
app.post('/empleados', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'cliente') return res.status(403).json({ error: 'forbidden' });
    const { id_empleado, nombre_empleado } = req.body;
    
    console.log('===== CREAR EMPLEADO DEBUG =====');
    console.log('Usuario:', req.user);
    console.log('Empresa ID:', req.user.empresa_id);
    console.log('Body:', req.body);
    
    if (!id_empleado || !nombre_empleado) {
      return res.status(400).json({ error: 'Se requiere id_empleado y nombre_empleado' });
    }

    const empresa_id = req.user.empresa_id;

    if (!empresa_id) {
      console.log('ERROR: empresa_id no está definido en el token');
      return res.status(400).json({ error: 'No se encontró empresa_id en el token del usuario' });
    }

    console.log('Verificando si empleado existe...');
    // Verificar si el id_empleado ya existe en la empresa
    const existente = await query(
      'SELECT id FROM empleados WHERE id_empleado = $1 AND empresa_id = $2',
      [id_empleado, empresa_id]
    );

    console.log('Empleados existentes:', existente.rows.length);

    if (existente.rows.length > 0) {
      return res.status(400).json({ error: 'El ID de empleado ya existe en esta empresa' });
    }

    console.log('Insertando empleado...');
    const result = await query(
      'INSERT INTO empleados (id_empleado, nombre_empleado, empresa_id) VALUES ($1, $2, $3) RETURNING *',
      [id_empleado, nombre_empleado, empresa_id]
    );

    console.log('Empleado insertado:', result.rows[0]);
    console.log('===== FIN DEBUG =====');

    return res.status(201).json({ empleado: result.rows[0], message: 'Empleado registrado exitosamente' });
  } catch (err) {
    console.error('Error al crear empleado:', err);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    return res.status(500).json({ error: 'server error', details: err.message });
  }
});

// Listar empleados de la empresa del cliente
app.get('/empleados', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'cliente') return res.status(403).json({ error: 'forbidden' });
    const empresa_id = req.user.empresa_id;

    const result = await query(
      'SELECT * FROM empleados WHERE empresa_id = $1 ORDER BY nombre_empleado ASC',
      [empresa_id]
    );

    return res.json({ empleados: result.rows });
  } catch (err) {
    console.error('Error al obtener empleados:', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Actualizar empleado
app.put('/empleados/:id', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'cliente') return res.status(403).json({ error: 'forbidden' });
    const { id } = req.params;
    const { id_empleado, nombre_empleado } = req.body;
    const empresa_id = req.user.empresa_id;

    // Verificar que el empleado pertenece a la empresa del cliente
    const empleado = await query('SELECT id FROM empleados WHERE id = $1 AND empresa_id = $2', [id, empresa_id]);
    
    if (empleado.rows.length === 0) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }

    const result = await query(
      'UPDATE empleados SET id_empleado = $1, nombre_empleado = $2 WHERE id = $3 AND empresa_id = $4 RETURNING *',
      [id_empleado, nombre_empleado, id, empresa_id]
    );

    return res.json({ empleado: result.rows[0], message: 'Empleado actualizado exitosamente' });
  } catch (err) {
    console.error('Error al actualizar empleado:', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Eliminar empleado
app.delete('/empleados/:id', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'cliente') return res.status(403).json({ error: 'forbidden' });
    const { id } = req.params;
    const empresa_id = req.user.empresa_id;

    // Verificar que el empleado pertenece a la empresa del cliente
    const empleado = await query('SELECT id FROM empleados WHERE id = $1 AND empresa_id = $2', [id, empresa_id]);
    
    if (empleado.rows.length === 0) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }

    await query('DELETE FROM empleados WHERE id = $1 AND empresa_id = $2', [id, empresa_id]);

    return res.json({ message: 'Empleado eliminado exitosamente' });
  } catch (err) {
    console.error('Error al eliminar empleado:', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// ==================== PERFIL ====================

// Obtener perfil del cliente con datos de su empresa
app.get('/perfil', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'cliente') return res.status(403).json({ error: 'forbidden' });
    
    const usuario_id = req.user.id;
    
    // Obtener datos del usuario y su empresa
    const result = await query(`
      SELECT 
        ue.id, 
        ue.id_usuario, 
        ue.nombre_usuario, 
        ue.apellido_usuario, 
        ue.email, 
        ue.nombre_profile,
        ue.empresa_id,
        e.id_empresa,
        e.nombre_empresa,
        e.rfc
      FROM usuarios_empresas ue
      LEFT JOIN empresas e ON ue.empresa_id = e.id
      WHERE ue.id = $1
    `, [usuario_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const perfilData = result.rows[0];

    // Obtener conteo de equipos de la empresa (JOIN directo por id_equipo)
    let totalEquipos = 0;
    if (perfilData.empresa_id) {
      const equiposResult = await query(
        `SELECT COUNT(*) as total 
         FROM equipos eq 
         INNER JOIN empresas e ON eq.id_equipo = e.id_equipo 
         WHERE e.id = $1`,
        [perfilData.empresa_id]
      );
      totalEquipos = parseInt(equiposResult.rows[0].total) || 0;
    }

    perfilData.total_equipos = totalEquipos;

    return res.json({ perfil: perfilData });
  } catch (err) {
    console.error('Error al obtener perfil:', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Obtener todos los equipos de la empresa del cliente
app.get('/equipos', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'cliente') return res.status(403).json({ error: 'forbidden' });
    
    const empresa_id = req.user.empresa_id;
    
    const result = await query(`
      SELECT 
        eq.id,
        eq.id_equipo,
        eq.tipo_equipo,
        eq.marca,
        eq.modelo,
        eq.numero_serie,
        eq.sistema_operativo,
        eq.procesador,
        eq.ram,
        eq.disco_duro,
        eq.codigo_registro,
        eq.status,
        emp.id_empleado,
        emp.nombre_empleado,
        e.nombre_empresa
      FROM equipos eq
      INNER JOIN empresas e ON eq.id_equipo = e.id_equipo
      LEFT JOIN empleados emp ON eq.empleado_id = emp.id
      WHERE e.id = $1
      ORDER BY eq.id DESC
    `, [empresa_id]);

    console.log('📦 Equipos encontrados:', result.rows.length);
    if(result.rows.length > 0) {
      console.log('📦 Primer equipo status:', result.rows[0].status);
      console.log('📦 Primer equipo completo:', result.rows[0]);
    }

    return res.json({ equipos: result.rows });
  } catch (err) {
    console.error('Error al obtener equipos:', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Programar censo de equipo
app.post('/agenda/programar-censo', verifyToken, async (req, res) => {
  try {
    // Permitir tanto a clientes como a admins
    if (!req.user || (req.user.rol !== 'cliente' && req.user.rol !== 'admin')) {
      return res.status(403).json({ error: 'forbidden' });
    }
    
    const { equipo_id, dia_agendado } = req.body;
    
    if (!equipo_id || !dia_agendado) {
      return res.status(400).json({ error: 'equipo_id y dia_agendado son requeridos' });
    }
    
    // Si es cliente, verificar que el equipo pertenece a su empresa
    if (req.user.rol === 'cliente') {
      const empresa_id = req.user.empresa_id;
      const equipoResult = await query(
        `SELECT eq.id FROM equipos eq
         INNER JOIN empresas e ON eq.id_equipo = e.id_equipo
         WHERE eq.id = $1 AND e.id = $2`,
        [equipo_id, empresa_id]
      );
      
      if (equipoResult.rows.length === 0) {
        return res.status(404).json({ error: 'Equipo no encontrado' });
      }
    }
    // Si es admin, solo verificar que el equipo existe
    else if (req.user.rol === 'admin') {
      const equipoResult = await query('SELECT id FROM equipos WHERE id = $1', [equipo_id]);
      if (equipoResult.rows.length === 0) {
        return res.status(404).json({ error: 'Equipo no encontrado' });
      }
    }
    
    // Crear registro en agenda con el equipo_id
    const agendaResult = await query(
      `INSERT INTO agenda (dia_agendado, status, usuario_id, equipo_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [dia_agendado, 'programado', req.user.id, equipo_id]
    );
    
    const agenda_id = agendaResult.rows[0].id;
    
    // Actualizar el status del equipo de 'pendiente' a 'programado'
    await query(
      `UPDATE equipos SET status = 'programado' WHERE id = $1`,
      [equipo_id]
    );
    
    console.log('✅ Censo programado:', {
      agenda_id,
      equipo_id,
      dia_agendado,
      usuario: req.user.email,
      status_actualizado: 'programado'
    });
    
    return res.json({
      success: true,
      mensaje: 'Censo programado exitosamente',
      agenda: agendaResult.rows[0]
    });
    
  } catch (err) {
    console.error('Error al programar censo:', err);
    return res.status(500).json({ error: 'server error', details: err.message });
  }
});

// Verificar censo realizado
app.post('/agenda/verificar-censo', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden verificar censos' });
    }
    
    const { equipo_id, codigo, licencia } = req.body;
    
    console.log('📥 Datos recibidos para verificar censo:', { equipo_id, codigo, licencia });
    
    if (!equipo_id || !codigo || !licencia) {
      return res.status(400).json({ error: 'equipo_id, codigo y licencia son requeridos' });
    }
    
    // Actualizar status en tabla agenda
    await query(
      `UPDATE agenda SET status = 'registrado' WHERE equipo_id = $1 AND status = 'programado'`,
      [equipo_id]
    );
    
    // Actualizar status en tabla equipos
    await query(
      `UPDATE equipos SET status = 'registrado' WHERE id = $1`,
      [equipo_id]
    );
    
    // Insertar en tabla codigo_registro (nuevo registro por cada censo verificado)
    const insertResult = await query(
      `INSERT INTO codigo_registro (codigo, equipo_id, licencia) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [codigo, equipo_id, licencia]
    );
    
    console.log('✅ Censo verificado y registro insertado:', {
      registro_id: insertResult.rows[0].id,
      equipo_id,
      codigo,
      licencia,
      usuario: req.user.email,
      status_actualizado: 'registrado'
    });
    
    return res.json({
      success: true,
      mensaje: 'Censo verificado exitosamente'
    });
    
  } catch (err) {
    console.error('Error al verificar censo:', err);
    return res.status(500).json({ error: 'server error', details: err.message });
  }
});

// Obtener licencia de un equipo (admin only)
app.get('/equipos/:id/licencia', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden ver licencias' });
    }
    
    const { id } = req.params;
    
    const result = await query(
      `SELECT licencia FROM codigo_registro WHERE equipo_id = $1 LIMIT 1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.json({ licencia: 'No registrada' });
    }
    
    return res.json({ licencia: result.rows[0].licencia });
    
  } catch (err) {
    console.error('Error al obtener licencia:', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Obtener censos programados (admin only)
app.get('/admin/censos-programados', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }
    
    const result = await query(`
      SELECT 
        ag.id,
        ag.dia_agendado,
        ag.status,
        eq.id as equipo_id,
        eq.marca,
        eq.modelo,
        eq.numero_serie,
        e.nombre_empresa
      FROM agenda ag
      INNER JOIN equipos eq ON ag.equipo_id = eq.id
      INNER JOIN empresas e ON eq.id_equipo = e.id_equipo
      WHERE ag.status IN ('programado', 'registrado')
      ORDER BY ag.dia_agendado ASC
    `);
    
    return res.json({ censos: result.rows });
    
  } catch (err) {
    console.error('Error al obtener censos programados:', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Obtener equipos por instalar (admin only)
app.get('/admin/equipos-por-instalar', verifyToken, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }

    const result = await query(
      `SELECT eq.*, e.nombre_empresa, emp.nombre_empleado as nombre_empleado
       FROM equipos eq
       LEFT JOIN empresas e ON eq.id_equipo = e.id
       LEFT JOIN empleados emp ON eq.empleado_id = emp.id
       WHERE eq.status = 'por instalar'
       ORDER BY eq.id DESC`
    );

    console.log('📦 Equipos por instalar encontrados:', result.rows.length);

    return res.json({ equipos: result.rows });
  } catch (err) {
    console.error('Error obteniendo equipos por instalar:', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Obtener instalaciones programadas (admin only)
app.get('/admin/instalaciones-programadas', verifyToken, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }

    const result = await query(`
      SELECT 
        ag.id,
        ag.dia_agendado,
        ag.status,
        eq.id as equipo_id,
        eq.marca,
        eq.modelo,
        eq.numero_serie,
        eq.tipo_equipo,
        e.nombre_empresa
      FROM agenda ag
      INNER JOIN equipos eq ON ag.equipo_id = eq.id
      LEFT JOIN empresas e ON eq.id_equipo = e.id
      WHERE ag.status = 'instalacion programada'
      ORDER BY ag.dia_agendado ASC
    `);

    console.log('📅 Instalaciones programadas encontradas:', result.rows.length);

    return res.json({ instalaciones: result.rows });
  } catch (err) {
    console.error('Error obteniendo instalaciones programadas:', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Programar instalación (admin only)
app.post('/admin/programar-instalacion', verifyToken, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }

    const { equipo_id, dia_agendado } = req.body;

    if (!equipo_id || !dia_agendado) {
      return res.status(400).json({ error: 'equipo_id y dia_agendado son requeridos' });
    }

    // Verificar que el equipo existe y tiene status 'por instalar'
    const equipoResult = await query(
      'SELECT * FROM equipos WHERE id = $1 AND status = $2',
      [equipo_id, 'por instalar']
    );

    if (equipoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Equipo no encontrado o no está en status "por instalar"' });
    }

    // Crear registro en agenda
    const agendaResult = await query(
      `INSERT INTO agenda (dia_agendado, status, usuario_id, equipo_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [dia_agendado, 'instalacion programada', req.user.id, equipo_id]
    );

    const agenda_id = agendaResult.rows[0].id;

    // Actualizar el status del equipo a 'instalacion programada'
    await query(
      `UPDATE equipos SET status = 'instalacion programada' WHERE id = $1`,
      [equipo_id]
    );

    console.log('✅ Instalación programada:', {
      agenda_id,
      equipo_id,
      dia_agendado,
      usuario: req.user.email,
      status_actualizado: 'instalacion programada'
    });

    return res.json({
      success: true,
      mensaje: 'Instalación programada exitosamente',
      agenda_id
    });

  } catch (err) {
    console.error('Error programando instalación:', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Actualizar status de equipo (admin only)
app.put('/equipos/:id/status', verifyToken, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status es requerido' });
    }

    // Actualizar el status del equipo
    await query(
      'UPDATE equipos SET status = $1 WHERE id = $2',
      [status, id]
    );

    console.log('✅ Status de equipo actualizado:', {
      equipo_id: id,
      nuevo_status: status
    });

    return res.json({
      success: true,
      mensaje: 'Status actualizado exitosamente'
    });

  } catch (err) {
    console.error('Error actualizando status:', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Obtener todos los equipos (admin only)
app.get('/admin/equipos', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'admin') return res.status(403).json({ error: 'forbidden' });
    
    const result = await query(`
      SELECT 
        eq.id,
        eq.id_equipo,
        eq.tipo_equipo,
        eq.marca,
        eq.modelo,
        eq.numero_serie,
        eq.sistema_operativo,
        eq.procesador,
        eq.ram,
        eq.disco_duro,
        eq.codigo_registro,
        eq.status,
        emp.id_empleado,
        emp.nombre_empleado,
        e.nombre_empresa,
        e.id as empresa_id,
        (SELECT dia_agendado FROM agenda WHERE equipo_id = eq.id ORDER BY id DESC LIMIT 1) as dia_agendado
      FROM equipos eq
      INNER JOIN empresas e ON eq.id_equipo = e.id_equipo
      LEFT JOIN empleados emp ON eq.empleado_id = emp.id
      ORDER BY eq.id DESC
    `);

    console.log('📦 Admin - Equipos encontrados:', result.rows.length);
    if(result.rows.length > 0) {
      console.log('📦 Ejemplo de equipo con fecha:', {
        id: result.rows[0].id,
        marca: result.rows[0].marca,
        status: result.rows[0].status,
        dia_agendado: result.rows[0].dia_agendado
      });
    }
    
    return res.json({ equipos: result.rows });
  } catch (err) {
    console.error('Error al obtener equipos (admin):', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Get my equipment requests (client only)
app.get('/equipment-requests/mine', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'cliente') return res.status(403).json({ error: 'forbidden' });
    const result = await query('SELECT * FROM equipment_requests WHERE cliente_id = $1 ORDER BY created_at DESC LIMIT 10', [req.user.id]);
    return res.json({ requests: result.rows });
  } catch (err) {
    console.error('get my requests error', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Download census tool
app.get('/download/census-tool', verifyToken, verificarMembresia, (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'cliente') return res.status(403).json({ error: 'forbidden' });
    const path = require('path');
    const filePath = path.join(__dirname, 'census_tool.py');
    res.download(filePath, 'censo_equipos.py', (err) => {
      if (err) {
        console.error('download error', err);
        return res.status(500).json({ error: 'download failed' });
      }
    });
  } catch (err) {
    console.error('download route error', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Download census tool without authentication - generates txt file with hardware info
app.get('/download/census-tool-auto', (req, res) => {
  console.log('[census-tool-auto] Request received');
  try {
    // Crear script .sh que detecta el hardware y genera archivo txt
    const shScript = `#!/bin/bash
# Script de Censo de Equipos - CAAST Sistemas
# Detecta información del hardware y genera archivo txt

echo "===================================================================="
echo "  Herramienta de Censo de Equipos - CAAST Sistemas"
echo "===================================================================="
echo ""
echo "Verificando Python..."

# Verificar si Python está instalado
if ! command -v python3 &> /dev/null; then
    echo ""
    echo "Python 3 no está instalado. Intentando instalar automáticamente..."
    echo ""
    
    # Detectar el gestor de paquetes del sistema
    if command -v apt-get &> /dev/null; then
        # Debian/Ubuntu
        echo "Sistema basado en Debian/Ubuntu detectado."
        echo "Instalando Python 3..."
        sudo apt-get update && sudo apt-get install -y python3 python3-pip
        if [ $? -eq 0 ]; then
            echo "Python 3 instalado exitosamente."
            echo ""
        else
            echo "Error al instalar Python 3 con apt-get."
        fi
    elif command -v yum &> /dev/null; then
        # RedHat/CentOS/Fedora
        echo "Sistema basado en RedHat/CentOS detectado."
        echo "Instalando Python 3..."
        sudo yum install -y python3 python3-pip
        if [ $? -eq 0 ]; then
            echo "Python 3 instalado exitosamente."
            echo ""
        else
            echo "Error al instalar Python 3 con yum."
        fi
    elif command -v dnf &> /dev/null; then
        # Fedora moderno
        echo "Sistema Fedora detectado."
        echo "Instalando Python 3..."
        sudo dnf install -y python3 python3-pip
        if [ $? -eq 0 ]; then
            echo "Python 3 instalado exitosamente."
            echo ""
        else
            echo "Error al instalar Python 3 con dnf."
        fi
    elif command -v pacman &> /dev/null; then
        # Arch Linux
        echo "Sistema Arch Linux detectado."
        echo "Instalando Python 3..."
        sudo pacman -Sy --noconfirm python python-pip
        if [ $? -eq 0 ]; then
            echo "Python 3 instalado exitosamente."
            echo ""
        else
            echo "Error al instalar Python 3 con pacman."
        fi
    else
        echo ""
        echo "============================================================"
        echo "   No se pudo instalar Python automáticamente"
        echo "============================================================"
        echo ""
        echo "Por favor instala Python 3 manualmente:"
        echo ""
        echo "Debian/Ubuntu:"
        echo "  sudo apt-get update && sudo apt-get install python3"
        echo ""
        echo "Fedora/RedHat:"
        echo "  sudo dnf install python3"
        echo ""
        echo "Arch Linux:"
        echo "  sudo pacman -S python"
        echo ""
        read -p "Presiona Enter para salir..."
        exit 1
    fi
    
    # Verificar nuevamente si Python se instaló
    if ! command -v python3 &> /dev/null; then
        echo ""
        echo "ERROR: Python 3 no pudo ser instalado."
        echo "Por favor instala Python 3 manualmente e intenta de nuevo."
        read -p "Presiona Enter para salir..."
        exit 1
    fi
fi

echo "Python 3 detectado: $(python3 --version)"
echo ""
echo "Detectando información del equipo..."
echo ""

# Ejecutar el código Python embebido
python3 - <<'PYTHON_CODE_END'
import platform
import subprocess
import os
import json
from datetime import datetime

def get_windows_info():
    """Obtiene información de hardware en Windows usando WMIC"""
    info = {}
    try:
        info['sistema_operativo'] = platform.platform()
        cpu = subprocess.check_output("wmic cpu get name", shell=True).decode().strip().split('\\n')[1].strip()
        info['procesador'] = cpu
        ram = subprocess.check_output("wmic computersystem get totalphysicalmemory", shell=True).decode().strip().split('\\n')[1].strip()
        ram_gb = round(int(ram) / (1024**3))
        info['memoria_ram'] = f"{ram_gb}GB"
        disk = subprocess.check_output("wmic diskdrive get size,model", shell=True).decode().strip().split('\\n')[1].strip()
        info['disco_duro'] = disk
        disk_serial = subprocess.check_output("wmic diskdrive get serialnumber", shell=True).decode().strip().split('\\n')[1].strip()
        info['serie_disco_duro'] = disk_serial
        serial = subprocess.check_output("wmic bios get serialnumber", shell=True).decode().strip().split('\\n')[1].strip()
        info['no_serie'] = serial
        manufacturer = subprocess.check_output("wmic computersystem get manufacturer", shell=True).decode().strip().split('\\n')[1].strip()
        model = subprocess.check_output("wmic computersystem get model", shell=True).decode().strip().split('\\n')[1].strip()
        info['marca'] = manufacturer
        info['modelo'] = model
        info['nombre_equipo'] = platform.node()
        info['nombre_usuario_equipo'] = os.getlogin()
        chassis = subprocess.check_output("wmic systemenclosure get chassistypes", shell=True).decode().strip().split('\\n')[1].strip()
        tipo = "Desktop" if chassis in ["3", "4", "5", "6", "7"] else "Laptop"
        info['tipo_equipo'] = tipo
        info['codigo_registro'] = serial
    except Exception as e:
        print(f"Error obteniendo info de Windows: {e}")
    return info

def get_linux_info():
    """Obtiene información de hardware en Linux"""
    info = {}
    try:
        info['sistema_operativo'] = f"{platform.system()} {platform.release()}"
        with open('/proc/cpuinfo', 'r') as f:
            for line in f:
                if 'model name' in line:
                    info['procesador'] = line.split(':')[1].strip()
                    break
        with open('/proc/meminfo', 'r') as f:
            mem = f.readline().split()[1]
            ram_gb = round(int(mem) / (1024**2))
            info['memoria_ram'] = f"{ram_gb}GB"
        try:
            disk = subprocess.check_output("lsblk -d -o SIZE,MODEL | grep -v loop | tail -1", shell=True).decode().strip()
            info['disco_duro'] = disk
        except:
            info['disco_duro'] = "N/A"
        try:
            disk_serial = subprocess.check_output("lsblk -d -o SERIAL | tail -1", shell=True).decode().strip()
            info['serie_disco_duro'] = disk_serial
        except:
            info['serie_disco_duro'] = "N/A"
        try:
            serial = subprocess.check_output("sudo dmidecode -s system-serial-number 2>/dev/null || echo N/A", shell=True).decode().strip()
            info['no_serie'] = serial
        except:
            info['no_serie'] = "N/A"
        try:
            manufacturer = subprocess.check_output("sudo dmidecode -s system-manufacturer 2>/dev/null || echo N/A", shell=True).decode().strip()
            model = subprocess.check_output("sudo dmidecode -s system-product-name 2>/dev/null || echo N/A", shell=True).decode().strip()
            info['marca'] = manufacturer
            info['modelo'] = model
        except:
            info['marca'] = "N/A"
            info['modelo'] = "N/A"
        info['nombre_equipo'] = platform.node()
        info['nombre_usuario_equipo'] = os.getlogin()
        try:
            chassis = subprocess.check_output("sudo dmidecode -s chassis-type 2>/dev/null || echo Desktop", shell=True).decode().strip()
            tipo = "Laptop" if "Laptop" in chassis or "Notebook" in chassis else "Desktop"
            info['tipo_equipo'] = tipo
        except:
            info['tipo_equipo'] = "Desktop"
        info['codigo_registro'] = info['no_serie']
    except Exception as e:
        print(f"Error obteniendo info de Linux: {e}")
    return info

def main():
    system = platform.system()
    if system == "Windows":
        info = get_windows_info()
    elif system == "Linux":
        info = get_linux_info()
    else:
        print(f"Sistema operativo {system} no soportado")
        return
    
    # Mostrar información en pantalla
    print("="*70)
    print("  INFORMACIÓN DEL EQUIPO DETECTADA")
    print("="*70)
    print()
    for key, value in info.items():
        label = key.replace('_', ' ').title()
        print(f"  {label:30s}: {value}")
    print()
    print("="*70)
    print()
    
    # Generar archivo txt con la información
    filename = f"censo_equipo_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    with open(filename, 'w', encoding='utf-8') as f:
        f.write("CENSO DE EQUIPO - CAAST SISTEMAS\\n")
        f.write(f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\\n")
        f.write("="*70 + "\\n\\n")
        for key, value in info.items():
            f.write(f"{key}={value}\\n")
    
    print(f"✓ Archivo generado: {filename}")
    print(f"\\nSube este archivo al portal web para completar el censo.")
    print()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\\n\\nProceso cancelado por el usuario")
    except Exception as e:
        print(f"\\nError: {e}")
    finally:
        input("\\nPresiona Enter para cerrar...")
PYTHON_CODE_END

`;
    
    console.log('[census-tool-auto] Sending .sh file');
    res.setHeader('Content-Type', 'application/x-sh');
    res.setHeader('Content-Disposition', 'attachment; filename="censo_equipos.sh"');
    res.send(shScript);
    
  } catch (err) {
    console.error('[census-tool-auto] Error:', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Download census tool for Windows (.bat) - generates txt file with hardware info
app.get('/download/census-tool-windows', (req, res) => {
  console.log('[census-tool-windows] Request received');
  try {
    const batScript = `@echo off
chcp 65001 >nul
cls
echo ====================================================================
echo   Herramienta de Censo de Equipos - CAAST Sistemas
echo ====================================================================
echo.
echo Verificando Python...

REM Verificar si Python está instalado
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Python no esta instalado. Intentando instalar automaticamente...
    echo.
    
    REM Intentar instalar con winget (Windows 10 1809+)
    where winget >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo Instalando Python con winget...
        winget install Python.Python.3.11 -e --silent
        if %ERRORLEVEL% EQU 0 (
            echo Python instalado exitosamente con winget.
            echo.
            echo IMPORTANTE: Cierra esta ventana y vuelve a ejecutar el archivo.
            pause
            exit /b 0
        )
    )
    
    REM Si winget falla, intentar con chocolatey
    where choco >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo Instalando Python con Chocolatey...
        choco install python -y
        if %ERRORLEVEL% EQU 0 (
            echo Python instalado exitosamente con Chocolatey.
            echo.
            echo IMPORTANTE: Cierra esta ventana y vuelve a ejecutar el archivo.
            pause
            exit /b 0
        )
    )
    
    REM Si todo falla, mostrar instrucciones manuales
    echo.
    echo ============================================================
    echo   No se pudo instalar Python automaticamente
    echo ============================================================
    echo.
    echo Por favor descarga e instala Python manualmente desde:
    echo https://www.python.org/downloads/
    echo.
    echo Durante la instalacion, MARCA LA CASILLA:
    echo [ ] Add Python to PATH
    echo.
    echo Despues de instalar, cierra esta ventana y vuelve a
    echo ejecutar el archivo para continuar.
    echo.
    pause
    exit /b 1
)

python --version
echo.
echo Detectando información del equipo...
echo.

python -c "
import platform
import subprocess
import os
from datetime import datetime

def get_windows_info():
    info = {}
    try:
        info['sistema_operativo'] = platform.platform()
        cpu = subprocess.check_output('wmic cpu get name', shell=True).decode().strip().split('\\n')[1].strip()
        info['procesador'] = cpu
        ram = subprocess.check_output('wmic computersystem get totalphysicalmemory', shell=True).decode().strip().split('\\n')[1].strip()
        ram_gb = round(int(ram) / (1024**3))
        info['memoria_ram'] = f'{ram_gb}GB'
        disk = subprocess.check_output('wmic diskdrive get size,model', shell=True).decode().strip().split('\\n')[1].strip()
        info['disco_duro'] = disk
        disk_serial = subprocess.check_output('wmic diskdrive get serialnumber', shell=True).decode().strip().split('\\n')[1].strip()
        info['serie_disco_duro'] = disk_serial
        serial = subprocess.check_output('wmic bios get serialnumber', shell=True).decode().strip().split('\\n')[1].strip()
        info['no_serie'] = serial
        manufacturer = subprocess.check_output('wmic computersystem get manufacturer', shell=True).decode().strip().split('\\n')[1].strip()
        model = subprocess.check_output('wmic computersystem get model', shell=True).decode().strip().split('\\n')[1].strip()
        info['marca'] = manufacturer
        info['modelo'] = model
        info['nombre_equipo'] = platform.node()
        info['nombre_usuario_equipo'] = os.getlogin()
        chassis = subprocess.check_output('wmic systemenclosure get chassistypes', shell=True).decode().strip().split('\\n')[1].strip()
        tipo = 'Desktop' if chassis in ['3', '4', '5', '6', '7'] else 'Laptop'
        info['tipo_equipo'] = tipo
    except Exception as e:
        print(f'Error obteniendo info: {e}')
    return info

def main():
    print('\\nRecopilando información del equipo...')
    print('Esto puede tomar unos segundos...\\n')
    
    info = get_windows_info()
    
    print('='*70)
    print('  INFORMACIÓN DEL EQUIPO DETECTADA')
    print('='*70)
    print()
    for key, value in info.items():
        label = key.replace('_', ' ').title()
        print(f'  {label:30s}: {value}')
    print()
    print('='*70)
    print()
    
    input('Presiona Enter para generar el archivo .txt...')
    
    filename = f'censo_equipo_{datetime.now().strftime(\"%Y%m%d_%H%M%S\")}.txt'
    with open(filename, 'w', encoding='utf-8') as f:
        f.write('CENSO DE EQUIPO - CAAST SISTEMAS\\n')
        f.write(f'Fecha: {datetime.now().strftime(\"%Y-%m-%d %H:%M:%S\")}\\n')
        f.write('='*70 + '\\n\\n')
        for key, value in info.items():
            f.write(f'{key}={value}\\n')
    
    print()
    print(f'✓ Archivo generado: {filename}')
    print(f'✓ Ubicación: {os.path.abspath(filename)}')
    print()
    print('Sube este archivo al portal para completar el censo.')
    print()

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\\n\\nProceso cancelado')
    except Exception as e:
        print(f'\\nError: {e}')
    finally:
        input('\\nPresiona Enter para cerrar...')
"

pause
`;
    
    console.log('[census-tool-windows] Sending .bat file');
    res.setHeader('Content-Type', 'application/x-msdos-program');
    res.setHeader('Content-Disposition', 'attachment; filename="censo_equipos.bat"');
    res.send(batScript);
    
  } catch (err) {
    console.error('[census-tool-windows] Error:', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Download census tool for Windows (executable batch)
app.get('/download/census-tool-windows', verifyToken, (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'cliente') return res.status(403).json({ error: 'forbidden' });
    const path = require('path');
    const filePath = path.join(__dirname, 'ejecutar_censo.bat');
    res.download(filePath, 'ejecutar_censo.bat', (err) => {
      if (err) {
        console.error('download error', err);
        return res.status(500).json({ error: 'download failed' });
      }
    });
  } catch (err) {
    console.error('download route error', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Download census tool for Linux (executable shell)
app.get('/download/census-tool-linux', verifyToken, (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'cliente') return res.status(403).json({ error: 'forbidden' });
    const path = require('path');
    const filePath = path.join(__dirname, 'ejecutar_censo.sh');
    res.download(filePath, 'ejecutar_censo.sh', (err) => {
      if (err) {
        console.error('download error', err);
        return res.status(500).json({ error: 'download failed' });
      }
    });
  } catch (err) {
    console.error('download route error', err);
    return res.status(500).json({ error: 'server error' });
  }
});
// ==================== TICKETS ENDPOINTS ====================

// Create ticket (cliente only)
app.post('/tickets', verifyToken, verificarMembresia, async (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'cliente') return res.status(403).json({ error: 'forbidden' });
    const { asunto, descripcion, prioridad } = req.body || {};
    if (!asunto || !descripcion) return res.status(400).json({ error: 'missing required fields' });

    const insert = await query(
      'INSERT INTO tickets (cliente_id, empresa_id, asunto, descripcion, prioridad, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [req.user.id, req.user.empresa_id, asunto, descripcion, prioridad || 'media', 'abierto']
    );
    return res.status(201).json({ ticket: insert.rows[0] });
  } catch (err) {
    console.error('create ticket error', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Get my tickets (cliente only)
app.get('/tickets/mine', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'cliente') return res.status(403).json({ error: 'forbidden' });
    const result = await query('SELECT * FROM tickets WHERE cliente_id = $1 ORDER BY created_at DESC', [req.user.id]);
    return res.json({ tickets: result.rows });
  } catch (err) {
    console.error('get my tickets error', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// List all tickets (admin only)
app.get('/tickets', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'admin') return res.status(403).json({ error: 'forbidden' });
    const result = await query('SELECT t.*, ue.nombre_usuario as cliente_nombre, ue.email as cliente_email, e.nombre_empresa FROM tickets t LEFT JOIN usuarios_empresas ue ON t.cliente_id = ue.id LEFT JOIN empresas e ON t.empresa_id = e.id ORDER BY t.created_at DESC');
    return res.json({ tickets: result.rows });
  } catch (err) {
    console.error('list tickets error', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Update ticket status (admin only)
app.patch('/tickets/:id', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'admin') return res.status(403).json({ error: 'forbidden' });
    const { id } = req.params;
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ error: 'missing status' });

    const update = await query('UPDATE tickets SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [status, id]);
    if (update.rows.length === 0) return res.status(404).json({ error: 'ticket not found' });
    return res.json({ ticket: update.rows[0] });
  } catch (err) {
    console.error('update ticket error', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// ============= SISTEMA DE PAGOS Y SUSCRIPCIONES =============

// Obtener planes disponibles (desde base de datos)
app.get('/planes', async (req, res) => {
  try {
    const result = await query(
      "SELECT * FROM precios_servicios WHERE codigo_servicio = 'plan_anual' AND activo = true"
    );
    
    if (result.rows.length === 0) {
      // Fallback al plan estático si no existe en BD
      return res.json({ planes: PLANES });
    }
    
    const planDB = result.rows[0];
    
    // Mantener la estructura del objeto PLANES para compatibilidad
    const planes = {
      anual: {
        nombre: planDB.nombre_servicio,
        precio: parseFloat(planDB.precio),
        dias: 365,
        descripcion: planDB.descripcion
      }
    };
    
    return res.json({ planes });
  } catch (err) {
    console.error('Error al obtener planes:', err);
    // Fallback al plan estático en caso de error
    return res.json({ planes: PLANES });
  }
});

// Obtener clave pública de Stripe
app.get('/stripe/config', (req, res) => {
  return res.json({ 
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY 
  });
});


// Crear Payment Intent para pago directo
app.post('/stripe/create-payment-intent', verifyToken, async (req, res) => {
  try {
    const { plan } = req.body;
    const empresa_id = req.user.empresa_id;
    const usuario_id = req.user.id;

    console.log('📥 Solicitud de Payment Intent:', { plan, empresa_id, usuario_id });

    if (!plan || !PLANES[plan]) {
      console.log('❌ Plan inválido:', plan);
      return res.status(400).json({ error: 'plan inválido' });
    }
    if (!empresa_id) {
      console.log('❌ No empresa_id');
      return res.status(400).json({ error: 'no empresa_id' });
    }

    const planSeleccionado = PLANES[plan];
    console.log('✅ Plan seleccionado:', planSeleccionado);

    // Crear Payment Intent sin customer
    console.log('🔵 Creando Payment Intent...');
    const paymentIntent = await stripe.paymentIntents.create({
      amount: planSeleccionado.precio * 100, // Centavos
      currency: 'mxn',
      metadata: {
        empresa_id: empresa_id.toString(),
        usuario_id: usuario_id.toString(),
        plan: plan,
        dias: planSeleccionado.dias.toString()
      },
      description: `${planSeleccionado.nombre} - ${planSeleccionado.dias} días`
    });

    console.log('✅ Payment Intent creado:', paymentIntent.id, 'Amount:', paymentIntent.amount);

    return res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

  } catch (err) {
    console.error('💥 Error creating payment intent:', err);
    return res.status(500).json({ error: 'server error', details: err.message });
  }
});

// Confirmar pago exitoso y registrar en BD
app.post('/stripe/confirm-payment', verifyToken, async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    const empresa_id = req.user.empresa_id;
    const usuario_id = req.user.id;

    console.log('📥 Confirmación de pago:', { paymentIntentId, empresa_id, usuario_id });

    if (!paymentIntentId) {
      console.log('❌ No paymentIntentId');
      return res.status(400).json({ error: 'paymentIntentId requerido' });
    }

    // Recuperar el Payment Intent de Stripe
    console.log('🔵 Recuperando Payment Intent de Stripe...');
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    console.log('✅ Payment Intent recuperado:', paymentIntent.status);

    if (paymentIntent.status !== 'succeeded') {
      console.log('❌ Pago no completado:', paymentIntent.status);
      return res.status(400).json({ error: 'pago no completado', status: paymentIntent.status });
    }

    // Verificar que el pago pertenece a esta empresa
    if (paymentIntent.metadata.empresa_id !== empresa_id.toString()) {
      console.log('❌ Pago no autorizado');
      return res.status(403).json({ error: 'pago no autorizado' });
    }

    const plan = paymentIntent.metadata.plan;
    const dias = parseInt(paymentIntent.metadata.dias);
    const planSeleccionado = PLANES[plan];

    if (!planSeleccionado) {
      console.log('❌ Plan inválido en metadata:', plan);
      return res.status(400).json({ error: 'plan inválido' });
    }

    console.log('🔵 Registrando pago en base de datos...');

    const ahora = new Date();
    const fecha_expiracion = new Date(ahora);
    fecha_expiracion.setDate(fecha_expiracion.getDate() + dias);

    // Registrar pago en la base de datos
    const pagoResult = await query(
      `INSERT INTO pagos 
       (empresa_id_pago, usuario_id, monto, moneda, metodo_pago, referencia_pago, estado_pago, dias_agregados, fecha_pago, fecha_expiracion, datos_pago) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        empresa_id,
        usuario_id,
        planSeleccionado.precio,
        'MXN',
        'stripe_payment_intent',
        paymentIntentId,
        'completado',
        dias,
        ahora,
        fecha_expiracion,
        JSON.stringify({
          payment_intent_id: paymentIntentId,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          payment_method: paymentIntent.payment_method
        })
      ]
    );

    console.log('✅ Pago registrado en BD:', pagoResult.rows[0].id);

    return res.json({
      success: true,
      pago: pagoResult.rows[0],
      mensaje: `¡Pago exitoso! Se agregaron ${dias} días a tu suscripción.`
    });

  } catch (err) {
    console.error('💥 Error confirming payment:', err);
    return res.status(500).json({ error: 'server error', details: err.message });
  }
});



// ============= FIN STRIPE PAYMENT METHODS API =============

// Obtener estado de suscripción de la empresa
app.get('/suscripcion/estado', verifyToken, async (req, res) => {
  try {
    const empresa_id = req.user.empresa_id;
    if (!empresa_id) return res.status(400).json({ error: 'no empresa_id' });

    // Obtener el pago activo más reciente (mayor fecha_expiracion)
    const result = await query(
      `SELECT fecha_pago, fecha_expiracion, dias_agregados, estado_pago 
       FROM pagos 
       WHERE empresa_id_pago = $1 AND estado_pago = 'completado'
       ORDER BY fecha_expiracion DESC 
       LIMIT 1`,
      [empresa_id]
    );

    if (result.rows.length === 0) {
      return res.json({
        suscripcion: {
          estado: 'inactiva',
          fecha_inicio: null,
          fecha_expiracion: null,
          dias_restantes: 0
        }
      });
    }

    const pago = result.rows[0];
    const ahora = new Date();
    const fecha_expiracion = new Date(pago.fecha_expiracion);
    const diferencia = fecha_expiracion - ahora;
    const dias_restantes = Math.max(0, Math.ceil(diferencia / (1000 * 60 * 60 * 24)));
    const estado = dias_restantes > 0 ? 'activa' : 'expirada';

    return res.json({
      suscripcion: {
        estado: estado,
        fecha_inicio: pago.fecha_pago,
        fecha_expiracion: pago.fecha_expiracion,
        dias_restantes: dias_restantes
      }
    });
  } catch (err) {
    console.error('suscripcion estado error', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Crear sesión de pago con Stripe
app.post('/pagos/crear-sesion', verifyToken, async (req, res) => {
  try {
    const { plan } = req.body;
    const empresa_id = req.user.empresa_id;
    const usuario_id = req.user.id;

    if (!plan || !PLANES[plan]) return res.status(400).json({ error: 'plan inválido' });
    if (!empresa_id) return res.status(400).json({ error: 'no empresa_id' });

    const planSeleccionado = PLANES[plan];

    // Crear sesión de Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'mxn',
            product_data: {
              name: planSeleccionado.nombre,
              description: planSeleccionado.descripcion,
            },
            unit_amount: planSeleccionado.precio * 100, // Stripe usa centavos
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/?pago=exitoso`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/?pago=cancelado`,
      metadata: {
        empresa_id: empresa_id.toString(),
        usuario_id: usuario_id.toString(),
        plan: plan,
        dias: planSeleccionado.dias.toString()
      }
    });

    return res.json({ 
      sessionId: session.id,
      url: session.url
    });

  } catch (err) {
    console.error('crear sesion stripe error', err);
    return res.status(500).json({ error: 'server error', details: err.message });
  }
});

// Procesar pago (simulado - para pruebas sin Stripe)
app.post('/pagos/procesar', verifyToken, async (req, res) => {
  try {
    const { plan, metodo_pago } = req.body;
    const empresa_id = req.user.empresa_id;
    const usuario_id = req.user.id;

    if (!plan || !PLANES[plan]) return res.status(400).json({ error: 'plan inválido' });
    if (!empresa_id) return res.status(400).json({ error: 'no empresa_id' });

    const planSeleccionado = PLANES[plan];

    // AQUÍ IRÍA LA INTEGRACIÓN CON LA API DE PAGOS REAL
    // Por ahora, simulamos un pago exitoso
    
    const ahora = new Date();
    const fecha_expiracion = new Date(ahora);
    fecha_expiracion.setDate(fecha_expiracion.getDate() + planSeleccionado.dias);

    // Registrar pago en tabla pagos
    const pagoResult = await query(
      `INSERT INTO pagos 
       (empresa_id_pago, usuario_id, monto, moneda, metodo_pago, referencia_pago, estado_pago, dias_agregados, fecha_pago, fecha_expiracion, datos_pago) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        empresa_id,
        usuario_id,
        planSeleccionado.precio,
        'MXN',
        metodo_pago || 'simulado',
        'SIM-' + Date.now(),
        'completado',
        planSeleccionado.dias,
        ahora,
        fecha_expiracion,
        JSON.stringify({ plan: plan, nombre_plan: planSeleccionado.nombre })
      ]
    );

    return res.json({
      success: true,
      mensaje: `Pago procesado exitosamente. ${planSeleccionado.dias} días agregados.`,
      pago: pagoResult.rows[0],
      suscripcion: {
        fecha_inicio: ahora,
        fecha_expiracion: fecha_expiracion,
        estado: 'activa'
      }
    });

  } catch (err) {
    console.error('procesar pago error', err);
    return res.status(500).json({ error: 'server error', details: err.message });
  }
});

// Historial de pagos
app.get('/pagos/historial', verifyToken, async (req, res) => {
  try {
    const empresa_id = req.user.empresa_id;
    if (!empresa_id) return res.status(400).json({ error: 'no empresa_id' });

    const result = await query(
      'SELECT * FROM pagos WHERE empresa_id_pago = $1 ORDER BY fecha_pago DESC',
      [empresa_id]
    );

    return res.json({ pagos: result.rows });
  } catch (err) {
    console.error('historial pagos error', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// ============= PAGOS DE SERVICIOS (INSTALACIÓN) =============

// Crear Payment Intent para servicio de instalación
app.post('/servicios/create-payment-intent', verifyToken, async (req, res) => {
  try {
    const { monto, concepto, datosServicio } = req.body;
    const empresa_id = req.user.empresa_id;
    const usuario_id = req.user.id;

    console.log('📥 Solicitud de Payment Intent para servicio:', { monto, concepto, empresa_id, usuario_id });

    if (!monto || monto <= 0) {
      return res.status(400).json({ error: 'Monto inválido' });
    }
    if (!empresa_id) {
      return res.status(400).json({ error: 'no empresa_id' });
    }

    // Crear Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: monto * 100, // Convertir a centavos
      currency: 'mxn',
      metadata: {
        empresa_id: empresa_id.toString(),
        usuario_id: usuario_id.toString(),
        tipo_servicio: concepto || 'Servicio de Instalación'
      },
      description: concepto || 'Servicio de Instalación'
    });

    console.log('✅ Payment Intent creado para servicio:', paymentIntent.id);

    return res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

  } catch (err) {
    console.error('💥 Error creating payment intent para servicio:', err);
    return res.status(500).json({ error: 'server error', details: err.message });
  }
});

// Confirmar pago de servicio y registrar en BD
app.post('/servicios/confirm-payment', verifyToken, async (req, res) => {
  try {
    const { paymentIntentId, datosServicio, datosEquipo } = req.body;
    const empresa_id = req.user.empresa_id;
    const usuario_id = req.user.id;

    console.log('📥 Confirmación de pago de servicio:', { paymentIntentId, empresa_id, usuario_id, datosEquipo });

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'paymentIntentId requerido' });
    }

    // Recuperar el Payment Intent de Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    console.log('🔵 Payment Intent recuperado:', {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount
    });

    if (paymentIntent.status !== 'succeeded') {
      console.log('❌ Pago no exitoso:', paymentIntent.status);
      return res.status(400).json({ error: 'pago no completado', status: paymentIntent.status });
    }

    // Registrar en tabla pagos_servicios
    const monto = paymentIntent.amount / 100;
    const tipo_servicio = paymentIntent.metadata.tipo_servicio || 'Servicio de Instalación';
    const ahora = new Date();

    const pagoResult = await query(
      `INSERT INTO pagos_servicios 
       (empresa_id, usuario_id, tipo_servicio, monto, moneda, status, metodo_pago, referencia_pago, fecha_pago, datos_adicionales) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       RETURNING *`,
      [
        empresa_id,
        usuario_id,
        tipo_servicio,
        monto,
        'MXN',
        'completado',
        'stripe',
        paymentIntent.id,
        ahora,
        JSON.stringify(datosServicio || {})
      ]
    );

    console.log('✅ Pago de servicio registrado:', pagoResult.rows[0]);

    // Si hay datos del equipo, registrarlo en la tabla equipos con status "por instalar"
    let equipoRegistrado = null;
    if (datosEquipo && datosEquipo.marca) {
      try {
        console.log('🔧 Insertando equipo con empresa_id:', empresa_id, 'datosEquipo:', datosEquipo);
        const equipoResult = await query(
          `INSERT INTO equipos 
           (id_equipo, empleado_id, tipo_equipo, marca, modelo, numero_serie, sistema_operativo, 
            procesador, ram, disco_duro, codigo_registro, status) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
           RETURNING *`,
          [
            empresa_id,
            datosEquipo.empleado_id || null,
            datosEquipo.tipo_equipo || '',
            datosEquipo.marca || '',
            datosEquipo.modelo || '',
            datosEquipo.numero_serie || '',
            datosEquipo.sistema_operativo || '',
            datosEquipo.procesador || '',
            datosEquipo.memoria_ram || '',
            datosEquipo.disco_duro || '',
            datosEquipo.codigo_registro || '',
            'por instalar'
          ]
        );
        equipoRegistrado = equipoResult.rows[0];
        console.log('✅ Equipo registrado con status "por instalar":', equipoRegistrado);
      } catch (equipoError) {
        console.error('Error al registrar equipo:', equipoError);
        // No fallar el pago si el equipo no se registra, solo loguearlo
      }
    }

    return res.json({
      success: true,
      mensaje: 'Pago de servicio procesado exitosamente',
      pago: pagoResult.rows[0],
      equipo: equipoRegistrado
    });

  } catch (err) {
    console.error('procesar pago de servicio error', err);
    return res.status(500).json({ error: 'server error', details: err.message });
  }
});

// Historial de pagos de servicios
app.get('/servicios/pagos/historial', verifyToken, async (req, res) => {
  try {
    const empresa_id = req.user.empresa_id;
    if (!empresa_id) return res.status(400).json({ error: 'no empresa_id' });

    const result = await query(
      'SELECT * FROM pagos_servicios WHERE empresa_id = $1 ORDER BY fecha_pago DESC',
      [empresa_id]
    );

    return res.json({ pagos: result.rows });
  } catch (err) {
    console.error('historial pagos servicios error', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// ============= PRECIOS DE SERVICIOS =============

// Obtener todos los precios de servicios activos
app.get('/precios-servicios', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM precios_servicios WHERE activo = true ORDER BY codigo_servicio'
    );
    return res.json({ servicios: result.rows });
  } catch (err) {
    console.error('Error al obtener precios de servicios:', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Obtener precio de un servicio específico
app.get('/precios-servicios/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    const result = await query(
      'SELECT * FROM precios_servicios WHERE codigo_servicio = $1 AND activo = true',
      [codigo]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }
    
    return res.json({ servicio: result.rows[0] });
  } catch (err) {
    console.error('Error al obtener precio del servicio:', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// ============= FIN PRECIOS DE SERVICIOS =============

// ============= DESCARGAS DE INSTALACIÓN PROPIA =============

// Endpoint para descargar instalador (simulado con .txt)
app.get('/api/descargas/instalador-seer-trafico.txt', verifyToken, async (req, res) => {
  try {
    const contenido = `===============================================
INSTALADOR SEER TRÁFICO
===============================================

Este es un archivo de simulación para pruebas.
En producción, este sería el instalador real.

INSTRUCCIONES DE INSTALACIÓN:

1. REQUISITOS DEL SISTEMA:
   - Windows 10/11 o Linux (Ubuntu 20.04+)
   - 4 GB RAM mínimo (8 GB recomendado)
   - 10 GB espacio en disco
   - Conexión a Internet

2. PASOS DE INSTALACIÓN:
   a) Descomprimir el archivo en una carpeta temporal
   b) Ejecutar el instalador con privilegios de administrador
   c) Seguir las instrucciones en pantalla
   d) Configurar las bases de datos según la guía
   e) Reiniciar el sistema

3. VERIFICACIÓN:
   - Acceder a http://localhost:8080
   - Ingresar credenciales proporcionadas
   - Verificar conectividad con bases de datos

4. SOPORTE:
   Email: soporte@seertrafico.com
   Horario: Lunes a Viernes, 9:00 AM - 6:00 PM

===============================================
ARCHIVO DE SIMULACIÓN - REEMPLAZAR EN PRODUCCIÓN
===============================================
`;
    
    res.setHeader('Content-Disposition', 'attachment; filename=instalador-seer-trafico.txt');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(contenido);
    
    console.log('✅ Descarga de instalador simulado - Usuario:', req.user.id);
  } catch (err) {
    console.error('Error descarga instalador:', err);
    res.status(500).json({ error: 'Error al descargar archivo' });
  }
});

// Endpoint para descargar guía de instalación (simulado con .txt)
app.get('/api/descargas/guia-instalacion.txt', verifyToken, async (req, res) => {
  try {
    const contenido = `===============================================
GUÍA DE INSTALACIÓN SEER TRÁFICO
===============================================

TABLA DE CONTENIDOS:
1. Introducción
2. Requisitos del Sistema
3. Instalación Paso a Paso
4. Configuración Inicial
5. Resolución de Problemas
6. Soporte Técnico

===============================================
1. INTRODUCCIÓN
===============================================

Bienvenido a la Guía de Instalación de SEER Tráfico.
Este documento te guiará a través del proceso completo
de instalación y configuración inicial del sistema.

===============================================
2. REQUISITOS DEL SISTEMA
===============================================

HARDWARE MÍNIMO:
- Procesador: Intel Core i3 o equivalente
- Memoria RAM: 4 GB
- Espacio en Disco: 10 GB
- Resolución: 1366x768 o superior

SOFTWARE REQUERIDO:
- Sistema Operativo: Windows 10/11 o Linux
- .NET Framework 4.8 o superior (Windows)
- Python 3.8+ (para herramientas de censo)
- Navegador web moderno

===============================================
3. INSTALACIÓN PASO A PASO
===============================================

PASO 1: PREPARACIÓN
a) Descargar todos los archivos necesarios
b) Verificar permisos de administrador
c) Cerrar programas antivirus temporalmente

PASO 2: EJECUCIÓN DEL INSTALADOR
a) Hacer doble clic en el instalador
b) Aceptar términos y condiciones
c) Seleccionar carpeta de instalación
d) Esperar finalización (aprox. 5-10 minutos)

PASO 3: CONFIGURACIÓN POST-INSTALACIÓN
a) Configurar conexiones a bases de datos
b) Establecer credenciales de acceso
c) Configurar puertos de red
d) Realizar prueba de conectividad

===============================================
4. CONFIGURACIÓN INICIAL
===============================================

CONFIGURACIÓN DE BASES DE DATOS:
- Servidor: localhost o IP remota
- Puerto: 5432 (PostgreSQL) o según BD
- Usuario: crear usuario específico
- Password: establecer contraseña segura

CONFIGURACIÓN DE RED:
- Puerto HTTP: 8080 (predeterminado)
- Puerto HTTPS: 8443 (si SSL habilitado)
- Firewall: permitir puertos mencionados

===============================================
5. RESOLUCIÓN DE PROBLEMAS
===============================================

PROBLEMA: El instalador no inicia
SOLUCIÓN: Verificar permisos de administrador

PROBLEMA: Error de conexión a BD
SOLUCIÓN: Verificar credenciales y firewall

PROBLEMA: Puerto en uso
SOLUCIÓN: Cambiar puerto en configuración

===============================================
6. SOPORTE TÉCNICO
===============================================

Email: soporte@seertrafico.com
Teléfono: +52 (55) 1234-5678
Horario: Lunes a Viernes, 9:00 AM - 6:00 PM
Portal: https://soporte.seertrafico.com

===============================================
DOCUMENTO DE SIMULACIÓN - REEMPLAZAR EN PRODUCCIÓN
===============================================
`;
    
    res.setHeader('Content-Disposition', 'attachment; filename=guia-instalacion.txt');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(contenido);
    
    console.log('✅ Descarga de guía simulada - Usuario:', req.user.id);
  } catch (err) {
    console.error('Error descarga guía:', err);
    res.status(500).json({ error: 'Error al descargar archivo' });
  }
});

// Los siguientes endpoints se mantienen por compatibilidad pero ya no se usan en instalación propia
// Endpoint para descargar instalador Windows (legacy)
app.get('/api/descargas/seer-trafico-windows.exe', verifyToken, async (req, res) => {
  try {
    // Por ahora, enviamos un archivo de texto como placeholder
    // En producción, aquí enviarías el .exe real
    const contenido = `# Instalador SEER Tráfico para Windows
# Este es un placeholder. Reemplaza con el archivo .exe real

echo "Instalando SEER Tráfico..."
echo "Por favor, sigue las instrucciones en la guía de instalación"
`;
    
    res.setHeader('Content-Disposition', 'attachment; filename=seer-trafico-installer.bat');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(contenido);
  } catch (err) {
    console.error('Error descarga Windows:', err);
    res.status(500).json({ error: 'Error al descargar archivo' });
  }
});

// Endpoint para descargar instalador Linux
app.get('/api/descargas/seer-trafico-linux.sh', verifyToken, async (req, res) => {
  try {
    const contenido = `#!/bin/bash
# Instalador SEER Tráfico para Linux
# Este es un script de ejemplo. Reemplaza con el instalador real

echo "========================================"
echo "Instalador SEER Tráfico para Linux"
echo "========================================"
echo ""

# Detectar distribución
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
fi

echo "Sistema detectado: $OS $VER"
echo ""

# Verificar permisos de superusuario
if [ "$EUID" -ne 0 ]; then 
    echo "Por favor ejecuta este script con privilegios de superusuario (sudo)"
    exit 1
fi

echo "Instalando dependencias..."
# Aquí iría la lógica real de instalación

echo ""
echo "✓ Instalación completada"
echo "Por favor, consulta la guía de instalación para configurar SEER Tráfico"
`;
    
    res.setHeader('Content-Disposition', 'attachment; filename=seer-trafico-installer.sh');
    res.setHeader('Content-Type', 'application/x-sh');
    res.send(contenido);
  } catch (err) {
    console.error('Error descarga Linux:', err);
    res.status(500).json({ error: 'Error al descargar archivo' });
  }
});

// Endpoint para descargar guía de instalación PDF
app.get('/api/descargas/guia-instalacion-seer.pdf', verifyToken, async (req, res) => {
  try {
    // Por ahora, enviamos un archivo de texto como placeholder
    // En producción, aquí enviarías el PDF real
    const contenido = `GUÍA DE INSTALACIÓN SEER TRÁFICO

===========================================
CONTENIDO:
===========================================

1. REQUISITOS DEL SISTEMA
   - Windows 10/11 o Linux (Ubuntu 20.04+, Debian 11+, CentOS 8+)
   - 4 GB RAM mínimo (8 GB recomendado)
   - 10 GB espacio en disco
   - Conexión a Internet

2. INSTALACIÓN EN WINDOWS
   a) Ejecutar seer-trafico-installer.bat como Administrador
   b) Seguir las instrucciones en pantalla
   c) Reiniciar el sistema después de la instalación

3. INSTALACIÓN EN LINUX
   a) Dar permisos de ejecución: chmod +x seer-trafico-installer.sh
   b) Ejecutar con sudo: sudo ./seer-trafico-installer.sh
   c) Reiniciar el servicio después de la instalación

4. CONFIGURACIÓN INICIAL
   - Acceder a http://localhost:8080
   - Ingresar credenciales proporcionadas
   - Configurar bases de datos
   - Realizar prueba de conexión

5. SOPORTE TÉCNICO
   Email: soporte@seertrafico.com
   Horario: Lunes a Viernes, 9:00 AM - 6:00 PM

===========================================
Este es un documento placeholder.
Reemplazar con el PDF real en producción.
===========================================
`;
    
    res.setHeader('Content-Disposition', 'attachment; filename=guia-instalacion-seer.txt');
    res.setHeader('Content-Type', 'text/plain');
    res.send(contenido);
  } catch (err) {
    console.error('Error descarga guía:', err);
    res.status(500).json({ error: 'Error al descargar archivo' });
  }
});

// ============= FIN DESCARGAS =============

// ============= FIN PAGOS DE SERVICIOS =============

// ============= FIN SISTEMA DE PAGOS =============

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Backend listening on http://localhost:${port}`));
