require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
app.use(express.json());
app.use(cors());
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, pool } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

function verifyToken(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'missing token' });
  const token = parts[1];
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(401).json({ error: 'invalid token' });
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

      const token = jwt.sign({ id: user.id, email: user.email, rol: 'cliente' }, JWT_SECRET, { expiresIn: '8h' });
      return res.json({ token, user: { id: user.id, email: user.email, rol: 'cliente', nombre_usuario: user.nombre_usuario, empresa_id: user.empresa_id } });
    } catch (err) {
      console.error('client auth error', err);
      return res.status(500).json({ error: 'server error' });
    }
  })();
});

// Equipment census request (clients only)
app.post('/equipment-requests', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'cliente') return res.status(403).json({ error: 'forbidden' });
    const { marca, modelo, no_serie, codigo_registro, memoria_ram, disco_duro, serie_disco_duro, sistema_operativo, procesador, nombre_usuario_equipo, tipo_equipo, nombre_equipo } = req.body || {};
    if (!marca || !modelo || !no_serie) return res.status(400).json({ error: 'missing required fields' });

    // Extraer empresa_id del token (está en req.user)
    const empresa_id = req.user.empresa_id;

    // Eliminar solicitudes anteriores del mismo cliente antes de insertar la nueva
    await query('DELETE FROM equipment_requests WHERE cliente_id = $1', [req.user.id]);

    const insert = await query(
      'INSERT INTO equipment_requests (cliente_id, empresa_id, marca, modelo, no_serie, codigo_registro, memoria_ram, disco_duro, serie_disco_duro, sistema_operativo, procesador, nombre_usuario_equipo, tipo_equipo, nombre_equipo, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *',
      [req.user.id, empresa_id, marca, modelo, no_serie, codigo_registro, memoria_ram, disco_duro, serie_disco_duro, sistema_operativo, procesador, nombre_usuario_equipo, tipo_equipo, nombre_equipo, 'pendiente']
    );
    return res.status(201).json({ request: insert.rows[0] });
  } catch (err) {
    console.error('equipment request error', err);
    return res.status(500).json({ error: 'server error' });
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

// Download census tool with embedded token
app.get('/download/census-tool-auto', verifyToken, (req, res) => {
  console.log('[census-tool-auto] Request received from user:', req.user.email);
  try {
    if (!req.user || req.user.rol !== 'cliente') {
      console.log('[census-tool-auto] Forbidden: user role is', req.user?.rol);
      return res.status(403).json({ error: 'forbidden' });
    }
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, 'census_tool.py');
    
    console.log('[census-tool-auto] Reading file:', filePath);
    
    // Leer el archivo y reemplazar el token
    const pythonCode = fs.readFileSync(filePath, 'utf8');
    const token = req.headers['authorization'].split(' ')[1];
    const pythonCodeWithToken = pythonCode.replace('__TOKEN_PLACEHOLDER__', token);
    
    // Crear archivo .sh con el código Python embebido
    const shScript = `#!/bin/bash
# Script de Censo de Equipos - CAAST Sistemas
# Se ejecuta automáticamente al abrir

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

# Verificar módulo requests
echo "Verificando módulo 'requests'..."
python3 -c "import requests" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "Instalando módulo 'requests'..."
    pip3 install requests --user || {
        echo "ERROR: No se pudo instalar el módulo 'requests'."
        read -p "Presiona Enter para salir..."
        exit 1
    }
fi

echo "✓ Módulo 'requests' disponible"
echo ""

# Ejecutar el código Python embebido
python3 - <<'PYTHON_CODE_END'
${pythonCodeWithToken}
PYTHON_CODE_END

# Mantener la ventana abierta al finalizar
read -p "Presiona Enter para cerrar..."
`;
    
    console.log('[census-tool-auto] Generated .sh file, size:', shScript.length, 'bytes');
    
    // Enviar el archivo .sh
    res.setHeader('Content-Type', 'application/x-sh');
    res.setHeader('Content-Disposition', 'attachment; filename="censo_equipos.sh"');
    res.send(shScript);
    
    console.log('[census-tool-auto] File sent successfully');
  } catch (err) {
    console.error('[census-tool-auto] Error:', err);
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

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Backend listening on http://localhost:${port}`));
