import zipfile
import re

filepath = 'd:/AI/11、公司内部项目/自动报销工具/notes/付宠光+5059+湖南高速-差旅费报销单.xlsx'

with zipfile.ZipFile(filepath, 'r') as z:
    with z.open('xl/worksheets/sheet8.xml') as f:
        content = f.read().decode('utf-8')
        
        # 查找 P17 的完整定义
        p17_pattern = r'<c r=\"P17\"[^>]*?>(.*?)</c>'
        match = re.search(p17_pattern, content, re.DOTALL)
        if match:
            cell_xml = match.group(0)
            print('P17 cell XML (full):')
            print(cell_xml)
            print()
            
        # 查找第15行的 P 列
        p15_pattern = r'<c r=\"P15\"[^>]*?>(.*?)</c>'
        match = re.search(p15_pattern, content, re.DOTALL)
        if match:
            print('P15 cell XML:')
            print(match.group(0)[:200])
