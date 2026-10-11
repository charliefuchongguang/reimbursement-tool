// 10 类别常量
export const CATEGORIES = [
  { id: '01', name: '交通费', folder: '01_交通费' },
  { id: '02', name: '打车费', folder: '02_打车费' },
  { id: '03', name: '住宿费', folder: '03_住宿费' },
  { id: '04', name: '复印装订费', folder: '04_复印装订费' },
  { id: '05', name: '专家评审费', folder: '05_专家评审费' },
  { id: '06', name: '办公用品费', folder: '06_办公用品费' },
  { id: '07', name: '餐饮费', folder: '07_餐饮费' },
  { id: '08', name: '会议费', folder: '08_会议费' },
  { id: '09', name: '快递费', folder: '09_快递费' },
  { id: '10', name: '其他费用', folder: '10_其他费用' }
]

// 车站关键字（用于打车费分类）
export const STATION_KEYWORDS = ['机场', '火车站', '高铁站', '动车站', '航站楼', '站']

// 出差补助标准（默认值，可在填写页修改）
export const DEFAULT_SUBSIDY_PER_DAY = 70
