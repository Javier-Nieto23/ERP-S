const { query, pool } = require('./db');

async function removeConstraint() {
  try {
    console.log('Eliminando restricción UNIQUE del campo codigo...');
    
    await query(`
      ALTER TABLE codigo_registro DROP CONSTRAINT IF EXISTS codigo_registro_codigo_key;
    `);
    
    console.log('✅ Restricción eliminada exitosamente');
    
  } catch (err) {
    console.error('❌ Error al eliminar restricción:', err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

removeConstraint();
