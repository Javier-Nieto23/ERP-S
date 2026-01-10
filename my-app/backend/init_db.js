require('dotenv').config();
const { query, pool, createDatabaseIfNotExists } = require('./db');
const bcrypt = require('bcryptjs');

async function run() {
  try {
    // Ensure database exists (will connect to 'postgres' to create if needed)
    await createDatabaseIfNotExists();
    await pool.connect();

    // Usuarios Internos
    await query(`CREATE TABLE IF NOT EXISTS usuarios_internos (
      id SERIAL PRIMARY KEY,
      nombre_usuario VARCHAR(150),
      apellido_usuario VARCHAR(150),
      email VARCHAR(254) UNIQUE,
      password TEXT,
      nombre VARCHAR(150),
      rol VARCHAR(50) DEFAULT 'user',
      activo BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Empresas
    await query(`CREATE TABLE IF NOT EXISTS empresas (
      id SERIAL PRIMARY KEY,
      id_empresa VARCHAR(100),
      nombre_empresa VARCHAR(250),
      rfc VARCHAR(50),
      id_documento INTEGER,
      id_equipo INTEGER,
      stripe_customer_id VARCHAR(255)
    )`);

    // Agregar columnas si no existen
    await query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS id_equipo INTEGER`).catch(() => {});
    await query(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255)`).catch(() => {});

    // Empleados
    await query(`CREATE TABLE IF NOT EXISTS empleados (
      id SERIAL PRIMARY KEY,
      id_empleado VARCHAR(100),
      nombre_empleado VARCHAR(250),
      empresa_id INTEGER REFERENCES empresas(id) ON DELETE SET NULL
    )`);

    // Documentos
    await query(`CREATE TABLE IF NOT EXISTS documentos (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
      csf VARCHAR(255),
      cd VARCHAR(255),
      rt VARCHAR(255),
      cot VARCHAR(255),
      archivo_responsiva VARCHAR(500)
    )`);

    // Agregar columnas a documentos si no existen
    await query(`ALTER TABLE documentos ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE`).catch(() => {});
    await query(`ALTER TABLE documentos ADD COLUMN IF NOT EXISTS archivo_responsiva VARCHAR(500)`).catch(() => {});

    // Equipos
    await query(`CREATE TABLE IF NOT EXISTS equipos (
      id SERIAL PRIMARY KEY,
      id_equipo INTEGER,
      empleado_id INTEGER REFERENCES empleados(id) ON DELETE SET NULL,
      tipo_equipo VARCHAR(120),
      marca VARCHAR(120),
      modelo VARCHAR(120),
      numero_serie VARCHAR(200),
      sistema_operativo VARCHAR(120),
      procesador VARCHAR(120),
      ram VARCHAR(50),
      disco_duro VARCHAR(100),
      codigo_registro VARCHAR(150)
    )`);

    // Eliminar constraint UNIQUE de id_equipo si existe y cambiar tipo a INTEGER
    await query(`ALTER TABLE equipos DROP CONSTRAINT IF EXISTS equipos_id_equipo_key`).catch(() => {});
    await query(`ALTER TABLE equipos ALTER COLUMN id_equipo TYPE INTEGER USING CAST(id_equipo AS INTEGER)`).catch(() => {});
    
    // Agregar columna status a equipos si no existe
    await query(`ALTER TABLE equipos ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pendiente'`).catch(() => {});

    // Codigo Registro
    await query(`CREATE TABLE IF NOT EXISTS codigo_registro (
      id SERIAL PRIMARY KEY,
      codigo VARCHAR(255),
      equipo_id INTEGER REFERENCES equipos(id) ON DELETE CASCADE,
      licencia_id INTEGER
    )`);

    // Licencia
    await query(`CREATE TABLE IF NOT EXISTS licencia (
      id SERIAL PRIMARY KEY,
      id_registro INTEGER REFERENCES codigo_registro(id) ON DELETE SET NULL,
      detalles TEXT
    )`);

    // Agenda
    await query(`CREATE TABLE IF NOT EXISTS agenda (
      id SERIAL PRIMARY KEY,
      dia_agendado TIMESTAMP,
      status VARCHAR(80),
      usuario_id INTEGER REFERENCES usuarios_internos(id) ON DELETE SET NULL,
      equipo_id INTEGER REFERENCES equipos(id) ON DELETE SET NULL
    )`);

    // Tickets
    await query(`CREATE TABLE IF NOT EXISTS tickets (
      id SERIAL PRIMARY KEY,
      titulo VARCHAR(250),
      descripcion TEXT,
      estado VARCHAR(80),
      prioridad VARCHAR(80),
      usuario_id INTEGER REFERENCES usuarios_internos(id) ON DELETE SET NULL,
      agenda_id INTEGER REFERENCES agenda(id) ON DELETE SET NULL,
      cliente_id INTEGER REFERENCES usuarios_empresas(id) ON DELETE CASCADE,
      empresa_id INTEGER REFERENCES empresas(id) ON DELETE SET NULL,
      asunto VARCHAR(250),
      status VARCHAR(80),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Agregar columnas a tickets si no existen
    await query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS cliente_id INTEGER REFERENCES usuarios_empresas(id) ON DELETE CASCADE`).catch(() => {});
    await query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id) ON DELETE SET NULL`).catch(() => {});
    await query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS asunto VARCHAR(250)`).catch(() => {});
    await query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS status VARCHAR(80)`).catch(() => {});
    await query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`).catch(() => {});

    // Usuarios Empresas (usuarios que pertenecen a una empresa)
    await query(`CREATE TABLE IF NOT EXISTS usuarios_empresas (
      id SERIAL PRIMARY KEY,
      id_usuario VARCHAR(150),
      nombre_usuario VARCHAR(150),
      apellido_usuario VARCHAR(150),
      email VARCHAR(254),
      password TEXT,
      nombre_profile VARCHAR(200),
      empresa_id INTEGER REFERENCES empresas(id) ON DELETE SET NULL
    )`);

    // Agregar columna empresa_id a usuarios_empresas si no existe
    await query(`ALTER TABLE usuarios_empresas ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id) ON DELETE SET NULL`).catch(() => {});

    // Equipment census requests from clients
    await query(`CREATE TABLE IF NOT EXISTS equipment_requests (
      id SERIAL PRIMARY KEY,
      cliente_id INTEGER REFERENCES usuarios_empresas(id) ON DELETE CASCADE,
      empresa_id INTEGER,
      marca VARCHAR(150),
      modelo VARCHAR(150),
      no_serie VARCHAR(200),
      codigo_registro VARCHAR(150),
      memoria_ram VARCHAR(50),
      disco_duro VARCHAR(100),
      serie_disco_duro VARCHAR(200),
      sistema_operativo VARCHAR(120),
      procesador VARCHAR(150),
      nombre_usuario_equipo VARCHAR(150),
      tipo_equipo VARCHAR(120),
      nombre_equipo VARCHAR(150),
      status VARCHAR(50) DEFAULT 'pendiente',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      agendado BOOLEAN DEFAULT false
    )`);

    // add FK from empresas.id_documento to documentos.id if present
    await query(`ALTER TABLE IF EXISTS empresas ADD COLUMN IF NOT EXISTS documento_id INTEGER`);
    await query(`UPDATE empresas SET documento_id = id_documento WHERE FALSE`)
      .catch(() => {});

    // Insert admin user if not exists
    const adminEmail = 'admin@local.test';
    const adminPassword = 'Admin123'; // 8 chars, 1 min, 1 mayus, 1 digito
    const hashed = bcrypt.hashSync(adminPassword, 10);

    const res = await query('SELECT id FROM usuarios_internos WHERE email = $1', [adminEmail]);
    if (res.rows.length === 0) {
      await query('INSERT INTO usuarios_internos (nombre_usuario, apellido_usuario, email, password, rol, activo) VALUES ($1,$2,$3,$4,$5,$6)',
        ['Admin', 'User', adminEmail, hashed, 'admin', true]);
      console.log('Admin user created with email:', adminEmail, 'and password:', adminPassword);
    } else {
      console.log('Admin already exists at', adminEmail);
    }

    // Tickets table
    await query(`CREATE TABLE IF NOT EXISTS tickets (
      id SERIAL PRIMARY KEY,
      cliente_id INTEGER REFERENCES usuarios_empresas(id) ON DELETE CASCADE,
      empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
      asunto VARCHAR(255) NOT NULL,
      descripcion TEXT NOT NULL,
      prioridad VARCHAR(50) DEFAULT 'media',
      status VARCHAR(50) DEFAULT 'abierto',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('Tickets table created or already exists.');

    // Tabla para archivos adjuntos de tickets
    await query(`CREATE TABLE IF NOT EXISTS ticket_archivos (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
      nombre_archivo VARCHAR(255) NOT NULL,
      nombre_original VARCHAR(255) NOT NULL,
      ruta_archivo TEXT NOT NULL,
      tipo_archivo VARCHAR(100),
      tamano_archivo INTEGER,
      subido_por INTEGER REFERENCES usuarios_empresas(id) ON DELETE SET NULL,
      fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('Ticket archivos table created or already exists.');

    // Tabla de pagos/transacciones
    await query(`CREATE TABLE IF NOT EXISTS pagos (
      id SERIAL PRIMARY KEY,
      empresa_id_pago INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
      usuario_id INTEGER REFERENCES usuarios_empresas(id) ON DELETE SET NULL,
      monto DECIMAL(10,2) NOT NULL,
      moneda VARCHAR(10) DEFAULT 'MXN',
      metodo_pago VARCHAR(50),
      referencia_pago VARCHAR(255),
      estado_pago VARCHAR(50) DEFAULT 'pendiente',
      dias_agregados INTEGER NOT NULL,
      fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      fecha_expiracion TIMESTAMP,
      datos_pago JSONB
    )`);
    console.log('Pagos table created or already exists.');

    // Tabla de pagos de servicios (instalación, etc.)
    await query(`CREATE TABLE IF NOT EXISTS pagos_servicios (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
      usuario_id INTEGER REFERENCES usuarios_empresas(id) ON DELETE SET NULL,
      tipo_servicio VARCHAR(100) NOT NULL,
      monto DECIMAL(10,2) NOT NULL,
      moneda VARCHAR(10) DEFAULT 'MXN',
      status VARCHAR(50) DEFAULT 'pendiente',
      metodo_pago VARCHAR(50),
      referencia_pago VARCHAR(255),
      fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      datos_adicionales JSONB
    )`);
    console.log('Pagos_servicios table created or already exists.');

    // Agregar columna equipo_id a agenda si no existe
    await query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='agenda' AND column_name='equipo_id'
        ) THEN
          ALTER TABLE agenda ADD COLUMN equipo_id INTEGER REFERENCES equipos(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    console.log('Added equipo_id column to agenda table if it did not exist.');

    // Eliminar restricción UNIQUE del campo codigo en codigo_registro
    await query(`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'codigo_registro_codigo_key'
        ) THEN
          ALTER TABLE codigo_registro DROP CONSTRAINT codigo_registro_codigo_key;
        END IF;
      END $$;
    `);
    console.log('Removed UNIQUE constraint from codigo field in codigo_registro table if it existed.');

    // Tabla de Precios de Servicios
    await query(`CREATE TABLE IF NOT EXISTS precios_servicios (
      id SERIAL PRIMARY KEY,
      codigo_servicio VARCHAR(100) UNIQUE NOT NULL,
      nombre_servicio VARCHAR(250) NOT NULL,
      descripcion TEXT,
      precio DECIMAL(10,2) NOT NULL,
      moneda VARCHAR(10) DEFAULT 'MXN',
      activo BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('Tabla precios_servicios creada o ya existe.');

    // Insertar precios iniciales de servicios
    await query(`
      INSERT INTO precios_servicios (codigo_servicio, nombre_servicio, descripcion, precio, moneda, activo)
      VALUES 
        ('plan_anual', 'Plan Anual', 'Membresía anual completa con acceso a todas las funciones del sistema', 2999.00, 'MXN', true),
        ('instalacion_asesor', 'Instalación con Asesor', 'Servicio completo de instalación con asesor técnico, incluye configuración personalizada y soporte inicial', 2500.00, 'MXN', true),
        ('instalacion_propia', 'Instalación por mi cuenta', 'Descarga de archivos de instalación, guía paso a paso y soporte por correo electrónico', 500.00, 'MXN', true)
      ON CONFLICT (codigo_servicio) DO UPDATE SET
        nombre_servicio = EXCLUDED.nombre_servicio,
        descripcion = EXCLUDED.descripcion,
        precio = EXCLUDED.precio,
        moneda = EXCLUDED.moneda,
        activo = EXCLUDED.activo,
        updated_at = CURRENT_TIMESTAMP
    `);
    console.log('Precios de servicios insertados o actualizados.');

    console.log('DB initialization finished.');
  } catch (err) {
    console.error('Init DB error', err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

run();
