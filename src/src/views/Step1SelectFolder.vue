<template>
  <div class="step1-container">
    <!-- 未选择文件夹：居中引导界面 -->
    <div v-if="!hasFolder" class="select-guide">
      <el-icon class="folder-icon" :size="64" color="#409eff">
        <Folder />
      </el-icon>
      <h2 class="guide-title">选择发票文件夹</h2>
      <p class="guide-subtitle">请选择包含发票文件（PDF、XML、OFD）的文件夹</p>
      <el-button
        type="primary"
        size="large"
        :loading="scanning || extracting"
        @click="selectFolder"
      >
        <el-icon><FolderOpened /></el-icon>
        {{ extracting ? '正在解压...' : '选择文件夹' }}
      </el-button>

      <!-- 功能说明区 -->
      <div class="features-section">
        <div class="features-title">
          <el-icon :size="18" color="#409eff"><Star /></el-icon>
          <span>这个工具能帮你做什么</span>
        </div>
        <div class="features-grid">
          <div class="feature-card" v-for="(item, idx) in features" :key="idx">
            <div class="feature-index">{{ idx + 1 }}</div>
            <el-icon class="feature-icon" :size="22" :color="item.color">
              <component :is="item.icon" />
            </el-icon>
            <div class="feature-body">
              <div class="feature-title">{{ item.title }}</div>
              <div class="feature-desc">{{ item.desc }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 计划功能区 -->
      <div class="features-section planned-section">
        <div class="features-title">
          <el-icon :size="18" color="#e6a23c"><Clock /></el-icon>
          <span>即将上线</span>
          <el-tag size="small" type="warning" effect="plain" round>Coming Soon</el-tag>
        </div>
        <div class="features-grid">
          <div class="feature-card planned-card" v-for="(item, idx) in plannedFeatures" :key="idx">
            <el-tag class="planned-badge" size="small" type="warning" effect="dark" round>开发中</el-tag>
            <el-icon class="feature-icon" :size="22" :color="item.color">
              <component :is="item.icon" />
            </el-icon>
            <div class="feature-body">
              <div class="feature-title">{{ item.title }}</div>
              <div class="feature-desc">{{ item.desc }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 已选择文件夹：扫描结果卡片 -->
    <div v-else class="result-section">
      <!-- 文件夹信息卡片 -->
      <el-card shadow="hover" class="folder-info-card">
        <div class="folder-info-header">
          <el-icon :size="24" color="#409eff"><FolderOpened /></el-icon>
          <span class="folder-name">{{ folderName }}</span>
          <el-button text type="primary" @click="selectFolder" :loading="scanning">
            重新选择
          </el-button>
        </div>

        <!-- 解压状态提示 -->
        <div v-if="extractStatus" class="extract-status">
          <el-icon :size="16" color="#e6a23c"><FolderOpened /></el-icon>
          <span>{{ extractStatus }}</span>
        </div>

        <!-- 解压失败详情 -->
        <div v-if="extractErrors.length > 0" class="extract-errors">
          <el-alert type="warning" :closable="false" show-icon title="以下压缩包解压失败：">
            <ul class="error-list">
              <li v-for="(err, idx) in extractErrors" :key="idx">
                <strong>{{ err.name }}</strong>：{{ err.error }}
              </li>
            </ul>
          </el-alert>
        </div>

        <div class="stats-row">
          <div class="stat-item">
            <div class="stat-value">{{ pdfCount }}</div>
            <div class="stat-label">
              <el-icon :size="16" color="#e6a23c"><Document /></el-icon>
              PDF 文件
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ xmlCount }}</div>
            <div class="stat-label">
              <el-icon :size="16" color="#67c23a"><Tickets /></el-icon>
              XML 文件
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ ofdCount }}</div>
            <div class="stat-label">
              <el-icon :size="16" color="#9b59b6"><Tickets /></el-icon>
              OFD 配套
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ pairedCount }}</div>
            <div class="stat-label">
              <el-icon :size="16" color="#409eff"><Connection /></el-icon>
              已配对
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ totalCount }}</div>
            <div class="stat-label">总文件数</div>
          </div>
        </div>

        <!-- 空文件夹提示 -->
        <el-empty
          v-if="totalCount === 0"
          description="未找到 PDF、XML 或 OFD 文件"
          :image-size="80"
        />
      </el-card>

      <!-- 文件列表（可展开） -->
      <el-card v-if="totalCount > 0" shadow="hover" class="file-list-card">
        <template #header>
          <div class="file-list-header" @click="fileListExpanded = !fileListExpanded">
            <span>文件列表（共 {{ totalCount }} 个）</span>
            <el-icon :class="{ 'expand-icon-rotated': fileListExpanded }">
              <ArrowDown />
            </el-icon>
          </div>
        </template>

        <div v-show="fileListExpanded">
          <el-table
            :data="paginatedFiles"
            stripe
            size="small"
            :max-height="320"
          >
            <el-table-column prop="name" label="文件名" min-width="200">
              <template #default="{ row }">
                <el-icon :size="16" :color="row.type === 'pdf' ? '#e6a23c' : row.type === 'ofd' ? '#9b59b6' : '#67c23a'">
                  <component :is="row.type === 'pdf' ? Document : Tickets" />
                </el-icon>
                <span class="file-name-text">{{ row.name }}</span>
                <el-tag
                  v-if="row.pairedTo"
                  size="small"
                  type="success"
                  class="paired-tag"
                >
                  已配对
                </el-tag>
                <el-tag
                  v-if="row.type === 'ofd'"
                  size="small"
                  type="warning"
                  class="paired-tag"
                >
                  OFD数据源
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="type" label="类型" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="row.type === 'pdf' ? 'warning' : row.type === 'ofd' ? 'danger' : 'success'" size="small" effect="plain">
                  {{ row.type.toUpperCase() }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="size" label="大小" width="100" align="center">
              <template #default="{ row }">
                {{ formatSize(row.size) }}
              </template>
            </el-table-column>
            <el-table-column label="配对文件" min-width="180">
              <template #default="{ row }">
                <span v-if="row.pairedTo" class="paired-file-text">{{ row.pairedTo }}</span>
                <span v-else class="unpaired-text">—</span>
              </template>
            </el-table-column>
          </el-table>

          <!-- 分页 -->
          <div v-if="totalCount > pageSize" class="pagination-wrapper">
            <el-pagination
              v-model:current-page="currentPage"
              :page-size="pageSize"
              :total="totalCount"
              layout="prev, pager, next"
              small
            />
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import JSZip from 'jszip'
import {
  Folder,
  FolderOpened,
  Document,
  Tickets,
  Connection,
  ArrowDown,
  Star,
  Promotion,
  Files,
  CircleCheck,
  FolderAdd,
  EditPen,
  Clock,
  Box,
  Printer,
  DataAnalysis,
  Calendar
} from '@element-plus/icons-vue'
import { useSessionStore } from '@/stores/session'

const sessionStore = useSessionStore()

// 首页功能说明
const features = [
  {
    icon: FolderOpened,
    color: '#409eff',
    title: '一键识别整个文件夹',
    desc: '选择发票所在的文件夹，自动识别每张发票的类型（PDF / XML / OFD）和发票内容。'
  },
  {
    icon: Promotion,
    color: '#67c23a',
    title: '交通费智能识别',
    desc: '火车票、机票等交通费发票自动识别出发地和终点，根据交通费日期自动计算出差天数和出差补助。'
  },
  {
    icon: Files,
    color: '#e6a23c',
    title: '费用类别自动分类',
    desc: '自动识别打车费、住宿费、装订费、餐饮费、办公用品费等费用类别。'
  },
  {
    icon: CircleCheck,
    color: '#f56c6c',
    title: '财务制度自动纠错',
    desc: '普通发票检查是否有对应的 XML 格式发票；住宿费发票备注是否填写入住人、是否有对应水单；机票是否含乘机人信息等。'
  },
  {
    icon: FolderAdd,
    color: '#9b59b6',
    title: '按类别自动归档',
    desc: '识别完成后，发票自动按费用类别存入对应的发票文件夹，归档清晰、命名规范。'
  },
  {
    icon: EditPen,
    color: '#409eff',
    title: '一键生成报销单',
    desc: '发票金额按类别自动填入报销单，自动填写大写金额，一键导出 Excel 报销单。'
  },
  {
    icon: Box,
    color: '#e6a23c',
    title: '压缩包自动解压',
    desc: '自动解压目标文件夹下的所有压缩包（.zip 等），再统一进行发票识别处理，无需手动拆包。'
  },
  {
    icon: DataAnalysis,
    color: '#9b59b6',
    title: '任务记录与发票去重',
    desc: '自动记录每次发票整理的历史任务；下次报销时识别并过滤已报销过的发票，避免重复报销。'
  },
  {
    icon: Calendar,
    color: '#67c23a',
    title: '出差日历',
    desc: '根据交通费发票日期自动汇总出差行程，以日历视图直观展示每次出差的时间、地点和费用明细。'
  },
  {
    icon: Printer,
    color: '#67c23a',
    title: 'PDF 合并与拼版打印',
    desc: '将多张发票 PDF 合并为一份，方便集中打印；提供“拼接（一张两页）”和“不拼接（一张一页）”两种方式可选。'
  }
]

// 计划实现的功能（即将上线）
const plannedFeatures = [
]

// UI 状态
const scanning = ref(false)
const extracting = ref(false)
const extractStatus = ref('')
const extractErrors = ref([])  // [{name, error}]
const folderName = ref('')
const fileListExpanded = ref(true)
const currentPage = ref(1)
const pageSize = 20

// 是否已选择文件夹
const hasFolder = computed(() => sessionStore.sourceDirHandle !== null)

// 文件统计
const pdfCount = computed(() => sessionStore.files.filter(f => f.type === 'pdf').length)
const xmlCount = computed(() => sessionStore.files.filter(f => f.type === 'xml').length)
const totalCount = computed(() => sessionStore.files.length)
const ofdCount = computed(() => sessionStore.files.filter(f => f.type === 'ofd').length)
const pairedCount = computed(() => sessionStore.files.filter(f => f.pairedTo).length / 2)

// 分页文件列表
const paginatedFiles = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return sessionStore.files.slice(start, start + pageSize)
})

