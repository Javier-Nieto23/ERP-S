require('dotenv').config();
const { query, pool } = require('./db');

async function fixEquiposTable() {
  try {
    console.log('Conectando a la base de datos...');
    
    // 1. Eliminar constraint UNIQUE
    console.log('1. Eliminando constraint UNIQUE...');
    await query('ALTER TABLE equipos DROP CONSTRAINT IF EXISTS equipos_id_equipo_key');
    console.log('✓ Constraint UNIQUE eliminado');
    
    // 2. Eliminar DEFAULT
    console.log('2. Eliminando DEFAULT...');
    await query('ALTER TABLE equipos ALTER COLUMN id_equipo DROP DEFAULT').catch(() => console.log('No había DEFAULT'));
    console.log('✓ DEFAULT eliminado');
    
    // 3. Cambiar tipo a INTEGER
    console.log('3. Cambiando tipo de dato a INTEGER...');
    await query('ALTER TABLE equipos ALTER COLUMN id_equipo TYPE INTEGER USING CASE WHEN id_equipo ~ \'^[0-9]+$\' THEN CAST(id_equipo AS INTEGER) ELSE NULL END');
    console.log('✓ Tipo cambiado a INTEGER');
    
    // 3.5. Actualizar empresas.id_equipo con su propio ID si es NULL
    console.log('3.5. Actualizando empresas.id_equipo...');
    await query('UPDATE empresas SET id_equipo = id WHERE id_equipo IS NULL');
    const updateResult = await query('SELECT COUNT(*) FROM empresas WHERE id_equipo IS NULL');
    console.log('✓ Empresas actualizadas, NULL restantes:', updateResult.rows[0].count);
    
    // 3.6. Agregar UNIQUE a empresas.id_equipo si no existe
    console.log('3.6. Verificando UNIQUE en empresas.id_equipo...');
    await query('ALTER TABLE empresas DROP CONSTRAINT IF EXISTS empresas_id_equipo_key');
    await query('ALTER TABLE empresas ADD CONSTRAINT empresas_id_equipo_key UNIQUE (id_equipo)');
    console.log('✓ UNIQUE agregado a empresas.id_equipo');
    
    // 4. Agregar FK
    console.log('4. Agregando llave foránea...');
    await query('ALTER TABLE equipos DROP CONSTRAINT IF EXISTS equipos_id_equipo_fkey');
    await query('ALTER TABLE equipos ADD CONSTRAINT equipos_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES empresas(id_equipo)');
    console.log('✓ Llave foránea agregada');
    
    console.log('\n✅ Tabla equipos actualizada correctamente');
    
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

fixEquiposTable();
