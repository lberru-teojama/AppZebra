let tabsHabilitados = false;


let ultimoPacking = [];
let seleccionPacking = new Set();
// Guarda el código escaneado por separado del input: así, aunque el usuario toque la tabla
// (pierde el foco/selección de txtCodigoPacking) o escanee uno nuevo, enviaImprimir() sigue
// usando el código con el que realmente se hizo la búsqueda, no lo que quede en el campo.
let codigoPackingEscaneado = "";

// Android 12+ (API 31+) exige el permiso BLUETOOTH_CONNECT/BLUETOOTH_SCAN en tiempo de ejecución;
// declararlo en el manifest no basta. cordova-plugin-bluetooth-serial no lo solicita, así que lo
// pedimos aquí con cordova.plugins.diagnostic (ya instalado) antes de usar bluetoothSerial.
function conPermisoBluetooth(accion, alFallar) {
    const diagnosticoBluetooth = typeof cordova !== "undefined" && cordova.plugins && cordova.plugins.diagnostic && cordova.plugins.diagnostic.bluetooth;
    if (diagnosticoBluetooth && diagnosticoBluetooth.requestBluetoothAuthorization) {
        diagnosticoBluetooth.requestBluetoothAuthorization(accion, function (error) {
            if (alFallar) {
                alFallar(error);
            } else {
                alert("Se requiere permiso de Bluetooth para continuar: " + error);
            }
        }, ["BLUETOOTH_CONNECT", "BLUETOOTH_SCAN"]);
    } else {
        accion();
    }
}

function mostrarTab(nombre, boton){

if ((nombre === "packing" || nombre === "pendientes") && !tabsHabilitados) {
        return;
    }

    document.querySelectorAll(".tab-content").forEach(t => {
        t.classList.remove("active");
    });

    document.querySelectorAll(".tab").forEach(t => {
        t.classList.remove("active");
    });

    document.getElementById(nombre).classList.add("active");
    boton.classList.add("active");

    if (nombre === "facturas") {
        const txtFactura = document.getElementById("txtFactura");
        if (txtFactura) {
            txtFactura.focus();
            txtFactura.select();
        }
    }

    if (nombre === "packing") {
        limpiarPacking();
    }

    if (nombre === "pendientes") {
        const factura = document.getElementById("lblFacturaPacking").textContent.trim();
        document.getElementById("lblFacturaPendientes").textContent = factura;
    }

}

function limpiarPacking() {
    ultimoPacking = [];
    seleccionPacking = new Set();
    codigoPackingEscaneado = "";

    const resultadoPacking = document.getElementById("resultadoPacking");
    if (resultadoPacking) {
        resultadoPacking.innerHTML = "";
    }

    const txtCodigoPacking = document.getElementById("txtCodigoPacking");
    if (txtCodigoPacking) {
        txtCodigoPacking.value = "";
        txtCodigoPacking.focus();
    }
}

function irPacking(factura) {

    //alert("Entrando a Packing:");

    document.getElementById("tabPacking").classList.remove("disabled");
    document.getElementById("tabPendientes").classList.remove("disabled");

    document.getElementById("lblFacturaPacking").textContent = factura;
    //document.getElementById("txtFacturaPacking").value = factura;

    //alert("Entrando a Packing:" + factura);

    // Habilita las demás pestañas
    tabsHabilitados = true;

    mostrarTab(
        "packing",
        document.getElementById("tabPacking")
    );


}

async function actualizaPacking(factura, pedido, nroParte, secuencia) {

const linea = factura + "|" + pedido + "|" + nroParte + "|" + secuencia;    

try {
    await fetch("http://javaserver.teojama.com:8080/FacturaApp/api/factura/actualizapacking", {
        method: "POST",
        headers: {
            "Content-Type": "text/plain"
        },
        body: linea
    });

    //console.log("Solicitud enviada.");
} catch (error) {
    console.error("Error al enviar la solicitud:", error);
}

}


