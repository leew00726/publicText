import asyncio
import io
import json
import unittest
from unittest.mock import MagicMock, patch

from docx import Document
from fastapi import HTTPException
from fastapi import UploadFile

from app.routers.ai import (
    RewriteRequest,
    SummaryDocxExportRequest,
    export_summary_docx_api,
    rewrite_api,
    summarize_document_api,
)
from app.services.ai_agent import AgentConfigError, DeepSeekAgent, revise_topic_rules_with_deepseek


class DeepSeekAgentTests(unittest.TestCase):
    @patch("app.services.ai_agent.urllib.request.urlopen")
    def test_rewrite_success_returns_content_and_usage(self, mock_urlopen):
        fake_payload = {
            "id": "chatcmpl-test",
            "model": "deepseek-chat",
            "usage": {"total_tokens": 31},
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": "这是润色后的文本。"},
                }
            ],
        }

        fake_resp = MagicMock()
        fake_resp.read.return_value = json.dumps(fake_payload).encode("utf-8")
        fake_resp.__enter__.return_value = fake_resp
        mock_urlopen.return_value = fake_resp

        agent = DeepSeekAgent(
            api_key="test-key",
            endpoint="https://api.deepseek.com/v1/chat/completions",
            model="deepseek-chat",
            timeout_sec=20,
        )
        result = agent.rewrite("原始文本", "formal")

        self.assertEqual(result["text"], "这是润色后的文本。")
        self.assertEqual(result["model"], "deepseek-chat")
        self.assertEqual(result["usage"]["total_tokens"], 31)

    def test_rewrite_without_api_key_raises_config_error(self):
        agent = DeepSeekAgent(
            api_key="",
            endpoint="https://api.deepseek.com/v1/chat/completions",
            model="deepseek-chat",
            timeout_sec=20,
        )
        with self.assertRaises(AgentConfigError):
            agent.rewrite("原始文本", "formal")


class AiRewriteEndpointTests(unittest.TestCase):
    @patch("app.routers.ai.rewrite_with_deepseek")
    def test_rewrite_endpoint_returns_real_agent_result(self, mock_rewrite):
        mock_rewrite.return_value = {
            "text": "润色后正文",
            "model": "deepseek-chat",
            "usage": {"total_tokens": 99},
        }

        body = rewrite_api(RewriteRequest(text="待润色正文", mode="formal"))
        self.assertEqual(body["message"], "ok")
        self.assertEqual(body["rewritten"], "润色后正文")
        self.assertEqual(body["provider"], "deepseek")
        self.assertEqual(body["model"], "deepseek-chat")
        self.assertEqual(body["usage"]["total_tokens"], 99)

    @patch("app.routers.ai.rewrite_with_deepseek")
    def test_rewrite_endpoint_translates_config_error_to_503(self, mock_rewrite):
        mock_rewrite.side_effect = AgentConfigError("missing key")

        with self.assertRaises(HTTPException) as ctx:
            rewrite_api(RewriteRequest(text="待润色正文", mode="formal"))

        self.assertEqual(ctx.exception.status_code, 503)


