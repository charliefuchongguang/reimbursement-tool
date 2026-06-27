const ExcelJS = require('exceljs');

async function analyze() {
  try {
    // 读取用户生成的文件
    const wb1 = new ExcelJS.Workbook();
    await wb1.xlsx.readFile('d:/AI/11、公司内部项目/自动报销工具/notes/付宠光+5059+湖南高速-差旅费报销单.xlsx');
    const s1 = wb1.getWorksheet(1);
    console.log('=== 生成文件 ===');
    console.log('O19 value:', s1.getCell('O19').value);
    console.log('O19 formula:', s1.getCell('O19').formula);
    console.log('O19 type:', s1.getCell('O19').type);
    console.log('K17 value:', s1.getCell('K17').value);
    console.log('M17 value:', s1.getCell('M17').value);
    console.log('P17 value:', s1.getCell('P17').value);
    console.log('N18 value:', s1.getCell('N18').value);
    
    console.log('\n=== 费用明细 ===');
    for(let i=7; i<=16; i++) {
      const k = s1.getCell(\K\\).value;
      const m = s1.getCell(\M\\).value;
      const p = s1.getCell(\P\\).value;
      if(k || m || p) console.log(\Row\: K=\, M=\, P=\\);
    }
    
    // 读取模板
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.readFile('d:/AI/11、公司内部项目/自动报销工具/src/public/template.xlsx');
    const s2 = wb2.getWorksheet(1);
    console.log('\n=== 模板文件 ===');
    console.log('O19 value:', s2.getCell('O19').value);
    console.log('O19 formula:', s2.getCell('O19').formula);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

analyze();
