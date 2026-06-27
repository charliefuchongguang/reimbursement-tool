# 技术架构文档

> 项目：招标代理公司出差报销辅助工具（Reimbursement Helper）
> 开发工具：Qoder
> 状态：✅ 已确认

---

## 一、技术栈

| 层级 | 技术选择 | 选择理由 |
|---|---|---|
| **前端框架** | **Vue 3 + Vite** | 组件化、状态管理成熟；Vite 开发体验好、构建快；对 Qoder 生成代码友好 |
| **语言** | **JavaScript (不用 TypeScript)** | 降低心智负担，小白用户改起来没顾虑；类型检查非必需 |
| **UI 组件库** | **Element Plus** | 表格/表单/步骤条/进度条等组件齐全且成熟，企业级工具首选 |
| **图标** | **Element Plus Icons + Lucide Vue** | 组件库自带图标补充 |
| **PDF 解析** | **pdfjs-dist**（Mozilla 官方） | 纯前端，抽取文本型 PDF 文字，业界标准 |
| **XML 解析** | **浏览器原生 DOMParser** | 无需任何库，XML 发票结构简单 |
| **Excel 读写** | **ExcelJS** | **关键依赖**：能完整保留模板的合并单元格、样式、公式（SheetJS 社区版做不到） |
| **HTTP 客户端** | **原生 fetch** | 无需第三方 |
| **日期处理** | **dayjs** | 小体积，API 友好 |
| **文件系统** | **File System Access API**（浏览器原生） | 仅 Chrome/Edge；无需任何库 |
| **状态管理** | **Vue 3 Composition API + Pinia** | Pinia 是 Vue 官方推荐，比 Vuex 简单 |
| **数据存储** | **localStorage** | 个人信息 + API Key，5MB 足够 |
| **AI 服务** | **DeepSeek API（chat completions）** | 兼容 OpenAI 协议，CORS 友好，价格便宜 |
| **中文数字大写** | 自写工具函数 `numberToChinese(num)` | 20 行代码搞定，无需引库 |

---

## 二、项目结构

```
自动报销工具/
├── PRDS/                          # 产品文档（本文件夹）
│   ├── requirements.md
│   ├── PRD.md
│   ├── UI.md
│   └── tech.md
├── notes/                         # 报销单模板原件（只读参考）
│   └── 新差旅费报销单-2025-11-14.xlsx
├── public/
│   └── template.xlsx              # 报销单模板（复制自 notes/，供运行时 fetch 读取）
├── src/
│   ├── main.js                    # 入口，挂载 Vue 应用、注册 Element Plus
│   ├── App.vue                    # 根组件，顶部导航 + 步骤条 + 主内容路由
│   │
│   ├── components/                # 可复用 UI 组件
│   │   ├── AppHeader.vue          # 顶部导航栏 + 设置按钮
│   │   ├── StepsBar.vue           # 步骤条
│   │   ├── SettingsDialog.vue     # ⚙️ 设置弹窗（个人信息 + API Key）
│   │   ├── ComplianceList.vue     # 问题清单组件
│   │   ├── InvoiceDetailPanel.vue # 发票详情展开面板
│   │   └── ManualAddDialog.vue    # 手动录入发票弹窗
│   │
│   ├── views/                     # 每一步一个 View
│   │   ├── Step1SelectFolder.vue
│   │   ├── Step2ReviewInvoices.vue
│   │   ├── Step3FillInfo.vue
│   │   └── Step4Generate.vue
│   │
│   ├── services/                  # 业务逻辑（纯 JS，可独立测试）
│   │   ├── pdfParser.js           # pdfjs-dist 抽文本
│   │   ├── xmlParser.js           # DOMParser 解析 XML 发票
│   │   ├── deepseekClient.js      # DeepSeek API 封装
│   │   ├── classifier.js          # 发票 10 类分类逻辑
│   │   ├── transportChecker.js    # 交通费链路校验
│   │   ├── compliance.js          # F5 合规性检查规则
│   │   ├── archiver.js            # File System Access API 归档
│   │   └── excelGenerator.js     # ExcelJS 填模板并导出
│   │
│   ├── stores/                    # Pinia stores
│   │   ├── settings.js            # 个人信息 + API Key（持久化 localStorage）
│   │   ├── session.js             # 本次识别的发票数据（会话级，不持久化）
│   │   └── form.js                # 第 3 步表单数据
│   │
│   └── utils/
│       ├── numberToChinese.js     # 数字 → 中文大写
│       ├── storage.js             # localStorage 读写封装
│       └── constants.js           # 10 个类别常量、关键字列表等
│
├── index.html
├── vite.config.js
├── package.json
└── README.md
```

