-- Script para eliminar la restricción UNIQUE del campo codigo en codigo_registro
ALTER TABLE codigo_registro DROP CONSTRAINT IF EXISTS codigo_registro_codigo_key;
