/**
    Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); you may not use this file except in compliance
    with the License.  You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.
*/

// Wait for the deviceready event before using any of Cordova's device APIs.
// See https://cordova.apache.org/docs/en/latest/cordova/events/events.html#deviceready
document.addEventListener('deviceready', onDeviceReady, false);

function onDeviceReady() {
    // Cordova is now initialized. Have fun!

    console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);

    
                    
//document.getElementById('deviceready').classList.add('ready');
    document.getElementById('btnPrint').addEventListener('click', imprimirHola);

    document.getElementById('btnBusca').addEventListener('click', listarBT);





}

 

function listarBT() {
   

alert("Buscando dispositivos...");

bluetoothSerial.list(
    function(devices) {
        if (devices.length === 0) {
            alert("No hay dispositivos emparejados");
            return;
        }

        let mensaje = "";

        devices.forEach(function(device) {
            mensaje += "Nombre: " + device.name + "\nMAC: " + device.id + "\n\n";
        });

        alert(mensaje);
    },
    function(error) {
        alert("Error al obtener dispositivos: " + error);
    }
);

alert("Acabé de lanzar la búsqueda");



alert("Acabe de buscar");

}




function imprimirHola() {

    
    const printerMac = "58:93:D8:AA:16:81";
    alert("PRUEBA DE IMPRESION " + printerMac);
    
    bluetoothSerial.connect(printerMac,
        function () {
            //console.log("Conectado");

            // Enviar texto
            // 🔥 ZPL (esto SÍ imprime en Zebra)
            var zpl = "^XA" +
            "^FO50,40^A0N,40,40^FDNRO PEDIDO: T53888^FS" +
            "^FO50,90^A0N,35,35^FDSUCURSAL: QUITO^FS" +
            "^FO50,130^A0N,35,35^FDCANTIDAD: 5^FS" +
            "^FO50,170^A0N,35,35^FDNRO PARTE: S1560-72051^FS" +
            // Código de barras (Code128)
            "^FO50,220^BY2,2,80^BCN,80,Y,N,N^FDT53888^FS" +
            "^XZ";


            bluetoothSerial.write(zpl,
                function () {
                    console.log("Mensaje enviado");
                    bluetoothSerial.disconnect();
                },
                function (error) {
                    alert("Error al enviar :" + error);
                    //console.error("Error al enviar", error);
                }
            );
        },
        function (error) {
             alert("Error al conectar: " + error);
            //console.error("Error al conectar", error);
        }
    );
}

