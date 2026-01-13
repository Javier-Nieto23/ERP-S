const { query } = require('./db');

async function addNombreEquipoColumn() {
  try {
    console.log('🔄 Agregando columna nombre_equipo a la tabla equipos...');
    
    // Agregar columna nombre_equipo
    await query(`
      ALTER TABLE equipos 
      ADD COLUMN IF NOT EXISTS nombre_equipo CHARACTER VARYING(150)
    `);
    
    console.log('✅ Columna nombre_equipo agregada exitosamente');
    
    // Verificar la estructura de la tabla
    const result = await query(`
      SELECT column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'equipos' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Estructura actual de la tabla equipos:');
    result.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error al agregar columna:', err);
    process.exit(1);
  }
}

addNombreEquipoColumn();
