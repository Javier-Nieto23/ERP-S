require('dotenv').config();
const { query } = require('./db');

async function addUniqueConstraint() {
  try {
    console.log('🔧 Eliminando registros duplicados en codigo_registro...');
    
    // 1. Primero, eliminar registros duplicados, manteniendo solo el más reciente
    await query(`
      DELETE FROM codigo_registro
      WHERE id NOT IN (
        SELECT MAX(id)
        FROM codigo_registro
        GROUP BY equipo_id
      )
    `);
    
    console.log('✅ Registros duplicados eliminados');
    
    // 2. Agregar restricción UNIQUE al campo equipo_id
    console.log('🔧 Agregando restricción UNIQUE a equipo_id...');
    
    await query(`
      ALTER TABLE codigo_registro
      ADD CONSTRAINT codigo_registro_equipo_id_key UNIQUE (equipo_id);
    `);
    
    console.log('✅ Restricción UNIQUE agregada exitosamente');
    console.log('✅ Ahora cada equipo solo puede tener un registro en codigo_registro');
    
  } catch (err) {
    console.error('❌ Error al agregar restricción UNIQUE:', err);
    console.error(err.message);
  } finally {
    process.exit();
  }
}

addUniqueConstraint();