// 选择文件夹
async function selectFolder() {
  try {
    const dirHandle = await window.showDirectoryPicker()
    sessionStore.sourceDirHandle = dirHandle
    folderName.value = dirHandle.name
    scanning.value = true

    // 先解压压缩包
    extracting.value = true
    extractStatus.value = '正在扫描压缩包...'
    extractErrors.value = []
    const extractResult = await extractZipFiles(dirHandle)
    extracting.value = false
    if (extractResult.zipCount > 0) {
      const failedCount = extractResult.zipCount - (extractResult.successZipCount ?? extractResult.zipCount)
      if (failedCount > 0) {
        extractStatus.value = `解压完成：${extractResult.successZipCount} 个成功，${failedCount} 个失败，共提取 ${extractResult.totalExtracted} 个文件`
        extractErrors.value = extractResult.errors || []
      } else {
        extractStatus.value = `已解压 ${extractResult.zipCount} 个压缩包，共提取 ${extractResult.totalExtracted} 个文件`
        extractErrors.value = []
      }
    } else {
      extractStatus.value = ''
      extractErrors.value = []
    }

    // 扫描文件夹
    const files = []
    await scanRecursive(dirHandle, '', files)

    // 自动配对
    pairFiles(files)

    sessionStore.files = files
    currentPage.value = 1
    fileListExpanded.value = true

    if (files.length === 0) {
      ElMessage.warning('该文件夹中未找到 PDF、XML 或 OFD 文件')
    } else {
      const ofdPairedCount = files.filter(f => f.type === 'ofd' && f.pairedTo).length
      let msg = `扫描完成，共发现 ${files.length} 个发票文件`
      if (ofdPairedCount > 0) {
        msg += `（含 ${ofdPairedCount} 个OFD配套文件）`
      }
      ElMessage.success(msg)
    }
  } catch (e) {
    if (e.name === 'AbortError') return // 用户取消选择
    ElMessage.error('选择文件夹失败：' + e.message)
  } finally {
    scanning.value = false
  }
}

