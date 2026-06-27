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
  DataAnalysis
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
  }
]

// 计划实现的功能（即将上线）
const plannedFeatures = [
  {
    icon: Box,
    color: '#e6a23c',
    title: '压缩包自动解压',
    desc: '先自动解压目标文件夹下的所有压缩包（.zip / .rar 等），再统一进行发票识别处理，无需手动拆包。'
  },
  {
    icon: Printer,
    color: '#67c23a',
    title: 'PDF 合并与拼版打印',
    desc: '将多张发票 PDF 合并为一份，方便集中打印；同时提供"每页一张"和"每页两张"两种拼接方式可选。'
  },
  {
    icon: DataAnalysis,
    color: '#9b59b6',
    title: '任务记录与发票去重',
    desc: '自动记录每次发票整理的历史任务；下次报销时识别并过滤已报销过的发票，避免重复报销。'
  }
]

// UI 状态
const scanning = ref(false)
const extracting = ref(false)
const extractStatus = ref('')
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
    const extractResult = await extractZipFiles(dirHandle)
    extracting.value = false
    if (extractResult.zipCount > 0) {
      const failedCount = extractResult.zipCount - (extractResult.successZipCount ?? extractResult.zipCount)
      if (failedCount > 0) {
        extractStatus.value = `解压完成：${extractResult.successZipCount} 个成功，${failedCount} 个失败，共提取 ${extractResult.totalExtracted} 个文件`
      } else {
        extractStatus.value = `已解压 ${extractResult.zipCount} 个压缩包，共提取 ${extractResult.totalExtracted} 个文件`
      }
    } else {
      extractStatus.value = ''
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

  for (const { handle, parentDir } of zipFiles) {
    try {
      const file = await handle.getFile()
      const zip = await JSZip.loadAsync(await file.arrayBuffer())

      for (const [filename, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue

        // 只取文件名部分（zip内可能含子目录路径）
        const baseName = filename.split('/').pop()
        const ext = baseName.toLowerCase().substring(baseName.lastIndexOf('.'))
        if (!validExts.includes(ext)) continue

        // 跳过隐藏文件（如 __MACOSX 开头）
        if (filename.startsWith('__MACOSX') || baseName.startsWith('.')) continue

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
      // 单个压缩包失败不中断，继续处理后续压缩包
    }
  }

  return { zipCount: zipFiles.length, totalExtracted, successZipCount }
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
async function scanRecursive(dirHandle, path, results) {
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      const name = entry.name.toLowerCase()
      if (name.endsWith('.pdf') || name.endsWith('.xml') || name.endsWith('.ofd')) {
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

.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 12px;
}
</style>