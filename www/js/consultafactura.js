let tabsHabilitados = false;


let ultimoPacking = [];

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



}

function irPacking(factura) {

    alert("Entrando a Packing:");

    document.getElementById("tabPacking").classList.remove("disabled");
    document.getElementById("tabPendientes").classList.remove("disabled");

    document.getElementById("lblFacturaPacking").textContent = factura;
    //document.getElementById("txtFacturaPacking").value = factura;

    alert("Entrando a Packing:" + factura);

    // Habilita las demás pestañas
    tabsHabilitados = true;

    mostrarTab(
        "packing",
        document.getElementById("tabPacking")
    );


}

async function actualizaPacking(factura, pedido, nroParte) {

const linea = factura + "|" + pedido + "|" + nroParte;    

try {
    await fetch("http://javaserver.teojama.com:8080/FacturaApp/api/factura/actualizapacking", {
        method: "POST",
        headers: {
            "Content-Type": "text/plain"
        },
        body: linea
    });

    console.log("Solicitud enviada.");
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


    const item = ultimoPacking[0];
    const pedido = valorCampo(item, ["pedido", "Pedido", "PEDIDO"]);
    const nroParte = valorCampo(item, ["nroparte", "nroParte", "NroParte", "NROPARTE"]);
    const ubicacion = valorCampo(item, ["ubicacion", "Ubicacion", "UBICACION"]);
    const cantidad = valorCampo(item, ["cantidad", "Cantidad", "CANTIDAD"]);
    const destino    = valorCampo(item, ["destino", "Destino", "DESTINO"]);
    
    const codigo = nroParte || document.getElementById("txtCodigoPacking").value.trim();


    if (!codigo) {
        alert("El packing no contiene un número de parte para imprimir.");
        return;
    }

    await actualizaPacking(factura,pedido, nroParte);


    // Cambie solo esta línea según el lenguaje configurado en su impresora:
    //const etiqueta = construirEtiquetaCpclPacking(pedido, nroParte, ubicacion, cantidad, codigo,destino);
    const etiqueta = construirEtiquetaZplPacking(pedido, nroParte, ubicacion, cantidad, codigo,destino);
    const boton = document.querySelector("button[onclick='enviaImprimir()']");
    if (boton) { boton.disabled = true; }

    bluetoothSerial.connect(mac, function () {
        bluetoothSerial.write(etiqueta, function () {
            setTimeout(function () {
                bluetoothSerial.disconnect(liberar, liberar);
                alert("Etiqueta enviada a la impresora.");
            }, 1500);
        }, function (error) {
            liberar();
            desconectarImpresora();
            alert("No se pudo enviar la etiqueta: " + error);
        });
    }, function (error) {
        liberar();
        alert("No se pudo conectar con la impresora: " + error);
    });

    function liberar() {
        if (boton) { boton.disabled = false; }
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

    const comandos = '! U1 setvar "media.type" "label"\r\n' +
        '! U1 setvar "media.sense_mode" "gap"\r\n';

    const boton = document.querySelector("button[onclick='configurarImpresoraPacking()']");
    if (boton) { boton.disabled = true; }

    bluetoothSerial.connect(mac, function () {
        bluetoothSerial.write(comandos, function () {
            setTimeout(function () {
                bluetoothSerial.disconnect(liberar, liberar);
                alert("Impresora configurada para etiquetas con gap. Debería botar unas etiquetas en blanco mientras recalibra.");
            }, 1500);
        }, function (error) {
            liberar();
            desconectarImpresora();
            alert("No se pudo enviar la configuración: " + error);
        });
    }, function (error) {
        liberar();
        alert("No se pudo conectar con la impresora: " + error);
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

    bluetoothSerial.list(function (dispositivos) {
        mostrarImpresorasPacking(dispositivos || []);
    }, function (error) {
        lista.textContent = "No se pudieron listar las impresoras: " + error;
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

function datosEtiquetaPacking(pedido, nroParte, ubicacion, cantidad, codigo, destino) {
    const limpiar = valor => String(valor || "").replace(/[\^~\r\n]/g, " ").trim();

    return {
        pedido: limpiar("Pedido: " + pedido),
        parte: limpiar(nroParte),
        detalle: limpiar("Ubic: " + ubicacion),
        cantidad: limpiar("Cant: " + cantidad),
        sucursal: limpiar("Sucursal: " + destino),
        codigo: limpiar(codigo)
    };
}

// Etiqueta física: 5 cm de largo (avance de papel) x 10 cm de ancho.
// A 203dpi/8 dots/mm: largo 50mm*8=400 dots, ancho 100mm*8=800 dots.
const LARGO_ETIQUETA_DOTS = 400;
const ANCHO_ETIQUETA_DOTS = 800;

function construirEtiquetaZplPacking(pedido, nroParte, ubicacion, cantidad, codigo, destino) {

    const datos = datosEtiquetaPacking(pedido, nroParte, ubicacion, cantidad, codigo, destino);

    return "^XA" +
       "^PW" + ANCHO_ETIQUETA_DOTS +
       "^LL" + LARGO_ETIQUETA_DOTS +
       "^LH0,0" +
       "^FO40,40^A0N,40,40^FD" + datos.pedido + "^FS" +
       "^FO500,40^A0N,40,30^FD" + datos.sucursal + "^FS" +
       "^FO40,100^A0N,35,30^FD" + datos.detalle + "^FS" +
       "^FO500,100^A0N,40,40^FD" + datos.cantidad + "^FS" +
       "^FO150,160^BY3" +
       "^BCN,140,N,N,N" +
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


async function buscarPendientes(){

    const factura = document.getElementById("lblFacturaPendiente").textContent.trim();

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

        const datos = JSON.parse(texto);
        pintarFacturasPendientes(obtenerFilasFactura(datos));
    } catch (error) {
        console.error("Error al consultar pendientes:", error);
        alert("No se pudo consultar los pendientes: " + (error.message || error.toString()));
    }
}

async function buscarPacking(){
    const factura = document.getElementById("lblFacturaPacking").textContent.trim();
    const codigo = document.getElementById("txtCodigoPacking").value.trim();

    if (!factura) {
        alert("Seleccione primero una factura.");
        return;
    }

    if (!codigo) {
        alert("Ingrese o escanee un código de barras.");
        return;
    }

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

        const datos = JSON.parse(texto);
        console.log("Respuesta packing:", datos);
        ultimoPacking = obtenerFilasFactura(datos);
        pintarPackingEscaneo(ultimoPacking);
    } catch (error) {
        console.error("Error al consultar packing:", error);
        alert("No se pudo consultar el packing: " + (error.message || error.toString()));
    }
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

    if (!filas.length) {
        resultadoPacking.innerHTML = "<p>Sin datos para este código.</p>";
        return;
    }

    const htmlFilas = filas.map(item => {
        const pedido = valorCampo(item, ["pedido", "Pedido", "PEDIDO"]);
        const nroParte = valorCampo(item, ["nroparte", "nroParte", "NroParte", "NROPARTE"]);
        const ubicacion = valorCampo(item, ["ubicacion", "Ubicacion", "UBICACION"]);
        const cantidad = valorCampo(item, ["cantidad", "Cantidad", "CANTIDAD"]);

        return `
            <tr>
                <td>${escaparHtml(pedido)}</td>
                <td>${escaparHtml(nroParte)}</td>
                <td>${escaparHtml(ubicacion)}</td>
                <td>${escaparHtml(cantidad)}</td>
            </tr>`;
    }).join("");

    resultadoPacking.innerHTML = `
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
}






async function buscarFactura() {
    const factura = document.getElementById("txtFactura").value.trim();

    if (!factura) {
        alert("Ingrese una factura");
        return;
    }

    try {

        alert("Buscando factura: " + factura);

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

        const datos = JSON.parse(texto);
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
