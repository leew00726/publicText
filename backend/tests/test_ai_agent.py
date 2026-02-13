import json
import unittest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from app.routers.ai import RewriteRequest, rewrite_api
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
