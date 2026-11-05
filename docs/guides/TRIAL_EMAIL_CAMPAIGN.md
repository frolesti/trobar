# troBar: campanya de prova gratuïta i primer cobrament

## Estat i objectiu

**Disseny i textos preparats; enviament no implementat ni activat.**
No s'han enviat correus, canviat preferències de Stripe ni contractat serveis.
Stripe continua en sandbox. Abans d'enviar cal completar els requisits de
la secció «Activació».

### Decisions confirmades el 5 de novembre de 2026

- Renovació **automàtica** en acabar el trial si el titular no cancel·la.
  El recordatori informa de data/import i permet gestionar la subscripció:
  no demana una segona autorització ni condiciona el cobrament a respondre
  el correu.
- La confirmació del web mostra la data de Stripe, però no promet cap
  recordatori mentre no s'hagi habilitat i provat el lliurament.
- L'app encara no té fitxes publicades a les botigues; els correus no han
  d'incloure enllaços genèrics de descàrrega ni botons sense destinació real.

### Correu dedicat a l'aplicació: ordre de posada en marxa

1. **Bústies creades a Google Workspace:** `hola@trobar.cat` per a consultes
   generals i col·laboracions; `suport@trobar.cat` per a incidències, ajuda
   i privacitat; `facturacio@trobar.cat` per a factures, cobraments i
   subscripcions. Són les úniques adreces públiques de troBar.
   La font canònica del web i l'app és
   [contactEmails.json](../../app/src/data/contactEmails.json).
2. **DNS del domini:** verificar propietat i configurar els MX del proveïdor
   per rebre correus. Activar SPF, DKIM i DMARC seguint els valors exactes
   del proveïdor; no crear registres SPF duplicats ni inventar claus DKIM.
3. **Enviaments automàtics:** seleccionar un servei transaccional, per
   exemple Resend, i verificar els emissors existents. Utilitzar
   `facturacio@trobar.cat` com a emissor i `Reply-To` dels recordatoris de
   cobrament i rebuts; `suport@trobar.cat` per a correus de compte i ajuda.
   No introduir altres adreces públiques. Una bústia no activa, per si sola,
   els recordatoris de l'app.
4. **Integració:** guardar credencials al servidor/Secret Manager, mai al
   navegador; preparar plantilles i automatització amb idempotència,
   cancel·lació i dates reals descrites més avall.
5. **Stripe i cancel·lació:** activar el recordatori natiu de 7 dies abans
   només quan toqui operar en live; completar Customer Portal perquè el
   titular pugui cancel·lar sense eliminar el compte. El recordatori propi
   de 24 h requereix el planificador de troBar.
6. **Prova i activació:** verificar lliurament i respostes amb comptes interns.
   Només després anunciar a la UI que s'enviarà un recordatori. Els avisos
   natius de Stripe no s'envien en sandbox.

Punts pendents: la creació de les tres bústies l'ha confirmat el titular;
cal verificar els DNS i provar la recepció i l'enviament real abans de donar
el servei per operatiu. Aquesta actualització no modifica DNS ni configura
emissors a Stripe o Firebase. El formulari web de contacte actual simula l'enviament: no s'ha
d'utilitzar com a canal de cancel·lació o suport operatiu fins a connectar-lo
a un servei real. Els enllaços directes de correu utilitzen les bústies creades.

Objectiu: ajudar el titular a posar el perfil a punt i assegurar que sap
**quan s'acaba la prova, quant pagarà i com pot cancel·lar abans del cobrament**.
Sense urgències artificials, promeses de nous clients ni càrrecs sorpresa.

## Regla de facturació

- L'inici és la creació de la subscripció a Stripe en completar Checkout,
  **no** crear l'usuari Firebase, verificar el correu o guardar l'esborrany.
- La integració actual utilitza `subscription_data.trial_period_days=14`.
  No cal modificar-la per ajornar el primer cobrament.
- La prova dura 14 dies complets. Si l'alta és el «dia 1», el període de
  pagament comença el «dia 15», exactament a `subscription.trial_end`.
- Exemple: alta el **4 de novembre de 2026 a les 22:30**; final de prova i
  inici del període de pagament el **18 de novembre de 2026 a les 22:30**,
  hora de Barcelona. No es factura retroactivament la prova ni s'espera al
  primer dia del mes següent.
