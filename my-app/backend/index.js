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
app.post('/equipment-requests', verifyToken, upload.single('responsiva'), async (req, res) => {
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
        emp.id_empleado,
        emp.nombre_empleado,
        e.nombre_empresa
      FROM equipos eq
      INNER JOIN empresas e ON eq.id_equipo = e.id_equipo
      LEFT JOIN empleados emp ON eq.empleado_id = emp.id
      WHERE e.id = $1
      ORDER BY eq.id DESC
    `, [empresa_id]);

    return res.json({ equipos: result.rows });
  } catch (err) {
    console.error('Error al obtener equipos:', err);
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
app.get('/download/census-tool', verifyToken, (req, res) => {
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
    echo "ERROR: Python 3 no está instalado."
    echo "Por favor instala Python 3 para continuar."
    read -p "Presiona Enter para salir..."
    exit 1
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

where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python no está instalado.
    echo Por favor instala Python desde https://www.python.org/
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
app.post('/tickets', verifyToken, async (req, res) => {
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

// Obtener planes disponibles
app.get('/planes', (req, res) => {
  return res.json({ planes: PLANES });
});

// Obtener clave pública de Stripe
app.get('/stripe/config', (req, res) => {
  return res.json({ 
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY 
  });
});

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

// ============= FIN SISTEMA DE PAGOS =============

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Backend listening on http://localhost:${port}`));
