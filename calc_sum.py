values = [254.6, 375.65, 25, 30, 24, 71, 10, 35, 52, 36]
manual_sum = 254.6 + 375.65 + 25 + 30 + 24 + 71 + 10 + 35 + 52 + 36
import decimal
decimal_values = [decimal.Decimal(str(v)) for v in values]
decimal_sum = sum(decimal_values)

print(f'Values: {values}')
print(f'Manual sum: {manual_sum}')
print(f'Python sum(): {sum(values)}')
print(f'Decimal sum: {decimal_sum}')
