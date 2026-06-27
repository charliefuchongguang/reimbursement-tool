import zipfile
import re

def get_p_column_values(filepath, sheet_num):
    '''获取 P 列所有数据'''
    try:
        with zipfile.ZipFile(filepath, 'r') as z:
            sheet_path = f'xl/worksheets/sheet{sheet_num}.xml'
            with z.open(sheet_path) as f:
                content = f.read().decode('utf-8')
                
                print(f'=== P Column (Sheet {sheet_num}) ===')
                
                # 查找所有 P 列单元格
                p_pattern = r'<c r="P(\d+)"[^>]*?>(.*?)</c>'
                matches = re.findall(p_pattern, content, re.DOTALL)
                
                for row, cell_content in matches:
                    row_num = int(row)
                    if 7 <= row_num <= 16:  # 费用行范围
                        v_pattern = r'<v>(.*?)</v>'
                        v_match = re.search(v_pattern, cell_content)
                        if v_match:
                            value = v_match.group(1)
                            print(f'  P{row}: {value}')
                        else:
                            print(f'  P{row}: (empty)')
                    elif row_num == 17:
                        print(f'  P{row} (SUM): {re.search(r"<v>(.*?)</v>", cell_content).group(1) if re.search(r"<v>(.*?)</v>", cell_content) else "(formula)"}')
                        
    except Exception as e:
        print(f'Error: {e}')

filepath = 'd:/AI/11、公司内部项目/自动报销工具/notes/付宠光+5059+湖南高速-差旅费报销单.xlsx'
get_p_column_values(filepath, 8)