---

## 三、数据结构

### 1. Pinia Store: `settings`（持久化到 localStorage）

```javascript
{
  profile: {
    department: "招标一部",   // 部门
    reimburser: "张三"        // 出差人
  },
  deepseekApiKey: "sk-xxxxxx"  // 单独存 key 名: reimbursement-helper.deepseek-api-key
}
```

### 2. Pinia Store: `session`（会话级，关页就清）

```javascript
{
  sourceDirHandle: FileSystemDirectoryHandle,  // 源目录
  invoices: [
    {
      id: "uuid",
      fileName: "发票1.pdf",
      fileHandle: FileSystemFileHandle,          // 用于复制
      companionFileHandle: FileSystemFileHandle, // 配套 XML（可选）
      category: "01_交通费",      // 10 类之一
      invoiceType: "电子专票 | 电子普票 | 火车票 | 行程单",
      invoiceNo: "12345678",
      issueDate: "2026-05-01",
      amount: 1280.00,
      amountTax: 71.68,
      seller: "中国国际航空股份有限公司",
      remark: "乘机人:张三 航班:CA1234 ...",
      // 交通/打车专用字段
      origin: "北京",
      destination: "上海",
      transportTool: "飞机",       // 飞机 | 火车 | 其他
      passenger: "张三",
      flightNo: "CA1234",
      // 识别状态
      status: "ok | warning | error | manual",
      confidence: 0.92,
      issues: [                    // 该发票的合规问题
        { code: "missing_xml", severity: "warn", msg: "..." }
      ]
    }
  ],
  globalIssues: [                  // 跨发票问题（如链路断裂）
    { code: "transport_chain_broken", severity: "error", msg: "..." }
  ]
}
```

### 3. Pinia Store: `form`（第 3 步）

```javascript
{
  projectCode: "BJ-001",              // 项目简写
  reason: "XX 项目现场评标",          // 出差事由
  reimburseDate: "2026-05-13",        // 报销日期（默认今天）
  agencyFee: 0,                       // 代理费及标书款（可空）
  prepaidAmount: 0,                   // 予借旅费
  // 下面是派生计算（通过 computed）
  tripDays: 3,                        // 自动算
  subsidy: 210,                       // 天数 × 70
  totalAmount: 3250,                  // 总额
  transferAmount: 3250,               // 转账（= total）
  supplementAmount: 0,                // 补领
  refundAmount: 0                     // 退还
}
```

### 4. localStorage Keys

| Key | 内容 |
|---|---|
| `reimbursement-helper.profile` | JSON：`{department, reimburser}` |
| `reimbursement-helper.deepseek-api-key` | 字符串：API Key |

---

## 四、关键实现说明

### 1. PDF 识别（pdfjs-dist）

```javascript
import * as pdfjs from 'pdfjs-dist';
pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs-worker.js';

export async function extractPdfText(fileHandle) {
  const file = await fileHandle.getFile();
  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(it => it.str).join('\n');
  }
  return text;
}
```

### 2. XML 发票解析（原生 DOMParser）

```javascript
export async function parseXmlInvoice(fileHandle) {
  const file = await fileHandle.getFile();
  const xmlStr = await file.text();
  const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');
  return {
    invoiceNo: doc.querySelector('InvoiceNo')?.textContent,
    issueDate: doc.querySelector('IssueDate')?.textContent,
    amount: Number(doc.querySelector('TotalAmWithTax')?.textContent),
    // ... 其他字段
  };
}
```

### 3. DeepSeek 调用（兼容 OpenAI 协议）

