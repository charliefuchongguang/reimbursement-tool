import zipfile
import re

def analyze_excel(filepath, label):
    print(f'\n=== {label} ===')
    try:
        with zipfile.ZipFile(filepath, 'r') as z:
            with z.open('xl/worksheets/sheet1.xml') as f:
                content = f.read().decode('utf-8')
                
                # 查找包含 O19 的部分
                if 'O19' in content:
                    # 用正则提取 O19 单元格的 XML
                    pattern = r'<c r="O19"[^>]*>.*?</c>'
                    match = re.search(pattern, content)
                    if match:
                        print('O19 cell XML:')
                        print(match.group(0))
                
                # 也查找 O20 和 O21
                for cell_ref in ['O20', 'O21', 'K17', 'M17', 'P17', 'N18']:
                    pattern = rf'<c r="{cell_ref}"[^>]*>.*?</c>'
                    match = re.search(pattern, content)
                    if match:
                        print(f'\n{cell_ref} cell XML:')
                        print(match.group(0)[:300])
    except Exception as e:
        print(f'Error: {e}')

analyze_excel('d:/AI/11、公司内部项目/自动报销工具/src/public/template.xlsx', '模板文件')
analyze_excel('d:/AI/11、公司内部项目/自动报销工具/notes/付宠光+5059+湖南高速-差旅费报销单.xlsx', '生成的报销单')