// 递归查找所有 .zip 文件
async function findZipFilesRecursive(dirHandle, path, results) {
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.zip')) {
      results.push({ handle: entry, parentDir: dirHandle, path: path ? `${path}/${entry.name}` : entry.name })
    } else if (entry.kind === 'directory') {
      const subHandle = await dirHandle.getDirectoryHandle(entry.name)
      await findZipFilesRecursive(subHandle, path ? `${path}/${entry.name}` : entry.name, results)
    }
  }
}

// 解压所有压缩包，将发票相关文件写入zip所在目录
async function extractZipFiles(dirHandle) {
  const zipFiles = []
  await findZipFilesRecursive(dirHandle, '', zipFiles)

  if (zipFiles.length === 0) return { zipCount: 0, totalExtracted: 0 }

  const validExts = ['.pdf', '.xml', '.ofd']
  let totalExtracted = 0
  let successZipCount = 0
  const errors = []  // 记录失败详情

  for (const { handle, parentDir } of zipFiles) {
    try {
      const file = await handle.getFile()
      const arrayBuffer = await file.arrayBuffer()
      const zip = await JSZip.loadAsync(arrayBuffer)

      // 直接从ZIP二进制中央目录按顺序提取GBK解码的文件名
      // 与 JSZip 条目按索引位置一一对应（JSZip 按中央目录顺序加载）
      const gbkNames = extractGbkFileNames(arrayBuffer)
      const jsZipEntries = Object.entries(zip.files)

      // 诊断日志
      if (gbkNames.length > 0) {
        console.log('[ZIP解码诊断]', {
          gbkCount: gbkNames.length,
          jsZipCount: jsZipEntries.length,
          sample: gbkNames.slice(0, 3)
        })
      }

      for (let idx = 0; idx < jsZipEntries.length; idx++) {
        const [, zipEntry] = jsZipEntries[idx]
        if (zipEntry.dir) continue

        // 按索引位置匹配GBK解码名
        const decodedFilename = gbkNames[idx] || zipEntry.name

        // 只取文件名部分（zip内可能含子目录路径）
        const rawName = decodedFilename.split('/').pop()
        const ext = rawName.toLowerCase().substring(rawName.lastIndexOf('.'))
        if (!validExts.includes(ext)) continue

        // 跳过隐藏文件（如 __MACOSX 开头）
        if (decodedFilename.startsWith('__MACOSX') || rawName.startsWith('.')) continue

        // 清洗文件名：去除文件系统 API 不允许的非法字符
        const baseName = sanitizeFileName(rawName, ext)
        if (!baseName) continue // 清洗后文件名为空则跳过

        // 生成不冲突的文件名：若已存在则加序号后缀
        const finalName = await resolveConflictName(parentDir, baseName)
        if (!finalName) continue // 极端情况，无法生成文件名则跳过

        // 写入文件
        const content = await zipEntry.async('arraybuffer')
        const newFileHandle = await parentDir.getFileHandle(finalName, { create: true })
        const writable = await newFileHandle.createWritable()
        await writable.write(content)
        await writable.close()
        totalExtracted++
      }
      successZipCount++
    } catch (e) {
      console.warn(`解压压缩包 [${handle.name}] 失败:`, e)
      errors.push({ name: handle.name, error: e.message || String(e) })
    }
  }

  return { zipCount: zipFiles.length, totalExtracted, successZipCount, errors }
}