- Stripe genera la factura al final de la prova i intenta cobrar després de
  finalitzar-la. L'instant del moviment bancari pot ser posterior: comunicar
  **data prevista**, no garantir una hora de càrrec.
- Plans publicats: mensual **39 EUR/mes**, trimestral **99 EUR/3 mesos**,
  anual **348 EUR/any**. Un anual no es cobra a 29 EUR: això és l'equivalent
  mensual. La data de final del període pagat es llegeix de Stripe, sense
  sumar 30/90/365 dies manualment.
- Els imports dels emails han de reflectir la factura real: impostos,
  descomptes i moneda inclosos quan correspongui. No assumir ni anunciar
  «IVA inclòs» mentre la política fiscal no estigui configurada i aprovada.
- No acabar anticipadament proves existents ni canviar el cicle per activar
  aquesta campanya.

## Calendari recomanat

`T` és el valor actual de `trial_end`, no una data calculada al navegador.
Els dies són orientatius; la planificació treballa amb timestamps.

| Moment | Enviament | Naturalesa | Condició |
|---|---|---|---|
| Inici de prova, dia 1 | La prova ja està activa | Servei | Subscripció `trialing` confirmada |
| 48 h després, aproximadament dia 3 | Posa el perfil a punt | Onboarding opcional | Perfil incomplet i preferències/base legal que permetin aquest missatge |
| T − 7 dies, aproximadament dia 8 | Data i import del primer cobrament | Facturació | Prova vigent, amb renovació prevista |
| T − 24 h, aproximadament dia 14 | Últim recordatori clar | Facturació | Continua en prova i no està cancel·lada ni programada per cancel·lar |
| Després del primer cobrament no nul | Pagament rebut i nou període | Facturació | `invoice.paid`, import pagat > 0 i vinculat al primer període de pagament |
| Si falla el cobrament | Actualitza el mètode de pagament | Facturació | Fallada confirmada; no enviar el rebut d'èxit |

No enviar més missatges per defecte. El `customer.subscription.trial_will_end`
arriba habitualment uns tres dies abans: pot servir com a comprovació i
replanificació. **No afegir un altre correu a T − 3 dies** si ja s'han previst
els de T − 7 i T − 1; evitar saturar el client.

### Qui envia què

- Recomanació inicial: **Stripe envia T − 7 i els rebuts/impagaments**;
  troBar envia l'activació, el recordatori T − 1 i l'onboarding opcional.
- Stripe permet activar recordatoris de prova a Billing → Subscriptions
  and emails. Amb aquests emails habilitats, el recordatori de prova és
  set dies abans. **Stripe no envia aquests recordatoris en sandbox.**
- Si es necessita tota la seqüència amb la plantilla pròpia, troBar ha
  d'assumir tots els avisos i validar els requisits de les xarxes de targetes.
  No apagar l'avís natiu fins que l'alternativa estigui provada.
- Un únic emissor per a cada fita. No duplicar rebut natiu + rebut propi,
  ni recordatori natiu + recordatori propi al mateix moment.

## Disseny visual

Reutilitzar la base existent [template.cjs](../../emails/template.cjs):
capçalera de marca grana/crema, cos blanc, un títol funcional, text breu,
**un únic botó principal**, data/import llegibles i alternativa de text pla.
No copiar el disseny fosc de la web a emails.

En recordatoris, posar la data i l'import abans del botó. La cancel·lació
ha de ser fàcil de trobar, també en text pla. No ocultar-la al peu legal.
Les variables són dades de servidor escapades pel renderitzador.

## Textos proposats

Variables:

- `{nom}`: persona de contacte; salutació sense nom si no consta.
- `{bar}`: nom real del local.
- `{data_final}`: data de `trial_end` en català i zona `Europe/Madrid`.
- `{hora_final}`: hora local amb zona explícita si es mostra un termini.
- `{import_primer}`: import total previst o confirmat, amb moneda.
- `{periodicitat}`: «cada mes», «cada tres mesos» o «cada any».
- `{data_renovacio}`: final del període facturat segons Stripe.
- `{enllac_gestio}`: enllaç segur que autentica i obre un portal de facturació.
- `{enllac_perfil}`: destinació real del perfil del propietari.
- `{enllac_factura}`: factura allotjada de Stripe corresponent al pagament.

