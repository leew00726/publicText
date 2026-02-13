import { useLocation, useNavigate } from 'react-router-dom'

export function GlobalBackButton() {
  const navigate = useNavigate()
  const location = useLocation()

  if (location.pathname === '/') {
    return null
  }

  return (
    <button
      type="button"
      className="global-back-btn"
      onClick={() => {
        if (window.history.length > 1) {
          navigate(-1)
        } else {
          navigate('/')
        }
      }}
    >
      返回上一级
    </button>
  )
}
