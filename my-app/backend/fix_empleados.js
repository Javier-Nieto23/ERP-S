require('dotenv').config();
const { query, pool } = require('./db');

async function fixEmpleadosTable() {
  try {
    console.log('Conectando a la base de datos...');
    
    // 1. Eliminar la columna id_empleado
    console.log('1. Eliminando columna id_empleado...');
    await query('ALTER TABLE empleados DROP COLUMN IF EXISTS id_empleado');
    console.log('✓ Columna id_empleado eliminada');
    
    // 2. Crear la columna nuevamente como INTEGER
    console.log('2. Creando columna id_empleado como INTEGER...');
    await query('ALTER TABLE empleados ADD COLUMN id_empleado INTEGER');
    console.log('✓ Columna id_empleado creada como INTEGER');
    
    // 3. Actualizar id_empleado con valores secuenciales basados en empresa_id
    console.log('3. Actualizando valores de id_empleado...');
    await query(`
      UPDATE empleados 
      SET id_empleado = subquery.row_num 
      FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY empresa_id ORDER BY id) as row_num 
        FROM empleados
      ) AS subquery 
      WHERE empleados.id = subquery.id
    `);
    console.log('✓ Valores actualizados');
    
    console.log('\n✅ Tabla empleados actualizada correctamente');
    
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

fixEmpleadosTable();
