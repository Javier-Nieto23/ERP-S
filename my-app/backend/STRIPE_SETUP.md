# Configuración de Stripe

## Paso 1: Crear cuenta en Stripe

1. Ve a https://dashboard.stripe.com/register
2. Crea una cuenta (puedes usar modo TEST sin tarjeta de crédito)
3. Verifica tu email

## Paso 2: Obtener claves API

1. Ve a https://dashboard.stripe.com/test/apikeys
2. Copia las claves:
   - **Clave publicable (Publishable key)**: Empieza con `pk_test_...`
   - **Clave secreta (Secret key)**: Empieza con `sk_test_...`

## Paso 3: Configurar el proyecto

1. Abre el archivo `.env` en la carpeta `backend/`
2. Reemplaza estas líneas con tus claves:

```env
STRIPE_SECRET_KEY=sk_test_TU_CLAVE_SECRETA_AQUI
STRIPE_PUBLISHABLE_KEY=pk_test_TU_CLAVE_PUBLICA_AQUI
```

## Paso 4: Configurar Webhooks (Opcional para desarrollo)

Los webhooks permiten que Stripe notifique a tu servidor cuando un pago se completa.

### Opción A: Usar Stripe CLI (Recomendado para desarrollo local)

1. Instala Stripe CLI: https://stripe.com/docs/stripe-cli
2. Ejecuta: `stripe login`
3. Ejecuta: `stripe listen --forward-to localhost:3000/pagos/webhook`
4. Copia el webhook secret que aparece (empieza con `whsec_...`)
5. Agrégalo al `.env`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_TU_WEBHOOK_SECRET_AQUI
   ```

### Opción B: Webhook en producción

1. Ve a https://dashboard.stripe.com/test/webhooks
2. Click en "+ Agregar endpoint"
3. URL del endpoint: `https://tu-dominio.com/pagos/webhook`
4. Selecciona evento: `checkout.session.completed`
5. Copia el "Signing secret" y agrégalo al `.env`

## Paso 5: Probar el sistema

1. Reinicia el backend: `npm run dev`
2. Abre el frontend y ve a "Mi Perfil"
3. Click en "Renovar / Extender Suscripción"
4. Selecciona un plan
5. Serás redirigido a Stripe Checkout

### Tarjetas de prueba de Stripe:

- **Éxito**: `4242 4242 4242 4242`
- **Fallo**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0027 6000 3184`

- Usa cualquier fecha futura (ej: 12/34)
- Cualquier CVC de 3 dígitos (ej: 123)
- Cualquier código postal

## Notas importantes

- Las claves con `test` son para desarrollo y NO cobran dinero real
- Para producción, usa las claves que empiezan con `pk_live_` y `sk_live_`
- Nunca compartas tu clave secreta (`sk_`) públicamente
- El webhook secret es necesario para verificar que las notificaciones vienen de Stripe

## Soporte

Documentación oficial: https://stripe.com/docs
