"""Black-box integration tests against a running CollabDocs server.
Run: BASE_URL=http://localhost:3000 python -m pytest -q tests/test_api.py
Uses real HTTP sessions and the application's PostgreSQL persistence.
"""
import io
import json
import hashlib
import zipfile
import os
import uuid
import urllib.error
import urllib.request
import http.cookiejar
import urllib.parse
import pytest

# An empty BASE_URL falls back to the default, like the Playwright config.
BASE_URL = (os.environ.get("BASE_URL") or "http://localhost:3000").rstrip("/")


class API:
    def __init__(self):
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))

    def request(self, method, path, data=None, raw=None, content_type=None, extra_headers=None):
        payload = raw if raw is not None else json.dumps(data).encode() if data is not None else None
        headers = {"Content-Type": content_type or "application/json"} if payload is not None else {}
        headers.update(extra_headers or {})
        request = urllib.request.Request(BASE_URL + "/api" + path, data=payload, headers=headers, method=method)
        try:
            response = self.opener.open(request, timeout=30)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            return response.status, json.loads(response.read())

    def login(self, email):
        status, body = self.request("POST", "/auth/login", {"email": email, "password": "demo123"})
        assert status == 200, body
        return body["user"]

    def upload(self, filename, text):
        boundary = "CollabDocs" + uuid.uuid4().hex
        raw = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\nContent-Type: text/plain\r\n\r\n").encode() + text + f"\r\n--{boundary}--\r\n".encode()
        return self.request("POST", "/documents/import", raw=raw, content_type=f"multipart/form-data; boundary={boundary}")


@pytest.fixture(scope="module")
def accounts():
    owner = API()
    reviewer = API()
    owner_user = owner.login("abhay@example.com")
    reviewer_user = reviewer.login("reviewer@example.com")
    return owner, reviewer, owner_user, reviewer_user


@pytest.fixture
def document(accounts):
    owner = accounts[0]
    status, data = owner.request("POST", "/documents", {"title": "Integration test " + uuid.uuid4().hex[:8]})
    assert status == 201, data
    doc = data["document"]
    yield doc
    owner.request("DELETE", "/documents/" + doc["id"])
    owner.request("DELETE", "/documents/" + doc["id"] + "?permanent=true")


def test_demo_owner_has_candidate_display_name(accounts):
    _, _, owner_user, reviewer_user = accounts
    assert owner_user["name"] == "Abhay Chouhan"
    assert reviewer_user["name"] == "Alex Morgan"


def test_anonymous_and_invalid_login_are_rejected():
    anonymous = API()
    assert anonymous.request("GET", "/documents")[0] == 401
    assert anonymous.request("POST", "/documents", {"title": "No access"})[0] == 401
    assert anonymous.request("POST", "/auth/login", {"email": "abhay@example.com", "password": "incorrect"})[0] == 401


def test_create_retrieve_update_and_preserve_formatting(accounts, document):
    owner = accounts[0]
    path = "/documents/" + document["id"]
    status, result = owner.request("GET", path)
    assert status == 200
    assert result["document"]["title"] == document["title"]
    content = {"type": "doc", "content": [
        {"type": "heading", "attrs": {"level": 2, "textAlign": "center"}, "content": [{"type": "text", "text": "Persistent heading"}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "Bold, italic and underlined", "marks": [{"type": "bold"}, {"type": "italic"}, {"type": "underline"}]}]},
    ]}
    status, updated = owner.request("PUT", path, {"title": "Updated integration document", "content": content, "revision": document["revision"]})
    assert status == 200, updated
    assert updated["document"]["revision"] == document["revision"] + 1
    fetched = owner.request("GET", path)[1]["document"]
    assert fetched["content"] == content
    assert fetched["title"] == "Updated integration document"
    assert owner.request("PUT", path, {"content": content, "revision": document["revision"]})[0] == 409
    assert owner.request("GET", path)[1]["document"]["content"] == content