```javascript
export async function callDeepSeek(promptText) {
  const key = localStorage.getItem('reimbursement-helper.deepseek-api-key');
  if (!key) throw new Error('NO_API_KEY');
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是发票信息抽取助手，输出严格 JSON' },
        { role: 'user', content: promptText }
      ],
      response_format: { type: 'json_object' },
      temperature: 0
    })
  });
  if (!res.ok) throw new Error(`API 错误: ${res.status}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}
```

Prompt 思路：把 PDF/XML 抽出来的文本丢给 AI，要求输出标准 JSON，包含类别、金额、出发地、到达地、备注字段等。

### 4. 归档（File System Access API）

```javascript
export async function archiveInvoices(outputRootHandle, folderName, invoices) {
  // 1. 创建根目录：张三+3250+BJ-001/
  const root = await outputRootHandle.getDirectoryHandle(folderName, { create: true });
  // 2. 按类别建子目录并复制文件
  const categoryGroups = groupBy(invoices, 'category');
  for (const [cat, items] of Object.entries(categoryGroups)) {
    const subdir = await root.getDirectoryHandle(cat, { create: true });
    for (const inv of items) {
      await copyFile(inv.fileHandle, subdir);
      if (inv.companionFileHandle) await copyFile(inv.companionFileHandle, subdir);
    }
    // 打车费的行程单单独建子目录
    if (cat === '02_打车费') {
      const rides = items.filter(i => i.invoiceType === '行程单');
      if (rides.length) {
        const ridesDir = await subdir.getDirectoryHandle('行程单', { create: true });
        for (const r of rides) await copyFile(r.fileHandle, ridesDir);
      }
    }
  }
  return root;
}
async function copyFile(fileHandle, targetDir) {
  const file = await fileHandle.getFile();
  const newHandle = await targetDir.getFileHandle(file.name, { create: true });
  const writable = await newHandle.createWritable();
  await writable.write(await file.arrayBuffer());
  await writable.close();
}
```

### 5. Excel 生成（ExcelJS，保留模板格式）

```javascript
import ExcelJS from 'exceljs';

export async function generateReport(formData, invoices, targetDirHandle) {
  // 1. 读取模板
  const templateRes = await fetch('/template.xlsx');
  const templateBuf = await templateRes.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuf);
  const ws = workbook.worksheets[0];

  // 2. 填充字段（保留原格式）
  ws.getCell('D3').value = formData.department;
  ws.getCell('E4').value = formData.reimburser;
  ws.getCell('N4').value = formData.reason;
  // ... 按 PRD 的字段映射表填

  // 3. 交通费逐段填行 7-16
  const trans = invoices.filter(i => i.category === '01_交通费')
                        .sort((a,b) => a.issueDate.localeCompare(b.issueDate));
  trans.forEach((inv, idx) => {
    const row = 7 + idx;
    ws.getCell(`E${row}`).value = inv.origin;
    ws.getCell(`I${row}`).value = inv.destination;
    ws.getCell(`J${row}`).value = inv.transportTool;
    ws.getCell(`K${row}`).value = inv.amount;
  });

  // 4. 其他 9 类在 N7-N16 行（按类别汇总张数/金额）
  // ...

  // 5. 大写金额、转账/补领/退还
  ws.getCell('B18').value = numberToChinese(formData.totalAmount);

  // 6. 保存到用户选择的目录
  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `${formData.reimburser}+${formData.totalAmount}+${formData.projectCode}-差旅费报销单.xlsx`;
  const fh = await targetDirHandle.getFileHandle(fileName, { create: true });
  const writable = await fh.createWritable();
  await writable.write(buffer);
  await writable.close();
  return fileName;
}
```

### 6. 打车费分类判定

```javascript
const STATION_KEYWORDS = ['机场', '火车站', '高铁站', '动车站', '航站楼', 'Airport', 'Station'];

