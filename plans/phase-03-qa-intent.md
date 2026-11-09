# Preguntas relacionadas y brief del ponente

## Probar la demo desde dos teléfonos

Abrir `/?room=prueba` en dos teléfonos y `/speaker?room=prueba` en una tercera pantalla, todos contra el mismo servidor. Cambiar el código de seis letras o dígitos en los tres enlaces para empezar otro ensayo. Desde cada teléfono abrir **Q&A → Ask a question**. En el primero usar **Use sample question → Check captions → I want to know too**. En el segundo usar **Use sample follow-up → Check captions → Add as follow-up**. En la consola abrir **Speaker brief** en la pregunta de reconexión.

Para servirlo en la red local desde una copia de la rama, ejecutar `uv run --env-file ../.env uvicorn roompass.api:app --host 127.0.0.1 --port 8000` en `backend/`. Desde `web/` ejecutar primero `pnpm build` y luego `pnpm preview --host 0.0.0.0`. Los teléfonos usan la dirección Network que imprime Vite. La consola de preguntas funciona sin iniciar el micrófono.

Los apoyos y las ampliaciones se guardan en SQLite en el servidor de demo de una réplica. Para elegir el archivo usar `ROOMPASS_DEMO_DB`. Con `ES_URL` y `ES_API_KEY` configurados, `uv run --env-file ../.env python -m roompass.qa_search` desde `backend/` prepara dos pasajes bilingües en el índice dedicado `roompass-demo-qa-v1`. La demo utiliza búsqueda léxica con esos pasajes y coincidencias de vocabulario entre preguntas de la sala. El buscador semántico para charlas completas y los documentos del ponente quedan para la integración con el servicio de charlas. Sin Elasticsearch se usan las referencias del replay.