/**
 * 直接从ZIP二进制数据的中央目录中按顺序提取GBK解码的文件名
 * @param {ArrayBuffer} arrayBuffer - ZIP文件的完整二进制数据
 * @returns {string[]} 按中央目录顺序排列的GBK解码文件名数组
 */
function extractGbkFileNames(arrayBuffer) {
  const names = []
  try {
    const view = new DataView(arrayBuffer)
    const bytes = new Uint8Array(arrayBuffer)
    const len = bytes.length

    // 1. 找到 End of Central Directory Record (EOCD)
    let eocdOffset = -1
    for (let i = len - 22; i >= Math.max(0, len - 65557); i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocdOffset = i
        break
      }
    }
    if (eocdOffset === -1) return names

    // 2. 从EOCD获取中央目录信息
    const cdEntryCount = view.getUint16(eocdOffset + 10, true)
    const cdOffset = view.getUint32(eocdOffset + 16, true)

    // 3. 遍历中央目录条目，按顺序提取文件名
    let pos = cdOffset
    for (let i = 0; i < cdEntryCount && pos < len - 46; i++) {
      if (view.getUint32(pos, true) !== 0x02014b50) break

      const fileNameLen = view.getUint16(pos + 28, true)
      const extraFieldLen = view.getUint16(pos + 30, true)
      const commentLen = view.getUint16(pos + 32, true)

      const nameStart = pos + 46
      const rawNameBytes = bytes.slice(nameStart, nameStart + fileNameLen)

      // 用GBK解码原始字节
      const decoded = new TextDecoder('gbk', { fatal: false }).decode(rawNameBytes)

      if (decoded.includes('\uFFFD')) {
        // GBK 解码失败，回退到 Latin1
        let fallback = ''
        for (let j = 0; j < rawNameBytes.length; j++) {
          fallback += String.fromCharCode(rawNameBytes[j])
        }
        names.push(fallback)
      } else {
        names.push(decoded)
      }

      pos = nameStart + fileNameLen + extraFieldLen + commentLen
    }
  } catch (e) {
    console.warn('解析ZIP中央目录失败:', e)
  }
  return names
}

