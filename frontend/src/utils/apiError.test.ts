import { describe, expect, it } from 'vitest'

import { formatApiErrorDetail, getApiErrorMessage } from './apiError'

describe('formatApiErrorDetail', () => {
  it('formats FastAPI validation details into readable text', () => {
    const detail = [
      {
        type: 'string_too_long',
        loc: ['body', 'instruction'],
        msg: 'String should have at most 500 characters',
      },
      {
        type: 'literal_error',
        loc: ['body', 'conversation', 0, 'role'],
        msg: "Input should be 'user' or 'assistant'",
      },
    ]

    expect(formatApiErrorDetail(detail, '修订失败')).toBe(
      "instruction：String should have at most 500 characters\nconversation.0.role：Input should be 'user' or 'assistant'",
    )
  })

  it('returns a specific timeout message for request timeouts', () => {
    expect(
      getApiErrorMessage(
        { code: 'ECONNABORTED' },
        '修订失败',
        '修订请求超时，请稍后查看最新草稿是否已生成，或检查后端网络与 DeepSeek 配置。',
      ),
    ).toBe('修订请求超时，请稍后查看最新草稿是否已生成，或检查后端网络与 DeepSeek 配置。')
  })
})
