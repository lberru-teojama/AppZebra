// Muestra un spinner y desactiva el botón mientras dura la validación del login.
function iniciarCarga(idBoton) {
    const boton = document.getElementById(idBoton);
    if (!boton) return;

    boton.dataset.textoOriginal = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = '<span class="spinner"></span>Procesando...';
}

function finalizarCarga(idBoton) {
    const boton = document.getElementById(idBoton);
    if (!boton) return;

    boton.disabled = false;
    if (boton.dataset.textoOriginal !== undefined) {
        boton.innerHTML = boton.dataset.textoOriginal;
    }
}

async function ingresar() {
    const usuario = document.getElementById("txtUsuario").value.trim();
    const clave = document.getElementById("txtClave").value;

    if (!usuario) {
        alert("Ingrese su usuario.");
        return;
    }

    if (!clave) {
        alert("Ingrese su clave.");
        return;
    }

    iniciarCarga("btnIngresar");

    try {
        const response = await fetch("http://javaserver.teojama.com:8080/FacturaApp/api/factura/login", {
            method: "POST",
            headers: {
                "Content-Type": "text/plain"
            },
            body: usuario + "|" + clave
        });

        const texto = await response.text();

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${texto}`);
        }


        const datos = JSON.parse(texto);
        const filas = Array.isArray(datos) ? datos : [datos];
        const fila = filas[0] || {};
        const usuarioValido = String(fila.usuario || fila.Usuario || fila.USUARIO || "").trim();

        if (!usuarioValido || usuarioValido.toUpperCase() !== usuario.toUpperCase()) {
            alert("Usuario o clave erróneos, vuelva a intentar.");
            document.getElementById("txtClave").value = "";
            document.getElementById("txtClave").focus();
            return;
        }

        localStorage.setItem("usuario.logueado", usuarioValido);
        window.location.href = "principal.html";

    } catch (error) {
        console.error("Error al validar el login:", error);
        alert("Usuario o clave erróneos, vuelva a intentar.");
    } finally {
        finalizarCarga("btnIngresar");
    }
}

function activarEnter(idInput) {
    const input = document.getElementById(idInput);
    if (!input) return;

    input.addEventListener("keydown", function (evento) {
        if (evento.key === "Enter") {
            evento.preventDefault();
            ingresar();
        }
    });
}

activarEnter("txtUsuario");
activarEnter("txtClave");

document.getElementById("txtUsuario").focus();