**Els enllaços descriuen destinacions necessàries, no rutes ja implementades.**
No escriure un URL de dashboard inventat ni enviar un botó inoperant.

### 1. Activació de la prova

**Assumpte:** {bar}: els teus 14 dies de prova ja han començat

**Precapçalera:** Prova activa fins al {data_final}. Aquí tens els següents passos.

**Títol:** El teu bar ja és a troBar

Hola, {nom}!

La subscripció de **{bar}** ja està confirmada. Tens accés Premium durant
14 dies de prova, fins al **{data_final}, a les {hora_final}**.

Si mantens la subscripció, el primer cobrament previst serà de
**{import_primer}** a partir d'aquesta data. Després es renovarà
**{periodicitat}**.

Comença explicant com es viu el partit al teu bar: les pantalles, l'ambient
i l'horari ajuden els aficionats a decidir on anar.

**Botó:** Completar el perfil del bar → `{enllac_perfil}`

Pots gestionar o cancel·lar la subscripció abans que s'acabi la prova des
de `{enllac_gestio}`. T'avisarem abans del primer cobrament.

### 2. Onboarding opcional i condicional

**Assumpte:** Dona més motius per triar {bar}

**Precapçalera:** Completar el perfil ajuda els aficionats a saber què hi trobaran.

**Títol:** Mostra com es viu el partit al teu bar

Hola, {nom}!

Al perfil de **{bar}** encara hi ha detalls per completar. Explica'n
l'ambient i afegeix la informació que falta sobre les pantalles o l'horari.
Ajuda qui busca un lloc per veure el partit a saber què hi trobarà.

**Botó:** Revisar el perfil → `{enllac_perfil}`

La prova continua fins al **{data_final}**.

Adaptar el missatge als camps realment incomplets; no dir que falten fotos,
pantalles o horari si ja hi són. Respectar preferències de comunicació i
incloure baixa dels missatges opcionals. No barrejar aquesta promoció amb
els avisos imprescindibles de cobrament.

### 3. Recordatori set dies abans

Aquest text és l'alternativa de marca si en el futur substituïm l'avís natiu
de Stripe; **no enviar tots dos**.

**Assumpte:** {bar}: la prova s'acaba el {data_final}

**Precapçalera:** Primer cobrament previst: {import_primer}. Revisa la subscripció.

**Títol:** Encara tens una setmana de prova

Hola, {nom}!

La prova gratuïta de **{bar}** s'acaba el **{data_final}, a les {hora_final}**.
Si no cancel·les abans, començarà el període de pagament i Stripe intentarà
cobrar **{import_primer}** al mètode de pagament desat.

La subscripció es renovarà **{periodicitat}**. Els 14 dies de prova no es
cobraran.

**Botó:** Gestionar la subscripció → `{enllac_gestio}`

Des d'aquest mateix enllaç pots revisar el pla, actualitzar la targeta o
cancel·lar abans de la data indicada per evitar el primer cobrament.

### 4. Recordatori 24 hores abans

**Assumpte:** Demà s'acaba la prova de {bar}

**Precapçalera:** Data prevista: {data_final}. Import: {import_primer}.

**Títol:** La prova s'acaba demà

Hola, {nom}!

Et recordem que la prova de **{bar}** s'acaba el **{data_final}, a les
{hora_final}**. A partir d'aquell moment començarà el període de pagament,
amb un primer cobrament previst de **{import_primer}**.

Si vols continuar, no has de fer res. Si prefereixes cancel·lar, fes-ho
abans d'aquesta data des de la gestió de la subscripció.

**Botó:** Revisar o cancel·lar → `{enllac_gestio}`

Si el job no s'executa 24 hores abans, no enviar un «demà» incorrecte:
utilitzar l'assumpte i títol «La prova s'acaba el {data_final}».

### 5. Primer cobrament confirmat

Utilitzar preferentment el rebut/factura natiu de Stripe. Alternativa pròpia:

**Assumpte:** Pagament rebut: {import_primer} · {bar}

