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

'use strict';

(function () {

    /* ---------------- Configuración ---------------- */
    var STORAGE_MAC  = 'printer.mac';
    var STORAGE_NAME = 'printer.name';

    var els = {};
    var statusTimer = null;

    document.addEventListener('deviceready', onDeviceReady, false);

    function onDeviceReady() {
        console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);

        cacheElements();
        bindEvents();
        restorePrinter();
        renderPreview();
        markReady();

        // Permisos de Android 12+ (best-effort). No rompe si el plugin no está.
        requestBluetoothPermissions();
    }

    /* ---------------- DOM ---------------- */
    function cacheElements() {
        els.readyBadge  = document.getElementById('readyBadge');
        els.titleInput  = document.getElementById('titleInput');
        els.codeInput   = document.getElementById('codeInput');
        els.qtyInput    = document.getElementById('qtyInput');
        els.btnPrint    = document.getElementById('btnPrint');
        els.btnScan     = document.getElementById('btnScan');
        els.deviceList  = document.getElementById('deviceList');
        els.printerName = document.getElementById('printerName');
        els.status      = document.getElementById('status');
        els.tagTitle    = document.getElementById('tagTitle');
        els.tagCode     = document.getElementById('tagCode');
        els.tagBars     = document.getElementById('tagBars');
    }

    function bindEvents() {
        els.btnPrint.addEventListener('click', printLabel);
        els.btnScan.addEventListener('click', scanDevices);
        els.titleInput.addEventListener('input', renderPreview);
        els.codeInput.addEventListener('input', renderPreview);
    }

    function markReady() {
        els.readyBadge.textContent = 'Listo';
        els.readyBadge.className = 'badge badge--ready';
    }

    /* ---------------- Acceso seguro al plugin ---------------- */
    function bt() {
        if (typeof bluetoothSerial === 'undefined') {
            setStatus('El plugin Bluetooth no está disponible en esta compilación.', 'err');
            return null;
        }
        return bluetoothSerial;
    }

    function requestBluetoothPermissions() {
        var perms = window.cordova && cordova.plugins && cordova.plugins.permissions;
        if (!perms) { return; } // cordova-plugin-android-permissions no instalado: se omite.
        var list = [perms.BLUETOOTH_SCAN, perms.BLUETOOTH_CONNECT, perms.ACCESS_FINE_LOCATION];
        perms.requestPermissions(list, function () {}, function () {
            setStatus('Permisos de Bluetooth denegados. Actívalos en Ajustes.', 'err');
        });
    }

    /* ---------------- Impresora seleccionada ---------------- */
    function getPrinterMac() {
        try { return localStorage.getItem(STORAGE_MAC) || ''; }
        catch (e) { return ''; }
    }

    function savePrinter(mac, name) {
        try {
            localStorage.setItem(STORAGE_MAC, mac);
            localStorage.setItem(STORAGE_NAME, name || mac);
        } catch (e) { /* almacenamiento no disponible */ }
        renderPrinterName(name || mac, mac);
    }

    function restorePrinter() {
        var mac = getPrinterMac();
        var name = '';
        try { name = localStorage.getItem(STORAGE_NAME) || ''; } catch (e) {}
        renderPrinterName(mac ? (name || mac) : '', mac);
    }

    function renderPrinterName(name, mac) {
        if (!mac) {
            els.printerName.textContent = 'Ninguna';
            return;
        }
        els.printerName.textContent = name;
        els.printerName.title = mac;
    }

    /* ---------------- Buscar dispositivos ---------------- */
    function scanDevices() {
        var b = bt();
        if (!b) { return; }

        setStatus('Buscando dispositivos emparejados…', 'info');
        els.btnScan.disabled = true;

        b.list(function (devices) {
            els.btnScan.disabled = false;
            renderDeviceList(devices || []);
        }, function (error) {
            els.btnScan.disabled = false;
            setStatus('No se pudo listar: ' + error, 'err');
        });
    }

    function renderDeviceList(devices) {
        els.deviceList.innerHTML = '';

        if (devices.length === 0) {
            setStatus('No hay dispositivos emparejados. Empareja la impresora en Ajustes de Bluetooth.', 'err');
            els.deviceList.hidden = true;
            return;
        }

        var selectedMac = getPrinterMac();

        devices.forEach(function (device) {
            var item = document.createElement('li');
            item.className = 'device-list__item';
            if (device.id === selectedMac) { item.classList.add('is-selected'); }

            var name = document.createElement('span');
            name.className = 'device-list__name';
            name.textContent = device.name || 'Dispositivo sin nombre';

            var mac = document.createElement('span');
            mac.className = 'device-list__mac';
            mac.textContent = device.id;

            item.appendChild(name);
            item.appendChild(mac);
            item.addEventListener('click', function () {
                savePrinter(device.id, device.name);
                highlightSelected(device.id);
                setStatus('Impresora seleccionada: ' + (device.name || device.id), 'ok');
            });

            els.deviceList.appendChild(item);
        });

        els.deviceList.hidden = false;
        setStatus('Toca una impresora para seleccionarla.', 'info');
    }

    function highlightSelected(mac) {
        var items = els.deviceList.querySelectorAll('.device-list__item');
        Array.prototype.forEach.call(items, function (it) {
            var itMac = it.querySelector('.device-list__mac');
            it.classList.toggle('is-selected', itMac && itMac.textContent === mac);
        });
    }

    /* ---------------- Imprimir ---------------- */
    function printLabel() {
        var b = bt();
        if (!b) { return; }

        var mac = getPrinterMac();
        if (!mac) {
            setStatus('Primero selecciona una impresora.', 'err');
            return;
        }

        var code = els.codeInput.value.trim();
        if (!code) {
            setStatus('Escribe un código para imprimir.', 'err');
            els.codeInput.focus();
            return;
        }

        var title = els.titleInput.value.trim();
        var qty   = clampQty(els.qtyInput.value);
        var zpl   = buildZpl(title, code, qty);

        els.btnPrint.disabled = true;
        setStatus('Conectando con la impresora…', 'info');

       b.connect(mac, function () {
                setStatus('Enviando etiqueta…', 'info');
                    b.write(zpl, function () {
                    // Dar tiempo a que el buffer llegue a la impresora antes de cortar.
                    setTimeout(function () {
                            b.disconnect(release, release);
                            setStatus('Etiqueta enviada (' + qty + ').', 'ok');
        }, 1500);
    }, function (error) {
        release();
        setStatus('Error al enviar: ' + error, 'err');
        safeDisconnect(b);
    });
}, function (error) {
    release();
    setStatus('No se pudo conectar: ' + error, 'err');
});
 
function release() { els.btnPrint.disabled = false; }
    }

    function safeDisconnect(b) {
        try { b.disconnect(function () {}, function () {}); } catch (e) {}
    }

    function clampQty(value) {
        var n = parseInt(value, 10);
        if (isNaN(n) || n < 1) { n = 1; }
        if (n > 99) { n = 99; }
        return n;
    }

    /* ZPL: título + código de barras Code 128 + cantidad de copias.
       Se neutralizan los caracteres de control ^ y ~ de ZPL. */
    function buildZpl(title, code, qty) {
        var t = sanitizeZpl(title);
        var c = sanitizeZpl(code);
        var y = t ? 95 : 40;

        var zpl = '^XA^CI28';
        if (t) {
            zpl += '^FO40,35^A0N,38,38^FD' + t + '^FS';
        }
        zpl += '^FO40,' + y + '^BY3^BCN,120,Y,N,N^FD' + c + '^FS';
        if (qty > 1) { zpl += '^PQ' + qty + ',0,0,Y'; }
        zpl += '^XZ';

        //"^XA^FO50,50^A0N,50,50^FDHola Mundo^FS^XZ";

        return zpl;
    }

    function sanitizeZpl(str) {
        return (str || '').replace(/[\^~]/g, ' ');
    }

    /* ---------------- Vista previa ---------------- */
    function renderPreview() {
        var title = els.titleInput.value.trim();
        var code  = els.codeInput.value.trim();

        els.tagTitle.textContent = title || 'PRODUCTO';
        els.tagCode.textContent  = code || '— sin código —';
        renderBars(code);
    }

    /* Barras decorativas y deterministas a partir del texto.
       No es un código de barras real escaneable: solo previsualización. */
    function renderBars(code) {
        els.tagBars.innerHTML = '';
        var source = code || 'PRODUCTO';
        var count = 44;
        for (var i = 0; i < count; i++) {
            var ch = source.charCodeAt(i % source.length) || 50;
            var bar = document.createElement('i');
            bar.style.width = ((ch + i) % 3 === 0 ? 3 : 1) + 'px';
            bar.style.height = (55 + ((ch * (i + 3)) % 35)) + '%';
            els.tagBars.appendChild(bar);
        }
    }

    /* ---------------- Estado en pantalla ---------------- */
    function setStatus(message, type) {
        els.status.textContent = message;
        els.status.className = 'status status--' + (type || 'info');
        els.status.hidden = false;

        if (statusTimer) { clearTimeout(statusTimer); }
        if (type === 'ok' || type === 'err') {
            statusTimer = setTimeout(function () { els.status.hidden = true; }, 4000);
        }
    }

})();