async function enviaImprimir(){
    if (!ultimoPacking.length) {
        alert("Primero consulte un código de packing con datos.");
        return;
    }

    if (typeof bluetoothSerial === "undefined") {
        alert("Bluetooth no está disponible. Abra la aplicación instalada en el dispositivo.");
        return;
    }

    const mac = localStorage.getItem("printer.mac") || "";
    if (!mac) {
        alert("Primero seleccione una impresora en la pantalla principal.");
        return;
    }

    const factura = document.getElementById("lblFacturaPacking").textContent.trim();
    const codigoEscaneado = codigoPackingEscaneado;

    // Con un solo registro se imprime directo; con 2 o más, solo se imprimen los seleccionados en la tabla.
    const filasAImprimir = ultimoPacking.length > 1
        ? ultimoPacking.filter((_, indice) => seleccionPacking.has(indice))
        : ultimoPacking;

    if (ultimoPacking.length > 1 && !filasAImprimir.length) {
        alert("Seleccione al menos un registro de la tabla para imprimir.");
        return;
    }

    const etiquetas = [];
    for (const item of filasAImprimir) {
        const pedido = valorCampo(item, ["pedido", "Pedido", "PEDIDO"]);
        const nroParte = valorCampo(item, ["nroparte", "nroParte", "NroParte", "NROPARTE"]);
        const ubicacion = valorCampo(item, ["ubicacion", "Ubicacion", "UBICACION"]);
        const cantidad = valorCampo(item, ["cantidad", "Cantidad", "CANTIDAD"]);
        const destino = valorCampo(item, ["destino", "Destino", "DESTINO"]);
        const descripcion = valorCampo(item, ["descripcion", "Descripcion", "DESCRIPCION"]);
        const secuencia = valorCampo(item, ["secuencia", "Secuencia", "SECUENCIA"]);
        const estado = valorCampo(item, ["estado", "Estado", "ESTADO"]);

        //alert("La secuencia es: " + secuencia);

        const codigo = nroParte || codigoEscaneado;

        if (!codigo) {
            console.warn("Se omite un registro del packing sin número de parte:", item);
            continue;
        }

        await actualizaPacking(factura, pedido, nroParte,secuencia);

        // Cambie solo esta línea según el lenguaje configurado en su impresora:
        //etiquetas.push(construirEtiquetaCpclPacking(pedido, nroParte, ubicacion, cantidad, codigo, destino));
        etiquetas.push(construirEtiquetaZplPacking(pedido, nroParte, ubicacion, cantidad, codigo, destino,descripcion));
    }

    if (!etiquetas.length) {
        alert("El packing no contiene un número de parte para imprimir.");
        return;
    }

    const boton = document.querySelector("button[onclick='enviaImprimir()']");
    if (boton) { boton.disabled = true; }

    conPermisoBluetooth(function () {
        // Reconectar (connect/disconnect) en cada impresión hace que la ZQ521 vuelva a verificar
        // la posición del sensor de gap y bote etiquetas en blanco de más. Por eso se reutiliza la
        // conexión si ya está abierta, y solo se conecta de cero cuando realmente no lo está.
        bluetoothSerial.isConnected(function () {
            imprimirEtiquetasPendientes(etiquetas.slice());
        }, function () {
            bluetoothSerial.connect(mac, function () {
                imprimirEtiquetasPendientes(etiquetas.slice());
            }, function (error) {
                liberar();
                alert("No se pudo conectar con la impresora: " + error);
            });
        });
    }, function (error) {
        liberar();
        alert("No se pudo conectar con la impresora: permiso de Bluetooth denegado (" + error + ")");
    });

    function imprimirEtiquetasPendientes(cola) {
        if (!cola.length) {
            liberar();
            return;
        }

        bluetoothSerial.write(cola.shift(), function () {
            imprimirEtiquetasPendientes(cola);
        }, function (error) {
            liberar();
            desconectarImpresora();
            alert("No se pudo enviar la etiqueta: " + error);
        });
    }

    function liberar() {
        if (boton) { boton.disabled = false; }

        const txtCodigoPacking = document.getElementById("txtCodigoPacking");
        if (txtCodigoPacking) { txtCodigoPacking.focus(); }
    }
}


