<template>
  <el-dialog
    :model-value="visible"
    title="手动添加发票"
    width="520px"
    destroy-on-close
    @update:model-value="$emit('update:visible', $event)"
    @close="resetForm"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="90px"
      label-position="right"
    >
      <el-form-item label="类别" prop="category">
        <el-select v-model="form.category" placeholder="请选择类别" style="width: 100%">
          <el-option
            v-for="cat in CATEGORIES"
            :key="cat.id"
            :label="cat.name"
            :value="cat.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="发票号码" prop="invoiceNo">
        <el-input v-model="form.invoiceNo" placeholder="可选" />
      </el-form-item>

      <el-form-item label="开票日期" prop="issueDate">
        <el-date-picker
          v-model="form.issueDate"
          type="date"
          placeholder="选择日期（可选）"
          value-format="YYYY-MM-DD"
          style="width: 100%"
        />
      </el-form-item>

      <!-- 打车费子类型：仅在选择打车费(02)时显示 -->
      <el-form-item v-if="form.category === '02'" label="打车类型" prop="taxiType">
        <el-radio-group v-model="form.taxiType">
          <el-radio value="city">市内打车</el-radio>
          <el-radio value="station">往返车站/机场</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="金额" prop="amount">
        <el-input-number
          v-model="form.amount"
          :min="0"
          :precision="2"
          :step="1"
          placeholder="请输入金额"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="销售方" prop="seller">
        <el-input v-model="form.seller" placeholder="可选" />
      </el-form-item>

      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="form.remark"
          type="textarea"
          :rows="2"
          placeholder="可选"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" @click="handleSubmit">添加</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { CATEGORIES } from '../utils/constants'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:visible', 'add'])

const formRef = ref(null)

const form = reactive({
  category: '',
  invoiceNo: '',
  issueDate: '',
  amount: null,
  seller: '',
  remark: '',
  taxiType: 'city'  // 打车费子类型默认市内
})

const rules = {
  category: [{ required: true, message: '请选择类别', trigger: 'change' }],
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }]
}

function resetForm() {
  form.category = ''
  form.invoiceNo = ''
  form.issueDate = ''
  form.amount = null
  form.seller = ''
  form.remark = ''
  form.taxiType = 'city'
}

async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  const invoice = {
    id: crypto.randomUUID(),
    category: form.category,
    invoiceNo: form.invoiceNo || null,
    issueDate: form.issueDate || null,
    amount: form.amount,
    seller: form.seller || null,
    remark: form.remark || null,
    taxiType: form.category === '02' ? form.taxiType : null,
    status: 'manual',
    issues: [],
    fileName: null,
    fileHandle: null,
    companionFileName: null
  }

  emit('add', invoice)
  emit('update:visible', false)
  resetForm()
}
</script>
