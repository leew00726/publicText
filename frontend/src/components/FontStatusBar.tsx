import { assetBase } from '../api/client'
import type { FontStatus } from '../utils/fontCheck'

interface Props {
  status: FontStatus
  missing: string[]
  onOpenInstaller: () => void
}

export function FontStatusBar({ status, missing, onOpenInstaller }: Props) {
  const isOk = missing.length === 0

  return (
    <div className={`font-status ${isOk ? 'ok' : 'error'}`}>
      <div className="font-list">
        {Object.entries(status).map(([font, installed]) => (
          <span key={font} className={installed ? 'installed' : 'missing'}>
            {font}: {installed ? '已安装' : '缺失'}
          </span>
        ))}
      </div>
      {!isOk && (
        <div className="font-actions">
          <button type="button" onClick={onOpenInstaller}>
            查看安装说明
          </button>
          <a href={`${assetBase}/assets/fonts/font-pack.zip`} target="_blank" rel="noreferrer">
            下载字体包
          </a>
        </div>
      )}
    </div>
  )
}
