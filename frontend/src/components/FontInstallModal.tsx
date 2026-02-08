import { assetBase } from '../api/client'

interface Props {
  open: boolean
  missing: string[]
  checking: boolean
  onClose: () => void
  onRecheck: () => void
}

export function FontInstallModal({ open, missing, checking, onClose, onRecheck }: Props) {
  if (!open) return null

  return (
    <div className="modal-mask" role="dialog" aria-modal="true">
      <div className="modal">
        <h3>缺少必需字体，已阻断导出</h3>
        <p>缺失字体：{missing.join('、')}</p>
        <p>Windows：解压后右键字体文件，选择“安装/为所有用户安装”。</p>
        <p>macOS：使用 Font Book 打开字体并安装。</p>
        <div className="modal-actions">
          <a href={`${assetBase}/assets/fonts/font-pack.zip`} target="_blank" rel="noreferrer">
            下载字体安装包
          </a>
          <button type="button" onClick={onRecheck} disabled={checking}>
            {checking ? '检测中...' : '已安装，重新检测'}
          </button>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
