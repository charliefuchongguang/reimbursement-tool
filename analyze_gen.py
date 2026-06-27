import zipfile
import re

def analyze_generated(filepath):
    print('=== 生成的报销单 - 详细分析 ===')
    try:
        with zipfile.ZipFile(filepath, 'r') as z:
            # 检查两个 sheet
            for sheet_num in [6, 8]:
                sheet_path = f'xl/worksheets/sheet{sheet_num}.xml'
                try:
                    with z.open(sheet_path) as f:
                        content = f.read().decode('utf-8')
                        print(f'\n--- Sheet {sheet_num} ---')
                        
                        # 查找 O19 单元格
                        pattern = r'<c r="O19"[^>]*>.*?</c>'
                        match = re.search(pattern, content)
                        if match:
                            print('O19 cell XML:')
                            print(match.group(0)[:500])
                        else:
                            print('O19 not found in sheet')
                            
                        # 检查是否有数据
                        if '<c r="K7"' in content or '<c r="O3"' in content:
                            print('(Has data)')
                except:
                    pass
    except Exception as e:
        print(f'Error: {e}')

analyze_generated('d:/AI/11、公司内部项目/自动报销工具/notes/付宠光+5059+湖南高速-差旅费报销单.xlsx')
