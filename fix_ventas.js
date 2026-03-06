const fs = require('fs');
let content = fs.readFileSync('ventas.html', 'utf8');

// The marker for the start of the OLD pantallaPOS
const oldPosStartStr = '        <!-- PANTALLA 2: PUNTO DE VENTA -->\n        <div id="pantallaPOS" class="hidden h-full flex flex-col bg-slate-50">';
const oldPosStart = content.indexOf(oldPosStartStr);

// The end of the <main> block
const mainEndStr = '    </main>\n</div>';
const mainEnd = content.indexOf(mainEndStr, oldPosStart);

// The start of modal Abrir Caja section
const modalAbrirCajaStartStr = '<!-- ============================================= -->\n<!-- PANTALLA 2: PUNTO DE VENTA                   -->\n<!-- ============================================= -->\n<div id="pantallaPOS" class="hidden min-h-screen">';
const newPosStart = content.indexOf(modalAbrirCajaStartStr);

// The end of the newPos section (right before modal cobrar)
const newPosEndStr = '    <!-- ============================================= -->\n    <!-- MODAL: COBRAR                                -->';
const newPosEnd = content.indexOf(newPosEndStr);

if (oldPosStart === -1 || mainEnd === -1 || newPosStart === -1 || newPosEnd === -1) {
    console.error("Could not find boundaries!");
    console.log({ oldPosStart, mainEnd, newPosStart, newPosEnd });
    process.exit(1);
}

// Extract the NEW POS content (everything from <div id="pantallaPOS" to the end of its div)
const newPosContent = content.substring(newPosStart, newPosEnd).trim();

// Keep everything BEFORE the old POS
const part1 = content.substring(0, oldPosStart);

// Keep everything AFTER the new POS (the modals)
const part3 = content.substring(newPosEnd);

// Combine part1 + newPosContent + mainEndStr + old Modals (which are before newPosStart)

// Let's get the modals between mainEnd and newPosStart
const modalsSection = content.substring(mainEnd + mainEndStr.length, newPosStart).trim();

// Final assembly:
const finalHTML = part1 +
    '        <!-- PANTALLA 2: PUNTO DE VENTA -->\n' +
    '        ' + newPosContent + '\n' +
    '    </main>\n' +
    '</div>\n\n' +
    modalsSection + '\n\n' +
    part3;

fs.writeFileSync('ventas.html', finalHTML);
console.log("ventas.html fixed successfully!");
