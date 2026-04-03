import subprocess
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"


class SettingsEnvFileTests(unittest.TestCase):
    def test_settings_loads_root_env_even_when_started_from_backend_dir(self) -> None:
        proc = subprocess.run(
            [
                sys.executable,
                "-c",
                "from app.config import Settings; print(bool(Settings().deepseek_api_key))",
            ],
            cwd=str(BACKEND_DIR),
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(proc.stdout.strip(), "True")


if __name__ == "__main__":
    unittest.main()