function configurarImpresoraPacking() {
    if (typeof bluetoothSerial === "undefined") {
        alert("Bluetooth no está disponible. Abra la aplicación instalada en el dispositivo.");
        return;
    }

    const mac = localStorage.getItem("printer.mac") || "";
    if (!mac) {
        alert("Primero seleccione una impresora.");
        return;
    }

    // "media.sense_mode" obliga a la impresora a recalibrar el sensor de gap (bota etiquetas en
    // blanco) cada vez que se envía. Solo hace falta una vez por rollo de etiquetas, así que si ya
    // se configuró antes se confirma para no desperdiciar etiquetas sin querer.
    if (localStorage.getItem("printer.configurada") === "1") {
        const continuar = confirm("Esta impresora ya fue configurada antes. Volver a hacerlo recalibra el sensor y bota etiquetas en blanco. ¿Continuar?");
        if (!continuar) return;
    }

    if (!confirm('Antes de continuar: verifique que hay al menos 3 etiquetas completas cargadas pasando el cabezal. Si no hay suficiente papel, la calibración queda a medias y el largo de etiqueta guardado sigue mal. ¿Ya hay suficiente papel cargado?')) {
        return;
    }

    // "~JC" es el comando nativo de ZPL para calibrar (más confiable que el "do" de SGD): fuerza
    // a la impresora a re-aprender el largo real de la etiqueta contra el sensor de gap.
    const comandos = '! U1 setvar "media.type" "label"\r\n' +
        '! U1 setvar "media.sense_mode" "gap"\r\n' +
        '! U1 setvar "media.printmode" "tear-off"\r\n' +
        '! U1 setvar "device.languages" "zpl"\r\n' +
        '! U1 setvar "ezpl.label_length" "400"\r\n' +
        '~JC\r\n';

    const boton = document.querySelector("button[onclick='configurarImpresoraPacking()']");
    if (boton) { boton.disabled = true; }

    conPermisoBluetooth(function () {
        bluetoothSerial.connect(mac, function () {
            bluetoothSerial.write(comandos, function () {
                setTimeout(function () {
                    bluetoothSerial.disconnect(liberar, liberar);
                    localStorage.setItem("printer.configurada", "1");
                    alert("Impresora configurada en modo ZPL para etiquetas con gap. Va a botar varias etiquetas en blanco mientras calibra el sensor: déjela terminar sin apagarla ni quitarle el rollo. Después imprima el reporte de configuración (~WC) y confirme que \"LABEL LENGTH\" quedó cerca de 400, no en 2030.");
                }, 6000);
            }, function (error) {
                liberar();
                desconectarImpresora();
                alert("No se pudo enviar la configuración: " + error);
            });
        }, function (error) {
            liberar();
            alert("No se pudo conectar con la impresora: " + error);
        });
    }, function (error) {
        liberar();
        alert("No se pudo conectar con la impresora: permiso de Bluetooth denegado (" + error + ")");
    });

    function liberar() {
        if (boton) { boton.disabled = false; }
    }
}

function buscarImpresorasPacking() {
    if (typeof bluetoothSerial === "undefined") {
        alert("Bluetooth no está disponible. Abra la aplicación instalada en el dispositivo.");
        return;
    }

    const lista = document.getElementById("listaImpresorasPacking");
    lista.textContent = "Buscando impresoras emparejadas...";

    conPermisoBluetooth(function () {
        bluetoothSerial.list(function (dispositivos) {
            mostrarImpresorasPacking(dispositivos || []);
        }, function (error) {
            lista.textContent = "No se pudieron listar las impresoras: " + error;
        });
    }, function (error) {
        lista.textContent = "No se pudieron listar las impresoras: permiso de Bluetooth denegado (" + error + ")";
    });
}