def test_private_access_sharing_viewer_permissions_and_revocation(accounts, document):
    owner, reviewer, _, reviewer_user = accounts
    path = "/documents/" + document["id"]
    for method, payload in [("GET", None), ("PUT", {"title": "Unauthorized"}), ("DELETE", None)]:
        assert reviewer.request(method, path, payload)[0] == 404
    assert document["id"] not in [d["id"] for d in reviewer.request("GET", "/documents")[1]["documents"]]
    status, shared = owner.request("POST", path + "/share", {"email": "reviewer@example.com", "permission": "editor"})
    assert status == 201, shared
    status, visible = reviewer.request("GET", path)
    assert status == 200 and visible["document"]["permission"] == "editor"
    assert reviewer.request("PUT", path, {"title": "Edited by collaborator", "revision": visible["document"]["revision"]})[0] == 200
    assert reviewer.request("DELETE", path)[0] == 403
    assert reviewer.request("POST", path + "/share", {"email": "abhay@example.com"})[0] == 403
    shares = owner.request("GET", path + "/shares")[1]
    assert shares["collaborators"][0]["email"] == "reviewer@example.com"
    assert owner.request("POST", path + "/share", {"email": "reviewer@example.com", "permission": "viewer"})[0] == 201
    assert reviewer.request("GET", path)[1]["document"]["permission"] == "viewer"
    assert reviewer.request("PUT", path, {"title": "Viewer cannot edit"})[0] == 403
    assert owner.request("DELETE", path + "/shares/" + reviewer_user["id"])[0] == 200
    assert reviewer.request("GET", path)[0] == 404


def test_import_markdown_plain_text_and_file_validation(accounts):
    owner = accounts[0]
    status, body = owner.upload("Imported notes.md", b"# A heading\n\nSome **bold** thinking.\n\n- First idea\n- Second idea")
    assert status == 201, body
    doc = body["document"]
    try:
        assert doc["title"] == "Imported notes"
        assert doc["content"]["content"][0]["type"] == "heading"
        assert "bold" in json.dumps(doc["content"])
        assert "bulletList" in json.dumps(doc["content"])
        assert owner.request("GET", "/documents/" + doc["id"])[1]["document"]["content"] == doc["content"]
    finally:
        owner.request("DELETE", "/documents/" + doc["id"])
        owner.request("DELETE", "/documents/" + doc["id"] + "?permanent=true")
    status, body = owner.upload("plain.txt", b"# This stays plain text\nAnother line")
    assert status == 201
    text_doc = body["document"]
    try:
        assert text_doc["content"]["content"][0]["type"] == "paragraph"
    finally:
        owner.request("DELETE", "/documents/" + text_doc["id"])
        owner.request("DELETE", "/documents/" + text_doc["id"] + "?permanent=true")
    assert owner.upload("unsupported.pdf", b"not a real pdf")[0] == 415
    assert owner.upload("empty.txt", b"")[0] == 400
    assert owner.upload("binary.txt", b"invalid\x00binary")[0] == 400
    assert owner.upload("invalid.txt", b"\xff\xfe")[0] == 400
    assert owner.upload("too-large.txt", b"a" * 1_048_577)[0] == 413


def test_favorites_trash_restore_and_owner_checks(accounts, document):
    owner, reviewer, _, _ = accounts
    path = "/documents/" + document["id"]
    owner.request("POST", path + "/share", {"email": "reviewer@example.com"})
    assert owner.request("POST", path + "/star", {"starred": True})[0] == 200
    assert owner.request("GET", path)[1]["document"]["starred"] is True
    assert reviewer.request("GET", path)[1]["document"]["starred"] is False
    assert owner.request("DELETE", path)[0] == 200
    assert reviewer.request("GET", path)[0] == 404
    assert owner.request("GET", path)[0] == 404
    assert document["id"] in [d["id"] for d in owner.request("GET", "/documents?trash=true")[1]["documents"]]
    assert reviewer.request("POST", path + "/restore")[0] == 404
    assert owner.request("POST", path + "/restore")[0] == 200
    assert reviewer.request("GET", path)[0] == 200


