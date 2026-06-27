import os
import sys

# 检查可用的PDF库
try:
    from pypdf import PdfReader
    print("pypdf 可用")
    HAS_PYPDF = True
except:
    print("pypdf 不可用")
    HAS_PYPDF = False

if HAS_PYPDF:
    print("\n尝试使用pypdf提取文本...")
    pdf_files = [
        r"notes\3.28长沙-北京-661.pdf",  # 这个能提取到文本
        r"notes\2.24北京-长沙-778.pdf",  # 这个提取文本很少
    ]
    
    for pdf_path in pdf_files:
        if not os.path.exists(pdf_path):
            print(f"\n{pdf_path} 不存在")
            continue
            
        print(f"\n========== {pdf_path} ==========")
        try:
            reader = PdfReader(pdf_path)
            print(f"页数: {len(reader.pages)}")
            
            for i, page in enumerate(reader.pages):
                text = page.extract_text()
                print(f"\n--- 第 {i+1} 页 ---")
                print(f"提取到 {len(text)} 个字符")
                if text:
                    print("内容：")
                    print(text[:800])
                else:
                    print("（无文本）")
                
        except Exception as e:
            print(f"处理失败: {e}")
else:
    print("无法导入pypdf，跳过")
