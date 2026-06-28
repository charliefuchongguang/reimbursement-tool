<template>
  <div class="trip-calendar">
    <!-- 左侧：日历区域 -->
    <div class="calendar-main">
      <!-- 顶部：年份选择 + 统计 -->
      <div class="calendar-header">
        <div class="year-nav">
          <el-button :icon="ArrowLeft" circle size="small" @click="year--" />
          <span class="year-label">{{ year }} 年</span>
          <el-button :icon="ArrowRight" circle size="small" @click="year++" />
        </div>
        <div class="stats">
          <span class="stat-item">
            出差 <strong>{{ totalTripDays }}</strong> 天
          </span>
          <span class="stat-item">
            到访 <strong>{{ cityList.length }}</strong> 个城市
          </span>
        </div>
      </div>

      <!-- 无数据提示 -->
      <el-empty v-if="!cityList.length" description="暂无出差记录，完成报销流程后将自动生成出差日历" />

      <!-- 12 个月日历 3列×4行 -->
      <div class="months-grid" v-else>
        <div
          v-for="m in 12"
          :key="m"
          class="month-card"
        >
          <div class="month-title">{{ m }} 月</div>
          <div class="weekday-header">
            <span v-for="w in weekdays" :key="w" class="weekday">{{ w }}</span>
          </div>
          <div class="days-grid">
            <!-- 前置空白 -->
            <span
              v-for="blank in firstDayOffset(m)"
              :key="'b' + blank"
              class="day-cell empty"
            ></span>
            <!-- 日期格子 -->
            <div
              v-for="d in daysInMonth(m)"
              :key="d"
              class="day-cell"
              :class="{ 'is-weekend': isWeekend(m, d) }"
              :style="getDayStyle(m, d)"
              :title="getDayTooltip(m, d)"
            >
              <span class="day-num">{{ d }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧：固定图例面板 -->
    <div class="legend-panel" v-if="cityList.length">
      <h4 class="legend-title">城市图例</h4>
      <div class="legend-list">
        <div
          v-for="c in cityList"
          :key="c.name"
          class="legend-item"
        >
          <span class="legend-color" :style="{ background: c.color }"></span>
          <span class="legend-city">{{ c.name }}</span>
          <span class="legend-days">{{ getCityDayCount(c.name) }}天</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import { useHistoryStore } from '../stores/history'

const historyStore = useHistoryStore()
const year = ref(new Date().getFullYear())
const weekdays = ['一', '二', '三', '四', '五', '六', '日']

// 预定义调色板（柔和背景色，适合做单元格背景）
const PALETTE = [
  '#FDEBD0', // 长沙 - 暖橙
  '#D6EAF8', // 哈尔滨 - 天蓝
  '#D5F5E3', // 绿
  '#FADBD8', // 粉红
  '#E8DAEF', // 紫
  '#D1F2EB', // 青绿
  '#FCF3CF', // 浅黄
  '#D4E6F1', // 钢蓝
  '#F5CBA7', // 杏色
  '#A3E4D7', // 薄荷
  '#F9E79F', // 柠檬黄
  '#AED6F1', // 淡蓝
  '#D7BDE2', // 淡紫
  '#A9DFBF', // 翠绿
  '#F5B7B1', // 珊瑚粉
]

// ─── 判断城市是否为北京 ───
function isBeijing(city) {
  if (!city) return true
  return city.includes('北京')
}

// ─── 从历史数据提取出差日期区间 ───
// 返回: Map<'YYYY-MM-DD', cityName>，只保留非北京城市
const dateCityMap = computed(() => {
  const map = new Map()

  for (const task of historyStore.tasks) {
    const invoices = task.invoices || []

    // ── 交通费：配对出京→回京，标记整段行程 ──
    const transportInvs = invoices
      .filter(inv => inv.category === '01')
      .map(inv => ({
        date: inv.travelDate || inv.issueDate,
        origin: inv.origin?.trim() || '',
        destination: inv.destination?.trim() || '',
        arrivalTime: inv.arrivalTime || ''
      }))
      .filter(e => e.date)
      .sort((a, b) => a.date.localeCompare(b.date))

    // 找出出京和回京事件
    const departures = [] // { date, city: 目的地 }
    const returns = []    // { date, city: 出发地 }

    for (const e of transportInvs) {
      if (isBeijing(e.origin) && !isBeijing(e.destination)) {
        // 出京：目的地是出差城市
        departures.push({ date: e.date, city: e.destination })
      } else if (!isBeijing(e.origin) && isBeijing(e.destination)) {
        // 回京：出发地是出差城市
        returns.push({ date: e.date, city: e.origin })
      } else if (!isBeijing(e.origin) && !isBeijing(e.destination)) {
        // 城市间中转：标记出发城市（仍在外地）
        departures.push({ date: e.date, city: e.destination })
      }
    }

    // 配对出京与回京
    const usedReturns = new Set()
    for (const dep of departures) {
      // 找到该出京后最近的回京
      let matchedReturn = null
      for (let i = 0; i < returns.length; i++) {
        if (usedReturns.has(i)) continue
        if (returns[i].date >= dep.date) {
          matchedReturn = { ...returns[i], idx: i }
          break
        }
      }

      const startDate = new Date(dep.date)
      const endDate = matchedReturn
        ? new Date(matchedReturn.date)
        : startDate // 没有回京记录，只标记出发日

      // 标记从出发到回京之间的所有日期
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDateStr(d)
        if (!map.has(dateStr) && !isBeijing(dep.city)) {
          map.set(dateStr, dep.city)
        }
      }

      if (matchedReturn) {
        usedReturns.add(matchedReturn.idx)
      }
    }

    // ── 住宿费：入住到退房期间标注城市 ──
    const stayInvs = invoices.filter(inv => inv.category === '03')
    for (const inv of stayInvs) {
      const checkIn = inv.checkInDate
      const checkOut = inv.checkOutDate
      const city = inv.destination?.trim() || inv.origin?.trim()
      if (!checkIn || !city || city === '未知' || isBeijing(city)) continue

      const start = new Date(checkIn)
      const end = new Date(checkOut || checkIn)
      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDateStr(d)
        if (!map.has(dateStr)) {
          map.set(dateStr, city)
        }
      }
    }
  }

  return map
})

function formatDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ─── 城市列表与颜色映射 ───
const cityList = computed(() => {
  const citySet = new Set()
  for (const city of dateCityMap.value.values()) {
    citySet.add(city)
  }
  const cities = Array.from(citySet).sort()
  return cities.map((name, i) => ({
    name,
    color: PALETTE[i % PALETTE.length]
  }))
})

const cityColorMap = computed(() => {
  const map = {}
  for (const c of cityList.value) {
    map[c.name] = c.color
  }
  return map
})

// ─── 每个城市的出差天数 ───
function getCityDayCount(city) {
  let count = 0
  for (const c of dateCityMap.value.values()) {
    if (c === city) count++
  }
  return count
}

// ─── 出差总天数 ───
const totalTripDays = computed(() => dateCityMap.value.size)

// ─── 日历辅助函数 ───
function daysInMonth(month) {
  return new Date(year.value, month, 0).getDate()
}

function firstDayOffset(month) {
  const dayOfWeek = new Date(year.value, month - 1, 1).getDay()
  return (dayOfWeek + 6) % 7
}

function isWeekend(month, day) {
  const d = new Date(year.value, month - 1, day).getDay()
  return d === 0 || d === 6
}

function getDayCity(month, day) {
  const dateStr = `${year.value}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return dateCityMap.value.get(dateStr) || null
}

function getDayStyle(month, day) {
  const city = getDayCity(month, day)
  if (!city) return {}
  const color = cityColorMap.value[city]
  return { backgroundColor: color }
}

function getDayTooltip(month, day) {
  const city = getDayCity(month, day)
  return city ? `${month}月${day}日 · ${city}` : ''
}
</script>

<style scoped>
.trip-calendar {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* 左侧日历主体 */
.calendar-main {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  min-width: 0;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.year-nav {
  display: flex;
  align-items: center;
  gap: 12px;
}

.year-label {
  font-size: 20px;
  font-weight: 700;
  color: #303133;
  min-width: 80px;
  text-align: center;
}

.stats {
  display: flex;
  gap: 20px;
  font-size: 14px;
  color: #606266;
}

.stats strong {
  color: #303133;
  font-size: 18px;
  margin: 0 2px;
}

/* 3列×4行月份网格 */
.months-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.month-card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 10px;
}

.month-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  text-align: center;
  margin-bottom: 6px;
}

.weekday-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  margin-bottom: 4px;
}

.weekday {
  font-size: 11px;
  color: #909399;
  font-weight: 500;
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.day-cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 12px;
  color: #606266;
  min-height: 28px;
  transition: background-color 0.2s;
}

.day-cell.empty {
  background: transparent;
}

.day-cell.is-weekend .day-num {
  color: #c0c4cc;
}

.day-num {
  font-size: 12px;
  line-height: 1;
  font-weight: 500;
}

/* 右侧图例面板 */
.legend-panel {
  width: 160px;
  flex-shrink: 0;
  border-left: 1px solid #ebeef5;
  padding: 20px 16px;
  overflow-y: auto;
  background: #fafbfc;
}

.legend-title {
  font-size: 14px;
  font-weight: 700;
  color: #303133;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #ebeef5;
}

.legend-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.legend-color {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  flex-shrink: 0;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.legend-city {
  color: #303133;
  font-weight: 500;
  flex: 1;
}

.legend-days {
  color: #909399;
  font-size: 12px;
  flex-shrink: 0;
}
</style>