function mostrarImpresorasPacking(dispositivos) {
    const lista = document.getElementById("listaImpresorasPacking");
    lista.innerHTML = "";

    if (!dispositivos.length) {
        lista.textContent = "No hay dispositivos emparejados. Empareje la impresora desde los ajustes Bluetooth de Android.";
        return;
    }

    dispositivos.forEach(function (dispositivo) {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "impresora-item";

        const nombre = document.createElement("strong");
        nombre.textContent = dispositivo.name || "Dispositivo sin nombre";
        const mac = document.createElement("small");
        mac.textContent = dispositivo.id;
        boton.appendChild(nombre);
        boton.appendChild(mac);

        boton.addEventListener("click", function () {
            localStorage.setItem("printer.mac", dispositivo.id);
            localStorage.setItem("printer.name", dispositivo.name || dispositivo.id);
            actualizarImpresoraPacking();
            lista.innerHTML = "";
            alert("Impresora seleccionada: " + (dispositivo.name || dispositivo.id));
        });

        lista.appendChild(boton);
    });
}

function actualizarImpresoraPacking() {
    
    const mac = localStorage.getItem("printer.mac") || "";
    const nombre = localStorage.getItem("printer.name") || mac || "Ninguna";
    document.getElementById("nombreImpresoraPacking").textContent = nombre;

    const botonConfig = document.getElementById("btnConfigImpresora");
    if (botonConfig) {
        botonConfig.classList.toggle("seleccionada", !!mac);
    }
}

function toggleConfigImpresora() {
    const panel = document.getElementById("panelImpresora");
    if (!panel) return;
    panel.hidden = !panel.hidden;
}

function datosEtiquetaPacking(pedido, nroParte, ubicacion, cantidad, codigo, destino, descripcion) {
    const limpiar = valor => String(valor || "").replace(/[\^~\r\n]/g, " ").trim();

    return {
        pedido: limpiar("Pedido: " + pedido),
        parte: limpiar(nroParte),
        detalle: limpiar("Ubic: " + ubicacion),
        cantidad: limpiar("Cant: " + cantidad),
        sucursal: limpiar("Sucursal: " + destino),
        codigo: limpiar(codigo),
        descripcion: limpiar(descripcion),
        factura: limpiar("Fac.: " + document.getElementById("lblFacturaPacking").textContent.trim())
    };
}

// Etiqueta física: 5 cm de largo (avance de papel) x 10 cm de ancho.
// A 203dpi/8 dots/mm: largo 50mm*8=400 dots, ancho 100mm*8=800 dots.
const LARGO_ETIQUETA_DOTS = 400;
const ANCHO_ETIQUETA_DOTS = 800;

function construirEtiquetaZplPacking(pedido, nroParte, ubicacion, cantidad, codigo, destino,descripcion) {

    const datos = datosEtiquetaPacking(pedido, nroParte, ubicacion, cantidad, codigo, destino,descripcion);

    return "^XA" +
       "^PW" + ANCHO_ETIQUETA_DOTS +
       "^LL" + LARGO_ETIQUETA_DOTS +
       "^LH0,0" +
       "^FO40,15^A0N,40,40^FD" + datos.pedido + "^FS" +
       "^FO550,15^A0N,40,30^FD" + datos.sucursal + "^FS" +
       "^FO40,75^A0N,35,30^FD" + datos.detalle + "^FS" +
       "^FO550,75^A0N,40,40^FD" + datos.cantidad + "^FS" +
       "^FO40,130^A0N,30,30^FD" + datos.descripcion + "^FS" +
       "^FO550,130^A0N,30,30^FD" + datos.factura + "^FS" +
       "^FO150,200^BY3" +
       "^BCN,100,N,N,N" +
       "^FD" + datos.codigo + "^FS" +
       "^FO260,330^A0N,35,35^FD" + datos.parte + "^FS" +
       
       "^XZ";

    //return    "^XA" +
    //          "^FO50,50^A0N,40,40^FDHola ZPL^FS" +
    //          "^XZ";
}