**Precapçalera:** La prova ha acabat i el primer període de pagament està actiu.

**Títol:** Pagament confirmat

Hola, {nom}!

Hem rebut el pagament de **{import_primer}** de la subscripció de **{bar}**.
El període facturat comença després de la prova gratuïta i acaba el
**{data_renovacio}**.

**Botó:** Veure la factura → `{enllac_factura}`

La subscripció es renovarà **{periodicitat}**, tret que la cancel·lis.
Pots gestionar-la des de `{enllac_gestio}`.

No disparar aquest correu amb `checkout.session.completed`, una factura de
0 EUR, `trialing`, `invoice.created` ni només `customer.subscription.updated`.

### 6. Cobrament fallit, només si passa

**Assumpte:** Cal revisar el pagament de {bar}

**Precapçalera:** No hem pogut completar el cobrament. Revisa el mètode de pagament.

**Títol:** El pagament no s'ha completat

Hola, {nom}!

Stripe no ha pogut completar el cobrament de la subscripció de **{bar}**.
Revisa el mètode de pagament i l'estat de la factura.

**Botó:** Revisar el pagament → `{enllac_gestio}`

No afirmem que s'hagi cobrat ni prometem que el servei continua actiu si
l'estat real de la subscripció no ho permet. Els reintents i el calendari
de recuperació han de coincidir amb la configuració de Stripe.

## Activació: requisits abans de cap enviament

1. **Cancel·lació funcional:** habilitar i integrar Customer Portal amb sessions
   generades al servidor i permisos del propietari. Cancel·lar durant el trial
   no ha d'exigir eliminar el compte de troBar. Decidir si conserva accés fins
   a `trial_end`; recomanació: cancel·lació programada amb accés fins al final.
2. **Fiscalitat i facturació:** confirmar impostos, preus finals, política de
   renovació i dades fiscals. Renderitzar sempre import i data de Stripe.
3. **Emissor:** seleccionar proveïdor/SMTP, credencials a Secret Manager,
   domini verificat amb SPF/DKIM/DMARC i adreça de suport monitorada.
4. **Preferències:** separar notificacions de servei de comunicacions opcionals.
   No considerar que acceptar les condicions equival a acceptar màrqueting.
5. **Esdeveniments:** afegir i provar `customer.subscription.trial_will_end` si
   la seqüència pròpia l'utilitza. Encara no està afegit al webhook desplegat.
6. **Planificador:** sincronitzar `trial_end` des del servidor i recalcular els
   avisos si canvia. Abans de cada enviament, rellegir Stripe i propietat.
   Ometre avisos de càrrec si la subscripció està cancel·lada, programada per
   cancel·lar, pausada, o si la prova ha acabat.
7. **Idempotència:** registre privat per
   `accountId:subscriptionId:trial_end:tipusAvis`, reserva atòmica, idempotency
   key del proveïdor si en disposa i reintents acotats amb errors explícits.
   No marcar «enviat» abans que el proveïdor accepti el missatge.
8. **Dades reals:** consultar el pla actual; no utilitzar imports antics de
   metadades ni dades inventades. No enviar correus a trials antics per omplir
   retrospectivament fites ja passades. No afirmar cobrament per avançat.
9. **Proves:** rellotges de prova de Stripe per simular final de trial i
   renovacions; provar canvi de pla, ampliació de trial, cancel·lació,
   targeta fallida, webhooks duplicats, reintents i canvi d'hora a Barcelona.
   El sandbox no envia l'avís natiu: verificar el proveïdor propi amb
   destinataris de prova autoritzats, sense enviar a clients reals.
10. **Activació gradual:** habilitar primer per comptes interns. Revisar
    acceptació/lliurament, rebots, duplicats i enllaços abans d'obrir-la.

## Fonts

- [Stripe: períodes de prova gratuïts](https://docs.stripe.com/billing/subscriptions/trials/free-trials)
- [Stripe: requisits i recordatoris de prova](https://docs.stripe.com/billing/subscriptions/trials/manage-trial-compliance)
- [Stripe: configurar proves a Checkout](https://docs.stripe.com/payments/checkout/free-trials)
- [Stripe: portal de client](https://docs.stripe.com/customer-management)
