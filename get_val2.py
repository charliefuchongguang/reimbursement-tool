import zipfile
import re

def get_cell_value(filepath, sheet_num, cell_ref):
    try:
        with zipfile.ZipFile(filepath, 'r') as z:
            sheet_path = f'xl/worksheets/sheet{sheet_num}.xml'
            with z.open(sheet_path) as f:
                content = f.read().decode('utf-8')
                
                pattern = rf'<c r="{cell_ref}"[^>]*?>(.*?)</c>'
                match = re.search(pattern, content, re.DOTALL)
                if match:
                    cell_xml = match.group(0)
                    inner = match.group(1)
                    
                    f_pattern = r'<f>(.*?)</f>'
                    f_match = re.search(f_pattern, inner)
                    formula = f_match.group(1) if f_match else None
                    
                    v_pattern = r'<v>(.*?)</v>'
                    v_match = re.search(v_pattern, inner)
                    value = v_match.group(1) if v_match else None
                    
                    t_attr = re.search(r't="([^"]*)"', cell_xml)
                    t_type = t_attr.group(1) if t_attr else "none"
                    
                    print(f'{cell_ref} on Sheet {sheet_num}:')
                    print(f'  Type: {t_type}')
                    print(f'  Formula: {formula}')
                    print(f'  Value: {value}')
                    print()
                    
    except Exception as e:
        print(f'Error: {e}')

filepath = 'd:/AI/11、公司内部项目/自动报销工具/notes/付宠光+5059+湖南高速-差旅费报销单.xlsx'

for sheet in [6, 8]:
    print(f'=== Sheet {sheet} ===')
    for cell in ['N18', 'K17', 'M17', 'P17', 'O19', 'O20']:
        get_cell_value(filepath, sheet, cell)