function classifyTaxi(invoice, itineraryDocs) {
  const itin = itineraryDocs.find(d => linkedToInvoice(d, invoice));
  if (!itin) return '02_打车费_市内';
  const legs = itin.legs;
  const hasStation = legs.some(l =>
    STATION_KEYWORDS.some(kw => l.origin.includes(kw) || l.destination.includes(kw))
  );
  const hasCity = legs.some(l =>
    !STATION_KEYWORDS.some(kw => l.origin.includes(kw) || l.destination.includes(kw))
  );
  if (hasStation && !hasCity) return '02_打车费_往返车站';
  return '02_打车费_市内';  // 混合或纯市内都归市内
}
```

### 7. 交通费链路校验

```javascript
export function checkTransportChain(transportInvoices) {
  if (transportInvoices.length === 0) return { ok: true };
  const sorted = [...transportInvoices].sort((a,b) => a.issueDate.localeCompare(b.issueDate));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const issues = [];
  if (!first.origin?.includes('北京')) {
    issues.push({ code: 'first_not_beijing', msg: `首张交通费出发地是「${first.origin}」，应为北京，请检查是否缺票` });
  }
  if (!last.destination?.includes('北京')) {
    issues.push({ code: 'last_not_beijing', msg: `末张交通费到达地是「${last.destination}」，应为北京，请检查是否缺票` });
  }
  return { ok: issues.length === 0, issues };
}
```

---

## 五、开发注意事项（写给 Qoder 的特别提示）

- 使用 **Element Plus 现有组件**，不要手写表格/对话框/步骤条等同类组件
- 数据存储仅用 `localStorage`，key 全部以 `reimbursement-helper.` 为前缀
- **不引入后端**，无 Node 服务；所有功能在浏览器完成
- **严禁硬编码** DeepSeek API Key（通过 `SettingsDialog` 让用户输入）
- Excel 生成**必须用 ExcelJS**，不能用 SheetJS 社区版（无法保留合并单元格样式）
- 报销单模板放 `public/template.xlsx`（代码自拷贝自 `notes/` 目录）
- PDF 识别工作线程：`pdfjs-worker.js` 放 `public/` 下，Vite 配置排除处理
- **发票识别必须串行**（一张完了再下一张），因为 DeepSeek 免费档有 QPS 限制
- 文件复制采用**流式**方式，避免大 PDF 占内存
- 顶部提供"⚠️ 浏览器不支持"的全局检测：`!('showDirectoryPicker' in window)` 时直接显示不支持页面，禁止继续使用

---

## 六、AI API 集成说明

### API Key 管理（强制）

- **严禁硬编码**：代码中不能出现明文 Key
- **localStorage Key**：`reimbursement-helper.deepseek-api-key`
- **必须提供 `SettingsDialog` 组件**，含：输入 / 显示切换 / 测试连接 / 清除 / 保存
- **启动检测**：`onMounted` 时检查无 Key 则自动打开 `SettingsDialog`

### API 调用封装

统一封装在 `src/services/deepseekClient.js`，包含：
- `callDeepSeek(prompt)`：发票信息抽取
- `testConnection()`：设置弹窗里的「测试连接」按钮调用

### 错误处理

- 401 Unauthorized → 提示「API Key 无效或欠费，请到设置里检查」
- 网络错误 → 提示「网络异常，请检查网络或稍后重试」
- 超时 → 单张发票最多等 30 秒，超时跳过并标记

### CORS

- DeepSeek API ✅ 原生支持前端直调，无需代理
- 参考文档：https://api-docs.deepseek.com

---

## 七、依赖版本（package.json 参考）

```json
{
  "dependencies": {
    "vue": "^3.4.0",
    "pinia": "^2.1.0",
    "element-plus": "^2.5.0",
    "@element-plus/icons-vue": "^2.3.0",
    "lucide-vue-next": "^0.300.0",
    "pdfjs-dist": "^4.0.0",
    "exceljs": "^4.4.0",
    "dayjs": "^1.11.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@vitejs/plugin-vue": "^5.0.0"
  }
}
```

---

## 八、启动与构建

```bash
# 安装依赖
npm install

# 本地开发（浏览器自动打开 http://localhost:5173）
npm run dev

# 打包
npm run build
# dist/ 目录下即是可分发的静态文件
# 同事双击 dist/index.html 即可使用（或在内网静态托管）
```
