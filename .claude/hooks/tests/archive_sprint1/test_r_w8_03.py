# Tests R-W8-03-AC1, R-W8-03-AC2, R-W8-03-AC3
"""
Review-type acceptance tests for H-903: Configuration Documentation + .env.example
Validates that .env.example and PROJECT_BRIEF.md are consistent and complete.
"""
import os
import re
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
ENV_EXAMPLE = os.path.join(ROOT, '.env.example')
PROJECT_BRIEF = os.path.join(ROOT, 'PROJECT_BRIEF.md')


def _read(path: str) -> str:
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()


class TestEnvExampleCompleteness:
    """R-W8-03a: .env.example lists every VITE_ and server env var."""

    def test_env_example_exists(self):
        assert os.path.isfile(ENV_EXAMPLE), '.env.example must exist'

    def test_contains_all_vite_firebase_vars(self):
        content = _read(ENV_EXAMPLE)
        expected = [
            'VITE_FIREBASE_API_KEY',
            'VITE_FIREBASE_AUTH_DOMAIN',
            'VITE_FIREBASE_PROJECT_ID',
            'VITE_FIREBASE_STORAGE_BUCKET',
            'VITE_FIREBASE_MESSAGING_SENDER_ID',
            'VITE_FIREBASE_APP_ID',
            'VITE_FIREBASE_MEASUREMENT_ID',
        ]
        for var in expected:
            assert var in content, f'{var} missing from .env.example'

    def test_contains_vite_api_url(self):
        content = _read(ENV_EXAMPLE)
        assert 'VITE_API_URL' in content

    def test_contains_vite_google_maps(self):
        content = _read(ENV_EXAMPLE)
        assert 'VITE_GOOGLE_MAPS_API_KEY' in content

    def test_contains_vite_weather_keys(self):
        content = _read(ENV_EXAMPLE)
        assert 'VITE_WEATHER_API_KEY' in content
        assert 'VITE_OPENWEATHER_API_KEY' in content

    def test_contains_server_db_vars(self):
        content = _read(ENV_EXAMPLE)
        for var in ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DB_SOCKET_PATH']:
            assert var in content, f'{var} missing from .env.example'

    def test_contains_server_firebase_vars(self):
        content = _read(ENV_EXAMPLE)
        assert 'GOOGLE_APPLICATION_CREDENTIALS' in content
        assert 'FIREBASE_PROJECT_ID' in content

    def test_contains_server_api_keys(self):
        content = _read(ENV_EXAMPLE)
        assert 'GEMINI_API_KEY' in content
        assert 'GOOGLE_MAPS_API_KEY' in content

    def test_contains_server_weather_vars(self):
        content = _read(ENV_EXAMPLE)
        assert 'WEATHER_ENABLED' in content
        assert 'WEATHER_API_KEY' in content

    def test_contains_server_config_vars(self):
        content = _read(ENV_EXAMPLE)
        for var in ['CORS_ORIGIN', 'PORT', 'NODE_ENV', 'RATE_LIMIT_MAX']:
            assert var in content, f'{var} missing from .env.example'

    def test_contains_auth_and_logging_vars(self):
        content = _read(ENV_EXAMPLE)
        for var in ['JWT_SECRET', 'LOG_LEVEL', 'APP_VERSION']:
            assert var in content, f'{var} missing from .env.example'

    def test_contains_testing_vars(self):
        content = _read(ENV_EXAMPLE)
        for var in ['FIREBASE_WEB_API_KEY', 'DEBUG_TESTS', 'REQUIRE_INFRA']:
            assert var in content, f'{var} missing from .env.example'


class TestEnvExampleComments:
    """R-W8-03b: Each var has comment describing purpose and required/optional."""

    def test_every_uncommented_var_has_preceding_comment(self):
        content = _read(ENV_EXAMPLE)
        lines = content.splitlines()
        var_pattern = re.compile(r'^[A-Z][A-Z0-9_]+=')
        for i, line in enumerate(lines):
            if var_pattern.match(line.strip()):
                # Look backward for a comment within 10 lines, skipping
                # blank lines and other uncommented vars (grouped vars
                # share a single header comment block).
                found_comment = False
                for j in range(i - 1, max(i - 10, -1), -1):
                    stripped = lines[j].strip()
                    if stripped.startswith('#'):
                        found_comment = True
                        break
                    if stripped == '' or var_pattern.match(stripped):
                        continue
                    break
                assert found_comment, f'Variable {line.strip().split("=")[0]} at line {i+1} has no preceding comment'

    def test_required_optional_annotations_present(self):
        content = _read(ENV_EXAMPLE)
        assert '[REQUIRED]' in content, 'Missing [REQUIRED] annotations'
        assert '[OPTIONAL]' in content, 'Missing [OPTIONAL] annotations'

    def test_feature_grouping_sections_present(self):
        content = _read(ENV_EXAMPLE)
        sections = [
            'Firebase Frontend',
            'Frontend API URL',
            'Google Maps (Frontend)',
            'Weather (Frontend)',
            'MySQL',
            'Firebase Admin',
            'Gemini',
            'CORS',
            'Express Server',
            'Authentication',
            'Logging',
            'Testing',
        ]
        for section in sections:
            assert section in content, f'Section "{section}" missing from .env.example'


class TestProjectBriefConsistency:
    """R-W8-03c: PROJECT_BRIEF.md environment section matches .env.example."""

    def test_project_brief_references_env_example(self):
        content = _read(PROJECT_BRIEF)
        assert '.env.example' in content, 'PROJECT_BRIEF.md must reference .env.example'

    def test_project_brief_lists_key_env_vars(self):
        content = _read(PROJECT_BRIEF)
        key_vars = [
            'VITE_FIREBASE_',
            'VITE_GOOGLE_MAPS_API_KEY',
            'VITE_WEATHER_API_KEY',
            'GEMINI_API_KEY',
            'DB_HOST',
            'FIREBASE_PROJECT_ID',
            'GOOGLE_MAPS_API_KEY',
            'WEATHER_API_KEY',
        ]
        for var in key_vars:
            assert var in content, f'{var} missing from PROJECT_BRIEF.md External Dependencies'

    def test_project_brief_environment_setup_section(self):
        content = _read(PROJECT_BRIEF)
        assert '## Environment Setup' in content
        assert 'cp .env.example .env' in content
        assert 'serviceAccount.json' in content

    def test_project_brief_full_variable_reference_callout(self):
        content = _read(PROJECT_BRIEF)
        assert 'Full variable reference' in content
