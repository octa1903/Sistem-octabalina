# PRODUCT.md — Sistema Octabalina (Baliña Ruedas)

## Register
product

## Product Purpose
POS multi-tienda para una gomería en Mar del Plata, Argentina. Los operadores venden neumáticos, gestionan cuentas corrientes de clientes y cierran cajas, todo desde una tablet o pantalla táctil en el taller. La UI es la herramienta de trabajo diario, no una experiencia de marketing.

## Users

### Operador del POS (cajero / mecánico)
El usuario primario. Jornada completa parado en el taller, manos sucias o engrasadas, guantes de trabajo. Opera la pantalla desde ~70 cm de distancia. Necesita targets táctiles grandes (≥48 px), acciones críticas separadas de acciones destructivas, y cero fricción para las operaciones más frecuentes: buscar neumático, agregar al carrito, cobrar, cerrar.

Perfil técnico bajo. No tolera modales de confirmación innecesarios. Se frustra con cualquier latencia > 300 ms.

### Propietario / Administrador (Octavio)
Segundo usuario. Usa backoffice: reportes, configuración, empleados, descuentos, impuestos, facturas de proveedores. Accede desde escritorio o tablet, fuera del mostrador. Técnicamente competente, quiere control y visibilidad. Revisa analytics al cierre del día.

### Cliente (portal web)
Tercer usuario (acceso limitado). Consulta su cuenta corriente, historial de compras, y puede hacer pedidos online. No opera en el taller.

## Brand
**Nombre:** Baliña Ruedas  
**Tono:** Directo, confiable, sin adornos. No es una startup de Silicon Valley. Es una gomería de barrio que lleva años en el rubro y lo sabe. El lenguaje es español rioplatense (vos, ustedes). Sin anglicismos innecesarios.  
**Color primario:** Ámbar dorado (`#c47b12`) — evoca caucho, trabajo manual, calor. No frío, no corporativo.  
**Acento de éxito:** Verde oscuro (`#2e7d4f`) — para caja abierta, acciones exitosas.  
**Peligro:** Rojo ladrillo (`#c0362a`) — para eliminar, cerrar caja, errores.  

## Anti-References
- SaaS genérico con sidebar azul y tarjetas blancas idénticas.
- Dashboards de fintech con gradientes violeta y métricas flotantes.
- Interfaces pensadas para mouse — nada con hover states críticos.
- Onboarding tipo "wizards" con 5 pasos — el operador ya sabe lo que hace.
- Modal como primera respuesta a cualquier acción.

## Strategic Principles
1. **Velocidad primero.** Cada acción frecuente del POS debe completarse en ≤2 taps.
2. **Sin errores caros.** Separar acciones destructivas (eliminar, refund, cerrar caja) con confirmaciones, pero solo cuando el costo de error es alto.
3. **Legibilidad en taller.** Font base 19px, contraste alto, sin textos <12px en flows críticos.
4. **Consistencia sobre creatividad.** Usar las primitivas del sistema antes que inventar nuevos patterns.
5. **Sin decoración gratuita.** Cada elemento visual gana su lugar. Sin sombras ni gradientes decorativos.
