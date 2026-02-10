import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import type { RedheadTemplate, Unit } from '../api/types'
import { buildDefaultTemplateA } from '../utils/redheadDefaults'

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  disabled: '已停用',
}

export function RedheadTemplateListPage() {
  const navigate = useNavigate()
  const [units, setUnits] = useState<Unit[]>([])
  const [unitId, setUnitId] = useState('')
  const [list, setList] = useState<RedheadTemplate[]>([])

  const loadUnits = async () => {
    const res = await api.get<Unit[]>('/api/units')
    setUnits(res.data)
    if (!unitId && res.data.length) setUnitId(res.data[0].id)
  }

  const loadTemplates = async (uid: string) => {
    if (!uid) return
    const res = await api.get<RedheadTemplate[]>('/api/redheadTemplates', { params: { unitId: uid } })
    setList(res.data)
  }

  useEffect(() => {
    void loadUnits()
  }, [])

  useEffect(() => {
    if (unitId) {
      void loadTemplates(unitId)
    }
  }, [unitId])

  const createTemplate = async () => {
    if (!unitId) return
    const payload = buildDefaultTemplateA(unitId)
    const res = await api.post<{ id: string }>('/api/redheadTemplates', payload)
    navigate(`/redheads/${res.data.id}`)
  }

  const publishTemplate = async (id: string) => {
    const res = await api.post<{ errors: string[]; warnings: string[] }>(`/api/redheadTemplates/${id}/publish`)
    if (res.data.errors.length) {
      alert(`发布失败：\n${res.data.errors.join('\n')}`)
      return
    }
    if (res.data.warnings.length) {
      alert(`发布成功（含警告）：\n${res.data.warnings.join('\n')}`)
    }
    await loadTemplates(unitId)
  }

  const cloneTemplate = async (id: string) => {
    const res = await api.post<{ id: string }>(`/api/redheadTemplates/${id}/clone`)
    navigate(`/redheads/${res.data.id}`)
  }

  const setDefault = async (id: string) => {
    await api.post(`/api/redheadTemplates/${id}/setDefault`)
    await loadTemplates(unitId)
  }

  const disable = async (id: string) => {
    await api.post(`/api/redheadTemplates/${id}/disable`)
    await loadTemplates(unitId)
  }

  return (
    <div className="page">
      <div className="header-row">
        <Link to="/">返回文档</Link>
        <h2>红头模板列表</h2>
        <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={createTemplate}>
          新建模板
        </button>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>名称</th>
            <th>版本</th>
            <th>状态</th>
            <th>默认</th>
            <th>更新时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {list.map((tpl) => (
            <tr key={tpl.id}>
              <td>{tpl.name}</td>
              <td>{tpl.version}</td>
              <td>{STATUS_LABEL[tpl.status] || tpl.status}</td>
              <td>{tpl.isDefault ? '是' : '否'}</td>
              <td>{new Date(tpl.updatedAt).toLocaleString()}</td>
              <td className="row-gap">
                <button type="button" onClick={() => navigate(`/redheads/${tpl.id}`)}>
                  编辑
                </button>
                <button type="button" onClick={() => cloneTemplate(tpl.id)}>
                  复制
                </button>
                <button type="button" onClick={() => publishTemplate(tpl.id)}>
                  发布
                </button>
                <button type="button" onClick={() => setDefault(tpl.id)}>
                  设默认
                </button>
                <button type="button" onClick={() => disable(tpl.id)}>
                  停用
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