function construirEtiquetaCpclPacking(pedido, nroParte, ubicacion, cantidad, codigo, destino) {
    const datos = datosEtiquetaPacking(pedido, nroParte, ubicacion, cantidad, codigo, destino);

    return "! 0 200 200 " + LARGO_ETIQUETA_DOTS + " 1\r\n" +
        "TEXT 4 0 40 40 " + datos.pedido + "\r\n" +
        "TEXT 3 0 500 40 " + datos.sucursal + "\r\n" +
        "TEXT 3 0 40 100 " + datos.detalle + "\r\n" +
        "TEXT 4 0 500 100 " + datos.cantidad + "\r\n" +
        "BARCODE 128 3 1 140 150 160 " + datos.codigo + "\r\n" +
        "TEXT 4 0 260 330 " + datos.parte + "\r\n" +
        "FORM\r\n" +
        "PRINT\r\n";
}

function desconectarImpresora() {
    try {
        bluetoothSerial.disconnect(function () {}, function () {});
    } catch (error) {
        console.warn("No se pudo desconectar la impresora:", error);
    }
}

actualizarImpresoraPacking();

// El lector de código de barras escribe el código y luego envía un Enter automáticamente;
// se aprovecha ese Enter para disparar la búsqueda sin necesidad de tocar el botón.
function activarBusquedaAlPresionarEnter(idInput, buscar) {
    const input = document.getElementById(idInput);
    if (!input) return;

    input.addEventListener("keydown", function (evento) {
        if (evento.key === "Enter") {
            evento.preventDefault();
            buscar();
        }
    });
}

activarBusquedaAlPresionarEnter("txtCodigoPacking", buscarPacking);

// Convierte a mayúsculas lo que se escribe a mano (el lector de código de barras ya manda
// mayúsculas, esto es para cuando el usuario escribe el número de parte manualmente).
function activarMayusculas(idInput) {
    const input = document.getElementById(idInput);
    if (!input) return;

    input.addEventListener("input", function () {
        const inicio = input.selectionStart;
        const fin = input.selectionEnd;
        input.value = input.value.toUpperCase();
        input.setSelectionRange(inicio, fin);
    });
}

activarMayusculas("txtCodigoPacking");


async function buscarPendientes(){

    
    const factura = document.getElementById("lblFacturaPendientes").textContent.trim();

    if (!factura) {
        alert("Seleccione primero una factura.");
        return;
    }

    try {






        const response = await fetch("http://javaserver.teojama.com:8080/FacturaApp/api/factura/consultapendientes", {
            method: "POST",
            headers: {
                "Content-Type": "text/plain"
            },
            body: factura
        });

        const texto = await response.text();

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${texto}`);
        }

        const datos = parsearJsonSeguro(texto);
        pintarFacturasPendientes(obtenerFilasFactura(datos));
        await buscarPendientesResumen();

    } catch (error) {
        console.error("Error al consultar pendientes:", error);
        alert("No se pudo consultar los pendientes: " + (error.message || error.toString()));
    }
}

async function buscarPendientesResumen(){

    const factura = document.getElementById("lblFacturaPendientes").textContent.trim();

    if (!factura) {
        alert("Seleccione primero una factura.");
        return;
    }

    try {

        const response = await fetch("http://javaserver.teojama.com:8080/FacturaApp/api/factura/resumenpendientes", {
            method: "POST",
            headers: {
                "Content-Type": "text/plain"
            },
            body: factura
        });

        const texto = await response.text();

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${texto}`);
        }

        const datos = parsearJsonSeguro(texto);
        pintarResumenPendientes(obtenerFilasFactura(datos));
        
    } catch (error) {
        console.error("Error al consultar pendientes:", error);
        alert("No se pudo consultar los pendientes: " + (error.message || error.toString()));
    }
}