/**
 * 清洗文件名，去除 File System Access API 不允许的字符
 * Windows 禁用字符：< > : " / \ | ? * 以及控制字符
 * 文件名不能以空格或点号结尾
 */
function sanitizeFileName(rawName, ext) {
  // 分离文件名和扩展名
  const dotIdx = rawName.lastIndexOf('.')
  let namePart = dotIdx > 0 ? rawName.substring(0, dotIdx) : rawName
  const extPart = dotIdx > 0 ? rawName.substring(dotIdx) : ext

  // 去除 Windows 禁用字符
  namePart = namePart.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')

  // 去除首尾空格和点号
  namePart = namePart.replace(/^[\s.]+|[\s.]+$/g, '').trim()

  // 如果清洗后文件名为空，使用默认名
  if (!namePart) namePart = 'extracted'

  return namePart + extPart
}

// 解决文件名冲突：若目标目录已存在同名文件，自动加 _1, _2 ... 后缀
async function resolveConflictName(dirHandle, baseName) {
  const dotIdx = baseName.lastIndexOf('.')
  const nameWithoutExt = dotIdx > 0 ? baseName.substring(0, dotIdx) : baseName
  const ext = dotIdx > 0 ? baseName.substring(dotIdx) : ''

  // 先尝试原始文件名
  try {
    await dirHandle.getFileHandle(baseName)
    // 文件已存在，需要加序号
  } catch {
    // 文件不存在，直接使用原始文件名
    return baseName
  }

  // 尝试加序号后缀，最多尝试 999 个
  for (let i = 1; i <= 999; i++) {
    const candidate = `${nameWithoutExt}_${i}${ext}`
    try {
      await dirHandle.getFileHandle(candidate)
      // 仍然存在，继续尝试
    } catch {
      return candidate
    }
  }
  return null // 极端情况
}

// 递归扫描文件夹
// 已知的非发票文件关键词（文件名包含这些词则跳过）
const NON_INVOICE_KEYWORDS = [
  '运单明细',   // 顺丰等快递的运单详情
  '发票运单',   // 运单明细的另一种命名
]

async function scanRecursive(dirHandle, path, results) {
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      const name = entry.name.toLowerCase()
      if (name.endsWith('.pdf') || name.endsWith('.xml') || name.endsWith('.ofd')) {
        // 跳过已知的非发票文件（如快递运单明细）
        if (NON_INVOICE_KEYWORDS.some(kw => entry.name.includes(kw))) {
          console.log(`[扫描] 跳过非发票文件: ${entry.name}`)
          continue
        }
        const file = await entry.getFile()
        let type = 'xml'
        if (name.endsWith('.pdf')) type = 'pdf'
        else if (name.endsWith('.ofd')) type = 'ofd'
        results.push({
          name: entry.name,
          path: path ? `${path}/${entry.name}` : entry.name,
          type,
          size: file.size,
          fileHandle: entry,
          pairedTo: null
        })
      }
    } else if (entry.kind === 'directory') {
      const subHandle = await dirHandle.getDirectoryHandle(entry.name)
      await scanRecursive(subHandle, path ? `${path}/${entry.name}` : entry.name, results)
    }
  }
}

