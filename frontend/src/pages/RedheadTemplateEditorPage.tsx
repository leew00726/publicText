import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { api } from '../api/client'
import type { RedheadElement, RedheadTemplate, Unit } from '../api/types'
import { A4RedheadPreview } from '../components/A4RedheadPreview'

function newElement(type: 'text' | 'line'): RedheadElement {
  if (type === 'text') {
    return {
      id: `text-${Date.now()}`,
      enabled: true,
      type,
      bind: 'fixedText',
      fixedText: '新文本',
      visibleIfEmpty: false,
      x: { anchor: 'marginLeft', offsetCm: 0 },
      yCm: 1,
      text: {
        align: 'left',
        font: { family: '仿宋_GB2312', sizePt: 16, bold: false, color: '#000000', letterSpacingPt: 0 },
      },
      line: null,
    }
  }

  return {
    id: `line-${Date.now()}`,
    enabled: true,
    type,
    bind: 'fixedText',
    fixedText: null,
    visibleIfEmpty: false,
    x: { anchor: 'marginLeft', offsetCm: 0 },
    yCm: 2,
    text: null,
    line: { lengthMode: 'contentWidth', lengthCm: null, thicknessPt: 1.5, color: '#D40000' },
  }
}

export function RedheadTemplateEditorPage() {
  const { id } = useParams()
  const [units, setUnits] = useState<Unit[]>([])
  const [tpl, setTpl] = useState<RedheadTemplate | null>(null)
  const [selectedId, setSelectedId] = useState<string>('')
  const [messages, setMessages] = useState<{ errors: string[]; warnings: string[] }>({ errors: [], warnings: [] })

  const load = async () => {
    if (!id) return
    const [uRes, tRes] = await Promise.all([api.get<Unit[]>('/api/units'), api.get<RedheadTemplate>(`/api/redheadTemplates/${id}`)])
    setUnits(uRes.data)
    setTpl(tRes.data)
    if (tRes.data.elements.length) setSelectedId(tRes.data.elements[0].id)
  }

  useEffect(() => {
    void load()
  }, [id])

  const selected = useMemo(() => tpl?.elements.find((e) => e.id === selectedId) || null, [tpl, selectedId])

  const patch = (next: Partial<RedheadTemplate>) => {
    if (!tpl) return
    setTpl({ ...tpl, ...next })
  }

  const patchElement = (id: string, updater: (old: RedheadElement) => RedheadElement) => {
    if (!tpl) return
    patch({ elements: tpl.elements.map((e) => (e.id === id ? updater(e) : e)) })
  }

  const save = async () => {
    if (!tpl) return
    await api.put(`/api/redheadTemplates/${tpl.id}`, {
      name: tpl.name,
      note: tpl.note,
      isDefault: tpl.isDefault,
      page: tpl.page,
      elements: tpl.elements,
    })
    alert('已保存')
  }

  const publish = async () => {
    if (!tpl) return
    await save()
    const res = await api.post<{ errors: string[]; warnings: string[] }>(`/api/redheadTemplates/${tpl.id}/publish`)
    setMessages(res.data)
    if (!res.data.errors.length) {
      await load()
    }
  }

  const moveElement = (id: string, dir: -1 | 1) => {
    if (!tpl) return
    const idx = tpl.elements.findIndex((e) => e.id === id)
    const target = idx + dir
    if (idx < 0 || target < 0 || target >= tpl.elements.length) return
    const next = [...tpl.elements]
    const [item] = next.splice(idx, 1)
    next.splice(target, 0, item)
    patch({ elements: next })
  }

  const addElement = (type: 'text' | 'line') => {
    if (!tpl) return
    const item = newElement(type)
    patch({ elements: [...tpl.elements, item] })
    setSelectedId(item.id)
  }

  const removeElement = (id: string) => {
    if (!tpl) return
    patch({ elements: tpl.elements.filter((e) => e.id !== id) })
    if (selectedId === id) setSelectedId('')
  }

  if (!tpl) return <div className="page">加载中...</div>

  return (
    <div className="page redhead-editor-page">
      <div className="header-row">
        <Link to="/redheads">返回模板列表</Link>
        <h2>红头模板编辑</h2>
        <button type="button" onClick={save}>
          保存
        </button>
        <button type="button" onClick={publish}>
          发布校验并发布
        </button>
      </div>

      <div className="editor-layout redhead-layout">
        <div className="panel">
          <h3>模板信息</h3>
          <label>
            单位
            <select value={tpl.unitId} onChange={(e) => patch({ unitId: e.target.value })}>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            名称
            <input value={tpl.name} onChange={(e) => patch({ name: e.target.value })} />
          </label>
          <label>
            备注
            <textarea value={tpl.note || ''} onChange={(e) => patch({ note: e.target.value })} />
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={tpl.isDefault} onChange={(e) => patch({ isDefault: e.target.checked })} />
            设为默认模板
          </label>

          <div className="readonly-box">
            <p>页面基准（只读）</p>
            <p>A4；边距 上3.7 / 下3.5 / 左2.7 / 右2.5 cm</p>
            <p>版心宽 15.8 cm；顶部安全区 3.7 cm</p>
          </div>

          <div className="row-gap">
            <button type="button" onClick={() => addElement('text')}>
              + 文本元素
            </button>
            <button type="button" onClick={() => addElement('line')}>
              + 红线元素
            </button>
          </div>

          <div className="elements-list">
            {tpl.elements.map((e) => (
              <div key={e.id} className={`element-row ${selectedId === e.id ? 'active' : ''}`}>
                <button type="button" onClick={() => setSelectedId(e.id)}>
                  {e.type} / {e.bind} / y={e.yCm}
                </button>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={e.enabled}
                    onChange={(ev) => patchElement(e.id, (old) => ({ ...old, enabled: ev.target.checked }))}
                  />
                  启用
                </label>
                <button type="button" onClick={() => moveElement(e.id, -1)}>
                  ↑
                </button>
                <button type="button" onClick={() => moveElement(e.id, 1)}>
                  ↓
                </button>
                <button type="button" onClick={() => removeElement(e.id)}>
                  删除
                </button>
              </div>
            ))}
          </div>

          {selected && (
            <div className="selected-editor">
              <h3>当前元素属性</h3>
              <label>
                bind
                <select
                  value={selected.bind}
                  onChange={(e) => patchElement(selected.id, (old) => ({ ...old, bind: e.target.value as RedheadElement['bind'] }))}
                >
                  <option value="unitName">unitName</option>
                  <option value="docNo">docNo</option>
                  <option value="signatory">signatory</option>
                  <option value="copyNo">copyNo</option>
                  <option value="fixedText">fixedText</option>
                </select>
              </label>
              <label>
                y(cm)
                <input
                  type="number"
                  step="0.01"
                  value={selected.yCm}
                  onChange={(e) => patchElement(selected.id, (old) => ({ ...old, yCm: Number(e.target.value) }))}
                />
              </label>
              <label>
                anchor
                <select
                  value={selected.x.anchor}
                  onChange={(e) =>
                    patchElement(selected.id, (old) => ({
                      ...old,
                      x: { ...old.x, anchor: e.target.value as RedheadElement['x']['anchor'] },
                    }))
                  }
                >
                  <option value="marginLeft">marginLeft</option>
                  <option value="center">center</option>
                  <option value="marginRight">marginRight</option>
                </select>
              </label>
              <label>
                x偏移(cm)
                <input
                  type="number"
                  step="0.01"
                  value={selected.x.offsetCm}
                  onChange={(e) =>
                    patchElement(selected.id, (old) => ({ ...old, x: { ...old.x, offsetCm: Number(e.target.value) } }))
                  }
                />
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={selected.visibleIfEmpty || false}
                  onChange={(e) => patchElement(selected.id, (old) => ({ ...old, visibleIfEmpty: e.target.checked }))}
                />
                为空时仍显示
              </label>
              {selected.bind === 'fixedText' && (
                <label>
                  fixedText
                  <input
                    value={selected.fixedText || ''}
                    onChange={(e) => patchElement(selected.id, (old) => ({ ...old, fixedText: e.target.value }))}
                  />
                </label>
              )}

              {selected.type === 'text' && selected.text && (
                <>
                  <label>
                    align
                    <select
                      value={selected.text.align}
                      onChange={(e) =>
                        patchElement(selected.id, (old) => ({
                          ...old,
                          text: { ...old.text!, align: e.target.value as 'left' | 'center' | 'right' },
                        }))
                      }
                    >
                      <option value="left">left</option>
                      <option value="center">center</option>
                      <option value="right">right</option>
                    </select>
                  </label>
                  <label>
                    字体
                    <input
                      value={selected.text.font.family}
                      onChange={(e) =>
                        patchElement(selected.id, (old) => ({
                          ...old,
                          text: { ...old.text!, font: { ...old.text!.font, family: e.target.value } },
                        }))
                      }
                    />
                  </label>
                  <label>
                    字号(pt)
                    <input
                      type="number"
                      step="0.5"
                      value={selected.text.font.sizePt}
                      onChange={(e) =>
                        patchElement(selected.id, (old) => ({
                          ...old,
                          text: { ...old.text!, font: { ...old.text!.font, sizePt: Number(e.target.value) } },
                        }))
                      }
                    />
                  </label>
                  <label>
                    颜色
                    <input
                      value={selected.text.font.color}
                      onChange={(e) =>
                        patchElement(selected.id, (old) => ({
                          ...old,
                          text: { ...old.text!, font: { ...old.text!.font, color: e.target.value } },
                        }))
                      }
                    />
                  </label>
                </>
              )}

              {selected.type === 'line' && selected.line && (
                <>
                  <label>
                    lengthMode
                    <select
                      value={selected.line.lengthMode}
                      onChange={(e) =>
                        patchElement(selected.id, (old) => ({
                          ...old,
                          line: { ...old.line!, lengthMode: e.target.value as 'contentWidth' | 'custom' },
                        }))
                      }
                    >
                      <option value="contentWidth">contentWidth</option>
                      <option value="custom">custom</option>
                    </select>
                  </label>
                  <label>
                    length(cm)
                    <input
                      type="number"
                      step="0.1"
                      value={selected.line.lengthCm || 0}
                      onChange={(e) =>
                        patchElement(selected.id, (old) => ({
                          ...old,
                          line: { ...old.line!, lengthCm: Number(e.target.value) },
                        }))
                      }
                    />
                  </label>
                  <label>
                    粗细(pt)
                    <input
                      type="number"
                      step="0.1"
                      value={selected.line.thicknessPt}
                      onChange={(e) =>
                        patchElement(selected.id, (old) => ({
                          ...old,
                          line: { ...old.line!, thicknessPt: Number(e.target.value) },
                        }))
                      }
                    />
                  </label>
                </>
              )}
            </div>
          )}

          {(messages.errors.length > 0 || messages.warnings.length > 0) && (
            <div className="publish-messages">
              {messages.errors.map((e, idx) => (
                <p key={`e-${idx}`} className="error">
                  阻断：{e}
                </p>
              ))}
              {messages.warnings.map((w, idx) => (
                <p key={`w-${idx}`} className="warning">
                  警告：{w}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="panel preview-panel">
          <h3>A4 实时预览</h3>
          <A4RedheadPreview template={tpl} selectedId={selectedId} />
        </div>
      </div>
    </div>
  )
}
