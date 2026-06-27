import zipfile
import re

def detailed_analysis(filepath):
    print('=== 详细分析 - Sheet 6 和 Sheet 8 的对比 ===')
    try:
        with zipfile.ZipFile(filepath, 'r') as z:
            with z.open('xl/workbook.xml') as f:
                content = f.read().decode('utf-8')
                # 提取 sheet 定义
                sheet_pattern = r'<sheet name="([^"]+)"[^>]*sheetId="(\d+)"[^>]*r:id="([^"]+)"'
                matches = re.findall(sheet_pattern, content)
                print('\nSheet definitions:')
                for name, sheet_id, rel_id in matches:
                    print(f'  {rel_id}: Sheet ID={sheet_id}, Name={name}')
            
            # 检查各 sheet 的第一行数据和尺寸
            for sheet_num in [6, 8]:
                sheet_path = f'xl/worksheets/sheet{sheet_num}.xml'
                try:
                    with z.open(sheet_path) as f:
                        content = f.read().decode('utf-8')
                        print(f'\n--- Sheet {sheet_num} ---')
                        
                        # 查找 dimension (尺寸)
                        dim_pattern = r'<dimension ref="([^"]+)"'
                        dim_match = re.search(dim_pattern, content)
                        if dim_match:
                            print(f'Dimension: {dim_match.group(1)}')
                        
                        # 查找第一个单元格的数据
                        cell_pattern = r'<c r="([A-Z]\d+)"[^>]*>.*?</c>'
                        first_cells = re.findall(cell_pattern, content)[:5]
                        print(f'First cells: {first_cells}')
                        
                        # 查找 O 列的所有数据
                        o_pattern = r'<c r="O(\d+)"[^>]*>.*?</c>'
                        o_cells = re.findall(o_pattern, content)
                        print(f'O column rows with data: {o_cells[:10]}')
                        
                except Exception as e:
                    print(f'Error reading sheet{sheet_num}: {e}')
    except Exception as e:
        print(f'Error: {e}')

detailed_analysis('d:/AI/11、公司内部项目/自动报销工具/notes/付宠光+5059+湖南高速-差旅费报销单.xlsx')
