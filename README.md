# Descuentos TC — Chile

Web app (Vite + React) para consultar en tiempo real descuentos y promociones de tarjetas de crédito chilenas en restaurantes y otros comercios. Pensada para usarse desde el celular (agrégala a la pantalla de inicio desde Safari/Chrome para que se sienta como app nativa).

## Qué hace

- Viene precargada con 4 tarjetas de ejemplo (Scotiabank, Falabella/CMR, BCI, Santander) y un listado de 14 bancos chilenos para agregar más.
- Puedes agregar y eliminar tarjetas propias — se guardan en el celular (localStorage), no en un servidor.
- Al elegir una tarjeta + categoría (restaurantes, supermercados, retail, etc.) y presionar "Buscar ofertas", la app:
  1. Busca en la web en tiempo real con **Tavily** promociones vigentes para ese banco/tarjeta/categoría.
  2. Usa **Groq (llama-3.3-70b-versatile)** para transformar esos resultados en tarjetas de oferta limpias: comercio, % o monto de descuento, condiciones, vigencia y link a la fuente.

## Cómo desplegar (mismo flujo que AgenteOfertas)

1. Sube esta carpeta a un repo de GitHub.
2. Entra a [vercel.com](https://vercel.com) → **Add New Project** → importa el repo.
3. En **Settings → Environment Variables** agrega:
   - `TAVILY_API_KEY`
   - `GROQ_API_KEY`
   (puedes reutilizar las mismas que ya usas en AgenteOfertas)
4. Deploy. Vercel detecta Vite automáticamente y despliega también `api/search-offers.js` como función serverless.
5. Abre la URL en tu celular → menú del navegador → **"Agregar a pantalla de inicio"**.

## Desarrollo local

```bash
npm install
npm run dev
```

Nota: la función `/api/search-offers` solo corre en el entorno de Vercel (o con `vercel dev`). En `npm run dev` puro (solo Vite) la búsqueda de ofertas no responderá salvo que uses `vercel dev` en su lugar.

## Próximos pasos posibles

- Guardar historial de últimas búsquedas por tarjeta.
- Notificaciones cuando una promoción esté por vencer.
- Filtrar por región/comuna si el banco lo especifica.
- Botón "comparar todas mis tarjetas" para ver qué tarjeta conviene más en una categoría.
- 