class TopicRevisionAgentTests(unittest.TestCase):
    @patch("app.services.ai_agent.urllib.request.urlopen")
    def test_revise_topic_rules_returns_patch_and_reply(self, mock_urlopen):
        fake_payload = {
            "id": "chatcmpl-topic-revise",
            "model": "deepseek-chat",
            "usage": {"total_tokens": 56},
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": json.dumps(
                            {
                                "assistantReply": "已将三级标题字体调整为宋体。",
                                "summary": "三级标题改为宋体",
                                "patch": {"headings": {"level3": {"fontFamily": "宋体"}}},
                            },
                            ensure_ascii=False,
                        ),
                    },
                }
            ],
        }

        fake_resp = MagicMock()
        fake_resp.read.return_value = json.dumps(fake_payload).encode("utf-8")
        fake_resp.__enter__.return_value = fake_resp
        mock_urlopen.return_value = fake_resp

        result = revise_topic_rules_with_deepseek(
            current_rules={"body": {"fontFamily": "仿宋_GB2312"}, "headings": {"level3": {"fontFamily": "黑体"}}},
            instruction="把三级标题改为宋体",
            conversation=[{"role": "user", "content": "请把三级标题改成宋体"}],
            settings=type(
                "S",
                (),
                {
                    "deepseek_api_key": "test-key",
                    "deepseek_base_url": "https://api.deepseek.com/v1",
                    "deepseek_model": "deepseek-chat",
                    "deepseek_timeout_sec": 30,
                    "deepseek_temperature": 0.2,
                    "deepseek_system_prompt": "test",
                },
            )(),
        )

        self.assertEqual(result["patch"]["headings"]["level3"]["fontFamily"], "宋体")
        self.assertEqual(result["assistantReply"], "已将三级标题字体调整为宋体。")


class AiDocumentSummaryEndpointTests(unittest.TestCase):
    @patch("app.routers.ai.summarize_document_with_deepseek")
    @patch("app.routers.ai.extract_text_from_uploaded_file")
    def test_summarize_document_endpoint_returns_summary(self, mock_extract, mock_summarize):
        mock_extract.return_value = {
            "text": "这是提取出的正文",
            "truncated": False,
            "originalChars": 120,
            "usedChars": 120,
            "fileType": "txt",
        }
        mock_summarize.return_value = {
            "text": "这是 DeepSeek 的总结结果。",
            "model": "deepseek-chat",
            "usage": {"total_tokens": 88},
        }

        async def _run():
            file = UploadFile(filename="memo.txt", file=io.BytesIO("raw text".encode("utf-8")))
            return await summarize_document_api(file=file, summaryLength="short")

        body = asyncio.run(_run())
        self.assertEqual(body["message"], "ok")
        self.assertEqual(body["summary"], "这是 DeepSeek 的总结结果。")
        self.assertEqual(body["model"], "deepseek-chat")
        self.assertEqual(body["usage"]["total_tokens"], 88)
        self.assertEqual(body["summaryLength"], "short")
        self.assertEqual(body["source"]["fileName"], "memo.txt")

    @patch("app.routers.ai.summarize_document_with_deepseek")
    def test_summarize_document_endpoint_accepts_pasted_text_and_extra_instruction(self, mock_summarize):
        mock_summarize.return_value = {
            "text": "这是按要求生成的总结。",
            "model": "deepseek-chat",
            "usage": {"total_tokens": 66},
        }

        async def _run():
            return await summarize_document_api(
                file=None,
                sourceText="  第一段内容。\n\n第二段内容。  ",
                summaryLength="medium",
                extraInstruction="请按会议纪要格式输出，并用“结论/要点/建议”三级结构。",
            )

        body = asyncio.run(_run())
        self.assertEqual(body["summary"], "这是按要求生成的总结。")
        self.assertEqual(body["source"]["fileName"], "直接粘贴文本")
        self.assertEqual(body["source"]["fileType"], "text")
        mock_summarize.assert_called_once_with(
            source_text="第一段内容。\n\n第二段内容。",
            summary_length="medium",
            extra_instruction="请按会议纪要格式输出，并用“结论/要点/建议”三级结构。",
        )

    def test_export_summary_docx_endpoint_returns_valid_docx(self):
        payload = SummaryDocxExportRequest(
            title="公文总结",
            summary="一、核心结论\n二、后续动作",
            sourceFileName="memo.docx",
        )
        response = export_summary_docx_api(payload)

        async def _collect() -> bytes:
            chunks = []
            async for chunk in response.body_iterator:
                chunks.append(chunk)
            return b"".join(chunks)

        raw = asyncio.run(_collect())
        doc = Document(io.BytesIO(raw))
        texts = [p.text for p in doc.paragraphs if p.text]

        self.assertTrue(any("公文总结" in item for item in texts))
        self.assertTrue(any("核心结论" in item for item in texts))
