/**
 * 数字转中文大写金额
 * 如 3250 → "叁仟贰佰伍拾元整"
 * 如 3250.50 → "叁仟贰佰伍拾元伍角整"
 * 如 3250.05 → "叁仟贰佰伍拾元零伍分整"
 * @param {number} num - 要转换的数字
 * @returns {string} 中文大写金额
 */
export function numberToChinese(num) {
  if (num === 0) return '零元整'

  const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖']
  const intUnits = ['', '拾', '佰', '仟']
  const bigUnits = ['', '万', '亿']

  // 分离整数和小数部分
  const absNum = Math.abs(num)
  const intPart = Math.floor(absNum)
  const decPart = Math.round((absNum - intPart) * 100)

  let result = ''

  // 处理整数部分
  if (intPart > 0) {
    const intStr = String(intPart)
    const len = intStr.length
    let zeroFlag = false // 标记是否有连续零
    let needBigUnit = '' // 当前大单位

    for (let i = 0; i < len; i++) {
      const digit = parseInt(intStr[i])
      const pos = len - 1 - i // 当前位的位置（从右往左，0=个位）

      // 确定大单位
      if (pos >= 8) {
        needBigUnit = bigUnits[2] // 亿
      } else if (pos >= 4) {
        needBigUnit = bigUnits[1] // 万
      } else {
        needBigUnit = bigUnits[0] // 无
      }

      if (digit === 0) {
        zeroFlag = true
        // 在万位和亿位上，即使为0也要输出大单位
        if (pos === 4 || pos === 8) {
          // 检查是否需要输出大单位
          const prevDigits = intStr.substring(0, i)
          const hasNonZeroBefore = prevDigits.split('').some(d => d !== '0')
          if (hasNonZeroBefore) {
            result += needBigUnit
          }
          zeroFlag = false
        }
      } else {
        if (zeroFlag) {
          result += digits[0]
          zeroFlag = false
        }
        const unitIdx = pos % 4
        result += digits[digit] + intUnits[unitIdx]

        // 检查是否需要加大单位
        if (pos === 4 || pos === 8) {
          result += needBigUnit
        }
      }
    }

    result += '元'
  }

  // 处理小数部分
  if (decPart === 0) {
    result += '整'
  } else {
    const jiao = Math.floor(decPart / 10)
    const fen = decPart % 10

    if (jiao > 0) {
      result += digits[jiao] + '角'
    } else if (intPart > 0) {
      result += '零'
    }

    if (fen > 0) {
      result += digits[fen] + '分'
    } else {
      result += '整'
    }
  }

  // 处理负数
  if (num < 0) {
    result = '负' + result
  }

  return result
}