// 自动配对 PDF 和 XML/OFD（同名文件配对）
function pairFiles(files) {
  const pdfFiles = files.filter(f => f.type === 'pdf')
  const xmlFiles = files.filter(f => f.type === 'xml')
  const ofdFiles = files.filter(f => f.type === 'ofd')

  for (const pdf of pdfFiles) {
    const baseName = pdf.name.replace(/\.pdf$/i, '')

    // 优先配对 XML
    const matchXml = xmlFiles.find(x =>
      x.name.replace(/\.xml$/i, '') === baseName
    )
    if (matchXml) {
      pdf.pairedTo = matchXml.name
      matchXml.pairedTo = pdf.name
    }

    // 配对 OFD：OFD 作为 PDF 的配套数据源，标记在 pdf 上
    const matchOfd = ofdFiles.find(o =>
      o.name.replace(/\.ofd$/i, '') === baseName
    )
    if (matchOfd) {
      pdf.companionOfdHandle = matchOfd.fileHandle
      pdf.companionOfdName = matchOfd.name
      // OFD 标记为已配对（但不在 pairedTo 中显示，避免重复计数）
      matchOfd.pairedTo = pdf.name
    }
  }
}

// 格式化文件大小
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
</script>

<style scoped>
.step1-container {
  max-width: 880px;
  margin: 0 auto;
}

/* 未选择时的引导界面 */
.select-guide {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px 40px;
  min-height: 400px;
}

.folder-icon {
  margin-bottom: 24px;
}

.guide-title {
  font-size: 22px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.guide-subtitle {
  font-size: 14px;
  color: #909399;
  margin-bottom: 32px;
}

/* 功能说明区 */
.features-section {
  width: 100%;
  margin-top: 56px;
  padding-top: 32px;
  border-top: 1px dashed #e4e7ed;
}

.features-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 20px;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

.feature-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px 14px 18px;
  background: #fafbfc;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  transition: all 0.2s;
}

.feature-card:hover {
  background: #fff;
  border-color: #c6e2ff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.08);
  transform: translateY(-1px);
}

.feature-index {
  position: absolute;
  top: 10px;
  right: 12px;
  font-size: 11px;
  font-weight: 700;
  color: #c0c4cc;
  letter-spacing: 0.5px;
}

.feature-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.feature-body {
  flex: 1;
  min-width: 0;
}

.feature-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.feature-desc {
  font-size: 12.5px;
  line-height: 1.6;
  color: #606266;
}

@media (max-width: 720px) {
  .features-grid {
    grid-template-columns: 1fr;
  }
}

/* 计划功能区：用更柔和的视觉区分 */
.planned-section {
  margin-top: 28px;
  padding-top: 24px;
}

.planned-section .features-title {
  color: #b88230;
}

.planned-card {
  background: linear-gradient(180deg, #fffaf2 0%, #fdf6ec 100%);
  border: 1px dashed #e6a23c;
}

.planned-card:hover {
  background: #fff;
  border-color: #e6a23c;
  border-style: solid;
  box-shadow: 0 2px 8px rgba(230, 162, 60, 0.15);
}

.planned-badge {
  position: absolute;
  top: 10px;
  right: 12px;
}

.planned-card .feature-title {
  color: #5a4423;
}

.planned-card .feature-desc {
  color: #7a6342;
}

/* 已选择后的结果区域 */
.result-section {
  padding-top: 8px;
}

/* 文件夹信息卡片 */
.folder-info-card {
  margin-bottom: 16px;
}

.folder-info-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
}

.folder-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  flex: 1;
}

/* 统计行 */
.stats-row {
  display: flex;
  gap: 32px;
  justify-content: center;
  padding: 12px 0;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
  line-height: 1.2;
}

.stat-label {
  font-size: 13px;
  color: #909399;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 4px;
}

/* 文件列表卡片 */
.file-list-card {
  margin-bottom: 16px;
}

.file-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
  font-weight: 600;
}

.file-list-header .el-icon {
  transition: transform 0.3s;
}

.expand-icon-rotated {
  transform: rotate(180deg);
}

.file-name-text {
  margin-left: 6px;
}

.paired-tag {
  margin-left: 8px;
}

.paired-file-text {
  color: #67c23a;
  font-size: 13px;
}

.unpaired-text {
  color: #c0c4cc;
}

/* 解压状态提示 */
.extract-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #e6a23c;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: #fdf6ec;
  border-radius: 6px;
}

/* 解压失败详情 */
.extract-errors {
  margin-bottom: 12px;
}

.extract-errors .el-alert {
  padding: 10px 14px;
}

.error-list {
  margin: 8px 0 0 0;
  padding-left: 18px;
  font-size: 12px;
  line-height: 1.8;
  color: #606266;
}

.error-list li {
  word-break: break-all;
}

.error-list strong {
  color: #e6a23c;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 12px;
}
</style>