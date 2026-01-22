// export_helper.js - Utility for Excel Export using SheetJS

/**
 * Exports an array of objects to an Excel file.
 * @param {Array} data - The data to export.
 * @param {Object} columnMap - Key-Value map for renaming columns (e.g., { 'created_at': 'Fecha' }). Keys not in map are ignored/excluded if strictMode is true, or kept as-is.
 * @param {String} fileName - Name of the file (without extension).
 * @param {String} sheetName - Name of the worksheet.
 */
function exportToExcel(data, columnMap, fileName, sheetName = 'Datos') {
    if (typeof XLSX === 'undefined') {
        alert("Error: La librería de Excel (SheetJS) no se ha cargado. Verifique su conexión a internet.");
        return;
    }

    if (!data || data.length === 0) {
        alert("No hay datos para exportar en la vista actual.");
        return;
    }

    // 1. Transform Data based on ColumnMap
    const formattedData = data.map(item => {
        const row = {};
        // If columnMap is provided, only include mapped keys in the specified order
        if (columnMap) {
            Object.keys(columnMap).forEach(key => {
                let val = item[key];

                // Format Checks
                if (key.includes('date') || key.includes('created_at') || key.includes('fecha')) {
                    if (val) val = new Date(val).toLocaleDateString('es-MX');
                }
                if (typeof val === 'number' && (key.includes('monto') || key.includes('saldo') || key.includes('precio'))) {
                    // Keep numbers as numbers for Excel math, but maybe 2 decimals?
                    // Actually, SheetJS handles raw numbers best.
                }

                row[columnMap[key]] = val;
            });
        } else {
            // No map, dump everything
            Object.assign(row, item);
        }
        return row;
    });

    // 2. Create Workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(formattedData);

    // Auto-width columns (Simple heuristic)
    const colWidths = Object.keys(formattedData[0]).map(key => ({ wch: 20 }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // 3. Save File
    XLSX.writeFile(wb, `${fileName}.xlsx`);
}