async function buscarPacking(){
    const factura = document.getElementById("lblFacturaPacking").textContent.trim();
    const txtCodigoPacking = document.getElementById("txtCodigoPacking");
    const codigo = txtCodigoPacking.value.trim();

    if (!factura) {
        alert("Seleccione primero una factura.");
        return;
    }

    if (!codigo) {
        alert("Ingrese o escanee un código de barras.");
        return;
    }

    codigoPackingEscaneado = codigo;

    const linea = factura + " " + codigo;

    try {
        const response = await fetch("http://javaserver.teojama.com:8080/FacturaApp/api/factura/consultapacking", {
            method: "POST",
            headers: {
                "Content-Type": "text/plain"
            },
            body: linea
        });

        const texto = await response.text();

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${texto}`);
        }

        const datos = parsearJsonSeguro(texto);
        console.log("Respuesta packing:", datos);
        ultimoPacking = obtenerFilasFactura(datos);
        pintarPackingEscaneo(ultimoPacking);
    } catch (error) {
        console.error("Error al consultar packing:", error);
        alert("No se pudo consultar el packing: " + (error.message || error.toString()));
    } finally {
        // Se limpia de una vez: el código ya quedó guardado en "codigoPackingEscaneado" para
        // imprimir, así que no hace falta dejarlo (ni seleccionado) en el campo. Así, si el
        // usuario toca la tabla para elegir una fila, el siguiente escaneo entra directo sin
        // tener que borrar nada primero.
        txtCodigoPacking.value = "";
        txtCodigoPacking.focus();
    }
}


function pintarResumenPendientes(datos) {
    const lblTotal = document.getElementById("lblTotalCantidadPendientes");
    if (!lblTotal) return;

    const filas = Array.isArray(datos) ? datos : [datos];
    const item = filas[0] || {};
    const totalCantidad = valorCampo(item, ["totalcantidad", "totalCantidad", "TotalCantidad", "TOTALCANTIDAD"]);

    lblTotal.textContent = totalCantidad !== "" ? totalCantidad : "0";
}



function pintarFacturasPendientes(datos) {
    const resultadoPendientes = document.getElementById("resultadoPendientes");
    const filas = Array.isArray(datos) ? datos : [];

    if (!filas.length) {
        resultadoPendientes.innerHTML = "<p>Sin datos para este código.</p>";
        return;
    }

    const htmlFilas = filas.map(item => {
        const nroParte = valorCampo(item, ["nroparte", "nroParte", "NroParte", "NROPARTE"]);
        const pedido = valorCampo(item, ["pedido", "Pedido", "PEDIDO"]);
        const cantidad = valorCampo(item, ["cantidad", "Cantidad", "CANTIDAD"]);

        return `
            <tr>
                <td>${escaparHtml(nroParte)}</td>
                <td>${escaparHtml(pedido)}</td>
                <td>${escaparHtml(cantidad)}</td>
            </tr>`;
    }).join("");

    resultadoPendientes.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Nro. Parte</th>
                    <th>Pedido</th>
                    <th>Cantidad</th>
                </tr>
            </thead>
            <tbody>${htmlFilas}</tbody>
        </table>`;
}




function pintarPackingEscaneo(datos) {
    const resultadoPacking = document.getElementById("resultadoPacking");
    const filas = Array.isArray(datos) ? datos : [];

    seleccionPacking = new Set();

    if (!filas.length) {
        resultadoPacking.innerHTML = "<p>Sin datos para este código.</p>";
        return;
    }

    // La descripción no se muestra en esta tabla (queda oculta a propósito), pero sigue
    // disponible en "ultimoPacking" con los datos originales, así que enviaImprimir() y la
    // construcción de la etiqueta no se ven afectadas.
    const htmlFilas = filas.map((item, indice) => {
        const pedido = valorCampo(item, ["pedido", "Pedido", "PEDIDO"]);
        const nroParte = valorCampo(item, ["nroparte", "nroParte", "NroParte", "NROPARTE"]);
        const ubicacion = valorCampo(item, ["ubicacion", "Ubicacion", "UBICACION"]);
        const cantidad = valorCampo(item, ["cantidad", "Cantidad", "CANTIDAD"]);
        const estado = valorCampo(item, ["estado", "Estado", "ESTADO"]);
        const yaImpresa = String(estado || "").trim().toUpperCase() === "C";

        return `
            <tr data-indice="${indice}" class="${yaImpresa ? "fila-impresa" : ""}">
                <td>${escaparHtml(pedido)}</td>
                <td>${escaparHtml(nroParte)}</td>
                <td>${escaparHtml(ubicacion)}</td>
                <td>${escaparHtml(cantidad)}</td>
            </tr>`;
    }).join("");

    const aviso = filas.length > 1
        ? '<p class="aviso-seleccion-packing">Toque los registros que desea imprimir.</p>'
        : "";

    resultadoPacking.innerHTML = `
        ${aviso}
        <table>
            <thead>
                <tr>
                    <th>Pedido</th>
                    <th>Nro. parte</th>
                    <th>Ubicación</th>
                    <th>Cantidad</th>
                </tr>
            </thead>
            <tbody>${htmlFilas}</tbody>
        </table>`;

    if (filas.length > 1) {
        resultadoPacking.querySelectorAll("tbody tr").forEach(fila => {
            fila.addEventListener("click", function () {
                const indice = Number(fila.dataset.indice);
                if (seleccionPacking.has(indice)) {
                    seleccionPacking.delete(indice);
                    fila.classList.remove("fila-seleccionada");
                } else {
                    seleccionPacking.add(indice);
                    fila.classList.add("fila-seleccionada");
                }
            });
        });
    }
}






async function buscarFactura() {
    const factura = document.getElementById("txtFactura").value.trim();

    if (!factura) {
        alert("Ingrese una factura");
        return;
    }

    try {

        //alert("Buscando factura: " + factura);

        const response = await fetch("http://javaserver.teojama.com:8080/FacturaApp/api/factura/consultafactura", {
            method: "POST",
            headers: {
                "Content-Type": "text/plain"
            },
            body: factura
        });

        const texto = await response.text();

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${texto}`);
        }

        const datos = parsearJsonSeguro(texto);
        console.log("Respuesta factura:", datos);
        pintarFacturas(obtenerFilasFactura(datos));

    } catch (error) {
        alert("Error: ");
        alert("No se pudo consultar o mapear la factura: " + (error.message || error.toString()));
        pintarPacking();  
    }
}







async function buscarInfo() {
    try {
        const response = await fetch("http://javaserver.teojama.com:8080/FacturaApp/api/test");
        alert("STATUS: " + response.status);
        alert(await response.text());
    } catch (error) {
        alert("ERROR: " + (error.message || error.toString()));
        console.log(error);
    }
}

// El backend a veces manda campos de texto (ej. "descripcion": "EMBLEMA "EURO3"") con comillas
// internas sin escapar, lo que rompe JSON.parse. Esto escapa cualquier comilla que no sea el
// cierre real del campo (la real siempre está seguida, ignorando espacios, de , : } ] o el final).
function repararComillasJson(texto) {
    let resultado = "";
    let dentroDeCadena = false;

    for (let i = 0; i < texto.length; i++) {
        const c = texto[i];

        if (c === "\\" && dentroDeCadena) {
            // Ya viene escapado (\", \\, \n, \uXXXX, etc.): se copia tal cual sin reinterpretarlo.
            resultado += c + (texto[i + 1] ?? "");
            i++;
            continue;
        }

        if (c !== '"') {
            resultado += c;
            continue;
        }

        if (!dentroDeCadena) {
            dentroDeCadena = true;
            resultado += c;
            continue;
        }

        let j = i + 1;
        while (j < texto.length && /\s/.test(texto[j])) j++;
        const siguiente = texto[j];
        const esCierreReal = siguiente === undefined || ",:}]".includes(siguiente);

        if (esCierreReal) {
            dentroDeCadena = false;
            resultado += c;
        } else {
            resultado += '\\"';
        }
    }

    return resultado;
}

function parsearJsonSeguro(texto) {
    try {
        return JSON.parse(texto);
    } catch (errorOriginal) {
        try {
            return JSON.parse(repararComillasJson(texto));
        } catch (errorReparado) {
            throw errorOriginal;
        }
    }
}

function obtenerFilasFactura(respuesta) {
    if (Array.isArray(respuesta)) {
        return respuesta;
    }

    if (!respuesta || typeof respuesta !== "object") {
        return [];
    }

    if (Array.isArray(respuesta.detalles)) {
        return respuesta.detalles;
    }

    if (Array.isArray(respuesta.detalle)) {
        return respuesta.detalle;
    }

    if (Array.isArray(respuesta.data)) {
        return respuesta.data;
    }

    if (Array.isArray(respuesta.resultado)) {
        return respuesta.resultado;
    }

    return [respuesta];
}

function valorCampo(item, nombres) {
    for (const nombre of nombres) {
        if (item[nombre] !== undefined && item[nombre] !== null) {
            return item[nombre];
        }
    }

    const claves = Object.keys(item);
    const claveEncontrada = claves.find(clave =>
        nombres.some(nombre => clave.toLowerCase() === nombre.toLowerCase())
    );

    return claveEncontrada ? item[claveEncontrada] : "";
}

function escaparHtml(valor) {
    return String(valor ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function pintarPacking() {
    
    const tbody = document.getElementById("detalleFactura");
    const resultado = document.getElementById("resultado");

    //if (!filas.length) {
    //    tbody.innerHTML = '<tr><td colspan="4">Sin datos para esta factura</td></tr>';
    //    resultado.style.display = "block";
    //    return;
    //}
    const factura = "99998989";

    tbody.innerHTML="";

    tbody.innerHTML =`<tr>
                <td>999789854</td>
                <td>${escaparHtml("cantidad")}</td>
                <td>${escaparHtml("total")}</td>
                <td>
                <a href="#" class="btn-ir" onclick="irPacking('${factura}');return false;">
                Ir ➜
                </a>
                </td>
            </tr>`;
    
    resultado.style.display = "block";
}




function pintarFacturas(filas) {
    
    const tbody = document.getElementById("detalleFactura");
    const resultado = document.getElementById("resultado");

    if (!filas.length) {
        tbody.innerHTML = '<tr><td colspan="4">Sin datos para esta factura</td></tr>';
        resultado.style.display = "block";
        return;
    }

    tbody.innerHTML = filas.map(item => {
        const columnasFallback = Object.values(item).filter(valor =>
            valor === null || ["string", "number", "boolean"].includes(typeof valor)
        );
        const factura = valorCampo(item, ["factura", "Factura", "FACTURA", "numeroFactura", "numFactura"]) || columnasFallback[0] || "";
        const cantidad = valorCampo(item, ["cantidad", "Cantidad", "CANTIDAD", "cant"]) || columnasFallback[1] || "";
        const total = valorCampo(item, ["total", "Total", "TOTAL", "valorTotal", "monto"]) || columnasFallback[2] || "";

        return `
            <tr>
                <td>${escaparHtml(factura)}</td>
                <td>${escaparHtml(cantidad)}</td>
                <td>${escaparHtml(total)}</td>
                <td>
                <a href="#" class="btn-ir" onclick="irPacking('${factura}');return false;">
                Ir ➜
                </a>
                </td>
            </tr>
        `;
    }).join("");

    resultado.style.display = "block";
}
