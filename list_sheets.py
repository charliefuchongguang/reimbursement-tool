import zipfile

def list_worksheets(filepath, label):
    print(f'\n=== {label} - 工作表列表 ===')
    try:
        with zipfile.ZipFile(filepath, 'r') as z:
            # 读取 workbook.xml 查找 sheet 名称
            with z.open('xl/workbook.xml') as f:
                content = f.read().decode('utf-8')
                print(content[:500])
                
            # 列出所有 worksheets 文件
            worksheets = [f for f in z.namelist() if 'worksheets/sheet' in f]
            print(f'\nWorksheet files: {worksheets}')
    except Exception as e:
        print(f'Error: {e}')

list_worksheets('d:/AI/11、公司内部项目/自动报销工具/notes/付宠光+5059+湖南高速-差旅费报销单.xlsx', '生成的报销单')
