import type { StructuredFields } from '../api/types'

interface Props {
  value: StructuredFields
  onChange: (v: StructuredFields) => void
  disabled?: boolean
}

type TextFieldKey = 'title' | 'mainTo' | 'signOff' | 'date'

export function StructuredFormPanel({ value, onChange, disabled = false }: Props) {
  const setTextField = (key: TextFieldKey, fieldValue: string) => {
    onChange({ ...value, [key]: fieldValue })
  }

  const updateAttachment = (idx: number, name: string) => {
    const next = [...value.attachments]
    next[idx] = { ...next[idx], name }
    onChange({ ...value, attachments: next })
  }

  const addAttachment = () => {
    const nextIndex = value.attachments.length + 1
    onChange({ ...value, attachments: [...value.attachments, { index: nextIndex, name: '' }] })
  }

  const removeAttachment = (idx: number) => {
    const next = value.attachments.filter((_, i) => i !== idx).map((item, i) => ({ ...item, index: i + 1 }))
    onChange({ ...value, attachments: next })
  }

  return (
    <div className="panel structured-panel" aria-disabled={disabled}>
      <h3>结构化要素</h3>
      <label>
        标题
        <input value={value.title} onChange={(e) => setTextField('title', e.target.value)} disabled={disabled} />
      </label>
      <label>
        主送
        <input value={value.mainTo} onChange={(e) => setTextField('mainTo', e.target.value)} disabled={disabled} />
      </label>
      <label>
        落款
        <input value={value.signOff} onChange={(e) => setTextField('signOff', e.target.value)} placeholder="如：资本公司党委" disabled={disabled} />
      </label>
      <label>
        日期
        <input type="date" value={value.date} onChange={(e) => setTextField('date', e.target.value)} disabled={disabled} />
      </label>

      <div className="attachments-box">
        <div className="row-between">
          <span>附件列表</span>
          <button type="button" onClick={addAttachment} disabled={disabled}>
            + 添加
          </button>
        </div>
        {value.attachments.map((item, idx) => (
          <div key={`${item.index}-${idx}`} className="attachment-item">
            <span>{item.index}.</span>
            <input
              placeholder="附件名称"
              value={item.name}
              onChange={(e) => updateAttachment(idx, e.target.value)}
              disabled={disabled}
            />
            <button type="button" onClick={() => removeAttachment(idx)} disabled={disabled}>
              删除
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
