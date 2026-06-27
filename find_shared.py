import zipfile
import re

filepath = 'd:/AI/11、公司内部项目/自动报销工具/notes/付宠光+5059+湖南高速-差旅费报销单.xlsx'

with zipfile.ZipFile(filepath, 'r') as z:
    with z.open('xl/worksheets/sheet8.xml') as f:
        content = f.read().decode('utf-8')
        
        # 查找所有的 shared formula 定义 (f t='shared' si='0')
        shared_pattern = r'<c r=\"([^\"]+)\"[^>]*><f t=\"shared\" si=\"0\"[^>]*>([^<]*)</f>'
        matches = re.findall(shared_pattern, content)
        
        if matches:
            print(f'Found {len(matches)} cells using shared formula si=0:')
            for cell_ref, formula in matches:
                print(f'  {cell_ref}: {formula}')
        else:
            print('No shared formula si=0 found')
            
        # 查找所有 <c> 标签中的 shared formula 起点
        all_shared = re.findall(r'<c r=\"([^\"]+)\"[^>]*><f t=\"shared\"[^>]*?si=\"(\d+)\"[^>]*?>([^<]*?)</f>', content)
        print(f'\nAll shared formulas:')
        for cell_ref, si, formula in all_shared[:10]:
            print(f'  {cell_ref} (si={si}): {formula[:50]}')
