import zipfile
import re

def get_shared_strings(filepath, indices):
    '''获取共享字符串'''
    try:
        with zipfile.ZipFile(filepath, 'r') as z:
            with z.open('xl/sharedStrings.xml') as f:
                content = f.read().decode('utf-8')
                
                # 提取所有 si (string item) 元素
                si_pattern = r'<si>.*?</si>'
                strings = re.findall(si_pattern, content, re.DOTALL)
                
                print(f'Total strings in sharedStrings: {len(strings)}')
                print()
                
                for idx in indices:
                    if idx < len(strings):
                        si_elem = strings[idx]
                        # 提取 t 元素
                        t_pattern = r'<t[^>]*>([^<]*)</t>'
                        t_matches = re.findall(t_pattern, si_elem)
                        text = ''.join(t_matches)
                        print(f'String[{idx}]: {repr(text)}')
    except Exception as e:
        print(f'Error: {e}')

filepath = 'd:/AI/11、公司内部项目/自动报销工具/notes/付宠光+5059+湖南高速-差旅费报销单.xlsx'
get_shared_strings(filepath, [54, 55])
