import ExcelJS from 'exceljs';

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile('d:/AI/11、公司内部项目/自动报销工具/notes/新差旅费报销单.xlsx');

workbook.eachSheet((sheet, id) => {
  console.log(\\n\\);
  console.log(\工作表名称: \\);
  console.log(\\\);
  
  // 显示合并单元格
  if (sheet._merges && sheet._merges.size > 0) {
    console.log('\n【合并单元格范围】');
    const merges = Array.from(sheet._merges);
    merges.forEach(merge => {
      console.log(\  \\);
    });
  }
  
  // 详细显示每一行每一列
  console.log('\n【单元格内容详细列表】');
  
  const maxRow = sheet.actualRowCount;
  const maxCol = 26;
  
  for (let rowNum = 1; rowNum <= maxRow; rowNum++) {
    const row = sheet.getRow(rowNum);
    const cells = [];
    
    for (let colNum = 1; colNum <= maxCol; colNum++) {
      const cell = row.getCell(colNum);
      const colLetter = String.fromCharCode(64 + colNum);
      const cellRef = \\\\;
      
      if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
        cells.push(\\=\\);
      }
    }
    
    if (cells.length > 0) {
      console.log(\Row \: \\);
    }
  }
});
