const { query } = require('./db');

async function fixStatus() {
  try {
    console.log('Agregando valor por defecto a columna status...');
    await query(`ALTER TABLE equipos ALTER COLUMN status SET DEFAULT 'pendiente'`);
    console.log('✓ Valor por defecto agregado');

    console.log('Actualizando registros con status NULL...');
    const result = await query(`UPDATE equipos SET status = 'pendiente' WHERE status IS NULL`);
    console.log(`✓ ${result.rowCount} registros actualizados`);

    console.log('\n✓ Migración completada exitosamente');
    process.exit(0);
  } catch (err) {
    console.error('Error en migración:', err);
    process.exit(1);
  }
}

fixStatus();