def test_input_validation(accounts, document):
    owner = accounts[0]
    path = "/documents/" + document["id"]
    assert owner.request("POST", "/documents", {"title": " "})[0] == 400
    assert owner.request("PUT", path, {"title": "a" * 161})[0] == 400
    assert owner.request("PUT", path, {"content": {"type": "doc", "content": [{"type": "script", "text": "alert(1)"}]}, "revision": document["revision"]})[0] == 400
    assert owner.request("PUT", path, {"content": {"type": "doc", "content": [{"type": "paragraph"}]}})[0] == 400
    assert owner.request("POST", path + "/share", {"email": "nobody@example.com"})[0] == 404
    assert owner.request("POST", path + "/share", {"email": "abhay@example.com"})[0] == 400


def test_https_proxy_cookie_flags_and_cross_site_rejection():
    client = API()
    https_origin = urllib.parse.urlsplit(BASE_URL)._replace(scheme="https", path="", query="", fragment="").geturl()
    credentials = {"email": "abhay@example.com", "password": "demo123"}
    status, body = client.request("POST", "/auth/login", credentials, extra_headers={"Origin": https_origin})
    assert status == 200, body
    cookie = next(cookie for cookie in client.cookies if cookie.name == "collabdocs_session")
    assert cookie.secure is True
    assert cookie.has_nonstandard_attr("HttpOnly")
    assert cookie.get_nonstandard_attr("SameSite").lower() == "lax"
    status, _ = client.request("POST", "/auth/login", credentials, extra_headers={"Origin": "https://untrusted.invalid", "Sec-Fetch-Site": "cross-site"})
    assert status == 403


def test_assessment_archive_is_complete_verifiable_and_excludes_secrets():
    with urllib.request.urlopen(BASE_URL + "/api/assessment/download?file=package", timeout=60) as response:
        assert response.status == 200
        assert response.headers["Content-Type"] == "application/zip"
        archive_bytes = response.read()
    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
        names = set(archive.namelist())
        assert archive.testzip() is None
        for required in ["README.md", "ARCHITECTURE.md", "AI_WORKFLOW.md", "SUBMISSION.md", "WALKTHROUGH_SCRIPT.md", "WALKTHROUGH_VIDEO_URL.txt", "package-lock.json", "src/db/schema.ts", "src/lib/server.ts", "tests/test_api.py", "examples/reviewer-notes.md", "public/screenshots/dashboard-desktop.png", "DEPLOYMENT.md", "render.yaml", "scripts/migrate.mjs", "scripts/schema.sql", ".node-version", ".env.example"]:
            assert "CollabDocs/" + required in names
        for name in names:
            parts = name.split("/")
            assert "node_modules" not in parts and ".next" not in parts
            assert parts[-1] == ".env.example" or not parts[-1].startswith(".env")
        manifest = json.loads(archive.read("CollabDocs/MANIFEST.json"))
        for item in manifest["contents"]:
            content = archive.read(item["path"])
            assert len(content) == item["bytes"]
            assert hashlib.sha256(content).hexdigest() == item["sha256"]
        submission = archive.read("CollabDocs/SUBMISSION.md").decode()
        assert len(submission.splitlines()) <= 1000
        assert "Abhay Chouhan" in submission
        assert "abhaydinakar246@gmail.com" in submission
        assert "PENDING" in archive.read("CollabDocs/WALKTHROUGH_VIDEO_URL.txt").decode()
    with urllib.request.urlopen(BASE_URL + "/api/assessment/download?file=video-script", timeout=30) as response:
        script = response.read().decode().lower()
        assert "four-minute" in script
        assert "0:00" in script
    assert API().request("GET", "/assessment/download?file=../../.env")[0] == 400