Para probar la sugerencia opcional, configurar `ROOMPASS_QA_DECISIONS=1` y `OPENAI_API_KEY` en el entorno privado del backend. Al comprobar una pregunta con candidata, el servidor consulta la [Decisions API](https://developers.openai.com/api/docs/guides/decisions) con `gpt-6-luna`, conserva resultados repetidos en caché y limita la sesión del servidor a 30 consultas externas. La persona confirma cada publicación. El brief combina el texto, la cita y la ampliación más apoyada incluso si falla el modelo.

Propuesta de ampliación de la fase 03. La unidad que se ordena en la cola es una pregunta principal con sus ampliaciones confirmadas. Cada asistente conserva la opción de publicar una pregunta independiente. La primera entrega prueba el flujo en un mismo idioma para las relaciones entre preguntas. La búsqueda de subtítulos mantiene el cruce ES/EN del brief.

## Qué ocurre al enviar una pregunta

1. RoomPass busca evidencia en los pasajes ya emitidos de esa charla. Muestra la cita, el minuto y la puntuación cuando se cumple el criterio de «posiblemente cubierto». En una entrega posterior también podrá mostrar material que el ponente haya compartido con la sala, citando el documento y la página o diapositiva.
2. Si la persona elige «Esto me responde», termina ahí. Si quiere preguntar, puede enviar el texto original o precisar qué quiere que el ponente explique. La búsqueda de preguntas relacionadas usa ese texto final y solo consulta preguntas visibles de la misma charla.
3. Elasticsearch propone candidatas por palabras y significado. El servidor aplica umbrales calibrados con ejemplos de la sala. La decisión de adherirse, ampliar o publicar por separado corresponde al asistente. Si falla la búsqueda, la publicación independiente sigue disponible.

| Lo que encuentra el asistente | Decisión en el teléfono | Resultado en la cola |
|---|---|---|
| La pregunta existente pide la misma respuesta, aunque use otras palabras | «También quiero saberlo» o «Publicar por separado» | La adhesión suma apoyo a la principal y conserva la nueva formulación entre sus aportes. |
| Comparten la situación y el nuevo texto pide un detalle adicional | «Añadir como ampliación» o «Publicar por separado» | La ampliación conserva su texto e idioma, queda visible debajo de la principal y se puede apoyar directamente. |
| La relación es débil o ambigua | Se ofrece «Publicar por separado». Si una candidata visible le sirve, la persona puede abrirla, indicar qué quiere ampliar y confirmar el vínculo. | Solo la confirmación incorpora el aporte al grupo. Una pregunta independiente puede competir desde su primer apoyo. |
| No aparece una candidata útil | «Publicar pregunta» | Se crea una principal nueva. |

La similitud sirve para recuperar candidatas. Para distinguir repetición de ampliación, la interfaz muestra la pregunta original y plantea «¿Te serviría la misma respuesta o quieres que explique algo más?». Dos preguntas sobre reconexión pueden necesitar respuestas distintas, por ejemplo cuánto historial se recupera y cuántos datos móviles consume la descarga. Las palabras compartidas por sí solas no justifican unirlas.

## Cómo se ordena la cola

Ordenar las preguntas abiertas por **sesiones anónimas distintas de la charla que apoyan cada grupo**. Cuentan el autor de la principal, quien confirma que tiene la misma duda, quien añade una ampliación y quien vota la principal o cualquiera de sus ampliaciones. Una sesión cuenta una sola vez por grupo aunque participe de varias maneras. Leer una cita, recibir una sugerencia o cerrar un borrador aporta cero. La cookie firmada prevista por RoomPass permite medir sesiones por dispositivo, una aproximación al número de personas.

Dentro del grupo, ordenar las ampliaciones por apoyos únicos propios para que el ponente vea qué detalle interesa más. En ambos niveles, desempatar por antigüedad. Mostrar junto a la pregunta principal el total de apoyos y, aparte, el número de ampliaciones. Si el ponente marca la principal como respondida, las ampliaciones abiertas siguen visibles y el grupo compite con los apoyos de esas dudas pendientes. Una nueva coincidencia en la transcripción puede actualizar la evidencia mientras la pregunta espera turno.

## Qué lee el ponente

Una tarjeta por grupo presenta la pregunta principal, los apoyos, la evidencia recuperada y la ampliación pendiente más apoyada. El ponente puede abrir las formulaciones originales. En la primera entrega, una plantilla arma la tarjeta con el texto de la pregunta, la cita literal y el texto de la ampliación. Se puede ensayar así el flujo completo.

| Campo | Ejemplo ilustrativo |
|---|---|
| El público pregunta | ¿Se recuperan los subtítulos si pierdo la conexión? · 3 apoyos |
| Evidencia disponible | Mostrar aquí la línea exacta que explica la recuperación, con el minuto de la charla. |
| Piden profundizar en | «¿Cuánto historial recupero si vuelvo veinte minutos después?» |

Cuando no haya una fuente suficiente, mostrar «Sin referencia encontrada» y presentar la duda al ponente. En una entrega posterior, un modelo rápido podrá condensar varias ampliaciones en una frase y redactar el brief con referencias. Cada afirmación sobre lo explicado debe citar un pasaje o una página disponibles para esa sala. El servidor valida las referencias y vuelve a la plantilla si faltan o si el modelo tarda o falla. El modelo se limita a redactar, según las [reglas de IA](../.claude/rules/ai.md).

## Checklist de implementación

- [ ] **Base compartida.** Completar el flujo de fase 03 con la API de preguntas, la sesión anónima firmada, los votos compartidos y la búsqueda de pasajes en Elasticsearch. Verificar que un teléfono puede publicar y otro ver la pregunta. El prototipo local con datos del navegador permite diseñar las pantallas.
- [ ] **Relaciones y apoyos.** Acordar con el equipo la extensión del contrato de pregunta y del evento de actualización. Persistir el vínculo con la principal, el tipo de aporte y el apoyo ligado a la sesión y la charla. Admitir las preguntas anteriores como principales. Registrar la contribución y su apoyo de forma idempotente, también ante reintentos o envíos simultáneos. Publicar el recuento confirmado para que teléfonos y consola muestren el mismo orden.
- [ ] **Búsqueda y elección.** Consultar el índice de preguntas por charla y probar por separado paráfrasis, detalles complementarios y casos que solo comparten tema. Calibrar la sugerencia de relación independientemente del umbral usado para citar subtítulos. Comprobar que se puede publicar una pregunta débilmente relacionada con un toque.
- [ ] **Consola y demo.** Mostrar los apoyos, las ampliaciones y el brief con cita. Ensayar dos apoyos desde dispositivos distintos y un voto repetido desde el mismo. Verificar el cambio de orden en el ponente y la lectura a 375 px.
- [ ] **Ampliación posterior.** Incorporar documentos compartidos por el ponente, el brief redactado por modelo y las sugerencias entre preguntas EN/ES. La fusión EN/ES figura como futura en el [brief vigente](../brief/brief.md). Antes de activarla, evaluar ejemplos bilingües donde un cambio de idioma o un matiz técnico alteren la intención.

## Qué mostrar en el minuto de Q&A

Preparar una charla con un pasaje de reconexión y dos preguntas abiertas en español. «¿Cómo se mide el retraso?» tiene dos apoyos y llegó primero. «¿Se recuperan los subtítulos si pierdo la conexión?» tiene uno. Los recuentos iniciales pertenecen a sesiones de demostración precargadas.

| Tiempo | Acción visible | Resultado esperado |
|---|---|---|
| 0–20 s | Desde un teléfono, escribir «Si se corta mi conexión, ¿puedo recuperar los subtítulos?». Abrir la cita inglesa y continuar con la pregunta. | Se ve el minuto y la línea del ponente. El asistente reconoce la pregunta existente y pulsa «También quiero saberlo». Reconexión pasa de uno a dos apoyos y queda segunda por antigüedad. |
| 20–40 s | Desde otro teléfono, preguntar «¿Cuánto historial recupero si vuelvo veinte minutos después?» y confirmar «Añadir como ampliación». | Reconexión sube a tres apoyos y pasa al primer lugar. En la cola se puede leer el detalle nuevo. |
| 40–60 s | Abrir la primera tarjeta en la consola. | El ponente ve la pregunta, la cita sobre recuperación y la duración pendiente. Puede responder directamente a la duda sobre los veinte minutos. |

Fuera del minuto de demo, verificar el caso débil con «¿Cuántos datos móviles consume la descarga?». Debe poder quedar como pregunta independiente y recibir sus propios votos. Si la ampliación de fase 03 todavía no funciona entre dispositivos, mostrar el recorrido base del [plan general](00-general.md) y presentar la agrupación como trabajo pendiente.
