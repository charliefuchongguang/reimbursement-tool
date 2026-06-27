# 验证 Sheet 8 的计算
# K17=2457, M17=1470, P17=630.25, N18=0
# 补领金额应该是: (2457 + 1470 + 630.25) - 0 = 4557.25

print('=== 计算验证 ===')
k17 = 2457
m17 = 1470
p17 = 630.25
n18 = 0

total = k17 + m17 + p17
print(f'K17 (交通费合计): {k17}')
print(f'M17 (补助合计): {m17}')
print(f'P17 (其他费合计): {p17}')
print(f'N18 (预借旅费): {n18}')
print()
print(f'总合计: {k17} + {m17} + {p17} = {total}')
print(f'补领金额 (如果总合计 > N18): {total} - {n18} = {total - n18}')
print()
print(f'存储在 sharedStrings 中的字符串:')
print(f'  补领金额:￥{total - n18}')
print()
print(f'但是用户看到的是: 补领金额:￥4557.25')
print(f'这就是小数点后保留很多位的问题!')
